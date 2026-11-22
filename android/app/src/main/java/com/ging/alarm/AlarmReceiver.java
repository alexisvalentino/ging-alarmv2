package com.ging.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Exact AlarmManager entry point: start ringing before any notification is tapped. */
public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !AlarmScheduler.ACTION_FIRE_ALARM.equals(intent.getAction())) return;

        String alarmId = intent.getStringExtra(AlarmScheduler.EXTRA_ALARM_ID);
        if (alarmId == null || alarmId.trim().isEmpty()) return;

        String soundType = intent.getStringExtra(AlarmScheduler.EXTRA_SOUND_TYPE);
        int dayIndex = intent.getIntExtra(AlarmScheduler.EXTRA_ALARM_DAY, -1);

        AlarmRingingService.start(context, alarmId, soundType);
        AlarmScheduler.scheduleNextOccurrence(context, alarmId, dayIndex);
    }
}
