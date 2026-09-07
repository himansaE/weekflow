import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../src/generated/prisma/client';
import { createTestPrismaClient, expectRejection, resetDatabase } from './prisma-test-client';

/**
 * DATA — the database-level half of the §13 guarantees.
 *
 * Each of these rules is also enforced by a write service. These tests prove the
 * database refuses anyway, which is what makes the guarantee hold against a
 * future endpoint, a bad migration or a manual query.
 */

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrismaClient();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

// ─── fixtures ────────────────────────────────────────────────────────────────

const MONDAY = new Date('2026-08-31T00:00:00.000Z');
const DEADLINE = new Date('2026-09-07T03:30:00.000Z');

async function createUser(overrides: Partial<{ email: string; fullName: string }> = {}) {
  return prisma.user.create({
    data: {
      fullName: overrides.fullName ?? 'Nimal Perera',
      email: overrides.email ?? `member-${randomUUID()}@weekflow.example.test`,
      passwordHash: 'argon2-placeholder',
    },
  });
}

async function createProject(name = `Apollo ${randomUUID()}`) {
  return prisma.project.create({ data: { name } });
}

async function createReport(userId: string, weekStart: Date = MONDAY) {
  return prisma.report.create({
    data: {
      userId,
      weekStart,
      reportingTimezone: 'Asia/Colombo',
      deadlineAt: DEADLINE,
    },
  });
}

async function createVersion(reportId: string, versionNumber = 1, submittedAt: Date | null = null) {
  return prisma.reportVersion.create({ data: { reportId, versionNumber, submittedAt } });
}

// ─── value constraints ───────────────────────────────────────────────────────

describe('DATA — value constraints (§13.4, §13.5)', () => {
  it('rejects a week start that is not a Monday', async () => {
    const user = await createUser();

    const message = await expectRejection(() =>
      createReport(user.id, new Date('2026-09-02T00:00:00.000Z')),
    );

    expect(message).toContain('Report_weekStart_is_monday');
  });

  it('accepts a Monday week start', async () => {
    const user = await createUser();
    const report = await createReport(user.id);

    expect(report.weekStart.toISOString()).toBe(MONDAY.toISOString());
  });

  it('rejects a second report for the same member and week', async () => {
    const user = await createUser();
    await createReport(user.id);

    const message = await expectRejection(() => createReport(user.id));

    expect(message).toMatch(/userId|weekStart|unique/i);
  });

  it('allows the same week for a different member', async () => {
    const [a, b] = await Promise.all([createUser(), createUser()]);
    await createReport(a.id);

    await expect(createReport(b.id)).resolves.toBeDefined();
  });

  it('rejects a version number below 1', async () => {
    const user = await createUser();
    const report = await createReport(user.id);

    const message = await expectRejection(() => createVersion(report.id, 0));

    expect(message).toContain('ReportVersion_number_positive');
  });

  it('rejects a duplicate version number within one report', async () => {
    const user = await createUser();
    const report = await createReport(user.id);
    await createVersion(report.id, 1, new Date());

    const message = await expectRejection(() => createVersion(report.id, 1));

    expect(message).toMatch(/versionNumber|unique/i);
  });

  it.each([
    ['plannedPercent above 100', { plannedPercent: 101 }, 'ReportTask_planned_percent_range'],
    ['actualPercent below 0', { actualPercent: -1 }, 'ReportTask_actual_percent_range'],
    ['plannedMinutes beyond a week', { plannedMinutes: 10081 }, 'ReportTask_planned_minutes_range'],
    ['actualMinutes below 0', { actualMinutes: -5 }, 'ReportTask_actual_minutes_range'],
  ])('rejects a task with %s', async (_label, patch, constraint) => {
    const user = await createUser();
    const report = await createReport(user.id);
    const version = await createVersion(report.id);

    const message = await expectRejection(() =>
      prisma.reportTask.create({
        data: { reportVersionId: version.id, position: 0, ...patch },
      }),
    );

    expect(message).toContain(constraint);
  });

  it('rejects a time entry beyond one week of minutes', async () => {
    const user = await createUser();
    const report = await createReport(user.id);
    const version = await createVersion(report.id);

    const message = await expectRejection(() =>
      prisma.timeEntry.create({
        data: { reportVersionId: version.id, position: 0, minutes: 10081 },
      }),
    );

    expect(message).toContain('TimeEntry_minutes_range');
  });

  it('rejects two children at the same position in one version', async () => {
    const user = await createUser();
    const report = await createReport(user.id);
    const version = await createVersion(report.id);

    await prisma.reportTask.create({ data: { reportVersionId: version.id, position: 0 } });

    const message = await expectRejection(() =>
      prisma.reportTask.create({ data: { reportVersionId: version.id, position: 0 } }),
    );

    expect(message).toMatch(/position|unique/i);
  });
});

