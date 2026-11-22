/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Play, Square, QrCode, X, Minus, Tag, Volume2
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
  const ampm = hours >= 12 ? 'PM' : 'AM';
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
  const [newLabel, setNewLabel] = useState('');
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]); // weekdays by default
  const [newSoundType, setNewSoundType] = useState<Alarm['soundType']>('industrial');
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const addAlarmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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

  const closeSheet = useCallback(() => {
    // Stop any preview sound before closing the add sheet
    gingAudio.stop();
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = null;
    setPreviewPlaying(null);
    setShowAddForm(false);
    setNewTime('06:00');
    setNewLabel('');
    setNewDays([1, 2, 3, 4, 5]);
    setNewSoundType('industrial');
  }, []);

  React.useEffect(() => {
    if (!showAddForm) return;

    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSheet();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>).filter(control => control.getAttribute('aria-hidden') !== 'true');
      if (controls.length === 0) return;

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleNativeBack = (event: Event) => {
      event.preventDefault();
      closeSheet();
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('ging:back', handleNativeBack);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('ging:back', handleNativeBack);
      addAlarmButtonRef.current?.focus();
    };
  }, [showAddForm, closeSheet]);

  React.useEffect(() => () => {
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    gingAudio.stop();
  }, []);

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
      label: newLabel.trim() || 'Alarm',
      active: true,
      days: newDays,
      volume: 1.0,
      soundType: newSoundType,
      qrSecret: userQRSecret,
    });
    closeSheet();
  };

  const daysLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="relative min-h-dvh ambient-glow-bg ging-screen ging-screen--dashboard text-white flex flex-col overflow-x-hidden font-sans">
      {/* Faint ambient haze */}
      <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
      <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

      {/* Reserve a stable header slot for the mascot so the alarm list can grow below it. */}
      <div className="relative z-20 max-w-md w-full mx-auto px-6 dashboard-header">
        <div className="dashboard-toolbar">
          <button
            onClick={() => setEditing(e => !e)}
            className="w-16 min-h-[44px] text-left text-[15px] font-medium text-ging-burnt"
            aria-pressed={editing}
          >
            {editing ? 'Done' : 'Manage'}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="w-16 h-11 flex items-center justify-end"
            aria-label="Add alarm"
            ref={addAlarmButtonRef}
          >
            <Plus className="w-7 h-7 text-ging-orange" />
          </button>
        </div>
        <div className={`dashboard-heading ${alarms.length === 0 ? 'dashboard-heading--empty' : ''}`}>
          <h1 className="dashboard-title text-[28px] font-bold text-white tracking-tight">Wake schedule</h1>
          {alarms.length > 0 && (
            <img
              src="/gingy-mascot-cutout.webp"
              alt=""
              aria-hidden="true"
              className="dashboard-mascot"
            />
          )}
        </div>
      </div>

      {/* Alarm list */}
      <div className="flex-1 max-w-md w-full mx-auto px-6 pb-28 space-y-px z-10 dashboard-list">
        {alarms.length === 0 ? (
          <div className="dashboard-empty pt-14 text-center">
            <img src="/gingy-mascot-cutout.webp" alt="" aria-hidden="true" className="dashboard-empty-mascot" />
            <p className="text-[15px] font-medium text-zinc-400">No alarms</p>
            <p className="text-[13px] text-zinc-600 mt-1">Tap + to add one.</p>
          </div>
        ) : (
          <div className={`glass-card divide-y divide-white/[0.06] overflow-hidden dashboard-alarms ${alarms.length === 1 ? 'dashboard-alarms--single' : ''}`}>
            <AnimatePresence initial={false}>
              {alarms.map((alarm) => {
                const { time, suffix } = splitTime(alarm.time);
                const alarmLabel = alarm.id === 'default-morning' && alarm.label === 'Bathroom Mirror Session'
                  ? 'Morning alarm'
                  : alarm.label;
                return (
                  <motion.div
                    key={alarm.id}
                    layout="position"
                    initial={{ opacity: 0, y: 7 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className={`flex items-center gap-3 px-4 py-4 dashboard-alarm-row ${alarm.active ? '' : 'opacity-55'}`}
                  >
                    {/* Collapse the delete slot after its control exits so the row reclaims the space. */}
                    <motion.div
                      initial={false}
                      animate={{ width: editing ? 48 : 0, opacity: editing ? 1 : 0, marginRight: editing ? 0 : -12 }}
                      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                      className="shrink-0 h-12 flex items-center justify-center overflow-hidden"
                      aria-hidden={!editing}
                    >
                      <AnimatePresence initial={false}>
                        {editing && (
                          <motion.button
                            key="delete"
                            initial={{ opacity: 0, scale: 0.82 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.82 }}
                            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                            onClick={() => onDeleteAlarm(alarm.id)}
                            className="shrink-0 w-12 h-12 rounded-full border border-ging-red/60 flex items-center justify-center text-ging-red"
                            aria-label={`Delete ${alarmLabel}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </motion.div>

                  {/* Time + details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[40px] font-light tracking-tight text-white leading-none">
                        {time}
                      </span>
                      <span className="text-[15px] font-medium text-zinc-400">{suffix}</span>
                    </div>
                    <p className="text-[13px] text-zinc-400 mt-0.5 leading-snug break-words">
                      {alarmLabel} · {repeatSummary(alarm.days)}
                    </p>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => onToggleAlarm(alarm.id)}
                    className={`ios-toggle ${alarm.active ? 'is-on' : 'is-off'} shrink-0`}
                    aria-pressed={alarm.active}
                    aria-label={`Toggle ${alarmLabel}`}
                  >
                    <span className="ios-toggle__knob" />
                  </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Quiet footer: wake-up code link */}
        <div className="mt-8 flex items-center justify-between px-1">
          <button
            onClick={onNavigateToQR}
            className="flex items-center gap-2 text-[13px] text-zinc-400 font-medium transition-colors dashboard-qr-link"
          >
            <QrCode className="w-4 h-4 text-ging-orange" />
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
              aria-hidden="true"
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 inset-x-0 z-50 max-h-[94dvh] overflow-y-auto overscroll-y-contain scrollbar-hide glass-card-light rounded-t-3xl border-b-0 mx-auto max-w-md alarm-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-alarm-title"
              ref={dialogRef}
            >
              {/* Drag handle */}
              <div className="sticky top-0 z-10 pt-3 pb-2 bg-transparent flex flex-col items-center">
                <div className="w-10 h-1 rounded-full bg-ging-orange/25" />
              </div>

              <div className="px-5 pb-4">
                {/* Sheet header */}
                <div className="flex items-center justify-between mb-5">
                  <button
                    type="button"
                    onClick={closeSheet}
                    className="flex items-center gap-1 text-[15px] font-medium text-zinc-400 transition-colors"
                    ref={cancelButtonRef}
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <h2 id="new-alarm-title" className="text-[17px] font-semibold text-white">New Alarm</h2>
                  <span className="w-[72px]" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 alarm-form">
                  {/* Time picker — iOS scroll wheel */}
                  <div className="glass-card py-5 flex justify-center time-wheel-card">
                    <TimeWheelPicker value={newTime} onChange={setNewTime} />
                  </div>

                  {/* Label */}
                  <div className="alarm-label-field">
                    <label htmlFor="alarm-label" className="alarm-field-label block text-[12px] font-medium text-zinc-400 mb-2">Label</label>
                    <div className="alarm-label-control">
                      <Tag className="w-[17px] h-[17px] text-ging-burnt shrink-0" aria-hidden="true" />
                      <input
                        id="alarm-label"
                        type="text"
                      maxLength={50}
                      autoComplete="off"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="e.g. Weekday mornings"
                        className="alarm-label-input w-full text-[14px] font-medium"
                      />
                    </div>
                  </div>

                  {/* Sound */}
                  <div className="alarm-sound-field">
                    <p id="alarm-sound-label" className="alarm-field-label block text-[12px] font-medium text-zinc-400 mb-2">Sound</p>
                    <div className="sound-options" role="group" aria-labelledby="alarm-sound-label">
                      {SOUND_LABELS.map((snd) => {
                        const isSelected = snd.key === newSoundType;
                        const isPreviewing = previewPlaying === snd.key;
                        return (
                          <div
                            key={snd.key}
                            className={`sound-option ${isSelected ? 'is-selected' : ''} ${isPreviewing ? 'is-previewing' : ''}`}
                          >
                            <button
                              type="button"
                              onClick={() => setNewSoundType(snd.key as Alarm['soundType'])}
                              aria-pressed={isSelected}
                              className="sound-option-select"
                            >
                              <span className="sound-option-glyph" aria-hidden="true">
                                <Volume2 className="w-[17px] h-[17px]" />
                              </span>
                              <span className="sound-option-name">{snd.label}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNewSoundType(snd.key as Alarm['soundType']);
                                handlePreviewSound(snd.key);
                              }}
                              aria-label={`${isPreviewing ? 'Stop' : 'Preview'} ${snd.label}`}
                              className={`sound-option-preview ${isPreviewing ? 'is-playing' : ''}`}
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
                    <p id="alarm-repeat-label" className="block text-[12px] font-medium text-zinc-400 mb-2">Repeat</p>
                    <div className="flex justify-between gap-1 repeat-picker" role="group" aria-labelledby="alarm-repeat-label">
                      {daysLabels.map((label, dayIndex) => {
                        const active = newDays.includes(dayIndex);
                        return (
                          <button
                            key={dayIndex}
                            type="button"
                            onClick={() => handleToggleDay(dayIndex)}
                            aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex]}
                            aria-pressed={active}
                            className={`w-12 h-12 rounded-full text-[12px] font-medium transition-colors ${
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
                    className={`w-full py-3.5 rounded-2xl font-sans font-semibold text-[15px] transition-colors ${newDays.length > 0
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
