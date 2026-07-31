import React, { useState, useEffect, useRef } from "react";
import { ArrowRight, AlertCircle, Zap, Shield, ChevronRight } from "lucide-react";
import { apiClient } from "../api/client";
import type { UserProfile } from "../types/schema";

interface LoginPageProps {
  onLoginSuccess: (user: { userId: string; email: string; name: string | null; profile: UserProfile | null }) => void;
  onBackToLanding: () => void;
}

export function LoginPage({ onLoginSuccess, onBackToLanding }: LoginPageProps) {
  const [name, setName]                 = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExisting, setIsExisting]     = useState<boolean | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    if (email.includes("@") && email.includes(".")) {
      setIsCheckingEmail(true);
      emailCheckTimer.current = setTimeout(async () => {
        const exists = await apiClient.checkEmailExists(email);
        setIsExisting(exists);
        setIsCheckingEmail(false);
      }, 600);
    } else {
      setIsExisting(null);
    }
    return () => { if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current); };
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { setErrorMessage("Email and password are required."); return; }
    if (isExisting === false && !name.trim()) { setErrorMessage("Please enter your name to create an account."); return; }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.login(name.trim(), email.trim(), password);
      onLoginSuccess({ userId: response.user_id, email: response.email, name: response.name, profile: response.profile });
    } catch (error: any) {
      setErrorMessage(error.message || "Authentication failed. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNewUser = isExisting === false;
  const ctaLabel  = isExisting === null ? "Launch Dashboard" : isExisting ? "Enter Dashboard" : "Create Account";

  const INPUT_STYLE: React.CSSProperties = {
    width: "100%", padding: "13px 16px", borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.88)",
    fontSize: "0.95rem", outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "var(--font-sans)",
  };

  const LABEL_STYLE: React.CSSProperties = {
    fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", fontWeight: 700,
    display: "block", marginBottom: "6px", textTransform: "uppercase",
    letterSpacing: "0.08em", fontFamily: "var(--font-mono)",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = "#c8a84b";
    e.target.style.boxShadow = "0 0 0 2px rgba(200,168,75,0.12)";
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = "rgba(255,255,255,0.1)";
    e.target.style.boxShadow = "none";
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#080808",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", position: "relative", overflow: "hidden",
    }}>
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(200,168,75,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(200,168,75,0.03) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />
      {/* Glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
        width: "600px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(200,168,75,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div
          onClick={onBackToLanding}
          style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginBottom: "36px", justifyContent: "center" }}
        >
          <div style={{
            width: "34px", height: "34px", borderRadius: "9px",
            background: "linear-gradient(135deg, #c8a84b, #8b6020)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Zap size={16} color="#0a0a0a" fill="#0a0a0a" />
          </div>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 500, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.02em" }}>
            SideDoor
          </span>
        </div>

        {/* Card */}
        <div style={{
          background: "#111111", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "24px", padding: "36px",
          boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(200,168,75,0.04) inset",
        }}>
          {/* Headline */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h2 style={{
              fontFamily: "var(--font-serif)", fontSize: "1.65rem", fontWeight: 500,
              color: "rgba(255,255,255,0.92)", margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.2
            }}>
              The unfair advantage<br />
              <em style={{ fontStyle: "italic", color: "#c8a84b" }}>for product engineers</em>
            </h2>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(255,255,255,0.28)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
              {isExisting === null
                ? "Enter your email -- we detect if you have an account"
                : isExisting
                ? "Welcome back. Enter your password to continue."
                : "New here. Create your account in seconds."}
            </p>
          </div>

          {/* Error */}
          {errorMessage && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              background: "rgba(217,119,87,0.08)", border: "1px solid rgba(217,119,87,0.18)",
              borderRadius: "10px", padding: "12px 14px", marginBottom: "20px",
              color: "#e07040", fontSize: "0.83rem", lineHeight: 1.45,
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Name -- shown for new users */}
            {isNewUser && (
              <div style={{ animation: "stepIn 0.3s ease both" }}>
                <label style={LABEL_STYLE}>Your Name</label>
                <input
                  type="text" placeholder="e.g. Aditya Sharma"
                  value={name} onChange={e => setName(e.target.value)}
                  onFocus={handleFocus} onBlur={handleBlur} style={INPUT_STYLE}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label style={LABEL_STYLE}>
                Email Address
                {isCheckingEmail && <span style={{ marginLeft: "6px", color: "rgba(200,168,75,0.5)" }}> - checking...</span>}
                {isExisting === true  && <span style={{ marginLeft: "6px", color: "#4caf72" }}> - account found</span>}
                {isExisting === false && <span style={{ marginLeft: "6px", color: "#c8a84b" }}> - new account</span>}
              </label>
              <input
                type="email" required placeholder="you@startup.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onFocus={handleFocus} onBlur={handleBlur} style={INPUT_STYLE}
              />
            </div>

            {/* Password */}
            <div>
              <label style={LABEL_STYLE}>Password</label>
              <input
                type="password" required placeholder="Set a password"
                value={password} onChange={e => setPassword(e.target.value)}
                onFocus={handleFocus} onBlur={handleBlur} style={INPUT_STYLE}
              />
            </div>

            {/* CTA */}
            <button
              type="submit" disabled={isSubmitting}
              className="onboarding-btn-primary"
              style={{ width: "100%", marginTop: "4px" }}
            >
              {isSubmitting ? "Authenticating..." : ctaLabel}
              {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Trust */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "20px", fontSize: "0.75rem", color: "rgba(255,255,255,0.18)", fontFamily: "var(--font-mono)" }}>
            <Shield size={12} />
            <span>No spam - No LinkedIn scraping - Your data stays private</span>
          </div>
        </div>

        {/* Back */}
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={onBackToLanding}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: "0.8rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-mono)" }}
          >
            <ChevronRight size={12} style={{ transform: "rotate(180deg)" }} /> Back to landing
          </button>
        </div>
      </div>
    </div>
  );
}
