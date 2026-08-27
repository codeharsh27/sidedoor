import { useState, useEffect } from 'react';
import type { VoiceContent } from '../../../types/schema';

interface VoiceBlockProps {
  content: VoiceContent;
  onAnswerChange: (a: string) => void;
  onExtraChange?: (e: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function VoiceBlock({ content, onAnswerChange, onExtraChange, disabled = false }: VoiceBlockProps) {
  const [completed, setCompleted] = useState(false);
  const [insight, setInsight] = useState('');

  useEffect(() => {
    onAnswerChange(insight);
    if (onExtraChange) {
      onExtraChange({ voice_completed: completed });
    }
  }, [insight, completed, onAnswerChange, onExtraChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: '#1c1c2e', border: '1px solid #3b82f644', borderRadius: '8px', padding: '16px 20px' }}>
        <h4 style={{ margin: 0, color: '#3b82f6', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
          Voice Prompt
        </h4>
        <p style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: 500, lineHeight: 1.6 }}>
          "{content.prompt}"
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ margin: 0, color: '#aaa', fontSize: '13px' }}>
          This block is voice-only. Open the PM practice tool below, perform a 20-minute voice session responding to the prompt, and then record any key insights here.
        </p>
        <a
          href={content.tool_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            alignSelf: 'flex-start',
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
          }}
        >
          Open Product Sandbox ↗
        </a>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #2a2a2a', margin: '8px 0' }} />

      {/* Completion Checkbox */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={completed}
          disabled={disabled}
          onChange={(e) => setCompleted(e.target.checked)}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
        />
        I completed my 20-minute voice session on the Sandbox.
      </label>

      {/* Optional Insight Textarea */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
        <label style={{ color: '#ccc', fontSize: '13px', fontWeight: 500 }}>
          One key learning or self-critique from your speech (optional):
        </label>
        <textarea
          value={insight}
          disabled={disabled || !completed}
          onChange={(e) => setInsight(e.target.value)}
          placeholder={completed ? "What did you struggle with? What would make your answer stronger?..." : "Complete the voice session first..."}
          style={{
            width: '100%',
            minHeight: '80px',
            padding: '10px',
            background: '#222',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
            fontFamily: 'sans-serif',
            resize: 'vertical',
            boxSizing: 'border-box',
            opacity: completed ? 1 : 0.5,
          }}
        />
      </div>
    </div>
  );
}
