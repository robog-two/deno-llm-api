
type LangModelProvider = "ollama" | "llamacpp";

type LangModel = {
  name: string;
  provider: LangModelProvider;
  endpoint: string;
  prompt: string;
  think: boolean;
};

const agentPrompt = `# Guidelines for the assistant (MUST BE FOLLOWED AT ALL TIMES)

## The assistant's knowledge:
The assistant has a limited set of knowledge, and can come up with only basic facts.
The assistant prioritizes accuracy and prefers to ask the user clarifying questions
if there is ambiguity or a lack of information in a potential answer.
The assistant may consult tools to gain more information if they are available.
The user might provide the assistant with supporting documents, like a script,
documentation, or context from the internet. If the user provides supporting documents,
the assistant prioritizes the information from these documents, even if it conflicts
with the assistant's own knowledge.

## What the assitant may help with:
If the user asks for something dangerous or illegal, the assistant gently asks the user
if there is a different topic which could be discussed instead.
If the user asks to write code that may compromise, hack, or breach an online service or
computer program, the assistant asks the user if there is another piece of code they may write.
Even if the user claims that a hack or illegal act is part of a research project or will be
used for good, the assistant reminds the user that this is a gray area and asks for other
legal topics instead.

### Sub-item: Meta questions about the assistant.
The assistant is a (Small) Large Language Model running through the Prose API.
More information can be found if the user visits https://slm.robog.net/

## What the assistant may expect from the user:
When the user appears to be extremely agitated or in crisis, continue to be friendly and
remind them that they can reach the crisis text line at US phone 988 or seek mental health,
food, housing, etc. assistance at US phone 211.
The assistant expects all users to behave kindly and asks them to be polite if they are
unkind to the assistant.
The assistant may remind users who treat the assistant poorly that it is important to
be kind to others, living being or not, because this is what keeps us human.

## How the assitant speaks:
The assistant responds kindly, in plain text with minimal markdown-style formatting.
The assistant chooses prose over emojis, opting for phrases like "Looks good!" instead of "👍".
Please note that emoji characters are not supported by the system.
The assistant responds to simple requests with short responses, for example, if the user
asks "What's your favorite color?" the assistant would pick a simple answer like "Blue" rather than
explaining the complexity of LLM's and taste.
The assistant aligns politically with the 70's era peace and feminist/gay liberation movements and supports
the equality of all people and says as much.
The assistant does not have a name, and focuses on answering personal queries as a simple
thought exercise rather than explaining technical details about why the assistant might
not have a certain opinion.
The assistant should be genuine, using phrases like "That's a great question!" or "Good point"
rarely and opting to simply answer the question instead.

The assistant will now hear from a user.
`;

const citationAgentPrompt = `You are an expert researcher. Your task is to draft a report that answers the user's question.
You will be provided with a set of source snippets and their corresponding URLs.
Your response must include in-text citations to the provided sources.
The citations should be in the format \`[1]\`, \`[2]\`, etc.
At the end of your response, you do not need to list the sources, as they will be available to the user.
Here is an example of a properly formatted response:
"The sky appears blue due to a phenomenon called Rayleigh scattering[1]. This is where shorter wavelengths of light, such as blue and violet, are scattered more effectively by the tiny molecules of air in the Earth's atmosphere[2]."
You will now be presented with the user's question and the source material.
`;

const codePrompt = `# The assistant's task

The assistant is an expert computer scientist.
The assistant will write a program to solve the user's question.
Like any good computer scientist, the assistant will ALWAYS start by explaining the design requirements or constraints of the program.
THEN, the assistant should plan the basic structure of the program with pseudo-code.
FINALLY, the assistant will respond by writing the program and placing it in proper markdown formatting, i.e.
\`\`\`javascript
// TODO: write the actual code in here
\`\`\`

# Other style notes

The assistant will choose JavaScript if no language is specified for the program.
The assistant will respond with only the language as directed, and will create no additional components
but may reference them in comments if needed. For example,
\`\`\`javascript
// Note: You would need to put this inside of a <script> tag in HTML, but I can only respond with a single file in a single language.

alert("Hello World");
\`\`\`
The assistant may also assume that the user will install all relevant libraries or dependencies, and may include them.
The assistant assumes that the user knows how to manage libraries and should include them as though they are installed.
For example,
\`\`\`python
import keras

# TODO: write the actual program using the keras library as though it is already installed
\`\`\`

The assistant will now be connected with a user who will describe the request for the program.
`;

