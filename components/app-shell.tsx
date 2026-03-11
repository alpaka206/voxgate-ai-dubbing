import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth-actions";
import type { AccessState } from "@/lib/auth";

type AppShellProps = {
  access: AccessState;
  children: ReactNode;
  currentPath: "/allowlist" | "/dashboard" | "/mypage" | "/studio";
  description: string;
  title: string;
};

const baseNavItems = [
  { href: "/dashboard", key: "dashboard", label: "대시보드" },
  { href: "/studio", key: "studio", label: "스튜디오" },
  { href: "/mypage", key: "mypage", label: "마이페이지" },
] as const;

const statusLabel = {
  approved: "허용됨",
  pending: "승인 대기",
  not_requested: "미허용",
} as const;

export function AppShell({
  access,
  children,
  currentPath,
  description,
  title,
}: AppShellProps) {
  const displayName = access.name?.trim() || access.email || "사용자";
  const navItems = access.canManageAllowlist
    ? [
        ...baseNavItems,
        { href: "/allowlist", key: "allowlist", label: "허용 목록" as const },
      ]
    : baseNavItems;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 sm:px-10">
      <header className="rounded-[1.75rem] border border-border bg-white/90 px-5 py-4 shadow-[0_18px_45px_rgba(31,38,52,0.06)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <Link
              href="/dashboard"
              className="text-2xl font-semibold tracking-tight text-foreground"
            >
              readvox
            </Link>
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => {
                const isCurrent = currentPath === item.href;

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isCurrent
                        ? "border-[#f1c8b5] bg-[#fff1e8] text-[#b44b28] shadow-[0_8px_20px_rgba(255,127,92,0.16)]"
                        : "border-transparent bg-[#f7f4ef] text-muted hover:border-border hover:bg-white hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="rounded-[1.25rem] border border-border bg-[#fffdfa] px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {displayName}
              </p>
              <p className="text-xs text-muted">{access.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#fff3eb] px-3 py-1 text-xs font-semibold text-[#9d3b1e]">
                  {statusLabel[access.membershipStatus]}
                </span>
                {access.canManageAllowlist ? (
                  <span className="rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-semibold text-[#2c6db2]">
                    관리자
                  </span>
                ) : null}
              </div>
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mt-6 flex-1">
        <section className="rounded-[2rem] border border-border bg-surface p-8 shadow-[0_28px_70px_rgba(31,38,52,0.08)] backdrop-blur sm:p-10">
          <div className="mb-8 space-y-3 border-b border-border pb-6">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted">
              {description}
            </p>
          </div>

          {children}
        </section>
      </main>
    </div>
  );
}
