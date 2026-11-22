package com.ging.alarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;
import java.util.TimeZone;

/** Schedules exact, one-shot Android alarms and restores them after clock or device changes. */
public final class AlarmScheduler {

    public static final String ACTION_FIRE_ALARM = "com.ging.alarm.FIRE_ALARM";
    public static final String EXTRA_ALARM_ID = "ging_alarm_id";
    public static final String EXTRA_ALARM_DAY = "ging_alarm_day";
    public static final String EXTRA_ALARM_TIME = "ging_alarm_time";
    public static final String EXTRA_SOUND_TYPE = "ging_sound_type";

    private static final String PREFERENCES = "ging_native_alarm_schedules";
    private static final String SCHEDULES_KEY = "schedules";

    private AlarmScheduler() {}

    public static void sync(Context context, JSONArray alarms) throws JSONException {
        JSONArray normalized = normalize(alarms);
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) throw new IllegalStateException("Android alarm service is unavailable.");
        if (normalized.length() > 0 && !canScheduleExactAlarms(manager)) {
            throw new SecurityException("Allow Ging to schedule exact alarms in Android settings.");
        }

        JSONArray previous = readSchedules(context);
        cancelSchedules(context, manager, previous);
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(SCHEDULES_KEY, normalized.toString())
            .apply();
        scheduleAll(context, manager, normalized);
    }

    public static void restore(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) return;

        JSONArray schedules = readSchedules(context);
        if (schedules.length() == 0) return;
        if (!canScheduleExactAlarms(manager)) return;

        cancelSchedules(context, manager, schedules);
        try {
            scheduleAll(context, manager, schedules);
        } catch (JSONException | SecurityException error) {
            error.printStackTrace();
        }
    }

    public static void scheduleNextOccurrence(Context context, String alarmId, int dayIndex) {
        JSONArray schedules = readSchedules(context);
        for (int index = 0; index < schedules.length(); index++) {
            JSONObject alarm = schedules.optJSONObject(index);
            if (alarm == null || !alarmId.equals(alarm.optString("id"))) continue;
            JSONArray days = alarm.optJSONArray("days");
            if (!containsDay(days, dayIndex)) return;

            AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (manager == null || !canScheduleExactAlarms(manager)) return;
            try {
                scheduleOne(context, manager, alarm, dayIndex);
            } catch (JSONException | SecurityException error) {
                error.printStackTrace();
            }
            return;
        }
    }

    private static JSONArray normalize(JSONArray alarms) throws JSONException {
        JSONArray normalized = new JSONArray();
        if (alarms == null) return normalized;

        for (int index = 0; index < alarms.length(); index++) {
            JSONObject alarm = alarms.optJSONObject(index);
            if (alarm == null || !alarm.optBoolean("active", true)) continue;

            String id = alarm.optString("id", "").trim();
            String time = alarm.optString("time", "");
            String[] parts = time.split(":", -1);
            if (id.isEmpty() || parts.length != 2) continue;

            final int hour;
            final int minute;
            try {
                hour = Integer.parseInt(parts[0]);
                minute = Integer.parseInt(parts[1]);
            } catch (NumberFormatException invalidTime) {
                continue;
            }
            if (hour < 0 || hour > 23 || minute < 0 || minute > 59) continue;

            JSONArray rawDays = alarm.optJSONArray("days");
            Set<Integer> uniqueDays = new HashSet<>();
            JSONArray days = new JSONArray();
            if (rawDays != null) {
                for (int dayIndex = 0; dayIndex < rawDays.length(); dayIndex++) {
                    int day = rawDays.optInt(dayIndex, -1);
                    if (day >= 0 && day <= 6 && uniqueDays.add(day)) days.put(day);
                }
            }
            if (days.length() == 0) continue;

            JSONObject entry = new JSONObject();
            entry.put("id", id);
            entry.put("time", time);
            entry.put("days", days);
            entry.put("soundType", alarm.optString("soundType", "industrial"));
            normalized.put(entry);
        }

        return normalized;
    }

    private static void scheduleAll(Context context, AlarmManager manager, JSONArray schedules) throws JSONException {
        for (int index = 0; index < schedules.length(); index++) {
            JSONObject alarm = schedules.optJSONObject(index);
            if (alarm == null) continue;
            JSONArray days = alarm.optJSONArray("days");
            if (days == null) continue;

            for (int dayIndex = 0; dayIndex < days.length(); dayIndex++) {
                scheduleOne(context, manager, alarm, days.getInt(dayIndex));
            }
        }
    }

    private static void scheduleOne(Context context, AlarmManager manager, JSONObject alarm, int dayIndex)
        throws JSONException {
        String id = alarm.getString("id");
        String time = alarm.getString("time");
        String[] parts = time.split(":");
        int hour = Integer.parseInt(parts[0]);
        int minute = Integer.parseInt(parts[1]);
        int calendarDay = dayIndex + Calendar.SUNDAY;
        long triggerAt = AlarmSchedulePlanner.nextTriggerMillis(
            calendarDay,
            hour,
            minute,
            System.currentTimeMillis(),
            TimeZone.getDefault()
        );

        Intent showIntent = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .setData(scheduleUri("show", id, dayIndex));
        PendingIntent showOperation = PendingIntent.getActivity(
            context,
            0,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent fireIntent = new Intent(context, AlarmReceiver.class)
            .setAction(ACTION_FIRE_ALARM)
            .setData(scheduleUri("fire", id, dayIndex))
            .putExtra(EXTRA_ALARM_ID, id)
            .putExtra(EXTRA_ALARM_DAY, dayIndex)
            .putExtra(EXTRA_ALARM_TIME, time)
            .putExtra(EXTRA_SOUND_TYPE, alarm.optString("soundType", "industrial"));
        PendingIntent fireOperation = PendingIntent.getBroadcast(
            context,
            0,
            fireIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager.AlarmClockInfo alarmClock = new AlarmManager.AlarmClockInfo(triggerAt, showOperation);
        manager.setAlarmClock(alarmClock, fireOperation);
    }

    private static Uri scheduleUri(String purpose, String id, int dayIndex) {
        return Uri.parse("ging-alarm://" + purpose + "/" + Uri.encode(id) + "/" + dayIndex);
    }

    private static void cancelSchedules(Context context, AlarmManager manager, JSONArray schedules) {
        for (int index = 0; index < schedules.length(); index++) {
            JSONObject alarm = schedules.optJSONObject(index);
            if (alarm == null) continue;
            String id = alarm.optString("id", "");
            JSONArray days = alarm.optJSONArray("days");
            if (id.isEmpty() || days == null) continue;

            for (int dayIndex = 0; dayIndex < days.length(); dayIndex++) {
                int day = days.optInt(dayIndex, -1);
                if (day < 0 || day > 6) continue;
                Intent fireIntent = new Intent(context, AlarmReceiver.class)
                    .setAction(ACTION_FIRE_ALARM)
                    .setData(scheduleUri("fire", id, day));
                PendingIntent operation = PendingIntent.getBroadcast(
                    context,
                    0,
                    fireIntent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                if (operation != null) {
                    manager.cancel(operation);
                    operation.cancel();
                }

                Intent showIntent = new Intent(context, MainActivity.class)
                    .setAction(Intent.ACTION_MAIN)
                    .setData(scheduleUri("show", id, day));
                PendingIntent showOperation = PendingIntent.getActivity(
                    context,
                    0,
                    showIntent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                if (showOperation != null) showOperation.cancel();
            }
        }
    }

    private static JSONArray readSchedules(Context context) {
        String json = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .getString(SCHEDULES_KEY, "[]");
        try {
            return new JSONArray(json);
        } catch (JSONException error) {
            error.printStackTrace();
            return new JSONArray();
        }
    }

    private static boolean containsDay(JSONArray days, int target) {
        if (days == null) return false;
        for (int index = 0; index < days.length(); index++) {
            if (days.optInt(index, -1) == target) return true;
        }
        return false;
    }

    private static boolean canScheduleExactAlarms(AlarmManager manager) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms();
    }
}
