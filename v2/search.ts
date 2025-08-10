// This web scraping function was written with generative AI.
import { DOMParser } from "@b-fuze/deno-dom";

export type Result = {
  link: URL;
  description: string;
};

export async function duckDuckGoSearch(query: string): Promise<Array<Result>> {
  const body = new URLSearchParams({ q: query, b: "" });
  const response = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Lynx/2.9.2 libwww-FM/2.14 SSL-MM/1.4",
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
  const results: Array<Result> = [];
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
