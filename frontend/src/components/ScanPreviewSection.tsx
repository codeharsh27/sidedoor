import React, { useState } from 'react';
import { 
  Sparkles, ArrowRight, ExternalLink, Clock, 
  ShieldCheck, X
} from 'lucide-react';
import type { UserProfile } from '../types/schema';

interface ScanPreviewSectionProps {
  company?: string;
  role?: string;
  searchedCompany?: string;
  onScanComplete?: () => void;
  onUnlockDashboard?: (profile?: UserProfile) => void;
  onSelectCompany?: (company: string) => void;
}

interface FeedCompanyPreview {
  id: string;
  name: string;
  url: string;
  stage: string;
  fitScore: string;
  whyForYou: string;
  techStack: string[];
  evidenceCount: number;
  evidenceSource: string;
  evidenceUrl: string;
  detailedGap: string;
  mvpOption: {
    title: string;
    description: string;
    scopeDays: string;
  };
  promptSnippet: string;
  outreachDraft: string;
}

const TOP_FOUR_STARTUPS: FeedCompanyPreview[] = [
  {
    id: 'posthog',
    name: 'PostHog',
    url: 'https://posthog.com',
    stage: 'YC W24 / Series B',
    fitScore: '94% Match',
    whyForYou: 'High alignment with your TypeScript, WebSockets & telemetry inspection background.',
    techStack: ['TypeScript', 'React', 'Redis', 'WebSockets'],
    evidenceCount: 3,
    evidenceSource: 'PostHog GitHub Issue #14281 & Public Changelog',
    evidenceUrl: 'https://github.com/PostHog/posthog',
    detailedGap: 'Production WebSocket pooling latency spikes under high concurrent request volume during deployment cycles.',
    mvpOption: {
      title: 'Visual Webhooks Debugging Console & Event Streamer',
      description: 'Build a real-time web console that streams request logs and flags payload anomalies visually.',
      scopeDays: 'Weekend Hack (1-2 days)'
    },
    promptSnippet: `You are assisting a candidate building a 2-hour benchmark POC for PostHog engineering.
OBJECTIVE: Scaffold a lightweight Redis Pub/Sub WebSocket connection pooler in TypeScript that mitigates memory bottlenecks.
RULES (AGENTS.md non-negotiable):
1. Scaffold the project directory structure, Dockerfile, and core TypeScript interfaces.
2. DO NOT complete the business logic — hand off clean TODOs and architecture specifications for the candidate to build themselves.`,
    outreachDraft: `Hey Tim (CTO @ PostHog),\n\nSaw your team's engineering update on WebSocket pooling latency during high concurrency deploys.\n\nInstead of sending another resume, I spent 2 days scaffolding a lightweight visual webhooks debug console using Redis Pub/Sub.\n\nHere is the repo and 2-min demo: [Link]\n\nNo formal ask—just wanted to share this architectural approach with your team!`
  },
  {
    id: 'linear',
    name: 'Linear',
    url: 'https://linear.app',
    stage: 'Sequoia / Series B',
    fitScore: '91% Match',
    whyForYou: 'Matches your frontend architecture background and offline-first state sync experience.',
    techStack: ['TypeScript', 'React', 'IndexedDB', 'CRDTs'],
    evidenceCount: 4,
    evidenceSource: 'Linear Sync Engine Tech Blog & Engineering Notes',
    evidenceUrl: 'https://linear.app/blog',
    detailedGap: 'Optimistic UI state desynchronization during rapid offline-to-online reconnection spikes.',
    mvpOption: {
      title: 'Offline State CRDT Vector Clock Reconciler',
      description: 'Build a lightweight browser sync reconciler that resolves local state conflicts deterministically.',
      scopeDays: 'Weekend Hack (1-2 days)'
    },
    promptSnippet: `You are assisting a candidate building a 2-hour frontend sync POC for Linear engineering.
OBJECTIVE: Scaffold a TypeScript offline state reconciliation engine using IndexedDB and CRDT vector clocks.
RULES: Scaffold the sync store interfaces and conflict resolution hooks. DO NOT implement the full CRDT merge algorithm — provide the test suite and scaffold for the candidate to solve.`,
    outreachDraft: `Hey Tuomas (Head of Eng @ Linear),\n\nBeen studying Linear's sync engine architecture and built a 2-day CRDT vector clock reconciler prototype for local IndexedDB stores.\n\nDemo repository here: [Link]\n\nNo ask at all—just huge admiration for the engineering standard your team sets!`
  },
  {
    id: 'stripe',
    name: 'Stripe',
    url: 'https://stripe.com',
    stage: 'High-Growth Tech',
    fitScore: '88% Match',
    whyForYou: 'Matches your backend systems, API integration, and distributed queue experience.',
    techStack: ['Go', 'PostgreSQL', 'Kafka', 'Docker'],
    evidenceCount: 5,
    evidenceSource: 'Stripe Developer Changelog & Public API Roadmap',
    evidenceUrl: 'https://stripe.com/docs/changelog',
    detailedGap: 'Webhook Dead-Letter Queue (DLQ) inspection and automated replay bottlenecks in sandbox environments.',
    mvpOption: {
      title: 'Multi-Region Webhook DLQ Replay Simulator',
      description: 'Scaffold a Go CLI tool + web dashboard that inspects DLQ payload errors with exponential backoff.',
      scopeDays: '1-Week Project'
    },
    promptSnippet: `You are assisting a candidate building a 2-hour architecture POC for Stripe developer infrastructure.
OBJECTIVE: Scaffold a Go-based Webhook Dead-Letter Queue (DLQ) visualizer and automated replay simulator.
RULES: Scaffold the Go structs, worker pool interfaces, and CLI commands. DO NOT write the complete worker implementation.`,
    outreachDraft: `Hey [Eng Lead @ Stripe],\n\nRead your developer notes on DLQ inspection in sandbox environments and scaffolded a Go CLI + dashboard prototype simulating automated replay.\n\nDemo repo: [Link]\n\nHope this provides a fun architectural conversation starter!`
  },
  {
    id: 'signoz',
    name: 'SigNoz',
    url: 'https://signoz.io',
    stage: 'YC W24 / Seed',
    fitScore: '95% Match',
    whyForYou: 'Highest-fit match for your OpenTelemetry logging, ClickHouse & developer tools background.',
    techStack: ['Go', 'OpenTelemetry', 'ClickHouse', 'React'],
    evidenceCount: 3,
    evidenceSource: 'SigNoz Public Issue Tracker & Community Discussions',
    evidenceUrl: 'https://github.com/SigNoz/signoz',
    detailedGap: 'Real-time high-throughput OTel log stream filtering and payload inspection friction.',
    mvpOption: {
      title: 'Real-Time OTel Telemetry Stream Visualizer',
      description: 'Scaffold an OTel stream filter CLI and visual web console for deployment incident triage.',
      scopeDays: 'Weekend Hack (1-2 days)'
    },
    promptSnippet: `You are assisting a candidate building a 2-hour OTel telemetry POC for SigNoz.
OBJECTIVE: Scaffold an OpenTelemetry log stream inspector and visual filter console.
RULES: Scaffold the Go log tailer and React stream UI. Leave the filter parsing logic as structured TODOs for the candidate to implement.`,
    outreachDraft: `Hey Pranay (Founder @ SigNoz),\n\nSaw public feedback on OTel stream filtering during incident triage and built a 2-day visual log stream inspector prototype!\n\nRepo & video demo: [Link]\n\nWould love to chat about SigNoz's Q3 developer tooling goals!`
  }
];

