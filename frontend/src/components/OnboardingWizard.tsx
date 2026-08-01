import { useState } from "react";
import { ArrowRight, ArrowLeft, Check, Zap, MapPin, Briefcase } from "lucide-react";
import type { OnboardingData } from "../types/schema";

interface OnboardingWizardProps {
  userName?: string;
  onComplete: (data: OnboardingData & { name: string; location: string; user_type: string }) => Promise<void>;
}

const ROLES = [
  { id: "product_engineer", label: "Product Engineer",   badge: "PE",  desc: "Build features end-to-end, own the full stack" },
  { id: "fullstack",        label: "Full Stack Engineer", badge: "FS",  desc: "Frontend + backend, API-first mindset" },
  { id: "frontend",         label: "Frontend Engineer",   badge: "FE",  desc: "UI/UX, performance, design systems" },
  { id: "backend",          label: "Backend / Systems",   badge: "BE",  desc: "APIs, infra, databases, reliability" },
  { id: "devops",           label: "DevOps / Platform",   badge: "DO",  desc: "CI/CD, Kubernetes, cloud, observability" },
  { id: "ai_ml",            label: "AI / ML Engineer",    badge: "AI",  desc: "LLMs, embeddings, model serving" },
];

const EXPERIENCE_OPTIONS = ["< 1 year", "1-3 years", "3-6 years", "6+ years"];

const FOCUS_OPTIONS = [
  { id: "switch",     label: "Switching companies" },
  { id: "job_search", label: "First full-time job" },
  { id: "freelance",  label: "Freelance / consulting" },
  { id: "project",    label: "Side project / OSS" },
];

const TECH_GROUPS = [
  { label: "Frontend",   items: ["React", "Next.js", "Vue", "Svelte", "TypeScript", "TailwindCSS"] },
  { label: "Backend",    items: ["Node.js", "Python", "Go", "Rust", "Java", "FastAPI"] },
  { label: "Database",   items: ["PostgreSQL", "Supabase", "MongoDB", "Redis", "MySQL", "Prisma"] },
  { label: "DevTools",   items: ["Docker", "Vercel", "Railway", "GitHub Actions", "Terraform", "AWS"] },
  { label: "AI / ML",    items: ["OpenAI API", "LangChain", "HuggingFace", "LlamaIndex", "Pinecone"] },
];

const DOMAINS = [
  "Developer Tooling", "Analytics & Monitoring", "Auth & Security",
  "Payments", "Infra / DevOps", "API Platforms",
  "AI Products", "Data Engineering", "Open Source",
];

const INVESTORS = [
  { id: "yc",       label: "Y Combinator" },
  { id: "a16z",     label: "Andreessen Horowitz" },
  { id: "peak_xv",  label: "Peak XV / Accel" },
  { id: "blume",    label: "Blume Ventures" },
  { id: "series_b", label: "Series B+" },
];

const VALUES = [
  { id: "eng_culture", label: "Strong eng culture" },
  { id: "remote",      label: "Remote-friendly" },
  { id: "fast",        label: "Fast-moving" },
  { id: "oss",         label: "Open source" },
  { id: "ai_first",    label: "AI-first" },
  { id: "small_team",  label: "Small team (<50)" },
];

const USER_TYPES = [
  { id: "student",       label: "Student",              desc: "Currently in college / university" },
  { id: "recent_grad",   label: "Recent Graduate",      desc: "Graduated in the last 2 years" },
  { id: "professional",  label: "Working Professional", desc: "Currently employed, looking to switch" },
  { id: "career_switch", label: "Career Switcher",      desc: "Transitioning from a different field" },
];

const toggle = (arr: string[], val: string): string[] =>
  arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

const EMPTY_DATA: OnboardingData = {
  role: "",
  years_experience: "",
  focus: "",
  tech_stack: [],
  domains: [],
  github_url: "",
  project_summary: "",
  target_investors: [],
  company_values: [],
};

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        padding: "5px 12px", borderRadius: "999px",
        border: `1px solid ${selected ? "var(--accent-gold)" : "var(--border)"}`,
        background: selected ? "rgba(152,118,26,0.1)" : "var(--surface)",
        color: selected ? "var(--accent-gold)" : "var(--text-muted)",
        fontFamily: "var(--font-mono)", fontSize: "0.76rem",
        fontWeight: selected ? 700 : 500,
        cursor: "pointer", transition: "all 0.15s ease", userSelect: "none",
      }}
    >
      {selected && <Check size={10} />}
      {label}
    </button>
  );
}

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`onboarding-pill${selected ? " selected" : ""}`}>
      {label}
    </button>
  );
}

