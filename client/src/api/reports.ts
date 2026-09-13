import { apiClient } from './client';

export interface ReportsOverview {
  generatedAt: string;
  caseVolumeByMonth: { month: string; count: number }[];
  casesByStatus: { status: string; count: number }[];
  avgResolutionDays: number | null;
  overdue: {
    assignmentId: string;
    caseId: string;
    caseNumber: string;
    arbitratorId: string;
    arbitratorName: string;
    dueDate: string;
    daysOverdue: number;
    status: string;
  }[];
  arbitratorWorkload: {
    id: string;
    fullName: string;
    status: string;
    activeCases: number;
    casesClosedCount: number;
    score: string;
  }[];
}

export async function getReportsOverview(): Promise<ReportsOverview> {
  const { data } = await apiClient.get('/reports/overview');
  return data;
}
