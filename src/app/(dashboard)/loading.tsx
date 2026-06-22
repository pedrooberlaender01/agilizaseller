export default function DashboardLoading() {
  return (
    <main className="overflow-y-auto p-margin">
      <div className="mb-lg flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-44 animate-pulse rounded-md bg-zinc-800/70" />
          <div className="h-3 w-32 animate-pulse rounded bg-zinc-800/50" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 animate-pulse rounded-lg bg-zinc-800/70" />
          <div className="h-9 w-40 animate-pulse rounded-lg bg-zinc-800/70" />
        </div>
      </div>

      <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-zinc-800/70" />
              <div className="h-4 w-4 animate-pulse rounded bg-zinc-800/70" />
            </div>
            <div className="mt-3 h-8 w-28 animate-pulse rounded bg-zinc-800/70" />
            <div className="mt-2 h-3 w-16 animate-pulse rounded bg-zinc-800/50" />
          </div>
        ))}
      </div>

      <div className="mb-lg grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border border-zinc-800 bg-zinc-900/40 rounded-2xl p-5">
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-800/70" />
            <div className="mt-3 h-8 w-24 animate-pulse rounded bg-zinc-800/70" />
            <div className="mt-2 h-3 w-16 animate-pulse rounded bg-zinc-800/50" />
          </div>
        ))}
      </div>

      <div className="border border-zinc-800 bg-zinc-900/40 overflow-hidden rounded-2xl">
        <div className="border-b border-zinc-800 px-6 py-4">
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-800/70" />
        </div>
        <div className="divide-y divide-zinc-800/60">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-3">
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-800/70" />
              <div className="flex gap-4">
                <div className="h-3 w-10 animate-pulse rounded bg-zinc-800/50" />
                <div className="h-3 w-12 animate-pulse rounded bg-zinc-800/50" />
                <div className="h-3 w-16 animate-pulse rounded bg-zinc-800/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
