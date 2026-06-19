import React from "react";
import type { MortgageBlock as MortgageData, Theme } from "../../schema/types.js";
import { fmtPrice } from "./format.js";

interface Props {
  data: MortgageData;
  theme: Theme;
}

export function MortgageBlock({ data: d, theme: t }: Props) {
  const hasContent = d.promoRate || d.downPayment || (d.options && d.options.length > 0) || d.delivery;
  if (!hasContent) return null;

  return (
    <div style={{
      border: `1px solid ${t.border}`,
      borderRadius: t.radius,
      overflow: "hidden",
      fontFamily: t.body,
    }}>
      {d.promoRate && (
        <div style={{
          background: t.accent, color: "#fff",
          padding: `${t.unit * 0.6}px ${t.unit}px`,
        }}>
          <div style={{ fontSize: 13, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Ипотека от
          </div>
          <div style={{ fontFamily: t.display, fontSize: 28, fontWeight: 700 }}>
            {d.promoRate}%
          </div>
          {d.delivery && (
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{d.delivery}</div>
          )}
        </div>
      )}

      <div style={{ padding: `${t.unit * 0.8}px ${t.unit}px` }}>
        {d.downPayment !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: t.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Первый взнос
            </span>
            <span style={{ fontFamily: t.display, fontSize: 18, fontWeight: 600, color: t.ink }}>
              {fmtPrice(d.downPayment)}
            </span>
          </div>
        )}

        {d.options && d.options.map((opt, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between",
            padding: `${t.unit * 0.4}px 0`,
            borderTop: i === 0 ? `1px solid ${t.border}` : undefined,
          }}>
            <span style={{ fontSize: 13, color: t.muted }}>{opt.label}</span>
            <span style={{ fontFamily: t.display, fontSize: 16, fontWeight: 600, color: t.ink }}>
              {fmtPrice(opt.payment)}/мес
            </span>
          </div>
        ))}
      </div>

      {d.deadline && (
        <div style={{
          background: t.softAccent,
          padding: `${t.unit * 0.5}px ${t.unit}px`,
          fontSize: 12, color: t.accent,
          fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Только до {d.deadline}
        </div>
      )}
    </div>
  );
}
