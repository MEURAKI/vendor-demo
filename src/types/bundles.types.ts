// types/bundles.types.ts

export type BundleItemKind = "single" | "variant";

/**
 * Base candidate from product / inventory search.
 *
 * You can extend this to match your DB schema exactly,
 * but keep these keys as they are used by bundle pages.
 */
export type BundleCandidateItem = {
  /** UI/React key – can be inventoryId, variantId or productId */
  id: string;

  /** Parent product ID */
  productId: string;

  /** Variant ID (if you have variant table separately) */
  variantId?: string | null;

  /**
   * Inventory row ID – this is what you decrement on orders.
   * For fixed “3 black towels” it MUST be the black row.
   */
  inventoryId?: string | null;

  /** Human readable name (e.g. "Everyday Towel — Black") */
  name: string;

  /** Kind of item in the bundle */
  kind: BundleItemKind;

  /** Current available stock */
  stock: number;

  /** Price in cents */
  priceCents: number;

  /** For multi-choice variant product */
  variantCount?: number | null;
};