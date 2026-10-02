import apiClient from './client';
import type {
  UserResponse,
  UserProfileResponse,
  UpdateBioRequest,
  PhotoResponse,
} from '../types/api';

/** GET /api/users */
export async function getAllUsers(): Promise<UserResponse[]> {
  const response = await apiClient.get<UserResponse[]>('/api/users');
  return response.data;
}

/** GET /api/users/me */
export async function getMyProfile(): Promise<UserProfileResponse> {
  const response = await apiClient.get<UserProfileResponse>('/api/users/me');
  return response.data;
}

/** GET /api/users/{userId}/profile */
export async function getUserProfile(userId: string): Promise<UserProfileResponse> {
  const response = await apiClient.get<UserProfileResponse>(`/api/users/${userId}/profile`);
  return response.data;
}

/** GET /api/users/{userId}/photos */
export async function getUserPhotos(userId: string): Promise<PhotoResponse[]> {
  const response = await apiClient.get<PhotoResponse[]>(`/api/users/${userId}/photos`);
  return response.data;
}

/** PUT /api/users/me/bio */
export async function updateBio(data: UpdateBioRequest): Promise<UserProfileResponse> {
  const response = await apiClient.put<UserProfileResponse>('/api/users/me/bio', data);
  return response.data;
}

/** GET /api/users/online — returns array of online user UUIDs */
export async function getOnlineUsers(): Promise<string[]> {
  const response = await apiClient.get<string[]>('/api/users/online');
  return response.data;
}

/**
 * POST /api/users/me/avatar
 * Sends file as multipart/form-data with field name "file".
 */
export async function updateAvatar(file: File): Promise<UserProfileResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<UserProfileResponse>('/api/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
