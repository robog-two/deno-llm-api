# SLM

A Small Language Model service running at slm.robog.net

## Notes on Security

For the time being, all requests sent to this API and processed by it are sent to the same place. While I don't log any requests or retain any data (in fact, the containers are wiped daily at midnight), it's important to note that requests sent to this server do rather complex processing and could contain vulnerabilities (i.e. web browsers, web scraping, various fetch() requests with limited protective measures). I would recommend against sending sensitive data through this API, and assume that all data might be read or intercepted by a third party. I would ESPECIALLY caution using this API to run unreviewed code snippets, the generated code should ALWAYS be checked by a human or executed in a secure air-gapped environment.
