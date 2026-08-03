import { useState } from 'react';
import { HeroSection } from '../components/HeroSection';
import { ScanPreviewSection } from '../components/ScanPreviewSection';
import { BountiesShowcaseSection } from '../components/BountiesShowcaseSection';
import { TrackerPreviewSection } from '../components/TrackerPreviewSection';
import { WorkflowSection } from '../components/WorkflowSection';

interface LandingPageProps {
  onTriggerUpload: () => void;
}

export function LandingPage({ onTriggerUpload }: LandingPageProps) {
  const [searchedCompany, setSearchedCompany] = useState<string>('PostHog');

  const handleSearchCompany = (companyQuery: string) => {
    setSearchedCompany(companyQuery);
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
      <BountiesShowcaseSection onExploreBounties={onTriggerUpload} />
      <TrackerPreviewSection onUnlockTracker={onTriggerUpload} />
      <WorkflowSection />
    </>
  );
}
