import { NextResponse } from "next/server";

import { getAccessState } from "@/lib/auth";
import { accessRoles, submitPlanRequest } from "@/lib/allowlist";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getAccessState();

  if (!access.session || !access.email) {
    return NextResponse.json({ error: "로그인 후 신청할 수 있습니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { name?: string; targetPlan?: string }
    | null;

  const targetPlan = body?.targetPlan;

  if (!targetPlan || !accessRoles.includes(targetPlan as (typeof accessRoles)[number])) {
    return NextResponse.json({ error: "신청할 플랜을 다시 선택해 주세요." }, { status: 400 });
  }

  try {
    const result = await submitPlanRequest({
      email: access.email,
      name: body?.name ?? access.name,
      targetPlan: targetPlan as (typeof accessRoles)[number],
    });

    if (result.state === "same_or_lower") {
      return NextResponse.json({
        message:
          targetPlan === "free"
            ? "이미 이용 가능한 계정입니다."
            : "이미 현재 플랜 이상으로 이용 중입니다.",
      });
    }

    if (result.state === "pending") {
      return NextResponse.json({
        message:
          targetPlan === "free"
            ? "이용 신청이 이미 접수되어 있습니다."
            : "같은 플랜에 대한 업그레이드 요청이 이미 접수되어 있습니다.",
      });
    }

    return NextResponse.json({
      message:
        targetPlan === "free"
          ? "이용 신청이 접수되었습니다. 승인 후 스튜디오를 사용할 수 있습니다."
          : "플랜 업그레이드 요청이 접수되었습니다. 검토 후 반영됩니다.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "신청을 처리하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
