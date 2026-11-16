import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} from "next/constants";
import config from "../next.config";

test("development cache version stays stable across config evaluations", () => {
  assert.equal(
    config(PHASE_DEVELOPMENT_SERVER).env?.NEXT_PUBLIC_CACHE_VERSION,
    "development",
  );
  assert.deepEqual(
    config(PHASE_DEVELOPMENT_SERVER),
    config(PHASE_DEVELOPMENT_SERVER),
  );
});

test("production builds receive separate cache generations", () => {
  assert.notEqual(
    config(PHASE_PRODUCTION_BUILD).env?.NEXT_PUBLIC_CACHE_VERSION,
    config(PHASE_PRODUCTION_BUILD).env?.NEXT_PUBLIC_CACHE_VERSION,
  );
});
