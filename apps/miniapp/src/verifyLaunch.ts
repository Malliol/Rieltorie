export type Platform = "telegram" | "max" | "vk";

export interface Launch {
  platform: Platform;
  initData: string;
  userId: number;
  username: string;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; initDataUnsafe: { user?: { id: number; username?: string } } } };
  }
}

export function detectLaunch(): Launch {
  const tg = window.Telegram?.WebApp;
  if (tg && tg.initData) {
    const user = tg.initDataUnsafe?.user;
    return {
      platform: "telegram",
      initData: tg.initData,
      userId: user?.id ?? 0,
      username: user?.username ?? "",
    };
  }

  // TODO: MAX support
  // TODO: VK support

  // dev fallback
  return {
    platform: "telegram",
    initData: "",
    userId: 0,
    username: "dev",
  };
}
