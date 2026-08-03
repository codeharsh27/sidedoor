import React, { useState } from "react";
import { ArrowRight, AlertCircle, Mail, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

interface LoginPageProps {
  onBackToLanding: () => void;
}

export function LoginPage({ onBackToLanding }: LoginPageProps) {
  const [name, setName]                   = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [errorMessage, setErrorMessage]   = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailError, setEmailError]       = useState<string | null>(null);
  const [emailTouched, setEmailTouched]   = useState<boolean>(false);
  const [mode, setMode]                   = useState<"signin" | "signup">("signin");

  const isValidEmail = (emailStr: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmailTouched(true);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setEmailError("Email address is required.");
      setErrorMessage("Email is required.");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setEmailError("Email is not valid. Please enter a valid email address (e.g. name@domain.com).");
      setErrorMessage("Email is not valid. Please enter a valid email address (e.g. name@domain.com).");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Password is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        if (!name.trim()) {
          setErrorMessage("Please enter your name to create an account.");
          setIsSubmitting(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        // In a real app we'd redirect or show a dedicated success view
        setSuccessMessage("Success! Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (error.message.toLowerCase().includes("invalid login credentials")) {
            setErrorMessage("No account found, or wrong password. Try again or create an account below.");
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const INPUT_BASE: React.CSSProperties = {
    width: "100%",
    padding: "16px 16px 16px 44px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
    background: "#ffffff",
    color: "var(--ink)",
    fontSize: "0.95rem",
    fontFamily: "var(--font-sans)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "var(--ink)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "var(--border)";
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#ffffff', fontFamily: 'var(--font-sans)' }}>
      
      {/* LEFT PANE - FORM */}
      <div style={{ 
        flex: '1 1 50%', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '20px 8%', 
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden'
      }}>
        
        {/* Form Container */}
        <div style={{ maxWidth: '400px', width: '100%', margin: '0' }}>
          
          {/* Logo (Aligned with form) */}
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }} onClick={onBackToLanding}>
            <img src="/sidedoor_logo.png" alt="SideDoor Logo" style={{ height: '48px', width: 'auto' }} />
            <span className="font-serif" style={{ fontSize: '1.62rem', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.02em', transform: 'translateY(4px)' }}>
              SideDoor
            </span>
          </div>

          {/* Header */}
          <h1 style={{ 
            fontFamily: 'var(--font-serif)', 
            fontSize: '2rem', 
            fontWeight: 400, 
            color: 'var(--ink)',
            marginBottom: '4px',
            letterSpacing: '-0.02em'
          }}>
            {mode === 'signin' ? 'Welcome back' : 'Create an account'}
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '20px' }}>
            {mode === 'signin' ? 'Sign in to access your opportunity feed.' : 'Find your unfair advantage in the job market.'}
          </p>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginBottom: '16px' }}>
            <button
              onClick={() => { setMode('signin'); setErrorMessage(null); setSuccessMessage(null); setEmailError(null); setEmailTouched(false); }}
              style={{
                flex: 1,
                padding: '12px 0',
                background: 'none',
                border: 'none',
                borderBottom: mode === 'signin' ? '2px solid var(--ink)' : '2px solid transparent',
                color: mode === 'signin' ? 'var(--ink)' : 'var(--text-muted)',
                fontWeight: mode === 'signin' ? 600 : 500,
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setErrorMessage(null); setSuccessMessage(null); setEmailError(null); setEmailTouched(false); }}
              style={{
                flex: 1,
                padding: '12px 0',
                background: 'none',
                border: 'none',
                borderBottom: mode === 'signup' ? '2px solid var(--ink)' : '2px solid transparent',
                color: mode === 'signup' ? 'var(--ink)' : 'var(--text-muted)',
                fontWeight: mode === 'signup' ? 600 : 500,
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Create Account
            </button>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: "8px", padding: "12px 14px", marginBottom: "20px",
              color: "#15803d", fontSize: "0.85rem", lineHeight: 1.45,
            }}>
              <CheckCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              background: "rgba(242,102,37,0.08)",
              border: "1px solid rgba(242,102,37,0.25)",
              borderRadius: "8px", padding: "12px 14px", marginBottom: "20px",
              color: "#c0440e", fontSize: "0.85rem", lineHeight: 1.45,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Name */}
            {mode === 'signup' && (
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onFocus={onFocus} onBlur={onBlur}
                  style={{ ...INPUT_BASE, paddingLeft: '16px' }}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  placeholder="you@startup.com"
                  value={email}
                  onChange={e => {
                    const val = e.target.value;
                    setEmail(val);
                    if (emailTouched) {
                      if (!val.trim()) {
                        setEmailError("Email address is required.");
                      } else if (!isValidEmail(val)) {
                        setEmailError("Email is not valid. Please enter a valid email address.");
                      } else {
                        setEmailError(null);
                      }
                    }
                  }}
                  onFocus={onFocus}
                  onBlur={e => {
                    onBlur(e);
                    setEmailTouched(true);
                    if (!email.trim()) {
                      setEmailError("Email address is required.");
                    } else if (!isValidEmail(email)) {
                      setEmailError("Email is not valid. Please enter a valid email address.");
                    } else {
                      setEmailError(null);
                    }
                  }}
                  style={{
                    ...INPUT_BASE,
                    borderColor: emailError ? "#ef4444" : "var(--border)",
                  }}
                />
              </div>
              {emailError && (
                <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <AlertCircle size={12} />
                  <span>{emailError}</span>
                </div>
              )}
            </div>

            {/* Password */}
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder={mode === 'signup' ? "Choose a strong password" : "Enter your password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={onFocus} onBlur={onBlur}
                style={{ ...INPUT_BASE, paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-dim)' }}>
                <input type="checkbox" style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                Remember me
              </label>
              {mode === 'signin' && (
                <a href="#" style={{ color: 'var(--text-dim)', textDecoration: 'none' }}>
                  Forgot password?
                </a>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'var(--ink)',
                color: '#ffffff',
                border: 'none',
                fontSize: '1rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '10px',
                transition: 'background-color 0.2s'
              }}
            >
              {isSubmitting ? "Please wait..." : mode === 'signup' ? "Create Account" : "Sign In"}
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: 'var(--text-muted)' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
            <span style={{ padding: '0 12px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>OR CONTINUE WITH</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
          </div>

          {/* Social Logins */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={socialBtnStyle}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
          </div>

          <p style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
            By signing in, you agree to our <a href="#" style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 500 }}>Terms of Service</a> and <a href="#" style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 500 }}>Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* RIGHT PANE - IMAGE */}
      <div className="login-image-pane" style={{ 
        flex: '1 1 50%', 
        backgroundColor: '#f6f3eb',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img 
          src="/signup_screen.png" 
          alt="SideDoor graphic" 
          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} 
        />
        {/* Overlay Text */}
        <div style={{
          position: 'absolute',
          bottom: '12%',
          left: '8%',
          right: '8%',
          zIndex: 10,
          pointerEvents: 'none'
        }}>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '3.5rem',
            fontWeight: 400,
            color: 'var(--ink)',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            textShadow: '0 4px 24px rgba(255,255,255,0.8), 0 0 8px rgba(255,255,255,0.9)'
          }}>
            Opportunity exists.
            <span style={{ 
              fontFamily: 'var(--font-sans)', 
              fontSize: '1.4rem', 
              fontWeight: 400, 
              color: '#4b5563', 
              letterSpacing: '0', 
              display: 'block', 
              marginTop: '16px',
              textShadow: '0 2px 12px rgba(255,255,255,0.9)'
            }}>
              We help you find what others miss.
            </span>
          </h2>
        </div>
      </div>

      {/* Adding a style block to handle media query for mobile (hiding the right pane) */}
      <style>{`
        @media (max-width: 900px) {
          .login-image-pane {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const socialBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: '#ffffff',
  fontSize: '0.85rem',
  fontWeight: 500,
  color: 'var(--ink)',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  fontFamily: 'var(--font-sans)'
};
