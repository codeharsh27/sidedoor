import React, { useState } from 'react';
import type { OpportunityCardView, FixabilityFlags } from '../types/schema';
import { MOCK_CARDS, GENERATED_SEARCH_URLS } from '../mock/mockData';
import { CompanyLogo } from './CompanyLogo';
import { 
  ExternalLink, 
  Terminal, 
  Copy, 
  Check, 
  Search, 
  ShieldAlert, 
  ArrowUpRight,
  SlidersHorizontal,
  Building2
} from 'lucide-react';

interface DashboardViewProps {
  initialCompany?: string;
  userProfile?: any;
  onBackToLanding?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ initialCompany, onBackToLanding }) => {
  const [selectedCompany, setSelectedCompany] = useState<string>(initialCompany || 'All Companies');
  const [selectedFixability, setSelectedFixability] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activePromptModal, setActivePromptModal] = useState<OpportunityCardView | null>(null);
  
  const companies = ['All Companies', ...Array.from(new Set(MOCK_CARDS.map(c => c.company.name)))];

  const getEstimateType = (flags: FixabilityFlags): string => {
    if (flags.has_public_repo && flags.has_public_api && flags.has_ui_surface) return 'weekend_hack';
    if (flags.has_public_repo || flags.has_public_api) return 'one_week_project';
    return 'high_effort_system';
  };

  const getEstimatedHours = (flags: FixabilityFlags): number => {
    const type = getEstimateType(flags);
    if (type === 'weekend_hack') return 10;
    if (type === 'one_week_project') return 28;
    return 60;
  };

  const filteredCards = MOCK_CARDS.filter(item => {
    const matchesCompany = selectedCompany === 'All Companies' || item.company.name === selectedCompany;
    const estType = getEstimateType(item.fixability_flags);
    const matchesFixability = selectedFixability === 'All' || estType === selectedFixability;
    return matchesCompany && matchesFixability;
  });

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

  const handleCopyPrompt = (promptText: string, cardId: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedId(cardId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getFixabilityBadge = (flags: FixabilityFlags) => {
    const type = getEstimateType(flags);
    switch (type) {
      case 'weekend_hack':
        return <span className="badge badge-moss">Weekend Hack (~10 hrs)</span>;
      case 'one_week_project':
        return <span className="badge badge-gold">1-Week Project (~28 hrs)</span>;
      case 'high_effort_system':
        return <span className="badge badge-orange">System Refactor</span>;
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: '40px 0 80px', backgroundColor: 'var(--bg)', minHeight: 'calc(100vh - 180px)' }}>
      <div className="container" style={{ maxWidth: '1180px' }}>
        
        {/* Editorial Dashboard Banner */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-end', 
          flexWrap: 'wrap', 
          gap: '20px',
          marginBottom: '36px',
          paddingBottom: '24px',
          borderBottom: '1px solid var(--border)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="badge badge-gold">Verified Pipeline Results</span>
              <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>No LinkedIn Scrapes • 100% URL Receipts</span>
            </div>
            <h1 style={{ fontSize: '2.4rem', color: 'var(--ink)' }}>
              Evidenced Opportunity Cards
            </h1>
          </div>

          {/* Quick Filters & Actions */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }} className="font-sans">
            {onBackToLanding && (
              <button 
                onClick={onBackToLanding}
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.85rem', backgroundColor: 'var(--surface)' }}
              >
                ← Back to Overview
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--paper)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--paper-edge)' }}>
              <Building2 size={16} color="var(--accent-gold)" />
              <select 
                value={selectedCompany} 
                onChange={(e) => setSelectedCompany(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontWeight: 600, color: 'var(--ink)', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                {companies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--paper)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--paper-edge)' }}>
              <SlidersHorizontal size={16} color="var(--accent-moss)" />
              <select 
                value={selectedFixability} 
                onChange={(e) => setSelectedFixability(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontWeight: 600, color: 'var(--ink)', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                <option value="All">All Scope Estimates</option>
                <option value="weekend_hack">Weekend Hack (~10h)</option>
                <option value="one_week_project">1-Week Project (~28h)</option>
                <option value="high_effort_system">System Refactor</option>
              </select>
            </div>
          </div>
        </div>

        {/* Generated Search URLs Bar (Replacing automated scraping) */}
        <div className="paper-card font-sans" style={{ 
          padding: '16px 20px', 
          marginBottom: '32px', 
          backgroundColor: 'var(--surface)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(152, 118, 26, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)' }}>
              <Search size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--ink)' }}>
                Live Search URL Feeds (AGENTS.md §2 Compliant)
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Direct generated queries to verify raw engineering telemetry without violating scraping TOS.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {GENERATED_SEARCH_URLS.map((feed, idx) => (
              <a 
                key={idx} 
                href={feed.url} 
                target="_blank" 
                rel="noreferrer" 
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', backgroundColor: 'var(--paper)' }}
              >
                <span>{feed.title}</span>
                <ExternalLink size={13} />
              </a>
            ))}
          </div>
        </div>

        {/* Opportunity Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
          {filteredCards.map(item => {
            const ev = item.evidence_items[0];
            const matchScorePct = (item.card.profile_match_score).toFixed(0);
            
            return (
              <div key={item.card.id} className="paper-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                
                {/* Card Top Banner */}
                <div style={{ 
                  padding: '20px 24px 16px', 
                  borderBottom: '1px solid var(--paper-edge)', 
                  backgroundColor: 'var(--surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <CompanyLogo name={item.company.name} size={28} />
                      <span className="font-sans" style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)' }}>{item.company.name}</span>
                      <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>• {item.company.url.replace('https://', '')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {getFixabilityBadge(item.fixability_flags)}
                    </div>
                  </div>

                  <div style={{ 
                    textAlign: 'right', 
                    background: 'rgba(152, 118, 26, 0.1)', 
                    padding: '6px 12px', 
                    borderRadius: '8px',
                    border: '1px solid rgba(152, 118, 26, 0.2)'
                  }} className="font-mono">
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Match Score</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-gold)' }}>{matchScorePct}%</div>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Title & Description */}
                  <div>
                    <h3 style={{ fontSize: '1.35rem', marginBottom: '10px', color: 'var(--ink)' }}>
                      {item.gap_cluster.label}
                    </h3>
                    <p className="font-sans" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {item.why_matches_you}
                    </p>
                  </div>

                  {/* Evidence Receipt Section (Non-Negotiable PRD Rule!) */}
                  {ev && (
                    <div style={{ 
                      backgroundColor: 'var(--surface)', 
                      padding: '14px 16px', 
                      borderRadius: '12px', 
                      border: '1px solid var(--paper-edge)' 
                    }}>
                      <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--ink)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <ShieldAlert size={14} color="var(--accent-gold)" />
                        <span>VERIFIED EVIDENCE SOURCE (No Receipt = No Card)</span>
                      </div>
                      <div className="font-sans" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '10px', borderLeft: '2px solid var(--accent-gold)', paddingLeft: '10px' }}>
                        "{ev.raw_text}"
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="font-mono">
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          Source: {ev.source_type.toUpperCase()}
                        </span>
                        <a 
                          href={ev.source_url} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <span>View Raw Receipt</span>
                          <ArrowUpRight size={13} />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Target Role Tag */}
                  {item.role_match && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }} className="font-mono">
                      <span>Target Role Fit:</span>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{item.role_match.job_posting.title}</span>
                    </div>
                  )}

                </div>

                {/* Card Footer Actions */}
                <div style={{ padding: '16px 24px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--paper-edge)', display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => setActivePromptModal(item)}
                    className="btn-primary"
                    style={{ flex: 1, padding: '10px 16px', fontSize: '0.9rem' }}
                  >
                    <Terminal size={16} />
                    <span>Scaffold & Hand Off MVP</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {/* Prompt Handoff Modal (Code Almanac Dark CLI Box Style) */}
        {activePromptModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(42, 46, 28, 0.65)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}>
            <div className="dark-panel" style={{ 
              width: '100%', 
              maxWidth: '740px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              padding: '32px',
              position: 'relative'
            }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid rgba(239, 231, 205, 0.15)', paddingBottom: '16px' }}>
                <div>
                  <span className="badge" style={{ backgroundColor: 'rgba(194, 166, 78, 0.2)', color: 'var(--accent-bright)', marginBottom: '8px' }}>
                    PRD.md §4 Non-Negotiable Rule
                  </span>
                  <h3 className="font-serif" style={{ fontSize: '1.8rem', color: 'var(--cream)', fontWeight: 500 }}>
                    AI Assistant Scaffold Prompt
                  </h3>
                  <p className="font-sans" style={{ fontSize: '0.85rem', color: 'rgba(239, 231, 205, 0.7)', marginTop: '4px' }}>
                    We never finish the build for you. Paste this structured specification into Claude 3.5 Sonnet, Cursor, or Copilot to build your 2-hour MVP.
                  </p>
                </div>
                <button 
                  onClick={() => setActivePromptModal(null)}
                  style={{ color: 'rgba(239, 231, 205, 0.5)', fontSize: '1.5rem', lineHeight: 1, padding: '4px' }}
                >
                  ✕
                </button>
              </div>

              {/* Code Almanac Style Command Block with Copy Button */}
              <div style={{ 
                backgroundColor: '#171a10', 
                border: '1px solid rgba(239, 231, 205, 0.2)', 
                borderRadius: '12px', 
                padding: '20px', 
                position: 'relative',
                marginBottom: '24px'
              }}>
                <button 
                  onClick={() => handleCopyPrompt(generatePromptText(activePromptModal), activePromptModal.card.id)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    backgroundColor: 'rgba(239, 231, 205, 0.15)',
                    border: '1px solid rgba(239, 231, 205, 0.3)',
                    color: 'var(--cream)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 600
                  }}
                >
                  {copiedId === activePromptModal.card.id ? (
                    <>
                      <Check size={14} color="var(--accent-bright)" />
                      <span style={{ color: 'var(--accent-bright)' }}>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Prompt</span>
                    </>
                  )}
                </button>

                <pre className="font-mono" style={{ 
                  whiteSpace: 'pre-wrap', 
                  fontSize: '0.85rem', 
                  lineHeight: 1.6, 
                  color: 'var(--cream)', 
                  maxHeight: '340px', 
                  overflowY: 'auto',
                  paddingRight: '100px'
                }}>
                  {generatePromptText(activePromptModal)}
                </pre>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div className="font-mono" style={{ fontSize: '0.75rem', color: 'rgba(239, 231, 205, 0.5)' }}>
                  Target Role: {activePromptModal.role_match?.job_posting.title || 'General Engineer'} • Est: {getEstimatedHours(activePromptModal.fixability_flags)} hrs
                </div>
                <button 
                  onClick={() => {
                    handleCopyPrompt(generatePromptText(activePromptModal), activePromptModal.card.id);
                  }}
                  className="btn-primary"
                  style={{ backgroundColor: 'var(--accent-gold)', borderColor: 'var(--accent-bright)', color: 'var(--ink) !important', fontWeight: 700 }}
                >
                  <Copy size={16} />
                  <span>Copy Prompt & Close</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
