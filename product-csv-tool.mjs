// transform-products.mjs
//
// Usage:
//   node transform-products.mjs Singles.csv Variants.csv
//
// Output:
//   products-out.csv
//   variants-out.csv

import fs from "fs/promises";
import { parse } from "csv-parse/sync";

// ---------- CSV helpers ----------

function parseCsv(text) {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function toCsv(rows) {
  if (!rows || rows.length === 0) return "";

  const headers = Object.keys(rows[0]);

  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");
}

function toNumberOrNull(value) {
  if (!value) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function getField(row, headerName) {
  if (!headerName) return "";
  return (row[headerName] ?? "").trim();
}

// ---------- MAPPINGS (EDIT THESE FOR YOUR SHEETS) ----------

// For Singles.csv
// Example headers (adjust to your file):
// ProductUniqueCode,SKU,Name,Type,Category,Wellness,Price,Inventory,Description,Tags,Dimensions
const productMapping = {
  id: "ProductUniqueCode",      // we treat this as product_id
  sku: "SKU",                   // base SKU
  name: "Name",
  type: "Type",                 // Single / Variant
  category: "Category",
  wellness: "Wellness",
  price: "Price",
  inventory: "Inventory",
  description: "Description",
  tags: "Tags",
  dimensions: "Dimensions",
};

// For Variants.csv
// Example headers (adjust to your file):
// ParentProductCode,VariantSKU,Price,Quantity,Size,Color
const variantMapping = {
  parentId: "ParentProductCode", // must match productMapping.id value
  variantSku: "VariantSKU",
  price: "Price",
  quantity: "Quantity",
  optionSize: "Size",
  optionColor: "Color",
};

// ---------- TRANSFORM: Singles → products-out.csv ----------
//
// Output columns:
//   product_id, sku, dimensions, category, description, tags, base_price
//

function transformProducts(records) {
  return records.map((row, index) => {
    const rowNumber = index + 2;

    const productId = getField(row, productMapping.id);
    const sku = getField(row, productMapping.sku);
    const name = getField(row, productMapping.name);
    const description = getField(row, productMapping.description);
    const category = getField(row, productMapping.category);
    const tagsRaw = getField(row, productMapping.tags);
    const dimensionsRaw = getField(row, productMapping.dimensions);
    const priceNumber = toNumberOrNull(getField(row, productMapping.price));

    if (!productId || !sku) {
      console.warn(
        `[Products] Row ${rowNumber} missing ID or SKU – will still be exported but check values`,
        { productId, sku }
      );
    }

    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .join("|")
      : "";

    const basePrice =
      priceNumber == null ? "" : priceNumber.toFixed(2);

    return {
      product_id: productId,
      sku,
      name,
      dimensions: dimensionsRaw,
      category,
      description,
      tags,
      base_price: basePrice,
    };
  });
}

// ---------- TRANSFORM: Variants → variants-out.csv ----------
//
// Output columns:
//   variant_sku, parent_product_id, base_price, quantity, option_size, option_color
//

function transformVariants(records) {
  return records.map((row, index) => {
    const rowNumber = index + 2;

    const parentId = getField(row, variantMapping.parentId);
    const variantSku = getField(row, variantMapping.variantSku);
    const priceNumber = toNumberOrNull(getField(row, variantMapping.price));
    const quantityNumber = toNumberOrNull(getField(row, variantMapping.quantity));
    const size = getField(row, variantMapping.optionSize);
    const color = getField(row, variantMapping.optionColor);

    if (!parentId || !variantSku) {
      console.warn(
        `[Variants] Row ${rowNumber} missing parentId or variantSku – will still be exported but check values`,
        { parentId, variantSku }
      );
    }

    const basePrice =
      priceNumber == null ? "" : priceNumber.toFixed(2);

    return {
      variant_sku: variantSku,
      parent_product_id: parentId,
      base_price: basePrice,
      quantity: quantityNumber == null ? "" : quantityNumber,
      option_size: size,
      option_color: color,
    };
  });
}

// ---------- MAIN ----------

async function main() {
  const [, , singlesPath, variantsPath] = process.argv;

  if (!singlesPath || !variantsPath) {
    console.log(
      "Usage:\n" +
        "  node transform-products.mjs Singles.csv Variants.csv\n\n" +
        "Produces:\n" +
        "  products-out.csv\n" +
        "  variants-out.csv\n"
    );
    process.exit(1);
  }

  // 1) Load Singles.csv
  const singlesText = await fs.readFile(singlesPath, "utf8");
  const singlesRecords = parseCsv(singlesText);

  // 2) Load Variants.csv
  const variantsText = await fs.readFile(variantsPath, "utf8");
  const variantsRecords = parseCsv(variantsText);

  // 3) Transform
  const productsOut = transformProducts(singlesRecords);
  const variantsOut = transformVariants(variantsRecords);

  // 4) Export
  const productsCsv = toCsv(productsOut);
  const variantsCsv = toCsv(variantsOut);

  await fs.writeFile("products-out.csv", productsCsv, "utf8");
  await fs.writeFile("variants-out.csv", variantsCsv, "utf8");

  console.log(
    `Done.\n  products-out.csv rows:  ${productsOut.length}\n  variants-out.csv rows:  ${variantsOut.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});