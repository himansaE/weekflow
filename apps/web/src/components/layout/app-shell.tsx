'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import type { SafeUser } from '@weekflow/shared';
import { Role } from '@weekflow/shared';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { navigationFor } from './navigation';
import { UserMenu } from './user-menu';

/**
 * The application shell (D116, §9.1): a persistent role-aware sidebar on desktop
 * that becomes a drawer on mobile, with a top bar carrying the page title and the
 * user menu.
 */
export function AppShell({ user, children }: { user: SafeUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = navigationFor(user.role);

  const nav = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {items.map((item) => {
        // `/reports/current` must not light up `/reports/history`, so match the
        // segment boundary rather than a bare prefix.
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          {/* Base UI composes via `render`, not Radix's `asChild`. */}
          <SheetTrigger
            render={<Button variant="ghost" size="icon" aria-label="Open navigation" />}
            className="lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle className="text-left text-base">WeekFlow</SheetTitle>
            </SheetHeader>
            <div className="p-3">{nav(() => setDrawerOpen(false))}</div>
          </SheetContent>
        </Sheet>

        <span className="text-base font-semibold tracking-tight lg:hidden">WeekFlow</span>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
            {user.role === Role.MANAGER ? 'Manager' : 'Team Member'}
          </span>
          <UserMenu user={user} />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r bg-muted/20 p-3 lg:block">
          <div className="mb-4 px-3 py-1 text-base font-semibold tracking-tight">WeekFlow</div>
          {nav()}
        </aside>

        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
