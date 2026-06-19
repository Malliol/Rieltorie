export interface Tenant {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  allowedUserIds: number[];
  botTokenSecret: string;
}

// MVP: один арендатор. При масштабировании — заменить на KV-lookup по initData.
const TENANTS: Tenant[] = [
  {
    id: "default",
    owner: "malliol",       // ← владелец GitHub репозитория
    repo: "rieltorie",
    branch: "main",
    allowedUserIds: [1108556509],
    botTokenSecret: "TELEGRAM_BOT_TOKEN",
  },
];

export function resolveTenant(_initData: string): Tenant {
  return TENANTS[0];
}
