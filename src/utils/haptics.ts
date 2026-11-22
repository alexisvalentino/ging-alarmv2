import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const runNativeHaptic = async (action: () => Promise<void>) => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await action();
  } catch {
    // Haptics are optional device feedback; never interrupt an alarm workflow.
  }
};

export const startSelectionHaptic = () => runNativeHaptic(() => Haptics.selectionStart());
export const changeSelectionHaptic = () => runNativeHaptic(() => Haptics.selectionChanged());
export const endSelectionHaptic = () => runNativeHaptic(() => Haptics.selectionEnd());
export const selectionTickHaptic = () => runNativeHaptic(async () => {
  await Haptics.selectionStart();
  await Haptics.selectionChanged();
  await Haptics.selectionEnd();
});
export const lightHaptic = () => runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }));
export const successHaptic = () => runNativeHaptic(() => Haptics.notification({ type: NotificationType.Success }));
