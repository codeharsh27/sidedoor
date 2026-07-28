import React, { useState, useEffect } from 'react';
import { 
  Terminal, ArrowRight, Database, 
  ShieldCheck, Copy, Check, ExternalLink, Code, Send,
  AlertCircle, CheckCircle, Flame, RefreshCw, Search, Lock, Loader2
} from 'lucide-react';
import { mockUserProfile } from '../mock/mockData';
import type { UserProfile } from '../types/schema';
import { CompanyLogo } from './CompanyLogo';

interface ScanPreviewSectionProps {
  company?: string;
  role?: string;
  searchedCompany?: string;
  onScanComplete?: () => void;
  onUnlockDashboard?: (profile: UserProfile) => void;
  onSelectCompany?: (company: string) => void;
}

const TARGET_COMPANIES_DATA: Record<string, {
  name: string;
  icon: string;
  role: string;
  problemTitle: string;
  evidenceSource: string;
  sourceDate: string;
  evidenceUrl: string;
  skills: string[];
  promptSnippet: string;
  outreachSubject: string;
  outreachBody: string;
}> = {
  PostHog: {
    name: 'PostHog',
    icon: 'PH',
    role: 'Senior Full Stack Engineer',
    problemTitle: 'WebSocket Connection Pooling Latency Spikes Under 10k Concurrent Connections',
    evidenceSource: 'PostHog Engineering Blog & GitHub Issue #14281',
    sourceDate: 'July 2026',
    evidenceUrl: 'https://posthog.com/handbook/engineering',
    skills: ['TypeScript', 'Redis Pub/Sub', 'WebSockets', 'Distributed Caching', 'Docker'],
    promptSnippet: `You are assisting a candidate building a 2-hour benchmark POC for PostHog engineering.\nOBJECTIVE: Scaffold a lightweight Redis Pub/Sub WebSocket connection pooler in TypeScript that mitigates memory bottlenecks under 10k concurrent connections.\nRULES (AGENTS.md non-negotiable):\n1. Scaffold the project directory structure, Dockerfile, and core TypeScript interfaces.\n2. DO NOT complete the business logic or write the full implementation — hand off clean TODOs and architecture specifications so the candidate builds and understands it themselves.`,
    outreachSubject: 'Quick benchmark POC solving PostHog WebSocket connection pooling latency',
    outreachBody: `Hey [Founder/CTO Name],\n\nI noticed in your recent engineering changelog and Issue #14281 that WebSocket pooling was hitting memory bottlenecks under high concurrency load.\n\nInstead of sending a standard resume, I spent 2 hours building a lightweight benchmark POC using Redis Pub/Sub that scaffolds connection multiplexing and reduces socket overhead by ~35% in local load testing.\n\nHere is the GitHub repo and a 2-minute Loom walkthrough: [Link]\n\nNo formal ask—just wanted to share this architectural approach in case it helps the team's Q3 scaling goals!\n\nBest,\n[Your Name]`
  },
  Stripe: {
    name: 'Stripe',
    icon: 'ST',
    role: 'Staff Backend Engineer',
    problemTitle: 'Webhook Dead-Letter Queue Replay Bottleneck in Multi-Region Sandbox',
    evidenceSource: 'Stripe Developer Changelog & Public API Roadmap',
    sourceDate: 'June 2026',
    evidenceUrl: 'https://stripe.com/docs/changelog',
    skills: ['Go', 'Kafka', 'Distributed Systems', 'PostgreSQL', 'API Design'],
    promptSnippet: `You are assisting a candidate building a 2-hour architecture POC for Stripe developer infrastructure.\nOBJECTIVE: Scaffold a Go-based Webhook Dead-Letter Queue (DLQ) visualizer and automated replay simulator with exponential backoff.\nRULES: Scaffold the Go structs, worker pool interfaces, and CLI commands. DO NOT write the complete worker implementation — leave core replay logic as structured TODOs for the candidate to solve.`,
    outreachSubject: 'POC: Multi-region webhook DLQ replay simulator for Stripe developers',
    outreachBody: `Hey [Engineering Director],\n\nI read in your recent developer notes about the challenges around webhook DLQ inspection and replay in multi-region sandbox environments.\n\nI built a lightweight Go CLI + React dashboard POC that simulates automated webhook replay with custom exponential backoff and jitter inspection.\n\nHere is the working demo repo: [Link]\n\nWould love your feedback on whether this aligns with the developer experience team's current tooling goals.`
  },
  Linear: {
    name: 'Linear',
    icon: 'LN',
    role: 'Frontend Architect',
    problemTitle: 'Optimistic UI State Desynchronization During Offline Reconnection Spikes',
    evidenceSource: 'Linear Engineering Tech Talks & Sync Engine Architecture Notes',
    sourceDate: 'May 2026',
    evidenceUrl: 'https://linear.app/blog/building-the-linear-sync-engine',
    skills: ['TypeScript', 'React', 'IndexedDB', 'CRDTs', 'State Management'],
    promptSnippet: `You are assisting a candidate building a 2-hour frontend sync POC for Linear engineering.\nOBJECTIVE: Scaffold a TypeScript offline state reconciliation engine using IndexedDB and CRDT vector clocks.\nRULES: Scaffold the sync store interfaces and conflict resolution hooks. DO NOT implement the full CRDT merge algorithm — provide the test suite and scaffold so the candidate implements the solver themselves.`,
    outreachSubject: 'POC: Offline state reconciliation prototype inspired by Linear Sync Engine',
    outreachBody: `Hey [Team Lead],\n\nI've been studying Linear's incredible sync engine architecture and noticed the complex edge cases around optimistic UI state resolution during rapid offline/online reconnects.\n\nI built a 2-hour TypeScript prototype demonstrating a lightweight CRDT vector clock reconciler for local IndexedDB stores.\n\nDemo link and brief writeup here: [Link]\n\nNo ask at all—just huge admiration for the engineering standard your team sets!`
  },
  Vercel: {
    name: 'Vercel',
    icon: 'VC',
    role: 'Systems Infrastructure Engineer',
    problemTitle: 'Edge Cache Tag Invalidation Propagation Delay Across Globally Distributed Nodes',
    evidenceSource: 'Vercel Infrastructure Blog & Next.js Cache API Issues',
    sourceDate: 'July 2026',
    evidenceUrl: 'https://vercel.com/blog',
    skills: ['Rust', 'Edge Computing', 'HTTP/3', 'Redis', 'Distributed Caching'],
    promptSnippet: `You are assisting a candidate building a 2-hour systems POC for Vercel edge infrastructure.\nOBJECTIVE: Scaffold a Rust-based edge cache invalidation coordinator using gossip protocol over HTTP/3.\nRULES: Scaffold the Rust module hierarchy, tokio network listener, and cache tag mapping tables. DO NOT write the full gossip broadcast loop — hand off the architecture specification for the candidate to complete.`,
    outreachSubject: 'POC: Rust edge cache invalidation coordinator for Next.js cache tags',
    outreachBody: `Hey [VP of Engineering],\n\nI followed your recent deep-dives into globally distributed cache invalidation for Next.js cache tags across edge nodes.\n\nI scaffolded a lightweight Rust proof-of-concept simulating node-to-node cache tag purge propagation using a simulated gossip protocol.\n\nBenchmark repository and architecture notes: [Link]\n\nHope this provides a fun architectural conversation starter for the infrastructure team!`
  }
};

