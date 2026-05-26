/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Bell, Flame, ChevronRight } from 'lucide-react';
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
    <div className="relative min-h-screen flex flex-col items-center justify-between bg-zinc-50 text-black overflow-hidden p-6 select-none font-sans">
      {/* Decorative backdrop elements */}
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-orange-500/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full bg-gradient-to-tl from-red-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Android Status Bar Accent */}
      <div className="w-full flex justify-between items-center text-xs font-mono text-zinc-600 max-w-md pt-2 border-b-2 border-black pb-2">
        <span className="font-bold">GING WAKE ENGINE v1.0.4</span>
        <div className="flex items-center gap-1.5">
          <span className="bg-black text-white px-2 py-0.5 rounded text-[10px] font-bold">READY</span>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse border border-black" />
        </div>
      </div>

      {/* Main Brand Logo - Custom hand-crafted designer vector */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center justify-center"
        >
          {/* Framed Vector Logo Container */}
          <div className="relative p-6 bg-white border-4 border-black rounded-[48px] polish-shadow-lg flex items-center justify-center mb-4 bg-radial from-white via-orange-50/20 to-orange-100/10">
            <GingLogo size={180} />
          </div>

          <motion.h1
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="font-sans font-black text-4xl text-black tracking-widest uppercase select-none flex items-center gap-2 mb-1"
          >
            Ging
          </motion.h1>

          <div className="flex items-center gap-1.5 px-3.5 py-1 bg-black rounded-full border border-black text-white">
            <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400 animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest font-mono font-black text-white">
              ANTI-SLEEP CORE
            </span>
          </div>
        </motion.div>

        {/* Tagline instructions */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-8 text-center max-w-sm"
        >
          <p className="text-zinc-700 font-sans text-sm tracking-wide leading-relaxed font-medium">
            Named after the Filipino <span className="text-orange-600 font-extrabold underline decoration-2">gising</span> (wake up).
            The ruthless alarm that literally won't stop ringing unless you stand up and scan your bathroom QR code.
          </p>
        </motion.div>
      </div>

      {/* Bottom control / skip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.5 }}
        className="w-full max-w-md flex flex-col gap-4 items-center mb-6"
      >
        <button
          onClick={onContinue}
          className="group w-full py-4 rounded-2xl bg-black hover:bg-orange-600 text-white font-sans font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 cursor-pointer transition-all border-2 border-black polish-shadow active:translate-y-1 active:shadow-none"
        >
          <span>Get Started</span>
          <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="flex items-center gap-1.5 text-zinc-900 text-xs font-mono font-black uppercase tracking-widest bg-zinc-200 px-3 py-1 rounded border border-black">
          <Bell className="w-3.5 h-3.5 animate-bounce text-orange-600" />
          <span>No Snooze. No Escape.</span>
        </div>
      </motion.div>
    </div>
  );
}
