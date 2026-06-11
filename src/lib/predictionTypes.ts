export type PredictionChoice = 'team1' | 'team2' | 'draw';

export type MatchPrediction = {
  userId: string;
  matchId: string;
  choice: PredictionChoice;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: number;
  updatedAt: number;
  processed: boolean;
  pointsAwarded: number | null;
};

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string;
  score: number;
  matchesPredicted: number;
  updatedAt: number;
};

export const LEADERBOARD_COLLECTION = 'leaderboard';
export const PREDICTIONS_SUBCOLLECTION = 'predictions';

export const PREDICTION_POINTS_CORRECT = 10;
export const PREDICTION_POINTS_WRONG = -5;
