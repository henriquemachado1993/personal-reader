import assert from "node:assert/strict";
import { test } from "node:test";
import { exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { importRealtimeSigningKey } from "../src/modules/library/realtime-signing";

test("imports a private Supabase JWK with both signing and verification operations", async () => {
  const pair = await generateKeyPair("ES256", { extractable: true });
  const jwk = await exportJWK(pair.privateKey);
  const { key, kid } = await importRealtimeSigningKey(
    JSON.stringify({
      ...jwk,
      kid: "supabase-key",
      key_ops: ["sign", "verify"],
    }),
  );
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid })
    .sign(key);
  assert.equal(
    (await jwtVerify(token, pair.publicKey)).protectedHeader.kid,
    "supabase-key",
  );
});
