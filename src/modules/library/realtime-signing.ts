import { importJWK, type JWK } from "jose";

export async function importRealtimeSigningKey(json: string) {
  const { kty, crv, kid, d, x, y }: JWK = JSON.parse(json);
  if (kty !== "EC" || crv !== "P-256" || !kid || !d || !x || !y)
    throw new Error(
      "A chave privada do Realtime deve ser ES256 e incluir kid.",
    );
  // Supabase exports key_ops that can include verify, which WebCrypto rejects for private keys.
  return { kid, key: await importJWK({ kty, crv, d, x, y }, "ES256") };
}
