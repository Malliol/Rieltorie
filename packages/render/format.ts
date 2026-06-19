import type { RealObject } from "../../schema/types.js";

export function fmtPrice(n: number): string {
  return n.toLocaleString("ru-RU") + " ₽";
}

export function perM2(price: number, area?: number): string | null {
  if (!area) return null;
  return fmtPrice(Math.round(price / area)) + "/м²";
}

export function roomsLabel(rooms?: number): string {
  if (!rooms || rooms === 0) return "Студия";
  return `${rooms}-комн.`;
}

export function specRail(obj: RealObject): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];

  if (obj.type === "land") {
    if (obj.area) items.push({ label: "Площадь", value: `${(obj.area / 100).toFixed(2)} га` });
  } else {
    items.push({ label: "Тип", value: roomsLabel(obj.rooms) });
    if (obj.area) items.push({ label: "Площадь", value: `${obj.area} м²` });
    if (obj.floor && obj.floors) items.push({ label: "Этаж", value: `${obj.floor}/${obj.floors}` });
    else if (obj.floors) items.push({ label: "Этажей", value: String(obj.floors) });
  }

  if (obj.year) items.push({ label: "Год", value: String(obj.year) });

  return items;
}
