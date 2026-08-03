import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer style={{ 
      backgroundColor: '#282e1e', // Rich deep forest olive-green exact match
      color: '#f4ebd0', 
      padding: '72px 0 24px',
      position: 'relative',
      overflow: 'hidden',
      borderTop: '1px solid var(--border-light)'
    }}>
      {/* Background smooth gradient fade from light cream page top down into deep forest green bottom */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, var(--bg) 0%, #dfd6c3 22%, #687053 52%, #2d3422 80%, #1f2416 100%)',
        zIndex: 0
      }} />

      {/* Halftone / stipple mountain forest texture overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url('/halftone_side_door.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        opacity: 0.42,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
        zIndex: 1,
        filter: 'contrast(125%) sepia(20%)'
      }} />

      {/* Second soft gradient layer to ensure top links stay legible and bottom forest stays deep green */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, var(--bg) 0%, rgba(240, 234, 219, 0.8) 18%, transparent 45%, rgba(40, 46, 30, 0.6) 85%, #1e2315 100%)',
        zIndex: 1,
        pointerEvents: 'none'
      }} />

      <div className="container" style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '64px' }}>
        
        {/* Top Horizontal Navigation Row (Centered on Light Cream Upper Section) */}
        <nav className="font-sans" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          flexWrap: 'wrap', 
          gap: '28px',
          fontSize: '0.92rem',
          fontWeight: 600,
          color: 'var(--ink)'
        }}>
          <a href="#scan-preview" style={{ color: 'var(--ink)', textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
            How it works
          </a>
          
          <a href="#scan-preview" style={{ color: 'var(--ink)', textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
            Get started
          </a>
          
          <a href="#scan-preview" style={{ color: 'var(--ink)', textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
            CaseStudy
          </a>

          {/* GitHub Link with Icon */}
          <a href="https://github.com" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--ink)', textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            <span>GitHub</span>
          </a>

          {/* X (Twitter) Link with Icon */}
          <a href="https://x.com/codeharsh27" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--ink)', textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>X</span>
          </a>

          {/* LinkedIn Link with Icon */}
          <a href="https://www.linkedin.com/in/harshmule27/" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--ink)', textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect width="4" height="12" x="2" y="9" />
              <circle cx="4" cy="4" r="2" />
            </svg>
            <span>LinkedIn</span>
          </a>

          {/* Email Link with Icon */}
          <a href="mailto:code.harsh26@gmail.com" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--ink)', textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '0.6'} onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <span>Email</span>
          </a>
        </nav>

        {/* Code Almanac Style Wordmark - stretched fully and fully visible */}
        <div style={{ 
          textAlign: 'center', 
          width: '100%', 
          margin: '32px 0 0 0', 
          userSelect: 'none', 
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span className="font-serif" style={{ 
            fontSize: 'clamp(4.8rem, 16vw, 15rem)', 
            fontWeight: 700, 
            color: '#efe7cd', 
            letterSpacing: '-0.03em',
            lineHeight: 0.95,
            display: 'block'
          }}>
            SideDoor
          </span>
          
          {/* Copyright Tag centered below the wordmark */}
          <div className="font-mono" style={{ 
            fontSize: '0.78rem',
            color: 'rgba(244, 235, 208, 0.65)',
            letterSpacing: '0.04em'
          }}>
            © {new Date().getFullYear()} · personal project
          </div>
        </div>

      </div>
    </footer>
  );
};
