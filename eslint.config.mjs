import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  {
    rules: {
      // Deze bestaande clientcomponenten hydrateren lokale browseropslag en
      // voltooien opdrachten vanuit effects. Dat is hier bewust gedrag.
      "react-hooks/set-state-in-effect": "off",
      // De datum op het ontdekkingenblad wordt pas na clienthydratie getoond.
      "react-hooks/purity": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
