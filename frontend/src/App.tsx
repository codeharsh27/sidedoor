import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ScanPreviewSection } from './components/ScanPreviewSection';
import { WorkflowSection } from './components/WorkflowSection';
import { Footer } from './components/Footer';
import { DashboardView } from './components/DashboardView';
import type { UserProfile } from './types/schema';
import { mockUserProfile } from './mock/mockData';

export function App() {
  const [activeTab, setActiveTab] = useState<'landing' | 'dashboard'>('landing');
  const [searchedCompany, setSearchedCompany] = useState<string>('PostHog');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const handleSearchCompany = (companyQuery: string) => {
    setSearchedCompany(companyQuery);
    // Smooth scroll down to scan preview section
    setTimeout(() => {
      const el = document.getElementById('scan-preview');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleUnlockDashboard = (profile: UserProfile) => {
    setUserProfile(profile);
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          if (tab === 'dashboard' && !userProfile) {
            setUserProfile(mockUserProfile);
          }
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }} 
      />

      <main style={{ flex: 1 }}>
        {activeTab === 'landing' ? (
          <>
            <HeroSection onSearchCompany={handleSearchCompany} />
            <ScanPreviewSection 
              searchedCompany={searchedCompany} 
              onUnlockDashboard={handleUnlockDashboard} 
              onSelectCompany={handleSearchCompany}
            />
            <WorkflowSection />
          </>
        ) : (
          <DashboardView 
            userProfile={userProfile} 
            onBackToLanding={() => {
              setActiveTab('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }} 
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
