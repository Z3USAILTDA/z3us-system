import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const CLIENT_LOGO_BUCKET = "client-logos";
export const CLIENT_LOGO_MAX = 1024 * 1024;
export const CLIENT_LOGO_TYPES = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];

// logo_url guarda o caminho no bucket (privado: a área de trabalho bloqueia buckets públicos).
// Valores que já são URLs http(s) são usados diretamente.
const cache = new Map<string, { url: string; exp: number }>();

export async function resolveClientLogo(value?: string | null): Promise<string | null> {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/.test(value)) return value;
  const hit = cache.get(value);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(CLIENT_LOGO_BUCKET).createSignedUrl(value, 60 * 60 * 24);
  if (!data?.signedUrl) return null;
  cache.set(value, { url: data.signedUrl, exp: Date.now() + 60 * 60 * 23 * 1000 });
  return data.signedUrl;
}

export function useClientLogo(value?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveClientLogo(value).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [value]);
  return url;
}
