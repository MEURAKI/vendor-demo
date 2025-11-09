"use client";

interface AuthLayoutProps {
  children: React.ReactNode;
  showHeroImage?: boolean;
}

export default function AuthLayout({ children, showHeroImage = true }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form Content */}
      <div className="w-full lg:w-1/2 flex items-center justify-center">
        {children}
      </div>

      {/* Right Side - Hero Image */}
      {showHeroImage && (
        <div className="hidden lg:block lg:w-1/2 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10"></div>
          <img
            src="../../images/public/auth-hero.svg"
            alt="Fashion model"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-8 left-8 right-8 z-20">
            <p className="text-white text-lg leading-relaxed">
              Untitled Laboratory: A haven of avant-garde, we craft 
              exceptional business craft. With unceasing innovation, we can
              transform abstract ideas into tangible reality.
            </p>
            <p className="text-white/80 mt-4">
              Amelia Laurent<br />
              <span className="text-white/60 text-sm">Founder, Elevatar</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}