import type { ClubRole } from './clubs';

export type ClubHomeAction = 'edit' | 'rules' | 'members' | 'manage' | 'guide' | 'notifications' | 'notification_settings' | 'leave';
export function getClubHomeActions(role: ClubRole | null, canViewMembers: boolean, hasRules: boolean): ClubHomeAction[] {
  const actions: ClubHomeAction[] = [];
  if (role === 'owner') actions.push('edit');
  if (hasRules || role === 'owner') actions.push('rules');
  if (canViewMembers) actions.push('members');
  if (role === 'owner' || role === 'admin') actions.push('manage');
  if (role) actions.push('guide','notifications','notification_settings');
  if (role && role !== 'owner') actions.push('leave');
  return actions;
}

export function validateClubRules(value: string | undefined): string {
  const rules = (value ?? '').trim();
  if (rules.length > 2000) throw new Error('Club rules can be up to 2,000 characters.');
  return rules;
}
