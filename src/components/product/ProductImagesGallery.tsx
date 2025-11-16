"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

export type ProductImage = {
  id: string;
  url: string;      // preview URL
  file?: File;      // original high-res file (optional – for upload to storage)
};

type Props = {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  maxImages?: number; // default = 6 (1 main + 5 more)
  title?: string;
};

function uuid() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function ProductImagesGallery({
  images,
  onChange,
  maxImages = 6,
  title = "Product Images",
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const mainImage = images[activeIndex];

  function handleAddClick() {
    fileInputRef.current?.click();
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files?.length) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) return;

    const slice = Array.from(files).slice(0, remainingSlots);

    const newImages: ProductImage[] = slice.map((file) => ({
      id: uuid(),
      url: URL.createObjectURL(file), // high-res preview
      file,
    }));

    const next = [...images, ...newImages];
    onChange(next);

    if (!mainImage && next.length > 0) {
      setActiveIndex(0);
    }
  }

  function handleDelete(id: string, index: number) {
    const next = images.filter((img) => img.id !== id);
    onChange(next);

    if (index === activeIndex) {
      setActiveIndex(0);
    } else if (index < activeIndex) {
      setActiveIndex((prev) => Math.max(0, prev - 1));
    }
  }

  return (
    <section className="rounded-2xl border border-[#ECECFB] bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
        {title}
      </h2>

      {/* Main image */}
      <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-200">
        {mainImage ? (
          <img
            src={mainImage.url}
            alt="Main product"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
            Upload a product image
          </div>
        )}
      </div>

      {/* Thumbnails row */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        {images.map((img, index) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={clsx(
              "relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border",
              activeIndex === index
                ? "border-black"
                : "border-dashed border-gray-300"
            )}
          >
            <img
              src={img.url}
              alt={`Product thumbnail ${index + 1}`}
              className="h-full w-full object-cover"
            />

            {/* Delete chip */}
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(img.id, index);
              }}
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] text-white"
            >
              ×
            </span>
          </button>
        ))}

        {/* Add button */}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={handleAddClick}
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-[#F7F7FB] text-2xl text-gray-500"
          >
            +
          </button>
        )}
      </div>

      {/* Hidden file input – accepts high-res images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      <p className="mt-2 text-[10px] text-gray-400">
        Upload up to {maxImages} high-resolution images. The first one will be
        used as the main product image.
      </p>
    </section>
  );
}