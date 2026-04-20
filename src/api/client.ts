import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = useAuthStore.getState().token;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async register(data: {
    email: string;
    password: string;
    role: string;
    displayName: string;
    headline?: string;
    location?: string;
  }) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async forgotPassword(email: string) {
    const response = await this.client.post('/auth/forgot-password', { email });
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.post('/auth/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  }

  // Projects
  async getProjects(params?: Record<string, any>) {
    const response = await this.client.get('/projects', { params });
    return response.data;
  }

  async getFeaturedProjects() {
    const response = await this.client.get('/projects/featured');
    return response.data;
  }

  async getHotProjects() {
    const response = await this.client.get('/projects/hot');
    return response.data;
  }

  async getProject(id: string) {
    const response = await this.client.get(`/projects/${id}`);
    return response.data;
  }

  async createProject(data: any) {
    const response = await this.client.post('/projects', data);
    return response.data;
  }

  async updateProject(id: string, data: any) {
    const response = await this.client.put(`/projects/${id}`, data);
    return response.data;
  }

  async deleteProject(id: string) {
    const response = await this.client.delete(`/projects/${id}`);
    return response.data;
  }

  async promoteProject(id: string, tier: 'hot' | 'super_hot') {
    const response = await this.client.post(`/projects/${id}/promote`, { tier });
    return response.data;
  }

  // Applications
  async getMyApplications(params?: Record<string, any>) {
    const response = await this.client.get('/applications/my', { params });
    return response.data;
  }

  async getProjectApplications(projectId: string, params?: Record<string, any>) {
    const response = await this.client.get(`/applications/project/${projectId}`, { params });
    return response.data;
  }

  async applyToProject(data: {
    projectId: string;
    coverLetter: string;
    proposedBudget?: number;
    proposedDuration?: number;
    attachments?: string[];
  }) {
    const response = await this.client.post('/applications', data);
    return response.data;
  }

  async updateApplicationStatus(id: string, status: string, notes?: string) {
    const response = await this.client.patch(`/applications/${id}/status`, { status, notes });
    return response.data;
  }

  async withdrawApplication(id: string) {
    const response = await this.client.delete(`/applications/${id}`);
    return response.data;
  }

  // Messages
  async getConversations() {
    const response = await this.client.get('/messages/conversations');
    return response.data;
  }

  async getMessages(userId: string, params?: Record<string, any>) {
    const response = await this.client.get(`/messages/${userId}`, { params });
    return response.data;
  }

  async sendMessage(data: {
    recipientId: string;
    content: string;
    projectId?: string;
    contractId?: string;
    attachments?: string[];
  }) {
    const response = await this.client.post('/messages', data);
    return response.data;
  }

  async getUnreadMessageCount() {
    const response = await this.client.get('/messages/unread/count');
    return response.data;
  }

  // Payments
  async getWallet() {
    const response = await this.client.get('/payments/wallet');
    return response.data;
  }

  async getTransactions(params?: Record<string, any>) {
    const response = await this.client.get('/payments/transactions', { params });
    return response.data;
  }

  async createDepositIntent(amount: number) {
    const response = await this.client.post('/payments/deposit/intent', { amount });
    return response.data;
  }

  async confirmDeposit(paymentIntentId: string) {
    const response = await this.client.post('/payments/deposit/confirm', { paymentIntentId });
    return response.data;
  }

  async withdraw(amount: number, method: string, accountDetails: any) {
    const response = await this.client.post('/payments/withdraw', {
      amount,
      method,
      accountDetails
    });
    return response.data;
  }

  async fundEscrow(contractId: string, amount: number, milestoneId?: string) {
    const response = await this.client.post('/payments/escrow/fund', {
      contractId,
      amount,
      milestoneId
    });
    return response.data;
  }

  async releaseEscrow(escrowId: string) {
    const response = await this.client.post('/payments/escrow/release', { escrowId });
    return response.data;
  }

  // Tests
  async getTestTemplates(params?: Record<string, any>) {
    const response = await this.client.get('/tests/templates', { params });
    return response.data;
  }

  async getTestTemplate(id: string) {
    const response = await this.client.get(`/tests/templates/${id}`);
    return response.data;
  }

  async createTestTemplate(data: any) {
    const response = await this.client.post('/tests/templates', data);
    return response.data;
  }

  async startTest(testTemplateId: string) {
    const response = await this.client.post('/tests/attempts', { testTemplateId });
    return response.data;
  }

  async submitTest(attemptId: string, answers: any[]) {
    const response = await this.client.post(`/tests/attempts/${attemptId}/submit`, { answers });
    return response.data;
  }

  async getMyTestAttempts() {
    const response = await this.client.get('/tests/attempts/my');
    return response.data;
  }

  // Users
  async getProfile(userId?: string) {
    const url = userId ? `/users/profile/${userId}` : '/users/profile';
    const response = await this.client.get(url);
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await this.client.put('/users/profile', data);
    return response.data;
  }

  async completeProfile(data: any) {
    const response = await this.client.post('/users/profile/complete', data);
    return response.data;
  }

  async getProfileCompletionStatus() {
    const response = await this.client.get('/users/profile/status/completion');
    return response.data;
  }

  async addSkill(skillId: string, proficiencyLevel?: number) {
    const response = await this.client.post('/users/skills', { skillId, proficiencyLevel });
    return response.data;
  }

  async removeSkill(skillId: string) {
    const response = await this.client.delete(`/users/skills/${skillId}`);
    return response.data;
  }

  async addPortfolioItem(data: any) {
    const response = await this.client.post('/users/portfolio', data);
    return response.data;
  }

  async deletePortfolioItem(id: string) {
    const response = await this.client.delete(`/users/portfolio/${id}`);
    return response.data;
  }

  async searchFreelancers(params?: Record<string, any>) {
    const response = await this.client.get('/users/search', { params });
    return response.data;
  }

  async getSkills() {
    const response = await this.client.get('/users/skills/list');
    return response.data;
  }

  // Dashboard
  async getFreelancerDashboard() {
    const response = await this.client.get('/dashboard/freelancer');
    return response.data;
  }

  async getClientDashboard() {
    const response = await this.client.get('/dashboard/client');
    return response.data;
  }

  async getNotifications(params?: Record<string, any>) {
    const response = await this.client.get('/dashboard/notifications', { params });
    return response.data;
  }

  async markNotificationRead(id: string) {
    const response = await this.client.patch(`/dashboard/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsRead() {
    const response = await this.client.post('/dashboard/notifications/read-all');
    return response.data;
  }

  // Admin
  async getAdminStats() {
    const response = await this.client.get('/admin/stats');
    return response.data;
  }

  async getAdminUsers(params?: Record<string, any>) {
    const response = await this.client.get('/admin/users', { params });
    return response.data;
  }

  async updateUserStatus(id: string, status: string, reason?: string) {
    const response = await this.client.patch(`/admin/users/${id}/status`, { status, reason });
    return response.data;
  }

  async getAdminProjects(params?: Record<string, any>) {
    const response = await this.client.get('/admin/projects', { params });
    return response.data;
  }

  async getAdminTransactions(params?: Record<string, any>) {
    const response = await this.client.get('/admin/transactions', { params });
    return response.data;
  }

  async getAdminDisputes(params?: Record<string, any>) {
    const response = await this.client.get('/admin/disputes', { params });
    return response.data;
  }

  async resolveDispute(id: string, resolution: string, action?: string) {
    const response = await this.client.post(`/admin/disputes/${id}/resolve`, { resolution, action });
    return response.data;
  }

  async getPlatformSettings() {
    const response = await this.client.get('/admin/settings');
    return response.data;
  }

  async updatePlatformSetting(key: string, value: string, description?: string) {
    const response = await this.client.put(`/admin/settings/${key}`, { value, description });
    return response.data;
  }
}

export const api = new ApiClient();
