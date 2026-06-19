import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import yaml from "js-yaml";

import type { RealObject, Realtor, Theme } from "../../schema/types.js";
import { PropertyCard, ObjectPage, Visitka, makeResolvePhoto } from "../../packages/render/index.js";
import { shell } from "./templates/shell.js";

// ── paths ─────────────────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, "../..");
const CONTENT = join(ROOT, "content");
const DIST = join(ROOT, "dist");
const BASE = process.env.BASE ?? "";

// ── load content ──────────────────────────────────────────────────────────────
const realtor = yaml.load(readFileSync(join(CONTENT, "realtor.yaml"), "utf8")) as Realtor;
const theme = JSON.parse(readFileSync(join(CONTENT, "theme.json"), "utf8")) as Theme;

const objectsDir = join(CONTENT, "objects");
const objects: RealObject[] = readdirSync(objectsDir)
  .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
  .map((f) => yaml.load(readFileSync(join(objectsDir, f), "utf8")) as RealObject)
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const active = objects.filter((o) => o.status === "active");

console.log(`📦 Объектов: ${objects.length} (${active.length} активных)`);
console.log(`🌐 BASE: "${BASE || "/"} "`);

// ── resolvePhoto ──────────────────────────────────────────────────────────────
const resolvePhoto = makeResolvePhoto({ base: `${BASE}/assets` });

// ── ensure dist ───────────────────────────────────────────────────────────────
mkdirSync(DIST, { recursive: true });
mkdirSync(join(DIST, "objects"), { recursive: true });

// ── copy assets ───────────────────────────────────────────────────────────────
const assetsDir = join(CONTENT, "assets");
if (existsSync(assetsDir)) {
  cpSync(assetsDir, join(DIST, "assets"), { recursive: true });
}
const publicDir = join(import.meta.dirname, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, DIST, { recursive: true });
}

// ── index page ────────────────────────────────────────────────────────────────
const indexBody = renderToStaticMarkup(
  React.createElement("div", null,
    React.createElement("div", {
      style: { maxWidth: 720, margin: "0 auto", padding: "20px 16px" }
    },
      React.createElement(Visitka, { realtor, theme, resolvePhoto }),
      React.createElement("div", { style: { height: 24 } }),

      // filters hint
      active.length === 0 && React.createElement("p", {
        style: { textAlign: "center", color: theme.muted, fontFamily: theme.body }
      }, "Объектов пока нет"),

      // grid
      React.createElement("div", {
        style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }
      },
        ...objects.map((obj) =>
          React.createElement(PropertyCard, {
            key: obj.id,
            obj,
            theme,
            resolvePhoto,
            href: `${BASE}/objects/${obj.id}/`,
          })
        )
      )
    )
  )
);

writeFileSync(
  join(DIST, "index.html"),
  shell({ title: realtor.name, body: indexBody, theme, base: BASE })
);

// ── object pages ──────────────────────────────────────────────────────────────
for (const obj of objects) {
  const dir = join(DIST, "objects", obj.id);
  mkdirSync(dir, { recursive: true });

  const body = renderToStaticMarkup(
    React.createElement(ObjectPage, {
      obj,
      realtor,
      theme,
      resolvePhoto,
      showContacts: true,
      interactive: false,
      backHref: `${BASE}/`,
    })
  );

  writeFileSync(
    join(dir, "index.html"),
    shell({ title: `${obj.title} — ${realtor.name}`, body, theme, base: BASE })
  );
}

// ── objects.json for client-side filtering ───────────────────────────────────
const listing = objects.map((o) => ({
  id: o.id,
  type: o.type,
  status: o.status,
  price: o.price,
  area: o.area,
  rooms: o.rooms,
  title: o.title,
  district: o.district,
}));
writeFileSync(join(DIST, "objects.json"), JSON.stringify(listing, null, 2));

console.log("✅ Сборка завершена →", DIST);
