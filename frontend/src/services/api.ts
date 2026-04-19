/**
 * API Services for CV Pilot
 * Wraps axios calls to the backend
 */

import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// CV API
export const cvAPI = {
  upload: (file: File, cvType: string = 'base') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('cv_type', cvType);
    return api.post('/api/cv/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  list: (cvType?: string) => {
    const url = cvType ? `/api/cv/list?cv_type=${cvType}` : '/api/cv/list';
    return api.get(url);
  },

  download: (cvId: string) => {
    return api.get(`/api/cv/${cvId}/download`, { responseType: 'blob' });
  },

  delete: (cvId: string) => api.delete(`/api/cv/${cvId}`),
};

// Job Description API
export const jdAPI = {
  create: (fullText: string, roleTitle?: string, companyName?: string, vendorName?: string, clientName?: string, clientEmail?: string, notes?: string) => {
    return api.post('/api/jd/create', {
      full_text: fullText,
      role_title: roleTitle,
      company_name: companyName,
      vendor_name: vendorName,
      client_name: clientName,
      client_email: clientEmail,
      notes: notes,
    });
  },

  list: () => api.get('/api/jd/list'),

  checkDuplicate: (jdText: string, clientEmail?: string) => {
    return api.post('/api/jd/check-duplicate', { jd_text: jdText, client_email: clientEmail });
  },
};

// Generation API
export const generationAPI = {
  generate: (jdId: string, baseCvIds: string[], templateCvId?: string, selectedModel?: string) => {
    return api.post('/api/cv/generate', {
      jd_id: jdId,
      base_cv_ids: baseCvIds,
      template_cv_id: templateCvId,
      selected_model: selectedModel,
    });
  },

  getStatus: (generationId: string) => api.get(`/api/generation/${generationId}`),

  list: () => api.get('/api/generation/list'),

  matchLibrary: (jdText: string) => api.post('/api/cv/match', { jd_text: jdText }),
};

// Model API
export const modelAPI = {
  getAvailable: () => api.get('/api/models/available'),
  setPreferred: (modelId: string) => api.post('/api/models/set-preferred', { model_id: modelId }),
  getAdmin: () => api.get('/api/admin/models'),
  updateAdmin: (modelId: string, data: any) => api.patch(`/api/admin/models/${modelId}`, data),
  getUser: (userId: string) => api.get(`/api/admin/users/${userId}/model`),
  updateUser: (userId: string, modelId: string, reason?: string) => {
    return api.patch(`/api/admin/users/${userId}/model`, { model: modelId, reason });
  },
};

// Bulk Generation API
export const bulkAPI = {
  generate: (data: any) => api.post('/api/cv/bulk-generate', data),
  getStatus: (bulkJobId: string) => api.get(`/api/cv/bulk-generate/${bulkJobId}`),
  list: () => api.get('/api/cv/bulk-jobs'),
};

// Submission API
export const submissionAPI = {
  create: (data: any) => api.post('/api/submissions', data),
  list: (status?: string) => api.get(status ? `/api/submissions?status=${status}` : '/api/submissions'),
  get: (submissionId: string) => api.get(`/api/submissions/${submissionId}`),
  update: (submissionId: string, data: any) => api.patch(`/api/submissions/${submissionId}`, data),
  delete: (submissionId: string) => api.delete(`/api/submissions/${submissionId}`),
};

// Alias for backwards compatibility
export const submissionsAPI = submissionAPI;

// Export auth store
export { useAuthStore };

// Admin API
export const adminAPI = {
  listUsers: () => api.get('/api/admin/users'),
  getUserActivity: (userId: string) => api.get(`/api/admin/users/${userId}/activity`),
  getActivityStream: () => api.get('/api/admin/activity'),
  getStats: () => api.get('/api/admin/stats'),
  getUsage: () => api.get('/api/admin/usage'),
  getUserUsage: (userId: string) => api.get(`/api/admin/users/${userId}/usage`),
  generateCV: (data: any) => api.post('/api/admin/generate', data),
};

// Activity API
export const activityAPI = {
  getHistory: () => api.get('/api/history'),
};

// Auth API
export const authAPI = {
  register: (email: string, password: string, fullName: string) => {
    return api.post('/api/auth/register', { email, password, full_name: fullName });
  },
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),
  logout: () => {
    localStorage.removeItem('access_token');
    return Promise.resolve();
  },
};

export default api;
