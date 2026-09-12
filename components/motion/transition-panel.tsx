'use client';

// Adapted from Motion Primitives (MIT, Copyright 2024 ibelick).
// Upstream: components/core/transition-panel.tsx. See THIRD_PARTY_NOTICES.md.
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function TransitionPanel({
  children,
  activeKey,
}: {
  children: ReactNode;
  activeKey: string;
}) {
  const reduced = useReducedMotion();
  return (
    // Entry only: old forms and account data leave the DOM immediately.
    <motion.div
      key={activeKey}
      initial={reduced === false ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
