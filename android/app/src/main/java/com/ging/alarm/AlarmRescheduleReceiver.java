package com.ging.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Restores exact alarm entries after boot and recalculates them after clock changes. */
public class AlarmRescheduleReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
            || AlarmManagerActions.EXACT_ALARM_PERMISSION_CHANGED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            AlarmScheduler.restore(context);
        }
    }

    private static final class AlarmManagerActions {
        private static final String EXACT_ALARM_PERMISSION_CHANGED =
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED";
    }
}
