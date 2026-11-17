import { test } from "node:test";
import assert from "node:assert/strict";
import {
  invitationStatus,
  type Invitation,
} from "../src/modules/settings/invitation-status";
const now = Date.parse("2026-11-17T12:00:00Z");
const pending: Invitation = {
  id: "invite",
  email: "reader@example.test",
  expiresAt: "2026-11-19T12:00:00Z",
  usedAt: null,
  revokedAt: null,
};
test("invitation statuses distinguish active, expired, revoked and used links", () => {
  assert.equal(invitationStatus(pending, now), "Pendente");
  assert.equal(
    invitationStatus({ ...pending, expiresAt: "2026-11-17T12:00:00Z" }, now),
    "Expirado",
  );
  assert.equal(
    invitationStatus({ ...pending, revokedAt: "2026-11-17T10:00:00Z" }, now),
    "Revogado",
  );
  assert.equal(
    invitationStatus(
      {
        ...pending,
        usedAt: "2026-11-17T10:00:00Z",
        expiresAt: "2026-11-16T12:00:00Z",
      },
      now,
    ),
    "Utilizado",
  );
  assert.equal(
    invitationStatus(
      {
        ...pending,
        usedAt: "2026-11-17T10:00:00Z",
        revokedAt: "2026-11-17T11:00:00Z",
      },
      now,
    ),
    "Utilizado",
  );
});
