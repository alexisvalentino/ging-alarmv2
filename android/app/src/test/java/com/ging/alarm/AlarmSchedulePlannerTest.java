package com.ging.alarm;

import static org.junit.Assert.assertEquals;

import java.util.Calendar;
import java.util.TimeZone;
import org.junit.Test;

public class AlarmSchedulePlannerTest {

    private static long utcMillis(int year, int month, int day, int hour, int minute) {
        Calendar calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        calendar.clear();
        calendar.set(year, month - 1, day, hour, minute, 0);
        return calendar.getTimeInMillis();
    }

    @Test
    public void schedulesLaterTodayWhenWeekdayAndTimeMatch() {
        long now = utcMillis(2026, 11, 23, 5, 0); // Monday

        long next = AlarmSchedulePlanner.nextTriggerMillis(
            Calendar.MONDAY,
            6,
            30,
            now,
            TimeZone.getTimeZone("UTC")
        );

        assertEquals(utcMillis(2026, 11, 23, 6, 30), next);
    }

    @Test
    public void rollsAnAlarmAtTheCurrentMinuteForwardOneWeek() {
        long now = utcMillis(2026, 11, 23, 6, 30); // Monday at the alarm time

        long next = AlarmSchedulePlanner.nextTriggerMillis(
            Calendar.MONDAY,
            6,
            30,
            now,
            TimeZone.getTimeZone("UTC")
        );

        assertEquals(utcMillis(2026, 11, 30, 6, 30), next);
    }

    @Test
    public void findsTheNextSelectedWeekdayInTheDeviceTimeZone() {
        long now = utcMillis(2026, 11, 23, 7, 0); // Monday
        TimeZone singapore = TimeZone.getTimeZone("Asia/Singapore");

        long next = AlarmSchedulePlanner.nextTriggerMillis(
            Calendar.SUNDAY,
            6,
            0,
            now,
            singapore
        );

        assertEquals(utcMillis(2026, 11, 28, 22, 0), next); // Sunday 06:00 SGT
    }
}
