import apiClient from './client';
import type {
  PagePhotoResponse,
  PhotoResponse,
  CommentRequest,
  CommentResponse,
  UpdatePhotoRequest,
} from '../types/api';

/** GET /api/photos/feed */
export async function getFeed(page: number, size: number): Promise<PagePhotoResponse> {
  const response = await apiClient.get<PagePhotoResponse>('/api/photos/feed', {
    params: { page, size },
  });
  return response.data;
}

/** POST /api/photos  (multipart/form-data, caption as query param) */
export async function uploadPhoto(file: File, caption?: string): Promise<PhotoResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<PhotoResponse>('/api/photos', formData, {
    params: caption ? { caption } : undefined,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/** POST /api/photos/{photoId}/like */
export async function toggleLike(photoId: string): Promise<string> {
  const response = await apiClient.post<string>(`/api/photos/${photoId}/like`);
  return response.data;
}

/** GET /api/photos/{photoId}/comments */
export async function getComments(photoId: string): Promise<CommentResponse[]> {
  const response = await apiClient.get<CommentResponse[]>(`/api/photos/${photoId}/comments`);
  return response.data;
}

/** POST /api/photos/{photoId}/comments */
export async function addComment(
  photoId: string,
  data: CommentRequest
): Promise<CommentResponse> {
  const response = await apiClient.post<CommentResponse>(
    `/api/photos/${photoId}/comments`,
    data
  );
  return response.data;
}

/** PUT /api/photos/{photoId} — edit caption (owner only, enforced server-side) */
export async function updatePhotoCaption(
  photoId: string,
  caption: string
): Promise<PhotoResponse> {
  const body: UpdatePhotoRequest = { caption };
  const response = await apiClient.put<PhotoResponse>(`/api/photos/${photoId}`, body);
  return response.data;
}

/** DELETE /api/photos/{photoId} — owner only, enforced server-side */
export async function deletePhoto(photoId: string): Promise<void> {
  await apiClient.delete(`/api/photos/${photoId}`);
}

/** PUT /api/photos/comments/{commentId} — edit comment text (owner only) */
export async function updateComment(
  commentId: string,
  text: string
): Promise<CommentResponse> {
  const body: CommentRequest = { text };
  const response = await apiClient.put<CommentResponse>(
    `/api/photos/comments/${commentId}`,
    body
  );
  return response.data;
}

/** DELETE /api/photos/comments/{commentId} — owner only */
export async function deleteComment(commentId: string): Promise<void> {
  await apiClient.delete(`/api/photos/comments/${commentId}`);
}
