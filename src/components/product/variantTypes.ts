// src/components/product/variantTypes.ts
export type OptionGroupKind = "size" | "volume" | "weight" | "color";

export type OptionValue = {
  id: string;
  label: string;
  colorHex?: string;
};

export type OptionGroup = {
  id: string;
  name: string;
  kind: OptionGroupKind | "custom";
  values: OptionValue[];
};

export type VariantRow = {
  id: string;
  sku: string;
  price: number;
  inventory: number;
  options: Record<string, string>;
};