ALTER TABLE "reader"."User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
CREATE TABLE "reader"."PasswordReset" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "reader"."User"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PasswordReset_userId_idx" ON "reader"."PasswordReset"("userId");
