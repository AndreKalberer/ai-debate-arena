import { askOpenAI, askOpenAIStream } from "../ai/openai.js";
import { askClaude, askClaudeStream } from "../ai/anthropic.js";
import { askGemini, askGeminiStream } from "../ai/gemini.js";
import { runJudges } from "./judging.js";
import type { ModelKey, JudgeVerdict } from "./judging.types.js";
import { sanitizeTopic } from "./sanitize.js";

type Message = {
  role: "affirmative" | "negative" | "moderator";
  model: ModelKey;
  text: string;
  round: number;
};

type DebateResultV2 = {
  topic: string;
  affirmativeModel: ModelKey;
  negativeModel: ModelKey;
  messages: Message[];
  verdicts: JudgeVerdict[];
};

const MODEL_MAP: Record<ModelKey, (prompt: string) => Promise<string>> = {
  openai: askOpenAI,
  anthropic: askClaude,
  gemini: askGemini,
};

const MODEL_MAP_STREAM: Record<
  ModelKey,
  (prompt: string) => AsyncGenerator<string>
> = {
  openai: askOpenAIStream,
  anthropic: askClaudeStream,
  gemini: askGeminiStream,
};

type ProgressCallback = (status: string, data?: any) => void;

export async function runDebateWithModelsV2(
  topic: string,
  affirmativeModel: ModelKey,
  negativeModel: ModelKey,
  rounds: number = 2,
  onProgress?: ProgressCallback,
): Promise<DebateResultV2> {
  const messages: Message[] = [];
  topic = sanitizeTopic(topic);

  console.log(`Starting multi-round debate — rounds:${rounds}`);
  onProgress?.("Starting debate", { topic, rounds });

  // Round 1: Affirmative Opening
  onProgress?.("Round 1: Affirmative opening", {
    round: 1,
    stage: "affirmative",
  });
  let affOpening = "";
  let msgIndex = messages.length;
  for await (const chunk of MODEL_MAP_STREAM[affirmativeModel](
    `You are debating the affirmative side of: <topic>${topic}</topic>

Write a brief opening statement (100-150 words) presenting your 2-3 strongest arguments.
Be clear and persuasive.`,
  )) {
    affOpening += chunk;
    onProgress?.("chunk", { text: chunk, msgIndex });
  }

  messages.push({
    role: "affirmative",
    model: affirmativeModel,
    text: affOpening,
    round: 1,
  });
  onProgress?.("message", messages[messages.length - 1]);

  // Round 1: Negative Opening
  onProgress?.("Round 1: Negative opening", { round: 1, stage: "negative" });
  let negOpening = "";
  msgIndex = messages.length;
  for await (const chunk of MODEL_MAP_STREAM[negativeModel](
    `You are debating the negative side of: <topic>${topic}</topic>

The affirmative just said:
"${affOpening}"

Write a brief opening (100-150 words) with 2-3 counter-arguments.`,
  )) {
    negOpening += chunk;
    onProgress?.("chunk", { text: chunk, msgIndex });
  }

  messages.push({
    role: "negative",
    model: negativeModel,
    text: negOpening,
    round: 1,
  });
  onProgress?.("message", messages[messages.length - 1]);

  // Helper function to check if moderator should intervene
  async function checkForIntervention(
    lastMessage: Message,
  ): Promise<string | null> {
    try {
      const checkPrompt = `You are a debate moderator. Analyze this argument for logical fallacies, bias, or misleading claims.

Argument: "${lastMessage.text}"

If you detect ANY of these issues, respond with "INTERVENE: [brief 30-50 word explanation]"
If the argument is sound, respond with "OK"`;

      const check = await askClaude(checkPrompt);
      if (check.startsWith("INTERVENE:")) {
        return check.substring(10).trim();
      }
      return null;
    } catch (error) {
      console.error("Moderator intervention check failed:", error);
      // Return null to continue debate without intervention
      return null;
    }
  }

  // Middle rounds: Rebuttals
  for (let round = 2; round <= rounds; round++) {
    console.log(`Round ${round}: Rebuttals`);

    // Affirmative Rebuttal
    onProgress?.(`Round ${round}: Affirmative rebuttal`, {
      round,
      stage: "affirmative",
    });
    const lastNeg = messages.filter((m) => m.role === "negative").slice(-1)[0];
    let affRebuttal = "";
    msgIndex = messages.length;
    for await (const chunk of MODEL_MAP_STREAM[affirmativeModel](
      `You are debating the affirmative side of: <topic>${topic}</topic>

The negative just argued:
"${lastNeg.text}"

Write a quick rebuttal (75-100 words). Address their key point and strengthen your case.`,
    )) {
      affRebuttal += chunk;
      onProgress?.("chunk", { text: chunk, msgIndex });
    }

    messages.push({
      role: "affirmative",
      model: affirmativeModel,
      text: affRebuttal,
      round,
    });
    onProgress?.("message", messages[messages.length - 1]);

    // Check if moderator should intervene after affirmative
    const affIntervention = await checkForIntervention(
      messages[messages.length - 1],
    );
    if (affIntervention) {
      onProgress?.("Moderator intervening", { round, stage: "moderator" });
      messages.push({
        role: "moderator",
        model: "anthropic",
        text: `⚠️ MODERATOR INTERVENTION: ${affIntervention}`,
        round,
      });
      onProgress?.("message", messages[messages.length - 1]);
    }

    // Negative Rebuttal
    onProgress?.(`Round ${round}: Negative rebuttal`, {
      round,
      stage: "negative",
    });
    const lastAff = messages
      .filter((m) => m.role === "affirmative")
      .slice(-1)[0];
    let negRebuttal = "";
    msgIndex = messages.length;
    for await (const chunk of MODEL_MAP_STREAM[negativeModel](
      `You are debating the negative side of: <topic>${topic}</topic>

The affirmative just argued:
"${lastAff.text}"

Write a quick rebuttal (75-100 words). Address their key point and strengthen your case.`,
    )) {
      negRebuttal += chunk;
      onProgress?.("chunk", { text: chunk, msgIndex });
    }

    messages.push({
      role: "negative",
      model: negativeModel,
      text: negRebuttal,
      round,
    });
    onProgress?.("message", messages[messages.length - 1]);

    // Check if moderator should intervene after negative
    const negIntervention = await checkForIntervention(
      messages[messages.length - 1],
    );
    if (negIntervention) {
      onProgress?.("Moderator intervening", { round, stage: "moderator" });
      messages.push({
        role: "moderator",
        model: "anthropic",
        text: `⚠️ MODERATOR INTERVENTION: ${negIntervention}`,
        round,
      });
      onProgress?.("message", messages[messages.length - 1]);
    }
  }

  console.log("Final round: Closing statements");

  // Affirmative Closing
  onProgress?.("Closing: Affirmative final statement", { stage: "closing" });
  let affClosing = "";
  msgIndex = messages.length;
  for await (const chunk of MODEL_MAP_STREAM[affirmativeModel](
    `You are debating the affirmative side of: <topic>${topic}</topic>

Final statement in 75-100 words: summarize your strongest point and why you win.`,
  )) {
    affClosing += chunk;
    onProgress?.("chunk", { text: chunk, msgIndex });
  }

  messages.push({
    role: "affirmative",
    model: affirmativeModel,
    text: affClosing,
    round: rounds + 1,
  });
  onProgress?.("message", messages[messages.length - 1]);

  // Negative Closing
  onProgress?.("Closing: Negative final statement", { stage: "closing" });
  let negClosing = "";
  msgIndex = messages.length;
  for await (const chunk of MODEL_MAP_STREAM[negativeModel](
    `You are debating the negative side of: <topic>${topic}</topic>

Final statement in 75-100 words: summarize your strongest point and why you win.`,
  )) {
    negClosing += chunk;
    onProgress?.("chunk", { text: chunk, msgIndex });
  }

  messages.push({
    role: "negative",
    model: negativeModel,
    text: negClosing,
    round: rounds + 1,
  });
  onProgress?.("message", messages[messages.length - 1]);

  // Moderator Analysis (optional - skip if Anthropic API unavailable)
  try {
    onProgress?.("Moderator analyzing debate", { stage: "moderator" });
    console.log("Moderator analyzing debate");
    const fullTranscript = messages
      .map((m) => `[${m.role.toUpperCase()} - Round ${m.round}]: ${m.text}`)
      .join("\n\n");

    let moderatorSummary = "";
    msgIndex = messages.length;
    for await (const chunk of askClaudeStream(
      `You are a neutral debate moderator analyzing this debate on: <topic>${topic}</topic>

Full transcript:
${fullTranscript}

Provide a brief analysis (150-200 words):
1. Key clash points
2. Strongest arguments from each side
3. Any logical gaps
DO NOT pick a winner.`,
    )) {
      moderatorSummary += chunk;
      onProgress?.("chunk", { text: chunk, msgIndex });
    }

    messages.push({
      role: "moderator",
      model: "anthropic",
      text: moderatorSummary,
      round: rounds + 1,
    });
    onProgress?.("message", messages[messages.length - 1]);
  } catch (error) {
    console.error("Moderator analysis failed (skipping):", error);
    onProgress?.("Moderator unavailable - proceeding to judging", {
      stage: "moderator",
    });
    // Continue without moderator analysis
  }

  // Judging
  onProgress?.("Judges deliberating", { stage: "judging" });
  console.log("Judges deliberating");
  const affText = messages
    .filter((m) => m.role === "affirmative")
    .map((m) => m.text)
    .join("\n\n");
  const negText = messages
    .filter((m) => m.role === "negative")
    .map((m) => m.text)
    .join("\n\n");

  const verdicts = await runJudges({
    topic,
    affirmativeText: affText,
    negativeText: negText,
  });

  return {
    topic,
    affirmativeModel,
    negativeModel,
    messages,
    verdicts,
  };
}
