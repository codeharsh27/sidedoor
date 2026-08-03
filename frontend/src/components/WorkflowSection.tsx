import React from 'react';
import { ShieldCheck, Zap, Users } from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  return (
    <section style={{ padding: '80px 0', backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--border-light)' }}>
      <div className="container mobile-p-4" style={{ maxWidth: '1040px' }}>
        
        {/* Editorial Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '760px', margin: '0 auto 60px' }}>
          <span className="badge badge-gold" style={{ marginBottom: '14px' }}>
            <span>The Value-First Principle</span>
          </span>
          <h2 className="font-serif" style={{ fontSize: '2.5rem', marginBottom: '16px', color: 'var(--ink)' }}>
            We don't work like auto-apply platforms.<br />
            <em>We believe in humans creating value first based on individual talents.</em>
          </h2>
          <p className="font-sans" style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Most platforms spam recruiters with hundreds of AI-generated cover letters and mass resume drops. 
            SideDoor takes the opposite approach: create genuine value first, focus on what the startup needs most, and reach out directly to decision-makers with proof of work.
          </p>
        </div>

        {/* 3 Pillars (Code Almanac Grid) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          
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
              <Zap size={22} />
            </div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--ink)' }}>Drive With Value First</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, flex: 1 }}>
              Resumes get lost in ATS black holes. We help you build a real 2-hour proof of work that solves an actual engineering friction at a target startup, so you stand out immediately when contacting founders.
            </p>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Value-First Outreach</span> →
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
              <Users size={22} />
            </div>
            <h3 style={{ fontSize: '1.4rem', color: 'var(--ink)' }}>Direct Decision-Maker Access</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, flex: 1 }}>
              Skip HR gatekeepers and recruiter filters. We identify technical decision-makers (CTOs, Founders, Heads of Engineering) so you reach out directly with value, demonstration, and code receipts.
            </p>
            <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-moss)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Zero ATS Black Holes</span> →
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
            <h3 style={{ fontSize: '1.4rem', color: 'var(--ink)' }}>100% Verified Gap Receipts</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, flex: 1 }}>
              Every opportunity is backed by real, public evidence—GitHub issues, public changelogs, or telemetry lag discussions. No AI hallucinations, no fake jobs, only real problems waiting to be solved.
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
