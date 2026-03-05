"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { VendorShellProvider, useVendorProfile } from "../../context/VendorShellContext";
import Sidebar from "../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../components/sidebar/sidebar.config";
import SplashScreen from "../../components/SplashScreen";
import ClipLoader from "react-spinners/ClipLoader";

const SKIP_SHELL = ["/pages/auth/", "/pages/onboarding/"];

function ShellContent({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useVendorProfile();
  const router = useRouter();

  const sidebarConfig = useMemo(
    () =>
      profile
        ? buildSidebarConfig({
            fullName: profile.full_name,
            email: profile.email,
            role: "Subscriber",
            status: profile.status ?? "active",
          })
        : null,
    [profile]
  );

  // Redirect to login if no profile after loading finishes
  useEffect(() => {
    if (!loading && !profile) {
      router.replace("/pages/auth/login");
    }
  }, [loading, profile, router]);

  // Shell loading state — sidebar placeholder + spinner in content area
  if (loading) {
    return (
      <div className="flex h-screen w-screen bg-[#050509]">
        <div className="shrink-0 w-[60px] bg-ink-800" />
        <div className="relative flex flex-1 items-stretch z-0">
          <div className="flex h-full w-full items-center justify-center rounded-l-[2rem] bg-[#F6F6FC]">
            <ClipLoader size={55} color="#6B46C1" cssOverride={{ animationDuration: "3s" }} />
          </div>
        </div>
      </div>
    );
  }

  // Still no profile (redirecting to login)
  if (!sidebarConfig) {
    return (
      <div className="flex h-screen w-screen bg-[#050509]">
        <div className="shrink-0 w-[60px] bg-ink-800" />
        <div className="relative flex flex-1 items-stretch z-0">
          <div className="flex h-full w-full items-center justify-center rounded-l-[2rem] bg-[#F6F6FC]">
            <ClipLoader size={55} color="#6B46C1" cssOverride={{ animationDuration: "3s" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#050509]">
      <Sidebar config={sidebarConfig} />
      <div className="relative z-0 flex flex-1 items-stretch">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-l-[2rem] bg-[#F6F6FC]">
          <SplashScreen />
          {children}
        </div>
      </div>
    </div>
  );
}

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Auth and onboarding pages render without the sidebar shell
  if (SKIP_SHELL.some((prefix) => pathname.startsWith(prefix))) {
    return <>{children}</>;
  }

  return (
    <VendorShellProvider>
      <ShellContent>{children}</ShellContent>
    </VendorShellProvider>
  );
}
