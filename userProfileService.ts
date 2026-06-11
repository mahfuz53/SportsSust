import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILES_FILE = path.join(DATA_DIR, "user-profiles.json");

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isSubscriber: boolean;
  createdAt: number;
  updatedAt: number;
};

type ProfileStore = Record<string, UserProfile>;

function loadStore(): ProfileStore {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      return JSON.parse(fs.readFileSync(PROFILES_FILE, "utf-8")) as ProfileStore;
    }
  } catch (err) {
    console.error("[UserProfile] Failed to load profiles:", err);
  }
  return {};
}

function saveStore(store: ProfileStore): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(store, null, 2));
}

export function getUserProfile(uid: string): UserProfile | null {
  return loadStore()[uid] ?? null;
}

export function upsertUserProfile(
  uid: string,
  data: Pick<UserProfile, "email" | "displayName" | "photoURL"> & { isSubscriber?: boolean }
): UserProfile {
  const store = loadStore();
  const now = Date.now();
  const existing = store[uid];

  const profile: UserProfile = {
    uid,
    email: data.email,
    displayName: data.displayName,
    photoURL: data.photoURL,
    isSubscriber: data.isSubscriber ?? existing?.isSubscriber ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  store[uid] = profile;
  saveStore(store);
  return profile;
}
