export const historyRequest = value => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value ?? '');
export const historyCursor = value => typeof value === 'string' && /^[0-9a-f-]{36}_[1-9][0-9]{0,5}$/.test(value);
