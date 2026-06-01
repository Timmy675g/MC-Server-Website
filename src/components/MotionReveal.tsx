import { type CSSProperties, type ReactNode } from 'react';

type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function MotionReveal({ children, className, delay = 0 }: MotionRevealProps) {
  const style = { '--motion-delay': `${delay}s` } as CSSProperties;

  return (
    <div className={className ? `${className} motion-reveal` : 'motion-reveal'} style={style}>
      {children}
    </div>
  );
}
