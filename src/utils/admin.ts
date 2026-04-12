import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export type UserRole = "admin" | "driver";

export const ADMIN_EMAILS = [
  "agduwaadmin@gmail.com",
  "agduwaadmin1@gmail.com",
  "agduwaadmin2@gmail.com",
  "agduwaadmin3@gmail.com",
].map((email) => email.trim().toLowerCase());

export const isAdminEmail = (email?: string | null) => {
  if (!email) {
    return false;
  }
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
};

interface EnsureUserRoleParams {
  uid: string;
  email?: string | null;
}

export const ensureUserRoleDocument = async ({ uid, email }: EnsureUserRoleParams) => {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (!uid || !normalizedEmail) {
    return;
  }

  const role: UserRole = isAdminEmail(normalizedEmail) ? "admin" : "driver";
  const userRef = doc(db, "users", uid);
  const existingSnap = await getDoc(userRef);
  const existingData = existingSnap.exists() ? existingSnap.data() : null;

  // Skip writes when role data already matches to avoid duplicate updates.
  if (
    existingData &&
    existingData.email === normalizedEmail &&
    existingData.role === role &&
    existingData.isAdmin === (role === "admin")
  ) {
    return;
  }

  await setDoc(
    userRef,
    {
      uid,
      email: normalizedEmail,
      role,
      isAdmin: role === "admin",
      updatedAt: serverTimestamp(),
      ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );
};
