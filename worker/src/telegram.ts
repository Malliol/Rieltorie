import { resolveTenant, type Tenant } from "./tenants.js";
import { listObjects, deleteObject } from "./github.js";
import type { Env, KvLike } from "./index.js";

const MINIAPP_URL = "https://rieltorie-miniapp.pages.dev";

interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
}

interface TgUpdate {
  message?: { text?: string; from?: TgUser; chat?: { id: number } };
  callback_query?: {
    id: string;
    data?: string;
    from?: TgUser;
    message?: { message_id: number; chat?: { id: number } };
  };
}

// Запись о пользователе бота в KV
interface UserRecord {
  id: number;
  username?: string;
  name?: string;
  first_seen: string;
  last_seen: string;
  count: number;
}

// Зафиксировать пользователя (upsert в KV)
async function trackUser(kv: KvLike, from: TgUser | undefined): Promise<void> {
  if (!from?.id) return;
  const key = `u:${from.id}`;
  const now = new Date().toISOString();
  const existing = await kv.get<UserRecord>(key, "json");
  const rec: UserRecord = existing
    ? { ...existing, last_seen: now, count: existing.count + 1, username: from.username ?? existing.username, name: from.first_name ?? existing.name }
    : { id: from.id, username: from.username, name: from.first_name, first_seen: now, last_seen: now, count: 1 };
  await kv.put(key, JSON.stringify(rec));
}

async function listUsers(kv: KvLike): Promise<UserRecord[]> {
  const { keys } = await kv.list({ prefix: "u:" });
  const recs = await Promise.all(keys.map((k) => kv.get<UserRecord>(k.name, "json")));
  return recs.filter((r): r is UserRecord => r !== null).sort((a, b) => b.last_seen.localeCompare(a.last_seen));
}

// Вызов Telegram Bot API
async function tg(method: string, token: string, payload: unknown): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function isAllowed(tenant: Tenant, userId: number | undefined): boolean {
  if (userId === undefined) return false;
  return tenant.allowedUserIds.length === 0 || tenant.allowedUserIds.includes(userId);
}

// Главное меню (кнопка «Админка» — только для админа)
function mainMenu(isAdmin: boolean) {
  const rows: Array<Array<Record<string, unknown>>> = [
    [{ text: "📝 Опубликовать объект", web_app: { url: MINIAPP_URL } }],
    [{ text: "📋 Мои объявления", callback_data: "list" }],
    [{ text: "📊 Статистика посещений", callback_data: "stats" }],
  ];
  if (isAdmin) rows.push([{ text: "🛠 Админка", callback_data: "admin" }]);
  return { inline_keyboard: rows };
}

const backRow = [{ text: "⬅ Назад", callback_data: "menu" }];
const GREETING = "Панель риелтора 👋\nВыберите действие:";

export async function handleTelegramUpdate(update: TgUpdate, env: Env): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const tenant = resolveTenant("");

  // ── Обычное сообщение / команда ──────────────────────────────────────────
  if (update.message) {
    const { from, chat, text } = update.message;
    const chatId = chat?.id;
    if (chatId === undefined) return;
    await trackUser(env.USERS, from);
    if (!isAllowed(tenant, from?.id)) {
      await tg("sendMessage", token, { chat_id: chatId, text: "⛔ Доступ только для риелтора." });
      return;
    }
    await tg("sendMessage", token, {
      chat_id: chatId,
      text: text === "/start" ? GREETING : "Меню панели:",
      reply_markup: mainMenu(from?.id === tenant.adminId),
    });
    return;
  }

  // ── Нажатие инлайн-кнопки ────────────────────────────────────────────────
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const msgId = cq.message?.message_id;
    if (chatId === undefined || msgId === undefined) return;

    await trackUser(env.USERS, cq.from);
    if (!isAllowed(tenant, cq.from?.id)) {
      await tg("answerCallbackQuery", token, { callback_query_id: cq.id, text: "⛔ Нет доступа", show_alert: true });
      return;
    }
    await tg("answerCallbackQuery", token, { callback_query_id: cq.id });

    const data = cq.data ?? "";
    const isAdmin = cq.from?.id === tenant.adminId;
    const repo = { token: env.GITHUB_TOKEN, owner: tenant.owner, repo: tenant.repo, branch: tenant.branch };

    if (data === "menu") {
      await tg("editMessageText", token, { chat_id: chatId, message_id: msgId, text: GREETING, reply_markup: mainMenu(isAdmin) });
      return;
    }

    if (data === "admin") {
      if (!isAdmin) {
        await tg("answerCallbackQuery", token, { callback_query_id: cq.id, text: "⛔ Только для администратора", show_alert: true });
        return;
      }
      const users = await listUsers(env.USERS);
      const lines = users.map((u, i) => {
        const handle = u.username ? `@${u.username}` : (u.name ?? "—");
        const role = u.id === tenant.adminId ? " 👑" : (tenant.allowedUserIds.includes(u.id) ? " ✅" : "");
        return `${i + 1}. ${handle} (id ${u.id})${role}\n    заходов: ${u.count}, последний: ${u.last_seen.slice(0, 10)}`;
      });
      const text = users.length
        ? `🛠 Пользователи системы (${users.length}):\n\n${lines.join("\n")}\n\n👑 — админ, ✅ — риелтор с доступом`
        : "🛠 Пользователей пока нет.";
      await tg("editMessageText", token, { chat_id: chatId, message_id: msgId, text, reply_markup: { inline_keyboard: [backRow] } });
      return;
    }

    if (data === "stats") {
      await tg("editMessageText", token, {
        chat_id: chatId,
        message_id: msgId,
        text: "📊 Статистика посещений\n\n🚧 В разработке — скоро здесь появится количество просмотров объявлений.",
        reply_markup: { inline_keyboard: [backRow] },
      });
      return;
    }

    if (data === "list") {
      await showList(token, chatId, msgId, repo);
      return;
    }

    if (data.startsWith("del:")) {
      const id = data.slice(4);
      try {
        await deleteObject({ ...repo, id });
      } catch {
        await tg("answerCallbackQuery", token, { callback_query_id: cq.id, text: "Не удалось удалить", show_alert: true });
      }
      await showList(token, chatId, msgId, repo, `✅ Удалено: ${id}\n\n`);
      return;
    }
  }
}

async function showList(
  token: string,
  chatId: number,
  msgId: number,
  repo: { token: string; owner: string; repo: string; branch: string },
  prefix = "",
): Promise<void> {
  const objs = await listObjects(repo);
  if (objs.length === 0) {
    await tg("editMessageText", token, {
      chat_id: chatId,
      message_id: msgId,
      text: `${prefix}Объявлений пока нет.`,
      reply_markup: { inline_keyboard: [backRow] },
    });
    return;
  }
  const rows = objs.map((o) => [{
    text: `🗑 ${o.title} — ${o.price.toLocaleString("ru-RU")} ₽`,
    callback_data: `del:${o.id}`,
  }]);
  rows.push(backRow);
  await tg("editMessageText", token, {
    chat_id: chatId,
    message_id: msgId,
    text: `${prefix}Ваши объявления (нажмите, чтобы удалить):`,
    reply_markup: { inline_keyboard: rows },
  });
}
