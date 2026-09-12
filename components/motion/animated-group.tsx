'use client';

// Adapted from Motion Primitives (MIT, Copyright 2024 ibelick).
// Upstream: components/core/animated-group.tsx. See THIRD_PARTY_NOTICES.md.
import { Children, isValidElement, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Preserve child keys, and cap the stagger so a long list never delays navigation. */
export function AnimatedGroup({
  children,
  className,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const animate = !disabled && reduced === false;
  return (
    <div className={className}>
      {Children.toArray(children).map((child, index) => (
        <motion.div
          key={isValidElement(child) ? child.key : index}
          initial={animate ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: animate ? 0.24 : 0,
            delay: animate ? Math.min(index, 6) * 0.04 : 0,
            ease: 'easeOut',
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
