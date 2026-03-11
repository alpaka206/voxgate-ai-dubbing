import { redirect } from "next/navigation";

import { AllowlistManager } from "@/components/allowlist-manager";
import { AppShell } from "@/components/app-shell";
import { listAllowlistEntries, listPendingAccessRequests } from "@/lib/allowlist";
import { getAccessState } from "@/lib/auth";

export default async function AllowlistPage() {
  const access = await getAccessState();

  if (!access.session || !access.email) {
    redirect("/?notice=login-required");
  }

  if (!access.canManageAllowlist) {
    redirect("/dashboard?notice=manage-required");
  }

  const entries = await listAllowlistEntries();
  const pendingRequests = await listPendingAccessRequests();

  return (
    <AppShell
      access={access}
      currentPath="/allowlist"
      description="대기 중인 허용 요청을 확인하고 member 권한으로 승인하거나, 평가 계정과 테스트 계정을 직접 허용 목록에 추가할 수 있습니다."
      title="허용 목록 관리"
    >
      <AllowlistManager entries={entries} pendingRequests={pendingRequests} />
    </AppShell>
  );
}
