FROM denoland/deno:latest

WORKDIR /app

# Copy source
COPY . .

# Compile the main app
RUN deno cache main.ts

ENV OLLAMA_ENDPOINT=ollama:11434
ENV OLLAMA_MODEL=phi4-mini:latest

# Run the app
CMD ["deno", "run", "--allow-net" "--allow-env", "main.ts"]