// ─── one-editable-version and key flags ──────────────────────────────────────

describe('DATA — version and key-flag invariants (§7.2, §6.4, §6.5)', () => {
  it('rejects a second editable version on one report', async () => {
    const user = await createUser();
    const report = await createReport(user.id);
    await createVersion(report.id, 1);

    const message = await expectRejection(() => createVersion(report.id, 2));

    expect(message).toContain('ReportVersion_editable_unique');
  });

  it('allows a new editable version once the previous one is submitted', async () => {
    const user = await createUser();
    const report = await createReport(user.id);
    await createVersion(report.id, 1, new Date());

    await expect(createVersion(report.id, 2)).resolves.toBeDefined();
  });

  it('rejects a second key issue in one version', async () => {
    const user = await createUser();
    const report = await createReport(user.id);
    const version = await createVersion(report.id);

    await prisma.blocker.create({
      data: { reportVersionId: version.id, position: 0, description: 'Auth', isKeyIssue: true },
    });

    const message = await expectRejection(() =>
      prisma.blocker.create({
        data: { reportVersionId: version.id, position: 1, description: 'CI', isKeyIssue: true },
      }),
    );

    expect(message).toContain('Blocker_key_issue_unique');
  });

  it('allows many non-key blockers alongside one key issue', async () => {
    const user = await createUser();
    const report = await createReport(user.id);
    const version = await createVersion(report.id);

    await prisma.blocker.create({
      data: { reportVersionId: version.id, position: 0, description: 'Key', isKeyIssue: true },
    });
    await prisma.blocker.create({
      data: { reportVersionId: version.id, position: 1, description: 'Other' },
    });
    await prisma.blocker.create({
      data: { reportVersionId: version.id, position: 2, description: 'Another' },
    });

    await expect(prisma.blocker.count({ where: { reportVersionId: version.id } })).resolves.toBe(3);
  });

  it('rejects a second key achievement in one version', async () => {
    const user = await createUser();
    const report = await createReport(user.id);
    const version = await createVersion(report.id);

    await prisma.achievement.create({
      data: { reportVersionId: version.id, position: 0, description: 'A', isKeyAchievement: true },
    });

    const message = await expectRejection(() =>
      prisma.achievement.create({
        data: {
          reportVersionId: version.id,
          position: 1,
          description: 'B',
          isKeyAchievement: true,
        },
      }),
    );

    expect(message).toContain('Achievement_key_unique');
  });

  it('scopes the key-flag limit to a single version', async () => {
    // Follows the real correction flow: fill V1, freeze it, then clone into V2.
    // Content must be written before the freeze — the immutability trigger
    // refuses inserts into a submitted version, which is the point of §13.4.
    const user = await createUser();
    const report = await createReport(user.id);

    const v1 = await createVersion(report.id, 1);
    await prisma.blocker.create({
      data: { reportVersionId: v1.id, position: 0, description: 'V1 key', isKeyIssue: true },
    });
    await prisma.reportVersion.update({
      where: { id: v1.id },
      data: { submittedAt: new Date() },
    });

    const v2 = await createVersion(report.id, 2);

    await expect(
      prisma.blocker.create({
        data: { reportVersionId: v2.id, position: 0, description: 'V2 key', isKeyIssue: true },
      }),
    ).resolves.toBeDefined();
  });
});

// ─── same-report pointer integrity ───────────────────────────────────────────

