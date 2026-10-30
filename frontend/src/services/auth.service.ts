import apiClient, { extractData } from '@/lib/apiClient';
import type { AuthResponse, LoginInput, RegisterInput } from '@/types';

export async function login(input: LoginInput): Promise<AuthResponse> {
  const res = await apiClient.post('/auth/login', input);
  return extractData<AuthResponse>(res);
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const res = await apiClient.post('/auth/register', input);
  return extractData<AuthResponse>(res);
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getCurrentUser(): Promise<AuthResponse['user']> {
  const res = await apiClient.get('/auth/me');
  const data = extractData<{ user: AuthResponse['user'] }>(res);
  return data.user;
}
