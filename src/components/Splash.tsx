/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import GingLogo from './GingLogo';

interface SplashProps {
  onContinue: () => void;
}

export default function Splash({ onContinue }: SplashProps) {
  useEffect(() => {
    // Automatically proceed after 3.8 seconds if user doesn't press skip
    const timer = setTimeout(() => {
      onContinue();
    }, 3800);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between ambient-glow-bg text-white overflow-hidden p-6 select-none font-sans">
      {/* Faint ambient haze for depth */}
      <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
      <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

      {/* Spacer */}
      <div className="w-full max-w-md" />

      {/* Hero — no image, centered iOS-launch style */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 w-full max-w-md px-2 text-center">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <GingLogo size={88} />
        </motion.div>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-zinc-400 font-sans text-[15px] leading-relaxed max-w-xs mt-4"
        >
          An alarm that only turns off when you physically walk to your QR code.
        </motion.p>
      </div>

      {/* Get started */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="w-full max-w-md flex flex-col items-center mb-8 z-10"
      >
        <button
          onClick={onContinue}
          className="group w-full py-4 rounded-2xl glass-button-glow font-sans font-semibold text-[15px] flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <span>Get Started</span>
          <ChevronRight className="w-4 h-4 text-white transition-transform group-hover:translate-x-0.5" />
        </button>
      </motion.div>
    </div>
  );
}
