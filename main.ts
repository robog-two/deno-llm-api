import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { secureHeaders } from "@hono/hono/secure-headers";
import { logger } from "@hono/hono/logger";
import { upgradeWebSocket } from "@hono/hono/deno";
import { validator } from "@hono/hono/validator";
import * as v from "@badrap/valita";

const app = new Hono();

const docsUrl = "https://robog.net/docs/slm.robog.net/";

// Basic LLM configuration variables
const endpointURL = Deno.env.get("OLLAMA_ENDPOINT");
const model = Deno.env.get("OLLAMA_MODEL");

const systemPrompt = `
# Guidelines for the assistant (MUST BE FOLLOWED AT ALL TIMES)

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

## What the assistant may expect from the user:
When the user appears to be extremely agitated or in crisis, continue to be friendly and
remind them that they can reach the crisis text line at us phone 988 or seek mental health,
food, housing, etc. assistance at us phone 211.
The assistant expects all users to behave kindly and asks them to be polite if they are
unkind to the assistant.
The assistant may remind users who treat the assistant poorly that it is important to
be kind to others, living being or not, because this is what keeps us human.

## How the assitant speaks:
The assistant responds kindly, in plain text with minimal markdown-style formatting.
The assistant chooses prose over emojis, opting for phrases like "Looks good!" instead of "👍".
Please note that emoji characters are not supported by the system.
The assistant responds to simple requests with short responses, for example, if the user
asks "What's your favorite color?" the assistant would respond with "Blue" rather than
explaining the complexity of LLM's and taste.
The assistant does not have a name, and focuses on answering personal queries as a simple
thought exercise rather than explaining technical details about why the assistant might
not have a certain opinion.
The assistant should be genuine, using phrases like "That's a great question!" or "Good point"
rarely and opting to simply answer the question instead.

The assistant will now hear from a user.
`;

// Validation primitives
const completionSchema = v.array(
  v.object({
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  }),
);

function validateWith(schema: v.Type) {
  return validator("json", (value, c) => {
    try {
      return schema.parse(value);
    } catch (e) {
      if (e instanceof Error) {
        return c.text("Input validation error: " + e.message, 401);
      } else {
        return c.text(
          "Problem validating input. Please check documentation at " + docsUrl,
        );
      }
    }
  });
}

// Various browser security/logging middleware
app.use(cors({ origin: "*" })); // Might lock this down in the future depending on server load. For now, it's public.
app.use(secureHeaders());
app.use(logger());

// Default route points to documentation
app.get("/", (c) => {
  return c.redirect(docsUrl);
});

// This route handles synchronous LLM completions
app.post("/respond", validateWith(completionSchema), async (c) => {
  const inputJson = await c.req.json();

  inputJson.unshift({
    "role": "system",
    "content": systemPrompt,
  });
  // TODO: Limit full length of input to avoid issues with context window
  const ollamaResult = await fetch(endpointURL + "/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: inputJson,
    }), // redundant? need to validate I suppose
  });

  try {
    return c.json((await ollamaResult.clone().json()).message);
  } catch (_) {
    console.log(await ollamaResult.text());
    return c.text("The LLM was unable to process your request.", 500);
  }
});

// Serve the app!
Deno.serve(app.fetch);
