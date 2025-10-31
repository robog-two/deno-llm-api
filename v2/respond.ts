import { Context, Hono } from "@hono/hono";
import { validator } from "@hono/hono/validator";
import { streamText } from "@hono/hono/streaming";
import * as v from "@badrap/valita";
import modelsConf from "../models.conf.ts";

const app = new Hono();

const model = modelsConf.small;

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

    const searchResults = await (await fetch(
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

    const searchPrompt =
      "The following information was collected to assist you with your response. Please quote information directly where relevant and cite the source it came from.\n" +
      (
        searchResults.map((result: { text: string; link: string }) =>
          '\nSource snippet: "' + result.text + '"' +
          "Source URL: " + result.link + "\n"
        )
      );

    return streamText(c, async (stream) => {
      const abortController = new AbortController();
      stream.onAbort(() => {
        // Cancel the request to Ollama if the client disconnects
        abortController.abort();
      });

      const response = await fetch(
        Deno.env.get("OLLAMA_ENDPOINT") + "/api/chat",
        {
          signal: abortController.signal,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model.name,
            think: model.think,
            stream: true,
            messages: [
              {
                "role": "system",
                "content": model.prompt + "\n\n" + searchPrompt,
              },
              {
                role: "user",
                content: inputJson.question,
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        console.log(response.status);
        console.log(await response.text());
        await stream.write("Could not reach Ollama API.");
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
          "Response from Ollama had no body and was not streamable.",
        );
        return;
      }
    });
  },
);

export default app;
