import { useState } from 'react';
import { HeroSection } from '../components/HeroSection';
import { ScanPreviewSection } from '../components/ScanPreviewSection';
import { WorkflowSection } from '../components/WorkflowSection';

interface LandingPageProps {
  onTriggerUpload: () => void;
}

export function LandingPage({ onTriggerUpload }: LandingPageProps) {
  const [searchedCompany, setSearchedCompany] = useState<string>('PostHog');

  const handleSearchCompany = (companyQuery: string) => {
    setSearchedCompany(companyQuery);
    // User wants Analyze button to launch the onboarding flow
    onTriggerUpload();
  };

  return (
    <>
      <HeroSection onSearchCompany={handleSearchCompany} />
      <ScanPreviewSection 
        searchedCompany={searchedCompany} 
        onUnlockDashboard={onTriggerUpload} 
        onSelectCompany={handleSearchCompany}
      />
      <WorkflowSection />
    </>
  );
}
