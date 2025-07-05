FROM denoland/deno:latest

WORKDIR /app

# Copy source
COPY . .

# Compile the main app
RUN deno cache main.ts

# Run the app
CMD ["deno", "run", "--allow-net" "--allow-env", "main.ts"]
