import React, { useEffect, useRef, useState } from "react";
import { Loader2, Camera } from "lucide-react";
import type { Realtor, RealtorFact } from "../../../schema/types.js";
import { compressPhoto } from "./compressPhoto.js";
import { getInitData, haptic } from "./tg.js";
import { WORKER_URL, SITE_BASE, api } from "./api.js";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

export function ProfileForm({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [facts, setFacts] = useState<RealtorFact[]>([]);
  const [rest, setRest] = useState<Partial<Realtor>>({}); // прочие поля (vk, max, photo…)

  const [photoUrl, setPhotoUrl] = useState("");   // текущее превью
  const [newPhoto, setNewPhoto] = useState<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ realtor: Realtor }>("/api/profile/get")
      .then(({ realtor }) => {
        setName(realtor.name ?? "");
        setTagline(realtor.tagline ?? "");
        setPhone(realtor.phone ?? "");
        setTelegram(realtor.telegram ?? "");
        setWhatsapp(realtor.whatsapp ?? "");
        setFacts(realtor.facts ?? []);
        if (realtor.photo) setPhotoUrl(`${SITE_BASE}/assets/${realtor.photo}`);
        const { name: _n, tagline: _t, phone: _p, telegram: _tg, whatsapp: _w, facts: _f, ...other } = realtor;
        setRest(other);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function pickPhoto(files: FileList | null) {
    if (!files?.[0]) return;
    const c = await compressPhoto(files[0]);
    setNewPhoto(c.full);
    setPhotoUrl(c.previewUrl);
  }

  function setFact(i: number, patch: Partial<RealtorFact>) {
    setFacts((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }
  const addFact = () => setFacts((prev) => [...prev, { label: "", value: "" }]);
  const removeFact = (i: number) => setFacts((prev) => prev.filter((_, j) => j !== i));

  async function save() {
    if (!name.trim() || !phone.trim()) { setError("Имя и телефон обязательны"); return; }
    setSaving(true);
    setError("");
    try {
      const realtor: Realtor = {
        ...rest,
        name: name.trim(),
        tagline: tagline.trim() || undefined,
        phone: phone.trim(),
        telegram: telegram.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        facts: facts.filter((f) => f.label.trim() && f.value.trim()),
      };
      const fd = new FormData();
      fd.append("initData", getInitData());
      fd.append("profile", JSON.stringify(realtor));
      if (newPhoto) fd.append("photo", newPhoto, "realtor.webp");

      const res = await fetch(`${WORKER_URL}/api/profile/save`, { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      haptic("success");
      setDone(true);
    } catch (e) {
      haptic("error");
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="centered"><div className="centered-ic"><Loader2 size={40} className="spin" /></div><h3>Загрузка…</h3></div>;
  }

  if (done) {
    return (
      <div className="done">
        <div className="done-check">✅</div>
        <h2>Профиль обновлён!</h2>
        <p>Визитка на сайте обновится через пару минут</p>
        <button className="btn btn-primary" onClick={onDone}>← В меню</button>
      </div>
    );
  }

  return (
    <div className="screen" style={{ paddingBottom: 96 }}>
      <h2 className="screen-title">Моя визитка</h2>

      <div className="avatar-edit" onClick={() => fileRef.current?.click()}>
        {photoUrl
          ? <img src={photoUrl} alt="" className="avatar-img" />
          : <div className="avatar-ph">{(name || "?").slice(0, 1).toUpperCase()}</div>}
        <span className="avatar-cam"><Camera size={16} /></span>
      </div>
      <p className="avatar-hint">Нажмите на фото, чтобы изменить</p>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files)} />

      <Field label="Имя *"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ирина Чиндяева" /></Field>
      <Field label="Подпись"><input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Жильё в Оренбурге — под ключ" /></Field>
      <Field label="Телефон *"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79226251044" /></Field>
      <Field label="Telegram (без @)"><input value={telegram} onChange={(e) => setTelegram(e.target.value.replace(/^@/, ""))} placeholder="ira_chindyaeva" /></Field>
      <Field label="WhatsApp (необязательно)"><input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+79226251044" /></Field>

      <div className="section-title">Факты (цифры в визитке)</div>
      {facts.map((f, i) => (
        <div className="fact-row" key={i}>
          <input className="fact-val" value={f.value} onChange={(e) => setFact(i, { value: e.target.value })} placeholder="8 лет" />
          <input className="fact-lbl" value={f.label} onChange={(e) => setFact(i, { label: e.target.value })} placeholder="на рынке" />
          <button className="icon-btn danger" onClick={() => removeFact(i)}>×</button>
        </div>
      ))}
      <button className="btn btn-secondary" style={{ marginTop: 4 }} onClick={addFact}>+ Добавить факт</button>

      {error && <div className="alert" style={{ marginTop: 16 }}>{error}</div>}

      <div className="sticky-bar">
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? <><div className="spinner" /> Сохраняем…</> : "Сохранить визитку"}
        </button>
      </div>
    </div>
  );
}
