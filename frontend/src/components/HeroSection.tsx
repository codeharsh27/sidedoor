import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Search, ChevronDown, Check, TrendingUp, Layers } from 'lucide-react';

interface HeroSectionProps {
  onSearchCompany?: (companyQuery: string) => void;
  onStartResearch?: (company: string, role: string) => void;
}

const TYPEWRITER_URLS = [
  'https://linear.app',
  'https://stripe.com',
  'https://vercel.com',
  'https://supabase.com',
  'https://posthog.com',
  'https://anthropic.ai',
  'https://cursor.com',
  'https://sarvam.in'
];

const ROLES_LIST = [
  'Product Engineer',
  'Full Stack Engineer',
  'Backend / Systems Engineer',
  'Frontend Engineer',
  'DevOps / Infrastructure',
  'AI / ML Engineer'
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onSearchCompany, onStartResearch }) => {
  const [companyInput, setCompanyInput] = useState('');
  const [roleInput, setRoleInput] = useState('Product Engineer');
  const [isHovered, setIsHovered] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // Typewriter effect state for placeholder
  const [placeholderText, setPlaceholderText] = useState('');
  const [urlIndex, setUrlIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Close custom role menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setIsRoleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isPaused) {
      const pauseTimer = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, 2200);
      return () => clearTimeout(pauseTimer);
    }

    const currentUrl = TYPEWRITER_URLS[urlIndex];
    const speed = isDeleting ? 35 : 70;

    const timer = setTimeout(() => {
      if (!isDeleting) {
        if (charIndex < currentUrl.length) {
          setPlaceholderText(currentUrl.slice(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        } else {
          setIsPaused(true);
        }
      } else {
        if (charIndex > 0) {
          setPlaceholderText(currentUrl.slice(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        } else {
          setIsDeleting(false);
          setUrlIndex((prev) => (prev + 1) % TYPEWRITER_URLS.length);
        }
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, isPaused, urlIndex]);

  const handleProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyInput.trim()) return;
    if (onStartResearch) onStartResearch(companyInput.trim(), roleInput.trim());
    if (onSearchCompany) onSearchCompany(companyInput.trim());
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
      <div style={{
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
            marginBottom: '32px', 
            maxWidth: '620px' 
          }}>
            Resumes don't get you hired—real value does. Uncover actual engineering gaps at target startups, build proof of work, and drive with value first, not another ignored resume.
          </p>

          {/* Mobile Only: Centered Launch Dashboard Button */}
          <div className="mobile-only" style={{ display: 'none', justifyContent: 'center', marginBottom: '32px' }}>
            <button 
              onClick={() => {
                if (onStartResearch) onStartResearch('', '');
                // Note: The parent component routing actually uses window.location or navigate, 
                // but since HeroSection doesn't have navigate, and onStartResearch triggers the flow,
                // we'll simulate the dashboard click by firing a generic empty search or we can just trigger a click on the navbar dashboard button.
                // Wait, HeroSection has no direct access to setActiveTab from Navbar.
                // Best is to call onSearchCompany with a default, or trigger a custom event.
                // Actually, since this is just a link to the dashboard, we can just use window.location.href = '/dashboard'.
                window.location.href = '/dashboard';
              }}
              style={{ 
                padding: '12px 28px', 
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '12px',
                backgroundColor: '#1e2316',
                color: '#e2d5b6',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>Launch Dashboard</span>
              <ArrowRight size={18} />
            </button>
          </div>
          {/* Minimalistic Search Box with Custom Pale Yellow Role Dropdown Menu */}
          <div className="hide-on-mobile" style={{ marginBottom: '24px', maxWidth: '660px', position: 'relative' }}>
            <form onSubmit={handleProceed}>
              <div className="paper-card" style={{ 
                padding: '8px 8px 8px 18px', 
                display: 'flex', 
                flexWrap: 'wrap',
                alignItems: 'center', 
                gap: '12px',
                border: isHovered ? '1px solid var(--accent-gold)' : '1px solid var(--border)',
                backgroundColor: 'var(--paper)',
                boxShadow: isHovered 
                  ? '0 20px 48px rgba(152, 118, 26, 0.16), 0 4px 12px rgba(42, 46, 28, 0.05)' 
                  : '0 12px 36px rgba(42, 46, 28, 0.08)',
                borderRadius: '12px',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              >
                <div className="mobile-w-full" style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <Search size={20} color="var(--accent-gold)" style={{ flexShrink: 0 }} />
                  
                  <input 
                    type="text"
                    value={companyInput}
                    onChange={(e) => setCompanyInput(e.target.value)}
                    placeholder={placeholderText || 'https://...'}
                    className="font-serif"
                    style={{ 
                      flex: 1, 
                      background: 'transparent', 
                      border: 'none', 
                      outline: 'none', 
                      fontSize: '1.15rem', 
                      color: 'var(--ink)',
                      fontWeight: 500,
                      minWidth: '150px'
                    }}
                    required
                  />
                </div>

                {/* Custom Pale Yellow / Cream Role Selection Menu Trigger */}
                <div ref={roleMenuRef} className="mobile-w-full" style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                    className="font-sans mobile-w-full"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      gap: '6px',
                      backgroundColor: '#f4ead1', 
                      border: '1px solid rgba(152, 118, 26, 0.35)', 
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '0.86rem', 
                      color: '#7a5a10',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span>{roleInput}</span>
                    <ChevronDown size={14} style={{ transform: isRoleMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }} />
                  </button>

                  {/* Custom Floating Role Dropdown Menu matching Pale Yellow Theme */}
                  {isRoleMenuOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '240px',
                      backgroundColor: '#f4ead1',
                      border: '1px solid rgba(152, 118, 26, 0.35)',
                      borderRadius: '12px',
                      padding: '6px',
                      boxShadow: '0 16px 40px rgba(42, 46, 28, 0.22), 0 4px 12px rgba(152, 118, 26, 0.12)',
                      zIndex: 100,
                      animation: 'fadeIn 0.15s ease-out'
                    }}>
                      <div className="font-mono" style={{ fontSize: '0.64rem', color: '#98761a', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 10px 4px', fontWeight: 600 }}>
                        Select Target Role
                      </div>
                      {ROLES_LIST.map((role) => (
                        <div
                          key={role}
                          onClick={() => {
                            setRoleInput(role);
                            setIsRoleMenuOpen(false);
                          }}
                          className="font-sans"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            fontSize: '0.86rem',
                            fontWeight: role === roleInput ? 600 : 500,
                            color: role === roleInput ? '#5a420b' : '#7a5a10',
                            backgroundColor: role === roleInput ? 'rgba(152, 118, 26, 0.15)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (role !== roleInput) e.currentTarget.style.backgroundColor = 'rgba(152, 118, 26, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            if (role !== roleInput) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <span>{role}</span>
                          {role === roleInput && <Check size={14} color="#5a420b" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  className="mobile-w-full"
                  style={{ 
                    padding: '11px 24px', 
                    fontSize: '0.92rem', 
                    fontWeight: 600,
                    whiteSpace: 'nowrap', 
                    borderRadius: '8px', 
                    backgroundColor: '#1e2316', 
                    color: '#e2d5b6',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#29301f'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e2316'}
                >
                  <span>Scout Opportunities</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
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
                  onClick={() => {
                    setCompanyInput(comp.url);
                    if (onStartResearch) onStartResearch(comp.name, roleInput);
                    if (onSearchCompany) onSearchCompany(comp.name);
                  }}
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
