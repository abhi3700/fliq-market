export type Product = {
  id: string;
  title: string;
  description: string;
  priceUsd: number;
  imageUrl: string;
};

export const PaymentMethod = {
  Debit: "debit",
  Credit: "credit",
  Upi: "upi",
  Unifi: "unifi",
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
