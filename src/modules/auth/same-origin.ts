export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const expected = new URL(request.url);
  expected.host = request.headers.get("host") ?? expected.host;
  return origin === expected.origin;
}
