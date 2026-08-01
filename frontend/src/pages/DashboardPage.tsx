import { useEffect } from 'react';
import { DashboardView } from '../components/DashboardView';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return null;
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
      <DashboardView
        supabaseUser={user}
        onBackToLanding={() => navigate('/')}
      />
    </div>
  );
}
