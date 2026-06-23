import React, { useState } from "react";
import type { RealObject, Realtor, Theme } from "../../schema/types.js";
import { fmtPrice, perM2, specRail } from "./format.js";
import { PhotoFrame } from "./PhotoFrame.js";
import { MortgageBlock } from "./MortgageBlock.js";
import type { ResolvePhoto } from "./resolvePhoto.js";

interface Props {
  obj: RealObject;
  realtor: Realtor;
  theme: Theme;
  resolvePhoto: ResolvePhoto;
  showContacts?: boolean;
  interactive?: boolean;
  backHref?: string;
  onBack?: () => void;
}

export function ObjectPage({
  obj, realtor: r, theme: t, resolvePhoto,
  showContacts = true, interactive = true,
  backHref, onBack,
}: Props) {
  const [activePhoto, setActivePhoto] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const photos = obj.photos.map((k) => resolvePhoto(k));
  const thumbs = obj.photos.map((k) => resolvePhoto(k, true));
  const spec = specRail(obj);
  const u = t.unit;

  return (
    <div style={{ fontFamily: t.body, background: t.bg, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: t.surface, borderBottom: `1px solid ${t.border}`, padding: `${u * 0.6}px ${u}px`, display: "flex", alignItems: "center", gap: 12 }}>
        {(backHref || onBack) && (
          backHref
            ? <a href={backHref} style={{ color: t.muted, textDecoration: "none", fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
                ← Назад
              </a>
            : <button onClick={onBack} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", fontSize: 14, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                ← Назад
              </button>
        )}
        <span style={{ fontSize: 14, color: t.muted }}>{obj.title}</span>
      </div>

      {/* Main photo */}
      <PhotoFrame
        src={photos[activePhoto]}
        theme={t}
        rounded={false}
        onClick={interactive && photos.length > 0 ? () => setLightbox(true) : undefined}
      />

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div style={{ display: "flex", gap: 6, padding: `${u * 0.5}px ${u}px`, background: t.surface, overflowX: "auto" }}>
          {thumbs.map((src, i) => (
            <button
              key={i}
              onClick={() => setActivePhoto(i)}
              style={{
                all: "unset", cursor: "pointer",
                width: 60, height: 60, flexShrink: 0,
                borderRadius: t.radius * 0.6,
                overflow: "hidden",
                border: i === activePhoto ? `2px solid ${t.accent}` : `2px solid transparent`,
              }}
            >
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: `${u}px`, maxWidth: 640, margin: "0 auto" }}>
        {/* Price */}
        <div style={{ fontFamily: t.display, fontSize: 28, fontWeight: 700, color: t.ink }}>
          {fmtPrice(obj.price)}
        </div>
        {perM2(obj.price, obj.area) && (
          <div style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{perM2(obj.price, obj.area)}</div>
        )}

        {/* Address */}
        {(obj.district || obj.street) && (
          <div style={{ fontSize: 14, color: t.muted, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            {[obj.district, obj.street].filter(Boolean).join(", ")}
          </div>
        )}

        {/* Spec grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginTop: u }}>
          {spec.map((s) => (
            <div key={s.label} style={{
              background: t.surface, borderRadius: t.radius * 0.7,
              border: `1px solid ${t.border}`,
              padding: `${u * 0.6}px`, textAlign: "center",
            }}>
              <div style={{ fontFamily: t.display, fontSize: 18, fontWeight: 600, color: t.ink }}>{s.value}</div>
              <div style={{ fontSize: 11, color: t.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        {obj.features && obj.features.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: u }}>
            {obj.features.map((f) => (
              <span key={f} style={{
                fontSize: 13, padding: "4px 12px",
                borderRadius: 20, background: t.softAccent,
                color: t.accent, border: `1px solid ${t.border}`,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                ✓ {f}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        <div style={{ marginTop: u }}>
          {obj.description ? (
            <p style={{ fontSize: 15, lineHeight: 1.7, color: t.ink, margin: 0 }}>{obj.description}</p>
          ) : (
            <p style={{ fontSize: 14, color: t.muted, fontStyle: "italic", margin: 0 }}>Описание не добавлено</p>
          )}
        </div>

        {/* Mortgage */}
        {obj.mortgage && (
          <div style={{ marginTop: u }}>
            <MortgageBlock data={obj.mortgage} theme={t} />
          </div>
        )}

        {/* Spacer for fixed CTA */}
        {showContacts && <div style={{ height: 80 }} />}
      </div>

      {/* Fixed CTA */}
      {showContacts && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          maxWidth: 720, margin: "0 auto",
          background: t.surface, borderTop: `1px solid ${t.border}`,
          padding: `${u * 0.6}px ${u}px`,
          display: "flex", gap: 8,
        }}>
          <a href={`tel:${r.phone}`} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: t.bg, border: `1px solid ${t.border}`,
            color: t.ink, textDecoration: "none",
            padding: "12px", borderRadius: t.radius, fontSize: 15, fontWeight: 500,
          }}>
            Позвонить
          </a>
          {r.telegram && (
            <a href={`https://t.me/${r.telegram}`} target="_blank" rel="noreferrer" style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: t.accent, color: "#fff",
              textDecoration: "none",
              padding: "12px", borderRadius: t.radius, fontSize: 15, fontWeight: 500,
            }}>
              Написать
            </a>
          )}
        </div>
      )}

      {/* Lightbox */}
      {interactive && lightbox && photos.length > 0 && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <img
            src={photos[activePhoto]}
            alt=""
            style={{ maxWidth: "95vw", maxHeight: "90vh", objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActivePhoto((activePhoto - 1 + photos.length) % photos.length); }}
                style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: "50%", width: 44, height: 44, fontSize: 20, cursor: "pointer" }}
              >‹</button>
              <button
                onClick={(e) => { e.stopPropagation(); setActivePhoto((activePhoto + 1) % photos.length); }}
                style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: "50%", width: 44, height: 44, fontSize: 20, cursor: "pointer" }}
              >›</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
