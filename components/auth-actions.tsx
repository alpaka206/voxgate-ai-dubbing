"use client";

import { signIn, signOut } from "next-auth/react";

const sharedClasses =
  "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition";

export function SignInButton() {
  return (
    <button
      type="button"
      className={`${sharedClasses} bg-accent text-white shadow-[0_18px_40px_rgba(255,127,92,0.28)] hover:-translate-y-0.5 hover:bg-accent-strong`}
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
    >
      Google로 로그인
    </button>
  );
}

export function SignOutButton() {
  return (
    <button
      type="button"
      className={`${sharedClasses} border border-border bg-white text-foreground shadow-[0_10px_24px_rgba(31,38,52,0.06)] hover:-translate-y-0.5 hover:bg-[#fff7ed]`}
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      로그아웃
    </button>
  );
}
