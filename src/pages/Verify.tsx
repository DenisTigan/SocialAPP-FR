import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { verify, resendCode } from '../api/auth';
import '../styles/auth.css';

const RESEND_COOLDOWN = 30; // seconds

export default function Verify() {
  const navigate = useNavigate();
  const location = useLocation();

  // Email from router state (navigate from Register) or manual fallback
  const locationEmail = (location.state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(locationEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear interval on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startCooldown() {
    setCountdown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !code.trim()) {
      setError('Please enter your email and verification code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verify({ email, code });
      navigate('/login', { state: { successMessage: 'Email verified! You can now sign in.' } });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Verification failed. Please check your code.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email.trim()) {
      setError('Please enter your email first.');
      return;
    }
    setResendLoading(true);
    setError('');
    try {
      await resendCode({ email });
      startCooldown();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not resend code. Please try again.';
      setError(message);
    } finally {
      setResendLoading(false);
    }
  }

  const resendDisabled = countdown > 0 || resendLoading;

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <div className="auth-brand-icon">✉</div>
          <h1 className="auth-title">Verify your email</h1>
          <p className="auth-subtitle">Enter the 6-digit code we sent you</p>
        </div>

        {/* Email hint or manual input */}
        {locationEmail ? (
          <div className="auth-hint">
            Code sent to <strong>{locationEmail}</strong>
          </div>
        ) : (
          <div className="auth-field" style={{ marginBottom: '4px' }}>
            <label className="auth-label" htmlFor="verify-email">Email</label>
            <input
              id="verify-email"
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
              autoComplete="email"
            />
          </div>
        )}

        {/* Error */}
        {error && <div className="auth-error" role="alert" style={{ marginTop: '12px' }}>{error}</div>}

        <form className="auth-form" onSubmit={handleVerify} noValidate style={{ marginTop: '18px' }}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="verify-code">Verification code</label>
            <input
              id="verify-code"
              className="auth-input"
              type="text"
              placeholder="123456"
              value={code}
              onChange={(e) => { setCode(e.target.value); if (error) setError(''); }}
              inputMode="numeric"
              maxLength={10}
              autoComplete="one-time-code"
            />
          </div>

          <button
            id="verify-submit"
            className="auth-btn"
            type="submit"
            disabled={loading}
          >
            {loading && <span className="auth-spinner" aria-hidden="true" />}
            {loading ? 'Verifying…' : 'Verify email'}
          </button>
        </form>

        {/* Resend code */}
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            id="verify-resend"
            className="auth-btn-ghost"
            type="button"
            onClick={handleResend}
            disabled={resendDisabled}
          >
            {resendLoading
              ? 'Sending…'
              : countdown > 0
              ? `Resend code (${countdown}s)`
              : 'Resend code'}
          </button>
          {countdown > 0 && (
            <p className="auth-countdown">You can request a new code in {countdown}s</p>
          )}
        </div>
      </div>
    </div>
  );
}
