import { useState, useEffect } from 'react';
import type { PracticeQuestion } from '../../../types/schema';

interface PracticeBlockProps {
  questions: PracticeQuestion[];
  onAnswerChange: (a: string) => void;
  disabled?: boolean;
}

const BADGE_COLORS: Record<string, { bg: string, text: string }> = {
  product_sense: { bg: '#3b82f622', text: '#3b82f6' },
  estimation: { bg: '#eab30822', text: '#eab308' },
  behavioral: { bg: '#22c55e22', text: '#22c55e' },
  analytical: { bg: '#ec489922', text: '#ec4899' },
  strategy: { bg: '#a855f722', text: '#a855f7' },
  technical: { bg: '#f9731622', text: '#f97316' },
};

export function PracticeBlock({ questions, onAnswerChange, disabled = false }: PracticeBlockProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(questions.length).fill(''));
  const [showFeedback, setShowFeedback] = useState<boolean[]>(Array(questions.length).fill(false));
  const [checkedKeywords, setCheckedKeywords] = useState<boolean[][]>(
    questions.map(q => Array(q.rubric_must_have.length).fill(false))
  );

  const currentQuestion = questions[currentIdx];
  const currentAnswer = answers[currentIdx];
  const isAnswerValid = currentAnswer.trim().length >= 100;

  // Propagate answers to parent once all steps are completed
  useEffect(() => {
    const allDone = answers.every(a => a.trim().length >= 100) && showFeedback.every(f => f);
    if (allDone) {
      const formatted = questions.map((q, idx) => ({
        question: q.question,
        type: q.type,
        answer: answers[idx],
        checklist_verified: checkedKeywords[idx]
      }));
      onAnswerChange(JSON.stringify(formatted));
    } else {
      onAnswerChange(''); // Invalidate until all are done and read
    }
  }, [answers, showFeedback, checkedKeywords, questions, onAnswerChange]);

  const handleTextChange = (text: string) => {
    setAnswers(prev => {
      const newAns = [...prev];
      newAns[currentIdx] = text;
      return newAns;
    });
  };

  const handleNext = () => {
    if (!showFeedback[currentIdx]) {
      // Show rubric checklist first
      setShowFeedback(prev => {
        const nextFeed = [...prev];
        nextFeed[currentIdx] = true;
        return nextFeed;
      });
    } else {
      // Go to next question
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1);
      }
    }
  };

  const handleKeywordCheck = (kwIdx: number, checked: boolean) => {
    setCheckedKeywords(prev => {
      const nextChecked = prev.map(arr => [...arr]);
      nextChecked[currentIdx][kwIdx] = checked;
      return nextChecked;
    });
  };

  const badge = BADGE_COLORS[currentQuestion.type] || { bg: '#4442', text: '#888' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Progress header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#888' }}>
        <span>Question {currentIdx + 1} of {questions.length}</span>
        <span style={{
          background: badge.bg,
          color: badge.text,
          padding: '4px 10px',
          borderRadius: '5px',
          fontWeight: 600,
          textTransform: 'uppercase',
          fontSize: '11px',
          letterSpacing: '0.04em',
        }}>
          {currentQuestion.type.replace('_', ' ')}
        </span>
      </div>

      {/* Question Text */}
      <div style={{ background: '#141414', borderLeft: `4px solid ${badge.text}`, borderRadius: '6px', padding: '16px 20px' }}>
        <p style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: 500, lineHeight: 1.6 }}>
          {currentQuestion.question}
        </p>
      </div>

      {/* Text Area */}
      {!showFeedback[currentIdx] ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            value={currentAnswer}
            disabled={disabled}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Write your detailed answer here (minimum 100 characters)..."
            style={{
              width: '100%',
              minHeight: '140px',
              padding: '12px',
              background: '#222',
              border: isAnswerValid ? '1px solid #444' : '1px solid #ef4444',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontFamily: 'sans-serif',
              lineHeight: 1.5,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: isAnswerValid ? '#888' : '#ef4444' }}>
            <span>{isAnswerValid ? '✓ Answer length requirement met' : '⚠️ Minimum 100 characters required'}</span>
            <span>{currentAnswer.length} chars</span>
          </div>
        </div>
      ) : (
        /* Rubric Feedback Section */
        <div style={{ background: '#1c1c2e22', border: '1px solid #3b82f622', borderRadius: '8px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h4 style={{ margin: 0, color: '#3b82f6', fontSize: '14px', fontWeight: 600 }}>
            Self-Evaluation: Did you address these must-have elements?
          </h4>
          <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>
            Check the concepts you included in your answer. Be honest — this trains your interview self-critique muscle.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {currentQuestion.rubric_must_have.map((kw, kwIdx) => (
              <label key={kwIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checkedKeywords[currentIdx][kwIdx]}
                  disabled={disabled}
                  onChange={(e) => handleKeywordCheck(kwIdx, e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                {kw}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Button controls */}
      <button
        onClick={handleNext}
        disabled={!isAnswerValid || disabled}
        style={{
          alignSelf: 'flex-start',
          background: !isAnswerValid || disabled ? '#333' : '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '12px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: !isAnswerValid || disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {!showFeedback[currentIdx]
          ? 'Show Checklist Evaluation'
          : currentIdx < questions.length - 1
            ? 'Next Question →'
            : 'Prepare Final Submission ✓'}
      </button>
    </div>
  );
}
