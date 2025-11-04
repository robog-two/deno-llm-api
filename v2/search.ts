import { DOMParser } from "@b-fuze/deno-dom";
import { Hono } from "@hono/hono";
import modelsConf from "../models.conf.ts";
import { Readability } from "@mozilla/readability";
import { fetchWithTimeout } from "./search/utils.ts";
import { internetSearch } from "./search/duckduckgo.ts";
import {
  EmbedVector,
  getSearchQueries,
  sqrVecDistance,
} from "./search/embedding.ts";

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

function* chunk(
  { fullText, link }: Source,
): Generator<SourceChunk, void, unknown> {
  const characters = 400;
  const overlap = 54;

  if (fullText.length > 25000) return;

  yield {
    text: fullText.slice(0, characters + overlap),
    link,
  };

  for (
    let i = characters + overlap;
    i + characters + overlap < fullText.length;
    i += characters + overlap
  ) {
    yield {
      text: fullText.slice(i - overlap, i) +
        fullText.slice(i, i + characters + overlap),
      link,
    };
  }
}

async function getSources(searchResults: URL[]): Promise<Source[]> {
  return (await Promise.all(
    searchResults.map(async (result) => {
      try {
        const html = await (await fetchWithTimeout(result)).text();
        const article = new Readability(
          new DOMParser().parseFromString(html, "text/html"),
        ).parse();

        if (article && article.textContent) {
          return {
            fullText: article.textContent.replaceAll(/\n\n+/g, "\n\n"),
            link: result,
          };
        }
      } catch (e) {
        console.log(e);
      }
    }),
  )).filter((it) => it !== undefined) as Source[];
}

app.post("/", async (c) => {
  console.time("search");
  const requestJSON = await c.req.json();
  const question: string = requestJSON.question;

  const queryEmbeddingPromise = fetch(
    modelsConf.embedding.endpoint + "/v1/embeddings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: question }),
    },
  ).then((res) => res.json());

  console.time("search-disambiguate");
  const searchQueries = await getSearchQueries(question);
  console.log(searchQueries);
  console.timeEnd("search-disambiguate");

  const chunksWithDistances: {
    chunk: SourceChunk;
    distance: number;
    source: URL;
  }[] = [];

  const embedPromises: Promise<void>[] = [];

  for (const query of searchQueries) {
    const searchResults = (await internetSearch(query)).map((link) =>
      new URL(link)
    );
    const sources = await getSources(searchResults);
    let chunks: SourceChunk[] = [];
    for (const source of sources) {
      chunks.push(...chunk(source));
    }

    for (let i = 0; i < chunks.length; i += 10) {
      const chunkBatch = chunks.slice(i, i + 10);
      const embedPromise = (async () => {
        const embeddingResponse = await (await fetch(
          modelsConf.embedding.endpoint + "/v1/embeddings",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: chunkBatch.map((chunk) => chunk.text),
            }),
          },
        )).json();

        const queryEmbedding = (await queryEmbeddingPromise).data[0]
          .embedding as EmbedVector;

        chunkBatch.forEach((chunk, index) => {
          const embedding =
            embeddingResponse.data[index].embedding as EmbedVector;
          const distance = sqrVecDistance(queryEmbedding, embedding);
          chunksWithDistances.push({
            chunk,
            distance,
            source: chunk.link,
          });
        });
      })();
      embedPromises.push(embedPromise);
    }
  }

  await Promise.all(embedPromises);

  const topNChunks = chunksWithDistances
    .toSorted((a, b) => a.distance - b.distance)
    .map((packed) => packed.chunk)
    .slice(0, 15);

  console.timeEnd("search");
  return c.json(topNChunks);
});

export default app;
