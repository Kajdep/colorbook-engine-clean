/**
 * Backend API Client for ColorBook Engine
 * Handles authentication, requests, and error handling
 */

interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  subscriptionTier: string;
  subscriptionStatus: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

interface APIResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

class BackendAPIClient {
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseURL: string = 'http://localhost:3001/api') {
    this.baseURL = baseURL;
    this.loadTokensFromStorage();
  }

  // Token management
  private loadTokensFromStorage(): void {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  private saveTokensToStorage(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  private clearTokensFromStorage(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // HTTP request helper
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add authorization header if token exists
    if (this.accessToken) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${this.accessToken}`,
      };
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle token expiration
        if (response.status === 401 && this.refreshToken) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            // Retry the original request with new token
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${this.accessToken}`,
            };
            const retryResponse = await fetch(url, config);
            const retryData = await retryResponse.json();
            
            if (retryResponse.ok) {
              return { data: retryData };
            } else {
              return { error: retryData.error, message: retryData.message };
            }
          } else {
            // Refresh failed, redirect to login
            this.clearTokensFromStorage();
            window.location.href = '/login';
            return { error: 'Authentication failed', message: 'Please log in again' };
          }
        }

        return { error: data.error, message: data.message };
      }

      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      return { 
        error: 'Network Error', 
        message: error instanceof Error ? error.message : 'Request failed' 
      };
    }
  }

  // Authentication methods
  async register(userData: RegisterData): Promise<APIResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await this.request<{ user: User; tokens: AuthTokens }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.data) {
      this.saveTokensToStorage(response.data.tokens);
    }

    return response;
  }

  async login(credentials: LoginCredentials): Promise<APIResponse<{ user: User; tokens: AuthTokens }>> {
    const response = await this.request<{ user: User; tokens: AuthTokens }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.data) {
      this.saveTokensToStorage(response.data.tokens);
    }

    return response;
  }

  async logout(): Promise<APIResponse> {
    const response = await this.request('/auth/logout', { method: 'POST' });
    this.clearTokensFromStorage();
    return response;
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.saveTokensToStorage(data.tokens);
        return true;
      } else {
        this.clearTokensFromStorage();
        return false;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokensFromStorage();
      return false;
    }
  }

  async getCurrentUser(): Promise<APIResponse<{ user: User }>> {
    return this.request<{ user: User }>('/auth/me');
  }

  // Project methods
  async getProjects(params?: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<APIResponse<{ projects: any[]; pagination: any }>> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/projects${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async getProject(id: string): Promise<APIResponse<{ project: any }>> {
    return this.request(`/projects/${id}`);
  }

  async createProject(projectData: any): Promise<APIResponse<{ project: any }>> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async updateProject(id: string, updates: any): Promise<APIResponse<{ project: any }>> {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(id: string): Promise<APIResponse> {
    return this.request(`/projects/${id}`, { method: 'DELETE' });
  }

  async duplicateProject(id: string, title?: string): Promise<APIResponse<{ project: any }>> {
    return this.request(`/projects/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  // Story methods
  async getStories(projectId: string): Promise<APIResponse<{ stories: any[] }>> {
    return this.request(`/stories?projectId=${projectId}`);
  }

  async createStory(storyData: any): Promise<APIResponse<{ story: any }>> {
    return this.request('/stories', {
      method: 'POST',
      body: JSON.stringify(storyData),
    });
  }

  async updateStory(id: string, updates: any): Promise<APIResponse<{ story: any }>> {
    return this.request(`/stories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteStory(id: string): Promise<APIResponse> {
    return this.request(`/stories/${id}`, { method: 'DELETE' });
  }

  // Image methods
  async uploadImage(file: File, metadata: any): Promise<APIResponse<{ image: any }>> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('metadata', JSON.stringify(metadata));

    return this.request('/images', {
      method: 'POST',
      headers: {}, // Don't set Content-Type for FormData
      body: formData,
    });
  }

  async getImages(projectId: string): Promise<APIResponse<{ images: any[] }>> {
    return this.request(`/images?projectId=${projectId}`);
  }

  async deleteImage(id: string): Promise<APIResponse> {
    return this.request(`/images/${id}`, { method: 'DELETE' });
  }

  // Drawing methods
  async saveDrawing(drawingData: any): Promise<APIResponse<{ drawing: any }>> {
    return this.request('/drawings', {
      method: 'POST',
      body: JSON.stringify(drawingData),
    });
  }

  async getDrawings(projectId: string): Promise<APIResponse<{ drawings: any[] }>> {
    return this.request(`/drawings?projectId=${projectId}`);
  }

  async updateDrawing(id: string, updates: any): Promise<APIResponse<{ drawing: any }>> {
    return this.request(`/drawings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteDrawing(id: string): Promise<APIResponse> {
    return this.request(`/drawings/${id}`, { method: 'DELETE' });
  }

  // Template methods
  async getTemplates(params?: {
    category?: string;
    featured?: boolean;
    public?: boolean;
  }): Promise<APIResponse<{ templates: any[] }>> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/templates${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async createTemplate(templateData: any): Promise<APIResponse<{ template: any }>> {
    return this.request('/templates', {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  // Export methods
  async exportProject(projectId: string, exportType: string, settings: any): Promise<APIResponse<{ export: any }>> {
    return this.request('/exports', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        exportType,
        settings,
      }),
    });
  }

  async getExports(): Promise<APIResponse<{ exports: any[] }>> {
    return this.request('/exports');
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }
}

// Create singleton instance
export const backendAPI = new BackendAPIClient();

export default backendAPI;