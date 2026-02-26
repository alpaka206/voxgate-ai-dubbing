"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AccessRole, MembershipStatus } from "@/lib/allowlist";

type PlanRequestButtonProps = {
  currentRole: AccessRole;
  hasStudioAccess: boolean;
  membershipStatus: MembershipStatus;
  requestedPlan: AccessRole | null;
  targetPlan: AccessRole;
};

const roleRank: Record<AccessRole, number> = {
  free: 0,
  basic: 1,
  plus: 2,
  pro: 3,
};

export function PlanRequestButton({
  currentRole,
  hasStudioAccess,
  membershipStatus,
  requestedPlan,
  targetPlan,
}: PlanRequestButtonProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const isApproved = hasStudioAccess;
  const isCurrentPlan = isApproved && currentRole === targetPlan;
  const isLowerPlan = isApproved && roleRank[targetPlan] < roleRank[currentRole];
  const isPendingForTarget = membershipStatus === "pending" && requestedPlan === targetPlan;
  const isDisabled = isCurrentPlan || isLowerPlan || isPendingForTarget || isPending;

  const buttonLabel =
    targetPlan === "free" && !isApproved
      ? isPendingForTarget
        ? "이용 신청 검토 중"
        : "이용 신청하기"
      : isCurrentPlan
        ? "현재 플랜"
        : isLowerPlan
          ? "하위 플랜"
          : isPendingForTarget
            ? "요청 검토 중"
            : "이 플랜 신청하기";

  async function handleClick() {
    setError("");

    try {
      const response = await fetch("/api/access-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetPlan,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "요청을 처리하지 못했습니다.");
      }

      window.alert(payload?.message ?? "신청이 접수되었습니다.");

      startTransition(() => {
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "요청을 처리하지 못했습니다.");
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className={`inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
          isDisabled
            ? "cursor-not-allowed border border-border bg-[#f5f2ed] text-muted"
            : "bg-accent text-white shadow-[0_16px_32px_rgba(255,127,92,0.24)] hover:-translate-y-0.5 hover:bg-accent-strong"
        }`}
        disabled={isDisabled}
        onClick={handleClick}
      >
        {isPending ? "처리 중..." : buttonLabel}
      </button>
      {error ? <p className="text-sm text-[#9d3b1e]">{error}</p> : null}
    </div>
  );
}
