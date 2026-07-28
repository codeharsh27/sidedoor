import React, { useState, useEffect } from 'react';
import type { OpportunityCardView, FixabilityFlags, UserProfile } from '../types/schema';
import { MOCK_CARDS } from '../mock/mockData';
import { CompanyLogo } from './CompanyLogo';
import { 
  Terminal, Search, ShieldAlert,
  ArrowUpRight, Building2, PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen, ArrowLeft, Upload, Link as LinkIcon, Send, AlertCircle, Plus, FileText, X, Settings
} from 'lucide-react';



interface DashboardViewProps {
  userProfile?: UserProfile;
  onBackToLanding?: () => void;
}

const createMockOpportunityForCompany = (name: string): OpportunityCardView => {
  return {
    card: { id: `card_${name.toLowerCase()}_01`, user_id: 'usr_aditya_01', gap_cluster_id: `gap_${name.toLowerCase()}_db`, profile_match_score: 93, shown_at: new Date().toISOString(), status: 'new' },
    company: { id: `comp_${name.toLowerCase()}`, name: name, url: `https://${name.toLowerCase()}.com`, github_repo_url: `https://github.com/${name.toLowerCase()}/${name.toLowerCase()}`, careers_page_url: `https://${name.toLowerCase()}.com/careers`, last_scanned_at: new Date().toISOString() },
    gap_cluster: { id: `gap_${name.toLowerCase()}_db`, company_id: `comp_${name.toLowerCase()}`, label: `Visual Platform Console for Webhook Inspector & Debug Logs`, evidence_item_ids: [`ev_${name.toLowerCase()}_01`], evidence_count: 1, recency_score: 0.96, rank_score: 92.0 },
    evidence_items: [{ id: `ev_${name.toLowerCase()}_01`, company_id: `comp_${name.toLowerCase()}`, source_type: 'github_issue', source_url: `https://github.com/${name.toLowerCase()}/${name.toLowerCase()}/issues/2024`, raw_text: `Telemetry logs and request events should be displayed in a live dashboard view so developers don't have to watch raw terminal stdout streams.`, author_handle: 'postgres_dev', posted_at: '2026-07-24T10:00:00Z', fetched_at: '2026-07-25T12:00:00Z' }],
    fixability_flags: { id: `fix_${name.toLowerCase()}_01`, gap_cluster_id: `gap_${name.toLowerCase()}_db`, has_public_repo: true, has_public_api: true, has_ui_surface: true, is_buildable: true },
    role_match: { job_posting: { id: `job_${name.toLowerCase()}_01`, company_id: `comp_${name.toLowerCase()}`, title: 'Frontend Developer Tools Engineer', raw_text: 'Build developer tooling database interfaces.', posted_at: '2026-07-20T00:00:00Z', is_open: true }, match_score: 91 },
    why_matches_you: `Matches your expertise in React, Webhooks and your background in building custom analytics dashboards.`
  };
};

const generateOutreachText = (item: OpportunityCardView, appUrl: string, videoUrl: string) => {
  const companyName = item.company.name;
  const gapLabel = item.gap_cluster.label.toLowerCase();
  
  return `Hi Engineering Team, 
  
I noticed a gap in ${companyName}'s product feedback regarding the ${gapLabel}. 

To show rather than tell, I went ahead and built a live proof-of-concept visual extension resolving this here: ${appUrl || '[Your Live App Link]'}

I also recorded a quick 60-second Loom walking through the codebase and implementation strategy: ${videoUrl || '[Your Loom Link]'}

Would love to hand this over to the engineering team and hear your feedback!`;
};

interface Contact {
  name: string;
  role: string;
  linkedin: string;
  email: string;
}