export const ScanPreviewSection: React.FC<ScanPreviewSectionProps> = ({ onUnlockDashboard }) => {
  const [selectedCompany, setSelectedCompany] = useState<FeedCompanyPreview | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'gap' | 'solution' | 'prompt' | 'outreach'>('gap');
  const [rotationTimer, setRotationTimer] = React.useState<string>('23h 59m 59s');

  React.useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const nextMidnight = new Date();
      nextMidnight.setUTCHours(24, 0, 0, 0);
      
      const diffMs = nextMidnight.getTime() - now.getTime();
      if (diffMs <= 0) {
        setRotationTimer('00h 00m 00s');
        return;
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      const pad = (n: number) => String(n).padStart(2, '0');
      setRotationTimer(`${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section style={{ padding: '88px 0', backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--border-light)' }}>
      <div className="container" style={{ maxWidth: '1240px' }}>
        
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '760px', margin: '0 auto 52px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', backgroundColor: 'var(--cream)', padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
              Value First • Human-Driven Outreach
            </span>
          </div>
          <h2 className="font-serif" style={{ fontSize: '2.6rem', fontWeight: 500, margin: '0 0 14px 0', color: 'var(--ink)', lineHeight: 1.1 }}>
            Top 4 Matched Startups Daily & <em>Deep Research</em>
          </h2>
          <p className="font-sans" style={{ fontSize: '1.08rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
            Every 24 hours, SideDoor matches the top 4 startups for your profile. Run deep research to uncover actual engineering gaps, create real value, and reach out directly to decision-makers—with proof of work, not just another resume.
          </p>
        </div>

        {/* Dashboard UI Frame (Replicating DashboardView Startup Feed) */}
        <div className="paper-card mobile-p-4" style={{ padding: '28px', backgroundColor: 'var(--paper)', border: '1px solid var(--border-light)', borderRadius: '20px', boxShadow: '0 20px 48px rgba(42, 46, 28, 0.08)' }}>
          
          {/* Top Banner Bar mirroring the real Dashboard Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', backgroundColor: 'var(--cream)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                  Candidate Discovery Feed
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>• 4 High-Match Startups Selected</span>
              </div>
              <h3 className="font-serif" style={{ fontSize: '1.5rem', color: 'var(--ink)', margin: 0, fontWeight: 600 }}>
                Top 4 Target Companies Selected for You
              </h3>
            </div>

            {/* 24-Hour Rotation Countdown Pill */}
            <div className="font-mono" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-light)', color: 'var(--ink)', padding: '8px 16px', borderRadius: '24px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} color="var(--accent-gold)" />
              <span>Rotates in <strong style={{ color: 'var(--accent-gold)' }}>{rotationTimer}</strong></span>
            </div>
          </div>

          {/* 4 Top Startup Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            {TOP_FOUR_STARTUPS.map(item => (
              <div 
                key={item.id}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '14px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--ink)', backgroundColor: 'var(--cream)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                      {item.stage}
                    </span>
                    <span className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-gold)', backgroundColor: 'rgba(152, 118, 26, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                      {item.fitScore}
                    </span>
                  </div>

                  {/* Company Name */}
                  <h4 className="font-serif" style={{ fontSize: '1.3rem', color: 'var(--ink)', margin: '0 0 6px 0', fontWeight: 600 }}>
                    {item.name}
                  </h4>

                  {/* Why For You Explanation */}
                  <p className="font-sans" style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: '0 0 14px 0', lineHeight: 1.45 }}>
                    {item.whyForYou}
                  </p>

                  {/* Tech Stack Tags */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {item.techStack.map(tag => (
                      <span key={tag} className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-dim)', backgroundColor: 'var(--paper)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Evidence Receipts & Action Button */}
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--accent-moss)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={12} />
                    <span>{item.evidenceCount} Clickable Receipts</span>
                  </span>

                  <button
                    onClick={() => {
                      setSelectedCompany(item);
                      setActiveModalTab('gap');
                    }}
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      backgroundColor: '#1e2316',
                      color: '#e2d5b6',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>Deep Research</span>
                    <ArrowRight size={12} />
                  </button>
                </div>

              </div>
            ))}
          </div>

          {/* Bottom Interactive Prompt Bar */}
          <div style={{ marginTop: '24px', backgroundColor: 'var(--cream)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={18} color="var(--accent-gold)" />
              <span className="font-sans" style={{ fontSize: '0.9rem', color: 'var(--ink)', fontWeight: 500 }}>
                Tap <strong>Deep Research</strong> on any card above to preview actual gap clusters, MVP blueprints, and Claude prompts.
              </span>
            </div>

            <button
              onClick={() => onUnlockDashboard && onUnlockDashboard()}
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.84rem' }}
            >
              <span>Unlock Your Live Feed →</span>
            </button>
          </div>

        </div>

      </div>

      {/* Interactive Deep Research Modal Preview */}
      {selectedCompany && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(42, 46, 28, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div className="paper-card animate-modal-scale mobile-p-4" style={{
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: 'var(--paper)',
            border: '1px solid var(--paper-edge)',
            borderRadius: '20px',
            padding: '32px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.25)',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setSelectedCompany(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={16} color="var(--ink)" />
            </button>

            {/* Modal Header */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-gold)', backgroundColor: 'var(--cream)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                  Deep Research Brief
                </span>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  {selectedCompany.stage}
                </span>
              </div>
              <h3 className="font-serif" style={{ fontSize: '1.8rem', color: 'var(--ink)', margin: 0, fontWeight: 600 }}>
                {selectedCompany.name} Opportunity Analysis
              </h3>
            </div>

            {/* 4 Interactive Modal Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              {[
                { id: 'gap', label: '1. Actual Gap Discovery & Evidence' },
                { id: 'solution', label: '2. Value Creation Solution' },
                { id: 'prompt', label: '3. Decision-Maker Contacts' },
                { id: 'outreach', label: '4. Value-First Outreach Draft' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveModalTab(tab.id as any)}
                  className="font-mono"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: activeModalTab === tab.id ? 700 : 500,
                    cursor: 'pointer',
                    backgroundColor: activeModalTab === tab.id ? '#1e2316' : 'transparent',
                    color: activeModalTab === tab.id ? '#e2d5b6' : 'var(--text-muted)',
                    border: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Tab Content */}
            {activeModalTab === 'gap' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--surface)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>
                    Identified Product & Telemetry Friction
                  </div>
                  <p className="font-sans" style={{ fontSize: '0.95rem', color: 'var(--ink)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                    {selectedCompany.detailedGap}
                  </p>
                </div>

                <div style={{ backgroundColor: 'var(--cream)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--accent-moss)', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} />
                    <span>Verifiable Evidence Source</span>
                  </div>
                  <a 
                    href={selectedCompany.evidenceUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="font-sans" 
                    style={{ fontSize: '0.88rem', color: 'var(--ink)', textDecoration: 'underline', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>{selectedCompany.evidenceSource}</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )}

            {activeModalTab === 'solution' && (
              <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-gold)', backgroundColor: 'var(--cream)', padding: '2px 8px', borderRadius: '4px' }}>
                    {selectedCompany.mvpOption.scopeDays}
                  </span>
                  <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    Candidate Proof of Work
                  </span>
                </div>
                <h4 className="font-serif" style={{ fontSize: '1.25rem', color: 'var(--ink)', margin: 0, fontWeight: 600 }}>
                  {selectedCompany.mvpOption.title}
                </h4>
                <p className="font-sans" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {selectedCompany.mvpOption.description}
                </p>
              </div>
            )}

            {activeModalTab === 'prompt' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Hiring Decision-Maker Contacts (Reach out with value, not a resume)
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { name: 'Co-Founder & CTO', role: 'Technical Decision Maker', email: 'Direct LinkedIn / Contact Available' },
                    { name: 'Head of Engineering', role: 'Hiring Manager', email: 'Direct Team Contact' }
                  ].map(c => (
                    <div key={c.name} style={{ backgroundColor: 'var(--surface)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="font-sans" style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--ink)' }}>{c.name} @ {selectedCompany.name}</div>
                        <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.role}</div>
                      </div>
                      <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--accent-moss)', fontWeight: 600, backgroundColor: 'var(--cream)', padding: '3px 8px', borderRadius: '4px' }}>
                        {c.email}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeModalTab === 'outreach' && (
              <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                  Direct Outreach Draft to Founder / CTO
                </div>
                <pre className="font-sans" style={{ fontSize: '0.88rem', color: 'var(--ink)', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {selectedCompany.outreachDraft}
                </pre>
              </div>
            )}

            {/* Modal Bottom CTA */}
            <div className="mobile-stack" style={{ marginTop: '28px', borderTop: '1px solid var(--border-light)', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setSelectedCompany(null)}
                className="btn-secondary"
                style={{ padding: '8px 18px', fontSize: '0.85rem' }}
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  setSelectedCompany(null);
                  if (onUnlockDashboard) onUnlockDashboard();
                }}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                <span>Launch Your Pipeline →</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};
