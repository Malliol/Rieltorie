import yaml from "js-yaml";
import { atomicCommit, listObjects, deleteObject } from "./github.js";
import { resolveTenant } from "./tenants.js";
import { handleTelegramUpdate, listUsers, trackUser, type TgUser } from "./telegram.js";
import type { RealObject } from "../../schema/types.js";

// Минимальный интерфейс Cloudflare KV (без зависимости от глобальных CF-типов)
export interface KvLike {
  get<T = unknown>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string): Promise<void>;
  list(opts: { prefix: string }): Promise<{ keys: Array<{ name: string }> }>;
}

export interface Env {
  GITHUB_TOKEN: string;
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  USERS: KvLike;
}

// Проверить подпись Telegram initData (HMAC-SHA256)
async function verifyTelegram(initData: string, botToken: string): Promise<number | null> {
  if (!initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const tokenKey = await crypto.subtle.sign("HMAC", secretKey, enc.encode(botToken));
  const hmacKey = await crypto.subtle.importKey(
    "raw", tokenKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", hmacKey, enc.encode(dataCheckString));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (expected !== hash) return null;

  const userStr = params.get("user");
  if (!userStr) return null;
  const user = JSON.parse(userStr) as { id: number };
  return user.id;
}

// Достать объект пользователя из initData (после проверки подписи)
function parseTgUser(initData: string): TgUser | null {
  try {
    const userStr = new URLSearchParams(initData).get("user");
    if (!userStr) return null;
    const u = JSON.parse(userStr) as { id: number; username?: string; first_name?: string };
    return { id: u.id, username: u.username, first_name: u.first_name };
  } catch {
    return null;
  }
}

function json(data: unknown, status = 200): Response {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

// ── JSON API для мини-аппа (авторизация по initData) ───────────────────────
async function handleApi(path: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { initData?: string; id?: string };
  const initData = body.initData ?? "";
  const tenant = resolveTenant(initData);
  const botToken = (env as unknown as Record<string, string>)[tenant.botTokenSecret];
  const userId = await verifyTelegram(initData, botToken);
  const isAllowed = userId !== null && (tenant.allowedUserIds.length === 0 || tenant.allowedUserIds.includes(userId));
  const isAdmin = userId !== null && userId === tenant.adminId;

  // Зафиксировать пользователя мини-аппа (только при валидной подписи)
  if (userId !== null) await trackUser(env.USERS, parseTgUser(initData) ?? { id: userId });

  if (path === "/api/me") {
    return json({ userId, isAllowed, isAdmin });
  }

  if (!isAllowed) return json({ error: "unauthorized" }, 401);

  const repo = { token: env.GITHUB_TOKEN, owner: tenant.owner, repo: tenant.repo, branch: tenant.branch };

  if (path === "/api/list") {
    return json({ objects: await listObjects(repo) });
  }

  if (path === "/api/delete") {
    if (!body.id) return json({ error: "no id" }, 400);
    await deleteObject({ ...repo, id: body.id });
    return json({ ok: true });
  }

  if (path === "/api/users") {
    if (!isAdmin) return json({ error: "forbidden" }, 403);
    return json({ users: await listUsers(env.USERS), adminId: tenant.adminId, allowedUserIds: tenant.allowedUserIds });
  }

  return json({ error: "not found" }, 404);
}

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    let str = "";
    for (const b of bytes) str += String.fromCharCode(b);
    return btoa(str);
  });
}

function cors(res: Response): Response {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  return new Response(res.body, { status: res.status, headers: h });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const url = new URL(request.url);

    // ── Telegram webhook ──────────────────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/telegram") {
      if (env.WEBHOOK_SECRET && request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      try {
        const update = await request.json();
        await handleTelegramUpdate(update, env);
      } catch (e) {
        console.error("tg update error", e);
      }
      return new Response("ok");
    }

    // ── JSON API мини-аппа ────────────────────────────────────────────────
    if (request.method === "POST" && url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(url.pathname, request, env);
      } catch (e) {
        console.error("api error", e);
        return json({ error: String(e) }, 500);
      }
    }

    if (request.method !== "POST" || url.pathname !== "/publish") {
      return cors(new Response("Not found", { status: 404 }));
    }

    try {
      const form = await request.formData();
      const initData = form.get("initData") as string ?? "";
      const objectJson = form.get("object") as string;
      if (!objectJson) return cors(new Response("Missing object", { status: 400 }));

      const obj = JSON.parse(objectJson) as RealObject;
      const tenant = resolveTenant(initData);

      // Verify signature
      const botToken = (env as unknown as Record<string, string>)[tenant.botTokenSecret];
      const userId = await verifyTelegram(initData, botToken);

      // In dev mode (empty initData) — check env
      if (!userId && initData) {
        return cors(new Response("Unauthorized", { status: 401 }));
      }

      // Check allowlist (skip if empty = allow all verified users)
      if (userId && tenant.allowedUserIds.length > 0 && !tenant.allowedUserIds.includes(userId)) {
        return cors(new Response("Forbidden", { status: 403 }));
      }

      // Serialize object to YAML (preserve field order)
      const yamlContent = yaml.dump(obj, { lineWidth: 120, quotingType: '"' });

      // Collect files for commit
      const files: Array<{ path: string; content: string; encoding: "utf-8" | "base64" }> = [
        {
          path: `content/objects/${obj.id}.yaml`,
          content: yamlContent,
          encoding: "utf-8",
        },
      ];

      // Photos
      for (const [key, value] of form.entries()) {
        if ((key.startsWith("photo:") || key.startsWith("thumb:")) && value instanceof Blob) {
          const filename = key.split(":")[1];
          const base64 = await blobToBase64(value);
          files.push({
            path: `content/assets/${filename}`,
            content: base64,
            encoding: "base64",
          });
        }
      }

      const sha = await atomicCommit({
        token: env.GITHUB_TOKEN,
        owner: tenant.owner,
        repo: tenant.repo,
        branch: tenant.branch,
        message: `feat: add object ${obj.id}`,
        files,
      });

      const pageUrl = `https://${tenant.owner}.github.io/${tenant.repo}/objects/${obj.id}/`;

      return cors(new Response(JSON.stringify({ sha, url: pageUrl }), {
        headers: { "Content-Type": "application/json" },
      }));
    } catch (e) {
      console.error(e);
      return cors(new Response(String(e), { status: 500 }));
    }
  },
};
