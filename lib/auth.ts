import type { Session } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import {
  type MembershipStatus,
  findAccessRequestByEmail,
  findAllowlistEntryByEmail,
  normalizeEmail,
  servicePolicy,
} from "@/lib/allowlist";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email);
    },
    async jwt({ token, user }) {
      if (typeof user?.email === "string") {
        token.email = normalizeEmail(user.email);
      } else if (typeof token.email === "string") {
        token.email = normalizeEmail(token.email);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.email === "string") {
        session.user.email = normalizeEmail(token.email);
      }

      return session;
    },
  },
};

export type AccessState = {
  canManageAllowlist: boolean;
  canUseStudio: boolean;
  dailyGenerationLimit: number;
  email: string | null;
  entry: Awaited<ReturnType<typeof findAllowlistEntryByEmail>>;
  maxMediaDurationSeconds: number;
  membershipStatus: MembershipStatus;
  name: string | null;
  requestEntry: Awaited<ReturnType<typeof findAccessRequestByEmail>>;
  role: "manager" | "member" | null;
  session: Session | null;
};

export async function getAccessState(): Promise<AccessState> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ? normalizeEmail(session.user.email) : null;
  const entry = email ? await findAllowlistEntryByEmail(email) : null;
  const requestEntry = email ? await findAccessRequestByEmail(email) : null;
  const membershipStatus: MembershipStatus = entry
    ? "approved"
    : requestEntry?.status === "pending"
      ? "pending"
      : "not_requested";
  const isApproved = Boolean(email && entry);
  const role = entry?.role ?? null;

  return {
    canManageAllowlist: role === "manager",
    canUseStudio: isApproved,
    dailyGenerationLimit: servicePolicy.dailyGenerationLimit,
    email,
    entry,
    maxMediaDurationSeconds: servicePolicy.maxMediaDurationSeconds,
    membershipStatus,
    name: session?.user?.name ?? entry?.name ?? requestEntry?.name ?? null,
    requestEntry,
    role,
    session,
  };
}
