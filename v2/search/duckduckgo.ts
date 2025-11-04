import { DOMParser } from "@b-fuze/deno-dom";
import { isBlocked } from "../filtering.ts";
import { userAgent } from "./utils.ts";

// This web scraping function was written with generative AI.
export async function internetSearch(query: string): Promise<Array<string>> {
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
