/** Centred, single-column frame for the unauthenticated pages (§9). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">WeekFlow</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Weekly reporting &amp; team dashboard
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
