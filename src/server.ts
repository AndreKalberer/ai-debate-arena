import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { runDebateWithModelsV2 } from "./lib/debate/debate-controller-v2.js";
import { runDiscussion } from "./lib/debate/discussion-controller.js";

const app = express();
const PORT = process.env.PORT || 5050;

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:5050"
).split(",").map((o) => o.trim());

const VALID_MODELS = ["openai", "anthropic", "gemini"] as const;
type ModelKey = (typeof VALID_MODELS)[number];

function isValidModel(m: unknown): m is ModelKey {
  return VALID_MODELS.includes(m as ModelKey);
}

function clientSafeError(error: any): string {
  const status = error?.status ?? error?.statusCode ?? error?.response?.status;
  if (status === 429) return "AI service rate limit reached, please try again later";
  if (status === 401 || status === 403) return "AI service authentication error";
  if (status === 503) return "AI service temporarily unavailable";
  return "Request failed, please try again";
}

function allowedOriginHeader(req: Request): string {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

// Security headers
app.use(helmet());

// CORS — restrict to known frontend origins
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / server-to-server requests (no origin header)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    methods: ["POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "16kb" }));

// Rate limiting — 10 debate/discussion requests per 15 minutes per IP
const debateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.post("/run-debate", debateLimiter, async (req: Request, res: Response) => {
  try {
    const { topic, affirmativeModel, negativeModel } = req.body;
    const rounds = Math.min(Math.max(parseInt(req.body.rounds) || 3, 1), 5);

    if (
      typeof topic !== "string" ||
      topic.trim().length === 0 ||
      topic.length > 500
    ) {
      return res.status(400).json({ error: "Topic must be 1–500 characters" });
    }

    if (!isValidModel(affirmativeModel) || !isValidModel(negativeModel)) {
      return res.status(400).json({ error: "Invalid model selection" });
    }

    console.log(`Starting debate — aff:${affirmativeModel} neg:${negativeModel} rounds:${rounds}`);

    const result = await runDebateWithModelsV2(
      topic.trim(),
      affirmativeModel,
      negativeModel,
      rounds,
    );

    res.json(result);
  } catch (error: any) {
    console.error("Debate error:", error);
    res.status(500).json({ error: clientSafeError(error) });
  }
});

app.post("/run-debate-stream", debateLimiter, async (req: Request, res: Response) => {
  try {
    const { topic, affirmativeModel, negativeModel } = req.body;
    const rounds = Math.min(Math.max(parseInt(req.body.rounds) || 3, 1), 5);

    if (
      typeof topic !== "string" ||
      topic.trim().length === 0 ||
      topic.length > 500
    ) {
      return res.status(400).json({ error: "Topic must be 1–500 characters" });
    }

    if (!isValidModel(affirmativeModel) || !isValidModel(negativeModel)) {
      return res.status(400).json({ error: "Invalid model selection" });
    }

    console.log(`Starting streaming debate — aff:${affirmativeModel} neg:${negativeModel} rounds:${rounds}`);

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", allowedOriginHeader(req));
    res.flushHeaders();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await runDebateWithModelsV2(
        topic.trim(),
        affirmativeModel,
        negativeModel,
        rounds,
        (status: string, data?: any) => {
          if (status === "message") {
            sendEvent("message", data);
          } else if (status === "chunk") {
            sendEvent("chunk", data);
          } else {
            sendEvent("progress", { status, ...data });
          }
        },
      );

      sendEvent("complete", result);
      res.end();
    } catch (error: any) {
      console.error("Streaming debate error:", error);
      sendEvent("error", { message: clientSafeError(error) });
      res.end();
    }
  } catch (error: any) {
    console.error("Debate setup error:", error);
    res.status(500).json({ error: clientSafeError(error) });
  }
});

app.post("/run-discussion-stream", debateLimiter, async (req: Request, res: Response) => {
  try {
    const { topic } = req.body;

    if (
      typeof topic !== "string" ||
      topic.trim().length === 0 ||
      topic.length > 500
    ) {
      return res.status(400).json({ error: "Topic must be 1–500 characters" });
    }

    console.log("Starting discussion mode");

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", allowedOriginHeader(req));
    res.flushHeaders();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await runDiscussion(
        topic.trim(),
        (status: string, data?: any) => {
          if (status === "message") {
            sendEvent("message", data);
          } else if (status === "chunk") {
            sendEvent("chunk", data);
          } else {
            sendEvent("progress", { status, ...data });
          }
        },
      );

      sendEvent("complete", result);
      res.end();
    } catch (error: any) {
      console.error("Discussion error:", error);
      sendEvent("error", { message: clientSafeError(error) });
      res.end();
    }
  } catch (error: any) {
    console.error("Discussion setup error:", error);
    res.status(500).json({ error: clientSafeError(error) });
  }
});

app.listen(PORT, () => {
  console.log("Debate API running on port " + PORT);
});
