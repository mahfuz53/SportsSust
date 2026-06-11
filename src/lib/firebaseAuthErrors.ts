import { FirebaseError } from 'firebase/app';

export function getFirebaseErrorMessage(error: unknown): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
  const code = error instanceof FirebaseError ? error.code : undefined;

  switch (code) {
    case 'auth/unauthorized-domain':
      return `Sign-in is blocked for "${hostname}". In Firebase Console → Authentication → Settings → Authorized domains, add "${hostname}". For local development, use http://localhost:3000 (not 127.0.0.1).`;
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked by your browser. Allow popups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Network error during sign-in. Check your connection and try again.';
    case 'permission-denied':
      return 'Access denied. Please sign in again with Google and retry.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Google sign-in failed. Please try again.';
  }
}

/** @deprecated Use getFirebaseErrorMessage */
export const getFirebaseAuthErrorMessage = getFirebaseErrorMessage;

export function isLikelyUnauthorizedHost(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname } = window.location;
  if (hostname === 'localhost') return false;
  if (hostname.endsWith('.firebaseapp.com') || hostname.endsWith('.web.app')) return false;
  return true;
}
