import { REPORT_SECTIONS, TIME_CATEGORY_LABELS, formatMinutes } from '@weekflow/shared';
import type { ReportContentView } from '@weekflow/shared';
import { Badge } from '@/components/ui/badge';

/**
 * Report content, read-only (§24 of the scope).
 *
 * Used wherever content must not be editable: a manager reviewing a submission,
 * and any member looking at an immutable past version. There are deliberately no
 * inputs here at all — a manager must never be handed an editable control for a
 * member's content, and the surest way is for the control not to exist.
 */
export function ReadOnlyReport({ content }: { content: ReportContentView }) {
  return (
    <div className="space-y-6">
      <Section title={REPORT_SECTIONS[0].label} empty={content.tasks.length === 0}>
        <div className="space-y-3">
          {content.tasks.map((task) => (
            <div key={task.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{task.taskName ?? 'Untitled task'}</span>
                {task.priority && <Badge variant="outline">{titleCase(task.priority)}</Badge>}
                {task.status && <Badge variant="secondary">{titleCase(task.status)}</Badge>}
              </div>

              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                <Row label="Planned / actual">
                  {task.plannedPercent ?? '—'}% / {task.actualPercent ?? '—'}%
                </Row>
                <Row label="Time planned / actual">
                  {task.plannedMinutes === null ? '—' : formatMinutes(task.plannedMinutes)} /{' '}
                  {task.actualMinutes === null ? '—' : formatMinutes(task.actualMinutes)}
                </Row>
              </dl>

              {task.deliverable && (
                <p className="mt-2 whitespace-pre-wrap text-sm">{task.deliverable}</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title={REPORT_SECTIONS[1].label} empty={content.nextWeekTasks.length === 0}>
        <ul className="space-y-1 text-sm">
          {content.nextWeekTasks.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-2">
              <span>{task.taskName ?? 'Untitled'}</span>
              {task.priority && <Badge variant="outline">{titleCase(task.priority)}</Badge>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={REPORT_SECTIONS[2].label} empty={content.blockers.length === 0}>
        <ul className="space-y-2 text-sm">
          {content.blockers.map((blocker) => (
            <li key={blocker.id} className="flex flex-wrap items-start gap-2">
              {blocker.isKeyIssue && <Badge variant="destructive">Key issue</Badge>}
              {blocker.status && <Badge variant="outline">{titleCase(blocker.status)}</Badge>}
              <span className="whitespace-pre-wrap">{blocker.description}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={REPORT_SECTIONS[3].label} empty={content.achievements.length === 0}>
        <ul className="space-y-2 text-sm">
          {content.achievements.map((achievement) => (
            <li key={achievement.id} className="flex flex-wrap items-start gap-2">
              {achievement.isKeyAchievement && <Badge>Key achievement</Badge>}
              <span className="whitespace-pre-wrap">{achievement.description}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={REPORT_SECTIONS[4].label}
        empty={content.timeEntries.length === 0}
        emptyMessage="No categorized time reported."
      >
        <ul className="space-y-1 text-sm">
          {content.timeEntries.map((entry) => (
            <li key={entry.id}>
              {entry.category ? TIME_CATEGORY_LABELS[entry.category] : 'Uncategorized'} ·{' '}
              {entry.minutes === null ? '—' : formatMinutes(entry.minutes)}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={REPORT_SECTIONS[5].label}
        empty={!content.notes && content.links.length === 0}
      >
        <div className="space-y-3 text-sm">
          {content.notes && <p className="whitespace-pre-wrap">{content.notes}</p>}
          {content.links.length > 0 && (
            <ul className="space-y-1">
              {content.links.map((link) => (
                <li key={link.id}>
                  {link.url ? (
                    <a
                      href={link.url}
                      // External destination the member chose; open in a new tab
                      // without handing it a window reference (§6.7).
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      {link.label ?? link.url} ↗
                    </a>
                  ) : (
                    (link.label ?? '—')
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  empty,
  emptyMessage = 'Nothing recorded.',
  children,
}: {
  title: string;
  empty: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {empty ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0">{label}:</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part, index) => (index === 0 ? part[0]?.toUpperCase() + part.slice(1) : part))
    .join(' ');
}
