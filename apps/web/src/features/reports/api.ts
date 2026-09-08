import type {
  ApiList,
  ApiSuccess,
  ReportContentInput,
  ReportListItem,
  ReportView,
  WeeklyReportContext,
} from '@weekflow/shared';
import { apiClient } from '@/lib/api-client';

/** Weekly report transport (§15.6). */

export async function fetchWeeklyContext(weekStart?: string): Promise<WeeklyReportContext> {
  const { data } = await apiClient.get<ApiSuccess<WeeklyReportContext>>('/reports/current', {
    params: weekStart ? { weekStart } : undefined,
  });
  return data.data;
}

export async function createReport(input: {
  weekStart: string;
  content: ReportContentInput;
}): Promise<ReportView> {
  const { data } = await apiClient.post<ApiSuccess<ReportView>>('/reports', input);
  return data.data;
}

export async function saveDraft(
  reportId: string,
  input: { expectedRevision: number; expectedVersionId: string; content: ReportContentInput },
): Promise<ReportView> {
  const { data } = await apiClient.patch<ApiSuccess<ReportView>>(
    `/reports/${reportId}/draft`,
    input,
  );
  return data.data;
}

export async function listMyReports(page = 1): Promise<ApiList<ReportListItem>> {
  const { data } = await apiClient.get<ApiList<ReportListItem>>('/reports/mine', {
    params: { page },
  });
  return data;
}
