import { Context, Hono } from "@hono/hono";
import { validator } from "@hono/hono/validator";
import { streamText } from "@hono/hono/streaming";
import * as v from "@badrap/valita";
import modelsConf from "../models.conf.ts";
import { SourceChunk } from "./search.ts";
import { chat } from "./llm.ts";

const app = new Hono();

// Validation primitives
export const searchRespondSchema = v.object({
  question: v.string(),
});

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

app.post(
  "/withsearch",
  validateWith(searchRespondSchema),
  async (c: Context) => {
    const inputJson = await c.req.json();

    const searchResults: SourceChunk[] = await (await fetch(
      "http://localhost:8000/api/v2/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: inputJson.question,
        }),
      },
    )).json();

    const citationModel = modelsConf.special.get("citationAgent");
    if (!citationModel) {
      throw new Error("citationAgent model not configured");
    }

    // Group chunks by link
    const sourcesByLink = new Map<string, SourceChunk[]>();
    for (const chunk of searchResults) {
      if (!sourcesByLink.has(chunk.link.toString())) {
        sourcesByLink.set(chunk.link.toString(), []);
      }
      sourcesByLink.get(chunk.link.toString())!.push(chunk);
    }

    let citationMap = "";
    let sourceCounter = 1;
    for (const [link, chunks] of sourcesByLink.entries()) {
      for (const chunk of chunks) {
        citationMap += `"${chunk.text}"[${sourceCounter}] `;
      }
      citationMap += `${link}\n`;
      sourceCounter++;
    }

    return streamText(c, async (stream) => {
      // First, stream the source chunks
      for (const chunk of searchResults) {
        await stream.write(JSON.stringify(chunk) + "\n");
      }

      const abortController = new AbortController();
      stream.onAbort(() => {
        // Cancel the request to the LLM if the client disconnects
        abortController.abort();
      });

      const response = await chat(
        citationModel,
        [
          {
            "role": "system",
            "content": citationModel.prompt + "\n\n" + citationMap,
          },
          {
            role: "user",
            content: inputJson.question,
          },
        ],
        true,
        abortController.signal,
      );

      if (!response) {
        await stream.write("Could not reach LLM API.");
        return;
      }

      if (!response.ok) {
        console.log(response.status);
        console.log(await response.text());
        await stream.write("Could not reach LLM API.");
        return;
      }

      const llmStream = response.body?.pipeThrough(new TextDecoderStream());

      if (llmStream) {
        for await (const part of llmStream) {
          try {
            const partJSON = JSON.parse(part);
            const chunk = partJSON.message.content;
            await stream.write(chunk);
          } catch (e) {
            console.log(e);
          }
        }
      } else {
        await stream.write(
          "Response from LLM had no body and was not streamable.",
        );
        return;
      }
    });
  },
);

export default app;
