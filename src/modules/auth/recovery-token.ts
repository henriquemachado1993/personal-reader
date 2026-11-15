import { randomBytes, createHash } from "node:crypto";
export const resetTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function createRecoveryToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: resetTokenHash(token),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  };
}
export function sessionPredatesPasswordChange(
  issuedAt: number | undefined,
  changedAt: Date | null,
) {
  return !!changedAt && (!issuedAt || issuedAt * 1000 <= changedAt.getTime());
}
