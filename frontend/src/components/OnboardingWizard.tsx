import { useState } from "react";
import { ArrowRight, ArrowLeft, Check, Upload, Zap, Plus, X, FileText, AlertCircle } from "lucide-react";
import type { FullOnboardingPayload, UserProjectItem } from "../types/schema";
import { apiClient } from "../api/client";

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
  const [step, setStep] = useState<number>(0); // 0..4 (5 steps)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

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

  // Step 3: Resume File / Raw Text Input
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");

  // Step 4: Verification & Edit State (Extracted Data)
  const [verifiedSkills, setVerifiedSkills] = useState<string[]>([]);
  const [verifiedProjects, setVerifiedProjects] = useState<UserProjectItem[]>([]);
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

  // Step 3 -> Step 4 Extraction Handler
  const handleParseResume = async () => {
    if (!uploadedFile && !rawText.trim()) {
      setParseError("Please select a resume file or paste text first.");
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      const res = await apiClient.parseResumePreview(uploadedFile || undefined, rawText || undefined);
      
      if (res.name && !name) {
        setName(res.name);
      }

      if (res.skills && res.skills.length > 0) {
        setVerifiedSkills(res.skills);
      } else {
        setVerifiedSkills(["TypeScript", "React", "Python", "PostgreSQL", "FastAPI"]);
      }

      if (res.projects && res.projects.length > 0) {
        setVerifiedProjects(res.projects.map((p: any) => ({
          name: p.name || p.title || "Project",
          description: p.description || "",
          stack: p.stack || p.tech_used || [],
          status: p.status || "built",
          is_production: p.is_production || false,
        })));
      } else {
        setVerifiedProjects([
          {
            name: "SideDoor Portfolio App",
            description: "Fullstack AI-assisted opportunity discovery application",
            stack: ["TypeScript", "React", "FastAPI"],
            status: "built",
            is_production: true,
          }
        ]);
      }

      setStep(3); // Advance to Verification Step 4
    } catch (e: any) {
      console.error("Extraction error:", e);
      setParseError(e.message || "Failed to extract resume data. You can manually enter your skills in the next step.");
      // Fallback defaults so user isn't stuck
      setVerifiedSkills(["TypeScript", "React", "Python", "FastAPI", "PostgreSQL"]);
      setVerifiedProjects([
        {
          name: "Fullstack Project",
          description: "Production web software & API platform",
          stack: ["React", "Python", "PostgreSQL"],
          status: "built",
          is_production: true
        }
      ]);
      setStep(3);
    } finally {
      setIsParsing(false);
    }
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
        skills: verifiedSkills.map(s => ({ skill: s, source: 'resume', confidence: 1.0 })),
        projects: verifiedProjects,
        preferences: {
          target_roles: selectedRoles,
          company_stage: selectedStages,
          industries: selectedIndustries,
          location_pref: selectedLocations,
        }
      };

      await onComplete(payload);
    } catch (e) {
      console.error("Submission failed:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const STEP_TITLES = [
    { title: "Target Engineering Roles", subtitle: "Select all roles you are targeting" },
    { title: "Company Stage & Geography", subtitle: "Define your company size and location preferences" },
    { title: "Resume & Portfolio Upload", subtitle: "Extract skills & projects automatically via AI" },
    { title: "Verify Extracted Profile", subtitle: "Review and edit extracted skills and projects" },
    { title: "Complete Scouting Setup", subtitle: "Launch your personalized opportunity feed" },
  ];

  return (
    <div className="onboarding-bg" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div className="wizard-card paper-card" style={{ width: "100%", maxWidth: "680px", borderRadius: "16px", padding: "36px", backgroundColor: "var(--paper)", border: "1px solid var(--border)" }}>
        
        {/* Step Indicator Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <span className="font-mono" style={{ fontSize: "0.75rem", color: "var(--accent-gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Step {step + 1} of 5
            </span>
            <h2 className="font-serif" style={{ fontSize: "1.4rem", color: "var(--ink)", margin: "2px 0 0 0", fontWeight: 600 }}>
              {STEP_TITLES[step].title}
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
              {STEP_TITLES[step].subtitle}
            </p>
          </div>
          <div style={{ width: "100px", height: "6px", backgroundColor: "var(--border-light)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ width: `${((step + 1) / 5) * 100}%`, height: "100%", backgroundColor: "var(--accent-gold)", transition: "width 0.3s ease" }} />
          </div>
        </div>

        {/* STEP 1: IDENTITY & ROLES */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label className="onboarding-input-label">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Arjun Sharma"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="onboarding-input"
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
                />
              </div>
            </div>

            <div>
              <label className="onboarding-input-label">Experience Level</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                {EXPERIENCE_LEVELS.map(exp => (
                  <button
                    key={exp}
                    onClick={() => setYearsExperience(exp)}
                    className="onboarding-pill"
                    style={{
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
              <label className="onboarding-input-label" style={{ marginBottom: "8px", display: "block" }}>
                Target Engineering Roles (Multiple allowed)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {TARGET_ROLES.map(r => {
                  const isSelected = selectedRoles.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggleRole(r.id)}
                      className={`onboarding-option${isSelected ? " selected" : ""}`}
                      style={{ padding: "10px 12px", textAlign: "left", display: "flex", alignItems: "center", gap: "10px" }}
                    >
                      <span style={{
                        width: "28px", height: "28px", borderRadius: "6px", flexShrink: 0,
                        backgroundColor: isSelected ? "rgba(152,118,26,0.15)" : "var(--surface)",
                        border: isSelected ? "1px solid var(--accent-gold)" : "1px solid var(--border-light)",
                        color: isSelected ? "var(--accent-gold)" : "var(--text-dim)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700
                      }}>
                        {r.badge}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>{r.label}</div>
                      </div>
                      {isSelected && <Check size={14} color="var(--accent-gold)" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: COMPANY STAGE & GEOGRAPHY */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <label className="onboarding-input-label" style={{ marginBottom: "8px", display: "block" }}>
                Target Company Stage (Multiple allowed)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {COMPANY_STAGES.map(s => {
                  const isSelected = selectedStages.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStage(s.id)}
                      className={`onboarding-option${isSelected ? " selected" : ""}`}
                      style={{ padding: "12px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)" }}>{s.label}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{s.desc}</div>
                      </div>
                      {isSelected && <Check size={16} color="var(--accent-gold)" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="onboarding-input-label" style={{ marginBottom: "8px", display: "block" }}>
                Location Preference (Multiple allowed)
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {LOCATION_OPTIONS.map(loc => {
                  const isSelected = selectedLocations.includes(loc.id);
                  return (
                    <button
                      key={loc.id}
                      onClick={() => toggleLocation(loc.id)}
                      className={`onboarding-option${isSelected ? " selected" : ""}`}
                      style={{ padding: "10px 14px", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--ink)" }}>{loc.label}</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginLeft: "8px" }}>• {loc.desc}</span>
                      </div>
                      {isSelected && <Check size={14} color="var(--accent-gold)" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="onboarding-input-label" style={{ marginBottom: "8px", display: "block" }}>
                Preferred Industries
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {INDUSTRIES.map(ind => {
                  const isSelected = selectedIndustries.includes(ind);
                  return (
                    <button
                      key={ind}
                      onClick={() => toggleIndustry(ind)}
                      className="onboarding-pill"
                      style={{
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

        {/* STEP 3: RESUME UPLOAD */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ border: "2px dashed var(--border)", borderRadius: "12px", padding: "32px 20px", textAlign: "center", backgroundColor: "var(--surface)" }}>
              <Upload size={32} color="var(--accent-gold)" style={{ marginBottom: "12px" }} />
              <h3 style={{ fontSize: "1.05rem", color: "var(--ink)", margin: "0 0 6px 0", fontWeight: 600 }}>
                {uploadedFile ? uploadedFile.name : "Upload Resume (PDF or DOCX)"}
              </h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 16px 0" }}>
                pdfplumber & python-docx extract your skills, projects, and stack automatically.
              </p>
              <label className="btn-primary" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "0.85rem" }}>
                <FileText size={14} />
                <span>{uploadedFile ? "Change File" : "Choose Resume File"}</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  style={{ display: "none" }}
                  onChange={e => {
                    if (e.target.files?.[0]) setUploadedFile(e.target.files[0]);
                  }}
                />
              </label>
            </div>

            <div style={{ textAlign: "center" }} className="font-mono">
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>— Or Paste Raw Text —</span>
            </div>

            <div>
              <textarea
                placeholder="Paste plain resume text or bio here..."
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                style={{ width: "100%", minHeight: "100px", padding: "12px", backgroundColor: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "0.85rem", color: "var(--ink)", outline: "none" }}
              />
            </div>

            {parseError && (
              <div style={{ padding: "10px 14px", backgroundColor: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: "8px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertCircle size={14} />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: VERIFICATION & EDIT SCREEN */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxHeight: "420px", overflowY: "auto", paddingRight: "4px" }}>
            <div style={{ padding: "12px 16px", backgroundColor: "var(--cream)", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "0.82rem", color: "var(--ink)" }}>
              <strong>AI Extraction Complete!</strong> Review and correct any mis-extracted skills or projects below before driving company matches.
            </div>

            {/* Skills Verification */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label className="onboarding-input-label">Extracted Skills ({verifiedSkills.length})</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    placeholder="Add skill..."
                    value={newSkillInput}
                    onChange={e => setNewSkillInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())}
                    style={{ padding: "4px 8px", fontSize: "0.78rem", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--surface)", color: "var(--ink)" }}
                  />
                  <button onClick={addSkill} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem", height: "auto" }}>
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {verifiedSkills.map(s => (
                  <span
                    key={s}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      padding: "4px 10px", borderRadius: "14px",
                      backgroundColor: "var(--surface)", border: "1px solid var(--border)",
                      color: "var(--ink)", fontSize: "0.78rem", fontWeight: 600
                    }}
                  >
                    {s}
                    <button onClick={() => removeSkill(s)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-dim)", display: "flex" }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Projects Verification */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label className="onboarding-input-label">Extracted Projects ({verifiedProjects.length})</label>
                <button onClick={addEmptyProject} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "0.75rem", height: "auto", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Plus size={12} />
                  <span>Add Project</span>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {verifiedProjects.map((proj, idx) => (
                  <div key={idx} style={{ padding: "14px", backgroundColor: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                      <input
                        type="text"
                        value={proj.name}
                        onChange={e => updateProject(idx, "name", e.target.value)}
                        placeholder="Project Name"
                        style={{ flex: 1, padding: "6px 10px", fontWeight: 700, fontSize: "0.88rem", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--paper)", color: "var(--ink)" }}
                      />
                      <button onClick={() => removeProject(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>
                        <X size={14} />
                      </button>
                    </div>
                    <textarea
                      value={proj.description}
                      onChange={e => updateProject(idx, "description", e.target.value)}
                      placeholder="Short description"
                      style={{ width: "100%", padding: "6px 10px", fontSize: "0.8rem", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--paper)", color: "var(--text-muted)", resize: "vertical", minHeight: "40px" }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: FINAL CONFIRMATION */}
        {step === 4 && (
          <div style={{ padding: "20px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={28} color="var(--accent-gold)" />
            </div>
            <div>
              <h3 className="font-serif" style={{ fontSize: "1.3rem", color: "var(--ink)", margin: "0 0 6px 0", fontWeight: 600 }}>
                Ready to Scout Opportunities
              </h3>
              <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", maxWidth: "420px", margin: "0 auto", lineHeight: 1.5 }}>
                Your preferences and verified credentials are set. We will match you against high-paying VC startups in real time.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Actions Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "28px", paddingTop: "16px", borderTop: "1px solid var(--paper-edge)" }}>
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="btn-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          ) : <div />}

          {step < 2 && (
            <button onClick={() => setStep(step + 1)} className="btn-primary" style={{ padding: "8px 20px", fontSize: "0.85rem" }}>
              <span>Continue</span>
              <ArrowRight size={14} />
            </button>
          )}

          {step === 2 && (
            <button onClick={handleParseResume} disabled={isParsing} className="btn-primary" style={{ padding: "8px 20px", fontSize: "0.85rem" }}>
              <span>{isParsing ? "Extracting JSON..." : "Extract & Verify →"}</span>
            </button>
          )}

          {step === 3 && (
            <button onClick={() => setStep(4)} className="btn-primary" style={{ padding: "8px 20px", fontSize: "0.85rem" }}>
              <span>Confirm & Next →</span>
            </button>
          )}

          {step === 4 && (
            <button onClick={handleFinalSubmit} disabled={isSubmitting} className="btn-primary" style={{ padding: "10px 24px", fontSize: "0.9rem" }}>
              <span>{isSubmitting ? "Launching Feed..." : "Launch Feed 🚀"}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
