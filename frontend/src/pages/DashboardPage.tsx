import { useEffect } from 'react';
import { DashboardView } from '../components/DashboardView';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '../types/schema';

interface DashboardPageProps {
  globalProfile: UserProfile | null;
  userSession: { userId: string; email: string; name: string | null } | null;
}

export function DashboardPage({ globalProfile, userSession }: DashboardPageProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!userSession) {
      navigate('/login');
    }
  }, [userSession, navigate]);

  if (!userSession) {
    return null;
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
      <DashboardView 
        userProfile={globalProfile || undefined} 
        onBackToLanding={() => {
          navigate('/');
        }} 
      />
    </div>
  );
}
