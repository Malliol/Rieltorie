import { getInitData } from "./tg.js";

export const WORKER_URL =
  import.meta.env.VITE_WORKER_URL ?? "https://rieltorie-worker.nik-mirosh.workers.dev";

// Базовый URL опубликованного сайта (для предпросмотра уже загруженных фото)
export const SITE_BASE =
  import.meta.env.VITE_SITE_BASE ?? "https://malliol.github.io/Rieltorie";

// POST на JSON-эндпоинт воркера с автоматической подстановкой initData
export async function api<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: getInitData(), ...body }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface Me {
  userId: number | null;
  isAllowed: boolean;
  isAdmin: boolean;
}

export interface ObjectSummary {
  id: string;
  title: string;
  price: number;
}

export interface UserRecord {
  id: number;
  username?: string;
  name?: string;
  first_seen: string;
  last_seen: string;
  count: number;
}
