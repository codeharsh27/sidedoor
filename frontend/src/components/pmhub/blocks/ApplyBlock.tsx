import { useState, useEffect } from 'react';
import type { CompanyFeedResponse, PMCompanyFeedItem } from '../../../types/schema';
import { acceleratorApi } from '../../../api/client';
import { AcceleratorSkeleton } from '../shared/AcceleratorSkeleton';
import { AcceleratorError } from '../shared/AcceleratorError';

interface ApplyBlockProps {
  userId: string;
  onAnswerChange: (a: string) => void;
  onExtraChange?: (e: Record<string, unknown>) => void;
  disabled?: boolean;
  onSubmit?: () => void;
}

const FEED_TYPE_COLORS: Record<string, { bg: string, text: string }> = {
  active_listing: { bg: '#22c55e22', text: '#22c55e' },
  cold_target: { bg: '#3b82f622', text: '#3b82f6' },
  community_lead: { bg: '#f9731622', text: '#f97316' },
  stretch: { bg: '#a855f722', text: '#a855f7' },
};

export function ApplyBlock({ userId, onAnswerChange, onExtraChange, disabled = false, onSubmit }: ApplyBlockProps) {
  const [feed, setFeed] = useState<CompanyFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionedMap, setActionedMap] = useState<Record<string, 'applied' | 'skipped'>>({});

  useEffect(() => {
    acceleratorApi.getCompaniesToday(userId)
      .then(setFeed)
      .catch(e => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [userId]);

  const actionedCount = Object.keys(actionedMap).length;
  const appliedIds = Object.entries(actionedMap)
    .filter(([_, status]) => status === 'applied')
    .map(([id, _]) => id);

  // Sync with parent
  useEffect(() => {
    if (actionedCount >= 3) {
      onAnswerChange('completed');
      if (onExtraChange) {
        onExtraChange({ companies_logged: appliedIds });
      }
    } else {
      onAnswerChange('');
    }
  }, [actionedMap, actionedCount, appliedIds, onAnswerChange, onExtraChange]);

  const handleApply = (item: PMCompanyFeedItem) => {
    if (disabled) return;
    if (item.apply_url) {
      window.open(item.apply_url, '_blank', 'noopener,noreferrer');
    }
    setActionedMap(prev => ({ ...prev, [item.id]: 'applied' }));
  };

  const handleSkip = (id: string) => {
    if (disabled) return;
    setActionedMap(prev => ({ ...prev, [id]: 'skipped' }));
  };

  if (loading) return <AcceleratorSkeleton lines={6} />;
  if (error) return <AcceleratorError message={error} />;
  if (!feed || feed.companies.length === 0) {
    return <div style={{ color: '#888' }}>No target companies available today.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 600 }}>
          Today's Curated Job Opportunities
        </h3>
        <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '13px' }}>
          We sourced 5 target companies matching your Indian startup & remote preferences. You must review and either apply or skip at least 3 companies to complete this block.
        </p>
      </div>

      {/* Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {feed.companies.map((item) => {
          const status = actionedMap[item.id];
          const colors = FEED_TYPE_COLORS[item.feed_type] || { bg: '#333', text: '#888' };

          return (
            <div
              key={item.id}
              style={{
                background: '#141414',
                border: status === 'applied'
                  ? '1px solid #22c55e44'
                  : status === 'skipped'
                    ? '1px solid #444'
                    : '1px solid #2a2a2a',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: status === 'skipped' ? 0.4 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {/* Left Column: Job Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h4 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 700 }}>
                    {item.company_name}
                  </h4>
                  {item.vc_name && (
                    <span style={{ fontSize: '11px', color: '#f59e0b', background: '#f59e0b11', padding: '2px 6px', borderRadius: '4px', border: '1px solid #f59e0b33' }}>
                      {item.vc_name}
                    </span>
                  )}
                </div>

                <span style={{ color: '#ccc', fontSize: '14px', fontWeight: 500 }}>
                  {item.role_title}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: colors.text,
                    background: colors.bg,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}>
                    {item.feed_type.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '11px', color: '#666' }}>
                    Source: {item.source} • {item.india_remote.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {status ? (
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: status === 'applied' ? '#22c55e' : '#888',
                  }}>
                    {status === 'applied' ? '✓ Applied' : 'Skipped'}
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleSkip(item.id)}
                      disabled={disabled}
                      style={{
                        background: 'transparent',
                        border: '1px solid #333',
                        color: '#aaa',
                        borderRadius: '6px',
                        padding: '8px 14px',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => handleApply(item)}
                      disabled={disabled}
                      style={{
                        background: '#3b82f6',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      Apply Now →
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
        <span style={{ color: '#888', fontSize: '13px' }}>
          Progress: {actionedCount}/5 actioned (3 minimum)
        </span>
        {actionedCount >= 3 && (
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
            Submit Apply Block
          </button>
        )}
      </div>
    </div>
  );
}
