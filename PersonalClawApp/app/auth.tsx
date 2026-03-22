import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authenticateWithBiometric, isBiometricAvailable } from '../services/biometric';
import { getSecure, setSecure } from '../services/secure-store';
import { useAuthStore } from '../store';
import { SECURE_STORE_KEYS } from '../constants';

type Mode = 'biometric' | 'pin_entry' | 'pin_setup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('biometric');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);

  const setAuthenticated = useAuthStore(s => s.setAuthenticated);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const available = await isBiometricAvailable();
    setHasBiometric(available);

    if (available) {
      await triggerBiometric();
    } else {
      // Check if PIN is set up
      const existingPin = await getSecure(SECURE_STORE_KEYS.AUTH_PIN);
      setMode(existingPin ? 'pin_entry' : 'pin_setup');
    }
  }

  async function triggerBiometric() {
    setIsLoading(true);
    setError('');
    const result = await authenticateWithBiometric('Unlock PersonalClaw');
    setIsLoading(false);

    if (result.success) {
      onAuthSuccess();
    } else if (result.reason === 'cancelled') {
      // Show PIN fallback
      const existingPin = await getSecure(SECURE_STORE_KEYS.AUTH_PIN);
      setMode(existingPin ? 'pin_entry' : 'pin_setup');
    } else if (result.reason === 'not_enrolled') {
      const existingPin = await getSecure(SECURE_STORE_KEYS.AUTH_PIN);
      setMode(existingPin ? 'pin_entry' : 'pin_setup');
    }
  }

  function onAuthSuccess() {
    setSecure(SECURE_STORE_KEYS.LAST_AUTH_TIME, Date.now().toString());
    setAuthenticated(true);
    router.replace('/(tabs)');
  }

  async function handlePinSubmit() {
    if (mode === 'pin_setup') {
      if (pin.length < 4) {
        setError('PIN must be at least 4 digits');
        return;
      }
      if (pin !== confirmPin) {
        setError('PINs do not match');
        return;
      }
      await setSecure(SECURE_STORE_KEYS.AUTH_PIN, pin);
      onAuthSuccess();
    } else {
      const storedPin = await getSecure(SECURE_STORE_KEYS.AUTH_PIN);
      if (pin === storedPin) {
        onAuthSuccess();
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Logo */}
      <View style={styles.logoSection}>
        <View style={styles.logoCircle}>
          <Ionicons name="paw" size={48} color="#1a1a1a" />
        </View>
        <Text style={styles.appName}>PersonalClaw</Text>
        <Text style={styles.tagline}>Your AI command centre</Text>
      </View>

      {/* Auth UI */}
      {mode === 'biometric' && (
        <View style={styles.authSection}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#1a1a1a" />
          ) : (
            <TouchableOpacity style={styles.biometricBtn} onPress={triggerBiometric}>
              <Ionicons name="finger-print" size={56} color="#1a1a1a" />
              <Text style={styles.biometricLabel}>Tap to unlock</Text>
            </TouchableOpacity>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}

      {(mode === 'pin_entry' || mode === 'pin_setup') && (
        <View style={styles.authSection}>
          <Text style={styles.pinTitle}>
            {mode === 'pin_setup' ? 'Set up a PIN' : 'Enter your PIN'}
          </Text>
          <Text style={styles.pinSubtitle}>
            {mode === 'pin_setup'
              ? 'You can also use biometrics once enrolled in device settings'
              : ''}
          </Text>

          <TextInput
            style={styles.pinInput}
            placeholder="PIN"
            placeholderTextColor="#999"
            value={pin}
            onChangeText={v => { setPin(v); setError(''); }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
          />

          {mode === 'pin_setup' && (
            <TextInput
              style={styles.pinInput}
              placeholder="Confirm PIN"
              placeholderTextColor="#999"
              value={confirmPin}
              onChangeText={v => { setConfirmPin(v); setError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.pinSubmitBtn} onPress={handlePinSubmit}>
            <Text style={styles.pinSubmitLabel}>
              {mode === 'pin_setup' ? 'Set PIN & Enter' : 'Unlock'}
            </Text>
          </TouchableOpacity>

          {hasBiometric && mode === 'pin_entry' && (
            <TouchableOpacity onPress={triggerBiometric} style={styles.switchBtn}>
              <Ionicons name="finger-print" size={20} color="#666" />
              <Text style={styles.switchLabel}>Use biometrics instead</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 64,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: '#888',
    marginTop: 6,
  },
  authSection: {
    width: '100%',
    alignItems: 'center',
  },
  biometricBtn: {
    alignItems: 'center',
    gap: 16,
  },
  biometricLabel: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  pinSubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  pinInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  pinSubmitBtn: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  pinSubmitLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  switchLabel: {
    fontSize: 14,
    color: '#666',
  },
  error: {
    color: '#e53e3e',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
