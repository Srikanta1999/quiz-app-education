const normalizeBaseUrl = value => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
};

export const getApiBaseUrl = (location = typeof window !== 'undefined' ? window.location : undefined) => {
  const configuredBaseUrl = normalizeBaseUrl(process.env.REACT_APP_API_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (!location || typeof location.hostname !== 'string') {
    return 'http://localhost:5000/api';
  }

  const hostname = location.hostname;
  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '[::1]' ||
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/.test(hostname);

  return isLocalHost ? 'http://localhost:5000/api' : '/api';
};

export const buildApiUrl = path => {
  const baseUrl = getApiBaseUrl();
  if (!path) return baseUrl;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};