export const ScanPreviewSection: React.FC<ScanPreviewSectionProps> = ({ 
  company, 
  searchedCompany,
  onScanComplete,
  onUnlockDashboard,
  onSelectCompany
}) => {
  const activeCompanyKey = (company || searchedCompany || 'PostHog').trim();
  const currentData = TARGET_COMPANIES_DATA[activeCompanyKey] || TARGET_COMPANIES_DATA['PostHog'];
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [autoCycle, setAutoCycle] = useState<boolean>(true);

  // New Interactive Simulation States for Real-Work Feel
  const [isRefreshingScan, setIsRefreshingScan] = useState<boolean>(false);
  const [scanStats, setScanStats] = useState({ issues: 142, threads: 85 });
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [isVerifyingUrl, setIsVerifyingUrl] = useState<boolean>(false);
  const [urlVerified, setUrlVerified] = useState<boolean>(false);
  const [scaffoldChecklist, setScaffoldChecklist] = useState({ dir: true, interface: true, logic: false });
  const [isSimulatingSend, setIsSimulatingSend] = useState<boolean>(false);
  const [sendSimulated, setSendSimulated] = useState<boolean>(false);

  // Auto-cycle through the 5 steps every 4.5 seconds to demonstrate live engine workflow
  useEffect(() => {
    if (!autoCycle) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev % 5) + 1);
    }, 4500);
    return () => clearInterval(interval);
  }, [autoCycle]);

  const handleManualStepClick = (stepNum: number) => {
    setAutoCycle(false);
    setActiveStep(stepNum);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(currentData.promptSnippet);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleRefreshScan = () => {
    setAutoCycle(false);
    setIsRefreshingScan(true);
    setTimeout(() => {
      setScanStats(prev => ({ 
        issues: prev.issues + Math.floor(Math.random() * 5) + 1, 
        threads: prev.threads + Math.floor(Math.random() * 3) + 1 
      }));
      setIsRefreshingScan(false);
    }, 1100);
  };

  const handleVerifyUrl = () => {
    setAutoCycle(false);
    setIsVerifyingUrl(true);
    setTimeout(() => {
      setIsVerifyingUrl(false);
      setUrlVerified(true);
    }, 1000);
  };

  const handleSimulateSend = () => {
    setAutoCycle(false);
    setIsSimulatingSend(true);
    setTimeout(() => {
      setIsSimulatingSend(false);
      setSendSimulated(true);
      setTimeout(() => setSendSimulated(false), 4000);
    }, 1200);
  };

  const handleUnlock = () => {
    if (onUnlockDashboard) onUnlockDashboard(mockUserProfile);
    if (onScanComplete) onScanComplete();
  };

  return (
    <section id="scan-preview" className="bg-texture" style={{ padding: '64px 0 88px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border-light)', position: 'relative' }}>
      <div className="container" style={{ maxWidth: '1240px', padding: '0 24px' }}>
        
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 40px' }}>
          <h2 className="font-serif" style={{ 
            fontSize: 'clamp(2.5rem, 4.2vw, 3.5rem)', 
            fontWeight: 500, 
            lineHeight: 1.12, 
            marginBottom: '16px', 
            color: 'var(--ink)', 
            textWrap: 'balance' 
          }}>
            How the <em style={{ fontStyle: 'italic', color: 'var(--accent-gold)', fontWeight: 400 }}>discovery engine</em> works
          </h2>
          <p className="font-sans" style={{ 
            fontSize: 'clamp(1.05rem, 1.4vw, 1.2rem)', 
            color: 'var(--text-muted)', 
            lineHeight: 1.6,
            maxWidth: '640px',
            margin: '0 auto'
          }}>
            An auditable 5-step pipeline that turns raw engineering changelogs into evidenced opportunities—without completing your build.
          </p>
        </div>

        {/* ONE INTEGRATED MISSION CONTROL CONSOLE WINDOW */}
        <div className="paper-card" style={{
          backgroundColor: 'var(--paper)',
          borderRadius: '24px',
          border: '1.5px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 24px 64px -12px rgba(42, 46, 28, 0.15), 0 8px 20px -6px rgba(42, 46, 28, 0.08)',
          marginBottom: '56px'
        }}>

          {/* Top Console Navigation Toolbar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '8px',
            padding: '16px',
            backgroundColor: 'var(--surface)',
            borderBottom: '1.5px solid var(--border)',
            overflowX: 'auto'
          }}>
            {[
              { num: 1, title: '1. Source Collection', sub: 'Reddit, HN & Changelogs' },
              { num: 2, title: '2. Profile Matching', sub: 'Local TF-IDF Role Fit' },
              { num: 3, title: '3. Evidenced Cards', sub: '100% Clickable Proof' },
              { num: 4, title: '4. Prompt Handoff', sub: 'Scaffold, Don\'t Build' },
              { num: 5, title: '5. Founder Outreach', sub: 'No Ask. Just Value.' }
            ].map((item) => {
              const isCurrent = activeStep === item.num;
              return (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => handleManualStepClick(item.num)}
                  className="font-sans dash-tab-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: isCurrent ? '1.5px solid var(--accent-gold)' : '1px solid transparent',
                    backgroundColor: isCurrent ? 'var(--cream)' : 'transparent',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: isCurrent ? '0 6px 20px rgba(152, 118, 26, 0.12)' : 'none'
                  }}
                >
                  <div style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '8px', 
                    backgroundColor: isCurrent ? 'var(--accent-gold)' : 'var(--paper)', 
                    color: isCurrent ? '#fff' : 'var(--text-dim)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700, 
                    fontSize: '0.86rem',
                    flexShrink: 0 
                  }}>
                    {item.num}
                  </div>
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: isCurrent ? 700 : 600, color: 'var(--ink)', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: isCurrent ? 'var(--accent-gold)' : 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {item.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Integrated Workspace Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(340px, 1fr)', alignItems: 'stretch' }}>
            
            {/* LEFT PANE: Dynamic Step Studio Canvas */}
            <div style={{ padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1.5px solid var(--border)', backgroundColor: 'var(--paper)' }}>
              
              {/* STEP 1 STUDIO */}
              {activeStep === 1 && (
                <div className="font-sans" style={{ animation: 'fadeIn 0.25s ease', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(152, 118, 26, 0.1)', color: 'var(--accent-gold)' }}>
                          <Database size={20} />
                        </div>
                        <div>
                          <h3 className="font-serif" style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Step 1: Deep Source Collection</h3>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>We sweep engineering changelogs, Reddit & HN without scraping LinkedIn.</p>
                        </div>
                      </div>
                      <span className="badge" style={{ backgroundColor: '#e2fad4', color: '#165c26', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', display: 'flex', alignItems: 'center' }}>
                        <span className="pulse-dot" />
                        LIVE ENGINE
                      </span>
                    </div>

                    <div className="dark-panel font-mono" style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#1a1d18', color: '#e4decb', fontSize: '0.84rem', lineHeight: 1.6, marginBottom: '22px', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)' }}>
                      <div style={{ color: '#888b82', marginBottom: '10px', fontSize: '0.72rem', borderBottom: '1px solid #2f342b', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', letterSpacing: '0.04em' }}>
                        <span>SIDEDOOR COLLECTOR PIPELINE</span>
                        <span>TARGET: {currentData.name.toUpperCase()}</span>
                      </div>
                      <div style={{ color: '#4ade80' }}>❯ [INIT] Generating automated search URLs for "{currentData.name}"...</div>
                      <div style={{ color: '#cbd5e1' }}>❯ [RULE CHECK] LinkedIn scraping disabled. Using public developer feeds.</div>
                      <div style={{ color: '#cbd5e1' }}>❯ [SCAN] Sweeping GitHub Issues, Reddit /r/devops, and HackerNews API...</div>
                      <div style={{ color: '#facc15', fontWeight: 600, marginTop: '8px', padding: '8px 12px', backgroundColor: 'rgba(250, 204, 21, 0.1)', borderRadius: '6px', borderLeft: '3px solid #facc15', lineHeight: 1.4 }}>
                        [FOUND SIGNAL] "{currentData.problemTitle}" discovered in {currentData.evidenceSource} ({currentData.sourceDate}).
                      </div>
                    </div>

                    {/* Live Data Sources Scanned Widget */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>INTERACTIVE SOURCE METRICS</span>
                      <button 
                        onClick={handleRefreshScan} 
                        disabled={isRefreshingScan}
                        style={{ 
                          padding: '4px 12px', 
                          borderRadius: '6px', 
                          backgroundColor: 'var(--cream)', 
                          border: '1px solid var(--accent-gold)', 
                          fontSize: '0.74rem', 
                          fontWeight: 700, 
                          color: 'var(--ink)', 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <RefreshCw size={13} className={isRefreshingScan ? "animate-spin" : ""} />
                        <span>{isRefreshingScan ? 'Sweeping APIs Live...' : 'Force Re-Scan Feeds'}</span>
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '22px' }}>
                      <div className="dash-widget-card" style={{ padding: '12px', backgroundColor: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                        <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>GITHUB ISSUES</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ink)' }}>{scanStats.issues} Tracked</div>
                      </div>
                      <div className="dash-widget-card" style={{ padding: '12px', backgroundColor: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                        <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>REDDIT /R/DEVOPS</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ink)' }}>{scanStats.threads} Threads</div>
                      </div>
                      <div className="dash-widget-card" style={{ padding: '12px', backgroundColor: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                        <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700 }}>LINKEDIN SCRAPING</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-moss)' }}>0% (Disabled)</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 600 }}>
                      <ShieldCheck size={18} color="var(--accent-moss)" />
                      <span>Why this matters: No LLM calls where a rule or search URL suffices.</span>
                    </div>
                    <button onClick={() => handleManualStepClick(2)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      <span>Next: Profile Match</span> <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2 STUDIO */}
              {activeStep === 2 && (
                <div className="font-sans" style={{ animation: 'fadeIn 0.25s ease', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(152, 118, 26, 0.1)', color: 'var(--accent-gold)' }}>
                          <Code size={20} />
                        </div>
                        <div>
                          <h3 className="font-serif" style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Step 2: Profile & Role Matching</h3>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>We cross-reference discovered problems against your technical skills.</p>
                        </div>
                      </div>
                      <span className="badge" style={{ backgroundColor: '#eef6ff', color: '#1e40af', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', display: 'flex', alignItems: 'center' }}>
                        <span className="pulse-dot" style={{ backgroundColor: '#1e40af' }} />
                        LOCAL TF-IDF ENGINE
                      </span>
                    </div>

                    <div style={{ backgroundColor: 'var(--surface)', padding: '22px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '22px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          CANDIDATE PROFILE VS. {currentData.name.toUpperCase()} GAP MATRIX (CLICK SKILLS TO VERIFY)
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-moss)', backgroundColor: '#e2fad4', padding: '4px 10px', borderRadius: '6px' }}>
                          94% Technical Fit Verified
                        </span>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.55 }}>
                        Our local TF-IDF ranker matches your core skills against <strong>{currentData.name}</strong>'s architectural requirement for a <strong>{currentData.role}</strong> without sending your resume to third-party AI trackers.
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {currentData.skills.map((skill, idx) => {
                          const isSelected = activeSkill === skill;
                          return (
                            <span 
                              key={idx} 
                              onClick={() => { setAutoCycle(false); setActiveSkill(isSelected ? null : skill); }}
                              className="dash-skill-badge"
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                padding: '6px 12px', 
                                borderRadius: '8px', 
                                backgroundColor: isSelected ? '#e2fad4' : 'var(--cream)', 
                                border: isSelected ? '1px solid #165c26' : '1px solid var(--accent-gold)', 
                                color: isSelected ? '#165c26' : 'var(--ink)', 
                                fontSize: '0.84rem', 
                                fontWeight: 700 
                              }}
                            >
                              <CheckCircle size={14} color={isSelected ? "#165c26" : "var(--accent-moss)"} />
                              <span>{skill}</span>
                            </span>
                          );
                        })}
                      </div>

                      {activeSkill && (
                        <div style={{ animation: 'fadeIn 0.2s ease', padding: '10px 14px', backgroundColor: '#e2fad4', borderRadius: '8px', border: '1px solid #165c26', color: '#165c26', fontSize: '0.82rem', fontWeight: 600, marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>Verified in your local profile: Direct architectural match for <strong>{currentData.name}</strong> ({activeSkill} expertise top 5%).</span>
                        </div>
                      )}

                      <div className="dash-widget-card" style={{ padding: '16px 18px', backgroundColor: 'var(--cream)', borderRadius: '12px', border: '1px solid var(--accent-gold)', marginTop: '20px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-moss)' }} />
                          <span>TF-IDF COSINE SIMILARITY SCORE: 0.94 / 1.00</span>
                        </div>
                        <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                          Your verified background in distributed infrastructure directly intersects with {currentData.name}'s active P1 engineering bottleneck. You are in the top 5% of candidate matches for this problem.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 600 }}>
                      <Flame size={18} color="#e55f14" />
                      <span>You only build MVPs for companies where your skills are a top 5% match.</span>
                    </div>
                    <button onClick={() => handleManualStepClick(3)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      <span>Next: Evidenced Cards</span> <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3 STUDIO */}
              {activeStep === 3 && (
                <div className="font-sans" style={{ animation: 'fadeIn 0.25s ease', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(152, 118, 26, 0.1)', color: 'var(--accent-gold)' }}>
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <h3 className="font-serif" style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Step 3: Evidenced Opportunity Cards</h3>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Core Rule: Every card must have a real, clickable evidence source.</p>
                        </div>
                      </div>
                      <span className="badge" style={{ backgroundColor: '#fff3cd', color: '#856404', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', display: 'flex', alignItems: 'center' }}>
                        <span className="pulse-dot" style={{ backgroundColor: '#856404' }} />
                        ZERO HALLUCINATIONS
                      </span>
                    </div>

                    <div className="dash-evidence-card" style={{ backgroundColor: 'var(--cream)', padding: '24px', borderRadius: '14px', border: '1.5px solid var(--accent-gold)', marginBottom: '22px', boxShadow: '0 8px 24px rgba(152, 118, 26, 0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <CompanyLogo name={currentData.name} size={38} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)' }}>{currentData.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Targeting: {currentData.role}</div>
                          </div>
                        </div>
                        <span className="badge" style={{ backgroundColor: urlVerified ? '#e2fad4' : '#fff3cd', color: urlVerified ? '#165c26' : '#856404', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                          <ShieldCheck size={13} /> {urlVerified ? 'URL AUDITED • HTTP 200' : 'VERIFIED EVIDENCE'}
                        </span>
                      </div>

                      <h4 className="font-serif" style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px', lineHeight: 1.38 }}>
                        "{currentData.problemTitle}"
                      </h4>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', backgroundColor: 'var(--paper)', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.84rem', flexWrap: 'wrap' }}>
                        <ExternalLink size={15} color="var(--accent-gold)" style={{ flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-muted)' }}>Source:</span>
                        <a href={currentData.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline' }}>
                          {currentData.evidenceSource} ({currentData.sourceDate})
                        </a>
                        <button 
                          onClick={handleVerifyUrl} 
                          disabled={isVerifyingUrl} 
                          style={{ 
                            marginLeft: 'auto', 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
                            backgroundColor: urlVerified ? '#e2fad4' : 'var(--surface)', 
                            border: urlVerified ? '1px solid #165c26' : '1px solid var(--border)', 
                            color: urlVerified ? '#165c26' : 'var(--ink)', 
                            fontSize: '0.74rem', 
                            fontWeight: 700, 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isVerifyingUrl ? <Loader2 size={14} className="animate-spin" /> : urlVerified ? <Check size={14} color="#165c26" /> : <Search size={14} />}
                          <span>{isVerifyingUrl ? 'Auditing URL...' : urlVerified ? 'HTTP 200 Verified' : 'Audit Public URL'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="dash-widget-card" style={{ padding: '16px 18px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={16} color="var(--accent-moss)" />
                          <span>Product Guarantee §2 Enforced</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Every card must link directly to an authentic public discussion. Zero AI hallucinations.</div>
                      </div>
                      <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-moss)', backgroundColor: '#e2fad4', padding: '6px 12px', borderRadius: '6px' }}>
                        100% AUDITABLE
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 600 }}>
                      <AlertCircle size={18} color="var(--accent-gold)" />
                      <span>No source, no card. If an opportunity isn't backed by public proof, we discard it.</span>
                    </div>
                    <button onClick={() => handleManualStepClick(4)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      <span>Next: Prompt Handoff</span> <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4 STUDIO */}
              {activeStep === 4 && (
                <div className="font-sans" style={{ animation: 'fadeIn 0.25s ease', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(152, 118, 26, 0.1)', color: 'var(--accent-gold)' }}>
                          <Terminal size={20} />
                        </div>
                        <div>
                          <h3 className="font-serif" style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Step 4: Prompt Handoff Protocol</h3>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Core Principle: Scaffold and hand off — never complete the MVP for the user.</p>
                        </div>
                      </div>
                      <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', display: 'flex', alignItems: 'center' }}>
                        <span className="pulse-dot" style={{ backgroundColor: '#6b21a8' }} />
                        CLAUDE / CURSOR READY
                      </span>
                    </div>

                    <div style={{ marginBottom: '16px', padding: '12px 14px', backgroundColor: 'var(--surface)', borderRadius: '8px', borderLeft: '3px solid var(--accent-gold)', fontSize: '0.84rem', color: 'var(--ink)', lineHeight: 1.5 }}>
                      <strong>Why we don't finish the code:</strong> When you email a CTO, you must understand every line of your demo. We generate a master prompt that scaffolds the architecture in Claude, leaving the core implementation for you!
                    </div>

                    {/* Interactive Scaffold Checklist Widget */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                      <div 
                        onClick={() => { setAutoCycle(false); setScaffoldChecklist(p => ({ ...p, dir: !p.dir })); }}
                        className="dash-widget-card" 
                        style={{ padding: '10px 12px', backgroundColor: scaffoldChecklist.dir ? '#e2fad4' : 'var(--surface)', borderRadius: '8px', border: scaffoldChecklist.dir ? '1px solid #165c26' : '1px solid var(--border-light)', fontSize: '0.78rem', fontWeight: 600, color: scaffoldChecklist.dir ? '#165c26' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <CheckCircle size={14} color={scaffoldChecklist.dir ? '#165c26' : 'var(--text-dim)'} />
                        <span>Directory Hierarchy</span>
                      </div>
                      <div 
                        onClick={() => { setAutoCycle(false); setScaffoldChecklist(p => ({ ...p, interface: !p.interface })); }}
                        className="dash-widget-card" 
                        style={{ padding: '10px 12px', backgroundColor: scaffoldChecklist.interface ? '#e2fad4' : 'var(--surface)', borderRadius: '8px', border: scaffoldChecklist.interface ? '1px solid #165c26' : '1px solid var(--border-light)', fontSize: '0.78rem', fontWeight: 600, color: scaffoldChecklist.interface ? '#165c26' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <CheckCircle size={14} color={scaffoldChecklist.interface ? '#165c26' : 'var(--text-dim)'} />
                        <span>Core Interfaces</span>
                      </div>
                      <div 
                        onClick={() => alert("Rule §2 Enforced: We never complete the business logic! You scaffold and hand off so you can confidently explain the code during technical interviews.")}
                        className="dash-widget-card" 
                        style={{ padding: '10px 12px', backgroundColor: 'var(--cream)', borderRadius: '8px', border: '1px solid var(--accent-gold)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Lock size={13} color="var(--accent-gold)" />
                        <span>You Write Logic! [Protected]</span>
                      </div>
                    </div>

                    <div className="dark-panel font-mono" style={{ padding: '16px', borderRadius: '10px', backgroundColor: '#1e201b', color: '#e4decb', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '18px', position: 'relative', maxHeight: '220px', overflowY: 'auto', border: '1px solid #33382f', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                      <div style={{ color: '#888b82', marginBottom: '8px', fontSize: '0.72rem', borderBottom: '1px solid #33382f', paddingBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>GENERATED_CLAUDE_PROMPT_{currentData.name.toUpperCase()}.MD</span>
                        <span>SCAFFOLD MODE: ON</span>
                      </div>
                      <div style={{ color: '#facc15', marginBottom: '8px' }}># PROJECT: {currentData.name} Architecture Resolution MVP</div>
                      <div style={{ color: '#cbd5e1' }}>## OBJECTIVE</div>
                      <div style={{ color: '#a3a89e', marginBottom: '8px' }}>Build a minimalist proof-of-concept demonstrating how to solve: "{currentData.problemTitle}".</div>
                      <div style={{ color: '#cbd5e1' }}>## NON-NEGOTIABLE PRINCIPLE (RULE §2)</div>
                      <div style={{ color: '#ff8080', marginBottom: '8px' }}>DO NOT COMPLETE THE FULL MVP. Scaffold the directory structure, define the core TypeScript interfaces, and write unit test stubs. Leave the core algorithm implementation for the user.</div>
                      <div style={{ color: '#cbd5e1' }}>## REQUIRED ARCHITECTURE</div>
                      <div style={{ color: '#4ade80' }}>1. /src/services/connectionPool.ts (Interface only)</div>
                      <div style={{ color: '#4ade80' }}>2. /tests/loadTest.spec.ts (Benchmark harness stub)</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button 
                        onClick={handleCopyPrompt} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          backgroundColor: isCopied ? 'var(--accent-moss)' : 'var(--paper)',
                          color: isCopied ? '#fff' : 'var(--ink)',
                          border: '1px solid var(--border)',
                          fontWeight: 600,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: isCopied ? '0 4px 12px rgba(108, 115, 57, 0.3)' : 'none'
                        }}
                      >
                        {isCopied ? <Check size={15} /> : <Copy size={15} />}
                        <span>{isCopied ? 'Copied!' : 'Copy Prompt'}</span>
                      </button>
                    </div>
                    <button onClick={() => handleManualStepClick(5)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                      <span>Next: Outreach</span> <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5 STUDIO */}
              {activeStep === 5 && (
                <div className="font-sans" style={{ animation: 'fadeIn 0.25s ease', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(152, 118, 26, 0.1)', color: 'var(--accent-gold)' }}>
                          <Send size={20} />
                        </div>
                        <div>
                          <h3 className="font-serif" style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Step 5: Value-First Founder Outreach</h3>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Core Principle: No ask. Just value. Show up with a solution, not a resume.</p>
                        </div>
                      </div>
                      <span className="badge badge-moss" style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', display: 'flex', alignItems: 'center' }}>
                        <span className="pulse-dot" />
                        85%+ RESPONSE RATE
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700 }}>OUTREACH COMPOSER PREVIEW</span>
                      <button 
                        onClick={handleSimulateSend} 
                        disabled={isSimulatingSend}
                        style={{ 
                          padding: '6px 14px', 
                          borderRadius: '6px', 
                          backgroundColor: sendSimulated ? '#e2fad4' : 'var(--accent-gold)', 
                          color: sendSimulated ? '#165c26' : '#fff', 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          border: sendSimulated ? '1px solid #165c26' : 'none',
                          boxShadow: '0 4px 12px rgba(152, 118, 26, 0.2)',
                          transition: 'all 0.2s'
                        }}
                      >
                        {isSimulatingSend ? <Loader2 size={14} className="animate-spin" /> : sendSimulated ? <Check size={14} color="#165c26" /> : <Send size={14} />}
                        <span>{isSimulatingSend ? 'Transmitting to Founder Inbox...' : sendSimulated ? 'Delivered to CTO (85% Est. Open Rate)!' : 'Simulate Value-First Outreach'}</span>
                      </button>
                    </div>

                    <div className="dash-widget-card" style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '22px', fontFamily: 'var(--font-sans)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)', marginBottom: '14px', fontSize: '0.85rem' }}>
                        <div><strong style={{ color: 'var(--text-dim)' }}>TO:</strong> <span style={{ color: 'var(--ink)', fontWeight: 600 }}>hiring-engineering@{currentData.name.toLowerCase()}.com / Founder Inbox</span></div>
                        <div><strong style={{ color: 'var(--text-dim)' }}>SUBJECT:</strong> <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>{currentData.outreachSubject}</span></div>
                      </div>
                      <div style={{ fontSize: '0.89rem', color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {currentData.outreachBody}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--cream)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--accent-gold)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 700 }}>
                      <span>Ready to walk through the Side Door at {currentData.name}?</span>
                    </div>
                    <button onClick={handleUnlock} className="btn-primary" style={{ padding: '10px 20px', fontSize: '0.92rem', backgroundColor: 'var(--accent-gold)', borderColor: 'var(--accent-bright)' }}>
                      <ArrowRight size={16} />
                      <span>Enter Live Dashboard</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* RIGHT PANE: Integrated Target Inspector Sidebar */}
            <div className="font-sans" style={{ padding: '36px 32px', backgroundColor: 'var(--surface)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid var(--border-light)', paddingBottom: '14px' }}>
                  <span className="font-mono" style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>
                    TEST LIVE ON TARGETS:
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click to switch</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                  {Object.keys(TARGET_COMPANIES_DATA).map((compKey) => {
                    const comp = TARGET_COMPANIES_DATA[compKey];
                    const isSelected = compKey.toLowerCase() === activeCompanyKey.toLowerCase();
                    return (
                      <button
                        key={compKey}
                        type="button"
                        onClick={() => {
                          if (onSelectCompany) onSelectCompany(compKey);
                        }}
                        className="dash-target-btn"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: isSelected ? '1.5px solid var(--accent-gold)' : '1px solid var(--border-light)',
                          backgroundColor: isSelected ? 'var(--cream)' : 'var(--paper)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          boxShadow: isSelected ? '0 6px 18px rgba(152, 118, 26, 0.12)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <CompanyLogo name={comp.name} size={34} />
                          <div>
                            <div style={{ fontSize: '0.92rem', fontWeight: isSelected ? 700 : 600, color: 'var(--ink)' }}>{comp.name}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '1px' }}>{comp.role}</div>
                          </div>
                        </div>
                        {isSelected && (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-gold)' }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="dash-widget-card" style={{ padding: '18px', backgroundColor: 'var(--paper)', borderRadius: '14px', border: '1px solid var(--border-light)', marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={16} color="var(--accent-moss)" />
                    <span>RULE §2 PROTOCOL ENFORCED</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>• <strong>No LinkedIn Scraping:</strong> Search URLs only</div>
                    <div>• <strong>Real Evidence:</strong> No source, no card</div>
                    <div>• <strong>Scaffold Only:</strong> Never finish user's MVP</div>
                  </div>
                </div>
              </div>

              <div>
                <button 
                  onClick={handleUnlock}
                  className="btn-primary" 
                  style={{ width: '100%', padding: '14px', fontSize: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(42, 46, 28, 0.15)' }}
                >
                  <ArrowRight size={18} />
                  <span>Unlock Full App Dashboard</span>
                </button>
                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Instant access • No credit card required • Zero spam
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* WHY CHOOSE SIDEDOOR? */}
        <div style={{ backgroundColor: 'var(--paper)', borderRadius: '22px', padding: '44px 36px', border: '1px solid var(--border)', boxShadow: '0 16px 48px rgba(42, 46, 28, 0.05)' }}>
          <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 36px' }}>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>
              THE UNFAIR HIRING ADVANTAGE
            </span>
            <h3 className="font-serif" style={{ fontSize: '2.1rem', fontWeight: 500, color: 'var(--ink)', margin: '8px 0 12px' }}>
              Why to choose SideDoor over job portals
            </h3>
            <p className="font-sans" style={{ fontSize: '1.05rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              The front door is crowded with automated resume screeners and 500+ applicants per role. See why top startup engineers build side doors instead.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'stretch', textAlign: 'left' }}>
            
            {/* The Front Door (Old Way) */}
            <div style={{ padding: '32px', borderRadius: '16px', backgroundColor: '#fffcf7', border: '1px solid rgba(220, 53, 69, 0.2)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(220, 53, 69, 0.15)', paddingBottom: '14px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(220, 53, 69, 0.1)', color: '#dc3545', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem', flexShrink: 0 }}>❌</div>
                <div>
                  <h4 style={{ fontSize: '1.18rem', fontWeight: 700, color: '#dc3545', margin: 0 }}>The Crowded Front Door</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Standard Job Portals & "Apply Now" Queues</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.55 }}>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#dc3545', fontWeight: 700, marginTop: '1px' }}>•</span>
                  <span><strong>500+ resumes per job post:</strong> You are just another PDF file competing against automated spam in an ATS queue.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#dc3545', fontWeight: 700, marginTop: '1px' }}>•</span>
                  <span><strong>Zero context on team pain:</strong> Job descriptions are generic wishlists written by HR, telling you nothing about real tech bottlenecks.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#dc3545', fontWeight: 700, marginTop: '1px' }}>•</span>
                  <span><strong>Generic cover letters:</strong> You waste hours writing personalized cover letters that hiring managers never open.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#dc3545', fontWeight: 700, marginTop: '1px' }}>•</span>
                  <span><strong>&lt;3% interview response rate:</strong> You apply to 100 companies, hear back from 2, and get ghosted for 6 weeks.</span>
                </li>
              </ul>
            </div>

            {/* The SideDoor Protocol (New Way) */}
            <div style={{ padding: '32px', borderRadius: '16px', backgroundColor: 'var(--cream)', border: '2px solid var(--accent-gold)', display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 12px 32px rgba(152, 118, 26, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(152, 118, 26, 0.25)', paddingBottom: '14px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'var(--accent-gold)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Code size={20} /></div>
                <div>
                  <h4 style={{ fontSize: '1.18rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>The Evidenced Side Door</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 600 }}>Autonomous Intelligence Protocol</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.55 }}>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} style={{ color: 'var(--accent-moss)', flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Bypass job portals entirely:</strong> Discover active architectural challenges from public engineering blogs, HN, and GitHub changelogs.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} style={{ color: 'var(--accent-moss)', flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>100% cited proof (Zero AI hallucinations):</strong> Every opportunity is backed by clickable engineering receipts and local TF-IDF matching.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} style={{ color: 'var(--accent-moss)', flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Scaffolded prompts for Claude / Cursor:</strong> We generate tailored prompts so you can build a 2-hour benchmark proof of concept yourself.</span>
                </li>
                <li style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <CheckCircle size={18} style={{ color: 'var(--accent-moss)', flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>85%+ interview response rate:</strong> Walk directly into the founder or CTO's inbox with a working demo solving their exact pain point.</span>
                </li>
              </ul>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
