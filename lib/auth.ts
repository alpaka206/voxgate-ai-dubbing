import type { Session } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import {
  type AccessRole,
  type MembershipStatus,
  findAllowlistEntryByEmail,
  getRoleFeatures,
  normalizeEmail,
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
  canUseStudio: boolean;
  dailyGenerationLimit: number;
  email: string | null;
  entry: Awaited<ReturnType<typeof findAllowlistEntryByEmail>>;
  maxMediaDurationSeconds: number;
  membershipStatus: MembershipStatus;
  name: string | null;
  requestedPlan: AccessRole | null;
  role: AccessRole;
  roleLabel: string;
  session: Session | null;
};

export async function getAccessState(): Promise<AccessState> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ? normalizeEmail(session.user.email) : null;
  const entry = email ? await findAllowlistEntryByEmail(email) : null;
  const membershipStatus: MembershipStatus = !entry
    ? "not_requested"
    : entry.status === "approved" && entry.requestedPlan && entry.requestedPlan !== entry.role
      ? "pending"
      : entry.status;
  const role = entry?.role ?? "free";
  const features = getRoleFeatures(role);
  const isApproved = entry?.status === "approved";

  return {
    canUseStudio: Boolean(email && isApproved && features.canUseStudio),
    dailyGenerationLimit: features.dailyGenerationLimit,
    email,
    entry,
    maxMediaDurationSeconds: features.maxMediaDurationSeconds,
    membershipStatus,
    name: session?.user?.name ?? entry?.name ?? null,
    requestedPlan: entry?.requestedPlan ?? null,
    role,
    roleLabel: features.label,
    session,
  };
}
