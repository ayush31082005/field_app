export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || 'https://field-app-server.vercel.app'
).replace(/\/$/, '');

const withBaseUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

/** Central request client for every GeetPay backend API call. */
export const apiFetch = (path: string, options: RequestInit = {}) =>
  fetch(withBaseUrl(path), {
    ...options,
    credentials: 'include',
  });

/** Converts a backend upload path into a browser-loadable absolute URL. */
export const apiAssetUrl = (path: string | null | undefined) =>
  path ? withBaseUrl(path) : '';
