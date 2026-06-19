export interface Theme {
  name: string;
  bg: string;
  surface: string;
  ink: string;
  accent: string;
  muted: string;
  softAccent: string;
  border: string;
  display: string;
  body: string;
  radius: number;
  unit: number;
  ratio: string;
}

export interface RealtorFact {
  label: string;
  value: string;
}

export interface Realtor {
  name: string;
  tagline?: string;
  phone: string;
  telegram?: string;
  max?: string;
  vk?: string;
  whatsapp?: string;
  photo?: string;
  facts?: RealtorFact[];
}

export type ObjectType = "apartment" | "house" | "land" | "commercial";
export type ObjectStatus = "active" | "sold";

export interface MortgageOption {
  label: string;
  payment: number;
}

export interface MortgageBlock {
  promoRate?: number;
  downPayment?: number;
  delivery?: string;
  deadline?: string;
  options?: MortgageOption[];
}

export interface RealObject {
  id: string;
  title: string;
  type: ObjectType;
  status: ObjectStatus;
  price: number;
  area?: number;
  rooms?: number;
  floor?: number;
  floors?: number;
  year?: number;
  district?: string;
  street?: string;
  description?: string;
  features?: string[];
  photos: string[];
  mortgage?: MortgageBlock;
  createdAt: string;
}
