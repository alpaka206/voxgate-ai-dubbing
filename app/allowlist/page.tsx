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
      description="대기 중인 허용 요청을 확인하고 새 사용자를 바로 사용 가능한 상태로 추가할 수 있는 관리 화면입니다."
      title="허용 목록 관리"
    >
      <AllowlistManager entries={entries} pendingRequests={pendingRequests} />
    </AppShell>
  );
}
