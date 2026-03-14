"use client";

import { signIn, signOut } from "next-auth/react";

function GoogleGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.64 9.2045c0-.6382-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7968 2.7164v2.2582h2.9087c1.7018-1.5668 2.6845-3.8741 2.6845-6.6155Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1791l-2.9087-2.2582c-.806.54-1.8368.8591-3.0477.8591-2.3432 0-4.3282-1.5827-5.0364-3.7082H.9573v2.3318A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.9636 10.7136A5.4098 5.4098 0 0 1 3.6818 9c0-.5959.1023-1.1759.2818-1.7136V4.9545H.9573a9 9 0 0 0 0 8.091l3.0063-2.3319Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.3454l2.5814-2.5818C13.4632.8918 11.43 0 9 0A9 9 0 0 0 .9573 4.9545l3.0063 2.3319C4.6718 5.1623 6.6568 3.5795 9 3.5795Z"
        fill="#EA4335"
      />
    </svg>
  );
}

const sharedClasses =
  "inline-flex items-center justify-center rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 whitespace-nowrap";

const googleClasses =
  "min-h-10 cursor-pointer gap-[10px] border border-[#747775] bg-white px-[12px] py-[10px] text-[#1f1f1f] shadow-[0_1px_2px_rgba(60,64,67,0.15)] hover:bg-[#f8f9fa] hover:shadow-[0_2px_6px_rgba(60,64,67,0.2)] focus-visible:ring-[#1a73e8]/20";

export function SignInButton() {
  return (
    <button
      type="button"
      className={`${sharedClasses} ${googleClasses}`}
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      style={{
        fontFamily: "var(--font-google-signin), var(--font-sans)",
        fontSize: "14px",
        fontWeight: 500,
        lineHeight: "20px",
      }}
    >
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-white">
        <GoogleGlyph />
      </span>
      <span className="whitespace-nowrap">Google로 로그인</span>
    </button>
  );
}

export function SignOutButton() {
  return (
    <button
      type="button"
      className={`${sharedClasses} h-11 cursor-pointer border border-border bg-white px-5 py-3 text-foreground shadow-[0_10px_24px_rgba(31,38,52,0.06)] hover:-translate-y-0.5 hover:bg-[#fff7ed] focus-visible:ring-[#ff7f5c]/15`}
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      로그아웃
    </button>
  );
}
