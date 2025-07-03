import { Application } from 'https://deno.land/x/oak/mod.ts';

const port = 8080;
const app = new Application();

app.use((ctx) => {
  ctx.response.body = 'Hello Deno';
});

app.addEventListener('listen', () => {
  console.log(`Listening on port ${port}`);
});

await app.listen({ port });
