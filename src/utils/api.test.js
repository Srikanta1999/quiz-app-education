import { getApiBaseUrl } from '../utils';

describe('getApiBaseUrl', () => {
  const originalApiUrl = process.env.REACT_APP_API_URL;

  afterEach(() => {
    if (originalApiUrl === undefined) {
      delete process.env.REACT_APP_API_URL;
    } else {
      process.env.REACT_APP_API_URL = originalApiUrl;
    }
  });

  it('uses an explicit override when present', () => {
    process.env.REACT_APP_API_URL = 'https://api.example.com/v1';
    expect(getApiBaseUrl()).toBe('https://api.example.com/v1');
  });

  it('uses a relative API base in non-local deployments', () => {
    expect(getApiBaseUrl({ hostname: 'quiz.example.com' })).toBe('/api');
  });

  it('targets the local backend during development', () => {
    expect(getApiBaseUrl({ hostname: 'localhost' })).toBe('http://localhost:5000/api');
  });
});
