import { GoogleGenAI } from "@google/genai";

export type GeminiSource = "gemini" | "mock";

export interface GeminiAnalysisResult {
  analysis: string;
  source: GeminiSource;
  error?: string;
}

export interface GeminiLiveUpdateResult {
  update: string;
  urls: string[];
  source: GeminiSource;
  error?: string;
}

export interface GeminiMatchResult {
  scoreA: number;
  scoreB: number;
  source: GeminiSource;
  error?: string;
}

function normalizeApiKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key || key === "MY_GEMINI_API_KEY" || key.length < 10) return null;
  return key;
}

export function getGeminiApiKey(): string | null {
  return normalizeApiKey(process.env.GEMINI_API_KEY) ?? normalizeApiKey(process.env.GOOGLE_API_KEY);
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey() !== null;
}

export function logGeminiStartupStatus(): void {
  const key = getGeminiApiKey();
  if (key) {
    const masked = `${key.slice(0, 6)}...${key.slice(-4)}`;
    console.log(`[Gemini] API key loaded (${masked}). Real API calls enabled.`);
  } else {
    console.warn("[Gemini] No valid API key found. Mock responses will be used.");
  }
}

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

function formatGeminiError(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown Gemini API error";
  try {
    const parsed = JSON.parse(err.message);
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // not JSON — use raw message
  }
  return err.message;
}

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

async function generateWithModelFallback(
  label: string,
  buildRequest: (model: string) => Parameters<ReturnType<typeof getClient>["models"]["generateContent"]>[0]
): Promise<{ text: string; urls: string[]; model: string }> {
  const ai = getClient();
  let lastError: unknown;

  for (const model of MODELS) {
    try {
      console.log(`[Gemini] ${label}: sending request to ${model}`);
      const response = await ai.models.generateContent(buildRequest(model));

      const text = response.text?.trim();
      if (!text) {
        throw new Error("Empty response from Gemini API");
      }

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const urls: string[] = chunks
        ? chunks.map((c: { web?: { uri?: string } }) => c.web?.uri).filter((uri): uri is string => Boolean(uri))
        : [];

      console.log(`[Gemini] ${label}: success via ${model} (${text.length} chars)`);
      return { text, urls, model };
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini] ${label}: ${model} failed —`, formatGeminiError(err));
    }
  }

  throw lastError ?? new Error("All Gemini models failed");
}

export async function generateMatchAnalysis(
  prompt: string,
  mockFallback: string
): Promise<GeminiAnalysisResult> {
  if (!isGeminiConfigured()) {
    console.log("[Gemini] analysis: using mock (no API key)");
    return { analysis: mockFallback, source: "mock", error: "API key not configured" };
  }

  try {
    const { text } = await generateWithModelFallback("analysis", (model) => ({
      model,
      contents: prompt,
    }));
    return { analysis: text, source: "gemini" };
  } catch (err) {
    const message = formatGeminiError(err);
    console.error("[Gemini] analysis: all models failed —", message);
    return { analysis: mockFallback, source: "mock", error: message };
  }
}

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export async function fetchMatchResult(
  teamA: string,
  teamB: string,
  date: string,
  round: string
): Promise<GeminiMatchResult> {
  if (!isGeminiConfigured()) {
    return { scoreA: 0, scoreB: 0, source: "mock", error: "API key not configured" };
  }

  const prompt = `Search for the FIFA World Cup 2026 match result: ${teamA} vs ${teamB} on ${date} (${round}).
Respond ONLY with valid JSON, no markdown:
{"scoreA": <${teamA} goals as integer>, "scoreB": <${teamB} goals as integer>}
If the match has not been played or the result is unknown, respond: {"error": "not played"}`;

  try {
    const { text } = await generateWithModelFallback("match-result", (model) => ({
      model,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    }));

    const parsed = parseJsonFromText(text);
    if (!parsed || parsed.error) {
      return {
        scoreA: 0,
        scoreB: 0,
        source: "mock",
        error: String(parsed?.error ?? "Result not available"),
      };
    }

    const scoreA = Number(parsed.scoreA);
    const scoreB = Number(parsed.scoreB);
    if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) {
      throw new Error("Invalid score format from Gemini");
    }

    console.log(`[Gemini] match-result: ${teamA} ${scoreA}-${scoreB} ${teamB}`);
    return { scoreA, scoreB, source: "gemini" };
  } catch (err) {
    const message = formatGeminiError(err);
    console.error("[Gemini] match-result failed —", message);
    return { scoreA: 0, scoreB: 0, source: "mock", error: message };
  }
}

export async function fetchLiveUpdates(mockFallback: string): Promise<GeminiLiveUpdateResult> {
  if (!isGeminiConfigured()) {
    console.log("[Gemini] live-updates: using mock (no API key)");
    return {
      update: mockFallback,
      urls: [],
      source: "mock",
      error: "API key not configured",
    };
  }

  const prompt =
    "Search for the latest real-time match results and group standings for the upcoming FIFA 2026 World Cup. If no matches have been played yet, provide the latest news or schedule updates.";

  try {
    const { text, urls } = await generateWithModelFallback("live-updates", (model) => ({
      model,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    }));
    return { update: text, urls, source: "gemini" };
  } catch (err) {
    const message = formatGeminiError(err);
    console.error("[Gemini] live-updates: all models failed —", message);
    return { update: mockFallback, urls: [], source: "mock", error: message };
  }
}
