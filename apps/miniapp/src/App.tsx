import React, { useState, useRef } from "react";
import { ObjectPage, makeResolvePhoto } from "@rieltorie/render";
import type { RealObject, Theme, Realtor } from "../../../schema/types.js";
import { compressPhoto } from "./compressPhoto.js";
import { detectLaunch } from "./verifyLaunch.js";

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? "https://rieltorie-worker.YOUR_SUBDOMAIN.workers.dev";

const DEFAULT_THEME: Theme = {
  name: "Классика",
  bg: "#f5f5f0", surface: "#ffffff", ink: "#1a1a1a",
  accent: "#1a3c5e", muted: "#6b7280", softAccent: "#e8eef4", border: "#e5e7eb",
  display: "'Fraunces', Georgia, serif",
  body: "'Inter', system-ui, sans-serif",
  radius: 12, unit: 20, ratio: "4/3",
};

const DEFAULT_REALTOR: Realtor = {
  name: "Риелтор",
  phone: "+70000000000",
};

type Screen = "form" | "preview" | "done";

interface PhotoEntry {
  key: string;
  previewUrl: string;
  full: Blob;
  thumb: Blob;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="row">{children}</div>;
}

export function App() {
  const [screen, setScreen] = useState<Screen>("form");
  const [publishing, setPublishing] = useState(false);
  const [doneUrl, setDoneUrl] = useState("");
  const [error, setError] = useState("");

  // form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState<RealObject["type"]>("apartment");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [rooms, setRooms] = useState("");
  const [floor, setFloor] = useState("");
  const [floors, setFloors] = useState("");
  const [year, setYear] = useState("");
  const [district, setDistrict] = useState("");
  const [street, setStreet] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState("");
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  const previewObj: RealObject = {
    id: "preview",
    title: title || "Название объекта",
    type,
    status: "active",
    price: Number(price) || 0,
    area: area ? Number(area) : undefined,
    rooms: rooms ? Number(rooms) : undefined,
    floor: floor ? Number(floor) : undefined,
    floors: floors ? Number(floors) : undefined,
    year: year ? Number(year) : undefined,
    district: district || undefined,
    street: street || undefined,
    description: description || undefined,
    features: features ? features.split("\n").map((s) => s.trim()).filter(Boolean) : undefined,
    photos: photos.map((p) => p.previewUrl),
    createdAt: new Date().toISOString().slice(0, 10),
  };

  const resolvePhoto = makeResolvePhoto({});

  async function handlePhotos(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const compressed = await compressPhoto(file);
      const key = `photo-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      setPhotos((prev) => [...prev, { key, previewUrl: compressed.previewUrl, full: compressed.full, thumb: compressed.thumb }]);
    }
  }

  async function publish() {
    setPublishing(true);
    setError("");
    try {
      const launch = detectLaunch();
      const id = `obj-${Date.now().toString(36)}`;
      const obj: RealObject = {
        ...previewObj,
        id,
        photos: photos.map((p) => p.key),
      };

      const fd = new FormData();
      fd.append("initData", launch.initData);
      fd.append("platform", launch.platform);
      fd.append("object", JSON.stringify(obj));
      for (const p of photos) {
        fd.append(`photo:${p.key}`, p.full, p.key);
        fd.append(`thumb:${p.key}`, p.thumb, p.key.replace(".webp", "-thumb.webp"));
      }

      const res = await fetch(`${WORKER_URL}/publish`, { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json() as { url: string };

      // poll until page is live (max 3 min)
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        try {
          const check = await fetch(json.url, { method: "HEAD" });
          if (check.ok) break;
        } catch { /* still building */ }
      }

      setDoneUrl(json.url);
      setScreen("done");
    } catch (e) {
      setError(String(e));
    } finally {
      setPublishing(false);
    }
  }

  if (screen === "done") {
    return (
      <div style={{ padding: 24, textAlign: "center", fontFamily: "system-ui" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ margin: "0 0 8px" }}>Объект опубликован!</h2>
        <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14 }}>
          Сайт обновился автоматически через GitHub Actions
        </p>
        <a href={doneUrl} target="_blank" rel="noreferrer" style={{
          display: "block", padding: "14px", background: "#1a3c5e", color: "#fff",
          borderRadius: 10, textDecoration: "none", fontWeight: 600, marginBottom: 12,
        }}>
          Открыть страницу объекта
        </a>
        <button onClick={() => setScreen("form")} className="btn btn-secondary">
          Добавить ещё один объект
        </button>
      </div>
    );
  }

  if (screen === "preview") {
    return (
      <div>
        <ObjectPage
          obj={previewObj}
          realtor={DEFAULT_REALTOR}
          theme={DEFAULT_THEME}
          resolvePhoto={(k) => k}
          showContacts={false}
          interactive={true}
          onBack={() => setScreen("form")}
        />
        <div style={{ padding: 16 }}>
          {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" onClick={publish} disabled={publishing}>
            {publishing ? <><div className="spinner" /> Публикуем...</> : "Опубликовать"}
          </button>
          <div style={{ height: 8 }} />
          <button className="btn btn-secondary" onClick={() => setScreen("form")}>
            ← Редактировать
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, paddingBottom: 100, fontFamily: "system-ui" }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>Новый объект</h2>

      <Field label="Название *">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2-комн. квартира на Ленина" />
      </Field>

      <Field label="Тип">
        <select value={type} onChange={(e) => setType(e.target.value as RealObject["type"])}>
          <option value="apartment">Квартира</option>
          <option value="house">Дом</option>
          <option value="land">Участок</option>
          <option value="commercial">Коммерция</option>
        </select>
      </Field>

      <Row>
        <Field label="Цена, ₽ *">
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="4500000" />
        </Field>
        <Field label="Площадь, м²">
          <input type="number" value={area} onChange={(e) => setArea(e.target.value)} placeholder="52" />
        </Field>
      </Row>

      <Row>
        <Field label="Комнат">
          <input type="number" value={rooms} onChange={(e) => setRooms(e.target.value)} placeholder="2" />
        </Field>
        <Field label="Год">
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2015" />
        </Field>
      </Row>

      <Row>
        <Field label="Этаж">
          <input type="number" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="5" />
        </Field>
        <Field label="Этажей в доме">
          <input type="number" value={floors} onChange={(e) => setFloors(e.target.value)} placeholder="9" />
        </Field>
      </Row>

      <Field label="Район">
        <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Центральный" />
      </Field>

      <Field label="Улица, дом">
        <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="ул. Ленина, 10" />
      </Field>

      <Field label="Описание">
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Светлая квартира с хорошим ремонтом..." />
      </Field>

      <Field label="Особенности (каждая с новой строки)">
        <textarea rows={3} value={features} onChange={(e) => setFeatures(e.target.value)} placeholder={"Ремонт\nБалкон\nПарковка"} />
      </Field>

      <div className="section-title">Фотографии</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        {photos.map((p, i) => (
          <div key={p.key} style={{ position: "relative", aspectRatio: "4/3" }}>
            <img src={p.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
            <button
              onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
              style={{
                position: "absolute", top: 4, right: 4,
                background: "rgba(0,0,0,0.6)", border: "none", color: "#fff",
                borderRadius: "50%", width: 24, height: 24, cursor: "pointer", fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            aspectRatio: "4/3", border: "2px dashed #d1d5db",
            borderRadius: 8, background: "#f9fafb",
            cursor: "pointer", color: "#9ca3af", fontSize: 24,
          }}
        >+</button>
      </div>
      <input
        ref={fileRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => handlePhotos(e.target.files)}
      />

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: 16, background: "#fff", borderTop: "1px solid #e5e7eb" }}>
        <button
          className="btn btn-primary"
          disabled={!title || !price}
          onClick={() => setScreen("preview")}
        >
          Предпросмотр →
        </button>
      </div>
    </div>
  );
}
