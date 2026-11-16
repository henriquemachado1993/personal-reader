import { randomUUID } from "node:crypto";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function config(phase: string): NextConfig {
  return {
    serverExternalPackages: ["@prisma/client"],
    env: {
      NEXT_PUBLIC_CACHE_VERSION:
        phase === PHASE_DEVELOPMENT_SERVER ? "development" : randomUUID(),
    },
  };
}
