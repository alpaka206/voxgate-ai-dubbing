"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

type AllowlistEntry = {
  createdAt: string | null;
  email: string;
  name: string | null;
  role: "manager" | "member";
};

type AccessRequestEntry = {
  createdAt: string | null;
  email: string;
  name: string | null;
  status: "pending" | "approved";
};

type AllowlistManagerProps = {
  entries: AllowlistEntry[];
  pendingRequests: AccessRequestEntry[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "기록 없음";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function AllowlistManager({ entries, pendingRequests }: AllowlistManagerProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submitMemberApproval(targetEmail: string, targetName?: string | null) {
    const response = await fetch("/api/allowlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: targetEmail,
        name: targetName,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "사용 권한 부여에 실패했습니다.");
    }

    return payload?.message ?? `${targetEmail} 계정을 사용 가능 상태로 추가했습니다.`;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const message = await submitMemberApproval(email, name);
      window.alert(message);
      setEmail("");
      setName("");
      startTransition(() => {
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "사용 권한 부여에 실패했습니다.");
    }
  }

  async function handleApprove(email: string, name?: string | null) {
    setError("");

    try {
      const message = await submitMemberApproval(email, name);
      window.alert(message);
      startTransition(() => {
        router.refresh();
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "사용 권한 부여에 실패했습니다.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-6">
        <div className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_18px_40px_rgba(31,38,52,0.05)]">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">허용 요청</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            대기 중인 요청 {pendingRequests.length}개
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            허용 신청을 보낸 계정을 확인하고, 필요한 경우 바로 사용 가능한 상태로 승인할 수 있습니다.
          </p>

          <div className="mt-6 space-y-3">
            {pendingRequests.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-border bg-[#fffdfa] px-4 py-5 text-sm leading-6 text-muted">
                현재 대기 중인 요청이 없습니다.
              </div>
            ) : (
              pendingRequests.map((request) => (
                <div
                  key={request.email}
                  className="rounded-[1.25rem] border border-border bg-[#fffdfa] px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all text-base font-semibold text-foreground">{request.email}</p>
                      <p className="mt-1 text-sm text-muted">{request.name ?? "이름 미등록"}</p>
                      <p className="mt-2 text-sm text-muted">신청일: {formatDate(request.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(255,127,92,0.22)] transition hover:-translate-y-0.5 hover:bg-accent-strong"
                      onClick={() => {
                        void handleApprove(request.email, request.name);
                      }}
                    >
                      허용하기
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_18px_40px_rgba(31,38,52,0.05)]">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">직접 추가</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            이메일을 바로 허용 목록에 추가
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            허용 신청 없이 바로 접근을 열어야 할 경우, 이메일을 직접 입력해 바로 사용 가능한 계정으로 추가할 수 있습니다.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">이메일</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-[1.25rem] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-[#ff7f5c]/10"
                placeholder="example@company.com"
                type="email"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">이름 (선택)</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-[1.25rem] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-[#ff7f5c]/10"
                placeholder="표시할 이름"
                type="text"
              />
            </label>

            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,127,92,0.24)] transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-[#f4f4f1] disabled:text-muted disabled:shadow-none"
              disabled={isPending || !email.trim()}
            >
              {isPending ? "처리 중..." : "허용 목록에 추가하기"}
            </button>
          </form>

          {error ? (
            <div className="mt-4 rounded-[1.25rem] border border-[#f0b5a2] bg-[#fff2ed] px-4 py-4 text-sm leading-6 text-[#9d3b1e]">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_18px_40px_rgba(31,38,52,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">현재 허용 목록</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              등록된 계정 {entries.length}개
            </h2>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.email}
              className="rounded-[1.25rem] border border-border bg-[#fffdfa] px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all text-base font-semibold text-foreground">{entry.email}</p>
                  <p className="mt-1 text-sm text-muted">{entry.name ?? "이름 미등록"}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    entry.role === "manager"
                      ? "bg-[#eef6ff] text-[#2c6db2]"
                      : "bg-[#fff3eb] text-[#9d3b1e]"
                  }`}
                >
                  {entry.role === "manager" ? "관리자" : "사용 계정"}
                </span>
              </div>

              <div className="mt-3 text-sm text-muted">
                <p>등록일: {formatDate(entry.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
