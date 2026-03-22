import { useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActivityStore } from '../../store';
import type { ActivityItem } from '../../types';

// Map event type prefixes to icon + color
function typeStyle(type: string): { icon: string; color: string; bg: string } {
  if (type.startsWith('org:blocker'))  return { icon: 'warning',              color: '#dc2626', bg: '#fef2f2' };
  if (type.startsWith('org:proposal')) return { icon: 'document-text',        color: '#7c3aed', bg: '#f5f3ff' };
  if (type.startsWith('org:ticket'))   return { icon: 'layers',               color: '#2563eb', bg: '#eff6ff' };
  if (type.startsWith('org:agent'))    return { icon: 'person-circle',         color: '#0891b2', bg: '#ecfeff' };
  if (type.startsWith('org:'))         return { icon: 'business',              color: '#6366f1', bg: '#eef2ff' };
  if (type.startsWith('agent:'))       return { icon: 'hardware-chip',         color: '#059669', bg: '#ecfdf5' };
  if (type.startsWith('tool'))         return { icon: 'construct',             color: '#d97706', bg: '#fffbeb' };
  if (type.startsWith('chat') || type.startsWith('conversation'))
                                       return { icon: 'chatbubble-ellipses',   color: '#0369a1', bg: '#f0f9ff' };
  if (type.includes('error') || type.includes('fail'))
                                       return { icon: 'close-circle',          color: '#dc2626', bg: '#fef2f2' };
  return                               { icon: 'ellipse',                      color: '#94a3b8', bg: '#f8fafc' };
}

function timeLabel(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { icon, color, bg } = typeStyle(item.type);
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.source} numberOfLines={1}>{item.source}</Text>
          <Text style={styles.time}>{timeLabel(item.timestamp)}</Text>
        </View>
        <Text style={styles.summary} numberOfLines={3}>{item.summary}</Text>
        <Text style={styles.typePill}>{item.type}</Text>
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const items = useActivityStore(s => s.items);
  const clearItems = useActivityStore(s => s.setItems);
  const listRef = useRef<FlatList>(null);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <View style={styles.headerRight}>
          {items.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => clearItems([])}>
              <Ionicons name="trash-outline" size={16} color="#aaa" />
            </TouchableOpacity>
          )}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{items.length}</Text>
          </View>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="pulse-outline" size={44} color="#ddd" />
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptySub}>Events will appear here in real time</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <ActivityRow item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clearBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center', justifyContent: 'center',
  },
  countBadge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 10,
    minWidth: 28, alignItems: 'center',
  },
  countText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#888' },
  emptySub: { fontSize: 13, color: '#bbb' },
  list: { padding: 12, paddingBottom: 30 },
  separator: { height: 6 },
  row: {
    flexDirection: 'row', gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  source: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 6 },
  time: { fontSize: 11, color: '#bbb' },
  summary: { fontSize: 13, color: '#555', lineHeight: 18 },
  typePill: { fontSize: 10, color: '#aaa', fontFamily: 'monospace', marginTop: 2 },
});
