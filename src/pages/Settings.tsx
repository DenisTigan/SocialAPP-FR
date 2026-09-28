import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { getPreferences, updatePreferences } from '../api/notifications';
import ToggleSwitch from '../components/ToggleSwitch';
import type { NotificationPreferencesDto } from '../types/api';
import '../styles/settings.css';

export default function Settings() {
  const navigate = useNavigate();
  const { logoutUser } = useAuth();
  const push = usePushNotifications();

  // ── Notification preferences (per-user, all devices) ──────────────────────
  const [prefs, setPrefs] = useState<NotificationPreferencesDto>({
    notifyMessages: true,
    notifyPosts: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  const loadPrefs = useCallback(async () => {
    try {
      setPrefsLoading(true);
      const data = await getPreferences();
      setPrefs(data);
    } catch {
      setPrefsError('Could not load preferences.');
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  // ── Preference toggle with optimistic update + revert on failure ──────────
  async function handlePrefChange(key: keyof NotificationPreferencesDto, value: boolean) {
    const prevPrefs = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next); // optimistic

    try {
      const updated = await updatePreferences(next);
      setPrefs(updated);
    } catch {
      setPrefs(prevPrefs); // revert
      setPrefsError('Failed to save preference. Please try again.');
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  function handleLogout() {
    logoutUser();
    navigate('/login', { replace: true });
  }

  // ── Push notification status text ──────────────────────────────────────────
  function renderPushStatus() {
    if (push.needsInstall) {
      return (
        <p className="settings-status settings-status--warn">
          📱 On iPhone, first add this app to your Home Screen (Share → Add to Home
          Screen), then open it from there to enable notifications.
        </p>
      );
    }
    if (!push.isSupported) {
      return (
        <p className="settings-status">
          ⚠️ This browser does not support push notifications.
        </p>
      );
    }
    if (push.permission === 'denied') {
      return (
        <p className="settings-status settings-status--error">
          🔒 Notifications are blocked in your browser. Click the lock icon in the
          address bar to allow them, then reload.
        </p>
      );
    }
    if (push.error) {
      return <p className="settings-status settings-status--error">⚠️ {push.error}</p>;
    }
    if (!push.isSubscribed) {
      return (
        <p className="settings-status">
          💡 You'll be asked for browser permission the first time you turn this on.
        </p>
      );
    }
    return null;
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {/* ── Notifications section ── */}
      <section className="settings-section" aria-label="Notification settings">
        <p className="settings-section-title">Notifications</p>

        {/* Main push toggle */}
        <div className="settings-row">
          <div className="settings-row-info">
            <p className="settings-row-label">Push notifications (this device)</p>
          </div>
          {push.loading ? (
            <div className="settings-spinner" aria-label="Loading…" role="status" />
          ) : (
            <ToggleSwitch
              id="toggle-push-main"
              label="Push notifications"
              checked={push.isSubscribed}
              disabled={
                !push.isSupported ||
                push.permission === 'denied' ||
                push.loading
              }
              onChange={(checked) => {
                if (checked) {
                  push.enable();
                } else {
                  push.disable();
                }
              }}
            />
          )}
        </div>

        {/* Status messages */}
        {renderPushStatus()}

        {/* Sub-toggles: per-user preferences */}
        <div className={`settings-sub-rows${!push.isSubscribed ? ' dimmed' : ''}`}>
          <div className="settings-row">
            <div className="settings-row-info">
              <p className="settings-row-label">New messages</p>
              <p className="settings-row-desc">Notify when you receive a message</p>
            </div>
            {prefsLoading ? (
              <div className="settings-spinner" aria-label="Loading…" role="status" />
            ) : (
              <ToggleSwitch
                id="toggle-notify-messages"
                label="New messages"
                checked={prefs.notifyMessages}
                disabled={prefsLoading}
                onChange={(val) => handlePrefChange('notifyMessages', val)}
              />
            )}
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <p className="settings-row-label">New posts</p>
              <p className="settings-row-desc">Notify when someone posts a new photo</p>
            </div>
            {prefsLoading ? (
              <div className="settings-spinner" aria-label="Loading…" role="status" />
            ) : (
              <ToggleSwitch
                id="toggle-notify-posts"
                label="New posts"
                checked={prefs.notifyPosts}
                disabled={prefsLoading}
                onChange={(val) => handlePrefChange('notifyPosts', val)}
              />
            )}
          </div>
        </div>

        {prefsError && (
          <p className="settings-status settings-status--error" role="alert">
            ⚠️ {prefsError}
          </p>
        )}
      </section>

      {/* ── Account section ── */}
      <section className="settings-section" aria-label="Account settings">
        <p className="settings-section-title">Account</p>
        <button
          id="settings-logout-btn"
          className="settings-logout-btn"
          onClick={handleLogout}
        >
          <span aria-hidden="true">↩</span>
          Log out
        </button>
      </section>
    </div>
  );
}
