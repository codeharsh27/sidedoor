import React from 'react';
import { ArrowRight, TrendingUp, Layers } from 'lucide-react';

interface HeroSectionProps {
  onSearchCompany?: (companyQuery: string) => void;
  onStartResearch?: (company: string, role: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onSearchCompany, onStartResearch }) => {
  const handleStart = () => {
    if (onStartResearch) onStartResearch('', '');
    if (onSearchCompany) onSearchCompany('');
  };

  return (
    <section className="halftone-pattern" style={{ 
      padding: '0', 
      borderBottom: '1px solid var(--border-light)', 
      position: 'relative',
      overflow: 'hidden',
      minHeight: 'calc(100vh - 67px)',
      display: 'flex',
      alignItems: 'center'
    }}>
      {/* Restored Original Background Illustration with Seamless Top Blend */}
      <div className="hide-on-mobile" style={{
        position: 'absolute',
        top: '-4%',
        right: 0,
        bottom: '-4%',
        width: '65%',
        backgroundImage: `url('/halftone_side_door.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center right',
        opacity: 0.92,
        pointerEvents: 'none',
        zIndex: 1
      }}>
        {/* Top gradient fade specifically designed to fuse the sky into the top border without any white gap */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, var(--bg) 0%, rgba(240, 234, 219, 0.4) 15%, transparent 35%)' }} />
        {/* Soft left gradient fade */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, var(--bg) 0%, rgba(240, 234, 219, 0.85) 35%, transparent 72%)' }} />
        {/* Bottom gradient fade */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg) 0%, rgba(240, 234, 219, 0.65) 25%, transparent 78%)' }} />
        {/* Right edge soft fade */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, var(--bg) 0%, transparent 12%)' }} />
      </div>

      <div className="container" style={{ position: 'relative', zIndex: 10, maxWidth: '1240px', width: '100%', padding: '48px 24px' }}>
        <div style={{ maxWidth: '720px', textAlign: 'left' }}>
          
          {/* Headline: Concise 5-word title */}
          <h1 className="font-serif" style={{ 
            fontSize: 'clamp(3.1rem, 5vw, 4.6rem)', 
            fontWeight: 500, 
            lineHeight: 1.05, 
            letterSpacing: '-0.035em',
            marginBottom: '18px',
            color: 'var(--ink)',
            textWrap: 'balance'
          }}>
            The <em style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--accent-gold)' }}>evidenced side door</em><br />
            to target companies
          </h1>

          {/* Subheading: Valuable, precious value proposition */}
          <p className="font-sans" style={{ 
            fontSize: '1.14rem', 
            color: 'var(--text-muted)', 
            lineHeight: 1.52, 
            marginBottom: '36px', 
            maxWidth: '620px' 
          }}>
            Resumes don't get you hired—real value does. Uncover actual engineering gaps at target startups, build proof of work, and drive with value first, not another ignored resume.
          </p>

          {/* Call to Action Button */}
          <div style={{ marginBottom: '32px' }}>
            <button 
              onClick={handleStart}
              style={{ 
                padding: '14px 32px', 
                fontSize: '1.05rem',
                fontWeight: 600,
                borderRadius: '12px',
                backgroundColor: '#1e2316',
                color: '#e2d5b6',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#29301f';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#1e2316';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
              }}
            >
              <span>Start Scouting Opportunities</span>
              <ArrowRight size={18} />
            </button>
          </div>

          {/* Clean, Decluttered 1-Line Quick Scout Pills & Preserved Ecosystems Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Quick Scout Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                POPULAR:
              </span>
              {[
                { name: 'Linear', url: 'https://linear.app' },
                { name: 'Stripe', url: 'https://stripe.com' },
                { name: 'PostHog', url: 'https://posthog.com' },
                { name: 'Vercel', url: 'https://vercel.com' }
              ].map(comp => (
                <button
                  key={comp.name}
                  type="button"
                  onClick={handleStart}
                  className="font-sans"
                  style={{
                    padding: '3px 9px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 500,
                    backgroundColor: 'var(--paper)',
                    color: 'var(--ink)',
                    border: '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-gold)';
                    e.currentTarget.style.backgroundColor = 'var(--cream)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                    e.currentTarget.style.backgroundColor = 'var(--paper)';
                  }}
                >
                  <span>{comp.name}</span>
                </button>
              ))}
            </div>

            {/* Strictly Preserved Ecosystems Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingTop: '4px' }}>
              <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                EXPLORE ECOSYSTEMS:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                
                {/* YC Backed */}
                <span className="font-sans" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', fontWeight: 500, color: 'var(--ink)' }}>
                  <span className="font-mono" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '3px', backgroundColor: '#ff6600', color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>Y</span>
                  <span>YC Backed Startups</span>
                </span>

                <span style={{ color: 'var(--border-light)', fontSize: '0.75rem' }}>•</span>

                {/* a16z Portfolio */}
                <span className="font-sans" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', fontWeight: 500, color: 'var(--ink)' }}>
                  <span className="font-mono" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '1px 4px', borderRadius: '3px', backgroundColor: '#2d333a', color: '#ff6c37', fontSize: '0.6rem', fontWeight: 700 }}>a16z</span>
                  <span>a16z Portfolio</span>
                </span>

                <span style={{ color: 'var(--border-light)', fontSize: '0.75rem' }}>•</span>

                {/* Sequoia Backed */}
                <span className="font-sans" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', fontWeight: 500, color: 'var(--ink)' }}>
                  <Layers size={13} color="var(--accent-moss)" />
                  <span>Sequoia Backed</span>
                </span>

                <span style={{ color: 'var(--border-light)', fontSize: '0.75rem' }}>•</span>

                {/* Series A & B */}
                <span className="font-sans" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', fontWeight: 500, color: 'var(--ink)' }}>
                  <TrendingUp size={14} color="var(--accent-gold)" />
                  <span>Series A & B</span>
                </span>

              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};
