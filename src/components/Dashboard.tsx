/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, BellOff, Play, Square, QrCode, X, Minus
} from 'lucide-react';
import { Alarm } from '../types';
import { gingAudio } from '../utils/audio';
import TimeWheelPicker from './TimeWheelPicker';

const formatTo12Hour = (time24: string) => {
  if (!time24) return '';
  const parts = time24.split(':');
  if (parts.length !== 2) return time24;
  const [hoursStr, minutesStr] = parts;
  let hours = parseInt(hoursStr, 10);
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? 'AM' : 'PM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutesStr} ${ampm}`;
};

// Split "HH:MM 24h" into a big time and a small AM/PM for the iOS clock look.
const splitTime = (time24: string): { time: string; suffix: string } => {
  const f = formatTo12Hour(time24);
  if (!f) return { time: '', suffix: '' };
  const idx = f.lastIndexOf(' ');
  if (idx === -1) return { time: f, suffix: '' };
  return { time: f.slice(0, idx), suffix: f.slice(idx + 1) };
};

const SOUND_LABELS: { key: Alarm['soundType']; label: string }[] = [
  { key: 'industrial', label: 'Industrial' },
  { key: 'classic-beep', label: 'Beep' },
  { key: 'air-horn', label: 'Air Horn' },
];

const soundLabel = (key: Alarm['soundType']) =>
  SOUND_LABELS.find(s => s.key === key)?.label ?? key;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// iOS-style repeat summary shown under each alarm label
const repeatSummary = (days: number[]): string => {
  if (days.length === 0) return 'Never';
  if (days.length === 7) return 'Every day';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join(',') === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join(',') === '0,6') return 'Weekends';
  return 'Every ' + sorted.map(d => DAY_NAMES[d]).join(', ');
};

interface DashboardProps {
  alarms: Alarm[];
  userQRSecret: string;
  onAddAlarm: (alarm: Omit<Alarm, 'id'>) => void;
  onToggleAlarm: (id: string) => void;
  onDeleteAlarm: (id: string) => void;
  onNavigateToQR: () => void;
}

