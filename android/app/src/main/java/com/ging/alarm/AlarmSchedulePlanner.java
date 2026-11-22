package com.ging.alarm;

import java.util.Calendar;
import java.util.TimeZone;

/** Date calculations shared by the native exact-alarm scheduler and its unit tests. */
public final class AlarmSchedulePlanner {

    private AlarmSchedulePlanner() {}

    public static long nextTriggerMillis(
        int dayOfWeek,
        int hour,
        int minute,
        long nowMillis,
        TimeZone timeZone
    ) {
        if (dayOfWeek < Calendar.SUNDAY || dayOfWeek > Calendar.SATURDAY) {
            throw new IllegalArgumentException("dayOfWeek must be a Calendar weekday");
        }
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            throw new IllegalArgumentException("Alarm time is outside the valid range");
        }

        Calendar now = Calendar.getInstance(timeZone);
        now.setTimeInMillis(nowMillis);

        Calendar next = (Calendar) now.clone();
        int daysUntil = (dayOfWeek - now.get(Calendar.DAY_OF_WEEK) + 7) % 7;
        next.add(Calendar.DAY_OF_YEAR, daysUntil);
        next.set(Calendar.HOUR_OF_DAY, hour);
        next.set(Calendar.MINUTE, minute);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);

        if (!next.after(now)) {
            next.add(Calendar.DAY_OF_YEAR, 7);
        }

        return next.getTimeInMillis();
    }
}