describe('DATA — version pointers cannot cross reports (§13.4)', () => {
  it('rejects a current-version pointer at another report’s version', async () => {
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const reportA = await createReport(a.id);
    const reportB = await createReport(b.id);
    const versionB = await createVersion(reportB.id);

    // Prisma's own foreign key is satisfied — the version exists. Only the
    // composite key catches that it belongs to a different report.
    const message = await expectRejection(() =>
      prisma.report.update({
        where: { id: reportA.id },
        data: { currentVersionId: versionB.id },
      }),
    );

    expect(message).toContain('Report_currentVersion_same_report');
  });

  it('accepts a current-version pointer at its own version', async () => {
    const user = await createUser();
    const report = await createReport(user.id);
    const version = await createVersion(report.id);

    await expect(
      prisma.report.update({ where: { id: report.id }, data: { currentVersionId: version.id } }),
    ).resolves.toBeDefined();
  });

  it('rejects a review attached to another report’s version', async () => {
    const [a, b, manager] = await Promise.all([createUser(), createUser(), createUser()]);
    const reportA = await createReport(a.id);
    const reportB = await createReport(b.id);
    const versionB = await createVersion(reportB.id, 1, new Date());

    const message = await expectRejection(() =>
      prisma.review.create({
        data: {
          reportId: reportA.id,
          reportVersionId: versionB.id,
          reviewerId: manager.id,
          action: 'APPROVE',
        },
      }),
    );

    expect(message).toContain('Review_version_same_report');
  });

  it('rejects a second review on one submitted version', async () => {
    const [member, m1, m2] = await Promise.all([createUser(), createUser(), createUser()]);
    const report = await createReport(member.id);
    const version = await createVersion(report.id, 1, new Date());

    await prisma.review.create({
      data: {
        reportId: report.id,
        reportVersionId: version.id,
        reviewerId: m1.id,
        action: 'APPROVE',
      },
    });

    // This is the database half of "two managers cannot both review" (§16.2).
    const message = await expectRejection(() =>
      prisma.review.create({
        data: {
          reportId: report.id,
          reportVersionId: version.id,
          reviewerId: m2.id,
          action: 'REQUEST_CHANGES',
          comment: 'Please clarify.',
        },
      }),
    );

    expect(message).toMatch(/reportVersionId|unique/i);
  });

  it('requires a non-blank comment when changes are requested', async () => {
    const [member, manager] = await Promise.all([createUser(), createUser()]);
    const report = await createReport(member.id);
    const version = await createVersion(report.id, 1, new Date());

    const message = await expectRejection(() =>
      prisma.review.create({
        data: {
          reportId: report.id,
          reportVersionId: version.id,
          reviewerId: manager.id,
          action: 'REQUEST_CHANGES',
          comment: '   ',
        },
      }),
    );

    expect(message).toContain('Review_request_changes_requires_comment');
  });

  it('allows an approval with no comment', async () => {
    const [member, manager] = await Promise.all([createUser(), createUser()]);
    const report = await createReport(member.id);
    const version = await createVersion(report.id, 1, new Date());

    await expect(
      prisma.review.create({
        data: {
          reportId: report.id,
          reportVersionId: version.id,
          reviewerId: manager.id,
          action: 'APPROVE',
        },
      }),
    ).resolves.toBeDefined();
  });
});

// ─── interval history ────────────────────────────────────────────────────────

describe('DATA — interval history (§13.3)', () => {
  it('rejects a period that ends before it starts', async () => {
    const project = await createProject();
    const user = await createUser();

    const message = await expectRejection(() =>
      prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: user.id,
          assignedAt: new Date('2026-09-05T00:00:00Z'),
          endedAt: new Date('2026-09-01T00:00:00Z'),
        },
      }),
    );

    expect(message).toContain('ProjectMember_period_ordered');
  });

  it('rejects a zero-length period', async () => {
    const project = await createProject();
    const user = await createUser();
    const at = new Date('2026-09-05T00:00:00Z');

    const message = await expectRejection(() =>
      prisma.projectMember.create({
        data: { projectId: project.id, userId: user.id, assignedAt: at, endedAt: at },
      }),
    );

    expect(message).toContain('ProjectMember_period_ordered');
  });

  it('rejects a second open assignment for the same member and project', async () => {
    const project = await createProject();
    const user = await createUser();

    await prisma.projectMember.create({
      data: { projectId: project.id, userId: user.id, assignedAt: new Date('2026-01-01Z') },
    });

    const message = await expectRejection(() =>
      prisma.projectMember.create({
        data: { projectId: project.id, userId: user.id, assignedAt: new Date('2026-06-01Z') },
      }),
    );

    // Either guard is acceptable — both express the same rule.
    expect(message).toMatch(/ProjectMember_open_unique|no_overlapping_periods/);
  });

  it('rejects overlapping CLOSED assignment periods that the partial unique cannot catch', async () => {
    const project = await createProject();
    const user = await createUser();

    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        assignedAt: new Date('2026-01-01T00:00:00Z'),
        endedAt: new Date('2026-06-01T00:00:00Z'),
      },
    });

    const message = await expectRejection(() =>
      prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: user.id,
          assignedAt: new Date('2026-03-01T00:00:00Z'),
          endedAt: new Date('2026-09-01T00:00:00Z'),
        },
      }),
    );

    expect(message).toContain('ProjectMember_no_overlapping_periods');
  });

  it('accepts adjacent, non-overlapping assignment periods', async () => {
    const project = await createProject();
    const user = await createUser();

    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        assignedAt: new Date('2026-01-01T00:00:00Z'),
        endedAt: new Date('2026-06-01T00:00:00Z'),
      },
    });

    // Half-open ranges: a period starting exactly when the previous ended does
    // not overlap, which is what makes remove-then-reassign work.
    await expect(
      prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: user.id,
          assignedAt: new Date('2026-06-01T00:00:00Z'),
        },
      }),
    ).resolves.toBeDefined();
  });

  it('rejects overlapping project activity periods', async () => {
    const project = await createProject();

    await prisma.projectActivityPeriod.create({
      data: {
        projectId: project.id,
        startedAt: new Date('2026-01-01T00:00:00Z'),
        endedAt: new Date('2026-06-01T00:00:00Z'),
      },
    });

    const message = await expectRejection(() =>
      prisma.projectActivityPeriod.create({
        data: { projectId: project.id, startedAt: new Date('2026-05-01T00:00:00Z') },
      }),
    );

    expect(message).toMatch(/ProjectActivityPeriod_(no_overlapping_periods|open_unique)/);
  });

  it('rejects a duplicate project name differing only by case or padding', async () => {
    await createProject('Apollo');

    const message = await expectRejection(() => createProject('  apollo '));

    expect(message).toContain('Project_name_lower_unique');
  });
});

