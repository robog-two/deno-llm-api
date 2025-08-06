import { Hono } from "@hono/hono";
import codeRoutes from "./code.ts";

const app = new Hono();

app.route("/code", codeRoutes);
app.all("/", (c) => c.json({ message: "API v2 is operational!" }));

export default app;
