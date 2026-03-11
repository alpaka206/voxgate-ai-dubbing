"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AccessRequestButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    setError("");

    try {
      const response = await fetch("/api/access-request", {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "허용 신청을 처리하지 못했습니다.");
      }

      window.alert(payload?.message ?? "허용 신청이 접수되었습니다.");

      startTransition(() => {
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "허용 신청을 처리하지 못했습니다.");
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,127,92,0.24)] transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-[#f4f4f1] disabled:text-muted disabled:shadow-none"
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? "신청 중..." : "허용 신청하기"}
      </button>
      {error ? <p className="text-sm text-[#9d3b1e]">{error}</p> : null}
    </div>
  );
}
