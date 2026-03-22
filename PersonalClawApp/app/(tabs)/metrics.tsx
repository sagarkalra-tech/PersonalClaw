import { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMetricsStore } from '../../store';

function parseGB(s: string): number {
  // Accepts "3.2 GB", "3200 MB", "1024 KB", or plain number
  if (!s) return 0;
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  const lower = s.toLowerCase();
  if (lower.includes('tb')) return n * 1024;
  if (lower.includes('gb')) return n;
  if (lower.includes('mb')) return n / 1024;
  if (lower.includes('kb')) return n / (1024 * 1024);
  return n;
}

function formatGB(gb: number): string {
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(gb * 1024).toFixed(0)} MB`;
}

// Animated gauge bar
function GaugeBar({
  pct, color, trackColor = '#f0f0f0',
}: { pct: number; color: string; trackColor?: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(Math.max(pct, 0), 100),
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.track, { backgroundColor: trackColor }]}>
      <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

function metricColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#22c55e';
}

// Big circular-ish CPU display
function CpuRing({ pct }: { pct: number }) {
  const color = metricColor(pct);
  return (
    <View style={styles.cpuRing}>
      <View style={[styles.cpuCircle, { borderColor: color }]}>
        <Text style={[styles.cpuPct, { color }]}>{pct.toFixed(0)}</Text>
        <Text style={styles.cpuUnit}>%</Text>
      </View>
      <Text style={styles.cpuLabel}>CPU</Text>
    </View>
  );
}

export default function MetricsScreen() {
  const m = useMetricsStore(s => s.metrics);

  const ramUsed = parseGB(m.ram);
  const ramTotal = parseGB(m.totalRam);
  const diskUsed = parseGB(m.disk);
  const diskTotal = parseGB(m.totalDisk);

  const ramPct = ramTotal > 0 ? (ramUsed / ramTotal) * 100 : 0;
  const diskPct = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Metrics</Text>
        <View style={styles.liveDot} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* CPU */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="speedometer-outline" size={20} color="#6366f1" />
            </View>
            <Text style={styles.cardTitle}>CPU Usage</Text>
          </View>
          <CpuRing pct={m.cpu} />
          <GaugeBar pct={m.cpu} color={metricColor(m.cpu)} />
          <Text style={styles.gaugeNote}>{m.cpu.toFixed(1)}% utilisation</Text>
        </View>

        {/* RAM */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#ecfdf5' }]}>
              <Ionicons name="server-outline" size={20} color="#059669" />
            </View>
            <Text style={styles.cardTitle}>Memory (RAM)</Text>
            <Text style={styles.cardPct}>{ramPct.toFixed(0)}%</Text>
          </View>
          <GaugeBar pct={ramPct} color={metricColor(ramPct)} />
          <View style={styles.statRow}>
            <StatChip label="Used"  value={formatGB(ramUsed)}  color="#059669" />
            <StatChip label="Free"  value={formatGB(Math.max(ramTotal - ramUsed, 0))} color="#94a3b8" />
            <StatChip label="Total" value={formatGB(ramTotal)} color="#1a1a1a" />
          </View>
        </View>

        {/* Disk */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#fffbeb' }]}>
              <Ionicons name="save-outline" size={20} color="#d97706" />
            </View>
            <Text style={styles.cardTitle}>Disk Storage</Text>
            <Text style={styles.cardPct}>{diskPct.toFixed(0)}%</Text>
          </View>
          <GaugeBar pct={diskPct} color={metricColor(diskPct)} />
          <View style={styles.statRow}>
            <StatChip label="Used"  value={formatGB(diskUsed)}  color="#d97706" />
            <StatChip label="Free"  value={formatGB(Math.max(diskTotal - diskUsed, 0))} color="#94a3b8" />
            <StatChip label="Total" value={formatGB(diskTotal)} color="#1a1a1a" />
          </View>
        </View>

        <Text style={styles.footer}>Updates live via socket · pull to see latest</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  liveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e',
  },
  content: { padding: 12, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16, padding: 16, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  cardPct: { fontSize: 15, fontWeight: '700', color: '#888' },
  track: {
    height: 10, borderRadius: 6, overflow: 'hidden',
  },
  fill: {
    height: '100%', borderRadius: 6,
  },
  gaugeNote: { fontSize: 13, color: '#888', textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 10,
    paddingVertical: 8, alignItems: 'center', gap: 2,
  },
  chipLabel: { fontSize: 11, color: '#aaa', fontWeight: '500' },
  chipValue: { fontSize: 14, fontWeight: '700' },
  cpuRing: { alignItems: 'center', gap: 6 },
  cpuCircle: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 6,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 1,
  },
  cpuPct: { fontSize: 30, fontWeight: '800' },
  cpuUnit: { fontSize: 14, color: '#aaa', alignSelf: 'flex-end', marginBottom: 6 },
  cpuLabel: { fontSize: 13, color: '#888', fontWeight: '500' },
  footer: { fontSize: 12, color: '#ccc', textAlign: 'center', marginTop: 4 },
});
