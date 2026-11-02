// Placeholder screen proving the toolchain and design tokens work.
// Replaced by the Roast screen at milestone 2.
export function App() {
  return (
    <main className="flex min-h-screen flex-col items-start justify-center gap-3 bg-bg p-6 font-sans text-ink">
      <h1 className="text-3xl font-bold tracking-tight">Roastpilot</h1>
      <p className="text-ink-muted">Scaffold ready. Implementation starts at milestone 1.</p>
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <span aria-hidden="true" className="size-2 rounded-full bg-heat-fill" />
        heat
        <span aria-hidden="true" className="ml-4 size-2 rounded-full bg-air" />
        air
      </div>
    </main>
  );
}
