// OLLAMA_MODEL_SMALL=qwen3:0.6b
// OLLAMA_MODEL_BIG=qwen3:1.5b
// OLLAMA_MODEL_CODE=qwen2.5-coder-3b

export type LangModelConfig = {
  small: LangModel;
  large: LangModel;
  code: LangModel;
  embedding: { name: string };
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

const defaultSmall = Deno.env.get("OLLAMA_MODEL_SMALL") ?? "gemma3n:e2b";
const defaultLarge = Deno.env.get("OLLAMA_MODEL_BIG") ?? "gemma3n:e2b";
const defaultCode = Deno.env.get("OLLAMA_MODEL_CODE") ?? "gemma3n:e2b";

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
  embedding: {
    name: "granite-embedding:30m",
  },
  special: new Map(Object.entries({
    searchRephrase: { // Rephrases one search into three different searches
      name: defaultLarge,
      prompt: p("search_rephrase"),
      think: false,
    },
    citationAgent: { // Generates responses with citations
      name: defaultSmall,
      prompt: p("citation_agent"),
      think: false,
    }
  })),
};

export default modelsConf;
