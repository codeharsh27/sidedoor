import React from 'react';
import { ShieldCheck, Cpu, Terminal } from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  return (
    <section style={{ padding: '80px 0', backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--border-light)' }}>
      <div className="container" style={{ maxWidth: '1040px' }}>
        
        {/* Editorial Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 60px' }}>
          <span className="badge badge-gold" style={{ marginBottom: '14px' }}>
            <span>Why The Front Door Is Broken</span>
          </span>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>
            Built on strict, non-negotiable<br /><em>engineering principles</em>.
          </h2>
          <p className="font-sans" style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Most job-searching tools spam recruiters with AI-generated cover letters. 
            We took the opposite approach: rigorous research, zero BS, and verifiable architectural evidence.
          </p>
        </div>

        {/* 3 Pillars (Code Almanac Grid) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          
          {/* Pillar 1 */}
          <div className="paper-card font-sans" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ 
              width: '44px', 
              height: '44px', 
              borderRadius: '10px', 
              backgroundColor: 'rgba(152, 118, 26, 0.12)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--accent-gold)' 
            }}>
              <Terminal size={22} />
            </div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--ink)' }}>Scaffold & Hand Off</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, flex: 1 }}>
              We never complete the build for you. We generate the perfect AI coding assistant prompt (Claude / Cursor / Copilot) to scaffold a 2-hour MVP. You finish it, so you own the code when you talk to the team.
            </p>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>PRD.md §4 Compliant</span> →
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="paper-card font-sans" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ 
              width: '44px', 
              height: '44px', 
              borderRadius: '10px', 
              backgroundColor: 'rgba(108, 115, 57, 0.12)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--accent-moss)' 
            }}>
              <Cpu size={22} />
            </div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--ink)' }}>No Gratuitous LLMs</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, flex: 1 }}>
              Where a deterministic rule, TF-IDF cosine similarity, or structured template suffices, we use it. We never call an LLM just to guess or hallucinate opportunities. Fast, cheap, and reliable.
            </p>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-moss)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Zero-Hallucination Math</span> →
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="paper-card font-sans" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ 
              width: '44px', 
              height: '44px', 
              borderRadius: '10px', 
              backgroundColor: 'rgba(242, 102, 37, 0.12)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#d9531e' 
            }}>
              <ShieldCheck size={22} />
            </div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--ink)' }}>No Source, No Card</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, flex: 1 }}>
              Every single opportunity card must have a real, clickable evidence source (Reddit thread, GitHub issue, changelog post). If we can't prove their engineering team is discussing it, we don't show it.
            </p>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: '#d9531e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>100% Clickable Receipts</span> →
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
