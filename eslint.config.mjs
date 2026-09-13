import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno runtime — typechecked separately by `deno check` in CI,
    // not by the Next.js/Node ESLint program.
    "supabase/functions/**",
  ]),

  {
    rules: {
      /**
       * The React Compiler lint flags any setState inside an effect. Our
       * remaining uses are the legitimate escape hatches the rule's own
       * docs carve out:
       *   - subscribing to an external store (Supabase Realtime, the demo
       *     store) and calling setState from the subscription callback;
       *   - resolving an async fetch into state on mount;
       *   - the standard `mounted` flag that gates createPortal until the
       *     client has hydrated.
       * Each is already guarded against post-unmount writes. Kept as a
       * warning so genuinely new cascading-render bugs still surface.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
