import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: (email: string, password: string, fullName: string) =>
    api.post('/auth/register', { email, password, full_name: fullName }),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  logout: () =>
    api.post('/auth/logout'),
};

// CV API
export const cvAPI = {
  upload: (file: File, cvType: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('cv_type', cvType);
    return api.post('/cv/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  list: (cvType?: string) =>
    api.get('/cv/list', { params: { cv_type: cvType } }),

  download: (cvId: string) =>
    api.get(`/cv/${cvId}/download`),

  delete: (cvId: string) =>
    api.delete(`/cv/${cvId}`),
};

// JD API
export const jdAPI = {
  create: (
    fullText: string,
    roleTitle?: string,
    companyName?: string,
    vendorName?: string,
    clientName?: string,
    clientEmail?: string,
    notes?: string,
  ) =>
    api.post('/jd/create', {
      full_text:    fullText,
      role_title:   roleTitle,
      company_name: companyName,
      vendor_name:  vendorName,
      client_name:  clientName,
      client_email: clientEmail,
      notes,
    }),

  list: () =>
    api.get('/jd/list'),

  /** Check if the same JD + client_email was already processed by another user. */
  checkDuplicate: (jdText: string, clientEmail?: string) =>
    api.post('/jd/check-duplicate', { jd_text: jdText, client_email: clientEmail }),
};

// Generation API
export const generationAPI = {
  generate: (jdId: string, baseCvIds: string[], templateCvId?: string) =>
    api.post('/cv/generate', { jd_id: jdId, base_cv_ids: baseCvIds, template_cv_id: templateCvId }),

  getStatus: (generationId: string) =>
    api.get(`/generation/${generationId}`),

  list: () =>
    api.get('/generation/list'),

  /** Check library coverage before generating — no full AI generation triggered */
  matchLibrary: (jdText: string) =>
    api.post('/cv/match', { jd_text: jdText }),
};

// Bulk Generation API
export interface BulkJDItem {
  jd_text: string;
  role_title?: string;
  vendor_name?: string;
  client_name?: string;
  client_email?: string;
  notes?: string;
}

export const bulkAPI = {
  generate: (baseCvIds: string[], items: BulkJDItem[], templateCvId?: string) =>
    api.post('/cv/bulk-generate', {
      base_cv_ids:    baseCvIds,
      template_cv_id: templateCvId,
      items,
    }),

  getJob: (bulkJobId: string) =>
    api.get(`/cv/bulk-generate/${bulkJobId}`),

  listJobs: () =>
    api.get('/cv/bulk-jobs'),
};

// Submissions API
export const submissionsAPI = {
  list: (status?: string) =>
    api.get('/submissions', { params: status ? { status } : {} }),

  get: (submissionId: string) =>
    api.get(`/submissions/${submissionId}`),

  create: (data: {
    generation_id?: string;
    cv_id?: string;
    jd_id?: string;
    candidate_name?: string;
    vendor_name?: string;
    client_name?: string;
    client_email?: string;
    role_title?: string;
    notes?: string;
  }) => api.post('/submissions', data),

  update: (submissionId: string, data: {
    status?: string;
    notes?: string;
    submitted_at?: string;
    follow_up_at?: string;
    interview_at?: string;
  }) => api.patch(`/submissions/${submissionId}`, data),

  delete: (submissionId: string) =>
    api.delete(`/submissions/${submissionId}`),
};

// History API
export const historyAPI = {
  getActivity: () =>
    api.get('/history'),
};

// Admin API
export const adminAPI = {
  getUsers: () =>
    api.get('/admin/users'),

  getUserActivity: (userId: string) =>
    api.get(`/admin/users/${userId}/activity`),

  getActivityStream: () =>
    api.get('/admin/activity'),

  getStats: () =>
    api.get('/admin/stats'),

  // ── Model management ──────────────────────────────────────────
  listModels: () =>
    api.get('/admin/models'),

  getUserModel: (userId: string) =>
    api.get(`/admin/users/${userId}/model`),

  updateUserModel: (userId: string, model: string, reason?: string) =>
    api.patch(`/admin/users/${userId}/model`, { model, reason }),

  // ── Usage & Cost ──────────────────────────────────────────────
  /** All-users cost/token summary for the Usage & Cost tab */
  getUsage: () =>
    api.get('/admin/usage'),

  /** Per-user detailed cost breakdown */
  getUserUsage: (userId: string) =>
    api.get(`/admin/users/${userId}/usage`),

  // ── Admin Generate ────────────────────────────────────────────
  /** Fetch a user's CVs (to populate the admin generate form) */
  getUserCVs: (userId: string) =>
    api.get(`/admin/users/${userId}/cvs`),

  /** Fetch a user's saved JDs */
  getUserJDs: (userId: string) =>
    api.get(`/admin/users/${userId}/jds`),

  /** Trigger CV generation on behalf of a user */
  generateForUser: (
    targetUserId: string,
    jdText: string,
    baseCvIds: string[],
    templateCvId?: string,
  ) =>
    api.post('/admin/generate', {
      target_user_id: targetUserId,
      jd_text:        jdText,
      base_cv_ids:    baseCvIds,
      template_cv_id: templateCvId,
    }),
};
