import type { User as FirebaseUser } from 'firebase/auth';

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

export async function fetchUserProfile(user: FirebaseUser): Promise<UserProfileResponse | null> {
  const res = await fetch('/api/user/profile', {
    headers: await authHeaders(user),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load profile.');
  }

  return res.json();
}

export async function saveUserProfile(
  user: FirebaseUser,
  opts?: { isSubscriber?: boolean }
): Promise<UserProfileResponse> {
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

  const data = await res.json().catch(() => ({}));
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
