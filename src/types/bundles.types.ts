// types/bundles.ts
export type BundleCandidateItem = {
  id: string; // local row ID for the picker (can be same as variant/product id)
  kind: "variant" | "single";
  productId: string;
  name: string;
  sku: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
    variantCount: number;

};

export type BundleProductPickerValue = {
  items: BundleCandidateItem[];
};