// ─── immutability ────────────────────────────────────────────────────────────

describe('DATA — submitted content is immutable (§13.4)', () => {
  async function submittedVersionWithTask() {
    const user = await createUser();
    const report = await createReport(user.id);
    const version = await createVersion(report.id, 1);
    const task = await prisma.reportTask.create({
      data: { reportVersionId: version.id, position: 0, taskName: 'Original' },
    });

    // Freezing the version is the one permitted transition.
    await prisma.reportVersion.update({
      where: { id: version.id },
      data: { submittedAt: new Date() },
    });

    return { report, version, task };
  }

  it('permits freezing an editable version', async () => {
    const user = await createUser();
    const report = await createReport(user.id);
    const version = await createVersion(report.id);

    await expect(
      prisma.reportVersion.update({
        where: { id: version.id },
        data: { submittedAt: new Date() },
      }),
    ).resolves.toBeDefined();
  });

  it('rejects editing the notes of a submitted version', async () => {
    const { version } = await submittedVersionWithTask();

    const message = await expectRejection(() =>
      prisma.reportVersion.update({ where: { id: version.id }, data: { notes: 'tampered' } }),
    );

    expect(message).toContain('immutable');
  });

  it('rejects re-stamping the submission time of a submitted version', async () => {
    const { version } = await submittedVersionWithTask();

    const message = await expectRejection(() =>
      prisma.reportVersion.update({
        where: { id: version.id },
        data: { submittedAt: new Date('2030-01-01T00:00:00Z') },
      }),
    );

    expect(message).toContain('immutable');
  });

  it('rejects editing a task inside a submitted version', async () => {
    const { task } = await submittedVersionWithTask();

    const message = await expectRejection(() =>
      prisma.reportTask.update({ where: { id: task.id }, data: { taskName: 'Rewritten' } }),
    );

    expect(message).toContain('immutable');
  });

  it('rejects deleting a task from a submitted version', async () => {
    const { task } = await submittedVersionWithTask();

    const message = await expectRejection(() =>
      prisma.reportTask.delete({ where: { id: task.id } }),
    );

    expect(message).toContain('immutable');
  });

  it('rejects adding a task to a submitted version', async () => {
    const { version } = await submittedVersionWithTask();

    const message = await expectRejection(() =>
      prisma.reportTask.create({
        data: { reportVersionId: version.id, position: 5, taskName: 'Smuggled' },
      }),
    );

    expect(message).toContain('immutable');
  });

  it('leaves the editable clone fully writable while the submitted version is frozen', async () => {
    const { report, task } = await submittedVersionWithTask();
    const clone = await createVersion(report.id, 2);

    const copied = await prisma.reportTask.create({
      data: { reportVersionId: clone.id, position: 0, taskName: 'Original' },
    });
    await prisma.reportTask.update({
      where: { id: copied.id },
      data: { taskName: 'Corrected' },
    });

    // V1 is untouched — the whole point of the correction cycle (§7.3).
    const original = await prisma.reportTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(original.taskName).toBe('Original');
  });
});

describe('DATA — audit log is append-only (§14)', () => {
  it('accepts inserts', async () => {
    const user = await createUser();

    await expect(
      prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'USER_REGISTERED',
          entityType: 'User',
          entityId: user.id,
          metadata: { role: 'TEAM_MEMBER' },
        },
      }),
    ).resolves.toBeDefined();
  });

  it('rejects updates and deletes', async () => {
    const user = await createUser();
    const entry = await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user.id,
      },
    });

    const updateMessage = await expectRejection(() =>
      prisma.auditLog.update({ where: { id: entry.id }, data: { action: 'USER_DEACTIVATED' } }),
    );
    const deleteMessage = await expectRejection(() =>
      prisma.auditLog.delete({ where: { id: entry.id } }),
    );

    expect(updateMessage).toContain('append-only');
    expect(deleteMessage).toContain('append-only');
  });
});
