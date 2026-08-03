import React from 'react';
import { Kanban, Send, MessageSquare, Briefcase } from 'lucide-react';

interface TrackerPreviewSectionProps {
  onUnlockTracker?: () => void;
}

export const TrackerPreviewSection: React.FC<TrackerPreviewSectionProps> = ({ onUnlockTracker }) => {
  return (
    <section style={{ padding: '88px 0', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border-light)' }}>
      <div className="container mobile-p-4" style={{ maxWidth: '1140px' }}>
        
        {/* Section Header */}
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 48px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', backgroundColor: 'var(--cream)', padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
              Persistent Candidate Workflow Pipeline
            </span>
          </div>
          <h2 className="font-serif" style={{ fontSize: '2.5rem', fontWeight: 500, margin: '0 0 14px 0', color: 'var(--ink)', lineHeight: 1.1 }}>
            Track solution builds from <em>zero to interview</em>
          </h2>
          <p className="font-sans" style={{ fontSize: '1.05rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
            No more messy spreadsheets or lost follow-ups. SideDoor's built-in Workflow Tracker auto-syncs your solution builds, cold outreach status, candidate replies, and 7-day follow-up reminders.
          </p>
        </div>

        {/* Kanban Board Visual Preview */}
        <div className="paper-card mobile-p-4" style={{ padding: '24px', backgroundColor: 'var(--paper)', border: '1px solid var(--border-light)', borderRadius: '16px' }}>
          
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
                <Kanban size={16} color="var(--accent-gold)" />
              </div>
              <div>
                <h4 className="font-serif" style={{ fontSize: '1.1rem', margin: 0, color: 'var(--ink)', fontWeight: 600 }}>Active Application Pipeline</h4>
                <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Auto-syncs across your devices</span>
              </div>
            </div>

            <button
              onClick={onUnlockTracker}
              className="btn-primary"
              style={{ padding: '7px 16px', fontSize: '0.82rem' }}
            >
              <span>Launch Your Pipeline →</span>
            </button>
          </div>

          {/* 4 Pipeline Stage Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            
            {/* Column 1: Researching & Building */}
            <div style={{ backgroundColor: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#d97706' }} />
                  BUILDING MVP (2)
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ backgroundColor: 'var(--paper)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '4px' }}>PostHog</div>
                  <div className="font-sans" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink)' }}>Webhooks Debugger MVP</div>
                  <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '6px', display: 'block' }}>2-day benchmark POC</span>
                </div>

                <div style={{ backgroundColor: 'var(--paper)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '4px' }}>Supabase</div>
                  <div className="font-sans" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink)' }}>Schema Migration Dry-Runner</div>
                  <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '6px', display: 'block' }}>Weekend Hack</span>
                </div>
              </div>
            </div>

            {/* Column 2: Outreach Sent */}
            <div style={{ backgroundColor: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#0284c7' }} />
                  OUTREACH SENT (1)
                </span>
              </div>

              <div style={{ backgroundColor: 'var(--paper)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <div className="font-mono" style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700, marginBottom: '4px' }}>SigNoz</div>
                <div className="font-sans" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink)' }}>OTel Stream Inspector</div>
                <div className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--accent-moss)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Send size={11} />
                  <span>Sent to CTO (2d ago)</span>
                </div>
              </div>
            </div>

            {/* Column 3: Candidate Replied */}
            <div style={{ backgroundColor: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#059669' }} />
                  REPLIED / POSITIVE (1)
                </span>
              </div>

              <div style={{ backgroundColor: 'var(--paper)', padding: '12px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <div className="font-mono" style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, marginBottom: '4px' }}>Linear</div>
                <div className="font-sans" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink)' }}>CRDT Reconciler Prototype</div>
                <div className="font-mono" style={{ fontSize: '0.68rem', color: '#059669', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MessageSquare size={11} />
                  <span>CTO loved the demo!</span>
                </div>
              </div>
            </div>

            {/* Column 4: Interview Scheduled */}
            <div style={{ backgroundColor: 'var(--surface)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#16a34a' }} />
                  INTERVIEW SCHEDULED (1)
                </span>
              </div>

              <div style={{ backgroundColor: 'var(--paper)', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div className="font-mono" style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, marginBottom: '4px' }}>Stripe</div>
                <div className="font-sans" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--ink)' }}>DLQ Replay Simulator</div>
                <div className="font-mono" style={{ fontSize: '0.68rem', color: '#166534', marginTop: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Briefcase size={11} />
                  <span>Tech Chat: Thursday</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
