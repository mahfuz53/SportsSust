import { isAdminEmail } from "./src/lib/admin";
import { getBearerToken, verifyIdToken } from "./firebaseAuthService";

type AdminAuthResult =
  | { ok: true; email: string }
  | { ok: false; status: number; error: string };

export async function verifyAdminRequest(
  authHeader: string | undefined
): Promise<AdminAuthResult> {
  const idToken = getBearerToken(authHeader);
  if (!idToken) {
    return { ok: false, status: 401, error: "Missing authorization token." };
  }

  const verified = await verifyIdToken(idToken);
  if (!verified) {
    return { ok: false, status: 401, error: "Invalid or expired sign-in token." };
  }

  if (!isAdminEmail(verified.email)) {
    return { ok: false, status: 403, error: "Admin access only." };
  }

  return { ok: true, email: verified.email };
}
