import { NextResponse } from "next/server";

import { submitAccessRequest } from "@/lib/allowlist";
import { getAccessState } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const access = await getAccessState();

  if (!access.session || !access.email) {
    return NextResponse.json({ error: "로그인 후 신청할 수 있습니다." }, { status: 401 });
  }

  try {
    const result = await submitAccessRequest({
      email: access.email,
      name: access.name,
    });

    if (result.state === "already_allowed") {
      return NextResponse.json({
        message: "이미 허용된 계정입니다. 바로 스튜디오를 사용할 수 있습니다.",
      });
    }

    if (result.state === "already_requested") {
      return NextResponse.json({
        message: "이미 허용 신청이 접수되었습니다. 관리자 승인을 기다려 주세요.",
      });
    }

    return NextResponse.json({
      message: "허용 신청이 접수되었습니다. 관리자 승인이 완료되면 바로 사용할 수 있습니다.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "허용 신청을 처리하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}
