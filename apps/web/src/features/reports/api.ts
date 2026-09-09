import type {
  ApiList,
  ApiSuccess,
  ReportContentInput,
  ReportListItem,
  ReportVersionSummary,
  ReportVersionView,
  ReportView,
  ReviewAction,
  ReviewView,
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
  /** True performs create-and-submit in one transaction (D115). */
  submit?: boolean;
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

/**
 * Submit and resubmit send the current form content, so what is on screen is what
 * gets submitted — never a stale saved draft (§15.6).
 */
export async function submitReport(
  reportId: string,
  input: { expectedRevision: number; expectedVersionId: string; content: ReportContentInput },
  options: { resubmit: boolean },
): Promise<ReportView> {
  const path = options.resubmit ? 'resubmit' : 'submit';
  const { data } = await apiClient.post<ApiSuccess<ReportView>>(
    `/reports/${reportId}/${path}`,
    input,
  );
  return data.data;
}

export async function fetchReport(reportId: string): Promise<ReportView> {
  const { data } = await apiClient.get<ApiSuccess<ReportView>>(`/reports/${reportId}`);
  return data.data;
}

export async function listVersions(reportId: string): Promise<ReportVersionSummary[]> {
  const { data } = await apiClient.get<ApiSuccess<ReportVersionSummary[]>>(
    `/reports/${reportId}/versions`,
  );
  return data.data;
}

export async function fetchVersion(
  reportId: string,
  versionId: string,
): Promise<ReportVersionView> {
  const { data } = await apiClient.get<ApiSuccess<ReportVersionView>>(
    `/reports/${reportId}/versions/${versionId}`,
  );
  return data.data;
}

export async function listReviews(reportId: string): Promise<ReviewView[]> {
  const { data } = await apiClient.get<ApiSuccess<ReviewView[]>>(`/reports/${reportId}/reviews`);
  return data.data;
}

export async function reviewReport(
  reportId: string,
  input: {
    reportVersionId: string;
    expectedRevision: number;
    action: ReviewAction;
    comment?: string | null;
  },
): Promise<ReportView> {
  const { data } = await apiClient.post<ApiSuccess<ReportView>>(
    `/reports/${reportId}/reviews`,
    input,
  );
  return data.data;
}
