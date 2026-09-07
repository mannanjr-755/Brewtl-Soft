import type { NextAuthConfig } from "next-auth";

/** Edge-safe auth config (no Prisma / Node-only imports) */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: { strategy: "jwt" as const },
} satisfies NextAuthConfig;
