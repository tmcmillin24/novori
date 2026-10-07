// Keep the notice across SIGNED_OUT redirects that can replace a route query.
let restricted = false;
export const accountRestrictionNotice = {
  title: 'Account access restricted',
  message: 'Your access to Novori has been restricted. Contact support@novori.link if you have questions or want to appeal.',
};
export function rememberAccountRestriction() { restricted = true; }
export function clearAccountRestrictionNotice() { restricted = false; }
export function hasAccountRestrictionNotice() { return restricted; }
export const restrictedAccountRoute = '/auth?notice=restricted' as const;
