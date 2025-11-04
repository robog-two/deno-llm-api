export const userAgent = "Lynx/2.9.2 libwww-FM/2.14 SSL-MM/1.4";

export const fetchWithTimeout = (url: string | URL, timeout = 2000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(url, {
    headers: { "User-Agent": userAgent },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
};

export const chunkArray = <T>(arr: T[], size: number): T[][] =>
  Array.from(
    { length: Math.ceil(arr.length / size) },
    (_, i) => arr.slice(i * size, i * size + size),
  );
