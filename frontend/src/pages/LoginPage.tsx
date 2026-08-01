import React, { useState } from "react";
import { ArrowRight, AlertCircle, Shield, Zap, Check } from "lucide-react";
import { supabase } from "../lib/supabase";

interface LoginPageProps {
  onBackToLanding: () => void;
}

export function LoginPage({ onBackToLanding }: LoginPageProps) {
  const [name, setName]                   = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [errorMessage, setErrorMessage]   = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode]                   = useState<"signin" | "signup">("signin");

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
        setSuccessMessage("Account created! Check your inbox to verify your email, then sign in.");
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
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    background: "var(--paper)",
    color: "var(--ink)",
    fontSize: "0.95rem",
    fontFamily: "var(--font-sans)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  };

  const LABEL_BASE: React.CSSProperties = {
    display: "block",
    fontSize: "0.72rem",
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--text-dim)",
    marginBottom: "6px",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "var(--accent-gold)";
    e.target.style.boxShadow = "0 0 0 3px rgba(152,118,26,0.1)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "var(--border)";
    e.target.style.boxShadow = "none";
  };

  const TRUST_ITEMS = [
    "No LinkedIn scraping",
    "No spam",
    "Your data is private",
  ];

  return (
    <div
      className="bg-texture"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "440px" }}>

        {/* Logo / wordmark */}
        <div
          onClick={onBackToLanding}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            cursor: "pointer", marginBottom: "40px", justifyContent: "center",
          }}
        >
          <div style={{
            width: "32px", height: "32px", borderRadius: "8px",
            background: "var(--ink)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap size={15} color="var(--cream)" fill="var(--cream)" />
          </div>
          <span style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.5rem",
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.025em",
          }}>
            SideDoor
          </span>
        </div>

        {/* Card */}
        <div
          className="paper-card"
          style={{ padding: "36px", borderRadius: "20px" }}
        >
          {/* Headline */}
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <h2 style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.6rem",
              fontWeight: 500,
              color: "var(--ink)",
              margin: "0 0 8px",
              letterSpacing: "-0.025em",
              lineHeight: 1.25,
            }}>
              {mode === "signup"
                ? <>Create your <em>account</em></>
                : <>Welcome <em>back.</em></>
              }
            </h2>
            <p style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
            }}>
              {mode === "signup"
                ? "Find your unfair advantage in the job market."
                : "Sign in to access your opportunity feed."}
            </p>
          </div>

          {/* Mode toggle pills */}
          <div style={{
            display: "flex",
            background: "var(--bg)",
            borderRadius: "10px",
            padding: "4px",
            marginBottom: "24px",
            border: "1px solid var(--border-light)",
          }}>
            {(["signin", "signup"] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setErrorMessage(null); setSuccessMessage(null); }}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.15s",
                  background: mode === m ? "var(--paper)" : "transparent",
                  color: mode === m ? "var(--ink)" : "var(--text-dim)",
                  boxShadow: mode === m ? "0 1px 4px rgba(42,46,28,0.08)" : "none",
                }}
              >
                {m === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Error */}
          {errorMessage && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              background: "rgba(242,102,37,0.08)",
              border: "1px solid rgba(242,102,37,0.25)",
              borderRadius: "10px", padding: "12px 14px", marginBottom: "20px",
              color: "#c0440e", fontSize: "0.83rem", lineHeight: 1.45,
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              background: "rgba(108,115,57,0.08)",
              border: "1px solid rgba(108,115,57,0.3)",
              borderRadius: "10px", padding: "12px 14px", marginBottom: "20px",
              color: "var(--accent-moss)", fontSize: "0.83rem", lineHeight: 1.45,
            }}>
              <Check size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Name - signup only */}
            {mode === "signup" && (
              <div>
                <label style={LABEL_BASE}>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Arjun Mehta"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onFocus={onFocus} onBlur={onBlur}
                  style={INPUT_BASE}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label style={LABEL_BASE}>Email Address</label>
              <input
                type="email"
                required
                placeholder="you@startup.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={onFocus} onBlur={onBlur}
                style={INPUT_BASE}
              />
            </div>

            {/* Password */}
            <div>
              <label style={LABEL_BASE}>Password</label>
              <input
                type="password"
                required
                placeholder={mode === "signup" ? "Choose a strong password" : "Enter your password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={onFocus} onBlur={onBlur}
                style={INPUT_BASE}
              />
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ width: "100%", marginTop: "4px", fontSize: "0.95rem", padding: "13px 20px" }}
            >
              {isSubmitting
                ? "Please wait..."
                : mode === "signup" ? "Create Account" : "Sign In"
              }
              {!isSubmitting && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Trust line */}
          <div style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            gap: "16px", marginTop: "20px", flexWrap: "wrap",
          }}>
            {TRUST_ITEMS.map(t => (
              <span key={t} style={{
                display: "flex", alignItems: "center", gap: "4px",
                fontSize: "0.72rem", fontFamily: "var(--font-mono)",
                color: "var(--text-dim)",
              }}>
                <Shield size={10} color="var(--accent-moss)" />
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={onBackToLanding}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: "0.82rem",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            ← Back to landing
          </button>
        </div>
      </div>
    </div>
  );
}
