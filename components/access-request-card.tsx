import Link from "next/link";

import { AccessRequestButton } from "@/components/access-request-button";
import type { MembershipStatus } from "@/lib/allowlist";

type AccessRequestCardProps = {
  canManageAllowlist: boolean;
  canUseStudio: boolean;
  email: string | null;
  membershipStatus: MembershipStatus;
};

export function AccessRequestCard({
  canManageAllowlist,
  canUseStudio,
  email,
  membershipStatus,
}: AccessRequestCardProps) {
  if (canUseStudio) {
    return (
      <div className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_18px_40px_rgba(31,38,52,0.06)]">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.18em] text-accent">
            {canManageAllowlist ? "허용 목록 관리" : "이용 안내"}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {canManageAllowlist ? "허용 요청을 직접 승인할 수 있어요" : "현재 계정은 바로 서비스를 이용할 수 있어요"}
          </h2>
          <p className="text-sm leading-6 text-muted">
            {canManageAllowlist
              ? "manager 권한 계정입니다. 허용 목록 페이지에서 대기 중인 요청을 member로 승인하거나 평가 계정을 직접 추가할 수 있습니다."
              : "허용 목록에 등록된 계정입니다. 스튜디오에서 바로 더빙을 시작하거나 마이페이지에서 현재 상태를 확인해 보세요."}
          </p>
        </div>

        <div className="mt-5">
          <Link
            href={canManageAllowlist ? "/allowlist" : "/studio"}
            className="inline-flex items-center justify-center rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:bg-[#fff7f1]"
          >
            {canManageAllowlist ? "허용 목록 관리하기" : "스튜디오 열기"}
          </Link>
        </div>
      </div>
    );
  }

  const isPending = membershipStatus === "pending";

  return (
    <div className="rounded-[1.75rem] border border-[#f0d5c9] bg-[#fff9f5] p-6 shadow-[0_18px_40px_rgba(31,38,52,0.06)]">
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-[0.18em] text-accent">허용 목록 안내</p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {isPending ? "허용 신청이 접수되었습니다" : "현재 계정은 아직 허용 목록에 등록되지 않았습니다"}
        </h2>
        <p className="text-sm leading-6 text-muted">
          {isPending
            ? "manager 계정이 요청을 확인하면 member 권한으로 승인할 수 있습니다. 승인 후에는 스튜디오를 바로 사용할 수 있습니다."
            : "readvox는 허용 목록에 등록된 계정만 스튜디오를 사용할 수 있습니다. 아래 버튼으로 허용 신청을 보낼 수 있습니다."}
        </p>
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-border bg-white px-4 py-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-accent">현재 로그인한 이메일</p>
        <p className="mt-2 break-all text-lg font-semibold text-foreground">
          {email ?? "이메일을 확인할 수 없습니다."}
        </p>
      </div>

      <div className="mt-5">
        {isPending ? (
          <div className="rounded-[1.25rem] border border-border bg-white px-4 py-4 text-sm leading-6 text-muted">
            현재 신청 상태: manager 승인 대기 중
          </div>
        ) : (
          <AccessRequestButton />
        )}
      </div>
    </div>
  );
}
