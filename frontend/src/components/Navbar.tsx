import React from 'react';
import { Terminal } from 'lucide-react';

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
      backgroundColor: 'rgba(240, 234, 219, 0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-light)',
      padding: '16px 0'
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1240px' }}>
        
        {/* Logo (Clean & Simple, Code Almanac Style) */}
        <div 
          onClick={() => setActiveTab('landing')}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '6px',
            background: 'var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Terminal size={17} color="var(--cream)" />
          </div>
          <span className="font-serif" style={{ fontSize: '1.45rem', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            SideDoor
          </span>
        </div>

        {/* Navigation Actions (Minimal & Uncluttered) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }} className="font-sans">
          <button 
            onClick={() => setActiveTab('landing')}
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
            className={activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}
            style={{ 
              padding: '8px 18px', 
              fontSize: '0.9rem',
              borderRadius: '8px',
              backgroundColor: activeTab === 'dashboard' ? 'var(--ink)' : 'var(--surface)',
              color: activeTab === 'dashboard' ? 'var(--cream)' : 'var(--ink)',
              border: '1px solid var(--border)'
            }}
          >
            <span>{activeTab === 'dashboard' ? 'Dashboard Active' : 'Launch Dashboard'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
