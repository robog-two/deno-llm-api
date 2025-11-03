import { Hono } from "@hono/hono";
import codeRoutes from "./code.ts";
import searchRoutes from "./search.ts";
import respondRoutes from "./respond.ts";
import faviconRoutes from "./favicon.ts";

const app = new Hono();

app.route("/code", codeRoutes);
app.route("/search", searchRoutes);
app.route("/respond", respondRoutes);
app.route("/favicon", faviconRoutes);
app.all("/", (c) => c.json({ message: "API v2 is operational!" }));

export default app;
