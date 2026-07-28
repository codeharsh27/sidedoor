import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ResumeUploadModal } from './components/ResumeUploadModal';
import type { UserProfile } from './types/schema';

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'landing' | 'dashboard'>('landing');
  
  // Global App State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sync navbar with current route
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('landing');
    }
  }, [location.pathname]);

  const handleTabChange = (tab: 'landing' | 'dashboard') => {
    if (tab === 'dashboard') {
      if (!userProfile) {
        // Require resume upload before dashboard
        setIsModalOpen(true);
      } else {
        navigate('/dashboard');
      }
    } else {
      navigate('/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProfileSuccess = (profile: UserProfile) => {
    setUserProfile(profile);
    setIsModalOpen(false);
    navigate('/dashboard');
  };

  const isDashboard = location.pathname === '/dashboard';

  return (
    <div style={{ 
      height: isDashboard ? '100vh' : 'auto',
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative',
      overflow: isDashboard ? 'hidden' : 'visible'
    }}>
      {!isDashboard && (
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
        />
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: isDashboard ? 'hidden' : 'visible' }}>
        <Routes>
          <Route 
            path="/" 
            element={<LandingPage onTriggerUpload={() => setIsModalOpen(true)} />} 
          />
          <Route 
            path="/dashboard" 
            element={<DashboardPage globalProfile={userProfile} />} 
          />
        </Routes>
      </main>

      {!isDashboard && <Footer />}

      <ResumeUploadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleProfileSuccess} 
      />
    </div>
  );
}

export default App;
