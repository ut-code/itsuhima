import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.js";

export type { AppType } from "./app.js";

const port = Number(process.env.PORT) || 3000;

serve(
  {
    fetch: app.fetch,
    port,
    hostname: "0.0.0.0",
  },
  () => {
    console.log(`Server listening on 0.0.0.0:${port}`);
  },
);
