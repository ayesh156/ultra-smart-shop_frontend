import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// ===================================
// Token Management (In-Memory + localStorage)
// ===================================

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'uss_token',
  REFRESH_TOKEN: 'uss_refresh_token',
  CACHED_USER: 'uss_user',
  CACHED_SHOP: 'uss_shop',
} as const;

let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  if (token) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  }
};

export const getAccessToken = (): string | null => {
  if (!accessToken) {
    accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }
  return accessToken;
};

export const setRefreshToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  }
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
};

export const setCachedUser = (user: unknown): void => {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.CACHED_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CACHED_USER);
  }
};

export const getCachedUser = (): unknown => {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.CACHED_USER);
    return cached ? JSON.parse(cached) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEYS.CACHED_USER);
    return null;
  }
};

export const setCachedShop = (shop: unknown): void => {
  if (shop) {
    localStorage.setItem(STORAGE_KEYS.CACHED_SHOP, JSON.stringify(shop));
  } else {
    localStorage.removeItem(STORAGE_KEYS.CACHED_SHOP);
  }
};

export const getCachedShop = (): unknown => {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.CACHED_SHOP);
    return cached ? JSON.parse(cached) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEYS.CACHED_SHOP);
    return null;
  }
};

export const clearAllTokens = (): void => {
  accessToken = null;
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
};

/** Check if a JWT token is expired (client-side, without signature verification) */
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // 30s buffer so we refresh slightly before actual expiry
    return payload.exp * 1000 < Date.now() + 30000;
  } catch {
    return true;
  }
};

// ===================================
// Axios Instance
// ===================================

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;

// Queue of failed requests waiting for token refresh
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null): void => {
  failedQueue.forEach(promise => {
    if (error) promise.reject(error);
    else if (token) promise.resolve(token);
  });
  failedQueue = [];
};

// Request interceptor — attach access token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor — handle 401, auto-refresh, silent logout
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<{ success: boolean; message: string; code?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;

    // Only handle 401 (not refresh/login requests themselves)
    if (
      status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      const errorCode = error.response?.data?.code;

      // Only try refresh if token is expired (not for invalid/missing tokens)
      if (errorCode === 'TOKEN_EXPIRED' || !errorCode) {
        if (isRefreshing) {
          // Already refreshing — queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          }).catch(err => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Try refresh with stored refresh token (body fallback for cookie issues)
          const storedRefreshToken = getRefreshToken();
          const { data } = await axios.post(
            `${API_URL}/auth/refresh`,
            { refreshToken: storedRefreshToken },
            { withCredentials: true }
          );

          if (data.success && data.data.accessToken) {
            const newToken = data.data.accessToken;
            setAccessToken(newToken);

            // Store new refresh token if rotated
            if (data.data.refreshToken) {
              setRefreshToken(data.data.refreshToken);
            }
            // Update cached user/shop if returned
            if (data.data.user) setCachedUser(data.data.user);
            if (data.data.shop) setCachedShop(data.data.shop);

            processQueue(null, newToken);

            // Retry original request with new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return api(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed — session expired, silent logout
          processQueue(refreshError as Error, null);
          clearAllTokens();

          // Dispatch event for AuthContext to handle (no hard redirect, no error toast)
          window.dispatchEvent(new CustomEvent('auth:logout', {
            detail: { reason: 'session_expired' },
          }));

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    }

    // Handle network errors / server down / no internet
    if (!error.response) {
      // No response at all — network error, server down, or no internet
      if (!navigator.onLine) {
        toast.error('No internet connection. Please check your network and try again', { id: 'network-offline' });
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Request timed out. The server is taking too long to respond', { id: 'network-timeout' });
      } else {
        toast.error('Unable to connect to the server. Please try again in a moment', { id: 'network-error' });
      }
    }

    return Promise.reject(error);
  }
);

export default api;
