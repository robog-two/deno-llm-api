// OLLAMA_MODEL_SMALL=qwen3:0.6b
// OLLAMA_MODEL_BIG=qwen3:1.5b
// OLLAMA_MODEL_CODE=qwen2.5-coder-3b

export type LangModelProvider = "ollama" | "llamacpp";

export type LangModelConfig = {
  small: LangModel;
  large: LangModel;
  code: LangModel;
  embedding: LangModel;
  special: Map<string, LangModel>;
};

export type LangModel = {
  name: string;
  provider: LangModelProvider;
  endpoint: string;
  prompt: string; // May be overriden
  think: boolean; // May NOT be overriden
};

function p(prompt: string): string {
  return (new TextDecoder("utf-8")).decode(
    Deno.readFileSync(`prompts/${prompt}.txt`),
  );
}

const ollamaEndpoint = Deno.env.get("OLLAMA_ENDPOINT") ?? "http://localhost:11434";
const llamacppEmbeddingEndpoint = Deno.env.get("LLAMACPP_EMBEDDING_ENDPOINT") ?? "http://llamacpp:8001";
const llamacppGemmaEndpoint = Deno.env.get("LLAMACPP_GEMMA_ENDPOINT") ?? "http://llamacpp:8002";

const defaultSmall = Deno.env.get("OLLAMA_MODEL_SMALL") ?? "gemma3n:e2b";
const defaultLarge = Deno.env.get("OLLAMA_MODEL_BIG") ?? "gemma3n:e4b";
const defaultCode = Deno.env.get("OLLAMA_MODEL_CODE") ?? "gemma3n:e2b";

const ollamaModels: LangModelConfig = {
  small: {
    name: defaultSmall,
    provider: "ollama",
    endpoint: ollamaEndpoint,
    prompt: p("agent"),
    think: false,
  },
  large: {
    name: defaultLarge,
    provider: "ollama",
    endpoint: ollamaEndpoint,
    prompt: p("agent"),
    think: true,
  },
  code: {
    name: defaultCode,
    provider: "ollama",
    endpoint: ollamaEndpoint,
    prompt: p("code"),
    think: true,
  },
  embedding: {
    name: "granite-embedding:30m",
    provider: "ollama",
    endpoint: ollamaEndpoint,
    prompt: "",
    think: false,
  },
  special: new Map(Object.entries({
    searchRephrase: { // Rephrases one search into three different searches
      name: defaultSmall,
      provider: "ollama",
      endpoint: ollamaEndpoint,
      prompt: p("search_rephrase"),
      think: false,
    },
    citationAgent: { // Generates responses with citations
      name: defaultLarge,
      provider: "ollama",
      endpoint: ollamaEndpoint,
      prompt: p("citation_agent"),
      think: false,
    },
  })),
};

const llamacppModels: LangModelConfig = {
    small: {
      name: "google/gemma-3-1b-it",
      provider: "llamacpp",
      endpoint: llamacppGemmaEndpoint,
      prompt: p("agent"),
      think: false,
    },
    large: {
      name: "google/gemma-3-1b-it",
      provider: "llamacpp",
      endpoint: llamacppGemmaEndpoint,
      prompt: p("agent"),
      think: true,
    },
    code: {
      name: "google/gemma-3-1b-it",
      provider: "llamacpp",
      endpoint: llamacppGemmaEndpoint,
      prompt: p("code"),
      think: true,
    },
    embedding: {
      name: "all-MiniLM-L6-v2",
      provider: "llamacpp",
      endpoint: llamacppEmbeddingEndpoint,
      prompt: "",
      think: false,
    },
    special: new Map(Object.entries({
      searchRephrase: { // Rephrases one search into three different searches
        name: "google/gemma-3-1b-it",
        provider: "llamacpp",
        endpoint: llamacppGemmaEndpoint,
        prompt: p("search_rephrase"),
        think: false,
      },
      citationAgent: { // Generates responses with citations
        name: "google/gemma-3-1b-it",
        provider: "llamacpp",
        endpoint: llamacppGemmaEndpoint,
        prompt: p("citation_agent"),
        think: false,
      },
    })),
  };

const provider = Deno.env.get("LLM_PROVIDER") as LangModelProvider | undefined;

let modelsConf: LangModelConfig;

if (provider === "llamacpp") {
    modelsConf = llamacppModels;
} else {
    modelsConf = ollamaModels;
}


export default modelsConf;
