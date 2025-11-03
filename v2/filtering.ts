import { StaticNetFilteringEngine } from "@gorhill/ubo-core";

// Bad website blocking and filtering code
const snfe = await StaticNetFilteringEngine.create();
await snfe.useLists([
  fetch("https://web.archive.org/web/20250327180212if_/https://big.oisd.nl/")
    .then((r) => r.text()).then((raw) => ({
      name: "oisd-big",
      raw,
    })),
  fetch("https://web.archive.org/web/20250327180212if_/https://nsfw.oisd.nl/")
    .then((r) => r.text()).then((raw) => ({
      name: "oisd-nsfw",
      raw,
    })),
]);

export function isBlocked(url: string | URL): boolean {
  return snfe.findFor(url.toString()) !== undefined;
}
