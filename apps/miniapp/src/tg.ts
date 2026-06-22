// Тонкая обёртка над Telegram WebApp API с безопасными фолбэками для браузера.

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface WebApp {
  initData: string;
  initDataUnsafe: { user?: TgUser };
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  enableClosingConfirmation?(): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy"): void;
    notificationOccurred(type: "success" | "error" | "warning"): void;
    selectionChanged(): void;
  };
  showAlert(message: string, cb?: () => void): void;
  showConfirm(message: string, cb: (ok: boolean) => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}

export const wa = (): WebApp | undefined => window.Telegram?.WebApp;

export function initTelegram(): void {
  const w = wa();
  if (!w) return;
  w.ready();
  w.expand();
  try { w.enableClosingConfirmation?.(); } catch { /* noop */ }
  applyTheme(w);
}

function applyTheme(w: WebApp): void {
  const tp = w.themeParams || {};
  const root = document.documentElement.style;
  const set = (k: string, v?: string) => { if (v) root.setProperty(k, v); };
  set("--tg-bg", tp.bg_color);
  set("--tg-text", tp.text_color);
  set("--tg-hint", tp.hint_color);
  set("--tg-link", tp.link_color);
  set("--tg-button", tp.button_color);
  set("--tg-button-text", tp.button_text_color);
  set("--tg-surface", tp.secondary_bg_color);
  if (w.colorScheme === "dark") document.documentElement.dataset.theme = "dark";
  try {
    w.setHeaderColor?.(tp.secondary_bg_color ?? "#ffffff");
    w.setBackgroundColor?.(tp.bg_color ?? "#f5f6f8");
  } catch { /* noop */ }
}

export function getInitData(): string {
  return wa()?.initData ?? "";
}

export function getUser(): TgUser | undefined {
  return wa()?.initDataUnsafe?.user;
}

export function haptic(kind: "light" | "medium" | "heavy" | "success" | "error" | "warning" = "light"): void {
  const h = wa()?.HapticFeedback;
  if (!h) return;
  if (kind === "success" || kind === "error" || kind === "warning") h.notificationOccurred(kind);
  else h.impactOccurred(kind);
}

export function alert(message: string): void {
  const w = wa();
  if (w?.showAlert) w.showAlert(message);
  else window.alert(message);
}

export function confirm(message: string): Promise<boolean> {
  const w = wa();
  return new Promise((resolve) => {
    if (w?.showConfirm) w.showConfirm(message, resolve);
    else resolve(window.confirm(message));
  });
}

// Управление нативной кнопкой «Назад»
export function setBackButton(visible: boolean, onClick?: () => void): void {
  const bb = wa()?.BackButton;
  if (!bb) return;
  if (visible) {
    if (onClick) {
      bb.onClick(onClick);
    }
    bb.show();
  } else {
    bb.hide();
  }
}
