import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricResult =
  | { success: true }
  | { success: false; reason: 'not_enrolled' | 'not_available' | 'cancelled' | 'failed' };

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticateWithBiometric(reason = 'Unlock PersonalClaw'): Promise<BiometricResult> {
  const available = await isBiometricAvailable();

  if (!available) {
    return { success: false, reason: 'not_enrolled' };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false, // allow PIN/pattern as device fallback
    fallbackLabel: 'Use PIN',
  });

  if (result.success) return { success: true };
  if (result.error === 'user_cancel' || result.error === 'system_cancel') {
    return { success: false, reason: 'cancelled' };
  }
  return { success: false, reason: 'failed' };
}

export async function getSupportedBiometricTypes(): Promise<string[]> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return types.map(t => {
    if (t === LocalAuthentication.AuthenticationType.FINGERPRINT) return 'Fingerprint';
    if (t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return 'Face ID';
    return 'Biometric';
  });
}
