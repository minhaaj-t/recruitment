import { api } from './client';
import type { RecruitmentRequestRow, TimelineEntry } from '../types/models';

export async function listRequests() {
  const { data } = await api.get<RecruitmentRequestRow[]>('/requests');
  return data;
}

export async function getRequest(id: number) {
  const { data } = await api.get<{ request: RecruitmentRequestRow; timeline: TimelineEntry[] }>(
    `/requests/${id}`
  );
  return data;
}

export type CreateRequestBody = {
  jobTitle: string;
  department?: string;
  description: string;
  priority: string;
  requiredCount: number;
  deadline?: string | null;
};

export async function createRequest(body: CreateRequestBody) {
  const { data } = await api.post<RecruitmentRequestRow>('/requests', body);
  return data;
}

export async function hodDecision(id: number, decision: 'approve' | 'reject', comment?: string) {
  const { data } = await api.post<RecruitmentRequestRow>(`/requests/${id}/hod-decision`, {
    decision,
    comment,
  });
  return data;
}

export type HrPatchBody = {
  workflowStatus?: string;
  hrNotes?: string;
  modifiedRequirements?: string;
};

export async function hrUpdate(id: number, body: HrPatchBody) {
  const { data } = await api.patch<RecruitmentRequestRow>(`/requests/${id}/hr`, body);
  return data;
}

export async function adminUpdateRequest(
  id: number,
  body: HrPatchBody & { workflowStatus?: string }
) {
  const { data } = await api.patch<RecruitmentRequestRow>(`/requests/${id}/admin`, body);
  return data;
}

export async function manualReminder(id: number) {
  const { data } = await api.post<{ ok: boolean; notified: number }>(
    `/reminders/request/${id}/manual`
  );
  return data;
}
