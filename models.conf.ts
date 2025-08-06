// OLLAMA_MODEL_SMALL=qwen3:0.6b
// OLLAMA_MODEL_BIG=qwen3:1.5b
// OLLAMA_MODEL_CODE=qwen2.5-coder-3b

export type LangModelConfig = {
  small: LangModel;
  large: LangModel;
  code: LangModel;
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

const modelsConf: LangModelConfig = {
  small: {
    name: Deno.env.get("OLLAMA_MODEL_SMALL") ?? "qwen3:0.6b",
    prompt: p("agent"),
    think: false,
  },
  large: {
    name: Deno.env.get("OLLAMA_MODEL_BIG") ?? "qwen3:1.7b",
    prompt: p("agent"),
    think: true,
  },
  code: {
    name: Deno.env.get("OLLAMA_MODEL_CODE") ?? "qwen2.5-coder:3b",
    prompt: p("code"),
    think: false,
  },
};

export default modelsConf;
