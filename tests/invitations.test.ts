import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { compare } from "bcryptjs";
import {
  createInvitation,
  invitationHash,
  invitationIsActive,
  invitationEmailSchema,
} from "../src/modules/auth/invitations";
import {
  registerAccount,
  RegistrationError,
} from "../src/modules/auth/register-account";

test("invites are random, hashed, normalized and expire in exactly 48 hours", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  const a = createInvitation(now),
    b = createInvitation(now);
  assert.match(a.token, /^[a-f0-9]{64}$/);
  assert.notEqual(a.token, b.token);
  assert.equal(a.tokenHash, invitationHash(a.token));
  assert.notEqual(a.token, a.tokenHash);
  assert.equal(a.expiresAt.getTime() - now.getTime(), 48 * 60 * 60 * 1000);
  assert.equal(
    invitationEmailSchema.parse("  Person@Example.com "),
    "person@example.com",
  );
  const invite = { expiresAt: a.expiresAt, usedAt: null, revokedAt: null };
  assert.equal(invitationIsActive(invite, now), true);
  assert.equal(invitationIsActive(invite, a.expiresAt), false);
  assert.equal(invitationIsActive({ ...invite, usedAt: now }, now), false);
  assert.equal(invitationIsActive({ ...invite, revokedAt: now }, now), false);
  assert.equal(invitationIsActive(null, now), false);
});

function fixture(t: TestContext) {
  const db = {
    installation: { findUnique: async () => null, create: async () => ({}) },
    registrationInvite: {
      findUnique: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
    user: { findUnique: async () => null, create: async () => ({}) },
    $executeRaw: async () => 0,
    $transaction: async () => {},
    $disconnect: async () => {},
  } as unknown as PrismaClient;
  const secret = createInvitation();
  const invite = {
    id: crypto.randomUUID(),
    tokenHash: secret.tokenHash,
    email: "person@example.com",
    issuerId: crypto.randomUUID(),
    createdAt: new Date(),
    expiresAt: secret.expiresAt,
    usedAt: null as Date | null,
    revokedAt: null as Date | null,
  };
  let consumed = 0;
  const users: { email: string; passwordHash: string }[] = [];
  t.mock.method(db.installation, "findUnique", async () => ({
    id: "owner",
    ownerId: invite.issuerId,
    createdAt: new Date(),
  }));
  t.mock.method(db.registrationInvite, "findUnique", async () => invite);
  t.mock.method(db, "$executeRaw", async () => 0);
  t.mock.method(db.user, "findUnique", async () => null);
  t.mock.method(db.user, "create", async (args: any) => {
    users.push(args.data);
    return { ...args.data, id: crypto.randomUUID() };
  });
  t.mock.method(db.registrationInvite, "updateMany", async (args: any) => {
    assert.equal(args.where.email, invite.email);
    assert.equal(args.where.tokenHash, invite.tokenHash);
    const valid =
      invitationIsActive(invite) && args.where.email === invite.email;
    if (valid) {
      invite.usedAt = new Date();
      consumed++;
    }
    return { count: valid ? 1 : 0 };
  });
  let queue = Promise.resolve();
  t.mock.method(db, "$transaction", (callback: any) => {
    const next = queue.then(() => callback(db));
    queue = next.catch(() => {});
    return next;
  });
  t.after(() => db.$disconnect());
  return {
    db,
    invite,
    secret,
    users,
    get consumed() {
      return consumed;
    },
  };
}
const input = {
  name: "Pessoa",
  email: "person@example.com",
  password: "safe-password-123",
};

test("closed registration rejects signup without invitation", async (t) => {
  const f = fixture(t);
  await assert.rejects(registerAccount(input, f.db), RegistrationError);
  assert.equal(f.users.length, 0);
});
for (const mode of ["wrong-email", "revoked", "expired", "used"]) {
  test(`registration rejects ${mode} invitations`, async (t) => {
    const f = fixture(t);
    if (mode === "revoked") f.invite.revokedAt = new Date();
    if (mode === "expired") f.invite.expiresAt = new Date(0);
    if (mode === "used") f.invite.usedAt = new Date();
    await assert.rejects(
      registerAccount(
        {
          ...input,
          email: mode === "wrong-email" ? "other@example.com" : input.email,
          inviteToken: f.secret.token,
        },
        f.db,
      ),
      RegistrationError,
    );
    assert.equal(f.users.length, 0);
    assert.equal(f.consumed, 0);
  });
}
test("invited registration creates a private account with a hashed password and consumes once", async (t) => {
  const f = fixture(t);
  await registerAccount({ ...input, inviteToken: f.secret.token }, f.db);
  assert.equal(f.users.length, 1);
  assert.equal(f.users[0].email, input.email);
  assert.equal(await compare(input.password, f.users[0].passwordHash), true);
  assert.equal(f.consumed, 1);
  await assert.rejects(
    registerAccount({ ...input, inviteToken: f.secret.token }, f.db),
    RegistrationError,
  );
  assert.equal(f.users.length, 1);
});
test("transaction rechecks revocation after the initial validation", async (t) => {
  const f = fixture(t);
  t.mock.method(f.db, "$transaction", async (callback: any) => {
    f.invite.revokedAt = new Date();
    return callback(f.db);
  });
  await assert.rejects(
    registerAccount({ ...input, inviteToken: f.secret.token }, f.db),
    RegistrationError,
  );
  assert.equal(f.users.length, 0);
});

test("two submissions can only consume one invitation", async (t) => {
  const f = fixture(t);
  const results = await Promise.allSettled([
    registerAccount({ ...input, inviteToken: f.secret.token }, f.db),
    registerAccount({ ...input, inviteToken: f.secret.token }, f.db),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(f.users.length, 1);
  assert.equal(f.consumed, 1);
});
test("bootstrap rechecks installation inside the transaction", async (t) => {
  const f = fixture(t);
  let checks = 0;
  t.mock.method(f.db.installation, "findUnique", async () =>
    ++checks === 1
      ? null
      : { id: "owner", ownerId: f.invite.issuerId, createdAt: new Date() },
  );
  await assert.rejects(registerAccount(input, f.db), RegistrationError);
  assert.equal(f.users.length, 0);
});