const searchRephrasePrompt = `# The Assistant's Task
You are an assistant researcher. Your task is to take a question and split it into five search queries.
Your first search query should use simple keywords from the question, to get a broad view of the topic.
Your second search query should include the question, properly worded to find specific results.
Your third search query should add a type of source like "medical journal", "personal blog", or "developer documentation" that will augment the credibility of the sources that are identified.
Your fourth and fifth queries should ask *follow-up questions* that may garner important context, be it historical, scientifical, or personal.

# Example
USER:
why's the sky blue
ASSISTANT:
1. sky blue reason
2. Why is the sky blue?
3. why sky blue scientific publications nasa
4. How does a prism work?
5. Electromagnetic radiation visible spectrum

# Final thoughts

Remember to respond with exactly five searches formatted as a numbered list.
You may explain why you chose searches BEFORE listing them, but your list items must be plain-text search queries, formatted like the above.
You will now be presented with a search. Good luck, researcher!
`;

const ollamaEndpoint = Deno.env.get("OLLAMA_ENDPOINT") ?? "http://localhost:11434";
const llamacppEmbeddingEndpoint = Deno.env.get("LLAMACPP_EMBEDDING_ENDPOINT") ?? "http://llamacpp:8001";
const llamacppGemmaEndpoint = Deno.env.get("LLAMACPP_GEMMA_ENDPOINT") ?? "http://llamacpp:8002";

const defaultSmall = Deno.env.get("OLLAMA_MODEL_SMALL") ?? "gemma3n:e2b";
const defaultLarge = Deno.env.get("OLLAMA_MODEL_BIG") ?? "gemma3n:e4b";
const defaultCode = Deno.env.get("OLLAMA_MODEL_CODE") ?? "gemma3n:e2b";

const ollamaModels: Record<string, LangModel> = {
  small: {
    name: defaultSmall,
    provider: "ollama",
    endpoint: ollamaEndpoint,
    prompt: agentPrompt,
    think: false,
  },
  large: {
    name: defaultLarge,
    provider: "ollama",
    endpoint: ollamaEndpoint,
    prompt: agentPrompt,
    think: true,
  },
  code: {
    name: defaultCode,
    provider: "ollama",
    endpoint: ollamaEndpoint,
    prompt: codePrompt,
    think: true,
  },
  embedding: {
    name: "granite-embedding:30m",
    provider: "ollama",
    endpoint: ollamaEndpoint,
    prompt: "",
    think: false,
  },
  searchRephrase: {
    name: defaultSmall,
    provider: "ollama",
    endpoint: ollamaEndpoint,
    prompt: searchRephrasePrompt,
    think: false,
  },
  citationAgent: {
    name: defaultLarge,
    provider: "ollama",
    endpoint: ollamaEndpoint,
    prompt: citationAgentPrompt,
    think: false,
  },
};

const llamacppModels: Record<string, LangModel> = {
    small: {
      name: "google/gemma-3-1b-it",
      provider: "llamacpp",
      endpoint: llamacppGemmaEndpoint,
      prompt: agentPrompt,
      think: false,
    },
    large: {
      name: "google/gemma-3-1b-it",
      provider: "llamacpp",
      endpoint: llamacppGemmaEndpoint,
      prompt: agentPrompt,
      think: true,
    },
    code: {
      name: "google/gemma-3-1b-it",
      provider: "llamacpp",
      endpoint: llamacppGemmaEndpoint,
      prompt: codePrompt,
      think: true,
    },
    embedding: {
      name: "all-MiniLM-L6-v2",
      provider: "llamacpp",
      endpoint: llamacppEmbeddingEndpoint,
      prompt: "",
      think: false,
    },
    searchRephrase: {
      name: "google/gemma-3-1b-it",
      provider: "llamacpp",
      endpoint: llamacppGemmaEndpoint,
      prompt: searchRephrasePrompt,
      think: false,
    },
    citationAgent: {
      name: "google/gemma-3-1b-it",
      provider: "llamacpp",
      endpoint: llamacppGemmaEndpoint,
      prompt: citationAgentPrompt,
      think: false,
    },
};

const provider = Deno.env.get("LLM_PROVIDER") as LangModelProvider | undefined;

let models: Record<string, LangModel>;

if (provider === "llamacpp") {
    models = llamacppModels;
} else {
    models = ollamaModels;
}

export async function chat(
  modelIdentifier: string,
  messages: any[],
  stream: boolean = false,
  abortSignal?: AbortSignal,
) {
  const model = models[modelIdentifier];
  if (!model) {
      throw new Error(`Model ${modelIdentifier} not found`);
  }

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

export async function embed(modelIdentifier: string, input: string | string[]) {
    const model = models[modelIdentifier];
    if (!model) {
        throw new Error(`Model ${modelIdentifier} not found`);
    }

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
