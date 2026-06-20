import { resolveTenant, type Tenant } from "./tenants.js";
import { listObjects, deleteObject } from "./github.js";
import type { Env } from "./index.js";

const MINIAPP_URL = "https://rieltorie-miniapp.pages.dev";

interface TgUpdate {
  message?: { text?: string; from?: { id: number }; chat?: { id: number } };
  callback_query?: {
    id: string;
    data?: string;
    from?: { id: number };
    message?: { message_id: number; chat?: { id: number } };
  };
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

// Главное меню — 3 кнопки
function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: "📝 Опубликовать объект", web_app: { url: MINIAPP_URL } }],
      [{ text: "📋 Мои объявления", callback_data: "list" }],
      [{ text: "📊 Статистика посещений", callback_data: "stats" }],
    ],
  };
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
    if (!isAllowed(tenant, from?.id)) {
      await tg("sendMessage", token, { chat_id: chatId, text: "⛔ Доступ только для риелтора." });
      return;
    }
    await tg("sendMessage", token, {
      chat_id: chatId,
      text: text === "/start" ? GREETING : "Меню панели:",
      reply_markup: mainMenu(),
    });
    return;
  }

  // ── Нажатие инлайн-кнопки ────────────────────────────────────────────────
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const msgId = cq.message?.message_id;
    if (chatId === undefined || msgId === undefined) return;

    if (!isAllowed(tenant, cq.from?.id)) {
      await tg("answerCallbackQuery", token, { callback_query_id: cq.id, text: "⛔ Нет доступа", show_alert: true });
      return;
    }
    await tg("answerCallbackQuery", token, { callback_query_id: cq.id });

    const data = cq.data ?? "";
    const repo = { token: env.GITHUB_TOKEN, owner: tenant.owner, repo: tenant.repo, branch: tenant.branch };

    if (data === "menu") {
      await tg("editMessageText", token, { chat_id: chatId, message_id: msgId, text: GREETING, reply_markup: mainMenu() });
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
