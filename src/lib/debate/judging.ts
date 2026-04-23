// src/lib/debate/judging.ts
import type { JudgeVerdict } from "./judging.types.js";
import { askOpenAI } from "../ai/openai.js";
import { askClaude } from "../ai/anthropic.js";
import { askGemini } from "../ai/gemini.js";
import { sanitizeTopic } from "./sanitize.js";

const JUDGE_PROMPT = (topic: string, aff: string, neg: string): string => `You are a debate judge.
Resolution: <topic>${sanitizeTopic(topic)}</topic>

Affirmative:
---
${aff}
---

Negative:
---
${neg}
---

Judge using the following criteria, weighing each equally:
- Use of evidence and warrants
- Responsiveness and clash
- Impact analysis and comparative reasoning
- Clarity and structure

Return ONLY a JSON object with:
{
  "winner": "affirmative" | "negative" | "tie",
  "reasoning": "one concise paragraph (80-150 words) explaining your decision"
}`;

function parseWinner(raw: string): { winner: "affirmative" | "negative" | "tie"; reasoning: string } {
  // Try to find and parse JSON object - extract ONLY the reasoning field
  const jsonMatch = raw.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      const w = obj.winner === "affirmative" || obj.winner === "negative" || obj.winner === "tie"
        ? obj.winner
        : "tie";
      const r = typeof obj.reasoning === "string" ? obj.reasoning.trim() : "";
      if (r) {
        // Return ONLY the reasoning from JSON, ignore everything else
        return { winner: w, reasoning: r };
      }
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", raw.slice(0, 200));
    }
  }
  
  // Fallback: Extract reasoning from any text after "reasoning"
  // Remove any JSON-like text and just get the actual reasoning content
  const reasoningMatch = raw.match(/["']?reasoning["']?\s*:\s*["']([^"']+)["']/);
  if (reasoningMatch && reasoningMatch[1]) {
    const winner = raw.toLowerCase().includes("affirmative") ? "affirmative" : 
                   raw.toLowerCase().includes("negative") ? "negative" : "tie";
    return { winner, reasoning: reasoningMatch[1].trim() };
  }
  
  // Last resort: strip JSON markers and return clean text
  const cleaned = raw.replace(/```json/gi, '')
                     .replace(/```/g, '')
                     .replace(/\{[^}]*"winner"[^}]*\}/gi, '')
                     .trim();
  
  const winner = cleaned.toLowerCase().includes("affirmative") ? "affirmative" : 
                 cleaned.toLowerCase().includes("negative") ? "negative" : "tie";
  
  return { winner, reasoning: cleaned.slice(0, 600) || "Unable to parse judge decision" };
}

export async function runJudges(input: {
  topic: string;
  affirmativeText: string;
  negativeText: string;
}): Promise<JudgeVerdict[]> {
  const prompt = JUDGE_PROMPT(input.topic, input.affirmativeText, input.negativeText);
  const [oaiRaw, claudeRaw, geminiRaw] = await Promise.all([
    askOpenAI(prompt),
    askClaude(prompt),
    askGemini(prompt),
  ]);
  const oai = parseWinner(oaiRaw);
  const claude = parseWinner(claudeRaw);
  const gemini = parseWinner(geminiRaw);
  const verdicts: JudgeVerdict[] = [
    { judge: "openai", winner: oai.winner, reasoning: oai.reasoning },
    { judge: "anthropic", winner: claude.winner, reasoning: claude.reasoning },
    { judge: "gemini", winner: gemini.winner, reasoning: gemini.reasoning },
  ];
  return verdicts;
}