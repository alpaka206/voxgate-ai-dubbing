import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getAccessState } from "@/lib/auth";
import { getAllowedUploadContentTypes, isAllowedUploadPath } from "@/lib/blob";
import { getMaxUploadBytes } from "@/lib/media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const access = await getAccessState();

  if (!access.session || !access.email) {
    return jsonResponse({ error: "로그인이 필요합니다." }, 401);
  }

  if (!access.canUseStudio) {
    return jsonResponse({ error: "허용된 계정만 업로드할 수 있습니다." }, 403);
  }

  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;

  if (!body) {
    return jsonResponse({ error: "잘못된 업로드 요청입니다." }, 400);
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAllowedUploadPath(pathname, access.email!)) {
          throw new Error("잘못된 업로드 경로입니다.");
        }

        return {
          addRandomSuffix: false,
          allowedContentTypes: getAllowedUploadContentTypes(),
          maximumSizeInBytes: getMaxUploadBytes(),
        };
      },
    });

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Blob 업로드 토큰을 생성하지 못했습니다.", error);

    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : "업로드 준비 중 오류가 발생했습니다.",
      },
      400,
    );
  }
}
