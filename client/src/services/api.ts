const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('sennet_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

// Auth
export interface AuthResponse {
  token: string;
  user: { id: string; username: string; displayName: string; houseColor: string };
}

export const api = {
  register: (username: string, password: string, displayName: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
    }),

  login: (username: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getProfile: () => request<any>('/profile/me'),

  updateProfile: (data: { displayName?: string; houseColor?: string }) =>
    request<any>('/profile/me', { method: 'PATCH', body: JSON.stringify(data) }),

  getFriends: () => request<any>('/friends'),

  getPendingRequests: () => request<any>('/friends/pending'),

  addFriend: (username: string) =>
    request<any>('/friends/add', { method: 'POST', body: JSON.stringify({ username }) }),

  respondFriend: (friendshipId: string, accept: boolean) =>
    request<any>('/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ friendshipId, accept }),
    }),
};
