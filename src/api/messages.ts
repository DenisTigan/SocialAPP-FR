import apiClient from './client';
import type { ConversationResponse, MessageResponse, MessageRequest } from '../types/api';

/** GET /api/messages/inbox */
export async function getInbox(): Promise<ConversationResponse[]> {
  const response = await apiClient.get<ConversationResponse[]>('/api/messages/inbox');
  return response.data;
}

/** GET /api/messages/{partnerId} */
export async function getChatHistory(partnerId: string): Promise<MessageResponse[]> {
  const response = await apiClient.get<MessageResponse[]>(`/api/messages/${partnerId}`);
  return response.data;
}

/** POST /api/messages/{partnerId} */
export async function sendMessage(
  partnerId: string,
  data: MessageRequest
): Promise<MessageResponse> {
  const response = await apiClient.post<MessageResponse>(`/api/messages/${partnerId}`, data);
  return response.data;
}

/** PUT /api/messages/{partnerId}/read — marks all messages from partner as read */
export async function markAsRead(partnerId: string): Promise<void> {
  await apiClient.put(`/api/messages/${partnerId}/read`);
}

/** POST /api/messages/{receiverId}/typing?typing=boolean — REST fallback for typing indicator */
export async function sendTypingRest(receiverId: string, typing: boolean): Promise<void> {
  await apiClient.post(`/api/messages/${receiverId}/typing`, null, {
    params: { typing },
  });
}
