import { useState, useEffect } from 'react';
import type { ProgressMapResponse, ProgressDay } from '../../types/schema';
import { acceleratorApi } from '../../api/client';
import { AcceleratorSkeleton } from './shared/AcceleratorSkeleton';

interface ProgressMapProps { userId: string; }

const PHASE_COLORS: Record<string, string> = {
  foundation: '#3b82f6',
  technical: '#f97316',
  strategy: '#eab308',
  ai_pm: '#ef4444',
  interview: '#22c55e',
  attack: '#a855f7',
};

const BOSS_DAYS = new Set([8, 15, 20, 25, 35, 45]);

export function ProgressMap({ userId }: ProgressMapProps) {
  const [progress, setProgress] = useState<ProgressMapResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    acceleratorApi.getProgress(userId)
      .then(setProgress)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <AcceleratorSkeleton lines={5} />;
  if (!progress) return null;

  // Fill to 45 locked days if progress is incomplete
  const days: ProgressDay[] = Array.from({ length: 45 }, (_, i) => {
    const d = progress.days.find(d => d.day_number === i + 1);
    return d ?? { day_number: i + 1, phase: 'foundation', phase_label: '', title: '', status: 'locked', blocks_done_count: 0, completed_at: null };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h3 style={{ margin: 0, color: '#888', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>45-Day Map</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px' }}>
        {days.map((day) => {
          const phaseColor = PHASE_COLORS[day.phase] ?? '#555';
          const isBoss = BOSS_DAYS.has(day.day_number);
          const bg = day.status === 'done'
            ? phaseColor
            : day.status === 'today'
              ? phaseColor + '88'
              : day.status === 'missed'
                ? '#7f1d1d'
                : '#2a2a2a';
          return (
            <div
              key={day.day_number}
              title={`Day ${day.day_number}: ${day.title || 'Locked'}`}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '4px',
                background: bg,
                border: day.status === 'today' ? `2px solid ${phaseColor}` : '1px solid transparent',
                cursor: 'default',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '8px',
              }}
            >
              {isBoss && day.status !== 'locked' && '⚡'}
            </div>
          );
        })}
      </div>
      {/* Phase legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
        {Object.entries(PHASE_COLORS).map(([phase, color]) => (
          <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#888' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: color, flexShrink: 0 }} />
            {phase.replace('_', ' ')}
          </div>
        ))}
      </div>
    </div>
  );
}
