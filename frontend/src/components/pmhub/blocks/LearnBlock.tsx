import { useState, useEffect } from 'react';
import type { LearnContent } from '../../../types/schema';

interface LearnBlockProps {
  content: LearnContent;
  onAnswerChange: (a: string) => void;
  disabled?: boolean;
}

export function LearnBlock({ content, onAnswerChange, disabled = false }: LearnBlockProps) {
  const [q1Answer, setQ1Answer] = useState('');
  const [q2Answer, setQ2Answer] = useState('');

  useEffect(() => {
    onAnswerChange(JSON.stringify({ q1: q1Answer, q2: q2Answer }));
  }, [q1Answer, q2Answer, onAnswerChange]);

  const pStyle = {
    color: '#ccc',
    fontSize: '14px',
    lineHeight: 1.6,
    marginBottom: '16px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Concept Subtitle */}
      <h3 style={{ margin: 0, color: '#3b82f6', fontSize: '16px', fontWeight: 600 }}>
        Concept: {content.concept}
      </h3>

      {/* Body Text */}
      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '16px 20px', maxHeight: '350px', overflowY: 'auto' }}>
        {content.body.split('\n\n').map((p, i) => (
          <p key={i} style={pStyle}>{p}</p>
        ))}
      </div>

      {/* Resource Link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#888', fontSize: '13px' }}>Reference:</span>
        <a
          href={content.resource_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#3b82f6', fontSize: '14px', fontWeight: 500, textDecoration: 'underline' }}
        >
          {content.resource_label}
        </a>
      </div>

      {/* Quiz Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
        {content.quiz.map((q, idx) => {
          const answer = idx === 0 ? q1Answer : q2Answer;
          const setAnswer = idx === 0 ? setQ1Answer : setQ2Answer;
          const isShort = answer.length < 50;

          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
                Question {idx + 1}: {q.question}
              </label>
              <textarea
                value={answer}
                disabled={disabled}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write your answer here (minimum 50 characters)..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px',
                  background: '#222',
                  border: isShort ? '1px solid #ef4444' : '1px solid #444',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'sans-serif',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: isShort ? '#ef4444' : '#888' }}>
                <span>{isShort ? '⚠️ Min 50 characters required' : '✓ Length requirement met'}</span>
                <span>{answer.length} chars</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
