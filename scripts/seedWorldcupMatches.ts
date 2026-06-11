/**
 * Seeds Firestore collection `worldcup_matches` from data/worldcup.json.
 *
 * Firebase Console → Project settings → Service accounts → Generate new private key
 * Save as serviceAccountKey.json in project root (gitignored).
 *
 *   npm run seed:worldcup-matches
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { WORLDCUP_MATCHES_COLLECTION } from '../src/lib/worldcupMatchTransform';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID ?? firebaseConfig.firestoreDatabaseId ?? '(default)';

type WorldcupMatch = {
  matchId: string;
  round: string;
  num?: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  team1Score: number | null;
  team2Score: number | null;
  winner: string | null;
  group?: string;
  ground?: string;
};

function toFirestoreDoc(match: WorldcupMatch): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    matchId: match.matchId,
    round: match.round,
    date: match.date,
    time: match.time,
    team1: match.team1,
    team2: match.team2,
    team1Score: match.team1Score,
    team2Score: match.team2Score,
    winner: match.winner,
  };
  if (match.num !== undefined) doc.num = match.num;
  if (match.group) doc.group = match.group;
  if (match.ground) doc.ground = match.ground;
  return doc;
}

async function main(): Promise<void> {
  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ?? path.join(ROOT, 'serviceAccountKey.json');

  if (!fs.existsSync(credentialsPath)) {
    console.error(
      'Missing service account key.\n' +
        'Firebase Console → Project settings → Service accounts → Generate new private key\n' +
        `Save as: ${credentialsPath}`
    );
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }

  const app = getApps()[0];
  const db =
    DATABASE_ID === '(default)' ? getFirestore(app) : getFirestore(app, DATABASE_ID);

  const worldcup = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data/worldcup.json'), 'utf-8')
  ) as { matches: WorldcupMatch[] };

  const batch = db.batch();
  for (const match of worldcup.matches) {
    if (!match.matchId) {
      throw new Error(`Match missing matchId: ${JSON.stringify(match)}`);
    }
    batch.set(db.collection(WORLDCUP_MATCHES_COLLECTION).doc(match.matchId), toFirestoreDoc(match));
  }

  await batch.commit();
  console.log(
    `[Seed] Wrote ${worldcup.matches.length} documents to ${WORLDCUP_MATCHES_COLLECTION} (database: ${DATABASE_ID})`
  );
}

main().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
