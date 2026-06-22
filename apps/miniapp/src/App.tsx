import React, { useEffect, useState } from "react";
import {
  Plus, List as ListIcon, BarChart3, ShieldCheck, ChevronRight,
  Trash2, Pencil, Lock, Loader2, Crown, BadgeCheck,
} from "lucide-react";
import type { RealObject } from "../../../schema/types.js";
import { api, type Me, type ObjectSummary, type UserRecord } from "./api.js";
import { initTelegram, getUser, haptic, alert as tgAlert, confirm as tgConfirm, wa } from "./tg.js";
import { PublishForm } from "./PublishForm.js";

type Screen = "menu" | "publish" | "objects" | "stats" | "admin";

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState(false);
  const [screen, setScreen] = useState<Screen>("menu");
  const [editObj, setEditObj] = useState<RealObject | null>(null);

  useEffect(() => {
    initTelegram();
    api<Me>("/api/me").then(setMe).catch(() => setMeError(true));
  }, []);

  // Нативная кнопка «Назад» Telegram
  useEffect(() => {
    const bb = wa()?.BackButton;
    if (!bb) return;
    const handler = () => { haptic("light"); setScreen("menu"); };
    bb.onClick(handler);
    return () => bb.offClick(handler);
  }, []);
  useEffect(() => {
    const bb = wa()?.BackButton;
    if (!bb) return;
    if (screen === "menu") bb.hide(); else bb.show();
  }, [screen]);

  const go = (s: Screen) => { haptic("light"); if (s !== "publish") setEditObj(null); setScreen(s); };
  const startEdit = (obj: RealObject) => { haptic("light"); setEditObj(obj); setScreen("publish"); };

  if (meError) return <Centered icon={<Lock size={40} />} title="Не удалось подключиться" text="Проверьте соединение и откройте приложение заново." />;
  if (!me) return <Centered icon={<Loader2 size={40} className="spin" />} title="Загрузка…" />;
  if (!me.isAllowed) return <Centered icon={<Lock size={40} />} title="Нет доступа" text="Это приложение доступно только риелтору. Обратитесь к администратору." />;

  if (screen === "publish") return <PublishForm initial={editObj ?? undefined} onDone={() => go("menu")} />;
  if (screen === "objects") return <MyObjects onEdit={startEdit} />;
  if (screen === "stats") return <Stats />;
  if (screen === "admin") return <Admin />;

  return <Menu isAdmin={me.isAdmin} onSelect={go} />;
}

/* ─── Главное меню ─────────────────────────────────────────────────────── */

function Menu({ isAdmin, onSelect }: { isAdmin: boolean; onSelect: (s: Screen) => void }) {
  const name = getUser()?.first_name;
  return (
    <div className="menu">
      <header className="menu-head">
        <div className="menu-eyebrow">Кабинет риелтора</div>
        <h1 className="menu-title">{name ? `Здравствуйте, ${name}` : "Здравствуйте"} 👋</h1>
        <p className="menu-sub">Управляйте объявлениями прямо из Telegram</p>
      </header>

      <div className="menu-grid">
        <MenuCard color="accent" icon={<Plus size={22} />} title="Опубликовать объект"
          desc="Добавить новое объявление" onClick={() => onSelect("publish")} />
        <MenuCard color="green" icon={<ListIcon size={22} />} title="Мои объявления"
          desc="Просмотр и удаление" onClick={() => onSelect("objects")} />
        <MenuCard color="amber" icon={<BarChart3 size={22} />} title="Статистика"
          desc="Посещения и просмотры" onClick={() => onSelect("stats")} />
        {isAdmin && (
          <MenuCard color="violet" icon={<ShieldCheck size={22} />} title="Админка"
            desc="Пользователи системы" onClick={() => onSelect("admin")} />
        )}
      </div>

      <footer className="menu-foot">Rieltorie · v0.1</footer>
    </div>
  );
}

function MenuCard({ icon, title, desc, color, onClick }: {
  icon: React.ReactNode; title: string; desc: string; color: string; onClick: () => void;
}) {
  return (
    <button className="card" onClick={onClick}>
      <span className={`card-ic ic-${color}`}>{icon}</span>
      <span className="card-tx">
        <span className="card-title">{title}</span>
        <span className="card-desc">{desc}</span>
      </span>
      <ChevronRight size={20} className="card-arrow" />
    </button>
  );
}

/* ─── Мои объявления ───────────────────────────────────────────────────── */

