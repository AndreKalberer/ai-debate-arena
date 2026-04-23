import { askOpenAI, askOpenAIStream } from "../ai/openai.js";
import { askClaude, askClaudeStream } from "../ai/anthropic.js";
import { askGemini, askGeminiStream } from "../ai/gemini.js";
import { runJudges } from "./judging.js";
import type { ModelKey, JudgeVerdict } from "./judging.types.js";
import { sanitizeTopic } from "./sanitize.js";

type DiscussionMessage = {
  model: "openai" | "anthropic" | "gemini";
  text: string;
  messageNumber: number;
};

type DiscussionResult = {
  topic: string;
  messages: DiscussionMessage[];
  consensus: string | null;
  requiredJudging: boolean;
  verdicts?: JudgeVerdict[];
};

type ProgressCallback = (status: string, data?: any) => void;

const MODEL_MAP = {
  openai: askOpenAI,
  anthropic: askClaude,
  gemini: askGemini,
};

const MODEL_MAP_STREAM: Record<
  "openai" | "anthropic" | "gemini",
  (prompt: string) => AsyncGenerator<string>
> = {
  openai: askOpenAIStream,
  anthropic: askClaudeStream,
  gemini: askGeminiStream,
};

const MODEL_NAMES = {
  openai: "ChatGPT-5",
  anthropic: "Claude 4.5 Sonnet",
  gemini: "Gemini 2.5",
};

/**
 * Check if all three models agree on the answer
 */
function checkConsensus(lastThreeMessages: DiscussionMessage[]): boolean {
  if (lastThreeMessages.length < 3) return false;

  // Simple heuristic: check if the last messages from each model contain agreement keywords
  const agreementKeywords = [
    "agree",
    "consensus",
    "correct",
    "right",
    "exactly",
    "yes",
    "concur",
  ];
  const disagreementKeywords = [
    "disagree",
    "however",
    "but",
    "no",
    "incorrect",
    "wrong",
    "different",
  ];

  let agreementCount = 0;
  for (const msg of lastThreeMessages) {
    const lowerText = msg.text.toLowerCase();
    const hasAgreement = agreementKeywords.some((kw) => lowerText.includes(kw));
    const hasDisagreement = disagreementKeywords.some((kw) =>
      lowerText.includes(kw),
    );

    if (hasAgreement && !hasDisagreement) {
      agreementCount++;
    }
  }

  // If at least 2 of the last 3 messages show agreement, consider it consensus
  return agreementCount >= 2;
}

/**
 * Build context from conversation history
 */
function buildContext(messages: DiscussionMessage[]): string {
  if (messages.length === 0) return "";

  return messages.map((m) => `${MODEL_NAMES[m.model]}: ${m.text}`).join("\n\n");
}

/**
 * Run a 3-way discussion between GPT-5, Claude 4.5, and Gemini 2.5
 * They discuss until consensus or 15 messages (5 per model), then judges decide if needed
 */
