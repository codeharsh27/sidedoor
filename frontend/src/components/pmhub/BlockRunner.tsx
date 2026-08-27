import { useState, useEffect, useRef, useCallback } from 'react';
import type { DailyBriefResponse, BlockType, BlockStartResponse } from '../../types/schema';
import { BLOCK_ORDER } from '../../types/schema';
import { acceleratorApi } from '../../api/client';
import { LearnBlock } from './blocks/LearnBlock';
import { VoiceBlock } from './blocks/VoiceBlock';
import { PracticeBlock } from './blocks/PracticeBlock';
import { BuildBlock } from './blocks/BuildBlock';
import { ApplyBlock } from './blocks/ApplyBlock';
import { NetworkBlock } from './blocks/NetworkBlock';
import { AcceleratorError } from './shared/AcceleratorError';

type RunnerPhase =
  | { type: 'idle' }
  | { type: 'starting'; block: BlockType }
  | { type: 'active'; block: BlockType; logId: string; startedAt: Date; timeLimitSec: number }
  | { type: 'submitting'; block: BlockType }
  | { type: 'done'; block: BlockType; feedback: string }
  | { type: 'transition'; message: string; nextBlock: BlockType | null }
  | { type: 'all_done' };

const TRANSITION_MESSAGES: Record<BlockType, string> = {
  learn: "Learn block done. 5 minutes before voice practice. Don't open a new tab.",
  voice: 'Voice session logged. Written practice starts now.',
  practice: 'Practice block done. Build block is next — this is where output matters.',
  build: 'Build block done. You made something. Apply block is next.',
  apply: 'Applications logged. Last block — 45 minutes for network. Finish strong.',
  network: 'All blocks done. Submit your end-of-day check below.',
};

interface BlockRunnerProps {
  brief: DailyBriefResponse;
  userId: string;
  onBlockComplete: (blockType: BlockType) => void;
  onAllBlocksDone: () => void;
  onActiveBlockChange: (block: BlockType | null) => void;
}

