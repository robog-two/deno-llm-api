// Configuration for llama.cpp endpoints
// LLAMACPP_LLM_MODEL can be used to override the default model name if needed
// LLAMACPP_EMBEDDING_MODEL can be used to override the default embedding model name if needed

export type LangModelConfig = {
  small: LangModel;
  large: LangModel;
  code: LangModel;
  embedding: { endpoint: string; model: string };
  special: Map<string, LangModel>;
};

export type LangModel = {
  endpoint: string; // llama.cpp endpoint URL
  model: string; // model name (for OpenAI-compatible API)
  prompt: string; // May be overriden
  think: boolean; // May NOT be overriden
};

function p(prompt: string): string {
  return (new TextDecoder("utf-8")).decode(
    Deno.readFileSync(`prompts/${prompt}.txt`),
  );
}

// Get llama.cpp endpoints from environment
const llmEndpoint = Deno.env.get("LLAMACPP_LLM_ENDPOINT") ?? "http://localhost:8002";
const embeddingEndpoint = Deno.env.get("LLAMACPP_EMBEDDING_ENDPOINT") ?? "http://localhost:8001";

// Model names (can be overridden via env vars, but llama.cpp typically doesn't require specific model names)
const defaultModel = Deno.env.get("LLAMACPP_LLM_MODEL") ?? "llama-model";
const defaultEmbeddingModel = Deno.env.get("LLAMACPP_EMBEDDING_MODEL") ?? "embedding-model";

const modelsConf: LangModelConfig = {
  small: {
    endpoint: llmEndpoint,
    model: defaultModel,
    prompt: p("agent"),
    think: false,
  },
  large: {
    endpoint: llmEndpoint,
    model: defaultModel,
    prompt: p("agent"),
    think: true,
  },
  code: {
    endpoint: llmEndpoint,
    model: defaultModel,
    prompt: p("code"),
    think: true,
  },
  embedding: {
    endpoint: embeddingEndpoint,
    model: defaultEmbeddingModel,
  },
  special: new Map(Object.entries({
    searchRephrase: { // Rephrases one search into three different searches
      endpoint: llmEndpoint,
      model: defaultModel,
      prompt: p("search_rephrase"),
      think: false,
    },
    citationAgent: { // Generates responses with citations
      endpoint: llmEndpoint,
      model: defaultModel,
      prompt: p("citation_agent"),
      think: false,
    },
  })),
};

export default modelsConf;