export async function runDiscussion(
  topic: string,
  onProgress?: ProgressCallback,
): Promise<DiscussionResult> {
  const messages: DiscussionMessage[] = [];
  const MAX_MESSAGES = 15; // 5 per model
  const MESSAGES_PER_MODEL = 5;
  let consensusReached = false;
  let consensusText: string | null = null;
  topic = sanitizeTopic(topic);

  console.log("Starting 3-way AI discussion");
  onProgress?.("Starting discussion", { topic });

  // Round-robin discussion: openai -> anthropic -> gemini -> repeat
  const modelOrder: ("openai" | "anthropic" | "gemini")[] = [
    "openai",
    "anthropic",
    "gemini",
  ];
  let modelIndex = 0;

  for (let msgNum = 1; msgNum <= MAX_MESSAGES; msgNum++) {
    const currentModel = modelOrder[modelIndex % 3];
    const messagesPerThisModel = messages.filter(
      (m) => m.model === currentModel,
    ).length;

    // Stop if this model has already sent 5 messages
    if (messagesPerThisModel >= MESSAGES_PER_MODEL) {
      modelIndex++;
      continue;
    }

    onProgress?.(`${MODEL_NAMES[currentModel]} responding`, {
      messageNumber: msgNum,
    });

    // Build the prompt based on conversation history
    let prompt: string;
    if (messages.length === 0) {
      // First message - OpenAI starts
      prompt = `You are ${MODEL_NAMES[currentModel]} participating in a collaborative discussion with Claude 4.5 Sonnet and Gemini 2.5.

Topic: <topic>${topic}</topic>

Provide your initial answer or perspective on this topic in 100-150 words. Be clear and thoughtful.`;
    } else {
      // Subsequent messages - respond to the ongoing discussion
      const context = buildContext(messages);
      prompt = `You are ${MODEL_NAMES[currentModel]} participating in a collaborative discussion with other AI models.

Topic: <topic>${topic}</topic>

Discussion so far:
${context}

Respond to the discussion above (100-150 words). If you agree with the previous points, say so explicitly. If you disagree or have a different perspective, explain your reasoning clearly.`;
    }

    // Get response from current model with streaming
    let response = "";
    const msgIndex = messages.length;
    try {
      for await (const chunk of MODEL_MAP_STREAM[currentModel](prompt)) {
        response += chunk;
        onProgress?.("chunk", { text: chunk, msgIndex });
      }
    } catch (error: any) {
      console.error(`Error streaming from ${currentModel}:`, error);
      onProgress?.("error", { 
        message: `${MODEL_NAMES[currentModel]} failed: ${error.message}`,
        model: currentModel
      });
      throw new Error(`${MODEL_NAMES[currentModel]} streaming failed: ${error.message}`);
    }
    
    if (!response || response.trim().length === 0) {
      throw new Error(`${MODEL_NAMES[currentModel]} returned empty response`);
    }

    const message: DiscussionMessage = {
      model: currentModel,
      text: response,
      messageNumber: msgNum,
    };

    messages.push(message);
    onProgress?.("message", message);

    // Check for consensus after at least 6 messages (2 rounds)
    if (messages.length >= 6 && messages.length % 3 === 0) {
      const lastThreeMessages = messages.slice(-3);
      if (checkConsensus(lastThreeMessages)) {
        consensusReached = true;

        // Get a summary of the consensus (with streaming)
        onProgress?.("Consensus reached - generating summary", {});
        let consensusSummary = "";
        const summaryMsgIndex = messages.length;
        for await (const chunk of askClaudeStream(
          `The following AI models have reached consensus on the topic: <topic>${topic}</topic>

Final statements:
${buildContext(lastThreeMessages)}

Provide a brief summary (50-100 words) of the consensus position they've agreed upon.`,
        )) {
          consensusSummary += chunk;
          onProgress?.("chunk", { text: chunk, msgIndex: summaryMsgIndex });
        }
        consensusText = consensusSummary;

        console.log("Consensus reached after", messages.length, "messages");
        onProgress?.("Discussion complete - consensus reached", {});
        break;
      }
    }

    modelIndex++;
  }

  // If no consensus after 15 messages, bring in judges
  if (!consensusReached) {
    console.log("No consensus reached - bringing in judges");
    onProgress?.("No consensus - judges voting", {});

    // Group messages by model
    const openaiText = messages
      .filter((m) => m.model === "openai")
      .map((m) => m.text)
      .join("\n\n");
    const claudeText = messages
      .filter((m) => m.model === "anthropic")
      .map((m) => m.text)
      .join("\n\n");
    const geminiText = messages
      .filter((m) => m.model === "gemini")
      .map((m) => m.text)
      .join("\n\n");

    // Create a combined prompt for judges
    const judgePrompt = `You are judging a discussion between three AI models on: <topic>${topic}</topic>

ChatGPT-5 perspective:
---
${openaiText}
---

Claude 4.5 Sonnet perspective:
---
${claudeText}
---

Gemini 2.5 perspective:
---
${geminiText}
---

Judge which model's overall stance and reasoning is most convincing.

Return ONLY a JSON object with:
{
  "winner": "openai" | "anthropic" | "gemini",
  "reasoning": "one concise paragraph (80-150 words) explaining your decision"
}`;

    const [oaiRaw, judgeClaudeRaw, judgeGeminiRaw] = await Promise.all([
      askOpenAI(judgePrompt),
      askClaude(judgePrompt),
      askGemini(judgePrompt),
    ]);

    // Parse judge responses
    const parseWinner = (
      raw: string,
    ): { winner: string; reasoning: string } => {
      // Try to find and parse JSON object - extract ONLY the reasoning field
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const obj = JSON.parse(jsonMatch[0]);
          const reasoning = obj.reasoning ? obj.reasoning.trim() : "";
          if (reasoning) {
            // Return ONLY the reasoning from JSON, ignore everything else
            return {
              winner: obj.winner || "tie",
              reasoning: reasoning,
            };
          }
        } catch (e) {
          console.error("JSON parse error:", e, "Raw:", raw.slice(0, 200));
        }
      }
      
      // Fallback: Extract reasoning from any text after "reasoning"
      const reasoningMatch = raw.match(/["']?reasoning["']?\s*:\s*["']([^"']+)["']/);
      if (reasoningMatch && reasoningMatch[1]) {
        const lowerRaw = raw.toLowerCase();
        const winner = lowerRaw.includes("openai") || lowerRaw.includes("gpt") ? "openai" :
                       lowerRaw.includes("anthropic") || lowerRaw.includes("claude") ? "anthropic" :
                       lowerRaw.includes("gemini") ? "gemini" : "tie";
        return { winner, reasoning: reasoningMatch[1].trim() };
      }
      
      // Last resort: strip JSON markers and return clean text
      const cleaned = raw.replace(/```json/gi, '')
                         .replace(/```/g, '')
                         .replace(/\{[^}]*"winner"[^}]*\}/gi, '')
                         .trim();
      
      const lowerCleaned = cleaned.toLowerCase();
      const winner = lowerCleaned.includes("openai") || lowerCleaned.includes("gpt") ? "openai" :
                     lowerCleaned.includes("anthropic") || lowerCleaned.includes("claude") ? "anthropic" :
                     lowerCleaned.includes("gemini") ? "gemini" : "tie";
      
      return { winner, reasoning: cleaned.slice(0, 600) || "Unable to parse judge decision" };
    };

    const oaiJudge = parseWinner(oaiRaw);
    const claudeJudge = parseWinner(judgeClaudeRaw);
    const geminiJudge = parseWinner(judgeGeminiRaw);

    const verdicts: JudgeVerdict[] = [
      {
        judge: "openai",
        winner: oaiJudge.winner as any,
        reasoning: oaiJudge.reasoning,
      },
      {
        judge: "anthropic",
        winner: claudeJudge.winner as any,
        reasoning: claudeJudge.reasoning,
      },
      {
        judge: "gemini",
        winner: geminiJudge.winner as any,
        reasoning: geminiJudge.reasoning,
      },
    ];

    return {
      topic,
      messages,
      consensus: null,
      requiredJudging: true,
      verdicts,
    };
  }

  return {
    topic,
    messages,
    consensus: consensusText,
    requiredJudging: false,
  };
}
