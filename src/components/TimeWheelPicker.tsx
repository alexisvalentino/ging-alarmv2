/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * iOS-style scroll-wheel time picker.
 * Three snap-scrolling columns: Hour (1–12) · Minute (00–59) · AM/PM.
 * Accepts/emits a 24-hour "HH:MM" string so it drops into the existing
 * alarm data model and scheduler without any changes downstream.
 */

import React, { useEffect, useRef } from 'react';

const ITEM_HEIGHT = 40;       // px per wheel row
const VISIBLE_RADIUS = 2;     // rows above/below center visible in the fade band
const PAD = VISIBLE_RADIUS * ITEM_HEIGHT; // top/bottom spacer so first/last items can center

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);          // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')); // 00..59
const PERIODS = ['AM', 'PM'];

interface TimeWheelPickerProps {
  value: string;            // "HH:MM" 24-hour
  onChange: (v: string) => void;
}

/** Convert a 24-hour "HH:MM" into { hour12, minute, period }. */
function from24h(time24: string) {
  const [hStr, mStr] = (time24 || '06:00').split(':');
  let h24 = parseInt(hStr, 10);
  if (isNaN(h24)) h24 = 6;
  const minute = isNaN(parseInt(mStr, 10)) ? '00' : String(parseInt(mStr, 10)).padStart(2, '0');
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12, minute, period };
}

/** Convert 12-hour fields back into a 24-hour "HH:MM" string. */
function to24h(hour12: number, minute: string, period: 'AM' | 'PM') {
  let h24 = hour12 % 12;
  if (period === 'PM') h24 += 12;
  return `${String(h24).padStart(2, '0')}:${minute}`;
}

/** A single snap-scrolling column. */
function Wheel({
  items,
  index,
  onIndexChange,
  label,
  width,
  format = (x) => String(x),
}: {
  items: (string | number)[];
  index: number;
  onIndexChange: (i: number) => void;
  label: string;
  width: string;
  format?: (x: string | number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const programmaticRef = useRef(false);
  const scrollTimer = useRef<number | null>(null);
  const programmaticTimer = useRef<number | null>(null);

  const allowUserScrollAfter = (delay: number) => {
    if (programmaticTimer.current) window.clearTimeout(programmaticTimer.current);
    programmaticTimer.current = window.setTimeout(() => {
      programmaticRef.current = false;
      programmaticTimer.current = null;
    }, delay);
  };

  // Center the selected item when it changes externally (mount / preset tap).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    programmaticRef.current = true;
    el.scrollTop = index * ITEM_HEIGHT;
    // Allow user scroll after the initial layout settles.
    allowUserScrollAfter(120);
    return () => {
      if (programmaticTimer.current) window.clearTimeout(programmaticTimer.current);
      if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    };
  }, [index]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el || programmaticRef.current) return;
    // Debounce so we only commit when scrolling settles.
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const i = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      if (clamped !== index) {
        onIndexChange(clamped);
      } else {
        // Snap correction if the user landed between rows.
        const target = clamped * ITEM_HEIGHT;
        if (Math.abs(el.scrollTop - target) > 1) {
          programmaticRef.current = true;
          el.scrollTop = target;
          allowUserScrollAfter(80);
        }
      }
    }, 90);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let nextIndex = index;
    if (event.key === 'ArrowUp') nextIndex = Math.max(0, index - 1);
    else if (event.key === 'ArrowDown') nextIndex = Math.min(items.length - 1, index + 1);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = items.length - 1;
    else return;

    event.preventDefault();
    if (nextIndex !== index) onIndexChange(nextIndex);
  };

  const selectedValue = Number(items[index]);
  const firstValue = Number(items[0]);
  const lastValue = Number(items[items.length - 1]);
  const isNumericWheel = Number.isFinite(selectedValue);

  return (
    <div
      className="relative z-[1] scrollbar-hide overflow-y-scroll snap-y snap-mandatory time-wheel-column"
      style={{
        width,
        height: ITEM_HEIGHT * (VISIBLE_RADIUS * 2 + 1),
        paddingTop: PAD,
        paddingBottom: PAD,
        WebkitOverflowScrolling: 'touch',
        // iOS wheel fade at top and bottom
        maskImage: 'linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)',
      }}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      ref={ref}
      role="spinbutton"
      aria-label={label}
      aria-valuemin={isNumericWheel ? firstValue : 1}
      aria-valuemax={isNumericWheel ? lastValue : items.length}
      aria-valuenow={isNumericWheel ? selectedValue : index + 1}
      aria-valuetext={`${label} ${format(items[index])}`}
      tabIndex={0}
    >
      {items.map((item, i) => (
        <div
          key={item}
          aria-hidden="true"
          className={`snap-center flex items-center justify-center tabular-nums select-none time-wheel-value ${i === index ? 'is-selected' : ''}`}
          style={{
            height: ITEM_HEIGHT,
            fontSize: 24,
            fontWeight: i === index ? 650 : 500,
            color: i === index ? 'var(--ging-ink)' : 'rgba(90, 65, 55, 0.44)',
          }}
        >
          {format(item)}
        </div>
      ))}
    </div>
  );
}

export default function TimeWheelPicker({ value, onChange }: TimeWheelPickerProps) {
  const { hour12, minute, period } = from24h(value);

  const hourIdx = HOURS_12.indexOf(hour12);
  const minuteIdx = MINUTES.indexOf(minute);
  const periodIdx = PERIODS.indexOf(period);

  const emit = (h: number, m: string, p: 'AM' | 'PM') => {
    onChange(to24h(HOURS_12[h], m, p));
  };

  return (
    <div className="relative time-wheel-picker">
      {/* Center highlight band */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 time-wheel-selection"
        style={{ height: ITEM_HEIGHT }}
      />
      <div className="flex items-center justify-center relative">
        <Wheel
          items={HOURS_12}
          index={hourIdx < 0 ? 5 : hourIdx}
          onIndexChange={(i) => emit(i, minute, period)}
          label="Hour"
          width="78px"
        />
        <span className="text-2xl text-white/30 font-medium px-1 -mx-1">:</span>
        <Wheel
          items={MINUTES}
          index={minuteIdx < 0 ? 0 : minuteIdx}
          onIndexChange={(i) => emit(hourIdx < 0 ? 5 : hourIdx, MINUTES[i], period)}
          label="Minute"
          width="78px"
        />
        <Wheel
          items={PERIODS}
          index={periodIdx < 0 ? 0 : periodIdx}
          onIndexChange={(i) => emit(hourIdx < 0 ? 5 : hourIdx, minute, PERIODS[i] as 'AM' | 'PM')}
          label="AM or PM"
          width="62px"
        />
      </div>
    </div>
  );
}