export function BlockRunner({
  brief,
  userId,
  onBlockComplete,
  onAllBlocksDone,
  onActiveBlockChange,
}: BlockRunnerProps) {
  const [phase, setPhase] = useState<RunnerPhase>({ type: 'idle' });
  const [answer, setAnswer] = useState<string>('');
  const [extra, setExtra] = useState<Record<string, any>>({});
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const nextPendingBlock = BLOCK_ORDER.find(b => !brief.blocks_done.includes(b)) ?? null;

  useEffect(() => {
    if (phase.type === 'active') {
      onActiveBlockChange(phase.block);
    } else {
      onActiveBlockChange(null);
    }
  }, [phase, onActiveBlockChange]);

  useEffect(() => {
    if (phase.type !== 'active') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const startedAt = phase.startedAt;
    timerRef.current = setInterval(() => {
      const nowElapsed = (Date.now() - startedAt.getTime()) / 1000;
      setElapsed(nowElapsed);
      if (nowElapsed >= phase.timeLimitSec) {
        clearInterval(timerRef.current!);
        handleSubmit(true);
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase.type === 'active' ? phase.block : null]);

  const handleStartBlock = useCallback(async (blockType: BlockType) => {
    if (phase.type === 'starting' || phase.type === 'active' || phase.type === 'submitting') return;
    setError(null);
    setAnswer('');
    setExtra({});
    setElapsed(0);
    setPhase({ type: 'starting', block: blockType });
    try {
      const res: BlockStartResponse = await acceleratorApi.startBlock({
        user_id: userId,
        day_number: brief.day_number,
        block_type: blockType,
      });
      setPhase({
        type: 'active',
        block: blockType,
        logId: res.block_log_id,
        startedAt: new Date(res.started_at),
        timeLimitSec: res.time_limit_sec,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start block.');
      setPhase({ type: 'idle' });
    }
  }, [phase.type, userId, brief.day_number]);

  const handleSubmit = useCallback(async (_autoSubmit = false) => {
    if (phase.type !== 'active') return;
    const activePhase = phase;
    setPhase({ type: 'submitting', block: activePhase.block });
    try {
      const res = await acceleratorApi.completeBlock({
        user_id: userId,
        block_log_id: activePhase.logId,
        day_number: brief.day_number,
        block_type: activePhase.block,
        answer_text: answer,
        ...extra,
        voice_completed: activePhase.block === 'voice' ? true : undefined,
      });
      
      setPhase({ type: 'done', block: activePhase.block, feedback: res.rubric_feedback });
      onBlockComplete(activePhase.block);
      
      if (res.all_blocks_done) {
        onAllBlocksDone();
        setTimeout(() => {
          setPhase({ type: 'transition', message: TRANSITION_MESSAGES[activePhase.block], nextBlock: null });
          setTimeout(() => setPhase({ type: 'all_done' }), 4000);
        }, 3000);
      } else {
        setTimeout(() => {
          const nextBlock = res.next_block_unlocked;
          setPhase({ type: 'transition', message: TRANSITION_MESSAGES[activePhase.block], nextBlock });
          setTimeout(() => setPhase({ type: 'idle' }), 4000);
        }, 3000);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit block.');
      setPhase(activePhase);
    }
  }, [phase, userId, brief.day_number, answer, extra, onBlockComplete, onAllBlocksDone]);

  const renderTimer = () => {
    if (phase.type !== 'active') return null;
    const remaining = Math.max(0, phase.timeLimitSec - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    const color = remaining > 300 ? '#e8e8e8' : remaining > 60 ? '#f59e0b' : '#ef4444';
    const isUrgent = remaining <= 60;
    return (
      <div style={{
        fontSize: '24px',
        fontWeight: 700,
        color,
        fontFamily: 'monospace',
        animation: isUrgent ? 'pulse 1s infinite' : 'none',
      }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      </div>
    );
  };

  if (phase.type === 'idle') {
    if (!nextPendingBlock || brief.blocks_done.length === 6) return null;
    return (
      <div style={{ textAlign: 'center', padding: '32px' }}>
        <button
          onClick={() => handleStartBlock(nextPendingBlock)}
          style={{
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '14px 32px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Start {nextPendingBlock.charAt(0).toUpperCase() + nextPendingBlock.slice(1)} Block
        </button>
        {error && <AcceleratorError message={error} />}
      </div>
    );
  }

  if (phase.type === 'starting') {
    return <div style={{ color: '#888', padding: '24px' }}>Starting {phase.block} block...</div>;
  }

  if (phase.type === 'transition') {
    return (
      <div style={{
        padding: '24px',
        background: '#141414',
        borderRadius: '12px',
        textAlign: 'center',
        color: '#a8a8a8',
        fontSize: '15px',
        lineHeight: 1.6,
      }}>
        {phase.message}
      </div>
    );
  }

  if (phase.type === 'all_done') return null;

  if (phase.type === 'done') {
    return (
      <div style={{ padding: '20px', background: '#0d2010', borderRadius: '12px', border: '1px solid #22c55e44' }}>
        <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: '12px' }}>✅ Block submitted</div>
        {phase.feedback && (
          <pre style={{ color: '#a8c4a8', fontSize: '13px', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'sans-serif' }}>
            {phase.feedback}
          </pre>
        )}
      </div>
    );
  }

  const activeBlock = phase.type === 'active' ? phase.block : (phase as any).block;
  const isSubmitting = phase.type === 'submitting';
  const timeLimitSec = phase.type === 'active' ? phase.timeLimitSec : 0;
  const remaining = phase.type === 'active' ? Math.max(0, timeLimitSec - elapsed) : 0;

  const blockProps = {
    onAnswerChange: setAnswer,
    onExtraChange: setExtra,
    autoSubmitting: phase.type === 'active' && remaining === 0,
    disabled: isSubmitting,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Timer + Block Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
          {activeBlock.charAt(0).toUpperCase() + activeBlock.slice(1)} Block
        </h2>
        {renderTimer()}
      </div>

      {/* Block Component */}
      {activeBlock === 'learn' && <LearnBlock content={brief.learn} {...blockProps} />}
      {activeBlock === 'voice' && <VoiceBlock content={brief.voice} {...blockProps} />}
      {activeBlock === 'practice' && <PracticeBlock questions={brief.practice} {...blockProps} />}
      {activeBlock === 'build' && <BuildBlock task={brief.build} {...blockProps} />}
      {activeBlock === 'apply' && <ApplyBlock userId={userId} onSubmit={() => handleSubmit(false)} {...blockProps} />}
      {activeBlock === 'network' && <NetworkBlock actions={brief.network.actions} onSubmit={() => handleSubmit(false)} {...blockProps} />}

      {/* Submit Button (Only for non-apply/network since they render their own conditional submits) */}
      {activeBlock !== 'apply' && activeBlock !== 'network' && (
        <button
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting || !answer}
          style={{
            alignSelf: 'flex-start',
            background: isSubmitting || !answer ? '#333' : '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: isSubmitting || !answer ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? 'Submitting...' : `Submit ${activeBlock.charAt(0).toUpperCase() + activeBlock.slice(1)} Block`}
        </button>
      )}

      {error && <AcceleratorError message={error} />}
    </div>
  );
}
