import React, { useState } from 'react';
import { Terminal, Shield, ArrowRight, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client';
import type { UserProfile } from '../types/schema';

interface LoginPageProps {
  onLoginSuccess: (user: {
    userId: string;
    email: string;
    name: string | null;
    profile: UserProfile | null;
  }) => void;
  onBackToLanding: () => void;
}

export function LoginPage({ onLoginSuccess, onBackToLanding }: LoginPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await apiClient.login(name.trim(), email.trim(), password);
      onLoginSuccess({
        userId: response.user_id,
        email: response.email,
        name: response.name,
        profile: response.profile,
      });
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '24px',
      backgroundColor: 'var(--bg)',
      color: 'var(--ink)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div 
        onClick={onBackToLanding}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          cursor: 'pointer', 
          userSelect: 'none',
          marginBottom: '32px'
        }}
      >
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          background: 'var(--ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Terminal size={20} color="var(--cream)" />
        </div>
        <span className="font-serif" style={{ fontSize: '1.7rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          SideDoor
        </span>
      </div>

      <div style={{
        backgroundColor: '#111',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '40px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 className="font-serif" style={{ fontSize: '1.75rem', fontWeight: 500, color: 'var(--cream)', margin: '0 0 8px 0' }}>
            Access Almanac Portal
          </h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Login or enter details to register. New emails will auto-signup immediately.
          </p>
        </div>

        {errorMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            backgroundColor: 'rgba(217, 119, 87, 0.1)',
            border: '1px solid rgba(217, 119, 87, 0.2)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            color: 'var(--accent-orange)',
            fontSize: '0.85rem',
            lineHeight: 1.4,
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }} className="font-mono">
              Full Name (Signup only)
            </label>
            <input 
              type="text" 
              placeholder="e.g. Aditya Sharma" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-gold)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }} className="font-mono">
              Email Address *
            </label>
            <input 
              type="email" 
              required
              placeholder="aditya@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-gold)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '6px' }} className="font-mono">
              Password *
            </label>
            <input 
              type="password" 
              required
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-gold)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={isSubmitting}
            style={{ 
              width: '100%', 
              padding: '14px', 
              fontSize: '1rem', 
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Launch Dashboard'}</span>
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px', fontSize: '0.8rem', color: 'var(--text-dim)', gap: '6px' }}>
          <Shield size={14} style={{ marginTop: '1px' }} />
          <span>Secured credential verification portal</span>
        </div>
      </div>
    </div>
  );
}
