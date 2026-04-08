const MAP: Record<string, string> = {
  pending_hod: 'Pending HOD',
  hod_rejected: 'Rejected (HOD)',
  hod_approved: 'Approved — HR queue',
  open: 'Open',
  in_progress: 'In progress',
  on_hold: 'On hold',
  closed: 'Closed',
};

export function workflowLabel(code: string) {
  return MAP[code] || code;
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return '#b71c1c';
    case 'high':
      return '#e65100';
    case 'medium':
      return '#f9a825';
    default:
      return '#546e7a';
  }
}
