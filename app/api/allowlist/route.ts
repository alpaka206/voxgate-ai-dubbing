import { NextResponse } from "next/server";

import { grantMemberAccess } from "@/lib/allowlist";
import { getAccessState } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getAccessState();

  if (!access.session || !access.email) {
    return NextResponse.json({ error: "로그인 후 이용할 수 있습니다." }, { status: 401 });
  }

  if (!access.canManageAllowlist) {
    return NextResponse.json({ error: "허용 목록 관리 권한이 없습니다." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        email?: string;
        name?: string;
      }
    | null;

  if (!body?.email) {
    return NextResponse.json({ error: "등록할 이메일을 입력해 주세요." }, { status: 400 });
  }

  try {
    const entry = await grantMemberAccess({
      email: body.email,
      name: body.name,
    });

    return NextResponse.json({
      message: `${entry?.email ?? body.email} 계정을 member로 허용했습니다.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "허용 목록 등록에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}
