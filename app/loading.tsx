export default function GlobalLoading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12 sm:px-10">
      <section className="flex w-full max-w-xl flex-col items-center gap-6 rounded-[2rem] border border-border bg-surface px-8 py-12 text-center shadow-[0_28px_70px_rgba(31,38,52,0.08)] backdrop-blur sm:px-12">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#ffd4c4] border-t-accent" />
          <div className="absolute inset-[10px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,127,92,0.22),transparent_55%),linear-gradient(135deg,#fff6ef_0%,#ffffff_100%)]" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-[0.22em] text-accent">READVOX</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">페이지를 불러오는 중입니다</h1>
          <p className="text-sm leading-6 text-muted">
            화면 전환에 필요한 데이터를 준비하고 있습니다. 잠시만 기다려 주세요.
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#f3ece5]">
          <div className="loading-bar h-full w-1/3 rounded-full bg-[linear-gradient(90deg,#ff7f5c_0%,#ffb093_100%)]" />
        </div>
      </section>
    </main>
  );
}
