pkill llama-server;
llama-server -hf ggml-org/embeddinggemma-300M-GGUF --embeddings --port 8001 -ub 8192 --mlock &
llama-server -hf ggml-org/gemma-3-4b-it-GGUF --port 8002 --mlock &
echo started llama servers in background
