import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-[2rem] border border-border bg-surface p-8 shadow-[0_28px_70px_rgba(31,38,52,0.08)] backdrop-blur sm:p-10">
        <div className="space-y-5">
          <p className="text-sm font-semibold tracking-[0.2em] text-accent">readvox</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            접근 권한을 확인할 수 없어요
          </h1>
          <p className="text-base leading-7 text-muted">
            로그인 정보를 확인하지 못했거나 현재 계정이 허용 목록에 없습니다. 메인 페이지로 돌아가 다시 로그인하거나
            대시보드에서 허용 신청 상태를 확인해 주세요.
          </p>
        </div>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-[#fff7ed]"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
