import firebaseConfig from "./firebase-applet-config.json";

export type VerifiedFirebaseUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
};

export async function verifyIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey || !idToken) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[FirebaseAuth] Token lookup failed:", res.status, err);
      return null;
    }

    const data = (await res.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        displayName?: string;
        photoUrl?: string;
      }>;
    };

    const user = data.users?.[0];
    if (!user?.localId) return null;

    return {
      uid: user.localId,
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      photoURL: user.photoUrl ?? "",
    };
  } catch (err) {
    console.error("[FirebaseAuth] Token verification error:", err);
    return null;
  }
}

export function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
