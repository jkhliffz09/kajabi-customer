import "server-only";

import { getValidKajabiAccessToken, refreshKajabiAccessToken } from "@/lib/kajabi/auth";
import type { KajabiResponse } from "@/lib/kajabi/types";

const baseUrl = "https://api.kajabi.com";
const maxRetries = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  const retrySeconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(retrySeconds) && retrySeconds > 0) {
    return retrySeconds * 1000;
  }
  return Math.min(1000 * 2 ** attempt, 15_000);
}

export async function kajabiFetch<T = KajabiResponse>(
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<T> {
  const token = await getValidKajabiAccessToken();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/vnd.api+json, application/json",
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (response.status === 401 && attempt === 0) {
    await refreshKajabiAccessToken();
    return kajabiFetch<T>(path, init, attempt + 1);
  }

  if (response.status === 429 && attempt < maxRetries) {
    await sleep(retryDelay(response, attempt));
    return kajabiFetch<T>(path, init, attempt + 1);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Kajabi request failed ${response.status} ${url}: ${JSON.stringify(payload)}`);
  }

  return payload as T;
}

export function buildKajabiPath(path: string, params: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}
