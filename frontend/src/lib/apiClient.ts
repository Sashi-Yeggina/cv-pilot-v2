/**
 * API Client for CV Pilot Backend
 * Handles all HTTP requests to the FastAPI backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private loadToken(): void {
    this.token = localStorage.getItem('access_token');
  }

  private setToken(token: string): void {
    this.token = token;
    localStorage.setItem('access_token', token);
  }

  private getHeaders(headers?: Record<string, string>): Record<string, string> {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      defaultHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    return { ...defaultHeaders, ...headers };
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { method = 'GET', body, headers } = options;
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(headers),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          this.token = null;
          // Redirect to login
          window.location.href = '/login';
        }
        throw new Error(`API Error: ${response.statusText}`);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      console.error(`API Request Error [${method} ${endpoint}]:`, error);
      throw error;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // AUTH ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  async register(email: string, password: string, fullName: string) {
    const response = await this.request<any>('/api/auth/register', {
      method: 'POST',
      body: { email, password, full_name: fullName },
    });
    if (response.access_token) {
      this.setToken(response.access_token);
    }
    return response;
  }

  async login(email: string, password: string) {
    const response = await this.request<any>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (response.access_token) {
      this.setToken(response.access_token);
    }
    return response;
  }

  async logout() {
    localStorage.removeItem('access_token');
    this.token = null;
    return { success: true };
  }

  // ────────────────────────────────────────────────────────────────
  // MODEL ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  async getAvailableModels() {
    return this.request<{
      models: any[];
      default: string;
    }>('/api/models/available');
  }

  async setPreferredModel(modelId: string) {
    return this.request<any>('/api/models/set-preferred', {
      method: 'POST',
      body: { model_id: modelId },
    });
  }

  async getAdminModels() {
    return this.request<{ models: any[] }>('/api/admin/models');
  }

  async updateAdminModel(modelId: string, data: any) {
    return this.request<any>(`/api/admin/models/${modelId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async getUserModel(userId: string) {
    return this.request<any>(`/api/admin/users/${userId}/model`);
  }

  async updateUserModel(userId: string, modelId: string, reason?: string) {
    return this.request<any>(`/api/admin/users/${userId}/model`, {
      method: 'PATCH',
      body: { model: modelId, reason },
    });
  }

  // ────────────────────────────────────────────────────────────────
  // CV ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  async uploadCV(file: File, cvType: string = 'base') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('cv_type', cvType);

    const response = await fetch(`${this.baseUrl}/api/cv/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload CV');
    return response.json();
  }

  async listCVs(cvType?: string) {
    const url = cvType
      ? `/api/cv/list?cv_type=${cvType}`
      : '/api/cv/list';
    return this.request<any>(url);
  }

  async downloadCV(cvId: string) {
    const response = await fetch(
      `${this.baseUrl}/api/cv/${cvId}/download`,
      {
        headers: { Authorization: `Bearer ${this.token}` },
      }
    );
    if (!response.ok) throw new Error('Failed to download CV');
    return response.blob();
  }

  async deleteCV(cvId: string) {
    return this.request<any>(`/api/cv/${cvId}`, {
      method: 'DELETE',
    });
  }

  // ────────────────────────────────────────────────────────────────
  // JOB DESCRIPTION ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  async createJD(data: any) {
    return this.request<any>('/api/jd/create', {
      method: 'POST',
      body: data,
    });
  }

  async listJDs() {
    return this.request<any>('/api/jd/list');
  }

  async checkJDDuplicate(jdText: string, clientEmail?: string) {
    return this.request<any>('/api/jd/check-duplicate', {
      method: 'POST',
      body: { jd_text: jdText, client_email: clientEmail },
    });
  }

  // ────────────────────────────────────────────────────────────────
  // GENERATION ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  async generateCV(data: {
    jd_id: string;
    base_cv_ids: string[];
    template_cv_id?: string;
    selected_model?: string;
  }) {
    return this.request<any>('/api/cv/generate', {
      method: 'POST',
      body: data,
    });
  }

  async getGeneration(generationId: string) {
    return this.request<any>(`/api/generation/${generationId}`);
  }

  async listGenerations() {
    return this.request<any>('/api/generation/list');
  }

  async matchCVToJD(jdText: string) {
    return this.request<any>('/api/cv/match', {
      method: 'POST',
      body: { jd_text: jdText },
    });
  }

  // ────────────────────────────────────────────────────────────────
  // BULK GENERATION ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  async bulkGenerateCV(data: any) {
    return this.request<any>('/api/cv/bulk-generate', {
      method: 'POST',
      body: data,
    });
  }

  async getBulkJobStatus(bulkJobId: string) {
    return this.request<any>(`/api/cv/bulk-generate/${bulkJobId}`);
  }

  async listBulkJobs() {
    return this.request<any>('/api/cv/bulk-jobs');
  }

  // ────────────────────────────────────────────────────────────────
  // SUBMISSION ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  async createSubmission(data: any) {
    return this.request<any>('/api/submissions', {
      method: 'POST',
      body: data,
    });
  }

  async listSubmissions(status?: string) {
    const url = status
      ? `/api/submissions?status=${status}`
      : '/api/submissions';
    return this.request<any>(url);
  }

  async getSubmission(submissionId: string) {
    return this.request<any>(`/api/submissions/${submissionId}`);
  }

  async updateSubmission(submissionId: string, data: any) {
    return this.request<any>(`/api/submissions/${submissionId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteSubmission(submissionId: string) {
    return this.request<any>(`/api/submissions/${submissionId}`, {
      method: 'DELETE',
    });
  }

  // ────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  async adminListUsers() {
    return this.request<any>('/api/admin/users');
  }

  async adminGetUserActivity(userId: string) {
    return this.request<any>(`/api/admin/users/${userId}/activity`);
  }

  async adminGetActivityStream() {
    return this.request<any>('/api/admin/activity');
  }

  async adminGetStats() {
    return this.request<any>('/api/admin/stats');
  }

  async adminGetUsage() {
    return this.request<any>('/api/admin/usage');
  }

  async adminGetUserUsage(userId: string) {
    return this.request<any>(`/api/admin/users/${userId}/usage`);
  }

  async adminGenerateCV(data: any) {
    return this.request<any>('/api/admin/generate', {
      method: 'POST',
      body: data,
    });
  }

  // ────────────────────────────────────────────────────────────────
  // ACTIVITY/HISTORY ENDPOINTS
  // ────────────────────────────────────────────────────────────────

  async getActivityHistory() {
    return this.request<any>('/api/history');
  }

  // ────────────────────────────────────────────────────────────────
  // UTILITY
  // ────────────────────────────────────────────────────────────────

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
