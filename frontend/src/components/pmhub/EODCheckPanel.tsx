import { useState } from 'react';
import type { DailyBriefResponse, BlockType, EODSubmitResponse } from '../../types/schema';
import { BLOCK_ORDER } from '../../types/schema';
import { acceleratorApi } from '../../api/client';

interface EODCheckPanelProps {
  brief: DailyBriefResponse;
  userId: string;
  allBlocksDone: boolean;
  onSubmit: () => void;
}

export function EODCheckPanel({ brief, userId, allBlocksDone, onSubmit }: EODCheckPanelProps) {
  const [hardestBlock, setHardestBlock] = useState<BlockType | ''>('');
  const [skippedBlocks, setSkippedBlocks] = useState<BlockType[]>([]);
  const [reflection, setReflection] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EODSubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check IST time for 20:00 threshold
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const isPastEODTime = nowIST.getHours() >= 20;
  const shouldShow = allBlocksDone || isPastEODTime;

  if (!shouldShow) return null;
  
  if (brief.started_today && (brief.blocks_done.length === 6 || brief.eod_submitted)) {
     // If already submitted, show success message
     if (brief.eod_submitted) {
        return (
          <div style={{ padding: '20px', background: '#0d2010', borderRadius: '12px', color: '#22c55e', fontWeight: 600, border: '1px solid #22c55e44' }}>
            ✅ End of day submitted. See you tomorrow.
          </div>
        );
     }
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await acceleratorApi.submitEOD({
        user_id: userId,
        day_number: brief.day_number,
        hardest_block: hardestBlock || null,
        skipped_blocks: skippedBlocks,
        reflection,
      });
      setResult(res);
      onSubmit();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div style={{ padding: '24px', background: '#0d1a2e', borderRadius: '12px', border: '1px solid #3b82f644' }}>
        <div style={{ color: '#3b82f6', fontWeight: 700, fontSize: '18px', marginBottom: '12px' }}>
          Day {brief.day_number} complete. Streak: {result.streak_updated} 🔥
        </div>
        {result.tomorrow_preview && (
          <div style={{ color: '#888', fontSize: '14px', lineHeight: 1.5 }}>
            <span style={{ color: '#ccc', fontWeight: 600 }}>Tomorrow: Day {result.tomorrow_preview.day_number} — {result.tomorrow_preview.title}</span>
            <br />
            <em>"{result.tomorrow_preview.mentor_message_teaser}..."</em>
          </div>
        )}
      </div>
    );
  }

  const unskippedBlocks = BLOCK_ORDER.filter(b => !brief.blocks_done.includes(b));

  return (
    <div style={{ padding: '24px', background: '#141414', borderRadius: '12px', border: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2 style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 700 }}>End of Day {brief.day_number}</h2>

      {/* Q1: Hardest block */}
      <div>
        <label style={{ color: '#ccc', fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          Which block was hardest today?
        </label>
        <select
          value={hardestBlock}
          onChange={e => setHardestBlock(e.target.value as BlockType)}
          style={{ width: '100%', padding: '10px', background: '#222', border: '1px solid #444', borderRadius: '6px', color: '#fff', fontSize: '14px' }}
        >
          <option value="">Select...</option>
          {BLOCK_ORDER.map(b => <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
          <option value="none">None — all fine</option>
        </select>
      </div>

      {/* Q2: Skipped blocks */}
      {unskippedBlocks.length > 0 && (
        <div>
          <label style={{ color: '#ccc', fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            Did you skip any block?
          </label>
          {unskippedBlocks.map(b => (
            <label key={b} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', fontSize: '14px', marginBottom: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={skippedBlocks.includes(b)}
                onChange={e => setSkippedBlocks(prev => e.target.checked ? [...prev, b] : prev.filter(x => x !== b))}
              />
              {b.charAt(0).toUpperCase() + b.slice(1)}
            </label>
          ))}
        </div>
      )}

      {/* Q3: Reflection */}
      <div>
        <label style={{ color: '#ccc', fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          One thing you'll do differently tomorrow:
        </label>
        <textarea
          value={reflection}
          onChange={e => setReflection(e.target.value.slice(0, 300))}
          placeholder="Be specific. Not 'be better' — what exactly will change?"
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '10px',
            background: '#222',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ color: '#555', fontSize: '12px', textAlign: 'right' }}>{reflection.length}/300</div>
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: '14px' }}>{error}</div>}

      <button
        onClick={handleSubmit}
        disabled={submitting || reflection.length < 10}
        style={{
          background: submitting || reflection.length < 10 ? '#333' : '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '12px 24px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: submitting || reflection.length < 10 ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {submitting ? 'Submitting...' : `Submit Day ${brief.day_number}`}
      </button>
    </div>
  );
}
