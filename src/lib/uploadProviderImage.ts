// lib/uploadProviderImage.ts (client-side)
"use client";

import { supabase } from "./supabase/client";

export async function uploadProviderImage(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { data, error } = await supabase.storage
    .from("provider-images")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error || !data) {
    console.error("uploadProviderImage error", error);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("provider-images").getPublicUrl(data.path);

  return publicUrl;
}