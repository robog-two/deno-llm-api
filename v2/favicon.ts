import { Hono } from "@hono/hono";
import { validator } from "@hono/hono/validator";
import * as v from "@badrap/valita";
import { isBlocked } from "./filtering.ts";

const app = new Hono();
const kv = await Deno.openKv();

// Validation schema for the query parameter
const faviconSchema = v.object({
  url: v.string(),
});

app.get(
  "/",
  validator("query", (value, c) => {
    try {
      return faviconSchema.parse(value);
    } catch (e) {
      if (e instanceof Error) {
        return c.text("Input validation error: " + e.message, 401);
      } else {
        return c.text("Problem validating input.");
      }
    }
  }),
  async (c) => {
    const { url } = c.req.valid("query");
    const urlObject = new URL(url);
    const origin = urlObject.host;

    if (isBlocked(origin)) {
      return c.text("URL is blocked", 403);
    }

    const cacheKey = ["favicon", origin];
    const cached = await kv.get<{ data: Uint8Array; contentType: string }>(cacheKey);

    if (cached.value) {
        c.header("Content-Type", cached.value.contentType);
        c.header("X-Cache-Hit", "true");
        return c.body(cached.value.data);
    }


    try {
      const faviconUrl = `https://${origin}/favicon.ico`;

      // Fetch the favicon image and stream it back
      const faviconResponse = await fetch(faviconUrl);
      if (!faviconResponse.ok || !faviconResponse.body) {
        return c.text("Failed to fetch favicon image", 404);
      }

      const contentType = faviconResponse.headers.get("Content-Type") || "image/x-icon";
      const data = new Uint8Array(await faviconResponse.arrayBuffer());

      await kv.set(cacheKey, { data, contentType }, { expireIn: 86400 * 1000 }); // 24 hours

      c.header("Content-Type", contentType);
      return c.body(data);

    } catch (error) {
      console.error("Error fetching favicon:", error);
      return c.text("An error occurred while fetching the favicon", 500);
    }
  }
);

export default app;
