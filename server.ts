import dotenv from "dotenv";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { generateMatchAnalysis, fetchLiveUpdates, fetchMatchResult, logGeminiStartupStatus } from "./geminiService";
import { applyMatchStatus } from "./matchStatus";
import { getBearerToken, verifyIdToken } from "./firebaseAuthService";
import {
  getWorldCupData,
  getTeamName,
  initWorldCupData,
  refreshWorldCupData,
  updateMatchResult,
} from "./worldCupService";
import { getUserProfile, upsertUserProfile } from "./userProfileService";
import type { MatchData } from "./src/types";

dotenv.config({ path: ".env.local" });
dotenv.config();

logGeminiStartupStatus();
initWorldCupData();

const app = express();
const PORT = 3000;

// Firebase Auth allows "localhost" by default, not "127.0.0.1".
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const host = req.headers.host ?? "";
    if (host.startsWith("127.0.0.1:")) {
      return res.redirect(301, `http://localhost:${PORT}${req.originalUrl}`);
    }
    next();
  });
}

app.use(express.json());

const users = [
  { id: "AUTOCON-1001", name: "Arif Hossain", score: 120, matchesPredicted: 14, avatar: "https://i.pravatar.cc/150?u=arif" },
  { id: "AUTOCON-1002", name: "Sania Mirza", score: 110, matchesPredicted: 12, avatar: "https://i.pravatar.cc/150?u=sania" },
  { id: "AUTOCON-1003", name: "Rakib Hasan", score: 85, matchesPredicted: 10, avatar: "https://i.pravatar.cc/150?u=rakib" },
];

const analysisCache = new Map<string, { preMatchAnalysis?: string | null; postMatchAnalysis?: string | null }>();
let predictions: { userId: string; matchId: string; choice: string; processed: boolean }[] = [];

function loadMatchesWithAnalysis(): MatchData[] {
  const { matches } = getWorldCupData();
  return matches.map((match) => {
    const cached = analysisCache.get(match.id);
    return applyMatchStatus({
      ...match,
      preMatchAnalysis: cached?.preMatchAnalysis ?? match.preMatchAnalysis,
      postMatchAnalysis: cached?.postMatchAnalysis ?? match.postMatchAnalysis,
    });
  });
}

app.get("/api/user/profile", async (req, res) => {
  const idToken = getBearerToken(req.headers.authorization);
  if (!idToken) {
    return res.status(401).json({ error: "Missing authorization token." });
  }

  const verified = await verifyIdToken(idToken);
  if (!verified) {
    return res.status(401).json({ error: "Invalid or expired sign-in token." });
  }

  const profile = getUserProfile(verified.uid);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found." });
  }

  res.json(profile);
});

app.post("/api/user/profile", async (req, res) => {
  const idToken = getBearerToken(req.headers.authorization);
  if (!idToken) {
    return res.status(401).json({ error: "Missing authorization token." });
  }

  const verified = await verifyIdToken(idToken);
  if (!verified) {
    return res.status(401).json({ error: "Invalid or expired sign-in token." });
  }

  const { email, displayName, photoURL, isSubscriber } = req.body ?? {};
  const profile = upsertUserProfile(verified.uid, {
    email: typeof email === "string" ? email : verified.email,
    displayName: typeof displayName === "string" ? displayName : verified.displayName,
    photoURL: typeof photoURL === "string" ? photoURL : verified.photoURL,
    isSubscriber: typeof isSubscriber === "boolean" ? isSubscriber : true,
  });

  res.json(profile);
});

app.get("/api/leaderboard", (_req, res) => {
  const sorted = [...users].sort((a, b) => b.score - a.score);
  res.json(sorted);
});

app.get("/api/matches", (_req, res) => {
  try {
    res.json(loadMatchesWithAnalysis());
  } catch (err) {
    console.error("[WorldCup] /api/matches error:", err);
    res.status(503).json({ error: "Failed to load matches." });
  }
});

app.get("/api/teams", (_req, res) => {
  try {
    const { teams } = getWorldCupData();
    res.json(teams);
  } catch (err) {
    console.error("[WorldCup] /api/teams error:", err);
    res.status(503).json({ error: "Failed to load teams." });
  }
});

