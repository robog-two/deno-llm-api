import modelsConf from "../../models.conf.ts";

export type EmbedVector = number[];

export function sqrVecDistance(a: EmbedVector, b: EmbedVector) {
  let totalDistance = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    totalDistance += Math.pow(a[i] - b[i], 2);
  }
  return totalDistance;
}

// Helper function that performs three searches simultaneously
export async function getSearchQueries(question: string): Promise<string[]> {
  const model = modelsConf.special.get("searchRephrase");
  if (!model) {
    throw new Error("searchRephrase model not configured");
  }
  // llama.cpp uses OpenAI-compatible /v1/chat/completions endpoint
  const response = await fetch(
    model.endpoint + "/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.model,
        stream: false,
        messages: [
          {
            "role": "system",
            "content": model.prompt,
          },
          {
            role: "user",
            content: question,
          },
        ],
      }),
    },
  );

  const json = await response.json();
  // OpenAI-compatible response format: choices[0].message.content
  const content = json.choices[0].message.content;
  return content.split("\n")
    .filter((s: string) => /^\d+\.\s*/.test(s)) // Filter for lines starting with "1.", "2.", etc.
    .map((s: string) => s.replace(/^\d+\.\s*/, "").trim());
}
