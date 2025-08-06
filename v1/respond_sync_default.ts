import { Context, Hono, HonoRequest } from "@hono/hono";
import { validator } from "@hono/hono/validator";
import * as v from "@badrap/valita";
import modelsConf from "../models.conf.ts";
import { HonoBase } from "@hono/hono/hono-base";

const app = new Hono();

const model = modelsConf.small;

// Validation primitives
export const completionSchema = v.array(
  v.object({
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  }),
);

export function validateWith(schema: v.Type) {
  return validator("json", (value, c) => {
    try {
      return schema.parse(value);
    } catch (e) {
      if (e instanceof Error) {
        return c.text("Input validation error: " + e.message, 401);
      } else {
        return c.text(
          "Problem validating input.",
        );
      }
    }
  });
}

export async function respondSyncRoute(c: Context) {
  const inputJson = await c.req.json();

  inputJson.unshift({
    "role": "system",
    "content": model.prompt,
  });

  const ollamaResult = await fetch(
    Deno.env.get("OLLAMA_ENDPOINT") + "/api/chat",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.name,
        think: model.think,
        stream: false,
        messages: inputJson,
      }), // redundant? need to validate I suppose
    },
  );

  try {
    return c.json((await ollamaResult.clone().json()).message);
  } catch (_) {
    console.log(await ollamaResult.text());
    return c.text("The LLM was unable to process your request.", 500);
  }
}
// This route handles synchronous LLM completions
app.all("/respond", validateWith(completionSchema), respondSyncRoute);

export default app;
