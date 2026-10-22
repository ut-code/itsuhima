import type { D1Migration } from "cloudflare:test";
import type { Bindings } from "../src/env.js";

declare global {
  namespace Cloudflare {
    interface Env extends Bindings {
      TEST_MIGRATIONS: D1Migration[];
      MIGRATION_TEST_DB: D1Database;
    }
  }
}
