import React, { useState } from 'react';
import { cloudStorageService } from '../services/CloudStorageService';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('9876543210');
  const [password, setPassword] = useState('Safety123');
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Password criteria calculations
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };

  const isPasswordValid =
    criteria.length &&
    criteria.uppercase &&
    criteria.lowercase &&
    criteria.number &&
    criteria.special;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && !isPasswordValid) {
      setError('Please ensure your password meets all required security criteria.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await cloudStorageService.login(identifier, password);
        if (res.success && res.user) {
          onLoginSuccess(res.user);
          onClose();
        } else {
          setError(res.error || 'Failed to login');
        }
      } else {
        const res = await cloudStorageService.register(fullName, phone, email, password);
        if (res.success && res.user) {
          onLoginSuccess(res.user);
          onClose();
        } else {
          setError(res.error || 'Failed to register');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src="./adaptive-icon.png" alt="LifeGuard AI" style={{ width: 56, height: 56, marginBottom: 8 }} />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)' }}>
            {mode === 'login' ? 'Welcome to LifeGuard AI' : 'Create Safety Account'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Your Safety, Our Priority
          </p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              {mode === 'login' ? 'Mobile Number or Email' : 'Mobile Number *'}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={mode === 'login' ? '9876543210' : 'Enter 10-digit mobile'}
              value={mode === 'login' ? identifier : phone}
              onChange={(e) => (mode === 'login' ? setIdentifier(e.target.value) : setPhone(e.target.value))}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Email Address (Optional)</label>
              <input
                type="email"
                className="form-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          {/* Password Field with Eye Icon Inside Right */}
          <div className="form-group">
            <label className="form-label">Password *</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input password-input"
                placeholder="Enter secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="eye-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Live Checklist for Password Criteria during Registration */}
          {mode === 'register' && (
            <div style={{ background: 'var(--bg-card-subtle)', padding: '12px 14px', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 8, textTransform: 'uppercase' }}>
                Password Security Criteria:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <div style={{ color: criteria.length ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{criteria.length ? '✓' : '○'}</span>
                  <span>At least 8 characters</span>
                </div>
                <div style={{ color: criteria.uppercase ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{criteria.uppercase ? '✓' : '○'}</span>
                  <span>At least 1 uppercase letter (A-Z)</span>
                </div>
                <div style={{ color: criteria.lowercase ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{criteria.lowercase ? '✓' : '○'}</span>
                  <span>At least 1 lowercase letter (a-z)</span>
                </div>
                <div style={{ color: criteria.number ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{criteria.number ? '✓' : '○'}</span>
                  <span>At least 1 number (0-9)</span>
                </div>
                <div style={{ color: criteria.special ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{criteria.special ? '✓' : '○'}</span>
                  <span>At least 1 special character (!@#$%^&*)</span>
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: 12 }}>
            {loading ? 'Processing...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => { setMode('register'); setError(null); }}
              >
                Sign Up
              </button>
            </span>
          ) : (
            <span>
              Already registered?{' '}
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => { setMode('login'); setError(null); }}
              >
                Log In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
