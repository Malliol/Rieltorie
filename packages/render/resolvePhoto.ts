export interface PhotoConfig {
  base?: string;
  r2Base?: string;
}

export type ResolvePhoto = (key: string, thumb?: boolean) => string;

export function makeResolvePhoto(cfg: PhotoConfig = {}): ResolvePhoto {
  return function resolvePhoto(key: string, thumb = false): string {
    if (!key) return "";
    if (key.startsWith("http://") || key.startsWith("https://")) return key;

    const name = thumb ? key.replace(/(\.[^.]+)$/, "-thumb$1") : key;

    if (cfg.r2Base) return `${cfg.r2Base.replace(/\/$/, "")}/${name}`;
    const base = cfg.base ?? "/assets";
    return `${base.replace(/\/$/, "")}/${name}`;
  };
}
