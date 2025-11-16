// types/bundles.ts
export type BundleCandidateItem = {
  id: string;        // variant id
  productId?: string;
  name: string;
  sku: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
};

export type BundleProductPickerValue = {
  items: BundleCandidateItem[];
};