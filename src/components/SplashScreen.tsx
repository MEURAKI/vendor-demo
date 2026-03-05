"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useVendorProfile } from "../context/VendorShellContext";

const bgVideos = ["/bg-1.mp4", "/bg-3.mp4", "/bg-4.mp4"];

export default function SplashScreen() {
  const { profile } = useVendorProfile();
  const [visible, setVisible] = useState(false);
  const [activeVideo, setActiveVideo] = useState(0);
  const [now, setNow] = useState(new Date());
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    try {
      const loginFlag = sessionStorage.getItem("vendor:showSplash");
      const alreadyShown = sessionStorage.getItem("vendor:splashShown");
      if (loginFlag || !alreadyShown) {
        if (loginFlag) sessionStorage.removeItem("vendor:showSplash");
        sessionStorage.setItem("vendor:splashShown", "1");
        setVisible(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  const firstName =
    profile?.full_name?.split(" ")[0] ||
    profile?.email?.split("@")[0] ||
    "there";

  const hour = now.getHours();
  const greeting = (() => {
    if (hour >= 5 && hour < 12) return `Good morning, ${firstName}!`;
    if (hour >= 12 && hour < 17) return `Good afternoon, ${firstName}!`;
    if (hour >= 17 && hour < 21) return `Good evening, ${firstName}!`;
    return `Welcome back, ${firstName}!`;
  })();

  const sgOptions = { timeZone: "Asia/Singapore" } as const;
  const timeStr = now
    .toLocaleTimeString("en-SG", { ...sgOptions, hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
  const dateStr = now.toLocaleDateString("en-SG", {
    ...sgOptions,
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-[200] overflow-hidden">
      {/* Video background */}
      <video
        ref={videoRef}
        key={activeVideo}
        src={bgVideos[activeVideo]}
        autoPlay
        muted
        playsInline
        onEnded={() => setActiveVideo((v) => (v + 1) % bgVideos.length)}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Frosted + animated gradient tint */}
      <div className="absolute inset-0 backdrop-blur-[2px]" />
      <div
        className="absolute inset-0 animate-gradient-shift"
        style={{
          backgroundSize: "300% 300%",
          backgroundImage:
            "linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(88,28,135,0.5) 20%, rgba(219,39,119,0.4) 40%, rgba(126,34,206,0.5) 60%, rgba(0,0,0,0.6) 80%, rgba(168,85,247,0.45) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-start justify-between p-8 sm:p-10">
          <div>
            <p className="text-sm text-white/40">{dateStr}</p>
            <p className="text-3xl sm:text-4xl font-bold text-white/90 -mt-1 tabular-nums">{timeStr}</p>
          </div>
          <Image
            src="/images/logo-meuraki.svg"
            alt="Meuraki"
            width={120}
            height={30}
            className="opacity-70"
          />
        </div>

        {/* Center greeting */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
            {greeting}
          </h1>
          <p className="text-lg sm:text-xl text-white/40 mt-2">
            Let&apos;s manage your wellness portal
          </p>
          <button
            onClick={() => setVisible(false)}
            className="mt-10 px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white font-semibold text-sm hover:bg-white/20 hover:border-white/40 transition-all"
          >
            Enter Dashboard &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
