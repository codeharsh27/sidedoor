import React, { useState } from "react";
import { ArrowRight, AlertCircle, Zap, Shield } from "lucide-react";
import { supabase } from "../lib/supabase";

interface LoginPageProps {
  onBackToLanding: () => void;
}

export function LoginPage({ onBackToLanding }: LoginPageProps) {
  const [name, setName]                 = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode]                 = useState<"detect" | "signin" | "signup">("detect");

  const handleEmailBlur = async () => {
    if (!email.includes("@") || !email.includes(".")) return;
    // Try to determine if user exists by attempting sign-in with dummy password
    // We use mode state rather than an API check — user explicitly picks sign in vs sign up
    // Default to signin mode once email looks valid
    if (mode === "detect") setMode("signin");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Email and password are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        // --- SIGN UP via Supabase ---
        if (!name.trim()) {
          setErrorMessage("Please enter your name to create an account.");
          setIsSubmitting(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() },
          },
        });
        if (error) throw error;
        // If email confirmation is enabled, show a message; otherwise onAuthStateChange fires
        setSuccessMessage("Account created! Check your inbox to verify your email, then sign in.");
      } else {
        // --- SIGN IN via Supabase ---
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          // If invalid credentials — suggest sign up
          if (error.message.toLowerCase().includes("invalid login credentials")) {
            setErrorMessage("No account found with this email. Switch to 'Create Account' below, or double-check your password.");
          } else {
            throw error;
          }
        }
        // On success, onAuthStateChange in useAuth fires → App.tsx navigates automatically
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const INPUT_STYLE: React.CSSProperties = {
    width: "100%", padding: "13px 16px", borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.88)",
    fontSize: "0.95rem", outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    fontFamily: "var(--font-sans)",
    boxSizing: "border-box",
  };

  const LABEL_STYLE: React.CSSProperties = {
    fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", fontWeight: 700,
    display: "block", marginBottom: "6px", textTransform: "uppercase",
    letterSpacing: "0.08em", fontFamily: "var(--font-mono)",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "#c8a84b";
    e.target.style.boxShadow = "0 0 0 2px rgba(200,168,75,0.12)";
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "rgba(255,255,255,0.1)";
    e.target.style.boxShadow = "none";
  };

  const headlineSubtitle = mode === "signup"
    ? "Create your account in seconds."
    : "Welcome back. Enter your password to continue.";

  const ctaLabel = mode === "signup" ? "Create Account" : "Sign In";

  return (
    <div style={{
      minHeight: "100vh", background: "#080808",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", position: "relative", overflow: "hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(200,168,75,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(200,168,75,0.03) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />
      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
        width: "600px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(200,168,75,0.05) 0%, transparent 70%)",
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
              {headlineSubtitle}
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

          {/* Success */}
          {successMessage && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              background: "rgba(74,197,130,0.08)", border: "1px solid rgba(74,197,130,0.25)",
              borderRadius: "10px", padding: "12px 14px", marginBottom: "20px",
              color: "#4ac582", fontSize: "0.83rem", lineHeight: 1.45,
            }}>
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Name — shown for sign up */}
            {mode === "signup" && (
              <div style={{ animation: "stepIn 0.3s ease both" }}>
                <label style={LABEL_STYLE}>Your Name</label>
                <input
                  type="text" placeholder="e.g. Arjun Sharma"
                  value={name} onChange={e => setName(e.target.value)}
                  onFocus={handleFocus} onBlur={handleBlur} style={INPUT_STYLE}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label style={LABEL_STYLE}>Email Address</label>
              <input
                type="email" required placeholder="you@startup.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onFocus={handleFocus}
                onBlur={(e) => { handleBlur(e); handleEmailBlur(); }}
                style={INPUT_STYLE}
              />
            </div>

            {/* Password */}
            <div>
              <label style={LABEL_STYLE}>Password</label>
              <input
                type="password" required placeholder={mode === "signup" ? "Choose a strong password" : "Enter your password"}
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
              {isSubmitting ? "Please wait..." : ctaLabel}
              {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Toggle mode */}
          <div style={{ textAlign: "center", marginTop: "20px" }}>
            {mode === "signup" ? (
              <button
                onClick={() => { setMode("signin"); setErrorMessage(null); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.28)", fontSize: "0.8rem", cursor: "pointer", fontFamily: "var(--font-mono)" }}
              >
                Already have an account?{" "}
                <span style={{ color: "#c8a84b", fontWeight: 600 }}>Sign in</span>
              </button>
            ) : (
              <button
                onClick={() => { setMode("signup"); setErrorMessage(null); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.28)", fontSize: "0.8rem", cursor: "pointer", fontFamily: "var(--font-mono)" }}
              >
                No account yet?{" "}
                <span style={{ color: "#c8a84b", fontWeight: 600 }}>Create one</span>
              </button>
            )}
          </div>

          {/* Trust line */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "16px", fontSize: "0.75rem", color: "rgba(255,255,255,0.18)", fontFamily: "var(--font-mono)" }}>
            <Shield size={12} />
            <span>No spam · No LinkedIn scraping · Your data stays private</span>
          </div>
        </div>

        {/* Back */}
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={onBackToLanding}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: "0.8rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "var(--font-mono)" }}
          >
            ← Back to landing
          </button>
        </div>
      </div>
    </div>
  );
}
