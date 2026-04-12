type PingPongLoadingBarProps = {
  className?: string;
  durationMs?: number;
};

export function PingPongLoadingBar({ className = '', durationMs = 1400 }: PingPongLoadingBarProps) {
  return (
    <div
      className={`loader-pingpong-track ${className}`.trim()}
      style={{
        position: 'relative',
        width: '100%',
        height: '4px',
        overflow: 'hidden',
        borderRadius: '999px',
        background: 'rgba(148, 163, 184, 0.35)',
        boxShadow: 'inset 0 0 0 1px rgba(148, 163, 184, 0.26)',
      }}
    >
      <span
        className="loader-pingpong-line"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '36%',
          borderRadius: '999px',
          background: 'linear-gradient(90deg, #f59e0b, #fb923c)',
          boxShadow: '0 0 14px rgba(251, 146, 60, 0.72)',
          animation: `pingPongLoader ${durationMs}ms ease-in-out infinite alternate`,
          zIndex: 1,
        }}
        aria-hidden="true"
      />
    </div>
  );
}
