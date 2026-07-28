import { DashboardView } from '../components/DashboardView';
import { useNavigate } from 'react-router-dom';
import { mockUserProfile } from '../mock/mockData';
import type { UserProfile } from '../types/schema';

interface DashboardPageProps {
  globalProfile: UserProfile | null;
}

export function DashboardPage({ globalProfile }: DashboardPageProps) {
  const navigate = useNavigate();
  const profile = globalProfile || mockUserProfile; // Fallback to mock if accessed directly

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
      <DashboardView 
        userProfile={profile} 
        onBackToLanding={() => {
          navigate('/');
        }} 
      />
    </div>
  );
}
