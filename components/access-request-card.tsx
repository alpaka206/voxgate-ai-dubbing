import Link from "next/link";

import { PlanRequestButton } from "@/components/plan-request-button";
import type { AccessRole } from "@/lib/allowlist";

type AccessRequestCardProps = {
  canUseStudio: boolean;
  currentPlan: AccessRole;
  currentPlanLabel: string;
  membershipStatus: "approved" | "not_requested" | "pending";
  requestedPlan: AccessRole | null;
  requestedPlanLabel?: string | null;
};

export function AccessRequestCard({
  canUseStudio,
  currentPlan,
  currentPlanLabel,
  membershipStatus,
  requestedPlan,
  requestedPlanLabel,
}: AccessRequestCardProps) {
  const isPending = membershipStatus === "pending";
  const needsApproval = !canUseStudio;

  return (
    <div className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_18px_40px_rgba(31,38,52,0.06)]">
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-accent">
          {needsApproval ? "이용 승인" : "플랜 안내"}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {needsApproval
            ? isPending
              ? "이용 신청이 접수되었습니다"
              : "승인 후 스튜디오를 사용할 수 있어요"
            : isPending
              ? "플랜 업그레이드 요청을 확인해 주세요"
              : "더 긴 파일이 필요하면 플랜을 올려보세요"}
        </h2>
        <p className="text-sm leading-6 text-muted">
          {needsApproval
            ? isPending
              ? "현재 계정은 검토 중입니다. 승인되면 스튜디오에서 파일 업로드형 더빙을 바로 사용할 수 있습니다."
              : "로그인은 완료됐지만 아직 허용 목록에 등록되지 않았습니다. 이용 신청을 남기면 검토 후 승인할 수 있습니다."
            : isPending
              ? "업그레이드 검토 중에는 현재 플랜으로 계속 사용할 수 있습니다. 반영 전까지는 기존 한도가 유지됩니다."
              : "플랜이 올라가면 하루 생성 횟수와 업로드 가능한 파일 길이가 함께 늘어납니다."}
        </p>
      </div>

      <div className={`mt-5 grid gap-3 ${isPending ? "sm:grid-cols-2" : ""}`}>
        <div className="rounded-[1.25rem] border border-border bg-[#fffaf6] px-4 py-4">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">현재 플랜</p>
          <p className="mt-2 text-lg font-semibold text-foreground">{currentPlanLabel}</p>
        </div>
        {isPending ? (
          <div className="rounded-[1.25rem] border border-border bg-[#fffaf6] px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">검토 중인 플랜</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {requestedPlanLabel ?? "요청 확인 중"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        {needsApproval ? (
          <PlanRequestButton
            currentRole={currentPlan}
            hasStudioAccess={canUseStudio}
            membershipStatus={membershipStatus}
            requestedPlan={requestedPlan}
            targetPlan="free"
          />
        ) : (
          <Link
            href="/plans"
            className="inline-flex items-center justify-center rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:bg-[#fff7f1]"
          >
            플랜 비교하기
          </Link>
        )}
      </div>
    </div>
  );
}
