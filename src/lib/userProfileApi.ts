import type { User as FirebaseUser } from 'firebase/auth';
import {
  fetchUserProfileFromFirestore,
  saveUserProfileToFirestore,
} from './userProfileFirestore';

export type SignInLogPayload = {
  status: 'success';
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isSubscriber: boolean;
  providerId: string;
  createdAt: number;
  updatedAt: number;
};

export type UserProfileResponse = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isSubscriber: boolean;
  createdAt: number;
  updatedAt: number;
};

async function authHeaders(user: FirebaseUser): Promise<HeadersInit> {
  const idToken = await user.getIdToken(true);
  return {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? 'Invalid response from server.'
        : `Server error (${res.status}). Ensure the Node API is running or use Firestore.`
    );
  }
}

/** Prefer Firestore (works on static hosting); fall back to API when available. */
export async function fetchUserProfile(user: FirebaseUser): Promise<UserProfileResponse | null> {
  try {
    return await fetchUserProfileFromFirestore(user);
  } catch (firestoreErr) {
    console.warn('[Profile] Firestore read failed, trying API:', firestoreErr);
  }

  const res = await fetch('/api/user/profile', {
    headers: await authHeaders(user),
  });

  if (res.status === 404) return null;
  const data = await parseJsonResponse<UserProfileResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'Failed to load profile.');
  }

  return data;
}

export async function saveUserProfile(
  user: FirebaseUser,
  opts?: { isSubscriber?: boolean }
): Promise<UserProfileResponse> {
  try {
    return await saveUserProfileToFirestore(user, opts);
  } catch (firestoreErr) {
    console.warn('[Profile] Firestore save failed, trying API:', firestoreErr);
  }

  const res = await fetch('/api/user/profile', {
    method: 'POST',
    headers: await authHeaders(user),
    body: JSON.stringify({
      email: user.email ?? '',
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? '',
      isSubscriber: opts?.isSubscriber ?? true,
    }),
  });

  const data = await parseJsonResponse<UserProfileResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save profile.');
  }

  return data;
}

export function logSignInSuccess(user: FirebaseUser, profile: UserProfileResponse): void {
  const payload: SignInLogPayload = {
    status: 'success',
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
    isSubscriber: profile.isSubscriber,
    providerId: user.providerData[0]?.providerId ?? 'google.com',
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  console.log('[Auth] Google Sign-In successful', payload);
}
