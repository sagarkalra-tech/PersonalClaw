import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Worker } from '../types';

interface Props {
  workers: Worker[];
  visible: boolean;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  queued: '#94a3b8',
  running: '#f59e0b',
  completed: '#22c55e',
  failed: '#ef4444',
  timeout: '#f97316',
};

const STATUS_ICON: Record<string, string> = {
  queued: 'time-outline',
  running: 'sync-outline',
  completed: 'checkmark-circle-outline',
  failed: 'close-circle-outline',
  timeout: 'alert-circle-outline',
};

function elapsed(startedAt?: number): string {
  if (!startedAt) return '';
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function WorkerPanel({ workers, visible, onClose }: Props) {
  if (!visible) return null;

  const running = workers.filter(w => w.status === 'running' || w.status === 'queued');
  const done = workers.filter(w => w.status === 'completed' || w.status === 'failed' || w.status === 'timeout');

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Sub-Agents
          {running.length > 0 && <Text style={styles.badge}> · {running.length} active</Text>}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color="#888" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {workers.length === 0 && (
          <Text style={styles.empty}>No sub-agents yet</Text>
        )}
        {[...running, ...done].map(w => (
          <View key={w.id} style={styles.workerRow}>
            <Ionicons
              name={STATUS_ICON[w.status] as any}
              size={16}
              color={STATUS_COLOR[w.status]}
            />
            <View style={styles.workerInfo}>
              <Text style={styles.workerTask} numberOfLines={2}>{w.task}</Text>
              <View style={styles.workerMeta}>
                <Text style={[styles.workerStatus, { color: STATUS_COLOR[w.status] }]}>
                  {w.status}
                </Text>
                {w.status === 'running' && w.startedAt && (
                  <Text style={styles.workerElapsed}>{elapsed(w.startedAt)}</Text>
                )}
                {w.error && (
                  <Text style={styles.workerError} numberOfLines={1}>{w.error}</Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    maxHeight: 220,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  badge: { color: '#f59e0b' },
  list: { paddingHorizontal: 12, paddingVertical: 4 },
  empty: { fontSize: 13, color: '#aaa', padding: 12, textAlign: 'center' },
  workerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
    alignItems: 'flex-start',
  },
  workerInfo: { flex: 1 },
  workerTask: { fontSize: 13, color: '#1a1a1a', lineHeight: 18 },
  workerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  workerStatus: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  workerElapsed: { fontSize: 11, color: '#aaa' },
  workerError: { fontSize: 11, color: '#ef4444', flex: 1 },
});
