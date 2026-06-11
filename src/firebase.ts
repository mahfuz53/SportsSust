import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

const databaseId = firebaseConfig.firestoreDatabaseId || undefined;
export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

const authEmulatorUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL as string | undefined;
if (import.meta.env.DEV && authEmulatorUrl) {
  connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
}

const firestoreEmulatorHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST as string | undefined;
if (import.meta.env.DEV && firestoreEmulatorHost) {
  const [host, portStr] = firestoreEmulatorHost.split(':');
  connectFirestoreEmulator(db, host, Number(portStr) || 8080);
}
