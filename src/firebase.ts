import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

const authEmulatorUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL as string | undefined;
if (import.meta.env.DEV && authEmulatorUrl) {
  connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
}
