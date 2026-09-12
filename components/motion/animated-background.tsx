'use client';

// Adapted from Motion Primitives (MIT, Copyright 2024 ibelick).
// Upstream: components/core/animated-background.tsx. See THIRD_PARTY_NOTICES.md.
import { Children, cloneElement, useId, type HTMLAttributes, type ReactElement } from 'react';
import { motion, useReducedMotion } from 'motion/react';

type Item = ReactElement<HTMLAttributes<HTMLButtonElement> & { 'data-id': string }>;

/** Controlled decoration: the original button keeps its events and semantics. */
export function AnimatedBackground({ children, value }: { children: Item[]; value: string }) {
  const id = useId();
  const reduced = useReducedMotion();
  return Children.map(children, (child) =>
    cloneElement(
      child,
      { className: `${child.props.className || ''} animated-background-item` },
      <>
        {child.props['data-id'] === value && (
          <motion.span
            aria-hidden="true"
            className="nav-highlight"
            layoutId={reduced ? undefined : `navigation-${id}`}
            initial={false}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          />
        )}
        {child.props.children}
      </>,
    ),
  );
}
