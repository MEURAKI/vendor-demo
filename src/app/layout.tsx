import "../styles/globals.css";
import { Poppins } from "next/font/google";
import { ToastProvider } from "../components/toast/ToastProvider";
import RootClient from "./RootClient";   // <-- add this

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400","500","600","700","800"],
  display: "swap",
  variable: "--font-poppins",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable}`}>
      <body className="font-poppins">
        <ToastProvider>
          <RootClient>      {/* 🔥 wrap EVERYTHING in the auth wrapper */}
            {children}
          </RootClient>
        </ToastProvider>
      </body>
    </html>
  );
}