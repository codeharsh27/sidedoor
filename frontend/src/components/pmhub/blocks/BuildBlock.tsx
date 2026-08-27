import { useState, useEffect } from 'react';
import type { BuildTask } from '../../../types/schema';

interface BuildBlockProps {
  task: BuildTask;
  onAnswerChange: (a: string) => void;
  disabled?: boolean;
}

export function BuildBlock({ task, onAnswerChange, disabled = false }: BuildBlockProps) {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');

  const isUrlRequired = task.output_type === 'url' || task.output_type === 'text_and_url';
  const isTextRequired = task.output_type === 'text' || task.output_type === 'text_and_url';

  const isTextValid = !isTextRequired || text.trim().length >= task.min_chars;
  const isUrlValid = !isUrlRequired || (url.trim().startsWith('http://') || url.trim().startsWith('https://'));
  const isValid = isTextValid && isUrlValid;

  useEffect(() => {
    if (isValid) {
      if (task.output_type === 'text') {
        onAnswerChange(text);
      } else if (task.output_type === 'url') {
        onAnswerChange(url);
      } else {
        onAnswerChange(JSON.stringify({ text, url }));
      }
    } else {
      onAnswerChange('');
    }
  }, [text, url, isValid, task.output_type, onAnswerChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Task Instruction Box */}
      <div style={{ background: '#1c1917', border: '1px solid #f9731644', borderLeft: '4px solid #f97316', borderRadius: '8px', padding: '16px 20px' }}>
        <h4 style={{ margin: 0, color: '#f97316', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
          Build Task
        </h4>
        <p style={{ margin: 0, color: '#f5f5f4', fontSize: '14px', fontWeight: 500, lineHeight: 1.6 }}>
          {task.task}
        </p>
      </div>

      <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>
        Expected Time: {task.duration_min} minutes. Write clean, focused outputs.
      </p>

      {/* URL Input */}
      {isUrlRequired && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
            Output Link / URL (e.g. LinkedIn post, Notion page, Figma, GitHub)
          </label>
          <input
            type="text"
            value={url}
            disabled={disabled}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#222',
              border: isUrlValid ? '1px solid #444' : '1px solid #ef4444',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          {!isUrlValid && <span style={{ color: '#ef4444', fontSize: '11px' }}>⚠️ Please enter a valid URL starting with http:// or https://</span>}
        </div>
      )}

      {/* Text Area */}
      {isTextRequired && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
            Deliverable / Explainer (minimum {task.min_chars} characters)
          </label>
          <textarea
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your build notes, documentation, or response here..."
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '12px',
              background: '#222',
              border: isTextValid ? '1px solid #444' : '1px solid #ef4444',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: 'monospace',
              lineHeight: 1.5,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: isTextValid ? '#888' : '#ef4444' }}>
            <span>{isTextValid ? '✓ Minimum length requirement met' : `⚠️ Min ${task.min_chars} characters required`}</span>
            <span>{text.length} chars</span>
          </div>
        </div>
      )}
    </div>
  );
}
