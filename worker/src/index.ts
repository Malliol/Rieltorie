import yaml from "js-yaml";
import { atomicCommit } from "./github.js";
import { resolveTenant } from "./tenants.js";
import type { RealObject } from "../../schema/types.js";

export interface Env {
  GITHUB_TOKEN: string;
  TELEGRAM_BOT_TOKEN: string;
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
      const botToken = (env as Record<string, string>)[tenant.botTokenSecret];
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
