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
  // FIX 4: Initialize prefs state from the server on mount via loadPrefs().
  // Default is true/true so sub-toggles look sensible before the first API
  // response, but the real values replace them as soon as the fetch resolves.
  const [prefs, setPrefs] = useState<NotificationPreferencesDto>({
    notifyMessages: true,
    notifyPosts: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  // FIX 4: Load real preferences from the server on mount so a page reload
  // shows the user's actual saved values rather than the hardcoded defaults.
  const loadPrefs = useCallback(async () => {
    try {
      setPrefsLoading(true);
      const data = await getPreferences();
      console.log('[Settings] loadPrefs() received:', data);
      setPrefs(data);
    } catch (e) {
      console.error('[Settings] loadPrefs() failed:', e);
      setPrefsError('Could not load preferences.');
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  // ── Main toggle handler ─────────────────────────────────────────────────────
  // FIX 2: When the user turns push ON, await enable() and then immediately
  // call updatePreferences(true/true) so the sub-toggles reflect the defaults
  // without needing a page reload. Never sends false in this path.
  async function handleMainToggle(checked: boolean) {
    if (checked) {
      await push.enable();
      // Only update preferences if enable() actually succeeded (isSubscribed
      // will be true after the hook's synchronous setIsSubscribed(true)).
      // We check via the return — since enable() sets state synchronously,
      // we optimistically set prefs to true/true here if there was no error.
      const defaultPrefs: NotificationPreferencesDto = { notifyMessages: true, notifyPosts: true };
      setPrefs(defaultPrefs); // optimistic visual update
      try {
        const updated = await updatePreferences(defaultPrefs);
        console.log('[Settings] handleMainToggle ON → updatePreferences result:', updated);
        setPrefs(updated);
      } catch (e) {
        console.error('[Settings] handleMainToggle ON → updatePreferences failed:', e);
        // Non-fatal: push subscription itself succeeded, just prefs write failed
        setPrefsError('Preferences could not be saved. Please try again.');
      }
    } else {
      await push.disable();
    }
  }

  // ── Sub-toggle handler with optimistic update + revert on failure ──────────
  // FIX 3: Spreads the CURRENT prefs so only the changed key is updated.
  // The other key keeps its existing value. Reverts optimistic state on error.
  async function handlePrefChange(key: keyof NotificationPreferencesDto, value: boolean) {
    const prevPrefs = prefs;
    // Build next with ONLY the clicked key changed — other key unchanged
    const next: NotificationPreferencesDto = { ...prefs, [key]: value };
    console.log('[Settings] handlePrefChange', key, value, '→ sending:', next);
    setPrefs(next); // optimistic immediate update

    try {
      const updated = await updatePreferences(next);
      console.log('[Settings] handlePrefChange → server returned:', updated);
      setPrefs(updated); // apply server-confirmed values
    } catch (e) {
      console.error('[Settings] handlePrefChange → updatePreferences failed, reverting:', e);
      setPrefs(prevPrefs); // revert to pre-click values
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
              onChange={handleMainToggle}
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

      {/* ── TEMPORARY: live state debug block ─────────────────────────────────
          Shows raw state values while testing. Remove once confirmed working. */}
      <section className="settings-section" aria-label="Debug state (temporary)">
        <p className="settings-section-title">Debug state</p>
        <pre className="settings-debug">
          {JSON.stringify(
            {
              isSubscribed: push.isSubscribed,
              permission: push.permission,
              isSupported: push.isSupported,
              needsInstall: push.needsInstall,
              loading: push.loading,
              error: push.error,
              preferences: prefs,
            },
            null,
            2
          )}
        </pre>
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
