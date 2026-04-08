const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export function validateCreateRequest(input: {
  jobTitle: string;
  description: string;
  priority: string;
  requiredCount: string;
}) {
  const errors: Record<string, string> = {};
  if (!input.jobTitle.trim() || input.jobTitle.trim().length < 2) {
    errors.jobTitle = 'Job title is required (min 2 characters)';
  }
  if (!input.description.trim() || input.description.trim().length < 5) {
    errors.description = 'Description is required (min 5 characters)';
  }
  if (!PRIORITIES.includes(input.priority as (typeof PRIORITIES)[number])) {
    errors.priority = 'Select a valid priority';
  }
  const n = parseInt(input.requiredCount, 10);
  if (Number.isNaN(n) || n < 1) {
    errors.requiredCount = 'Required count must be at least 1';
  }
  return errors;
}

export function validateLogin(email: string, password: string) {
  const errors: Record<string, string> = {};
  if (!email.includes('@')) {
    errors.email = 'Enter a valid email';
  }
  if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  return errors;
}
