import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Check, Zap, Plus, X, Sparkles } from "lucide-react";
import type { FullOnboardingPayload, UserProjectItem } from "../types/schema";

interface OnboardingWizardProps {
  userId: string;
  userEmail?: string;
  onComplete: (data: FullOnboardingPayload) => Promise<void>;
}

const TARGET_ROLES = [
  { id: "Product Engineer", label: "Product Engineer", badge: "PE", desc: "Build features end-to-end, full stack ownership" },
  { id: "Full Stack Engineer", label: "Full Stack Engineer", badge: "FS", desc: "Frontend + backend, API-first mindset" },
  { id: "Backend / Systems", label: "Backend / Systems", badge: "BE", desc: "APIs, infra, databases, reliability" },
  { id: "AI / ML Engineer", label: "AI / ML Engineer", badge: "AI", desc: "LLMs, embeddings, model serving" },
  { id: "Frontend Engineer", label: "Frontend Engineer", badge: "FE", desc: "UI/UX, web performance, design systems" },
  { id: "APM / AI PM", label: "APM / AI PM", badge: "PM", desc: "Product discovery, specs, AI feature design" },
];

const COMPANY_STAGES = [
  { id: "seed", label: "Seed / Pre-Seed", desc: "<10 members, high equity" },
  { id: "series-a", label: "Series A", desc: "10-40 members, product-market fit" },
  { id: "series-b", label: "Series B+", desc: "Scaling fast, competitive pay" },
  { id: "yc-backed", label: "YC-Backed", desc: "Y Combinator portfolio" },
];

const LOCATION_OPTIONS = [
  { id: "remote", label: "Global Remote", desc: "Work from anywhere" },
  { id: "india", label: "Remote (India)", desc: "Remote within India" },
  { id: "onsite_india", label: "Onsite in India", desc: "Bangalore, NCR, Hyderabad, Mumbai" },
];

const INDUSTRIES = [
  "AI-Native", "DevTools", "Fintech", "Analytics", "Security & Auth", "Open Source"
];

const EXPERIENCE_LEVELS = ["< 1 year", "1-3 years", "3-6 years", "6+ years"];

