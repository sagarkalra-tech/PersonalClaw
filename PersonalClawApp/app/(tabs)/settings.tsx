import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSecure, setSecure } from '../../services/secure-store';
import { socketService } from '../../services/socket';
import { checkServerStatus } from '../../services/api';
import { useConnectionStore } from '../../store';
import { SECURE_STORE_KEYS, DEFAULT_SERVER_URL } from '../../constants';
import { useAuthStore } from '../../store';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);
  const isConnected = useConnectionStore(s => s.isConnected);
  const setAuthenticated = useAuthStore(s => s.setAuthenticated);

  useEffect(() => {
    getSecure(SECURE_STORE_KEYS.SERVER_URL).then(url => {
      setServerUrl(url ?? DEFAULT_SERVER_URL);
    });
  }, []);

  async function saveServerUrl() {
    const url = serverUrl.trim().replace(/\/$/, '');
    await setSecure(SECURE_STORE_KEYS.SERVER_URL, url);
    await socketService.updateServerUrl(url);
    Alert.alert('Saved', 'Server URL updated. Reconnecting…');
  }

  async function testConnection() {
    setIsTesting(true);
    setTestResult(null);
    try {
      await checkServerStatus();
      setTestResult('success');
    } catch {
      setTestResult('fail');
    } finally {
      setIsTesting(false);
    }
  }

  function handleLock() {
    setAuthenticated(false);
    router.replace('/auth');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Server URL */}
      <SectionHeader title="Server" />
      <View style={styles.card}>
        <Text style={styles.label}>Server URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://192.168.1.x:3000"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.row}>
          <TouchableOpacity style={styles.btnSecondary} onPress={testConnection} disabled={isTesting}>
            <Text style={styles.btnSecondaryLabel}>
              {isTesting ? 'Testing…' : 'Test'}
            </Text>
            {testResult === 'success' && <Ionicons name="checkmark-circle" size={16} color="#22c55e" />}
            {testResult === 'fail' && <Ionicons name="close-circle" size={16} color="#ef4444" />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={saveServerUrl}>
            <Text style={styles.btnPrimaryLabel}>Save & Reconnect</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: isConnected ? '#22c55e' : '#ef4444' }]} />
          <Text style={styles.statusLabel}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
        </View>
      </View>

      {/* Security */}
      <SectionHeader title="Security" />
      <View style={styles.card}>
        <TouchableOpacity style={styles.menuItem} onPress={handleLock}>
          <Ionicons name="lock-closed-outline" size={20} color="#1a1a1a" />
          <Text style={styles.menuLabel}>Lock App</Text>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>
      </View>

      {/* App info */}
      <SectionHeader title="About" />
      <View style={styles.card}>
        <InfoRow label="App Version" value="1.0.0" />
        <InfoRow label="Package" value="com.personalclaw.app" />
      </View>
    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  input: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    fontFamily: 'monospace',
  },
  row: { flexDirection: 'row', gap: 8 },
  btnSecondary: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  btnSecondaryLabel: { fontSize: 14, fontWeight: '500', color: '#444' },
  btnPrimary: {
    flex: 2,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  btnPrimaryLabel: { fontSize: 14, fontWeight: '600', color: '#fff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 13, color: '#555' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  menuLabel: { flex: 1, fontSize: 15, color: '#1a1a1a' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: '#555' },
  infoValue: { fontSize: 14, color: '#1a1a1a', fontWeight: '500' },
});