const getMockContacts = (companyName: string): Contact[] => {
  const c = companyName.toLowerCase();
  if (c.includes('posthog')) {
    return [
      { name: "James Hawkins", role: "Co-Founder & CEO", linkedin: "https://www.linkedin.com/in/james-hawkins-ph", email: "james.h@posthog.com" },
      { name: "Tim Glaser", role: "Co-Founder & CTO", linkedin: "https://www.linkedin.com/in/tim-glaser-ph", email: "tim.g@posthog.com" },
      { name: "Alex White", role: "Engineering Manager (DevTools)", linkedin: "https://www.linkedin.com/in/alex-white-devtools", email: "alex.w@posthog.com" },
      { name: "Luke Harries", role: "Product Engineer", linkedin: "https://www.linkedin.com/in/luke-harries", email: "luke.h@posthog.com" },
      { name: "Annika Schmid", role: "Talent Acquisition Specialist", linkedin: "https://www.linkedin.com/in/annika-schmid", email: "annika.s@posthog.com" }
    ];
  } else if (c.includes('stripe')) {
    return [
      { name: "John Collison", role: "Co-Founder & President", linkedin: "https://www.linkedin.com/in/johncollison", email: "john.c@stripe.com" },
      { name: "Sarah Franklin", role: "Engineering Manager (Billing)", linkedin: "https://www.linkedin.com/in/sarah-franklin-stripe", email: "sarah.f@stripe.com" },
      { name: "David Stark", role: "Lead DevTools Engineer", linkedin: "https://www.linkedin.com/in/davidstark", email: "david.s@stripe.com" },
      { name: "Michelle Chen", role: "Director of Product", linkedin: "https://www.linkedin.com/in/mchen-stripe", email: "mchen@stripe.com" },
      { name: "Robert Patterson", role: "Technical Recruiter", linkedin: "https://www.linkedin.com/in/rpatterson-talent", email: "robert.p@stripe.com" }
    ];
  } else if (c.includes('linear')) {
    return [
      { name: "Karri Saarinen", role: "Co-Founder & CEO", linkedin: "https://www.linkedin.com/in/karrisaarinen", email: "karri@linear.app" },
      { name: "Tuomas Artman", role: "Co-Founder & CTO", linkedin: "https://www.linkedin.com/in/artman", email: "tuomas@linear.app" },
      { name: "Jari Kolehmainen", role: "Principal Engineer", linkedin: "https://www.linkedin.com/in/jarikole", email: "jari@linear.app" },
      { name: "Tomi Ruotimo", role: "Engineering Lead", linkedin: "https://www.linkedin.com/in/truotimo", email: "tomi@linear.app" },
      { name: "Elena Verna", role: "Head of Growth", linkedin: "https://www.linkedin.com/in/elenaverna", email: "elena@linear.app" }
    ];
  } else if (c.includes('vercel')) {
    return [
      { name: "Guillermo Rauch", role: "Founder & CEO", linkedin: "https://www.linkedin.com/in/rauchg", email: "rauchg@vercel.com" },
      { name: "Lee Robinson", role: "VP of Developer Experience", linkedin: "https://www.linkedin.com/in/leerob", email: "leerob@vercel.com" },
      { name: "Jared Palmer", role: "Engineering Manager (Turborepo)", linkedin: "https://www.linkedin.com/in/jaredpalmer", email: "jared@vercel.com" },
      { name: "Shu Ding", role: "Lead Frontend Engineer", linkedin: "https://www.linkedin.com/in/shuding", email: "shu@vercel.com" },
      { name: "Kari Anderson", role: "Lead Recruiting Partner", linkedin: "https://www.linkedin.com/in/kanderson-talent", email: "kari.a@vercel.com" }
    ];
  } else {
    const formatted = companyName.toLowerCase().replace(/\s+/g, '');
    return [
      { name: `Marc Andreessen`, role: "Board Member / Investor", linkedin: "https://www.linkedin.com", email: `marc@pm.com` },
      { name: `Alex Rivers`, role: "Engineering Manager", linkedin: "https://www.linkedin.com", email: `alex.r@${formatted}.com` },
      { name: `Taylor Vance`, role: "Lead Frontend Architect", linkedin: "https://www.linkedin.com", email: `taylor.v@${formatted}.com` },
      { name: `Jordan Smith`, role: "Senior Developer Advocate", linkedin: "https://www.linkedin.com", email: `jordan.s@${formatted}.com` },
      { name: `Morgan Gray`, role: "Talent Acquisition Manager", linkedin: "https://www.linkedin.com", email: `morgan.g@${formatted}.com` }
    ];
  }
};

const getOpportunityDetails = (item: OpportunityCardView) => {
  const isPostHog = item.company.name.toLowerCase().includes('posthog');
  const isStripe = item.company.name.toLowerCase().includes('stripe');
  const isLinear = item.company.name.toLowerCase().includes('linear');

  if (isPostHog) {
    return {
      opportunity: "Build a real-time webhooks dashboard widget that allows developers to inspect sent webhook payloads directly inside their settings panel.",
      gap: "PostHog currently lacks a visual inspector for project webhooks, forcing developers to debug blindly.",
      solve: "You can build a clean React payload viewer component that polls the webhook log API, renders JSON side-by-side, and includes a re-delivery action.",
      perfect: "Since you have built an open-source CLI utility for webhook inspection and are highly proficient in React and Webhooks, this project aligns perfectly with your credentials."
    };
  } else if (isStripe) {
    return {
      opportunity: "Create a local UI dashboard wrapper for the Stripe CLI that renders local webhook deliveries in a beautiful web log viewer.",
      gap: "Stripe CLI prints webhook logs directly to the stdout terminal, which is hard to read and parse during rapid development.",
      solve: "Build a simple local dev server in Node/Next.js that captures CLI stdout streams and pushes events to a React table via WebSockets.",
      perfect: "Your background in building custom analytics dashboards and API integrations makes you the perfect fit to build this developer experience enhancer."
    };
  } else if (isLinear) {
    return {
      opportunity: "Build a custom sprint velocity CSV exporter widget that integrates directly with Linear's project dashboard.",
      gap: "Linear doesn't provide a quick, 1-click custom CSV export for velocity metrics in the current sprint UI.",
      solve: "Create a browser extension or custom integration card that pulls current cycle analytics from Linear API and exports formatted spreadsheets.",
      perfect: "Matches your TypeScript and REST APIs experience. You already built visual reporting dashboards, making this a straightforward win."
    };
  } else {
    return {
      opportunity: "Design a visual timeline component that parses deployment events and builds a timeline view for build steps.",
      gap: "Vercel's build log screen is a raw text scroll, missing a visual timeline breakdown of which steps took the most time.",
      solve: "Develop a React log parser that groups lines by build phase (cloning, building, caching) and visualizes them as a clean Gantt-style chart.",
      perfect: "Perfect for your React, TypeScript, and Data Visualization skills. This is exactly the kind of frontend developer tool you excel at."
    };
  }
};

