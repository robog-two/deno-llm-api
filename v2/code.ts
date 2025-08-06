import { Hono } from "@hono/hono";
import { streamText } from "@hono/hono/streaming";
import modelsConf from "../models.conf.ts";

const app = new Hono();

app.post("/", async (c) => {
  // Write a program and deliver it in chunks
  const instruction = (await c.req.json()).instruction;

  return streamText(c, async (stream) => {
    const abortController = new AbortController();
    // stream.onAbort(() => {
    //   // Cancel the request to Ollama if the client disconnects
    //   abortController.abort();
    // });

    const response = await fetch(
      Deno.env.get("OLLAMA_ENDPOINT") + "/api/chat",
      {
        signal: abortController.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelsConf.code.name,
          think: modelsConf.code.think,
          stream: true,
          messages: [
            {
              role: "system",
              content: modelsConf.code.prompt,
            },
            {
              role: "user",
              content: instruction,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      await stream.write("Could not reach Ollama API.");
      return;
    }

    const llmStream = response.body?.pipeThrough(new TextDecoderStream());
    let bodySoFar = "";
    let hitFirstCodeTag = false;
    let hitNewlineAfterCodeTag = false;
    let backtickStream = "";

    if (llmStream) {
      for await (const part of llmStream) {
        try {
          const partJSON = JSON.parse(part);
          const chunk = partJSON.message.content;
          bodySoFar += chunk;
          if (!hitFirstCodeTag && bodySoFar.includes("```")) {
            hitFirstCodeTag = true;
            bodySoFar = "";
          }
          if (hitFirstCodeTag && chunk.includes("\n")) {
            hitNewlineAfterCodeTag = true;
          }
          if (hitNewlineAfterCodeTag) {
            if (chunk.includes("`")) { // might be the end of the code, or it might be a single backtick!
              backtickStream += chunk;
            } else {
              await stream.write(backtickStream + chunk);
              backtickStream = "";
            }
          }
        } catch (e) {
          console.log(e);
        }

        if (bodySoFar.includes("```") && hitFirstCodeTag) {
          abortController.abort(); // stop wasting tokens, we've created the script.
          return;
        }
      }
    } else {
      await stream.write(
        "Response from Ollama had no body and was not streamable.",
      );
      return;
    }
  });
});

export default app;
