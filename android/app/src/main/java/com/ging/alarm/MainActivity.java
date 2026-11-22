package com.ging.alarm;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.KeyEvent;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static boolean isAlarmActive = false;
    private static PowerManager.WakeLock cpuWakeLock = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register our custom standalone native permission, volume, and wake lock manager plugin BEFORE super.onCreate
        registerPlugin(GingAndroidPlugin.class);
        super.onCreate(savedInstanceState);

        // Configure system flags to allow showing over lockscreen and keeping screen awake
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
                            
        // Always acquire persistent CPU wake lock to ensure JS timer evaluations run 24/7
        acquireCpuWakeLock();
    }

    @Override
    public void onBackPressed() {
        if (isAlarmActive) {
            // Disable native hardware back button completely during alarm ringing
            return;
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            // Let the active web screen close its sheet or handle setup navigation first.
            getBridge().getWebView().evaluateJavascript(
                "(function(){var event=new CustomEvent('ging:back',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})()",
                handled -> {
                    if (!"true".equals(handled)) {
                        MainActivity.super.onBackPressed();
                    }
                }
            );
            return;
        }

        super.onBackPressed();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (isAlarmActive && event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_DOWN) {
            // Block only attempts to lower the alarm volume. Correct it once per press,
            // without repeatedly opening Android's system volume panel.
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                restoreAlarmVolume();
            }
            return true;
        }

        // Volume-up and all other keys retain the platform's normal behavior.
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onPause() {
        super.onPause();
        if (isAlarmActive) {
            // Absolute Lock: Relaunch app to foreground if they hit Home or Recents!
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | 
                             Intent.FLAG_ACTIVITY_NEW_TASK | 
                             Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(intent);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        releaseCpuWakeLock();
    }

    private void acquireCpuWakeLock() {
        try {
            if (cpuWakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    cpuWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Ging::CpuWakeLock");
                    cpuWakeLock.acquire();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void restoreAlarmVolume() {
        try {
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;

            int currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
            int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            if (currentVolume < maxVolume) {
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxVolume, 0);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void releaseCpuWakeLock() {
        try {
            if (cpuWakeLock != null && cpuWakeLock.isHeld()) {
                cpuWakeLock.release();
                cpuWakeLock = null;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
