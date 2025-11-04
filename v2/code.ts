import { Hono } from "@hono/hono";
import { streamText } from "@hono/hono/streaming";
import modelsConf from "../models.conf.ts";

const app = new Hono();

app.post("/", async (c) => {
  // Write a program and deliver it in chunks
  const instruction = (await c.req.json()).instruction;

  return streamText(c, async (stream) => {
    const abortController = new AbortController();
    stream.onAbort(() => {
      // Cancel the request to Ollama if the client disconnects
      abortController.abort();
    });

    // llama.cpp uses OpenAI-compatible /v1/chat/completions endpoint
    const response = await fetch(
      modelsConf.code.endpoint + "/v1/chat/completions",
      {
        signal: abortController.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelsConf.code.model,
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
      await stream.write("Could not reach llama.cpp API.");
      return;
    }

    const llmStream = response.body?.pipeThrough(new TextDecoderStream());
    let bodySoFar = "";
    let hitFirstCodeTag = false;
    let hitNewlineAfterCodeTag = false;
    let backtickStream = "";
    let buffer = "";

    if (llmStream) {
      for await (const part of llmStream) {
        buffer += part;
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              continue;
            }
            try {
              const partJSON = JSON.parse(data);
              // OpenAI streaming format: choices[0].delta.content
              const chunk = partJSON.choices?.[0]?.delta?.content || "";
              if (!chunk) continue;

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

              if (bodySoFar.includes("```") && hitFirstCodeTag) {
                abortController.abort(); // stop wasting tokens, we've created the script.
                return;
              }
            } catch (e) {
              console.log("Error parsing SSE chunk:", e);
            }
          }
        }
      }
    } else {
      await stream.write(
        "Response from llama.cpp had no body and was not streamable.",
      );
      return;
    }
  });
});

export default app;
