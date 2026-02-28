export type Product = {
  id: string;
  title: string;
  description: string;
  priceUsd: number;
  imageUrl: string;
};

export type PaymentMethod = "debit" | "credit" | "upi";
