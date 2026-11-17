CREATE TABLE "reader"."RegistrationInvite" (
  "id" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "issuerId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "RegistrationInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegistrationInvite_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "reader"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RegistrationInvite_tokenHash_key" ON "reader"."RegistrationInvite"("tokenHash");
CREATE INDEX "RegistrationInvite_issuerId_createdAt_idx" ON "reader"."RegistrationInvite"("issuerId", "createdAt");
CREATE INDEX "RegistrationInvite_email_idx" ON "reader"."RegistrationInvite"("email");
