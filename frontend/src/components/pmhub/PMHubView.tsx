import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import type { DailyBriefResponse, BlockType } from '../../types/schema';
import { acceleratorApi } from '../../api/client';
import { DailyBriefPanel } from './DailyBriefPanel';
import { BlockRunner } from './BlockRunner';
import { StreakPanel } from './StreakPanel';
import { ProgressMap } from './ProgressMap';
import { EODCheckPanel } from './EODCheckPanel';
import { AcceleratorError } from './shared/AcceleratorError';
import { AcceleratorSkeleton } from './shared/AcceleratorSkeleton';

interface PMHubViewProps {
  supabaseUser: User;
}

export function PMHubView({ supabaseUser }: PMHubViewProps) {
  const [brief, setBrief] = useState<DailyBriefResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allBlocksDone, setAllBlocksDone] = useState(false);
  const [activeBlock, setActiveBlock] = useState<BlockType | null>(null);

  const fetchBrief = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await acceleratorApi.getToday(supabaseUser.id);
      setBrief(data);
      setAllBlocksDone(data.blocks_done.length === 6);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load today\'s brief.');
    } finally {
      setLoading(false);
    }
  }, [supabaseUser.id]);

  useEffect(() => { fetchBrief(); }, [fetchBrief]);

  const handleBlockComplete = useCallback((_blockType: BlockType) => {
    fetchBrief();
  }, [fetchBrief]);

  const handleAllBlocksDone = useCallback(() => {
    setAllBlocksDone(true);
  }, []);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0f0f0f', color: '#e8e8e8', fontFamily: 'sans-serif' }}>
      {/* Left Sidebar */}
      <div style={{
        width: '280px',
        flexShrink: 0,
        borderRight: '1px solid #2a2a2a',
        overflowY: 'auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        boxSizing: 'border-box'
      }}>
        {/* Back Link */}
        <a href="/dashboard" style={{ color: '#888', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
          ← Back to SideDoor
        </a>
        <StreakPanel userId={supabaseUser.id} />
        <hr style={{ border: 'none', borderTop: '1px solid #2a2a2a', margin: 0 }} />
        <ProgressMap userId={supabaseUser.id} />
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        {loading && <AcceleratorSkeleton lines={8} />}
        {error && <AcceleratorError message={error} onRetry={fetchBrief} />}
        {!loading && !error && brief && (
          <>
            <DailyBriefPanel
              brief={brief}
              activeBlock={activeBlock}
              onStartBlock={setActiveBlock}
            />
            <hr style={{ border: 'none', borderTop: '1px solid #2a2a2a', margin: 0 }} />
            <BlockRunner
              brief={brief}
              userId={supabaseUser.id}
              onBlockComplete={handleBlockComplete}
              onAllBlocksDone={handleAllBlocksDone}
              onActiveBlockChange={setActiveBlock}
            />
            <EODCheckPanel
              brief={brief}
              userId={supabaseUser.id}
              allBlocksDone={allBlocksDone}
              onSubmit={fetchBrief}
            />
          </>
        )}
      </div>
    </div>
  );
}
