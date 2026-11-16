export function replicaResponse(replica: unknown, status = 200) {
  // Streaming keeps large libraries below Vercel's buffered response limit.
  return new Response(new Blob([JSON.stringify(replica)]).stream(), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}