export const DashboardView: React.FC<DashboardViewProps> = ({ userProfile, onBackToLanding }) => {
  const [leftPaneOpen, setLeftPaneOpen] = useState(true);
  const [rightPaneOpen, setRightPaneOpen] = useState(true);
  
  // Dynamic states
  const [cardsList, setCardsList] = useState<OpportunityCardView[]>(MOCK_CARDS);
  const [searchHistory, setSearchHistory] = useState(['PostHog', 'Stripe', 'Linear', 'Vercel']);
  const [activeCompany, setActiveCompany] = useState<string | null>(null);

  // Middle Pane State
  const [linkInput, setLinkInput] = useState('');
  const [activePromptModal, setActivePromptModal] = useState<OpportunityCardView | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [resourceActiveTab, setResourceActiveTab] = useState<'resume' | 'portfolio' | 'raw'>('resume');
  
  // Agent Company Scouting states
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState<'fetching' | 'analyzing' | 'aligning' | 'clustering' | 'idle'>('idle');

  // Outreach Assembly states
  const [liveAppLink, setLiveAppLink] = useState('');
  const [loomLink, setLoomLink] = useState('');
  const [copiedOutreach, setCopiedOutreach] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'outreach' | 'account'>('dashboard');
  const [pitchText, setPitchText] = useState('');
  const [isEditingPitch, setIsEditingPitch] = useState(false);

  useEffect(() => {
    setLiveAppLink('');
    setLoomLink('');
    setCopiedOutreach(false);
    setViewMode('dashboard');
    setPitchText('');
    setIsEditingPitch(false);
  }, [activePromptModal]);

  useEffect(() => {
    if (activePromptModal) {
      setPitchText(generateOutreachText(activePromptModal, liveAppLink, loomLink));
    }
  }, [liveAppLink, loomLink, activePromptModal]);
  

  useEffect(() => {
    if (isParsing) {
      const interval = setInterval(() => {
        setParseProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsParsing(false);
            return 100;
          }
          return prev + Math.floor(Math.random() * 15 + 5);
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isParsing]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadedFile(e.dataTransfer.files[0]);
      setIsParsing(true);
      setParseProgress(0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
      setIsParsing(true);
      setParseProgress(0);
    }
  };

  const filteredCards = cardsList.filter(item => item.company.name === activeCompany);

  const getEstimateType = (flags: FixabilityFlags): string => {
    if (flags.has_public_repo && flags.has_public_api && flags.has_ui_surface) return 'weekend_hack';
    if (flags.has_public_repo || flags.has_public_api) return 'one_week_project';
    return 'high_effort_system';
  };

  const getFixabilityBadge = (flags: FixabilityFlags) => {
    const type = getEstimateType(flags);
    switch (type) {
      case 'weekend_hack': return <span className="badge badge-moss" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>Weekend Hack (~10h)</span>;
      case 'one_week_project': return <span className="badge badge-gold" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>1-Week Project (~28h)</span>;
      case 'high_effort_system': return <span className="badge badge-orange" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>System Refactor</span>;
      default: return null;
    }
  };

  const generatePromptText = (item: OpportunityCardView): string => {
    const title = item.gap_cluster.label;
    const evText = item.evidence_items[0]?.raw_text || 'No evidence cited.';
    const evUrl = item.evidence_items[0]?.source_url || 'https://github.com';
    const role = item.role_match?.job_posting.title || 'Full Stack Engineer';

    return `# Scaffold Specification: ${title} at ${item.company.name}
# Target Role: ${role}
# Non-Negotiable Principle: Scaffold & hand off ONLY. Do NOT complete the full application build.

## 1. Architectural Gap & Context
${item.why_matches_you}

## 2. Verified Engineering Telemetry Receipt
Source URL: ${evUrl}
Quote: "${evText}"

## 3. Scaffold Instructions for Assistant (Claude / Cursor / Copilot)
1. Initialize a clean TypeScript + React (or Node/Python) project structure with proper linters and type definitions.
2. Build the core data model and interfaces required to solve: "${title}".
3. Implement mock service adapters or API connection scaffolding for ${item.company.name}.
4. Provide a step-by-step TODO checklist in a README.md so the developer can complete the remaining business logic and UI polish themselves.`;
  };



  const handleAgentHandoff = (agent: 'chatgpt' | 'claude') => {
    if (!activePromptModal) return;
    const prompt = generatePromptText(activePromptModal);
    const url = agent === 'chatgpt' 
      ? `https://chatgpt.com/?q=${encodeURIComponent(prompt)}` 
      : `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(url, '_blank');
  };

  const handleExtractCompany = () => {
    if (!linkInput.trim()) return;

    let companyName = 'Supabase';
    try {
      const url = new URL(linkInput);
      const hostParts = url.hostname.split('.');
      const candidate = hostParts.length > 2 ? hostParts[1] : hostParts[0];
      if (candidate && candidate.toLowerCase() !== 'www') {
        companyName = candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    } catch (e) {
      const cleaned = linkInput.replace(/https?:\/\//, '').split('/')[0].split('.')[0];
      if (cleaned) {
        companyName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
    }

    setIsScanning(true);
    setScanStage('fetching');

    setTimeout(() => {
      setScanStage('analyzing');
      setTimeout(() => {
        setScanStage('aligning');
        setTimeout(() => {
          setScanStage('clustering');
          setTimeout(() => {
            setIsScanning(false);
            setScanStage('idle');
            setLinkInput('');
            
            if (!searchHistory.includes(companyName)) {
              setSearchHistory(prev => [companyName, ...prev]);
              const newCard = createMockOpportunityForCompany(companyName);
              setCardsList(prev => [newCard, ...prev]);
            }
            setActiveCompany(companyName);
          }, 1200);
        }, 1200);
      }, 1200);
    }, 1200);
  };

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      height: '100%',
      width: '100%',
      backgroundColor: 'var(--bg)',
      color: 'var(--ink)',
      overflow: 'hidden',
      minHeight: 0,
      fontFamily: 'var(--font-sans)'
    }}>
      
      {/* LEFT PANE - HISTORY */}
      <div style={{
        width: leftPaneOpen ? '260px' : '0px',
        borderRight: leftPaneOpen ? '1px solid var(--border)' : 'none',
        backgroundColor: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        minHeight: 0,
        flexShrink: 0
      }}>
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--paper-edge)', minWidth: '260px' }}>
          {onBackToLanding && (
            <button 
              onClick={onBackToLanding}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)' }}>
            <Terminal size={16} color="var(--accent-gold)" />
            <span>SideDoor Workspace</span>
          </div>
        </div>

        <div style={{ padding: '16px', flex: 1, overflowY: 'auto', minWidth: '260px' }}>
          <button 
            onClick={() => setActiveCompany('new')}
            style={{ 
              width: '100%',
              backgroundColor: activeCompany === 'new' ? 'var(--cream)' : 'transparent',
              border: '1px dashed var(--border)',
              color: 'var(--ink)',
              padding: '10px 14px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: '24px',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.2s',
            }}
          >
            <Plus size={16} color="var(--ink)" />
            <span>New Search</span>
          </button>

          <div className="font-mono" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Search History
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {searchHistory.map(company => (
              <button
                key={company}
                onClick={() => setActiveCompany(company)}
                className="dash-target-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: activeCompany === company ? 'var(--cream)' : 'transparent',
                  border: `1px solid ${activeCompany === company ? 'var(--accent-gold)' : 'transparent'}`,
                  color: activeCompany === company ? 'var(--ink)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: activeCompany === company ? 600 : 500,
                  fontSize: '0.9rem',
                }}
              >
                <Building2 size={14} color={activeCompany === company ? 'var(--accent-gold)' : 'inherit'} />
                <span>{company}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* User Account bottom bar */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--paper-edge)', minWidth: '260px', backgroundColor: 'var(--paper)' }}>
          <button 
            onClick={() => setViewMode('account')}
            className="dash-target-btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: viewMode === 'account' ? 'var(--cream)' : 'transparent',
              border: `1px solid ${viewMode === 'account' ? 'var(--accent-gold)' : 'transparent'}`,
              color: viewMode === 'account' ? 'var(--ink)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                AS
              </div>
              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Aditya Sharma</span>
            </div>
            <Settings size={14} color={viewMode === 'account' ? 'var(--ink)' : 'var(--text-dim)'} />
          </button>
        </div>
      </div>

      {viewMode === 'account' ? (
        // --- DEDICATED ACCOUNT PAGE ---
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg)', minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--paper)', gap: '16px', flexShrink: 0 }}>
            <button 
              onClick={() => setViewMode('dashboard')}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
            <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border)' }} />
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }} className="font-mono">User Settings</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)' }}>Account Profile</div>
            </div>
          </div>

          {/* Account Details Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Profile Card */}
              <div className="paper-card" style={{ padding: '32px', backgroundColor: 'var(--paper)', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--cream)', border: '2px solid var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: 'var(--ink)' }}>
                  AS
                </div>
                <div>
                  <h3 className="font-serif" style={{ margin: '0 0 4px 0', fontSize: '1.5rem', color: 'var(--ink)', fontWeight: 500 }}>Aditya Sharma</h3>
                  <p className="font-mono" style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-dim)' }}>aditya.sharma@gmail.com</p>
                  <span className="badge badge-moss" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>Developer Account Active</span>
                </div>
              </div>

              {/* Grid: Metrics & Resume Insights */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Usage Metrics */}
                <div className="paper-card" style={{ padding: '24px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <h4 className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', fontWeight: 700 }}>Scouting Activity</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Target Companies Scanned</span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--ink)' }}>{searchHistory.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Gaps Identified</span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--ink)' }}>{cardsList.length}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Active Resume Profiles</span>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--ink)' }}>{uploadedFile ? 1 : 0}</strong>
                    </div>
                  </div>
                </div>

                {/* Resume Insights */}
                <div className="paper-card" style={{ padding: '24px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <h4 className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', fontWeight: 700 }}>Parsed Credentials</h4>
                  {uploadedFile ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <FileText size={16} color="var(--accent-gold)" />
                        <span style={{ fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedFile.name}</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {userProfile?.parsed_skills.map(skill => (
                          <span key={skill} className="badge" style={{ backgroundColor: 'var(--paper)', border: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{skill}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      No resume uploaded yet. Go back and drag-and-drop your resume to align custom opportunities.
                    </div>
                  )}
                </div>

              </div>

              {/* Developer Configuration (API Keys settings) */}
              <div className="paper-card" style={{ padding: '28px', backgroundColor: 'var(--paper)', borderRadius: '14px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 700 }}>LLM API Configuration</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Provide your own OpenAI or Anthropic keys to customize scaffolding output models (fully secure and stored locally on your device).
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }} className="font-mono">OpenAI API Key</label>
                    <input 
                      type="password" 
                      placeholder="sk-..." 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.9rem', marginTop: '4px' }} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }} className="font-mono">Anthropic API Key</label>
                    <input 
                      type="password" 
                      placeholder="sk-ant-..." 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.9rem', marginTop: '4px' }} 
                    />
                  </div>
                  <button 
                    onClick={() => alert("API keys saved locally!")}
                    className="btn-primary" 
                    style={{ alignSelf: 'flex-start', padding: '10px 24px', fontSize: '0.9rem', marginTop: '8px' }}
                  >
                    Save API Credentials
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : viewMode === 'outreach' && activePromptModal ? (
        // --- DEDICATED OUTREACH WORKSPACE PAGE ---
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg)', minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--paper)', gap: '16px', flexShrink: 0 }}>
            <button 
              onClick={() => setViewMode('dashboard')}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)' }}
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
            <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border)' }} />
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }} className="font-mono">Outreach Package Builder</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)' }}>{activePromptModal.company.name} — {activePromptModal.gap_cluster.label}</div>
            </div>
          </div>

          {/* Outreach workspace grid */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', minHeight: 0, overflow: 'hidden' }}>
            
            {/* Left Workspace Pane: Edit and Preview Pitch */}
            <div style={{ padding: '32px', overflowY: 'auto', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="paper-card" style={{ padding: '24px', backgroundColor: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--ink)', fontWeight: 600 }}>Your Outreach Message</h4>
                
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Input your working application URL and Loom walkthrough demo below to auto-compile your pitch.
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }} className="font-mono">Live App URL</label>
                    <input 
                      type="text" 
                      placeholder="e.g. https://my-posthog-debugger.vercel.app"
                      value={liveAppLink} 
                      onChange={(e) => setLiveAppLink(e.target.value)} 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.9rem', marginTop: '4px' }} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600 }} className="font-mono">Loom Walkthrough URL</label>
                    <input 
                      type="text" 
                      placeholder="e.g. https://loom.com/share/..."
                      value={loomLink} 
                      onChange={(e) => setLoomLink(e.target.value)} 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--ink)', fontSize: '0.9rem', marginTop: '4px' }} 
                    />
                  </div>
                </div>

                <div style={{ position: 'relative', marginTop: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, display: 'block', marginBottom: '8px' }} className="font-mono">Compiled Pitch Template</label>
                  <div style={{ position: 'absolute', top: '24px', right: '12px', display: 'flex', gap: '8px', alignItems: 'center', zIndex: 10 }}>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(pitchText);
                        setCopiedOutreach(true);
                        setTimeout(() => setCopiedOutreach(false), 2000);
                      }}
                      style={{ background: 'rgba(239,231,205,0.1)', border: '1px solid rgba(239,231,205,0.2)', color: 'var(--cream)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      {copiedOutreach ? 'Copied!' : 'Copy Message'}
                    </button>
                    <button 
                      onClick={() => setIsEditingPitch(!isEditingPitch)}
                      style={{ 
                        background: isEditingPitch ? 'var(--accent-gold)' : 'rgba(239,231,205,0.1)', 
                        border: `1px solid ${isEditingPitch ? 'var(--accent-gold)' : 'rgba(239,231,205,0.2)'}`, 
                        color: isEditingPitch ? 'var(--ink)' : 'var(--cream)', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.75rem', 
                        cursor: 'pointer',
                        fontWeight: isEditingPitch ? 600 : 400
                      }}
                    >
                      {isEditingPitch ? 'Done ✅' : 'Edit ✏️'}
                    </button>
                  </div>
                  <textarea 
                    value={pitchText} 
                    onChange={(e) => setPitchText(e.target.value)}
                    readOnly={!isEditingPitch}
                    className="font-mono"
                    style={{ width: '100%', height: '240px', padding: '16px', paddingTop: '40px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#171a10', color: 'var(--cream)', fontSize: '0.85rem', lineHeight: 1.5, resize: 'vertical', outline: 'none', opacity: isEditingPitch ? 1 : 0.8, cursor: isEditingPitch ? 'text' : 'not-allowed' }}
                  />
                </div>
              </div>
            </div>

            {/* Right Workspace Pane: Apollo Guide & Contact Cards */}
            <div style={{ padding: '32px', overflowY: 'auto', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Apollo Enrichment banner */}
              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--cream)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span className="pulse-dot" style={{ marginTop: '6px' }}></span>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: 'var(--ink)', fontWeight: 700 }}>Get Direct Emails with Apollo.io</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Install the <strong>Apollo Chrome Extension</strong>, then click any LinkedIn profile card below. Reveal verified direct business emails instantly on their profile page.
                  </p>
                  <a 
                    href="https://www.apollo.io/" 
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ display: 'inline-block', marginTop: '10px', fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Get Apollo Extension ↗
                  </a>
                </div>
              </div>

              {/* Target Contacts list */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Top Target Contacts</h4>
                  <a 
                    href={`https://www.google.com/search?q=site:linkedin.com/in/+%22${activePromptModal.company.name}%22+%22Engineering+Manager%22+OR+%22Director%22`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Search More ↗
                  </a>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {getMockContacts(activePromptModal.company.name).map((contact, i) => (
                    <div key={i} className="paper-card" style={{ padding: '16px', backgroundColor: 'var(--paper)', borderRadius: '10px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)' }}>{contact.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{contact.role}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{contact.email}</span>
                          <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(152,118,26,0.1)', color: 'var(--accent-gold)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(152,118,26,0.2)', fontWeight: 600 }}>Enriched</span>
                        </div>
                      </div>
                      
                      <a 
                        href={contact.linkedin} 
                        target="_blank" 
                        rel="noreferrer"
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', borderRadius: '6px' }}
                      >
                        LinkedIn
                      </a>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : (
        <>
          {/* MIDDLE PANE - MAIN WORKSPACE */}
          <div className="bg-texture" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        minWidth: '400px',
        minHeight: 0
      }}>
        
        {/* Top Header Controls (Pane Toggles) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--paper)' }}>
          <button 
            onClick={() => setLeftPaneOpen(!leftPaneOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {leftPaneOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          
          <div className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={14} />
            <span>Targeting: <strong style={{ color: 'var(--ink)' }}>{activeCompany === 'new' ? 'New Company' : activeCompany}</strong></span>
          </div>

          <button 
            onClick={() => setRightPaneOpen(!rightPaneOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {rightPaneOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
        </div>

        {/* Workspace Content Scroll Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            
            {/* 1. Input Section */}
            <div style={{ marginBottom: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <h2 className="font-serif" style={{ fontSize: '1.4rem', fontWeight: 500, margin: 0, color: 'var(--ink)' }}>Analyze Target Company</h2>
              </div>
              <div className="paper-card" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '6px',
                borderRadius: '12px'
              }}>
                <div style={{ padding: '0 12px', color: 'var(--text-dim)' }}>
                  <LinkIcon size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Paste job posting or company careers URL..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="font-sans"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--ink)',
                    fontSize: '1rem'
                  }}
                />
                <button 
                  onClick={handleExtractCompany} 
                  className="btn-primary" 
                  style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '0.95rem' }}
                  disabled={isScanning}
                >
                  <span>{isScanning ? 'Scouting...' : 'Extract'}</span>
                  <Send size={14} />
                </button>
              </div>
            </div>

            {/* 2. Opportunity Cards Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {isScanning ? (
                <div className="paper-card font-sans" style={{ padding: '40px', backgroundColor: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', maxWidth: '600px', margin: '40px auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className="pulse-dot"></span>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--ink)', fontWeight: 600 }}>AI Scouting Agent Active...</h3>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: scanStage === 'fetching' ? 1 : 0.6 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: scanStage === 'fetching' ? 600 : 400 }}>1. Parsing career index & indexing repositories</span>
                      {scanStage === 'fetching' ? <span className="pulse-dot" style={{ backgroundColor: 'var(--accent-gold)' }}></span> : (scanStage !== 'idle' ? '✅' : '⏳')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: scanStage === 'analyzing' ? 1 : 0.6 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: scanStage === 'analyzing' ? 600 : 400 }}>2. Querying community telemetry & requests</span>
                      {scanStage === 'analyzing' ? <span className="pulse-dot" style={{ backgroundColor: 'var(--accent-gold)' }}></span> : (['aligning', 'clustering'].includes(scanStage) ? '✅' : '⏳')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: scanStage === 'aligning' ? 1 : 0.6 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: scanStage === 'aligning' ? 600 : 400 }}>3. Mapping tech stack & credential compatibility</span>
                      {scanStage === 'aligning' ? <span className="pulse-dot" style={{ backgroundColor: 'var(--accent-gold)' }}></span> : (scanStage === 'clustering' ? '✅' : '⏳')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: scanStage === 'clustering' ? 1 : 0.6 }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: scanStage === 'clustering' ? 600 : 400 }}>4. Synthesizing gap clusters & scaffolding spec prompts</span>
                      {scanStage === 'clustering' ? <span className="pulse-dot" style={{ backgroundColor: 'var(--accent-gold)' }}></span> : '⏳'}
                    </div>
                  </div>
                </div>
              ) : activeCompany === 'new' ? (
                <div style={{ 
                  padding: '60px 40px', 
                  textAlign: 'center', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '16px'
                }}>
                  <div style={{ 
                    padding: '16px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--cream)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                  }}>
                    <Search size={28} color="var(--text-dim)" />
                  </div>
                  
                  <div>
                    <h3 className="font-sans" style={{ fontSize: '1.2rem', color: 'var(--ink)', margin: '0 0 8px 0', fontWeight: 600 }}>
                      Start a new search
                    </h3>
                    <p className="font-sans" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.5 }}>
                      Paste a company's career page URL above to uncover engineering opportunities.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                    <div className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Generated Opportunity Cards
                    </div>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--paper-edge)', fontWeight: 600 }}>
                      {filteredCards.length}
                    </span>
                  </div>

                  {filteredCards.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                      No opportunities found for {activeCompany}. Try searching another company.
                    </div>
                  ) : (
                filteredCards.map(item => {
                  const ev = item.evidence_items[0];
                  const matchScorePct = (item.card.profile_match_score).toFixed(0);
                  
                  return (
                    <div key={item.card.id} className="paper-card dash-evidence-card" style={{ 
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--paper-edge)', backgroundColor: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <CompanyLogo name={item.company.name} size={28} />
                            <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--ink)' }}>{item.company.name}</span>
                          </div>
                          {getFixabilityBadge(item.fixability_flags)}
                        </div>
                        <div style={{ 
                          textAlign: 'right', 
                          background: 'rgba(152, 118, 26, 0.1)', 
                          padding: '6px 12px', 
                          borderRadius: '8px',
                          border: '1px solid rgba(152, 118, 26, 0.2)'
                        }} className="font-mono">
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Match Score</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{matchScorePct}%</div>
                        </div>
                      </div>

                      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.3rem', margin: '0 0 8px 0', color: 'var(--ink)' }}>{item.gap_cluster.label}</h3>
                          <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{item.why_matches_you}</p>
                        </div>

                        {ev && (
                          <div style={{ backgroundColor: 'var(--surface)', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--paper-edge)' }}>
                            <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--ink)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                              <ShieldAlert size={14} color="var(--accent-gold)" />
                              <span>Verified Receipt</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '10px', borderLeft: '2px solid var(--accent-gold)', paddingLeft: '10px' }}>
                              "{ev.raw_text}"
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="font-mono">
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{ev.source_type.toUpperCase()}</span>
                              <a href={ev.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}>
                                <span>View Source</span>
                                <ArrowUpRight size={13} />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ padding: '16px 24px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--paper-edge)' }}>
                        <button 
                          onClick={() => setActivePromptModal(item)}
                          className="btn-primary"
                          style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                        >
                          <Terminal size={16} />
                          <span>Scaffold & Hand Off MVP</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* RIGHT PANE - RESOURCES OR PROMPT HANDOFF */}
      <div style={{
        width: (rightPaneOpen || activePromptModal) ? (activePromptModal ? '480px' : '320px') : '0px',
        borderLeft: (rightPaneOpen || activePromptModal) ? '1px solid var(--border)' : 'none',
        backgroundColor: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        minHeight: 0,
        flexShrink: 0
      }}>
        {activePromptModal ? (
          // --- OPPORTUNITY DETAIL VIEW (Slide-in Replacement) ---
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: '480px' }}>
            <div style={{ padding: '16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--paper-edge)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button 
                  onClick={() => setActivePromptModal(null)}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ArrowLeft size={14} color="var(--ink)" />
                </button>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--ink)' }}>
                  Opportunity Detail
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <button 
                  onClick={() => handleAgentHandoff('chatgpt')}
                  className="font-sans"
                  style={{ 
                    backgroundColor: '#10A37F', color: 'white', border: '1px solid rgba(255,255,255,0.1)', 
                    padding: '6px 10px', borderRadius: '24px', fontSize: '0.78rem', fontWeight: 600, 
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', 
                    boxShadow: '0 4px 12px rgba(16, 163, 127, 0.25)', transition: 'all 0.2s ease',
                    letterSpacing: '0.01em', whiteSpace: 'nowrap'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <Send size={11} />
                  <span>Ask ChatGPT ↗</span>
                </button>
                <button 
                  onClick={() => handleAgentHandoff('claude')}
                  className="font-sans"
                  style={{ 
                    backgroundColor: '#D97757', color: 'white', border: '1px solid rgba(255,255,255,0.1)', 
                    padding: '6px 10px', borderRadius: '24px', fontSize: '0.78rem', fontWeight: 600, 
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', 
                    boxShadow: '0 4px 12px rgba(217, 119, 87, 0.25)', transition: 'all 0.2s ease',
                    letterSpacing: '0.01em', whiteSpace: 'nowrap'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <Terminal size={11} />
                  <span>Ask Claude ↗</span>
                </button>
              </div>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>The Opportunity</h4>
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>
                  {getOpportunityDetails(activePromptModal).opportunity}
                </div>
              </div>

              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>The Gap Identified</h4>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {getOpportunityDetails(activePromptModal).gap}
                </div>
              </div>

              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>How to Solve It</h4>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {getOpportunityDetails(activePromptModal).solve}
                </div>
              </div>

              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'rgba(152, 118, 26, 0.06)', borderRadius: '12px', border: '1px solid rgba(152, 118, 26, 0.2)' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 700 }}>Why You're Perfect</h4>
                <div style={{ fontSize: '0.95rem', color: 'var(--ink)', lineHeight: 1.5, fontWeight: 500 }}>
                  {getOpportunityDetails(activePromptModal).perfect}
                </div>
              </div>
              
              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>The Evidence Sources</h4>
                {activePromptModal.evidence_items.map((ev, i) => (
                  <div key={i} style={{ borderLeft: '3px solid var(--accent-gold)', paddingLeft: '12px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '8px' }}>"{ev.raw_text}"</div>
                    <a href={ev.source_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: 600 }}>Source ({ev.source_type}) ↗</a>
                  </div>
                ))}
              </div>

              <div className="paper-card" style={{ padding: '20px', backgroundColor: 'var(--cream)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 700 }}>About This Opportunity Spec</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  This spec was automatically compiled from public community issues and user feedback to help you build exactly what they need. It validates that the gap exists and is real, giving you a strong hook to stand out.
                </p>
                <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }} />
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                  💡 Use the <strong>Ask ChatGPT</strong> or <strong>Ask Claude</strong> buttons above. They will launch the AI assistant with a pre-loaded engineering prompt so you can scaffold the MVP immediately.
                </p>
              </div>

              <div style={{ padding: '24px 20px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--paper-edge)' }}>
                <button 
                  onClick={() => setViewMode('outreach')}
                  className="btn-primary" 
                  style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                >
                  <Send size={16} />
                  <span>Find Outreach Contacts</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          // --- STANDARD RESOURCES VIEW ---
          <>
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--paper-edge)', minWidth: '320px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)' }}>
                Context Resources
              </div>
            </div>


        <div style={{ padding: '20px 16px', flex: 1, overflowY: 'auto', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Custom Tabs */}
          <div style={{ display: 'flex', backgroundColor: 'var(--surface)', padding: '6px', borderRadius: '10px', border: '1px solid var(--paper-edge)', gap: '4px' }}>
            <button 
              onClick={() => setResourceActiveTab('resume')}
              className="dash-tab-btn font-mono"
              style={{ flex: 1, padding: '8px 0', border: '1px solid transparent', background: resourceActiveTab === 'resume' ? 'var(--cream)' : 'transparent', color: resourceActiveTab === 'resume' ? 'var(--ink)' : 'var(--text-dim)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            >RESUME</button>
            <button 
              onClick={() => setResourceActiveTab('portfolio')}
              className="dash-tab-btn font-mono"
              style={{ flex: 1, padding: '8px 0', border: '1px solid transparent', background: resourceActiveTab === 'portfolio' ? 'var(--cream)' : 'transparent', color: resourceActiveTab === 'portfolio' ? 'var(--ink)' : 'var(--text-dim)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            >PORTFOLIO</button>
            <button 
              onClick={() => setResourceActiveTab('raw')}
              className="dash-tab-btn font-mono"
              style={{ flex: 1, padding: '8px 0', border: '1px solid transparent', background: resourceActiveTab === 'raw' ? 'var(--cream)' : 'transparent', color: resourceActiveTab === 'raw' ? 'var(--ink)' : 'var(--text-dim)', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
            >RAW TEXT</button>
          </div>

          {/* Stylish Cards based on active tab */}
          <div style={{ minHeight: '200px' }}>
            {resourceActiveTab === 'resume' && (
              uploadedFile ? (
                <div className="dash-widget-card" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={20} color="var(--accent-gold)" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {uploadedFile.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: isParsing ? 'var(--text-muted)' : 'var(--accent-moss)', fontWeight: 500 }}>
                          {isParsing ? 'Parsing document...' : 'Aligned to opportunities!'}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setUploadedFile(null)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '4px' }}
                      title="Remove file"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  {isParsing && (
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-light)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${parseProgress}%`, backgroundColor: 'var(--accent-gold)', transition: 'width 0.2s ease' }} />
                    </div>
                  )}
                </div>
              ) : (
                <label 
                  className="dash-widget-card" 
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  style={{ 
                    backgroundColor: dragActive ? 'var(--cream)' : 'var(--surface)', 
                    border: `2px dashed ${dragActive ? 'var(--accent-gold)' : 'var(--border)'}`, 
                    borderRadius: '16px', 
                    padding: '32px 24px', 
                    textAlign: 'center', 
                    display: 'block', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s' 
                  }}
                >
                  <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleChange} />
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: dragActive ? 'var(--bg)' : 'rgba(152, 118, 26, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', transition: 'all 0.2s' }}>
                    <Upload size={24} color="var(--accent-gold)" />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                    {dragActive ? 'Drop file here' : 'Upload Resume'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>PDF, DOC, DOCX up to 5MB</div>
                </label>
              )
            )}

            {resourceActiveTab === 'portfolio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 600 }}>Portfolio URL</label>
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px' }}>
                  <LinkIcon size={16} color="var(--text-dim)" style={{ margin: '0 8px' }} />
                  <input type="text" placeholder="https://" style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--ink)', fontSize: '0.95rem', outline: 'none' }} />
                </div>
                <button className="btn-secondary" style={{ width: '100%', marginTop: '4px' }}>
                  Save Link
                </button>
              </div>
            )}

            {resourceActiveTab === 'raw' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 600 }}>Paste Raw Profile Text</label>
                <textarea 
                  placeholder="Paste your experience, skills, or LinkedIn dump here..."
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', color: 'var(--ink)', fontSize: '0.95rem', outline: 'none', resize: 'vertical', minHeight: '140px', fontFamily: 'inherit' }}
                />
                <button className="btn-secondary" style={{ width: '100%', marginTop: '4px' }}>
                  Analyze Text
                </button>
              </div>
            )}
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--paper-edge)', margin: '4px 0' }} />

          {/* Active Profile Status */}
          <div>
            <div className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              Active Profile State
            </div>
            {userProfile ? (
              <div className="paper-card" style={{ backgroundColor: 'rgba(152, 118, 26, 0.08)', border: '1px solid rgba(152, 118, 26, 0.2)', padding: '16px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span className="pulse-dot"></span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)' }}>Profile Loaded</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {userProfile.parsed_skills.length} core skills extracted.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                  {userProfile.parsed_skills.slice(0, 5).map(skill => (
                    <span key={skill} className="badge dash-skill-badge" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}>{skill}</span>
                  ))}
                  {userProfile.parsed_skills.length > 5 && (
                    <span className="badge" style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-dim)' }}>+{userProfile.parsed_skills.length - 5}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="paper-card" style={{ backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle size={16} color="var(--text-dim)" style={{ marginTop: '2px' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>No active profile data. Add resources above to enable matching.</span>
              </div>
            )}
          </div>

          </div>
        </>
        )}
      </div>
    </>
    )}
  </div>
  );
};
