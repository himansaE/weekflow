/**
 * M1 placeholder. This becomes a redirect to `/dashboard` in M3, once the role
 * shell exists and identity can be resolved before choosing a dashboard (§9.1).
 */
export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">WeekFlow</h1>
      <p className="text-sm opacity-70">
        Weekly reporting &amp; team dashboard. Workspace foundation is in place — authentication and
        the application shell arrive in M3.
      </p>
    </main>
  );
}
