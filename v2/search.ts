import { DOMParser } from "@b-fuze/deno-dom";
import { Hono } from "@hono/hono";
import modelsConf from "../models.conf.ts";
import { Readability } from "@mozilla/readability";
import { isBlocked } from "./filtering.ts";

/*
The search feature needs to do the following:
1) Turn a question into a search query (in this case three queries)
2) Filter out known malicious or bad websites such as: porn, spam, known misinformation/hate speech (this uses UBO)
3) Extract text from websites that we are able to (uses Mozilla's Readability.js)
4) Create embeddings for chunks of that text
5) Return snippets (alongside the URL they originate from) of text related to the query with a vector search

Also, there is important room for optimization:
- The query can be embedded while the searching and extracting is going on (this uses internet bandwidth more than CPU)
- The embeddings can be running constantly as new snippets are extracted, and stored in the order of their distance to
  the original query, so that data can be stored pre-sorted with a binary search vs being sorted after the fact
*/

const app = new Hono();

const userAgent = "Lynx/2.9.2 libwww-FM/2.14 SSL-MM/1.4";

export type SearchResult = {
  link: URL;
  description: string;
};

export type Source = {
  fullText: string;
  link: URL;
};

export type SourceChunk = {
  text: string;
  link: URL;
};

export type EmbedVector = number[];

function sqrVecDistance(a: EmbedVector, b: EmbedVector) {
  let totalDistance = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    totalDistance += Math.pow(a[i] - b[i], 2);
  }
  return totalDistance;
}

// This web scraping function was written with generative AI.
async function internetSearch(query: string): Promise<Array<string>> {
  const body = new URLSearchParams({ q: query, b: "" });
  const response = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body,
    credentials: "include",
  });
  const html = await response.text();
  const anomalyRegex = /class\s*=\s*"[^"]*\banomaly\w*[^"]*"/i;
  if (anomalyRegex.test(html)) {
    throw new Error("Search has been blocked/rate limited.");
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    throw new Error("Failed to parse HTML with deno‑dom.");
  }
  const results: Array<string> = [];
  const blocks = doc.querySelectorAll(".result");
  for (const block of blocks) {
    const linkEl = block.querySelector(".result__a");
    const link = linkEl?.getAttribute("href") ?? null;
    //const descEl = block.querySelector(".result__snippet");
    //const description = (descEl?.textContent ?? "").trim();
    if (link && !isBlocked(link)) {
      results.push(link);
    }
  }

  return results;
}

// Helper function that performs three searches simultaneously
async function getSearchQueries(question: string): Promise<string[]> {
  const model = modelsConf.special.get("searchRephrase");
  if (!model) {
    throw new Error("searchRephrase model not configured");
  }
  const response = await fetch(
    Deno.env.get("OLLAMA_ENDPOINT") + "/api/chat",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.name,
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
  const content = json.message.content;
  return content.split("\n")
    .filter((s: string) => /^\d+\.\s*/.test(s)) // Filter for lines starting with "1.", "2.", etc.
    .map((s: string) => s.replace(/^\d+\.\s*/, "").trim());
}

app.post("/", async (c) => {
  // Write a program and deliver it in chunks
  const requestJSON = await c.req.json();
  const question: string = requestJSON.question;

  // Request embedding for the query, but we will use it later so don't await
  const queryEmbeddingPromise = fetch(
    Deno.env.get("OLLAMA_ENDPOINT") + "/api/embed",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelsConf.embedding.name,
        input: question,
      }),
    },
  ).then((res) => res.json());

  // Turn the natural language question into keywords
  const searchQueries = await getSearchQueries(question);
  console.log(searchQueries);

  // Perform searches with a delay between each
  const searchResults = new Set<string>();
  for (const query of searchQueries) {
    (await internetSearch(query)).forEach((result) => {
      searchResults.add(result);
    });
    await new Promise((resolve) => setTimeout(resolve, 250)); // 250ms delay
  }
  const listOfSources = Array.from(searchResults).map((linkStr) => new URL(linkStr));

  // Convert links into text
  const allSourcesText = (await Promise.all( // Kind of unbeleivable this just works! Shoutout to mozilla for making a brilliant article parser
    listOfSources.map((result): Promise<Source | undefined> => {
      return (async () => {
        try {
          const html = await (await fetch(result, {
            headers: { "User-Agent": userAgent },
          })).text();
          const article = new Readability(
            new DOMParser().parseFromString(html, "text/html"),
          ).parse();

          if (article && article.textContent) {
            return {
              fullText: article.textContent.replaceAll(/\n\n+/g, "\n\n"), //filter out long newlines which sometimes occur
              link: result,
            };
          }
          return undefined;
        } catch (_) {
          return undefined;
        }
      })(); // IIFE generates a promise so we can do Promise.all
    }),
  ))
    // remove undefined
    .filter((it) => it != undefined)
    // block sources that will put unecessary stress on embedding server with little payoff (like a textbook, for example)
    .filter((it) => it.fullText.length < 25000) as Source[];

  // Convert text into chunks
  const sourceChunks: SourceChunk[] = [];
  allSourcesText.forEach((source) => {
    const { link, fullText } = source;
    const characters = 600;
    const overlap = 120;

    /*
    Assuming we are chunking abcdefghi and overlap is 1 and characters is 2:
    Chunk 1: abc
    Chunk 2: cdef
    Chunk 3: fghi
    */
    sourceChunks.push({ text: fullText.slice(0, characters + overlap), link });
    for (
      let i = characters + overlap;
      i + characters + overlap < fullText.length;
      i += characters + overlap
    ) {
      sourceChunks.push({
        text: fullText.slice(i - overlap, i) +
          fullText.slice(i, i + characters + overlap),
        link,
      });
    }
  });

  const queryEmbedding = (await queryEmbeddingPromise)
    .embeddings[0] as EmbedVector;

  /*
  Take all of the chunks, find embeddings for them, measure the distance between that and the query,
  then sort the chunks by that distance, and take the top three most similar chunks.
  */
  const topNChunks = (await Promise.all(sourceChunks.map((chunk) =>
    (async () => {
      const embedding = await fetch(
        Deno.env.get("OLLAMA_ENDPOINT") + "/api/embed",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelsConf.embedding.name,
            input: chunk.text,
          }),
        },
      ).then((res) =>
        res.json()
      ).then((resJSON) => resJSON.embeddings[0] as EmbedVector);

      const distance = sqrVecDistance(queryEmbedding, embedding);
      console.log(distance, chunk.link.host);
      return {
        chunk,
        distance,
        source: chunk.link,
      };
    })()
  ))).toSorted((a, b) =>
    a.distance - b.distance
  ).map((packed) => packed.chunk).slice(0, 15);

  return c.json(topNChunks);
});

export default app;
