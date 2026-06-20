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
    repo: "Rieltorie",
    branch: "main",
    allowedUserIds: [1108556509, 1367102384],
    botTokenSecret: "TELEGRAM_BOT_TOKEN",
  },
];

export function resolveTenant(_initData: string): Tenant {
  return TENANTS[0];
}
