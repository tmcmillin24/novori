/** Definitive account/session rejections, distinct from transient network failures. */
export function isDeletedAuthUserError(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === 'user_not_found' || /User from sub claim in JWT does not exist/i.test(value?.message ?? '');
}

export function isAccountRestrictedError(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === 'user_banned'
    || /^User is banned\.?$/i.test(value?.message ?? '')
    || (value?.code === '42501' && /^Your account is restricted\b/i.test(value.message ?? ''));
}

export function isAccountUnavailableError(error: unknown) {
  const value = error as { code?: string; message?: string; name?: string } | null;
  return isDeletedAuthUserError(error) || isAccountRestrictedError(error) || value?.code === 'session_not_found'
    || value?.name === 'AuthSessionMissingError'
    || (value?.code === '42501' && /Account unavailable|Authentication required/.test(value.message ?? ''));
}
