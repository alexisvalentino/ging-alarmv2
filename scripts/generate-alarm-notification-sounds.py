"""Generate the three short iOS notification clips from the app's alarm tones."""

from math import floor, pi, sin
from pathlib import Path
import wave
import struct


SAMPLE_RATE = 44_100
DURATION_SECONDS = 3
FRAME_COUNT = SAMPLE_RATE * DURATION_SECONDS
ANDROID_FULL_SCALE = 28_000 / 32_767
ROOT = Path(__file__).resolve().parents[1]


def sawtooth(cycles: float) -> float:
    return 2 * (cycles - floor(cycles + 0.5))


def sample_for(sound: str, frame: int) -> float:
    time = frame / SAMPLE_RATE

    if sound == "classic-beep":
        phase = time % 0.25
        if phase >= 0.18:
            return 0.0
        fade_in = min(1.0, phase * 30)
        fade_out = min(1.0, (0.18 - phase) * 30)
        return sin(2 * pi * 2500 * time) * fade_in * fade_out

    if sound == "air-horn":
        modulated_frequency = 150 + 8 * sin(2 * pi * 8 * time)
        first = sawtooth(time * modulated_frequency)
        second = sawtooth(time * 225)
        return (first + second) * 0.45

    modulation = 40 * sin(2 * pi * 4 * time)
    first = sawtooth(time * (880 + modulation))
    second = 1.0 if sin(2 * pi * (885 + modulation) * time) >= 0 else -1.0
    return (first + second) * 0.45


def write_clip(sound: str, filename: str) -> None:
    output = ROOT / "public" / filename
    with wave.open(str(output), "wb") as audio_file:
        audio_file.setnchannels(1)
        audio_file.setsampwidth(2)
        audio_file.setframerate(SAMPLE_RATE)

        frames = bytearray()
        for frame in range(FRAME_COUNT):
            edge_fade = min(1.0, frame / (SAMPLE_RATE * 0.008), (FRAME_COUNT - 1 - frame) / (SAMPLE_RATE * 0.02))
            value = max(-1.0, min(1.0, sample_for(sound, frame) * edge_fade * ANDROID_FULL_SCALE))
            frames.extend(struct.pack("<h", round(value * 32_767)))

        audio_file.writeframes(frames)


if __name__ == "__main__":
    write_clip("industrial", "ging-industrial.wav")
    write_clip("classic-beep", "ging-classic-beep.wav")
    write_clip("air-horn", "ging-air-horn.wav")
