import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PlanRequestButton } from "@/components/plan-request-button";
import { getAccessState } from "@/lib/auth";
import { accessRoles, getRoleFeatures } from "@/lib/allowlist";
import { formatDurationLabel } from "@/lib/display";
import { getDailyUsageSummary } from "@/lib/usage";

export default async function PlansPage() {
  const access = await getAccessState();

  if (!access.session || !access.email) {
    redirect("/?notice=login-required");
  }

  const usageSummary = await getDailyUsageSummary(access.email, access.role);

  return (
    <AppShell
      access={access}
      currentPath="/plans"
      description="플랜별 하루 사용 횟수와 업로드 가능한 파일 길이를 비교하고, 필요한 경우 이용 신청이나 업그레이드 요청을 남길 수 있습니다."
      title="플랜"
      usageSummary={usageSummary}
    >
      <div className="grid gap-4 lg:grid-cols-4">
        {accessRoles.map((role) => {
          const features = getRoleFeatures(role);
          const isCurrent = access.membershipStatus === "approved" && access.role === role;

          return (
            <div
              key={role}
              className={`rounded-[1.75rem] border p-6 shadow-[0_16px_35px_rgba(31,38,52,0.05)] ${
                isCurrent ? "border-[#f1c8b5] bg-[#fff7f1]" : "border-border bg-white/92"
              }`}
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-accent">{features.label}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                {formatDurationLabel(features.maxMediaDurationSeconds)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">{features.description}</p>

              <div className="mt-5 space-y-3 rounded-[1.25rem] bg-[#fffdfa] px-4 py-4 text-sm text-muted">
                <p>하루 더빙 횟수: {features.dailyGenerationLimit}회</p>
                <p>최대 파일 길이: {formatDurationLabel(features.maxMediaDurationSeconds)}</p>
                <p>
                  {role === "free"
                    ? "승인 후 바로 시작할 수 있는 기본 플랜"
                    : "더 긴 파일과 더 많은 생성 횟수가 필요한 경우 추천"}
                </p>
              </div>

              <div className="mt-5">
                <PlanRequestButton
                  currentRole={access.role}
                  hasStudioAccess={access.canUseStudio}
                  membershipStatus={access.membershipStatus}
                  requestedPlan={access.requestedPlan}
                  targetPlan={role}
                />
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
