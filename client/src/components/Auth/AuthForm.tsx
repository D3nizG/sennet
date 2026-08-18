import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { EgyptianPanel, EgyptianInput, ParchmentButton } from '../EgyptianTheme';
import './AuthForm.css';

export function AuthForm() {
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Surface failures from the post-redirect token exchange (handled in AuthContext).
  useEffect(() => {
    const handle = (e: Event) => {
      setError((e as CustomEvent).detail || 'Google sign-in failed');
      setGoogleLoading(false);
    };
    window.addEventListener('auth:google-error', handle);
    return () => window.removeEventListener('auth:google-error', handle);
  }, []);

  const handleGoogle = async () => {
    setError('');
    setNotice('');
    setGoogleLoading(true);
    try {
      // Redirects away to Google; the return trip is handled in AuthContext.
      await loginWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Could not start Google sign-in');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password, displayName || username);
      }
      // Always start a fresh session at the lobby (don't resume a stale route).
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-overlay" />

      <div className="auth-container">
        <div className="auth-brand">
          <span className="auth-logo">𓁹</span>
          <h1 className="egypt-display">Sennet</h1>
          <p>The Ancient Egyptian Game of Sennet</p>
        </div>

        <EgyptianPanel ornament className="auth-card">
          <h2 className="egypt-display auth-title">{isLogin ? 'Sign In' : 'Create Account'}</h2>

          {error && <div className="auth-error">{error}</div>}
          {notice && <div className="auth-notice">{notice}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <EgyptianInput
              label="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              minLength={3}
              maxLength={20}
              required
            />
            <EgyptianInput
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              minLength={6}
              required
            />
            {!isLogin && (
              <EgyptianInput
                label="Display Name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="How others see you"
                maxLength={30}
              />
            )}

            <ParchmentButton fullWidth type="submit" disabled={loading} className="auth-submit">
              {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
            </ParchmentButton>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <button
            type="button"
            className="auth-google-btn"
            onClick={
              isSupabaseConfigured
                ? handleGoogle
                : () => setNotice('Google sign-in is not configured yet.')
            }
            disabled={googleLoading}
          >
            <span className="auth-google-g">G</span>
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <p className="auth-switch">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              className="link-btn"
              onClick={() => { setIsLogin(!isLogin); setError(''); setNotice(''); }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </EgyptianPanel>
      </div>
    </div>
  );
}
