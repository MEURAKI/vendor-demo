// app/api/products/variants-bulk-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

/* ---------- Supabase server client ---------- */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// SERVICE KEY – server-side only
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Node runtime
export const runtime = "nodejs";

/* ---------- Types ---------- */

type CsvMappingKey =
  | "productBaseSku"
  | "variantSku"
  | "price"
  | "inventory"
  | "optionSize"
  | "optionColor"
  | "optionVolume"
  | "optionWeight"
  | "customOption"; // generic custom column (e.g. "Custom: Material")

type Mapping = Record<CsvMappingKey, string>;

type VariantRow = {
  productBaseSku: string;
  variantSku: string;
  priceNumber: number | null;
  inventoryNumber: number | null;
  size: string | null;
  color: string | null;
  volume: string | null;
  weight: string | null;
  customValue: string | null;
};

type ProductRecord = {
  id: string;
  base_sku: string;
  vendor_id: string;
};

type ProductOptionGroup = {
  id: string;
  product_id: string;
  name: string;
  kind: "size" | "color" | "volume" | "weight" | "custom";
};

/* ---------- Helpers ---------- */

function getMappedValue(
  row: Record<string, string>,
  mapping: Partial<Mapping>,
  key: CsvMappingKey
): string {
  const headerName = mapping[key];
  if (!headerName) return "";
  return (row[headerName] ?? "").trim();
}

// derive the custom group name from the header, e.g. "Custom: Material" -> "Material"
function deriveCustomGroupName(
  header: string | undefined | null
): string | null {
  if (!header) return null;
  const cleaned = header.replace(/^Custom[:\s-]*/i, "").trim();
  return cleaned || header.trim() || null;
}

/* ---------- POST handler ---------- */

