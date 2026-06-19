import React, { useState } from "react";
import type { Theme } from "../../schema/types.js";

interface Props {
  src?: string;
  alt?: string;
  theme: Theme;
  ratio?: string;
  rounded?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function PhotoFrame({ src, alt = "", theme: t, ratio, rounded = true, onClick, children }: Props) {
  const [error, setError] = useState(false);
  const r = ratio ?? t.ratio;

  const container: React.CSSProperties = {
    position: "relative",
    aspectRatio: r,
    overflow: "hidden",
    borderRadius: rounded ? t.radius : 0,
    background: `linear-gradient(135deg, ${t.softAccent}, ${t.border})`,
    cursor: onClick ? "pointer" : undefined,
  };

  return (
    <div style={container} onClick={onClick}>
      {src && !error ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 8, color: t.muted, fontSize: 13,
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          Фото готовятся
        </div>
      )}
      {children}
    </div>
  );
}
