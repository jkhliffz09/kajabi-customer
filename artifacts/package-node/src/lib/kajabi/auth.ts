import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

type TokenRecord = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

type KajabiTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

const tokenEndpoint = "https://api.kajabi.com/v1/oauth/token";

function getFallbackTokens(): TokenRecord {
  return {
    access_token: process.env.KAJABI_ACCESS_TOKEN ?? null,
    refresh_token: process.env.KAJABI_REFRESH_TOKEN ?? null,
    expires_at: process.env.KAJABI_TOKEN_EXPIRES_AT ?? null,
  };
}

function expiresSoon(expiresAt: string | null) {
  if (!expiresAt) return true;
  const time = new Date(expiresAt).getTime();
  if (Number.isNaN(time)) return true;
  return time - Date.now() <= 5 * 60 * 1000;
}

async function getStoredToken() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("kajabi_tokens")
    .select("access_token,refresh_token,expires_at")
    .eq("provider", "kajabi")
    .maybeSingle();

  if (error) throw error;
  return (data as TokenRecord | null) ?? getFallbackTokens();
}

async function saveToken(token: KajabiTokenResponse, previousRefreshToken: string | null) {
  const expiresIn = token.expires_in ?? 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error } = await getSupabaseAdmin().from("kajabi_tokens").upsert(
    {
      provider: "kajabi",
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? previousRefreshToken,
      expires_at: expiresAt,
    },
    { onConflict: "provider" },
  );

  if (error) throw error;
  return token.access_token;
}

export async function refreshKajabiAccessToken() {
  const clientId = process.env.KAJABI_CLIENT_ID;
  const clientSecret = process.env.KAJABI_CLIENT_SECRET;
  const stored = await getStoredToken();
  const refreshToken = stored.refresh_token ?? process.env.KAJABI_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("KAJABI_CLIENT_ID, KAJABI_CLIENT_SECRET, and KAJABI_REFRESH_TOKEN are required.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as KajabiTokenResponse | { error?: string } | null;
  if (!response.ok || !payload || !("access_token" in payload)) {
    throw new Error(`Kajabi token refresh failed with ${response.status}: ${JSON.stringify(payload)}`);
  }

  return saveToken(payload, refreshToken);
}

export async function getValidKajabiAccessToken() {
  const stored = await getStoredToken();
  if (stored.access_token && !expiresSoon(stored.expires_at)) {
    return stored.access_token;
  }
  return refreshKajabiAccessToken();
}
