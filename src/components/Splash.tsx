/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';

interface SplashProps {
  onContinue: () => void;
}

export default function Splash({ onContinue }: SplashProps) {
  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-between ambient-glow-bg ging-screen ging-screen--splash text-white overflow-hidden p-6 select-none font-sans">
      {/* Faint ambient haze for depth */}
      <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
      <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

      {/* Spacer */}
      <div className="w-full max-w-md splash-spacer" />

      {/* Mascot-led hero */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 w-full max-w-md px-2 text-center splash-hero">
        <img className="splash-mascot" src="/gingy-mascot-cutout.webp" alt="" aria-hidden="true" />

        <motion.p
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="text-zinc-400 font-sans text-[15px] leading-relaxed max-w-xs mt-4"
        >
          An alarm that only turns off when you physically walk to your QR code.
        </motion.p>
      </div>

      {/* Get started */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md flex flex-col items-center mb-8 z-10 splash-actions"
      >
        <button
          onClick={onContinue}
          className="group w-full py-4 rounded-2xl glass-button-glow font-sans font-semibold text-[15px] flex items-center justify-center gap-2 cursor-pointer transition-transform splash-cta"
        >
          <span>Get Started</span>
          <ChevronRight className="w-4 h-4 text-white transition-transform splash-cta-icon" />
        </button>
      </motion.div>
    </div>
  );
}
