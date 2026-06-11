import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../firebase';
import type { UserProfileResponse } from './userProfileApi';

const USERS_COLLECTION = 'users';

function userDocRef(uid: string) {
  return doc(db, USERS_COLLECTION, uid);
}

export async function fetchUserProfileFromFirestore(
  user: FirebaseUser
): Promise<UserProfileResponse | null> {
  const snap = await getDoc(userDocRef(user.uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfileResponse;
}

export async function saveUserProfileToFirestore(
  user: FirebaseUser,
  opts?: { isSubscriber?: boolean }
): Promise<UserProfileResponse> {
  const ref = userDocRef(user.uid);
  const existing = await getDoc(ref);
  const now = Date.now();

  const profile: UserProfileResponse = {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? '',
    isSubscriber: opts?.isSubscriber ?? true,
    createdAt: existing.exists() ? (existing.data() as UserProfileResponse).createdAt : now,
    updatedAt: now,
  };

  await setDoc(ref, profile, { merge: true });
  return profile;
}
