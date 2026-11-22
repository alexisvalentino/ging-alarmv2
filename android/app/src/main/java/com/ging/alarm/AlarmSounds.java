package com.ging.alarm;

/** Shared native keys for the three alarm sounds exposed by the app. */
final class AlarmSounds {
    static final String INDUSTRIAL = "industrial";
    static final String CLASSIC_BEEP = "classic-beep";
    static final String AIR_HORN = "air-horn";

    private AlarmSounds() {}

    static boolean isSupported(String soundType) {
        return INDUSTRIAL.equals(soundType)
            || CLASSIC_BEEP.equals(soundType)
            || AIR_HORN.equals(soundType);
    }

    static String normalize(String soundType) {
        return isSupported(soundType) ? soundType : INDUSTRIAL;
    }
}
