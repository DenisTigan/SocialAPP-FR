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
