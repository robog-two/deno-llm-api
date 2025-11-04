import { LangModel } from "../models.conf.ts";

export async function chat(
  model: LangModel,
  messages: any[],
  stream: boolean = false,
  abortSignal?: AbortSignal,
) {
  if (model.provider === "ollama") {
    const response = await fetch(
      model.endpoint + "/api/chat",
      {
        signal: abortSignal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.name,
          think: model.think,
          stream: stream,
          messages: messages,
        }),
      },
    );

    return response;
  } else if (model.provider === "llamacpp") {
    const response = await fetch(
      model.endpoint + "/v1/chat/completions",
      {
        signal: abortSignal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.name,
          stream: stream,
          messages: messages,
        }),
      },
    );

    return response;
  }
}

export async function embed(model: LangModel, input: string | string[]) {
    if (model.provider === "ollama") {
        const response = await fetch(
            model.endpoint + "/api/embed",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: model.name,
                    input: input,
                }),
            },
        );
        return response;
    } else if (model.provider === "llamacpp") {
        const response = await fetch(
            model.endpoint + "/v1/embeddings",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: model.name,
                    input: input,
                }),
            },
        );
        return response;
    }
}