// ----- STEP 0: Identity -----
function StepZero({
  name, location, userType,
  onName, onLocation, onUserType,
}: {
  name: string; location: string; userType: string;
  onName: (v: string) => void; onLocation: (v: string) => void; onUserType: (v: string) => void;
}) {
  return (
    <div className="onboarding-step" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Full Name */}
      <div>
        <label className="onboarding-input-label" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          Full Name
        </label>
        <input
          type="text"
          placeholder="e.g. Arjun Mehta"
          value={name}
          onChange={e => onName(e.target.value)}
          className="onboarding-input"
        />
      </div>

      {/* Location */}
      <div>
        <label className="onboarding-input-label" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <MapPin size={10} /> City / Location
        </label>
        <input
          type="text"
          placeholder="e.g. Bangalore, India"
          value={location}
          onChange={e => onLocation(e.target.value)}
          className="onboarding-input"
        />
        <p style={{ margin: "5px 0 0", fontSize: "0.74rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          Used to surface India-based hackathons and region-relevant grants.
        </p>
      </div>

      {/* User Type */}
      <div>
        <p className="onboarding-section-label" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <Briefcase size={10} /> What best describes you?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {USER_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => onUserType(t.id)}
              className={`onboarding-option${userType === t.id ? " selected" : ""}`}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)" }}>{t.label}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "2px" }}>{t.desc}</div>
              </div>
              {userType === t.id && <Check size={14} color="var(--accent-gold)" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- STEP 1: Role & Experience -----
function StepOne({ data, update }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void }) {
  return (
    <div className="onboarding-step" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p className="onboarding-section-label">What kind of engineer are you?</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {ROLES.map(r => (
            <button
              key={r.id}
              className={`onboarding-option${data.role === r.id ? " selected" : ""}`}
              onClick={() => update({ role: r.id })}
            >
              <span style={{
                width: "30px", height: "30px", borderRadius: "7px", flexShrink: 0,
                background: data.role === r.id ? "rgba(152,118,26,0.12)" : "var(--cream)",
                border: data.role === r.id ? "1px solid var(--accent-gold)" : "1px solid var(--border-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 700,
                color: data.role === r.id ? "var(--accent-gold)" : "var(--text-dim)",
                transition: "all 0.15s",
              }}>
                {r.badge}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)" }}>{r.label}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "1px" }}>{r.desc}</div>
              </div>
              {data.role === r.id && <Check size={14} color="var(--accent-gold)" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="onboarding-section-label">Years shipping products?</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {EXPERIENCE_OPTIONS.map(opt => (
            <Pill key={opt} label={opt} selected={data.years_experience === opt} onClick={() => update({ years_experience: opt })} />
          ))}
        </div>
      </div>

      <div>
        <p className="onboarding-section-label">Current focus?</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {FOCUS_OPTIONS.map(f => (
            <Pill key={f.id} label={f.label} selected={data.focus === f.id} onClick={() => update({ focus: f.id })} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- STEP 2: Tech Stack -----
function StepTwo({ data, update }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void }) {
  return (
    <div className="onboarding-step" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <p className="onboarding-section-label">Your core tech stack</p>
        <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "12px", fontFamily: "var(--font-mono)" }}>
          Click all that apply — we match these against real engineering gaps at target companies
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {TECH_GROUPS.map(group => (
            <div key={group.label}>
              <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "7px" }}>
                {group.label}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {group.items.map(tech => (
                  <Chip key={tech} label={tech} selected={data.tech_stack.includes(tech)} onClick={() => update({ tech_stack: toggle(data.tech_stack, tech) })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="onboarding-section-label">Domains you know best</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {DOMAINS.map(d => (
            <Chip key={d} label={d} selected={data.domains.includes(d)} onClick={() => update({ domains: toggle(data.domains, d) })} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ----- STEP 3: Signal -----
function StepThree({ data, update }: { data: OnboardingData; update: (p: Partial<OnboardingData>) => void }) {
  return (
    <div className="onboarding-step" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <label className="onboarding-input-label">GitHub URL — optional, shows your real work</label>
        <input
          className="onboarding-input"
          type="url"
          placeholder="https://github.com/yourhandle"
          value={data.github_url}
          onChange={e => update({ github_url: e.target.value })}
        />
      </div>

      <div>
        <label className="onboarding-input-label">Strongest project in 1–2 sentences — optional</label>
        <textarea
          className="onboarding-input"
          rows={3}
          placeholder='e.g. "Built a real-time webhook debugger for Stripe integrations using React + Supabase. 40+ GitHub stars."'
          value={data.project_summary}
          onChange={e => update({ project_summary: e.target.value })}
          style={{ resize: "vertical", lineHeight: 1.5 }}
        />
      </div>

      <div>
        <p className="onboarding-section-label">Target company investors</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
          {INVESTORS.map(inv => (
            <Pill
              key={inv.id}
              label={inv.label}
              selected={data.target_investors.includes(inv.id)}
              onClick={() => update({ target_investors: toggle(data.target_investors, inv.id) })}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="onboarding-section-label">What matters to you in a company?</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
          {VALUES.map(v => (
            <Chip
              key={v.id}
              label={v.label}
              selected={data.company_values.includes(v.id)}
              onClick={() => update({ company_values: toggle(data.company_values, v.id) })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const STEPS = ["About You", "Role & Experience", "Tech Stack", "Your Signal"];

export function OnboardingWizard({ userName = "", onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(EMPTY_DATA);
  const [name, setName] = useState(userName);
  const [location, setLocation] = useState("");
  const [userType, setUserType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (patch: Partial<OnboardingData>) =>
    setData((prev: OnboardingData) => ({ ...prev, ...patch }));

  const progress = ((step + 1) / STEPS.length) * 100;

  const canContinue =
    step === 0 ? name.trim().length > 0 && userType !== "" :
    step === 1 ? data.role !== "" && data.years_experience !== "" :
    step === 2 ? data.tech_stack.length >= 1 : true;

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      await onComplete({ ...data, name, location, user_type: userType });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepHeadlines = [
    <span key="s0">Tell us <em>about yourself.</em></span>,
    <span key="s1">What kind of engineer <em>are you?</em></span>,
    <span key="s2">{"What's in your "}<em>tech arsenal?</em></span>,
    <span key="s3">Show us your <em>signal.</em></span>,
  ];

  const stepSubs = [
    "Helps us surface region-specific opportunities and match you to the right company stage.",
    "Determines which opportunities we surface for you.",
    "We match your stack against real engineering gaps in target companies.",
    "Optional but powerful — personalises your match scores immediately.",
  ];

  return (
    <div className="wizard-card">
      {/* Header */}
      <div style={{ padding: "28px 32px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "26px", height: "26px", borderRadius: "6px",
              background: "var(--ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Zap size={13} color="var(--cream)" fill="var(--cream)" />
            </div>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.05rem", color: "var(--ink)", letterSpacing: "-0.02em" }}>
              SideDoor
            </span>
          </div>
          {/* Step counter */}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-dim)", letterSpacing: "0.06em" }}>
            STEP {step + 1} OF {STEPS.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="onboarding-progress-track" style={{ marginBottom: "24px" }}>
          <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Step headline */}
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{
            margin: 0,
            fontSize: "1.45rem",
            fontFamily: "var(--font-serif)",
            color: "var(--ink)",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            lineHeight: 1.25,
          }}>
            {stepHeadlines[step]}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            {stepSubs[step]}
          </p>
        </div>
      </div>

      {/* Step content — scrollable */}
      <div style={{ padding: "0 32px", maxHeight: "420px", overflowY: "auto" }}>
        {step === 0 && <StepZero name={name} location={location} userType={userType} onName={setName} onLocation={setLocation} onUserType={setUserType} />}
        {step === 1 && <StepOne data={data} update={update} />}
        {step === 2 && <StepTwo data={data} update={update} />}
        {step === 3 && <StepThree data={data} update={update} />}
      </div>

      {/* Footer nav */}
      <div style={{
        padding: "20px 32px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "16px",
        borderTop: "1px solid var(--border-light)",
      }}>
        {step > 0 ? (
          <button className="onboarding-btn-ghost" onClick={() => setStep(s => s - 1)}>
            <ArrowLeft size={14} /> Back
          </button>
        ) : <div />}

        {step < STEPS.length - 1 ? (
          <button className="onboarding-btn-primary" disabled={!canContinue} onClick={() => setStep(s => s + 1)}>
            Continue <ArrowRight size={14} />
          </button>
        ) : (
          <button className="onboarding-btn-primary" disabled={isSubmitting} onClick={handleFinish}>
            {isSubmitting ? "Building your feed..." : "Find My Opportunities"}
            {!isSubmitting && <ArrowRight size={14} />}
          </button>
        )}
      </div>

      {/* Skip */}
      <div style={{ textAlign: "center", paddingBottom: "20px" }}>
        <button
          onClick={() => onComplete({ ...EMPTY_DATA, name, location, user_type: userType })}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-dim)",
            fontSize: "0.75rem",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
          }}
        >
          Skip for now — fill this in later
        </button>
      </div>
    </div>
  );
}
