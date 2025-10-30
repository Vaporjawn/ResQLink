/**
 * ResQLink - Haptic Feedback Service
 * Provides consistent haptic feedback across the app
 * Respects user's reduced motion preference
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * Check if haptics are available on this platform
 */
const isHapticsAvailable = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Check if reduced motion is preferred (accessibility)
 */
const shouldReduceMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Light haptic feedback for subtle interactions
 * Use for: Button taps, item selection, toggle switches
 */
export const hapticLight = async (): Promise<void> => {
  if (!isHapticsAvailable() || shouldReduceMotion()) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Medium haptic feedback for standard interactions
 * Use for: List item taps, tab switches, modal open/close
 */
export const hapticMedium = async (): Promise<void> => {
  if (!isHapticsAvailable() || shouldReduceMotion()) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Heavy haptic feedback for important interactions
 * Use for: Delete actions, error states, important confirmations
 */
export const hapticHeavy = async (): Promise<void> => {
  if (!isHapticsAvailable() || shouldReduceMotion()) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Success haptic notification
 * Use for: Successful operations, confirmations, completions
 */
export const hapticSuccess = async (): Promise<void> => {
  if (!isHapticsAvailable() || shouldReduceMotion()) return;

  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Warning haptic notification
 * Use for: Warning states, non-critical alerts
 */
export const hapticWarning = async (): Promise<void> => {
  if (!isHapticsAvailable() || shouldReduceMotion()) return;

  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Error haptic notification
 * Use for: Error states, failed operations, critical alerts
 */
export const hapticError = async (): Promise<void> => {
  if (!isHapticsAvailable() || shouldReduceMotion()) return;

  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Emergency haptic pattern
 * Use for: SOS triggers, emergency alerts (triple heavy impact)
 */
export const hapticEmergency = async (): Promise<void> => {
  if (!isHapticsAvailable() || shouldReduceMotion()) return;

  try {
    // Triple heavy impact for urgency
    await Haptics.impact({ style: ImpactStyle.Heavy });
    await new Promise(resolve => setTimeout(resolve, 100));
    await Haptics.impact({ style: ImpactStyle.Heavy });
    await new Promise(resolve => setTimeout(resolve, 100));
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Selection change haptic
 * Use for: Incrementing/decrementing values, slider changes
 */
export const hapticSelectionChange = async (): Promise<void> => {
  if (!isHapticsAvailable() || shouldReduceMotion()) return;

  try {
    await Haptics.selectionChanged();
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Vibration pattern for custom feedback
 * Use for: Custom patterns not covered by standard haptics
 */
export const hapticVibrate = async (duration: number = 200): Promise<void> => {
  if (!isHapticsAvailable() || shouldReduceMotion()) return;

  try {
    await Haptics.vibrate({ duration });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

export default {
  light: hapticLight,
  medium: hapticMedium,
  heavy: hapticHeavy,
  success: hapticSuccess,
  warning: hapticWarning,
  error: hapticError,
  emergency: hapticEmergency,
  selectionChange: hapticSelectionChange,
  vibrate: hapticVibrate
};
