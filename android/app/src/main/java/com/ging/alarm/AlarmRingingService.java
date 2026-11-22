package com.ging.alarm;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.content.ContextCompat;

public class AlarmRingingService extends Service {

    public static final String ACTION_START = "com.ging.alarm.START_RINGING";
    public static final String ACTION_STOP = "com.ging.alarm.STOP_RINGING";
    public static final String EXTRA_ALARM_ID = "ging_alarm_id";
    public static final String EXTRA_SOUND_TYPE = "ging_sound_type";

    private static final String CHANNEL_ID = "ging_native_alarm";
    private static final String SERVICE_PREFERENCES = "ging_active_native_alarm";
    private static final String STORED_ALARM_ID = "alarmId";
    private static final String STORED_SOUND_TYPE = "soundType";
    private static final int NOTIFICATION_ID = 0x47494E47;
    private static final int SAMPLE_RATE = 44100;
    private static final int FRAMES_PER_WRITE = 1024;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile boolean shouldRing;
    private volatile String soundType = "industrial";
    private String alarmId;
    private AudioTrack audioTrack;
    private Thread audioThread;
    private PowerManager.WakeLock wakeLock;

    private final Runnable enforceVolume = new Runnable() {
        @Override
        public void run() {
            if (!shouldRing) return;
            setMaximumAlarmVolume();
            mainHandler.postDelayed(this, 400);
        }
    };

    public static void start(Context context, String alarmId, String soundType) {
        Intent intent = new Intent(context, AlarmRingingService.class)
            .setAction(ACTION_START)
            .putExtra(EXTRA_ALARM_ID, alarmId)
            .putExtra(EXTRA_SOUND_TYPE, soundType == null ? "industrial" : soundType);
        ContextCompat.startForegroundService(context, intent);
    }

