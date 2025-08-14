import { DOMParser } from "@b-fuze/deno-dom";
import { Hono } from "@hono/hono";
import modelsConf from "../models.conf.ts";
import { StaticNetFilteringEngine } from "@gorhill/ubo-core";
import { Readability } from "@mozilla/readability";

/*
The search feature needs to do the following:
1) Turn a question into a search query (in this case three queries)
2) Filter out known malicious or bad websites such as: porn, spam, known misinformation/hate speech (this uses UBO)
3) Extract text from websites that we are able to (uses Mozilla's Readable.js)
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

// Bad website blocking and filtering code
const snfe = await StaticNetFilteringEngine.create();
await snfe.useLists([
  fetch("https://big.oisd.nl").then((r) => r.text()).then((raw) => ({
    name: "oisd-big",
    raw,
  })),
  fetch("https://nsfw.oisd.nl").then((r) => r.text()).then((raw) => ({
    name: "oisd-nsfw",
    raw,
  })),
]);
function isAllowed(url: string): boolean {
  return snfe.matchRequest({
    originURL: "https://slm.robog.net/",
    type: "image",
    url,
  }) == 0; // Returns the number of times this matched the filter lists. So, 0 means it's not in there a.k.a. good to go
}

// Simple inline logging for debugging purposes
function l<T>(x: T): T {
  console.log(x);
  return x;
}

// This web scraping function was written with generative AI.
async function internetSearch(query: string): Promise<Array<SearchResult>> {
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
    throw new Error("Anomaly class detected in the response HTML.");
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    throw new Error("Failed to parse HTML with deno‑dom.");
  }
  const results: Array<SearchResult> = [];
  const blocks = doc.querySelectorAll(".result");
  for (const block of blocks) {
    const linkEl = block.querySelector(".result__a");
    const link = linkEl?.getAttribute("href") ?? null;
    const descEl = block.querySelector(".result__snippet");
    const description = (descEl?.textContent ?? "").trim();
    if (link) {
      results.push({ link: new URL(link), description });
    }
  }

  return results;
}

async function triSearch(
  a: string,
  b: string,
  c: string,
): Promise<Array<string>> {
  const allResults = await Promise.all([
    internetSearch(a),
    internetSearch(b),
    internetSearch(c),
  ]);
  const finalLinks = new Set<string | undefined>();

  for (let i = 0; finalLinks.size < 15; i++) {
    finalLinks.add(allResults[0][i].link.href);
    finalLinks.add(allResults[1][i].link.href);
    finalLinks.add(allResults[2][i].link.href);
  }
  finalLinks.delete(undefined); // some standard JS shenanigans to avoid needing bounds checks
  return Array.from(finalLinks.values()) as string[];
}

app.post("/", async (c) => {
  const rephraseModel = modelsConf.special.get("searchRephrase") ??
    modelsConf.large;
  const chooseModel = modelsConf.special.get("searchChoose") ??
    modelsConf.large;
  // Write a program and deliver it in chunks
  const searchQuery = (await c.req.json()).searchQuery;

  const threeQueries = (l(
    await (await fetch(
      Deno.env.get("OLLAMA_ENDPOINT") + "/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: rephraseModel.name,
          think: rephraseModel.think,
          stream: false,
          messages: [
            {
              role: "system",
              content: rephraseModel.prompt,
            },
            {
              role: "user",
              content: searchQuery,
            },
          ],
        }),
      },
    )).json(),
  ).message.content as string) // Get the LLM's response
    .split("\n").filter((line) => line.match(/[ \t]*?[0-9]+?\./)) // filter every line that is a list like 1. or 2.
    .slice(-3); // take the last three items as these are the searches that the LLM recommends we perform

  const listOfSources = l(
    await triSearch(
      l(threeQueries[0]),
      l(threeQueries[1]),
      l(threeQueries[2]),
    ),
  ).filter(isAllowed);

  const allSourcesText = await Promise.all( // Kind of unbeleivable this just works! Shoutout to mozilla for making a brilliant article parser
    listOfSources.map((sourceLink): Promise<string> => {
      return (async () => {
        try {
          const html = await (await fetch(sourceLink, {
            headers: { "User-Agent": userAgent },
          })).text();
          const article = new Readability(
            new DOMParser().parseFromString(html, "text/html"),
          ).parse();
          return article?.textContent ?? "Article was unable to be processed.";
        } catch (e) {
          return e?.toString() ?? "Error occured while processing article";
        }
      })(); // IIFE generates a promise so we can do Promise.all
    }),
  );

  const bestSources = (l(
    await (await fetch(
      Deno.env.get("OLLAMA_ENDPOINT") + "/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: chooseModel.name,
          think: chooseModel.think,
          stream: false,
          messages: [
            {
              role: "system",
              content: chooseModel.prompt,
            },
            {
              role: "user",
              content: l(
                listOfSources.map((source, i) => `${i + 1}. ${source}`).join(
                  "\n",
                ) +
                  `\nChoose the best 3 sources that answer the question: "${searchQuery}"`,
              ),
            },
          ],
        }),
      },
    )).json(),
  ).message.content as string) // Get the LLM's response
    .split("\n").filter((line) => line.match(/[ \t]*?[0-9]+?\./)) // filter every line that is a list like 1. or 2.
    .map((line) =>
      line.replaceAll(/\*\*/g, "").replaceAll(/[ \t]*?[0-9]+?\./g, "")
        .replaceAll(
          " ",
          "",
        )
    ) // remove bold formatting, numbering, and spaces (they should be %20 in urls from the search engine)
    .map((line) => {
      try {
        return new URL(line);
      } catch (_) {
        return undefined;
      }
    }).filter((url) => url && ["http:", "https:"].includes(url.protocol))
    .slice(-3); // Take the last three URL's

  return c.json({
    sources: bestSources,
  });
});

export default app;