export default function Dashboard({
  alarms,
  userQRSecret,
  onAddAlarm,
  onToggleAlarm,
  onDeleteAlarm,
  onNavigateToQR,
}: DashboardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newTime, setNewTime] = useState('06:00');
  const [newLabel, setNewLabel] = useState('Mornings in the Shower');
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]); // weekdays by default
  const [newSoundType, setNewSoundType] = useState<Alarm['soundType']>('industrial');
  const [newVolume, setNewVolume] = useState(0.8);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const previewTimerRef = useRef<number | null>(null);

  // Sound preview handler — plays 1.5s sample then auto-stops
  const handlePreviewSound = useCallback((soundKey: string) => {
    // If already previewing this sound, stop it
    if (previewPlaying === soundKey) {
      gingAudio.stop();
      setPreviewPlaying(null);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      return;
    }
    // Stop any prior preview
    gingAudio.stop();
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);

    setPreviewPlaying(soundKey);
    gingAudio.start(soundKey, 0.35); // lower volume for preview

    previewTimerRef.current = window.setTimeout(() => {
      gingAudio.stop();
      setPreviewPlaying(null);
    }, 1500);
  }, [previewPlaying]);

  const closeSheet = () => {
    // Stop any preview sound before closing the add sheet
    gingAudio.stop();
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    setPreviewPlaying(null);
    setShowAddForm(false);
  };

  const handleToggleDay = (dayIndex: number) => {
    if (newDays.includes(dayIndex)) {
      setNewDays(newDays.filter(d => d !== dayIndex));
    } else {
      setNewDays([...newDays, dayIndex].sort());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddAlarm({
      time: newTime,
      label: newLabel || 'Wake Up Challenge',
      active: true,
      days: newDays,
      volume: newVolume,
      soundType: newSoundType,
      qrSecret: userQRSecret,
    });
    closeSheet();
    // Reset fields to helpful standards
    setNewTime('06:00');
    setNewLabel('Mornings in the Shower');
  };

  const daysLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="relative min-h-screen ambient-glow-bg text-white flex flex-col overflow-x-hidden font-sans">
      {/* Faint ambient haze */}
      <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
      <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

      {/* Header — iOS Alarm tab layout */}
      <div className="sticky top-0 z-20 max-w-md w-full mx-auto flex items-center justify-between px-6 pt-5 pb-3 bg-gradient-to-b from-black via-black/80 to-transparent">
        <button
          onClick={() => setEditing(e => !e)}
          className="text-[15px] font-medium text-[#FF8A42] min-w-[44px] text-left"
        >
          {editing ? 'Done' : 'Edit'}
        </button>
        <h1 className="text-[28px] font-bold text-white tracking-tight">Alarms</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="min-w-[44px] flex justify-end"
          aria-label="Add alarm"
        >
          <Plus className="w-7 h-7 text-[#FF8A42]" />
        </button>
      </div>

      {/* Alarm list */}
      <div className="flex-1 max-w-md w-full mx-auto px-6 pb-28 space-y-px z-10">
        {alarms.length === 0 ? (
          <div className="pt-24 text-center">
            <BellOff className="w-8 h-8 mx-auto text-zinc-600 mb-3" />
            <p className="text-[15px] font-medium text-zinc-400">No alarms</p>
            <p className="text-[13px] text-zinc-600 mt-1">Tap + to add one.</p>
          </div>
        ) : (
          <div className="glass-card divide-y divide-white/[0.06] overflow-hidden">
            {alarms.map((alarm) => {
              const { time, suffix } = splitTime(alarm.time);
              return (
                <div
                  key={alarm.id}
                  className={`flex items-center gap-3 px-4 py-4 ${alarm.active ? '' : 'opacity-40'}`}
                >
                  {/* Edit-mode delete handle */}
                  {editing && (
                    <button
                      onClick={() => onDeleteAlarm(alarm.id)}
                      className="shrink-0 w-6 h-6 rounded-full border border-[#FF453A]/60 flex items-center justify-center text-[#FF453A]"
                      aria-label={`Delete ${alarm.label}`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Time + details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[40px] font-light tracking-tight text-white leading-none">
                        {time}
                      </span>
                      <span className="text-[15px] font-medium text-zinc-400">{suffix}</span>
                    </div>
                    <p className="text-[13px] text-zinc-400 truncate mt-0.5">
                      {alarm.label} · {repeatSummary(alarm.days)}
                    </p>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => onToggleAlarm(alarm.id)}
                    className={`ios-toggle ${alarm.active ? 'is-on' : 'is-off'} shrink-0`}
                    aria-pressed={alarm.active}
                    aria-label={`Toggle ${alarm.label}`}
                  >
                    <span className="ios-toggle__knob" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Quiet footer: wake-up code link */}
        <div className="mt-8 flex items-center justify-between px-1">
          <button
            onClick={onNavigateToQR}
            className="flex items-center gap-2 text-[13px] text-zinc-400 font-medium hover:text-white transition-colors"
          >
            <QrCode className="w-4 h-4 text-[#FF8A42]" />
            <span>Wake-up code</span>
          </button>
        </div>
      </div>

      {/* Add alarm — bottom sheet modal (iOS-style) */}
      <AnimatePresence>
        {showAddForm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSheet}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed bottom-0 inset-x-0 z-50 max-h-[88vh] overflow-y-auto glass-card-light rounded-t-3xl border-b-0 mx-auto max-w-md"
            >
              {/* Drag handle */}
              <div className="sticky top-0 z-10 pt-3 pb-2 bg-transparent flex flex-col items-center">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="px-5 pb-8">
                {/* Sheet header */}
                <div className="flex items-center justify-between mb-5">
                  <button
                    onClick={closeSheet}
                    className="flex items-center gap-1 text-[15px] font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <h2 className="text-[17px] font-semibold text-white">New Alarm</h2>
                  <span className="w-[72px]" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Time picker — iOS scroll wheel */}
                  <div className="glass-card py-5 flex justify-center">
                    <TimeWheelPicker value={newTime} onChange={setNewTime} />
                  </div>

                  {/* Label */}
                  <div>
                    <label className="block text-[12px] font-medium text-zinc-400 mb-1.5">Label</label>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g. Bathroom"
                      className="w-full glass-input rounded-xl px-3 py-2.5 text-white font-medium text-[14px]"
                    />
                  </div>

                  {/* Sound */}
                  <div>
                    <label className="block text-[12px] font-medium text-zinc-400 mb-2">Sound</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SOUND_LABELS.map((snd) => {
                        const isSelected = snd.key === newSoundType;
                        const isPreviewing = previewPlaying === snd.key;
                        return (
                          <div
                            key={snd.key}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                              isSelected
                                ? 'border-[#FF8A42]/50 bg-[#FF8A42]/10'
                                : 'border-white/[0.06] bg-white/[0.03]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setNewSoundType(snd.key as Alarm['soundType'])}
                              className={`flex-1 text-[13px] font-medium text-left ${isSelected ? 'text-[#FFB37A]' : 'text-zinc-300'}`}
                            >
                              {snd.label}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePreviewSound(snd.key)}
                              className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                                isPreviewing
                                  ? 'bg-[#FF8A42]/20 border-[#FF8A42]/40 text-[#FFB37A]'
                                  : 'bg-white/[0.04] border-white/[0.08] text-zinc-400'
                              }`}
                              title={isPreviewing ? 'Stop preview' : 'Preview sound'}
                            >
                              {isPreviewing ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Repeat */}
                  <div>
                    <label className="block text-[12px] font-medium text-zinc-400 mb-2">Repeat</label>
                    <div className="flex justify-between gap-1">
                      {daysLabels.map((label, dayIndex) => {
                        const active = newDays.includes(dayIndex);
                        return (
                          <button
                            key={dayIndex}
                            type="button"
                            onClick={() => handleToggleDay(dayIndex)}
                            className={`w-9 h-9 rounded-full text-[12px] font-medium transition-all ${
                              active
                                ? 'glass-button-glow'
                                : 'glass-button text-zinc-400'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={newDays.length === 0}
                    className={`w-full py-3.5 rounded-2xl font-sans font-semibold text-[15px] transition-all ${newDays.length > 0
                        ? 'glass-button-glow cursor-pointer'
                        : 'bg-white/[0.04] text-zinc-500 border border-dashed border-white/[0.08] cursor-not-allowed'
                      }`}
                  >
                    {newDays.length > 0 ? 'Save Alarm' : 'Select at least one day'}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
