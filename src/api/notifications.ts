import apiClient from './client';
import type { NotificationPreferencesDto, PushSubscriptionRequest } from '../types/api';

/**
 * GET /api/notifications/vapid-public-key — PUBLIC, no auth needed.
 * Returns the raw base64url-encoded VAPID public key string.
 */
export async function getVapidPublicKey(): Promise<string> {
  const response = await apiClient.get<Record<string, string>>(
    '/api/notifications/vapid-public-key'
  );
  return response.data.publicKey;
}

/**
 * POST /api/notifications/subscribe
 * Registers this device's PushSubscription with the backend.
 */
export async function subscribePush(sub: PushSubscriptionRequest): Promise<void> {
  await apiClient.post('/api/notifications/subscribe', sub);
}

/**
 * DELETE /api/notifications/subscribe
 * Removes this device's push subscription from the backend.
 * Note: axios DELETE with a body must use { data: ... } config.
 */
export async function unsubscribePush(endpoint: string): Promise<void> {
  await apiClient.delete('/api/notifications/subscribe', {
    data: { endpoint },
  });
}

/**
 * GET /api/notifications/preferences
 * Returns per-user notification preferences (applies to all devices).
 */
export async function getPreferences(): Promise<NotificationPreferencesDto> {
  const response = await apiClient.get<NotificationPreferencesDto>(
    '/api/notifications/preferences'
  );
  return response.data;
}

/**
 * PUT /api/notifications/preferences
 * Updates per-user notification preferences, returns updated object.
 */
export async function updatePreferences(
  data: NotificationPreferencesDto
): Promise<NotificationPreferencesDto> {
  const response = await apiClient.put<NotificationPreferencesDto>(
    '/api/notifications/preferences',
    data
  );
  return response.data;
}
