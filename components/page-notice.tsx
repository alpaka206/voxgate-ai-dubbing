"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const noticeMap = {
  "approval-required": {
    message: "허용 목록에 등록된 계정만 스튜디오를 사용할 수 있습니다. 대시보드에서 허용 신청을 보내거나 manager 계정에 직접 요청해 주세요.",
    title: "접근 권한이 필요해요",
  },
  "login-required": {
    message: "로그인 후 이용할 수 있습니다.",
    title: "로그인이 필요해요",
  },
  "manage-required": {
    message: "허용 목록 관리는 관리자 계정만 사용할 수 있습니다.",
    title: "관리 권한이 필요해요",
  },
  "signed-in": {
    message: "로그인이 완료되었습니다. 현재 계정 상태와 이용 가능한 기능을 확인해 보세요.",
    title: "로그인 완료",
  },
} as const;

type NoticeCode = keyof typeof noticeMap;

type PageNoticeProps = {
  notice?: NoticeCode;
};

export function PageNotice({ notice }: PageNoticeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [dismissedNotice, setDismissedNotice] = useState<NoticeCode | null>(null);
  const handledNoticeRef = useRef<NoticeCode | null>(null);

  useEffect(() => {
    if (!notice || handledNoticeRef.current === notice) {
      return;
    }

    handledNoticeRef.current = notice;

    const params = new URLSearchParams(window.location.search);
    params.delete("notice");

    window.alert(noticeMap[notice].message);
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
    });
  }, [notice, pathname, router]);

  if (!notice || dismissedNotice === notice) {
    return null;
  }

  return (
    <div className="rounded-[1.5rem] border border-[#f0b5a2] bg-[#fff2ed] px-5 py-4 text-sm text-[#9d3b1e]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{noticeMap[notice].title}</p>
          <p className="mt-1 leading-6">{noticeMap[notice].message}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full border border-[#f0b5a2] px-3 py-1 text-xs font-semibold"
          onClick={() => setDismissedNotice(notice)}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
