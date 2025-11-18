// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/sign/**",
      },
      {
      protocol: "https",
      hostname: "abcxyzcompany.supabase.co",
      pathname: "/storage/v1/object/sign/**",
    },
      // Add your production Supabase domain too so it works after deploy:
      // {
      //   protocol: "https",
      //   hostname: "<your-project-ref>.supabase.co",
      //   pathname: "/storage/v1/object/public/**",
      // },
    ],
  },
};

module.exports = nextConfig;