app.get("/api/standings", (_req, res) => {
  try {
    const { standings } = getWorldCupData();
    res.json(standings);
  } catch (err) {
    console.error("[WorldCup] /api/standings error:", err);
    res.status(503).json({ error: "Failed to load standings." });
  }
});

app.get("/api/groups", (_req, res) => {
  try {
    const { groups } = getWorldCupData();
    res.json(groups);
  } catch (err) {
    console.error("[WorldCup] /api/groups error:", err);
    res.status(503).json({ error: "Failed to load groups." });
  }
});

app.post("/api/refresh", (_req, res) => {
  try {
    refreshWorldCupData();
    res.json({ success: true });
  } catch (err) {
    console.error("[WorldCup] refresh error:", err);
    res.status(500).json({ error: "Failed to refresh data." });
  }
});

app.post("/api/predict", (req, res) => {
  const { userId, matchId, choice } = req.body;

  const matches = loadMatchesWithAnalysis();
  const match = matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const now = Date.now();
  if (match.status !== "upcoming") {
    return res.status(403).json({ error: "Predictions are closed for this match." });
  }

  const matchTime = new Date(match.time).getTime();
  if (matchTime - now < 30 * 60 * 1000 && matchTime > now) {
    return res.status(403).json({ error: "Predictions close 30 minutes before match." });
  }

  const existingIndex = predictions.findIndex((p) => p.userId === userId && p.matchId === matchId);
  if (existingIndex > -1) {
    predictions[existingIndex].choice = choice;
  } else {
    predictions.push({ userId, matchId, choice, processed: false });
  }

  res.json({ success: true, message: "Prediction saved." });
});

app.post("/api/gemini/match-result", async (req, res) => {
  const { matchId } = req.body;
  const { teams } = getWorldCupData();
  const matches = loadMatchesWithAnalysis();
  const match = matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const teamAName = getTeamName(teams, match.teamA, match.teamAName);
  const teamBName = getTeamName(teams, match.teamB, match.teamBName);
  const date = match.time.split("T")[0];

  const result = await fetchMatchResult(teamAName, teamBName, date, match.round ?? match.group);

  if (result.source !== "gemini" || result.error) {
    return res.status(502).json({
      error: result.error ?? "Could not fetch match result from Gemini.",
      source: result.source,
    });
  }

  const updated = updateMatchResult(matchId, result.scoreA, result.scoreB, "gemini");
  const { standings } = getWorldCupData();

  res.json({
    match: updated,
    standings,
    source: "gemini",
    scoreA: result.scoreA,
    scoreB: result.scoreB,
  });
});

app.post("/api/gemini/analysis", async (req, res) => {
  const { matchId, type } = req.body;
  const { teams } = getWorldCupData();
  const matches = loadMatchesWithAnalysis();
  const match = matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: "Match not found" });

  const teamAName = getTeamName(teams, match.teamA, match.teamAName);
  const teamBName = getTeamName(teams, match.teamB, match.teamBName);

  const prompt = type === "pre"
    ? `Provide a short, tactical pre-match analysis (formation, history) for a football match between ${teamAName} and ${teamBName}. Write in English but with a storytelling approach. Max 100 words.`
    : `Provide a detailed post-match analysis for ${teamAName} vs ${teamBName}. Score was ${match.scoreA}-${match.scoreB}. Mention possession, fouls, and story. Write in English. Max 150 words.`;

  const mockFallback = `[Demo] ${type === "pre" ? "Pre-match" : "Post-match"} analysis for ${teamAName} vs ${teamBName} is unavailable. Please check your API key or try again later.`;

  const result = await generateMatchAnalysis(prompt, mockFallback);

  const cached = analysisCache.get(matchId) ?? {};
  if (type === "pre") {
    cached.preMatchAnalysis = result.analysis;
  } else {
    cached.postMatchAnalysis = result.analysis;
  }
  analysisCache.set(matchId, cached);

  res.json(result);
});

app.post("/api/gemini/live-updates", async (_req, res) => {
  const mockFallback =
    "Demo update: No live data available. Configure a valid Gemini API key to fetch real-time World Cup news and results.";

  const result = await fetchLiveUpdates(mockFallback);
  res.json(result);
});

async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
