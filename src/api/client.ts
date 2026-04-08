import axios from 'axios';
import { API_BASE_URL } from '../constants/config';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const base = API_BASE_URL;
    if (err.response?.data?.error) {
      return Promise.reject(new Error(String(err.response.data.error)));
    }
    if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
      return Promise.reject(
        new Error(
          `Cannot reach API at ${base}. Start the server (npm run api), check EXPO_PUBLIC_API_URL in .env, and on a real phone use your PC's LAN IP (not localhost).`
        )
      );
    }
    const msg = err.message || 'Request failed';
    return Promise.reject(new Error(msg));
  }
);
