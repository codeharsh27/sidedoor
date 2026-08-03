import React from 'react';

interface NavbarProps {
  onOpenDashboard?: () => void;
  activeTab: 'landing' | 'dashboard';
  setActiveTab: (tab: 'landing' | 'dashboard') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backgroundColor: 'rgba(253, 251, 246, 0.95)',
      backgroundImage: 'radial-gradient(rgba(152, 118, 26, 0.09) 0.6px, transparent 0.6px)',
      backgroundSize: '8px 8px',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-light)',
      padding: '12px 0'
    }}>
      <div className="mobile-p-4" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        width: '100%', 
        paddingLeft: '40px', 
        paddingRight: '40px', 
        boxSizing: 'border-box' 
      }}>
        
        {/* Logo (Clean & Compact) */}
        <div 
          onClick={() => setActiveTab('landing')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
        >
          <img 
            src="/sidedoor_logo.png" 
            alt="SideDoor Logo" 
            style={{ height: '36px', objectFit: 'contain' }} 
          />
          <span className="font-serif" style={{ 
            fontSize: '1.42rem', 
            fontWeight: 600, 
            color: 'var(--ink)', 
            letterSpacing: '-0.02em',
            lineHeight: 1,
            transform: 'translateY(2px)'
          }}>
            SideDoor
          </span>
        </div>

        {/* Navigation Actions (Minimal & Uncluttered) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }} className="font-sans mobile-gap-4">
          <button 
            onClick={() => setActiveTab('landing')}
            className="hide-on-mobile"
            style={{ 
              color: activeTab === 'landing' ? 'var(--ink)' : 'var(--text-muted)', 
              fontWeight: 500, 
              fontSize: '0.95rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            How it works
          </button>

          <button 
            onClick={() => setActiveTab('dashboard')}
            className="hide-on-mobile"
            style={{ 
              padding: '7px 18px', 
              fontSize: '0.86rem',
              fontWeight: 600,
              borderRadius: '8px',
              backgroundColor: '#1e2316',
              color: '#e2d5b6',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'all 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#29301f';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#1e2316';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span>{activeTab === 'dashboard' ? 'Dashboard Active' : 'Launch Dashboard'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
