import React from "react";
import type { Realtor, Theme } from "../../schema/types.js";
import type { ResolvePhoto } from "./resolvePhoto.js";

interface Props {
  realtor: Realtor;
  theme: Theme;
  resolvePhoto: ResolvePhoto;
}

export function Visitka({ realtor: r, theme: t, resolvePhoto }: Props) {
  const photo = resolvePhoto(r.photo ?? "");

  return (
    <div style={{
      background: t.surface,
      borderRadius: t.radius,
      border: `1px solid ${t.border}`,
      padding: t.unit,
      fontFamily: t.body,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: t.unit * 0.7 }}>
        {photo ? (
          <img
            src={photo}
            alt={r.name}
            width={84}
            height={84}
            style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 84, height: 84, borderRadius: "50%",
            background: t.softAccent, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: t.muted, fontSize: 28, fontWeight: 700,
          }}>
            {r.name.charAt(0)}
          </div>
        )}
        <div>
          <div style={{ fontFamily: t.display, fontSize: 20, fontWeight: 600, color: t.ink }}>
            {r.name}
          </div>
          {r.tagline && (
            <div style={{ fontSize: 14, color: t.muted, marginTop: 4, lineHeight: 1.4 }}>
              {r.tagline}
            </div>
          )}
        </div>
      </div>

      {r.facts && r.facts.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(r.facts.length, 3)}, 1fr)`,
          gap: 8,
          marginTop: t.unit,
          padding: `${t.unit * 0.8}px`,
          background: t.bg,
          borderRadius: t.radius * 0.7,
        }}>
          {r.facts.map((f) => (
            <div key={f.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: t.display, fontSize: 22, fontWeight: 700, color: t.accent }}>
                {f.value}
              </div>
              <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{f.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 8,
        marginTop: t.unit,
      }}>
        <a href={`tel:${r.phone}`} style={btnStyle(t, false)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8 19.79 19.79 0 01.06 1.18 2 2 0 012.03 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/>
          </svg>
          Позвонить
        </a>
        {r.telegram && (
          <a href={`https://t.me/${r.telegram}`} target="_blank" rel="noreferrer" style={btnStyle(t, true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.94 8.19l-2.02 9.53c-.15.67-.54.83-1.09.52l-3-2.21-1.45 1.39c-.16.16-.3.3-.61.3l.21-3.01 5.45-4.92c.24-.21-.05-.33-.36-.12L7.06 14.4l-2.96-.92c-.64-.2-.65-.64.13-.95l11.56-4.46c.54-.19 1.01.13.83.95-.02.01-.07.17-.08.17z"/>
            </svg>
            Telegram
          </a>
        )}
        {r.whatsapp && (
          <a href={`https://wa.me/${r.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={btnStyle(t, false)}>
            WhatsApp
          </a>
        )}
        {r.vk && (
          <a href={`https://vk.com/${r.vk}`} target="_blank" rel="noreferrer" style={btnStyle(t, false)}>
            ВКонтакте
          </a>
        )}
      </div>
    </div>
  );
}

function btnStyle(t: Theme, primary: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 16px",
    borderRadius: t.radius,
    background: primary ? t.accent : t.bg,
    color: primary ? "#fff" : t.ink,
    border: primary ? "none" : `1px solid ${t.border}`,
    fontSize: 14,
    fontWeight: 500,
    textDecoration: "none",
    cursor: "pointer",
  };
}
