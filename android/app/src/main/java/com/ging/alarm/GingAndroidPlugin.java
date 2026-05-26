package com.ging.alarm;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GingAndroid")
public class GingAndroidPlugin extends Plugin {

    @PluginMethod
    public void setAlarmActive(PluginCall call) {
        boolean active = call.getBoolean("active", false);
        MainActivity.isAlarmActive = active;
        
        if (active) {
            // Force screen wake up and bring app directly over lockscreen to foreground
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                                                        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                                                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                                                        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
                    
                    // Wake screen matrices & reorder to top
                    Intent intent = new Intent(getContext(), MainActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | 
                                     Intent.FLAG_ACTIVITY_NEW_TASK | 
                                     Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    getContext().startActivity(intent);
                }
            });
        }
        call.resolve();
    }

    @PluginMethod
    public void forceMaxVolume(PluginCall call) {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                // Fetch device maximum media volume stream setting
                int maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                // Force the media volume to 100% full volume with standard notification banner
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxVolume, AudioManager.FLAG_SHOW_UI);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        call.resolve();
    }

    @PluginMethod
    public void checkBatteryBypass(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                boolean isIgnoring = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
                ret.put("granted", isIgnoring);
            } else {
                ret.put("granted", true);
            }
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBatteryBypass(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    boolean isIgnoring = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
                    if (!isIgnoring) {
                        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                // Fallback: Open general battery optimization settings screen if direct prompt throws errors
                try {
                    Intent fallbackIntent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(fallbackIntent);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("requested", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void checkOverlayPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            boolean canDraw = Settings.canDrawOverlays(getContext());
            ret.put("granted", canDraw);
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                if (!Settings.canDrawOverlays(getContext())) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, 
                                               Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                }
            } catch (Exception e) {
                e.printStackTrace();
                // Fallback: Open general display over other apps manage list if direct package fails
                try {
                    Intent fallbackIntent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                    fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(fallbackIntent);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("requested", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void saveBase64File(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType");

        if (base64Data == null || filename == null || mimeType == null) {
            call.reject("Missing required parameters: base64Data, filename, or mimeType");
            return;
        }

        try {
            byte[] bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
            Context context = getContext();
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Modern Scoped Storage (Android 10+)
                android.content.ContentValues values = new android.content.ContentValues();
                values.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, mimeType);
                
                Uri externalUri;
                if (mimeType.startsWith("image/")) {
                    values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_PICTURES + "/Ging");
                    externalUri = android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                } else {
                    values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS + "/Ging");
                    externalUri = android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                }

                android.content.ContentResolver resolver = context.getContentResolver();
                Uri fileUri = resolver.insert(externalUri, values);
                
                if (fileUri != null) {
                    java.io.OutputStream os = resolver.openOutputStream(fileUri);
                    if (os != null) {
                        os.write(bytes);
                        os.close();
                        
                        // Force a scanner broadcast refresh
                        Intent intent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                        intent.setData(fileUri);
                        context.sendBroadcast(intent);
                        
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("path", fileUri.toString());
                        call.resolve(ret);
                        return;
                    }
                }
                call.reject("Failed to create file via MediaStore");
            } else {
                // Legacy Storage (Android 9 and below)
                java.io.File publicDir;
                if (mimeType.startsWith("image/")) {
                    publicDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_PICTURES);
                } else {
                    publicDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                }
                
                java.io.File gingDir = new java.io.File(publicDir, "Ging");
                if (!gingDir.exists()) {
                    gingDir.mkdirs();
                }
                
                java.io.File file = new java.io.File(gingDir, filename);
                java.io.FileOutputStream fos = new java.io.FileOutputStream(file);
                fos.write(bytes);
                fos.close();
                
                // Force scan
                Intent intent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                intent.setData(Uri.fromFile(file));
                context.sendBroadcast(intent);
                
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("path", file.getAbsolutePath());
                call.resolve(ret);
            }
        } catch (Exception e) {
            e.printStackTrace();
            call.reject("Error saving file natively: " + e.getMessage());
        }
    }
}
