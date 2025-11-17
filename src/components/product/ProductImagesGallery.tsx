// components/product/ProductImagesGallery.tsx
"use client";

import { useRef } from "react";
import Image from "next/image";
import clsx from "clsx";

export type ProductImage = {
  id: string;
  url: string;           // preview or already-uploaded URL
  file?: File | null;    // used for upload on create/edit
};

type ProductImagesGalleryProps = {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  maxImages?: number; // we'll use 5 for gallery
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
  maxImages = 5,
}: ProductImagesGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canAddMore = images.length < maxImages;

  function handleFileSelect(fileList: FileList | null) {
    if (!fileList) return;

    const files = Array.from(fileList);
    const remainingSlots = maxImages - images.length;

    const filesToUse = files.slice(0, remainingSlots);

    const newImages = filesToUse.map((file) => ({
      id: uuid(),
      url: URL.createObjectURL(file),
      file,
    }));

    onChange([...images, ...newImages]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRemove(id: string) {
    onChange(images.filter((img) => img.id !== id));
  }

  return (
    <div className="space-y-3">
      {/* Thumbnails grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((img) => (
          <div
            key={img.id}
            className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
          >
            <Image
              src={img.url}
              alt="Product gallery image"
              width={300}
              height={300}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(img.id)}
              className={clsx(
                "absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white",
                "hover:bg-black"
              )}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Add tile */}
        {canAddMore && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 text-xs text-gray-500 hover:border-gray-400 hover:bg-gray-100"
          >
            + Add Image
          </button>
        )}
      </div>

      {/* Hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      <p className="text-[11px] text-gray-500">
        You can upload up to {maxImages} gallery images.
      </p>
    </div>
  );
}