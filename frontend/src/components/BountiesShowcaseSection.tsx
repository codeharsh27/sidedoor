import React, { useState } from 'react';
import { Coins, ArrowRight } from 'lucide-react';

interface BountyItemPreview {
  id: string;
  companyName: string;
  title: string;
  rewardAmount: string;
  techStack: string[];
  difficulty: 'weekend_hack' | 'one_week_project' | 'high_effort_system';
  bountyType: 'feature_bounty' | 'solo_hackathon' | 'bug_bounty';
  summary: string;
}

const PREVIEW_BOUNTIES: BountyItemPreview[] = [
  {
    id: 'bounty-1',
    companyName: 'PostHog',
    title: 'Visual Webhooks Debugging Console & Payload Inspector',
    rewardAmount: '$1,500 USD',
    techStack: ['TypeScript', 'React', 'WebSockets', 'Redis'],
    difficulty: 'weekend_hack',
    bountyType: 'feature_bounty',
    summary: 'Build a lightweight real-time payload inspector for PostHog webhook retries to resolve production telemetry friction.'
  },
  {
    id: 'bounty-2',
    companyName: 'SigNoz',
    title: 'OpenTelemetry Log Stream Inspector & Filter CLI',
    rewardAmount: '$2,500 USD',
    techStack: ['Go', 'OpenTelemetry', 'PostgreSQL', 'CLI'],
    difficulty: 'one_week_project',
    bountyType: 'solo_hackathon',
    summary: 'Scaffold a Go CLI tool to tail, filter, and inspect high-throughput OTel log streams during active deployments.'
  },
  {
    id: 'bounty-3',
    companyName: 'Supabase',
    title: 'Realtime Schema Migration Validator & Visual Diff',
    rewardAmount: '$1,000 USD',
    techStack: ['TypeScript', 'PostgreSQL', 'Docker'],
    difficulty: 'weekend_hack',
    bountyType: 'feature_bounty',
    summary: 'Build a browser-based migration dry-runner that flags breaking SQL schema changes prior to staging pushes.'
  }
];

interface BountiesShowcaseSectionProps {
  onExploreBounties?: () => void;
}

export const BountiesShowcaseSection: React.FC<BountiesShowcaseSectionProps> = ({ onExploreBounties }) => {
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const filteredBounties = selectedTag === 'all'
    ? PREVIEW_BOUNTIES
    : PREVIEW_BOUNTIES.filter(b => b.techStack.map(t => t.toLowerCase()).includes(selectedTag.toLowerCase()));

  return (
    <section style={{ padding: '88px 0', backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--border-light)' }}>
      <div className="container mobile-p-4" style={{ maxWidth: '1140px' }}>
        
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px', marginBottom: '40px' }}>
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--accent-gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', backgroundColor: 'var(--cream)', padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                Earn While Building Proof of Work
              </span>
            </div>
            <h2 className="font-serif" style={{ fontSize: '2.5rem', fontWeight: 500, margin: '0 0 12px 0', color: 'var(--ink)', lineHeight: 1.1 }}>
              Paid Bounties & <em>Solo Hackathons</em>
            </h2>
            <p className="font-sans" style={{ fontSize: '1.05rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
              Don't just build for free. Solve real engineering gaps at target startups and earn bounties ($500 - $5,000) while creating verifiable proof of work.
            </p>
          </div>

          {/* Stack Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {['all', 'TypeScript', 'Go', 'PostgreSQL', 'WebSockets'].map(tag => {
              const isActive = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className="font-mono"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#1e2316' : 'var(--paper)',
                    color: isActive ? '#e2d5b6' : 'var(--ink)',
                    border: isActive ? '1px solid #1e2316' : '1px solid var(--border-light)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tag === 'all' ? 'All Tech Stacks' : tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bounties Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {filteredBounties.map(item => (
            <div 
              key={item.id}
              className="paper-card mobile-p-4"
              style={{
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '20px',
                backgroundColor: 'var(--paper)',
                border: '1px solid var(--border-light)',
                borderRadius: '16px'
              }}
            >
              <div>
                {/* Company & Bounty Reward Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink)', backgroundColor: 'var(--cream)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                      {item.companyName}
                    </span>
                    <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--accent-moss)', fontWeight: 600 }}>
                      • {item.bountyType === 'feature_bounty' ? 'Feature Bounty' : 'Solo Hackathon'}
                    </span>
                  </div>

                  <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-gold)', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(152, 118, 26, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                    <Coins size={14} />
                    <span>{item.rewardAmount}</span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-serif" style={{ fontSize: '1.25rem', color: 'var(--ink)', margin: '0 0 10px 0', fontWeight: 600, lineHeight: 1.3 }}>
                  {item.title}
                </h3>

                {/* Summary */}
                <p className="font-sans" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {item.summary}
                </p>
              </div>

              {/* Tech Stack & Action CTA */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {item.techStack.map(st => (
                    <span key={st} className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', backgroundColor: 'var(--cream)', padding: '2px 6px', borderRadius: '4px' }}>
                      {st}
                    </span>
                  ))}
                </div>

                <button
                  onClick={onExploreBounties}
                  className="font-mono"
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'transparent',
                    border: 'none'
                  }}
                >
                  <span>Scout Bounty</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
