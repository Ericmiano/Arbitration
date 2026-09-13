import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

export const reportRoutes = Router();

reportRoutes.use(requireAuth, requireRole('admin', 'registrar', 'staff'));

interface MonthCount {
  month: string;
  count: bigint;
}

reportRoutes.get('/overview', async (_req, res, next) => {
  try {
    const [caseVolumeRaw, casesByStatus, avgResolutionRaw, overdueAssignments, arbitrators] = await Promise.all([
      prisma.$queryRaw<MonthCount[]>`
        SELECT DATE_FORMAT(filed_at, '%Y-%m') AS month, COUNT(*) AS count
        FROM cases
        WHERE filed_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY month
        ORDER BY month ASC
      `,
      prisma.cases.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.$queryRaw<{ avgDays: number | null }[]>`
        SELECT AVG(DATEDIFF(concluded_at, filed_at)) AS avgDays
        FROM cases
        WHERE concluded_at IS NOT NULL
      `,
      prisma.assignments.findMany({
        where: { status: { in: ['overdue', 'escalated'] } },
        include: {
          cases: { select: { id: true, case_number: true } },
          arbitrators: { select: { id: true, full_name: true } },
        },
        orderBy: { due_date: 'asc' },
      }),
      prisma.arbitrators.findMany({
        select: {
          id: true,
          full_name: true,
          score: true,
          cases_closed_count: true,
          status: true,
          assignments: {
            where: { status: { in: ['ongoing', 'overdue', 'escalated'] } },
            select: { id: true },
          },
        },
        orderBy: { full_name: 'asc' },
      }),
    ]);

    const now = Date.now();

    res.json({
      generatedAt: new Date().toISOString(),
      caseVolumeByMonth: caseVolumeRaw.map((row) => ({ month: row.month, count: Number(row.count) })),
      casesByStatus: casesByStatus.map((row) => ({ status: row.status, count: row._count._all })),
      avgResolutionDays: avgResolutionRaw[0]?.avgDays !== null && avgResolutionRaw[0]?.avgDays !== undefined
        ? Math.round(Number(avgResolutionRaw[0].avgDays) * 10) / 10
        : null,
      overdue: overdueAssignments.map((a) => ({
        assignmentId: a.id,
        caseId: a.case_id,
        caseNumber: a.cases.case_number,
        arbitratorId: a.arbitrator_id,
        arbitratorName: a.arbitrators.full_name,
        dueDate: a.due_date,
        daysOverdue: Math.max(0, Math.floor((now - a.due_date.getTime()) / (24 * 60 * 60 * 1000))),
        status: a.status,
      })),
      arbitratorWorkload: arbitrators.map((a) => ({
        id: a.id,
        fullName: a.full_name,
        status: a.status,
        activeCases: a.assignments.length,
        casesClosedCount: a.cases_closed_count,
        score: a.score,
      })),
    });
  } catch (error) {
    next(error);
  }
});