export function OnboardingWizard({ userId, userEmail, onComplete }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(0); // 0..3 (4 steps)
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Identity & Roles
  const [name, setName] = useState("");
  const [location, setLocation] = useState("Bangalore, India");
  const [currentRole] = useState("Product Engineer");
  const [yearsExperience, setYearsExperience] = useState("1-3 years");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["Product Engineer"]);

  // Step 2: Stage & Location Pref
  const [selectedStages, setSelectedStages] = useState<string[]>(["seed", "series-a", "yc-backed"]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["remote", "india"]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(["AI-Native", "DevTools"]);

  // Step 3: Verification & Edit State (Manual Stack Input)
  const [verifiedSkills, setVerifiedSkills] = useState<string[]>(["React", "TypeScript", "Python"]);
  const [verifiedProjects, setVerifiedProjects] = useState<UserProjectItem[]>([{
    name: "Portfolio Project",
    description: "Built a fullstack application",
    stack: ["React", "TypeScript", "PostgreSQL"],
    status: "built",
    is_production: false
  }]);
  const [newSkillInput, setNewSkillInput] = useState("");

  const toggleRole = (r: string) => {
    setSelectedRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const toggleStage = (s: string) => {
    setSelectedStages(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const toggleIndustry = (ind: string) => {
    setSelectedIndustries(prev => prev.includes(ind) ? prev.filter(x => x !== ind) : [...prev, ind]);
  };

  const toggleLocation = (locId: string) => {
    setSelectedLocations(prev =>
      prev.includes(locId)
        ? (prev.length > 1 ? prev.filter(x => x !== locId) : prev)
        : [...prev, locId]
    );
  };

  // Skill Editor Helpers
  const addSkill = () => {
    if (newSkillInput.trim() && !verifiedSkills.includes(newSkillInput.trim())) {
      setVerifiedSkills([...verifiedSkills, newSkillInput.trim()]);
      setNewSkillInput("");
    }
  };

  const removeSkill = (s: string) => {
    setVerifiedSkills(verifiedSkills.filter(x => x !== s));
  };

  // Project Editor Helpers
  const updateProject = (index: number, field: keyof UserProjectItem, val: any) => {
    const updated = [...verifiedProjects];
    updated[index] = { ...updated[index], [field]: val };
    setVerifiedProjects(updated);
  };

  const removeProject = (index: number) => {
    setVerifiedProjects(verifiedProjects.filter((_, i) => i !== index));
  };

  const addEmptyProject = () => {
    setVerifiedProjects([
      ...verifiedProjects,
      { name: "New Project", description: "Short description", stack: ["TypeScript"], status: "built", is_production: false }
    ]);
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload: FullOnboardingPayload = {
        user_id: userId,
        email: userEmail,
        name: name || "Arjun Sharma",
        location: location,
        years_experience: yearsExperience,
        current_role: currentRole,
        skills: verifiedSkills.map(s => ({ skill: s, source: 'stated', confidence: 1.0 })),
        projects: verifiedProjects,
        preferences: {
          target_roles: selectedRoles,
          company_stage: selectedStages,
          industries: selectedIndustries,
          location_pref: selectedLocations,
        }
      };

      await onComplete(payload);
    } catch (e: any) {
      console.error("Submission failed:", e);
      alert(e.message || "We encountered a brief issue setting up your feed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const STEP_TITLES = [
    { title: "Target Engineering Roles", subtitle: "Select all roles you are targeting" },
    { title: "Company Stage & Geography", subtitle: "Define your company size and location preferences" },
    { title: "Your Engineering Stack", subtitle: "Enter your core skills and notable projects" },
    { title: "Complete Scouting Setup", subtitle: "Launch your personalized opportunity feed" },
  ];

  const STEPS_NAV = [
    { label: "Profile", icon: "1" },
    { label: "Preferences", icon: "2" },
    { label: "Stack", icon: "3" },
    { label: "Launch", icon: "4" }
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#ffffff', fontFamily: 'var(--font-sans)', width: '100vw' }}>
      
      {/* LEFT PANE - ONBOARDING WIZARD */}
      <div style={{ 
        flex: '1 1 50%', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '40px 8%', 
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        overflow: 'hidden'
      }}>
        
        {/* Logo */}
        <div style={{ cursor: 'pointer', position: 'absolute', top: '24px', left: '8%', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate("/")}>
          <img src="/sidedoor_logo.png" alt="SideDoor" style={{ height: '36px' }} />
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.25rem', fontWeight: 600, color: '#1a1f16' }}>SideDoor</span>
        </div>

        {/* Wizard Container */}
        <div style={{ maxWidth: '440px', width: '100%' }}>
          
          {/* Segmented Line Progress Bar */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
            {[0, 1, 2, 3].map((idx) => {
              const isCompleted = idx < step;
              const isActive = idx === step;
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    height: "3px",
                    borderRadius: "1.5px",
                    backgroundColor: isCompleted ? "var(--ink)" : (isActive ? "var(--accent-gold)" : "var(--border-light)"),
                    transition: "all 0.3s ease"
                  }}
                />
              );
            })}
          </div>

          {/* Step Header */}
          <div style={{ marginBottom: "20px", borderBottom: "1px solid var(--paper-edge)", paddingBottom: "14px" }}>
            <div className="font-mono" style={{ fontSize: "0.72rem", color: "var(--accent-gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Step {step + 1} of 4 • {STEPS_NAV[step].label}
            </div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.35rem", color: "var(--ink)", margin: "2px 0 0 0", fontWeight: 600 }}>
              {STEP_TITLES[step].title}
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              {STEP_TITLES[step].subtitle}
            </p>
          </div>

        {/* STEP 1: IDENTITY & ROLES */}
        {step === 0 && (
          <div key={step} className="fade-in-smooth" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label className="onboarding-input-label">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Arjun Sharma"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="onboarding-input"
                  style={{ padding: "8px 12px", fontSize: "0.88rem" }}
                />
              </div>
              <div>
                <label className="onboarding-input-label">City / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Bangalore, India"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="onboarding-input"
                  style={{ padding: "8px 12px", fontSize: "0.88rem" }}
                />
              </div>
            </div>

            <div>
              <label className="onboarding-input-label">Experience Level</label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                {EXPERIENCE_LEVELS.map(exp => (
                  <button
                    key={exp}
                    onClick={() => setYearsExperience(exp)}
                    className="onboarding-pill"
                    style={{
                      padding: "4px 12px",
                      fontSize: "0.75rem",
                      backgroundColor: yearsExperience === exp ? "var(--cream)" : "transparent",
                      borderColor: yearsExperience === exp ? "var(--accent-gold)" : "var(--border)",
                      color: yearsExperience === exp ? "var(--ink)" : "var(--text-muted)",
                      fontWeight: yearsExperience === exp ? 700 : 500
                    }}
                  >
                    {exp}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="onboarding-input-label" style={{ marginBottom: "6px", display: "block" }}>
                Target Engineering Roles (Multiple allowed)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {TARGET_ROLES.map(r => {
                  const isSelected = selectedRoles.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggleRole(r.id)}
                      className={`onboarding-option${isSelected ? " selected" : ""}`}
                      style={{ padding: "6px 10px", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}
                    >
                      <span style={{
                        width: "24px", height: "24px", borderRadius: "5px", flexShrink: 0,
                        backgroundColor: isSelected ? "rgba(152,118,26,0.15)" : "var(--surface)",
                        border: isSelected ? "1px solid var(--accent-gold)" : "1px solid var(--border-light)",
                        color: isSelected ? "var(--accent-gold)" : "var(--text-dim)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 700
                      }}>
                        {r.badge}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink)" }}>{r.label}</div>
                      </div>
                      {isSelected && <Check size={12} color="var(--accent-gold)" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: COMPANY STAGE & GEOGRAPHY */}
        {step === 1 && (
          <div key={step} className="fade-in-smooth" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label className="onboarding-input-label" style={{ marginBottom: "6px", display: "block" }}>
                Target Company Stage (Multiple allowed)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {COMPANY_STAGES.map(s => {
                  const isSelected = selectedStages.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStage(s.id)}
                      className={`onboarding-option${isSelected ? " selected" : ""}`}
                      style={{ padding: "8px 10px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--ink)" }}>{s.label}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{s.desc}</div>
                      </div>
                      {isSelected && <Check size={14} color="var(--accent-gold)" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="onboarding-input-label" style={{ marginBottom: "6px", display: "block" }}>
                Location Preference (Multiple allowed)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {LOCATION_OPTIONS.map(loc => {
                  const isSelected = selectedLocations.includes(loc.id);
                  return (
                    <button
                      key={loc.id}
                      onClick={() => toggleLocation(loc.id)}
                      className={`onboarding-option${isSelected ? " selected" : ""}`}
                      style={{ padding: "8px 6px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px" }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--ink)" }}>{loc.label}</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>{loc.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="onboarding-input-label" style={{ marginBottom: "6px", display: "block" }}>
                Preferred Industries
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {INDUSTRIES.map(ind => {
                  const isSelected = selectedIndustries.includes(ind);
                  return (
                    <button
                      key={ind}
                      onClick={() => toggleIndustry(ind)}
                      className="onboarding-pill"
                      style={{
                        padding: "4px 12px",
                        fontSize: "0.75rem",
                        backgroundColor: isSelected ? "var(--cream)" : "transparent",
                        borderColor: isSelected ? "var(--accent-gold)" : "var(--border)",
                        color: isSelected ? "var(--ink)" : "var(--text-muted)",
                        fontWeight: isSelected ? 700 : 500
                      }}
                    >
                      {isSelected && "✓ "}
                      {ind}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: MANUAL STACK INPUT (Formerly Verification) */}
        {step === 2 && (
          <div key={step} className="fade-in-smooth" style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "300px", overflowY: "auto", paddingRight: "4px" }}>
            <div style={{ padding: "10px 14px", backgroundColor: "var(--cream)", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "0.78rem", color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={14} color="var(--accent-gold)" style={{ flexShrink: 0 }} />
              <span><strong>Build your profile.</strong> Add your core skills and notable projects so we can find accurate startup matches.</span>
            </div>

            {/* Skills Verification */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="onboarding-input-label" style={{ margin: 0 }}>Core Skills ({verifiedSkills.length})</label>
                <div style={{ display: "flex", gap: "4px" }}>
                  <input
                    type="text"
                    placeholder="Add..."
                    value={newSkillInput}
                    onChange={e => setNewSkillInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
                    style={{ padding: "4px 6px", fontSize: "0.75rem", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--surface)", color: "var(--ink)", outline: "none", width: "100px" }}
                  />
                  <button onClick={addSkill} className="btn-secondary" style={{ padding: "4px 6px", fontSize: "0.72rem", height: "auto" }}>
                    <Plus size={10} />
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {verifiedSkills.map(s => (
                  <span
                    key={s}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      padding: "3px 8px", borderRadius: "12px",
                      backgroundColor: "var(--surface)", border: "1px solid var(--border)",
                      color: "var(--ink)", fontSize: "0.72rem", fontWeight: 600
                    }}
                  >
                    {s}
                    <button onClick={() => removeSkill(s)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-dim)", display: "flex" }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Projects Verification */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="onboarding-input-label" style={{ margin: 0 }}>Notable Projects ({verifiedProjects.length})</label>
                <button onClick={addEmptyProject} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.72rem", height: "auto", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Plus size={10} />
                  <span>Add Project</span>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {verifiedProjects.map((proj, idx) => (
                  <div key={idx} style={{ padding: "10px", backgroundColor: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                      <input
                        type="text"
                        value={proj.name}
                        onChange={e => updateProject(idx, "name", e.target.value)}
                        placeholder="Project Name"
                        style={{ flex: 1, padding: "4px 8px", fontWeight: 700, fontSize: "0.8rem", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--paper)", color: "var(--ink)", outline: "none" }}
                      />
                      <button onClick={() => removeProject(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "0 2px" }}>
                        <X size={12} />
                      </button>
                    </div>
                    <textarea
                      value={proj.description}
                      onChange={e => updateProject(idx, "description", e.target.value)}
                      placeholder="Short description"
                      style={{ width: "100%", padding: "4px 8px", fontSize: "0.75rem", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--paper)", color: "var(--text-muted)", resize: "none", minHeight: "32px", outline: "none" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: FINAL CONFIRMATION */}
        {step === 3 && (
          <div key={step} className="fade-in-smooth" style={{ padding: "12px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={20} color="var(--accent-gold)" />
            </div>
            <div>
              <h3 className="font-serif" style={{ fontSize: "1.2rem", color: "var(--ink)", margin: "0 0 4px 0", fontWeight: 600 }}>
                Ready to Scout Opportunities
              </h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", maxWidth: "380px", margin: "0 auto", lineHeight: 1.45 }}>
                Your preferences and stack are set. We will match you against high-paying VC startups in real time.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Actions Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", paddingTop: "12px", borderTop: "1px solid var(--paper-edge)" }}>
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="btn-secondary" style={{ padding: "6px 14px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "6px", height: "auto" }}>
              <ArrowLeft size={12} />
              <span>Back</span>
            </button>
          ) : <div />}

          {step < 3 && (
            <button onClick={() => setStep(step + 1)} className="btn-primary" style={{ padding: "6px 18px", fontSize: "0.8rem", height: "auto" }}>
              <span>Continue</span>
              <ArrowRight size={12} />
            </button>
          )}

          {step === 3 && (
            <button onClick={handleFinalSubmit} disabled={isSubmitting} className="btn-primary" style={{ padding: "8px 20px", fontSize: "0.85rem", height: "auto" }}>
              <span>{isSubmitting ? "Launching..." : "Launch Feed 🚀"}</span>
            </button>
          )}
        </div>
      </div>
    </div>

      {/* RIGHT PANE - GRAPHIC */}
      <div className="onboarding-image-pane" style={{ 
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
          alt="SideDoor onboarding graphic" 
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
            Set your target.
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
              Let our pipeline find your next buildable MVP.
            </span>
          </h2>
        </div>
      </div>

      {/* Adding a style block to handle media query for mobile (hiding the right pane) */}
      <style>{`
        @media (max-width: 900px) {
          .onboarding-image-pane {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
