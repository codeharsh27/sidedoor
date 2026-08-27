import { useState, useEffect } from 'react';
import type { StreakResponse } from '../../types/schema';
import { acceleratorApi } from '../../api/client';
import { AcceleratorError } from './shared/AcceleratorError';
import { AcceleratorSkeleton } from './shared/AcceleratorSkeleton';

interface StreakPanelProps { userId: string; }

export function StreakPanel({ userId }: StreakPanelProps) {
  const [streak, setStreak] = useState<StreakResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    acceleratorApi.getStreak(userId)
      .then(setStreak)
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <AcceleratorSkeleton lines={3} />;
  if (error) return <AcceleratorError message={error} />;
  if (!streak) return null;

  const MILESTONES = [7, 15, 30, 45];
  const MILESTONE_LABELS: Record<number, string> = {
    7: '🔓 Level 2',
    15: '🔓 AI PM Mode',
    30: '🔓 Proof of Work',
    45: '🏆 Complete',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 style={{ margin: 0, color: '#888', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Streak</h3>
      <div style={{ fontSize: '48px', fontWeight: 800, color: streak.current_streak > 0 ? '#f59e0b' : '#555', lineHeight: 1 }}>
        {streak.current_streak > 0 ? `🔥 ${streak.current_streak}` : '—'}
      </div>
      <div style={{ color: '#666', fontSize: '12px' }}>
        {streak.current_streak > 0 ? `${streak.current_streak} day${streak.current_streak === 1 ? '' : 's'} in a row` : 'Start your streak today'}
      </div>
      {streak.recovery_required && (
        <div style={{ background: '#ef444422', border: '1px solid #ef444444', borderRadius: '6px', padding: '8px 12px', color: '#ef4444', fontSize: '12px' }}>
          Streak broken. Complete today's full session to restart.
        </div>
      )}
      {/* Milestones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
        {MILESTONES.map(m => (
          <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: streak.milestones_unlocked.includes(m) ? 1 : 0.3, fontSize: '12px', color: '#ccc' }}>
            {MILESTONE_LABELS[m]}
          </div>
        ))}
      </div>
    </div>
  );
}
