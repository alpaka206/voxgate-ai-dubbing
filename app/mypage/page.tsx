import { redirect } from "next/navigation";

import { AccessRequestCard } from "@/components/access-request-card";
import { AppShell } from "@/components/app-shell";
import { getAccessState } from "@/lib/auth";
import { formatDurationLabel } from "@/lib/display";
import { getRoleFeatures } from "@/lib/allowlist";
import { getDailyUsageSummary } from "@/lib/usage";

export default async function MyPage() {
  const access = await getAccessState();

  if (!access.session || !access.email) {
    redirect("/?notice=login-required");
  }

  const features = getRoleFeatures(access.role);
  const usageSummary = await getDailyUsageSummary(access.email, access.role);
  const statusText = {
    approved: "승인 완료",
    not_requested: "승인 필요",
    pending: "검토 중",
  }[access.membershipStatus];

  return (
    <AppShell
      access={access}
      currentPath="/mypage"
      description="현재 로그인한 계정과 플랜 정보, 승인 상태, 오늘 사용량을 확인할 수 있는 계정 페이지입니다."
      title="마이페이지"
      usageSummary={usageSummary}
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4">
          <div className="rounded-[1.5rem] border border-border bg-white/92 p-6">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">계정 정보</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted">이름</p>
                <p className="text-lg font-semibold text-foreground">{access.name ?? "이름 미등록"}</p>
              </div>
              <div>
                <p className="text-sm text-muted">이메일</p>
                <p className="text-lg font-semibold text-foreground">{access.email}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-white/92 p-6">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">이용 정보</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-sm text-muted">상태</p>
                <p className="text-lg font-semibold text-foreground">{statusText}</p>
              </div>
              <div>
                <p className="text-sm text-muted">플랜</p>
                <p className="text-lg font-semibold text-foreground">{features.label}</p>
              </div>
              <div>
                <p className="text-sm text-muted">최대 길이</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatDurationLabel(features.maxMediaDurationSeconds)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">오늘 남은 횟수</p>
                <p className="text-lg font-semibold text-foreground">
                  {access.canUseStudio ? `${usageSummary.remaining}회` : "승인 후 사용"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">{features.description}</p>
          </div>
        </div>

        <AccessRequestCard
          canUseStudio={access.canUseStudio}
          currentPlan={access.role}
          currentPlanLabel={features.label}
          membershipStatus={access.membershipStatus}
          requestedPlan={access.requestedPlan}
          requestedPlanLabel={access.requestedPlan ? getRoleFeatures(access.requestedPlan).label : null}
        />
      </div>
    </AppShell>
  );
}