export async function POST(req: NextRequest) {
  try {
    /* 0) Auth – get vendor_id from Bearer token */
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization token" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const vendorId = user.id;

    /* 1) Read file + mapping */

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingJson = formData.get("mapping") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "CSV file is required" },
        { status: 400 }
      );
    }

    if (!mappingJson) {
      return NextResponse.json(
        { error: "Column mapping is required" },
        { status: 400 }
      );
    }

    const mapping = JSON.parse(mappingJson || "{}") as Partial<Mapping>;

    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      );
    }

    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    if (!records.length) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    // figure out which option columns were actually mapped
    const hasSizeColumn = !!mapping.optionSize;
    const hasColorColumn = !!mapping.optionColor;
    const hasVolumeColumn = !!mapping.optionVolume;
    const hasWeightColumn = !!mapping.optionWeight;
    const hasCustomColumn = !!mapping.customOption;

    // only derive name if custom column is mapped
    const customGroupName = hasCustomColumn
      ? deriveCustomGroupName(mapping.customOption) ?? "Custom Option"
      : null;

    /* 2) Normalize CSV rows into VariantRow[] */

    const rows: VariantRow[] = [];

    records.forEach((row, index) => {
      const rowNumber = index + 2;

      const productBaseSku = getMappedValue(row, mapping, "productBaseSku");
      const variantSku = getMappedValue(row, mapping, "variantSku");
      const priceRaw = getMappedValue(row, mapping, "price");
      const inventoryRaw = getMappedValue(row, mapping, "inventory");

      const size =
        hasSizeColumn ? getMappedValue(row, mapping, "optionSize") || null : null;
      const color =
        hasColorColumn ? getMappedValue(row, mapping, "optionColor") || null : null;
      const volume =
        hasVolumeColumn ? getMappedValue(row, mapping, "optionVolume") || null : null;
      const weight =
        hasWeightColumn ? getMappedValue(row, mapping, "optionWeight") || null : null;
      const customValue =
        hasCustomColumn ? getMappedValue(row, mapping, "customOption") || null : null;

      if (!productBaseSku || !variantSku) {
        console.warn(
          `Skipping row ${rowNumber} – missing productBaseSku or variantSku`,
          { productBaseSku, variantSku }
        );
        return;
      }

      const priceNumber = priceRaw ? Number(priceRaw) : NaN;
      const inventoryNumber = inventoryRaw ? Number(inventoryRaw) : NaN;

      rows.push({
        productBaseSku,
        variantSku,
        priceNumber: Number.isNaN(priceNumber) ? null : priceNumber,
        inventoryNumber: Number.isNaN(inventoryNumber) ? null : inventoryNumber,
        size,
        color,
        volume,
        weight,
        customValue,
      });
    });

    if (!rows.length) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    /* 3) Load all parent products by base_sku for this vendor */

    const productBaseSkus = Array.from(
      new Set(rows.map((r) => r.productBaseSku))
    );

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, base_sku, vendor_id, is_variant")
      .in("base_sku", productBaseSkus)
      .eq("vendor_id", vendorId);

    if (productsError) {
      console.error("Error loading products:", productsError);
      return NextResponse.json(
        { error: "Failed to load products", details: productsError.message },
        { status: 500 }
      );
    }

    const productByBaseSku = new Map<string, ProductRecord>();
    (products ?? []).forEach((p: any) => {
      productByBaseSku.set(p.base_sku, p as ProductRecord);
    });

    /* 4) Prepare per-product buckets (variants + option values) */

    type PerProductData = {
      product: ProductRecord;
      variants: VariantRow[];
      sizes: Set<string>;
      colors: Set<string>;
      volumes: Set<string>;
      weights: Set<string>;
      customValues: Set<string>;
    };

    const perProduct = new Map<string, PerProductData>();

    for (const row of rows) {
      const parent = productByBaseSku.get(row.productBaseSku);
      if (!parent) {
        console.warn(
          `Skipping row – no product found for base_sku=${row.productBaseSku}`
        );
        continue;
      }

      if (!perProduct.has(parent.id)) {
        perProduct.set(parent.id, {
          product: parent,
          variants: [],
          sizes: new Set<string>(),
          colors: new Set<string>(),
          volumes: new Set<string>(),
          weights: new Set<string>(),
          customValues: new Set<string>(),
        });
      }

      const entry = perProduct.get(parent.id)!;
      entry.variants.push(row);

      if (hasSizeColumn && row.size) entry.sizes.add(row.size);
      if (hasColorColumn && row.color) entry.colors.add(row.color);
      if (hasVolumeColumn && row.volume) entry.volumes.add(row.volume);
      if (hasWeightColumn && row.weight) entry.weights.add(row.weight);
      if (hasCustomColumn && row.customValue) entry.customValues.add(row.customValue);
    }

    if (!perProduct.size) {
      return NextResponse.json(
        { error: "No variants mapped to existing products" },
        { status: 400 }
      );
    }

    /* 4b) Mark parent products as variant-type */

    const productIdsToMarkVariant = Array.from(perProduct.keys());

    if (productIdsToMarkVariant.length) {
      const { error: markError } = await supabase
        .from("products")
        .update({
          is_variant: true,
          price_cents: null,
          inventory_qty: null,
        })
        .in("id", productIdsToMarkVariant);

      if (markError) {
        console.error("Error updating parent products:", markError);
        return NextResponse.json(
          {
            error: "Failed to update parent products as variant-type",
            details: markError.message,
          },
          { status: 500 }
        );
      }
    }

    /* 5) For each product, ensure option groups exist only for mapped columns */

    const allInsertedVariants: any[] = [];

    for (const [, entry] of perProduct) {
      const {
        product,
        variants,
        sizes,
        colors,
        volumes,
        weights,
        customValues,
      } = entry;

      // Load existing option groups for this product
      const { data: existingGroups, error: groupsError } = await supabase
        .from("product_option_groups")
        .select("id, name, kind")
        .eq("product_id", product.id);

      if (groupsError) {
        console.error("Error loading option groups:", groupsError);
        return NextResponse.json(
          {
            error: "Failed to load option groups",
            details: groupsError.message,
          },
          { status: 500 }
        );
      }

      const groupByKind = new Map<string, ProductOptionGroup>();
      (existingGroups ?? []).forEach((g: any) => {
        groupByKind.set(g.kind, g as ProductOptionGroup);
      });

      const groupsToInsert: {
        product_id: string;
        name: string;
        kind: "size" | "color" | "volume" | "weight" | "custom";
        position: number;
      }[] = [];

      const needSizeGroup =
        hasSizeColumn && sizes.size > 0 && !groupByKind.get("size");
      const needColorGroup =
        hasColorColumn && colors.size > 0 && !groupByKind.get("color");
      const needVolumeGroup =
        hasVolumeColumn && volumes.size > 0 && !groupByKind.get("volume");
      const needWeightGroup =
        hasWeightColumn && weights.size > 0 && !groupByKind.get("weight");
      const needCustomGroup =
        hasCustomColumn &&
        !!customGroupName &&
        customValues.size > 0 &&
        !groupByKind.get("custom");

      let pos = 0;
      if (needSizeGroup) {
        groupsToInsert.push({
          product_id: product.id,
          name: "Size",
          kind: "size",
          position: pos++,
        });
      }
      if (needColorGroup) {
        groupsToInsert.push({
          product_id: product.id,
          name: "Color",
          kind: "color",
          position: pos++,
        });
      }
      if (needVolumeGroup) {
        groupsToInsert.push({
          product_id: product.id,
          name: "Volume",
          kind: "volume",
          position: pos++,
        });
      }
      if (needWeightGroup) {
        groupsToInsert.push({
          product_id: product.id,
          name: "Weight",
          kind: "weight",
          position: pos++,
        });
      }
      if (needCustomGroup && customGroupName) {
        groupsToInsert.push({
          product_id: product.id,
          name: customGroupName,
          kind: "custom",
          position: pos++,
        });
      }

      if (groupsToInsert.length) {
        const { data: newGroups, error: insertGroupsError } = await supabase
          .from("product_option_groups")
          .insert(groupsToInsert)
          .select();

        if (insertGroupsError) {
          console.error("Error inserting option groups:", insertGroupsError);
          return NextResponse.json(
            {
              error: "Failed to create option groups",
              details: insertGroupsError.message,
            },
            { status: 500 }
          );
        }

        (newGroups ?? []).forEach((g: any) => {
          groupByKind.set(g.kind, g as ProductOptionGroup);
        });
      }

      const sizeGroup =
        hasSizeColumn && sizes.size ? groupByKind.get("size") : undefined;
      const colorGroup =
        hasColorColumn && colors.size ? groupByKind.get("color") : undefined;
      const volumeGroup =
        hasVolumeColumn && volumes.size ? groupByKind.get("volume") : undefined;
      const weightGroup =
        hasWeightColumn && weights.size ? groupByKind.get("weight") : undefined;
      const customGroup =
        hasCustomColumn &&
        customGroupName &&
        customValues.size
          ? groupByKind.get("custom")
          : undefined;

      /* 6) Create option values for each group (only for mapped columns) */

      const valueRows: {
        group_id: string;
        label: string;
        position: number;
        color_hex: string | null;
      }[] = [];

      if (sizeGroup) {
        Array.from(sizes).forEach((label, idx) => {
          valueRows.push({
            group_id: sizeGroup.id,
            label,
            position: idx,
            color_hex: null,
          });
        });
      }

      if (colorGroup) {
        Array.from(colors).forEach((label, idx) => {
          valueRows.push({
            group_id: colorGroup.id,
            label,
            position: idx,
            color_hex: null,
          });
        });
      }

      if (volumeGroup) {
        Array.from(volumes).forEach((label, idx) => {
          valueRows.push({
            group_id: volumeGroup.id,
            label,
            position: idx,
            color_hex: null,
          });
        });
      }

      if (weightGroup) {
        Array.from(weights).forEach((label, idx) => {
          valueRows.push({
            group_id: weightGroup.id,
            label,
            position: idx,
            color_hex: null,
          });
        });
      }

      if (customGroup) {
        Array.from(customValues).forEach((label, idx) => {
          valueRows.push({
            group_id: customGroup.id,
            label,
            position: idx,
            color_hex: null,
          });
        });
      }

      const valueIdByKey = new Map<string, string>(); // "groupId:label" -> valueId

      if (valueRows.length) {
        const groupIdsToCheck = [
          sizeGroup?.id,
          colorGroup?.id,
          volumeGroup?.id,
          weightGroup?.id,
          customGroup?.id,
        ].filter(Boolean) as string[];

        if (groupIdsToCheck.length) {
          const { data: existingValues, error: existingValuesError } =
            await supabase
              .from("product_option_values")
              .select("id, group_id, label")
              .in("group_id", groupIdsToCheck);

          if (existingValuesError) {
            console.error("Error loading option values:", existingValuesError);
            return NextResponse.json(
              {
                error: "Failed to load option values",
                details: existingValuesError.message,
              },
              { status: 500 }
            );
          }

          (existingValues ?? []).forEach((v: any) => {
            valueIdByKey.set(`${v.group_id}:${v.label}`, v.id);
          });
        }

        const toInsert = valueRows.filter(
          (v) => !valueIdByKey.get(`${v.group_id}:${v.label}`)
        );

        if (toInsert.length) {
          const { data: insertedValues, error: insertValuesError } =
            await supabase
              .from("product_option_values")
              .insert(toInsert)
              .select();

          if (insertValuesError) {
            console.error(
              "Error inserting option values:",
              insertValuesError
            );
            return NextResponse.json(
              {
                error: "Failed to create option values",
                details: insertValuesError.message,
              },
              { status: 500 }
            );
          }

          (insertedValues ?? []).forEach((v: any) => {
            valueIdByKey.set(`${v.group_id}:${v.label}`, v.id);
          });
        }
      }

      /* 7) Insert variants for this product */

      const variantInserts = variants.map((r, idx) => {
        const priceCents =
          r.priceNumber != null ? Math.round(r.priceNumber * 100) : null;
        const inventoryQty =
          r.inventoryNumber != null ? Math.round(r.inventoryNumber) : 0;

        const optionsJson: Record<string, string> = {};

        if (hasSizeColumn && r.size) optionsJson["Size"] = r.size;
        if (hasColorColumn && r.color) optionsJson["Color"] = r.color;
        if (hasVolumeColumn && r.volume) optionsJson["Volume"] = r.volume;
        if (hasWeightColumn && r.weight) optionsJson["Weight"] = r.weight;
        if (
          hasCustomColumn &&
          customGroupName &&
          r.customValue
        ) {
          optionsJson[customGroupName] = r.customValue;
        }

        return {
          product_id: product.id,
          sku: r.variantSku,
          price_cents: priceCents,
          inventory_qty: inventoryQty,
          image_url: null,
          position: idx,
          is_active: inventoryQty > 0,
          options_json: optionsJson,
        };
      });

      const { data: insertedVariants, error: insertVariantsError } =
        await supabase
          .from("product_variants")
          .insert(variantInserts)
          .select();

      if (insertVariantsError) {
        console.error("Error inserting variants:", insertVariantsError);
        return NextResponse.json(
          {
            error: "Failed to insert variants",
            details: insertVariantsError.message,
          },
          { status: 500 }
        );
      }

      allInsertedVariants.push(...(insertedVariants ?? []));

      /* 8) Link variant → option value (variant_option_values) */

      const vovRows: { variant_id: string; value_id: string }[] = [];

      (insertedVariants ?? []).forEach((v: any, idx: number) => {
        const r = variants[idx];

        if (sizeGroup && hasSizeColumn && r.size) {
          const valId = valueIdByKey.get(`${sizeGroup.id}:${r.size}`);
          if (valId) vovRows.push({ variant_id: v.id, value_id: valId });
        }

        if (colorGroup && hasColorColumn && r.color) {
          const valId = valueIdByKey.get(`${colorGroup.id}:${r.color}`);
          if (valId) vovRows.push({ variant_id: v.id, value_id: valId });
        }

        if (volumeGroup && hasVolumeColumn && r.volume) {
          const valId = valueIdByKey.get(`${volumeGroup.id}:${r.volume}`);
          if (valId) vovRows.push({ variant_id: v.id, value_id: valId });
        }

        if (weightGroup && hasWeightColumn && r.weight) {
          const valId = valueIdByKey.get(`${weightGroup.id}:${r.weight}`);
          if (valId) vovRows.push({ variant_id: v.id, value_id: valId });
        }

        if (customGroup && hasCustomColumn && r.customValue) {
          const valId = valueIdByKey.get(`${customGroup.id}:${r.customValue}`);
          if (valId) vovRows.push({ variant_id: v.id, value_id: valId });
        }
      });

      if (vovRows.length) {
        const { error: vovError } = await supabase
          .from("variant_option_values")
          .insert(vovRows);

        if (vovError) {
          console.error("Error inserting variant_option_values:", vovError);
          // not fatal – variants already exist
        }
      }
    }

    return NextResponse.json({
      ok: true,
      insertedVariantCount: allInsertedVariants.length,
      variants: allInsertedVariants,
    });
  } catch (err: any) {
    console.error("Variants bulk upload error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: err?.message },
      { status: 500 }
    );
  }
}