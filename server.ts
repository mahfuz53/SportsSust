import dotenv from "dotenv";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { applyMatchStatus } from "./matchStatus";
import { getBearerToken, verifyIdToken } from "./firebaseAuthService";
import {
  getWorldCupData,
  initWorldCupData,
  refreshWorldCupData,
} from "./worldCupService";
import {
  getUserPredictionAdmin,
  saveUserPredictionAdmin,
  scorePredictionsForMatch,
} from "./predictionScoringService";
import { getUserProfileActivity } from "./userProfileActivityService";
import { canSubmitPrediction } from "./src/lib/predictionUtils";
import { getUserProfile, upsertUserProfile } from "./userProfileService";
import type { MatchData } from "./src/types";
import type { PredictionChoice } from "./src/lib/predictionTypes";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

let predictions: { userId: string; matchId: string; choice: string; processed: boolean }[] = [];

function loadMatches(): MatchData[] {
  const { matches } = getWorldCupData();
  return matches.map((match) => applyMatchStatus(match));
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
    res.json(loadMatches());
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

app.post("/api/refresh", async (_req, res) => {
  try {
    await refreshWorldCupData();
    res.json({ success: true });
  } catch (err) {
    console.error("[WorldCup] refresh error:", err);
    res.status(500).json({ error: "Failed to refresh data." });
  }
});

app.get("/api/profile/activity", async (req, res) => {
  const idToken = getBearerToken(req.headers.authorization);
  if (!idToken) {
    return res.status(401).json({ error: "Missing authorization token." });
  }

  const verified = await verifyIdToken(idToken);
  if (!verified) {
    return res.status(401).json({ error: "Invalid or expired sign-in token." });
  }

  try {
    const activity = await getUserProfileActivity(verified.uid);
    res.json(activity);
  } catch (err) {
    console.error("[Profile] activity error:", err);
    res.status(500).json({ error: "Failed to load profile activity." });
  }
});

app.get("/api/predictions/me", async (req, res) => {
  const idToken = getBearerToken(req.headers.authorization);
  if (!idToken) {
    return res.status(401).json({ error: "Missing authorization token." });
  }

  const verified = await verifyIdToken(idToken);
  if (!verified) {
    return res.status(401).json({ error: "Invalid or expired sign-in token." });
  }

  const matchId = typeof req.query.matchId === "string" ? req.query.matchId : "";
  if (!matchId) {
    return res.status(400).json({ error: "matchId is required." });
  }

  try {
    const prediction = await getUserPredictionAdmin(matchId, verified.uid);
    res.json({ prediction });
  } catch (err) {
    console.error("[Predictions] fetch error:", err);
    res.status(500).json({ error: "Failed to load prediction." });
  }
});

app.post("/api/predictions/submit", async (req, res) => {
  const idToken = getBearerToken(req.headers.authorization);
  if (!idToken) {
    return res.status(401).json({ error: "Missing authorization token." });
  }

  const verified = await verifyIdToken(idToken);
  if (!verified) {
    return res.status(401).json({ error: "Invalid or expired sign-in token." });
  }

  const { matchId, choice } = req.body ?? {};
  if (!matchId || typeof matchId !== "string") {
    return res.status(400).json({ error: "matchId is required." });
  }

  const validChoices: PredictionChoice[] = ["team1", "team2", "draw"];
  if (!validChoices.includes(choice)) {
    return res.status(400).json({ error: "Invalid prediction choice." });
  }

  const matches = loadMatches();
  const match = matches.find((m) => m.id === matchId);
  if (!match) {
    return res.status(404).json({ error: "Match not found." });
  }

  if (!canSubmitPrediction(match)) {
    return res.status(403).json({ error: "Predictions are closed for this match." });
  }

  try {
    const prediction = await saveUserPredictionAdmin({
      matchId,
      userId: verified.uid,
      choice,
      displayName: verified.displayName,
      email: verified.email,
      photoURL: verified.photoURL,
    });
    res.json({ success: true, prediction });
  } catch (err) {
    console.error("[Predictions] submit error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to save prediction.",
    });
  }
});

app.post("/api/match/score-predictions", async (req, res) => {
  const { matchId } = req.body ?? {};
  if (!matchId || typeof matchId !== "string") {
    return res.status(400).json({ error: "matchId is required." });
  }

  try {
    const result = await scorePredictionsForMatch(matchId);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[Predictions] score error:", err);
    res.status(500).json({ error: "Failed to score predictions." });
  }
});

async function setupVite() {
  try {
    await initWorldCupData();
  } catch (err) {
    console.error(
      "[WorldCup] Firestore init failed. Seed worldcup_matches and set GOOGLE_APPLICATION_CREDENTIALS.",
      err
    );
  }

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
