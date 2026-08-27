import type { DailyBriefResponse, BlockType } from '../../types/schema';
import { BLOCK_ORDER } from '../../types/schema';
import { Zap, CheckCircle, Circle, Lock } from 'lucide-react';

interface DailyBriefPanelProps {
  brief: DailyBriefResponse;
  activeBlock: BlockType | null;
  onStartBlock: (block: BlockType) => void;
}

const PHASE_COLORS: Record<string, string> = {
  foundation: '#3b82f6',
  technical: '#f97316',
  strategy: '#eab308',
  ai_pm: '#ef4444',
  interview: '#22c55e',
  attack: '#a855f7',
};

const BLOCK_LABELS: Record<BlockType, string> = {
  learn: 'Learn',
  voice: 'Voice',
  practice: 'Practice',
  build: 'Build',
  apply: 'Apply',
  network: 'Network',
};

export function DailyBriefPanel({ brief, activeBlock, onStartBlock }: DailyBriefPanelProps) {
  const phaseColor = PHASE_COLORS[brief.phase] ?? '#888';
  const nextBlock = BLOCK_ORDER.find(b => !brief.blocks_done.includes(b)) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Phase + Day tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{
          background: phaseColor + '22',
          color: phaseColor,
          border: `1px solid ${phaseColor}44`,
          borderRadius: '6px',
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {brief.phase_label}
        </span>
        <span style={{ color: '#888', fontSize: '13px' }}>Day {brief.day_number} of 45</span>
      </div>

      {/* Title */}
      <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
        {brief.title}
      </h1>

      {/* Boss Day Banner */}
      {brief.is_boss_day && (
        <div style={{
          background: '#f97316' + '22',
          border: '1px solid #f9731644',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#f97316',
          fontWeight: 600,
        }}>
          <Zap size={16} />
          Boss Day — This one is harder. No shortcuts.
        </div>
      )}

      {/* Mentor Message */}
      <div style={{
        background: '#1a1a2e',
        border: '1px solid #3b82f644',
        borderLeft: '4px solid #3b82f6',
        borderRadius: '8px',
        padding: '16px 20px',
      }}>
        <p style={{
          margin: 0,
          fontStyle: 'italic',
          color: '#c4c4d4',
          lineHeight: 1.7,
          fontSize: '15px',
        }}>
          {brief.mentor_message}
        </p>
      </div>

      {/* Block Pipeline */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {BLOCK_ORDER.map((block) => {
          const isDone = brief.blocks_done.includes(block);
          const isActive = activeBlock === block;
          const isUnlocked = brief.blocks_unlocked.includes(block);
          const isLocked = !isDone && !isUnlocked;

          return (
            <div
              key={block}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: isDone
                  ? '1px solid #22c55e44'
                  : isActive
                    ? `1px solid ${phaseColor}`
                    : isUnlocked
                      ? '1px solid #ffffff33'
                      : '1px solid #333',
                background: isDone
                  ? '#22c55e11'
                  : isActive
                    ? phaseColor + '22'
                    : 'transparent',
                color: isDone ? '#22c55e' : isLocked ? '#555' : '#e8e8e8',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isUnlocked && !isDone ? 'pointer' : 'default',
                opacity: isLocked ? 0.5 : 1,
              }}
              onClick={() => {
                if (isUnlocked && !isDone) onStartBlock(block);
              }}
            >
              {isDone ? <CheckCircle size={14} /> : isLocked ? <Lock size={14} /> : <Circle size={14} />}
              {BLOCK_LABELS[block]}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      {nextBlock && !brief.blocks_done.includes(nextBlock) && (
        <button
          onClick={() => onStartBlock(nextBlock)}
          style={{
            alignSelf: 'flex-start',
            background: phaseColor,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Start {BLOCK_LABELS[nextBlock]} Block →
        </button>
      )}

      {brief.blocks_done.length === 6 && (
        <div style={{ color: '#22c55e', fontWeight: 600, fontSize: '15px' }}>
          ✅ All blocks complete. Submit your end-of-day check below.
        </div>
      )}
    </div>
  );
}
