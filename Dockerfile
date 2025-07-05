FROM denoland/deno:latest

EXPOSE 8000
WORKDIR /app
USER deno

# Copy source
COPY . .

# Compile the main app
RUN deno cache main.ts

CMD ["run", "--allow-env", "--allow-net", "main.ts"]
