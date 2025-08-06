import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { secureHeaders } from "@hono/hono/secure-headers";
import { logger } from "@hono/hono/logger";
import { trimTrailingSlash } from "@hono/hono/trailing-slash";
import v1 from "./v1/respond_sync_default.ts";
import v2 from "./v2/v2.ts";
import {
  completionSchema,
  respondSyncRoute,
  validateWith,
} from "./v1/respond_sync_default.ts";

const app = new Hono();

const docsUrl = "https://robog.net/docs/slm.robog.net/";

// Various browser security/logging middleware
app.use(trimTrailingSlash());
app.use(secureHeaders());
app.use("/api/*", cors({ origin: "*" })); // Might lock this down in the future depending on server load. For now, it's public.
app.use(logger());

// Default route points to documentation
app.get("/", (c) => {
  return c.redirect(docsUrl);
});

app.post("/respond", validateWith(completionSchema), respondSyncRoute);
app.route("/api/v1", v1);
app.route("/api/v2", v2);

// Serve the app!
Deno.serve(app.fetch);
