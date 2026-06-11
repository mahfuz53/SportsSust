import fs from 'fs';
import path from 'path';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { scorePredictionsForMatch } from './predictionScoringService';
import {
  WORLDCUP_MATCHES_COLLECTION,
  type WorldcupFirestoreMatch,
} from './src/lib/worldcupMatchTransform';

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID ?? firebaseConfig.firestoreDatabaseId ?? '(default)';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

function loadServiceAccount(): Record<string, unknown> | null {
  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ??
    path.join(process.cwd(), 'serviceAccountKey.json');

  if (fs.existsSync(credentialsPath)) {
    return JSON.parse(fs.readFileSync(credentialsPath, 'utf-8')) as Record<string, unknown>;
  }

  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    return JSON.parse(inline) as Record<string, unknown>;
  }

  return null;
}

export function getAdminFirestore(): Firestore {
  if (adminDb) return adminDb;

  if (!getApps().length) {
    const serviceAccount = loadServiceAccount();
    if (serviceAccount) {
      adminApp = initializeApp({
        credential: cert(serviceAccount as Parameters<typeof cert>[0]),
        projectId: PROJECT_ID,
      });
    } else {
      adminApp = initializeApp({ projectId: PROJECT_ID });
    }
  }

  const app = adminApp ?? getApps()[0];
  adminDb =
    DATABASE_ID === '(default)' ? getFirestore(app) : getFirestore(app, DATABASE_ID);
  return adminDb;
}

export async function fetchAllWorldcupMatches(): Promise<WorldcupFirestoreMatch[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(WORLDCUP_MATCHES_COLLECTION)
    .orderBy('date', 'asc')
    .orderBy('time', 'asc')
    .get();

  return snapshot.docs.map((doc) => doc.data() as WorldcupFirestoreMatch);
}

export async function updateWorldcupMatchResult(
  matchId: string,
  team1Score: number,
  team2Score: number,
  winner: string | null
): Promise<void> {
  const db = getAdminFirestore();
  await db.collection(WORLDCUP_MATCHES_COLLECTION).doc(matchId).update({
    team1Score,
    team2Score,
    winner,
  });

  await scorePredictionsForMatch(matchId);
}
