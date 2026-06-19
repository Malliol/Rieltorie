import React from "react";
import type { RealObject, Theme } from "../../schema/types.js";
import { fmtPrice, perM2, specRail } from "./format.js";
import { PhotoFrame } from "./PhotoFrame.js";
import type { ResolvePhoto } from "./resolvePhoto.js";

interface Props {
  obj: RealObject;
  theme: Theme;
  resolvePhoto: ResolvePhoto;
  href?: string;
  onOpen?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  apartment: "Квартира",
  house: "Дом",
  land: "Участок",
  commercial: "Коммерция",
};

export function PropertyCard({ obj, theme: t, resolvePhoto, href, onOpen }: Props) {
  const sold = obj.status === "sold";
  const thumb = resolvePhoto(obj.photos[0] ?? "", true);
  const spec = specRail(obj);

  const card = (
    <div style={{
      background: t.surface,
      borderRadius: t.radius,
      border: `1px solid ${t.border}`,
      overflow: "hidden",
      opacity: sold ? 0.92 : 1,
      display: "flex",
      flexDirection: "column",
    }}>
      <PhotoFrame src={thumb} theme={t} rounded={false}>
        <div style={{
          position: "absolute", top: 8, left: 8,
          background: t.accent, color: "#fff",
          fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
          padding: "2px 8px", borderRadius: 6,
        }}>
          {TYPE_LABELS[obj.type] ?? obj.type}
        </div>
        {sold && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 16, letterSpacing: "0.1em",
          }}>
            ПРОДАНО
          </div>
        )}
      </PhotoFrame>

      <div style={{ padding: `${t.unit * 0.6}px ${t.unit * 0.8}px ${t.unit * 0.8}px` }}>
        <div style={{ fontFamily: t.display, fontSize: 20, fontWeight: 600, color: t.ink }}>
          {fmtPrice(obj.price)}
        </div>
        {perM2(obj.price, obj.area) && (
          <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{perM2(obj.price, obj.area)}</div>
        )}

        <div style={{
          fontFamily: t.body, fontSize: 14, color: t.ink,
          marginTop: 8, lineHeight: 1.4,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {obj.title}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {spec.map((s) => (
            <span key={s.label} style={{
              fontSize: 12, color: t.muted,
              background: t.bg, padding: "2px 8px",
              borderRadius: 6, border: `1px solid ${t.border}`,
            }}>
              {s.value}
            </span>
          ))}
        </div>

        {(obj.district || obj.street) && (
          <div style={{ fontSize: 12, color: t.muted, marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {[obj.district, obj.street].filter(Boolean).join(", ")}
          </div>
        )}
      </div>
    </div>
  );

  if (href) return <a href={href} style={{ textDecoration: "none", display: "block" }}>{card}</a>;
  if (onOpen) return <button onClick={onOpen} style={{ all: "unset", display: "block", width: "100%", cursor: "pointer" }}>{card}</button>;
  return card;
}
