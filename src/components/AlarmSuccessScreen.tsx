/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { type ReactNode } from 'react';
import { CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

const SUCCESS_SPARKS = [
  { x: 0, y: -62, rotate: 0, color: '#FF6B1A' },
  { x: 44, y: -44, rotate: 45, color: '#A43E00' },
  { x: 62, y: 0, rotate: 90, color: '#6E9F76' },
  { x: 44, y: 44, rotate: 135, color: '#FF944D' },
  { x: 0, y: 62, rotate: 180, color: '#A43E00' },
  { x: -44, y: 44, rotate: 225, color: '#6E9F76' },
  { x: -62, y: 0, rotate: 270, color: '#FF6B1A' },
  { x: -44, y: -44, rotate: 315, color: '#FF944D' },
];

interface AlarmSuccessScreenProps {
  title?: string;
  ariaLabel?: string;
  description?: string;
  action?: ReactNode;
}

export default function AlarmSuccessScreen({
  title = 'Alarm off',
  ariaLabel = title,
  description,
  action,
}: AlarmSuccessScreenProps) {
  return (
    <motion.main
      className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden ambient-glow-bg ging-screen ging-screen--alarm-off font-sans"
      role="status"
      aria-live="assertive"
      aria-label={ariaLabel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
      <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

      <div className="alarm-off-content z-10">
        <img
          src="/gingy-mascot-cutout.webp"
          alt=""
          aria-hidden="true"
          className="alarm-off-mascot"
        />
        <div className="alarm-off-mark">
          <div className="alarm-off-burst" aria-hidden="true">
            {SUCCESS_SPARKS.map((spark, index) => (
              <motion.span
                key={index}
                className="alarm-off-spark"
                style={{ backgroundColor: spark.color }}
                initial={{ opacity: 0, scale: 0.25, x: 0, y: 0, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.25, 1, 0.75],
                  x: spark.x,
                  y: spark.y,
                  rotate: spark.rotate,
                }}
                transition={{ delay: 0.22, duration: 0.68, ease: [0.16, 1, 0.3, 1] }}
                aria-hidden="true"
              />
            ))}
          </div>
          <motion.div
            className="alarm-off-check"
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, type: 'spring', stiffness: 300, damping: 18 }}
            aria-hidden="true"
          >
            <CheckCircle className="w-9 h-9" strokeWidth={1.8} />
          </motion.div>
        </div>
        <motion.h1
          className="alarm-off-title"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {title}
        </motion.h1>
        {description && (
          <motion.p
            className="alarm-off-description"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {description}
          </motion.p>
        )}
        {action && <div className="alarm-off-action">{action}</div>}
      </div>
    </motion.main>
  );
}
