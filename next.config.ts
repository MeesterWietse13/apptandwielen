import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Verberg de ontwikkelaarsbadge in de lokale klasweergave. Fouten blijven
  // wel beschikbaar in de browserconsole en tijdens lint/build.
  devIndicators: false,
  // Deze app staat in een map met andere projecten. Zonder een expliciete root
  // kiest Turbopack soms de bovenliggende package-lock en faalt de build.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
