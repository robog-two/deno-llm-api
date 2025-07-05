import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { secureHeaders } from "@hono/hono/secure-headers";
import { logger } from "@hono/hono/logger";
import { upgradeWebSocket } from "@hono/hono/deno";
import { validator } from "@hono/hono/validator";

const app = new Hono();
const endpointURL = Deno.env.get("OLLAMA_ENDPOINT");
const model = Deno.env.get("OLLAMA_MODEL");

app.use(cors({ origin: "*" })); // Might lock this down in the future depending on usage.
app.use(secureHeaders());
app.use(logger());

app.get("/", (c) => {
  return c.redirect("https://robog.net/docs/slm.robog.net/");
});

app.post("/respond", async (c) => {
  const inputJson = await c.req.json();

  const fetchResult = await fetch(endpointURL + "/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: inputJson,
    }), // redundant? need to validate I suppose
  });

  try {
    return c.json((await fetchResult.clone().json()).message);
  } catch (_) {
    return c.text(await fetchResult.text());
  }
});

Deno.serve(app.fetch);
