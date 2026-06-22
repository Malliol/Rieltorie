import React, { useState, useRef } from "react";
import { ObjectPage, makeResolvePhoto } from "@rieltorie/render";
import type { RealObject, Theme, Realtor } from "../../../schema/types.js";
import { compressPhoto } from "./compressPhoto.js";
import { getInitData, haptic } from "./tg.js";
import { WORKER_URL, SITE_BASE } from "./api.js";

const DEFAULT_THEME: Theme = {
  name: "Классика",
  bg: "#f5f5f0", surface: "#ffffff", ink: "#1a1a1a",
  accent: "#1a3c5e", muted: "#6b7280", softAccent: "#e8eef4", border: "#e5e7eb",
  display: "'Fraunces', Georgia, serif",
  body: "'Inter', system-ui, sans-serif",
  radius: 12, unit: 20, ratio: "4/3",
};

const DEFAULT_REALTOR: Realtor = { name: "Риелтор", phone: "+70000000000" };

interface PhotoEntry { key: string; previewUrl: string; full?: Blob; thumb?: Blob; existing?: boolean; }

const numStr = (n: number | undefined) => (n === undefined || n === null ? "" : String(n));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="row">{children}</div>;
}

export function PublishForm({ onDone, initial }: { onDone: () => void; initial?: RealObject }) {
  const isEdit = !!initial;
  const [step, setStep] = useState<"form" | "preview" | "done">("form");
  const [publishing, setPublishing] = useState(false);
  const [doneUrl, setDoneUrl] = useState("");
  const [error, setError] = useState("");

  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<RealObject["type"]>(initial?.type ?? "apartment");
  const [price, setPrice] = useState(numStr(initial?.price));
  const [area, setArea] = useState(numStr(initial?.area));
  const [rooms, setRooms] = useState(numStr(initial?.rooms));
  const [floor, setFloor] = useState(numStr(initial?.floor));
  const [floors, setFloors] = useState(numStr(initial?.floors));
  const [year, setYear] = useState(numStr(initial?.year));
  const [district, setDistrict] = useState(initial?.district ?? "");
  const [street, setStreet] = useState(initial?.street ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [features, setFeatures] = useState((initial?.features ?? []).join("\n"));
  const [photos, setPhotos] = useState<PhotoEntry[]>(
    (initial?.photos ?? []).map((key) => ({ key, previewUrl: `${SITE_BASE}/assets/${key}`, existing: true })),
  );
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
    createdAt: initial?.createdAt ?? new Date().toISOString().slice(0, 10),
  };

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
      const id = initial?.id ?? `obj-${Date.now().toString(36)}`;
      const obj: RealObject = { ...previewObj, id, photos: photos.map((p) => p.key) };

      const fd = new FormData();
      fd.append("initData", getInitData());
      fd.append("platform", "telegram");
      fd.append("object", JSON.stringify(obj));
      // загружаем только новые фото (у существующих нет блобов — они уже в репозитории)
      for (const p of photos) {
        if (p.full && p.thumb) {
          fd.append(`photo:${p.key}`, p.full, p.key);
          fd.append(`thumb:${p.key}`, p.thumb, p.key.replace(".webp", "-thumb.webp"));
        }
      }

      const res = await fetch(`${WORKER_URL}/publish`, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const json = await res.json() as { url: string };

      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        try { if ((await fetch(json.url, { method: "HEAD" })).ok) break; } catch { /* building */ }
      }

      haptic("success");
      setDoneUrl(json.url);
      setStep("done");
    } catch (e) {
      haptic("error");
      setError(String(e));
    } finally {
      setPublishing(false);
    }
  }

  if (step === "done") {
    return (
      <div className="done">
        <div className="done-check">✅</div>
        <h2>{isEdit ? "Объявление обновлено!" : "Объект опубликован!"}</h2>
        <p>Сайт обновится автоматически через пару минут</p>
        <a href={doneUrl} target="_blank" rel="noreferrer" className="btn btn-primary">Открыть страницу объекта</a>
        <div style={{ height: 10 }} />
        <button className="btn btn-secondary" onClick={onDone}>← В меню</button>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div>
        <ObjectPage
          obj={previewObj}
          realtor={DEFAULT_REALTOR}
          theme={DEFAULT_THEME}
          resolvePhoto={(k) => k}
          showContacts={false}
          interactive={true}
          onBack={() => setStep("form")}
        />
        <div style={{ padding: 16 }}>
          {error && <div className="alert">{error}</div>}
          <button className="btn btn-primary" onClick={publish} disabled={publishing}>
            {publishing ? <><div className="spinner" /> Сохраняем…</> : (isEdit ? "Сохранить изменения" : "Опубликовать")}
          </button>
          <div style={{ height: 8 }} />
          <button className="btn btn-secondary" onClick={() => setStep("form")}>← Редактировать</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ paddingBottom: 96 }}>
      <h2 className="screen-title">{isEdit ? "Редактировать объявление" : "Новый объект"}</h2>

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
        <Field label="Цена, ₽ *"><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="4500000" /></Field>
        <Field label="Площадь, м²"><input type="number" value={area} onChange={(e) => setArea(e.target.value)} placeholder="52" /></Field>
      </Row>
      <Row>
        <Field label="Комнат"><input type="number" value={rooms} onChange={(e) => setRooms(e.target.value)} placeholder="2" /></Field>
        <Field label="Год"><input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2015" /></Field>
      </Row>
      <Row>
        <Field label="Этаж"><input type="number" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="5" /></Field>
        <Field label="Этажей в доме"><input type="number" value={floors} onChange={(e) => setFloors(e.target.value)} placeholder="9" /></Field>
      </Row>

      <Field label="Район"><input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Центральный" /></Field>
      <Field label="Улица, дом"><input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="ул. Ленина, 10" /></Field>
      <Field label="Описание"><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Светлая квартира с хорошим ремонтом…" /></Field>
      <Field label="Особенности (каждая с новой строки)"><textarea rows={3} value={features} onChange={(e) => setFeatures(e.target.value)} placeholder={"Ремонт\nБалкон\nПарковка"} /></Field>

      <div className="section-title">Фотографии</div>
      <div className="photo-grid">
        {photos.map((p, i) => (
          <div key={p.key} className="photo-cell">
            <img src={p.previewUrl} alt="" />
            <button className="photo-del" onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button className="photo-add" onClick={() => fileRef.current?.click()}>+</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handlePhotos(e.target.files)} />

      <div className="sticky-bar">
        <button className="btn btn-primary" disabled={!title || !price} onClick={() => { haptic("light"); setStep("preview"); }}>
          Предпросмотр →
        </button>
      </div>
    </div>
  );
}
