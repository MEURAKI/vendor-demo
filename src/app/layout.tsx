// app/layout.tsx
import "../styles/globals.css"; // <— your global styles
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meuraki Vendor Portal",
  description: "Vendor portal authentication",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
