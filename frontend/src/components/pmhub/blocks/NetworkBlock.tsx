import { useState, useEffect } from 'react';
import type { NetworkActionSpec } from '../../../types/schema';
import { MessageSquare, Share2, UserPlus, Globe, Users } from 'lucide-react';

interface NetworkBlockProps {
  actions: NetworkActionSpec[];
  onAnswerChange: (a: string) => void;
  onExtraChange?: (e: Record<string, unknown>) => void;
  disabled?: boolean;
  onSubmit?: () => void;
}

export function NetworkBlock({ actions, onAnswerChange, onExtraChange, disabled = false, onSubmit }: NetworkBlockProps) {
  const [checkedList, setCheckedList] = useState<boolean[]>(Array(actions.length).fill(false));

  const checkedIndices = checkedList
    .map((checked, idx) => (checked ? actions[idx].index : -1))
    .filter(idx => idx !== -1);

  const completedCount = checkedIndices.length;
  const isBlockValid = completedCount >= 4;

  useEffect(() => {
    if (isBlockValid) {
      onAnswerChange('completed');
      if (onExtraChange) {
        onExtraChange({ network_actions_completed: checkedIndices });
      }
    } else {
      onAnswerChange('');
    }
  }, [checkedList, isBlockValid, onAnswerChange, onExtraChange]);

  const handleCheckChange = (index: number, checked: boolean) => {
    setCheckedList(prev => {
      const nextList = [...prev];
      nextList[index] = checked;
      return nextList;
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return <MessageSquare size={16} color="#3b82f6" />;
      case 'dm_existing':
        return <Users size={16} color="#eab308" />;
      case 'new_connect':
        return <UserPlus size={16} color="#22c55e" />;
      case 'post':
        return <Share2 size={16} color="#ec4899" />;
      default:
        return <Globe size={16} color="#888" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
          Daily Networking Pipeline
        </h3>
        <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '13px' }}>
          PM hiring in 2026 runs on warm references. Complete at least 4 of the following tasks today to keep your network active.
        </p>
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {actions.map((act, idx) => {
          const isChecked = checkedList[idx];

          return (
            <div
              key={act.index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px 16px',
                background: '#141414',
                border: isChecked ? '1px solid #22c55e44' : '1px solid #2a2a2a',
                borderRadius: '8px',
                opacity: disabled ? 0.6 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'border 0.2s ease',
              }}
              onClick={() => {
                if (!disabled) handleCheckChange(idx, !isChecked);
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={disabled}
                onChange={() => {}} // Click is handled by parent div
                style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px' }}
              />

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                {getIcon(act.type)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <span style={{
                  color: isChecked ? '#ccc' : '#fff',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  textDecoration: isChecked ? 'line-through' : 'none',
                }}>
                  {act.instruction}
                </span>
                <span style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', fontWeight: 600 }}>
                  Type: {act.type.replace('_', ' ')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
        <span style={{ color: '#888', fontSize: '13px' }}>
          Completed: {completedCount}/5 actions (4 minimum)
        </span>
        {isBlockValid && (
          <button
            onClick={onSubmit}
            disabled={disabled}
            style={{
              background: '#22c55e',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Submit Network Block
          </button>
        )}
      </div>
    </div>
  );
}
