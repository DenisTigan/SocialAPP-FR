import apiClient from './client';
import type { UserResponse } from '../types/api';

/** GET /api/users */
export async function getAllUsers(): Promise<UserResponse[]> {
  const response = await apiClient.get<UserResponse[]>('/api/users');
  return response.data;
}