function MyObjects({ onEdit }: { onEdit: (obj: RealObject) => void }) {
  const [objects, setObjects] = useState<ObjectSummary[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = () => {
    setError("");
    api<{ objects: ObjectSummary[] }>("/api/list")
      .then((r) => setObjects(r.objects))
      .catch((e) => setError(String(e)));
  };
  useEffect(load, []);

  async function remove(o: ObjectSummary) {
    if (!(await tgConfirm(`Удалить «${o.title}»?`))) return;
    setBusy(o.id);
    try {
      await api("/api/delete", { id: o.id });
      haptic("success");
      setObjects((prev) => prev?.filter((x) => x.id !== o.id) ?? null);
    } catch (e) {
      haptic("error");
      tgAlert("Не удалось удалить: " + String(e));
    } finally {
      setBusy(null);
    }
  }

  async function edit(o: ObjectSummary) {
    setEditing(o.id);
    try {
      const r = await api<{ object: RealObject }>("/api/get", { id: o.id });
      onEdit(r.object);
    } catch (e) {
      haptic("error");
      tgAlert("Не удалось открыть: " + String(e));
    } finally {
      setEditing(null);
    }
  }

  return (
    <div className="screen">
      <h2 className="screen-title">Мои объявления</h2>
      {error && <div className="alert">{error}</div>}
      {!objects && !error && <Skeleton />}
      {objects && objects.length === 0 && <Empty text="Объявлений пока нет" />}
      <div className="obj-list">
        {objects?.map((o) => (
          <div className="obj-row" key={o.id}>
            <div className="obj-info">
              <div className="obj-title">{o.title}</div>
              <div className="obj-price">{o.price.toLocaleString("ru-RU")} ₽</div>
            </div>
            <button className="icon-btn" disabled={editing === o.id} onClick={() => edit(o)}>
              {editing === o.id ? <Loader2 size={18} className="spin" /> : <Pencil size={18} />}
            </button>
            <button className="icon-btn danger" disabled={busy === o.id} onClick={() => remove(o)}>
              {busy === o.id ? <Loader2 size={18} className="spin" /> : <Trash2 size={18} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Статистика (заглушка) ────────────────────────────────────────────── */

function Stats() {
  return (
    <div className="screen">
      <h2 className="screen-title">Статистика</h2>
      <Centered
        icon={<BarChart3 size={40} />}
        title="Скоро здесь будет статистика"
        text="Количество просмотров объявлений и посещений сайта появится в одном из следующих обновлений."
        inline
      />
    </div>
  );
}

/* ─── Админка ──────────────────────────────────────────────────────────── */

function Admin() {
  const [data, setData] = useState<{ users: UserRecord[]; adminId: number; allowedUserIds: number[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ users: UserRecord[]; adminId: number; allowedUserIds: number[] }>("/api/users")
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="screen">
      <h2 className="screen-title">Пользователи системы</h2>
      {error && <div className="alert">{error}</div>}
      {!data && !error && <Skeleton />}
      {data && data.users.length === 0 && <Empty text="Пользователей пока нет" />}
      <div className="user-list">
        {data?.users.map((u) => {
          const handle = u.username ? `@${u.username}` : (u.name ?? "—");
          const isAdmin = u.id === data.adminId;
          const isRealtor = data.allowedUserIds.includes(u.id);
          return (
            <div className="user-row" key={u.id}>
              <div className="user-av">{(u.name ?? u.username ?? "?").slice(0, 1).toUpperCase()}</div>
              <div className="user-info">
                <div className="user-name">
                  {handle}
                  {isAdmin ? <Crown size={14} className="badge-admin" /> : isRealtor ? <BadgeCheck size={14} className="badge-realtor" /> : null}
                </div>
                <div className="user-meta">id {u.id} · заходов: {u.count} · {u.last_seen.slice(0, 10)}</div>
              </div>
            </div>
          );
        })}
      </div>
      {data && <p className="hint-note">👑 — администратор · ✅ — риелтор с доступом</p>}
    </div>
  );
}

/* ─── Вспомогательные ──────────────────────────────────────────────────── */

function Centered({ icon, title, text, inline }: { icon: React.ReactNode; title: string; text?: string; inline?: boolean }) {
  return (
    <div className={inline ? "centered inline" : "centered"}>
      <div className="centered-ic">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
    </div>
  );
}

function Skeleton() {
  return <div className="skeleton-wrap">{[0, 1, 2].map((i) => <div className="skeleton" key={i} />)}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
