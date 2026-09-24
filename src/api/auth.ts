import apiClient from './client';
import type {
  RegisterRequest,
  VerifyRequest,
  ResendCodeRequest,
  LoginRequest,
  AuthResponse,
} from '../types/api';

/** POST /api/auth/register */
export async function register(data: RegisterRequest): Promise<string> {
  const response = await apiClient.post<string>('/api/auth/register', data);
  return response.data;
}

/** POST /api/auth/verify */
export async function verify(data: VerifyRequest): Promise<string> {
  const response = await apiClient.post<string>('/api/auth/verify', data);
  return response.data;
}

/** POST /api/auth/resend-code */
export async function resendCode(data: ResendCodeRequest): Promise<string> {
  const response = await apiClient.post<string>('/api/auth/resend-code', data);
  return response.data;
}

/** POST /api/auth/login */
export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/api/auth/login', data);
  return response.data;
}
