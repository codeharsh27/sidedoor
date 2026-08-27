
interface AcceleratorErrorProps {
  message: string;
  onRetry?: () => void;
}

export function AcceleratorError({ message, onRetry }: AcceleratorErrorProps) {
  return (
    <div style={{
      background: '#ef444411',
      border: '1px solid #ef444444',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
    }}>
      <span style={{ color: '#ef4444', fontSize: '14px' }}>⚠ {message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px' }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}
