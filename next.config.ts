import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/checkin", destination: "/?screen=checkin" },
      { source: "/seat", destination: "/?screen=seat" },
      { source: "/drd", destination: "/?screen=drd" },
      { source: "/timer", destination: "/?screen=timer" },
      { source: "/report", destination: "/?screen=report" },
      { source: "/settings", destination: "/?screen=settings" },
    ];
  },
};

export default nextConfig;
