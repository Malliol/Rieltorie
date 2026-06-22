import type { Env, KvLike } from "./index.js";

const MINIAPP_URL = "https://rieltorie-miniapp.pages.dev";

export interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
}

interface TgUpdate {
  message?: { text?: string; from?: TgUser; chat?: { id: number } };
}

// Запись о пользователе бота в KV
export interface UserRecord {
  id: number;
  username?: string;
  name?: string;
  first_seen: string;
  last_seen: string;
  count: number;
}

// Вызов Telegram Bot API
async function tg(method: string, token: string, payload: unknown): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// Зафиксировать пользователя (upsert в KV)
export async function trackUser(kv: KvLike, from: TgUser | undefined): Promise<void> {
  if (!from?.id) return;
  const key = `u:${from.id}`;
  const now = new Date().toISOString();
  const existing = await kv.get<UserRecord>(key, "json");
  const rec: UserRecord = existing
    ? { ...existing, last_seen: now, count: existing.count + 1, username: from.username ?? existing.username, name: from.first_name ?? existing.name }
    : { id: from.id, username: from.username, name: from.first_name, first_seen: now, last_seen: now, count: 1 };
  await kv.put(key, JSON.stringify(rec));
}

export async function listUsers(kv: KvLike): Promise<UserRecord[]> {
  const { keys } = await kv.list({ prefix: "u:" });
  const recs = await Promise.all(keys.map((k) => kv.get<UserRecord>(k.name, "json")));
  return recs.filter((r): r is UserRecord => r !== null).sort((a, b) => b.last_seen.localeCompare(a.last_seen));
}

// Бот максимально простой: на любое сообщение / start — одна кнопка запуска приложения.
export async function handleTelegramUpdate(update: TgUpdate, env: Env): Promise<void> {
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat?.id;
  if (chatId === undefined) return;

  await trackUser(env.USERS, msg.from);

  await tg("sendMessage", env.TELEGRAM_BOT_TOKEN, {
    chat_id: chatId,
    text: "🏠 *Кабинет риелтора*\n\nВсё управление — публикация объектов, список объявлений и статистика — внутри приложения.",
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "🚀 Открыть приложение", web_app: { url: MINIAPP_URL } }]],
    },
  });
}
