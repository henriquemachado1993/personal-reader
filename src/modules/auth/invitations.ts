import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
export const invitationTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const invitationEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());
export const invitationHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function createInvitation(now = new Date()) {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: invitationHash(token),
    expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
  };
}
export function invitationIsActive(
  invite: {
    expiresAt: Date;
    usedAt: Date | null;
    revokedAt: Date | null;
  } | null,
  now = new Date(),
) {
  return (
    !!invite && !invite.usedAt && !invite.revokedAt && invite.expiresAt > now
  );
}