    public static void stop(Context context) {
        context.getSharedPreferences(SERVICE_PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .clear()
            .apply();
        context.stopService(new Intent(context, AlarmRingingService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String requestedAlarmId = intent == null ? null : intent.getStringExtra(EXTRA_ALARM_ID);
        String requestedSound = intent == null ? null : intent.getStringExtra(EXTRA_SOUND_TYPE);
        boolean playbackChanged = requestedAlarmId != null
            && (!requestedAlarmId.equals(alarmId)
                || (isSupportedSound(requestedSound) && !requestedSound.equals(soundType)));
        if (playbackChanged) stopToneLoop();
        if (requestedAlarmId != null && !requestedAlarmId.trim().isEmpty()) alarmId = requestedAlarmId;
        if (isSupportedSound(requestedSound)) soundType = requestedSound;

        if (alarmId == null) {
            android.content.SharedPreferences preferences = getSharedPreferences(SERVICE_PREFERENCES, MODE_PRIVATE);
            alarmId = preferences.getString(STORED_ALARM_ID, null);
            String storedSound = preferences.getString(STORED_SOUND_TYPE, "industrial");
            if (isSupportedSound(storedSound)) soundType = storedSound;
        } else {
            getSharedPreferences(SERVICE_PREFERENCES, MODE_PRIVATE)
                .edit()
                .putString(STORED_ALARM_ID, alarmId)
                .putString(STORED_SOUND_TYPE, soundType)
                .apply();
        }

        if (alarmId == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        MainActivity.isAlarmActive = true;
        acquireWakeLock();
        setMaximumAlarmVolume();
        startForegroundCompat(buildAlarmNotification());
        if (!shouldRing) startToneLoop();
        mainHandler.removeCallbacks(enforceVolume);
        mainHandler.post(enforceVolume);
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacks(enforceVolume);
        stopToneLoop();
        releaseWakeLock();
        MainActivity.isAlarmActive = false;
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    private void startForegroundCompat(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildAlarmNotification() {
        Intent openAlarm = new Intent(this, MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .setData(Uri.parse("ging-alarm://open/" + Uri.encode(alarmId)))
            .putExtra(AlarmScheduler.EXTRA_ALARM_ID, alarmId)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            openAlarm,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        return builder
            .setSmallIcon(R.drawable.ic_stat_ging)
            .setContentTitle("Ging alarm is ringing")
            .setContentText("Scan your wake-up code to turn it off.")
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setPriority(Notification.PRIORITY_MAX)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager notificationManager = getSystemService(NotificationManager.class);
        if (notificationManager == null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Alarm is ringing",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Ongoing alert while Ging waits for the wake-up code.");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setSound(null, null);
        channel.enableVibration(false);
        notificationManager.createNotificationChannel(channel);
    }

    private void startToneLoop() {
        shouldRing = true;
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        AudioFormat format = new AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(SAMPLE_RATE)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build();

        int minimumBuffer = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        );
        int bufferBytes = Math.max(minimumBuffer, FRAMES_PER_WRITE * 4);

        try {
            audioTrack = new AudioTrack.Builder()
                .setAudioAttributes(attributes)
                .setAudioFormat(format)
                .setBufferSizeInBytes(bufferBytes)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build();
            audioTrack.setVolume(1f);
            audioTrack.play();

            AudioTrack track = audioTrack;
            String selectedSound = soundType;
            audioThread = new Thread(() -> writeAlarmAudio(track, selectedSound), "GingAlarmAudio");
            audioThread.setPriority(Thread.MAX_PRIORITY);
            audioThread.start();
        } catch (RuntimeException error) {
            shouldRing = false;
            if (audioTrack != null) {
                audioTrack.release();
                audioTrack = null;
            }
            error.printStackTrace();
        }
    }

    private void writeAlarmAudio(AudioTrack track, String selectedSound) {
        short[] samples = new short[FRAMES_PER_WRITE];
        long cursor = 0;
        try {
            while (shouldRing && track == audioTrack) {
                for (int index = 0; index < samples.length; index++) {
                    samples[index] = (short) (alarmSample(selectedSound, cursor + index) * 28000f);
                }
                int written = track.write(samples, 0, samples.length, AudioTrack.WRITE_BLOCKING);
                if (written < 0) break;
                cursor += written;
            }
        } catch (IllegalStateException error) {
            if (shouldRing) error.printStackTrace();
        }
    }

    private float alarmSample(String selectedSound, long frame) {
        double time = frame / (double) SAMPLE_RATE;
        if ("classic-beep".equals(selectedSound)) {
            double phase = time % 0.25;
            if (phase >= 0.18) return 0f;
            double fadeIn = Math.min(1d, phase * 30d);
            double fadeOut = Math.min(1d, (0.18d - phase) * 30d);
            return (float) (Math.sin(2d * Math.PI * 2500d * time) * fadeIn * fadeOut);
        }
        if ("air-horn".equals(selectedSound)) {
            double modulatedFrequency = 150d + 8d * Math.sin(2d * Math.PI * 8d * time);
            double first = sawtooth(time * modulatedFrequency);
            double second = sawtooth(time * 225d);
            return (float) ((first + second) * 0.45d);
        }

        double modulation = 40d * Math.sin(2d * Math.PI * 4d * time);
        double first = sawtooth(time * (880d + modulation));
        double second = Math.sin(2d * Math.PI * (885d + modulation) * time) >= 0d ? 1d : -1d;
        return (float) ((first + second) * 0.45d);
    }

    private static double sawtooth(double cycles) {
        return 2d * (cycles - Math.floor(cycles + 0.5d));
    }

    private synchronized void stopToneLoop() {
        shouldRing = false;
        AudioTrack track = audioTrack;
        audioTrack = null;
        if (track != null) {
            try {
                track.pause();
                track.flush();
                track.stop();
            } catch (IllegalStateException ignored) {
                // The audio thread may already have left playback.
            }
            track.release();
        }
        audioThread = null;
    }

    private void setMaximumAlarmVolume() {
        AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) return;
        setStreamToMaximum(audioManager, AudioManager.STREAM_ALARM);
        setStreamToMaximum(audioManager, AudioManager.STREAM_MUSIC);
    }

    private static void setStreamToMaximum(AudioManager audioManager, int stream) {
        int current = audioManager.getStreamVolume(stream);
        int maximum = audioManager.getStreamMaxVolume(stream);
        if (current < maximum) audioManager.setStreamVolume(stream, maximum, 0);
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager == null) return;
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Ging::AlarmRinging");
        wakeLock.acquire();
    }

    private void releaseWakeLock() {
        if (wakeLock == null) return;
        if (wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }

    private static boolean isSupportedSound(String soundType) {
        return "industrial".equals(soundType)
            || "classic-beep".equals(soundType)
            || "air-horn".equals(soundType);
    }
}
