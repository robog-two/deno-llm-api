// OLLAMA_MODEL_SMALL=qwen3:0.6b
// OLLAMA_MODEL_BIG=qwen3:1.5b
// OLLAMA_MODEL_CODE=qwen2.5-coder-3b

export type LangModelConfig = {
  small: LangModel;
  large: LangModel;
  code: LangModel;
  special: Map<string, LangModel>;
};

export type LangModel = {
  name: string;
  prompt: string; // May be overriden
  think: boolean; // May NOT be overriden
};

function p(prompt: string): string {
  return (new TextDecoder("utf-8")).decode(
    Deno.readFileSync(`prompts/${prompt}.txt`),
  );
}

const defaultSmall = Deno.env.get("OLLAMA_MODEL_SMALL") ?? "qwen3:0.6b";
const defaultLarge = Deno.env.get("OLLAMA_MODEL_BIG") ?? "qwen3:1.7b";
const defaultCode = Deno.env.get("OLLAMA_MODEL_CODE") ?? "qwen3:1.7b";

const modelsConf: LangModelConfig = {
  small: {
    name: defaultSmall,
    prompt: p("agent"),
    think: false,
  },
  large: {
    name: defaultLarge,
    prompt: p("agent"),
    think: true,
  },
  code: {
    name: defaultCode,
    prompt: p("code"),
    think: true,
  },
  special: new Map(Object.entries({
    searchChoose: { // Chooses the best 3 sources from a list of links
      name: "gemma3n:e4b",
      prompt: p("search_choose"),
      think: false,
    },
    searchRephrase: { // Rephrases one search into three different searches
      name: defaultLarge,
      prompt: p("search_rephrase"),
      think: false,
    },
  })),
};

export default modelsConf;
