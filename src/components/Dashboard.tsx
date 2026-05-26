/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Trash2, Bell, BellOff, Calendar, Flame, Play, Clock, Sparkles,
  HelpCircle, Settings, ShieldCheck, RefreshCw, Volume2, AlertCircle, Eye, Info
} from 'lucide-react';
import { Alarm } from '../types';
import GingLogo from './GingLogo';

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
  return `${String(hours).padStart(2, '0')}:${minutesStr} ${ampm}`;
};

interface DashboardProps {
  alarms: Alarm[];
  streak: number;
  userQRSecret: string;
  onAddAlarm: (alarm: Omit<Alarm, 'id'>) => void;
  onToggleAlarm: (id: string) => void;
  onDeleteAlarm: (id: string) => void;
  onNavigateToQR: () => void;
  onResetStreak: () => void;
}

export default function Dashboard({
  alarms,
  streak,
  userQRSecret,
  onAddAlarm,
  onToggleAlarm,
  onDeleteAlarm,
  onNavigateToQR,
  onResetStreak
}: DashboardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTime, setNewTime] = useState('06:00');
  const [newLabel, setNewLabel] = useState('Mornings in the Shower');
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]); // weekdays by default
  const [newSoundType, setNewSoundType] = useState<Alarm['soundType']>('industrial');
  const [newVolume, setNewVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState('');

  // Live time display for alarm dashboard clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
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
      label: newLabel || 'Wake Up Challenge',
      active: true,
      days: newDays,
      volume: newVolume,
      soundType: newSoundType,
      qrSecret: userQRSecret,
    });
    setShowAddForm(false);
    // Reset fields to helpful standards
    setNewTime('06:00');
    setNewLabel('Mornings in the Shower');
  };

  const daysLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="relative min-h-screen bg-gray-50 text-black flex flex-col justify-between p-6 overflow-x-hidden font-sans">

      {/* Upper Dashboard Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-3 border-b-2 border-black">
        <div className="flex items-center gap-2">
          <GingLogo size={36} />
          <div>
            <span className="font-sans font-black text-xl text-black block leading-none uppercase tracking-wider">Ging</span>
            <span className="text-[9px] font-mono text-orange-600 uppercase tracking-widest block font-extrabold mt-0.5">
              Ruthless Wake Engine
            </span>
          </div>
        </div>

        {/* Streak Counter Accent */}
        <div className="flex items-center gap-1.5 bg-orange-100 border-2 border-black px-3.5 py-1.5 rounded-full text-xs text-orange-950 font-black polish-shadow-sm">
          <Flame className="w-4 h-4 fill-orange-500 text-orange-600 animate-pulse" />
          <span>{streak} DAYS IN A ROW</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-md w-full mx-auto py-6 space-y-6">

        {/* Android Digital Clock Widget */}
        <div className="p-6 bg-white border-2 border-black rounded-3xl text-center relative overflow-hidden polish-shadow">
          <div className="absolute top-3 left-4 flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold">
            <Clock className="w-3.5 h-3.5 text-orange-600" />
            <span>GING WAKELOCK ACTIVE</span>
          </div>

          <div className="absolute top-3 right-4 flex items-center gap-1.5 text-[8px] font-mono text-green-800 bg-green-100 px-2 py-0.5 rounded border border-green-600 font-extrabold">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>BG_ALARM_READY</span>
          </div>

          <h3 className="text-4xl font-black text-black tracking-widest font-mono py-4 mt-1">
            {currentTime || '--:--:--'}
          </h3>

          <p className="text-xs text-zinc-500 italic font-medium leading-relaxed">
            "Your morning depends on getting out of bed, not pressing snooze."
          </p>
        </div>



        {/* Alarms Index */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest font-mono text-zinc-500 font-extrabold">
              Configured Alarms ({alarms.length})
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 text-xs text-white bg-black hover:bg-zinc-900 px-3.5 py-2 rounded-xl border-2 border-black font-black uppercase tracking-wider polish-shadow-sm active:translate-y-[1px] active:shadow-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Cancel' : 'New Alarm'}</span>
            </button>
          </div>

          {/* Add Alarm Form Inline */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-white border-2 border-black rounded-2xl p-5 polish-shadow"
              >
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-black font-mono font-black mb-1.5">
                        Alarm Time
                      </label>
                      <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        required
                        className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-black font-mono font-black text-lg focus:outline-none focus:border-orange-500"
                      />
                      <p className="text-[10px] text-orange-650 font-black mt-1.5 font-mono select-none">
                        ({formatTo12Hour(newTime)})
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-black font-mono font-black mb-1.5">
                        Challenge secret
                      </label>
                      <div className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-orange-650 text-xs font-mono font-black truncate flex items-center justify-between select-none">
                        <span>{userQRSecret.slice(0, 15)}...</span>
                        <HelpCircle className="w-3.5 h-3.5 text-zinc-600 shrink-0" title="Alarms require matching this system code" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-black font-mono font-black mb-1.5">
                      Label / Target Room
                    </label>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g. bathroom, shower, office"
                      className="w-full bg-zinc-50 border-2 border-black rounded-xl px-3 py-2 text-xs text-black font-bold focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {/* Sound type selector */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-black font-mono font-black mb-1.5">
                      Ringtone Alarm Aggressiveness
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'industrial', label: '🚨 Screaming Industrial' },
                        { key: 'classic-beep', label: '⏱️ Pulse Retro Watch' },
                        { key: 'air-horn', label: '📯 Railway Air Horn' },
                        { key: 'filipino-shout', label: '🇵🇭 Filipino Shouter' }
                      ].map((snd) => (snd.key === newSoundType ? (
                        <button
                          key={snd.key}
                          type="button"
                          className="p-2 rounded-xl text-[11px] font-black text-left border-2 border-black bg-orange-100 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                        >
                          {snd.label}
                        </button>
                      ) : (
                        <button
                          key={snd.key}
                          type="button"
                          onClick={() => setNewSoundType(snd.key as Alarm['soundType'])}
                          className="p-2 rounded-xl text-[11px] font-bold text-left border-2 border-black bg-white text-zinc-700 hover:bg-zinc-100"
                        >
                          {snd.label}
                        </button>
                      )))}
                    </div>
                  </div>

                  {/* Days Active */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-black font-mono font-black mb-1.5">
                      Active Weekdays
                    </label>
                    <div className="flex justify-between gap-1">
                      {daysLabels.map((label, dayIndex) => {
                        const active = newDays.includes(dayIndex);
                        return (
                          <button
                            key={dayIndex}
                            type="button"
                            onClick={() => handleToggleDay(dayIndex)}
                            className={`w-9 h-9 rounded-xl font-black text-xs cursor-pointer transition-all border-2 border-black ${active
                                ? 'bg-gradient-to-r from-orange-500 to-red-650 text-white shadow-sm'
                                : 'bg-white text-zinc-500 hover:border-zinc-700'
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
                    className={`w-full py-3 rounded-xl font-sans font-black text-xs tracking-wider uppercase transition-all border-2 border-black polish-shadow ${newDays.length > 0
                        ? 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer active:translate-y-[1px] active:shadow-none'
                        : 'bg-zinc-250 text-zinc-400 border-dashed cursor-not-allowed'
                      }`}
                  >
                    {newDays.length > 0 ? 'Save & Initialize Alarm Channel' : 'Select at least one day'}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* List of active Alarms */}
          <div className="space-y-3">
            {alarms.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border-2 border-black text-center text-zinc-500 polish-shadow">
                <BellOff className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                <p className="text-sm font-bold text-black">No alarms scheduled.</p>
                <p className="text-xs text-zinc-600 mt-1">Ging requires at least one active alarm to guard your sleep.</p>
              </div>
            ) : (
              alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className={`p-4 rounded-2xl border-2 border-black transition-all ${alarm.active
                      ? 'bg-white text-black polish-shadow'
                      : 'bg-zinc-150 text-zinc-450 border-zinc-300'
                    }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl mt-1 shrink-0 border-2 border-black ${alarm.active ? 'bg-orange-100 text-orange-850' : 'bg-zinc-200 text-zinc-500'
                        }`}>
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        {/* Time and details */}
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-black font-mono tracking-tight ${alarm.active ? 'text-black' : 'text-zinc-500'}`}>
                            {formatTo12Hour(alarm.time)}
                          </span>
                          <span className="text-[9px] uppercase font-mono tracking-wider font-black text-orange-600">
                            {alarm.soundType === 'industrial' && '🚨 Industrial'}
                            {alarm.soundType === 'classic-beep' && '⏱️ Watch Beep'}
                            {alarm.soundType === 'air-horn' && '📯 Air Horn'}
                            {alarm.soundType === 'filipino-shout' && '🇵🇭 Shouter'}
                          </span>
                        </div>
                        <span className="text-xs block font-bold text-zinc-700 mt-0.5">{alarm.label}</span>

                        {/* Days list */}
                        <div className="flex gap-1 mt-2">
                          {daysLabels.map((l, index) => {
                            const isSet = alarm.days.includes(index);
                            return (
                              <span
                                key={index}
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${isSet
                                    ? alarm.active ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-zinc-300 text-zinc-600 border-zinc-400'
                                    : 'text-zinc-400 border-transparent'
                                  }`}
                              >
                                {l}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Actions panel */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => onToggleAlarm(alarm.id)}
                        className={`relative w-12 h-6 flex items-center rounded-full border-2 border-black cursor-pointer transition-colors duration-205 ${alarm.active ? 'bg-orange-500' : 'bg-gray-200'
                          }`}
                      >
                        <span
                          className={`w-4.5 h-4.5 rounded-full bg-white border border-black transition-transform duration-200 shadow-sm ${alarm.active ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>

                      <button
                        onClick={() => onDeleteAlarm(alarm.id)}
                        className="p-1.5 bg-gray-150 hover:bg-red-100 border-2 border-black rounded-xl text-black hover:text-red-600 transition-colors polish-shadow-sm active:translate-y-[1px] active:shadow-none"
                        title="Delete Alarm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dynamic Tips & Config card */}
        <div className="p-5 rounded-2xl bg-white border-2 border-black space-y-3 polish-shadow">
          <h4 className="text-xs uppercase tracking-widest font-mono text-black font-black flex items-center gap-1">
            <Settings className="w-4 h-4 text-orange-600" />
            <span>Watchdog Service Registry</span>
          </h4>

          <div className="text-xs text-zinc-800 space-y-1 bg-zinc-50 p-3 rounded-xl border-2 border-black font-bold select-none">
            <div className="flex justify-between py-1 border-b border-black font-mono">
              <span className="text-zinc-500">Watchdog Service</span>
              <span className="text-emerald-700 font-extrabold">READY (WAKELOCK)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-black font-mono">
              <span className="text-zinc-500">Foreground Notification</span>
              <span className="text-orange-600">PERMANENT_ON</span>
            </div>
            <div className="flex justify-between py-1 font-mono">
              <span className="text-zinc-500">Signature Key</span>
              <span className="text-black shrink-0 font-extrabold">{userQRSecret.slice(0, 10)}...</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1.5">
            <button
              onClick={onNavigateToQR}
              className="text-orange-600 hover:text-orange-700 font-black flex items-center gap-1 transition-colors uppercase tracking-wider"
            >
              <Eye className="w-4.5 h-4.5 text-black" />
              <span>Show OR Print Bathroom QR Sheet</span>
            </button>

            <button
              onClick={onResetStreak}
              disabled={streak === 0}
              className="text-zinc-500 hover:text-red-650 text-xs transition-colors font-bold uppercase tracking-wider"
            >
              Reset Streak
            </button>
          </div>
        </div>

      </div>

      {/* Persistent Footer Warning */}
      <div className="max-w-md w-full mx-auto mt-4 text-[10px] font-mono text-zinc-500 text-center uppercase tracking-widest flex items-center justify-center gap-1.5 font-bold pb-6">
        <ShieldCheck className="w-4 h-4 text-zinc-500" />
        <span>Ging Wake Engine • Certified Unstoppable</span>
      </div>

    </div>
  );
}
