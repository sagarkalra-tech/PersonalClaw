import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useOrgStore } from '../../store';
import { socketService } from '../../services/socket';
import type { Org } from '../../types';

export default function OrgsScreen() {
  const orgs = useOrgStore(s => s.orgs);
  const upsertOrg = useOrgStore(s => s.upsertOrg);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    socketService.send('org:list', {});

    const unsub = socketService.on('org:list', (data: any) => {
      const list: Org[] = Array.isArray(data) ? data : [];
      list.forEach(o => upsertOrg(o));
      setRefreshing(false);
    });
    return () => unsub();
  }, []);

  function refresh() {
    setRefreshing(true);
    socketService.send('org:list', {});
  }

  function togglePause(org: Org) {
    socketService.send('org:update', {
      orgId: org.id,
      updates: { paused: !org.paused },
    });
  }

  function openOrg(org: Org) {
    router.push(`/org/${org.id}`);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={orgs}
        keyExtractor={o => o.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        contentContainerStyle={orgs.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={44} color="#ddd" />
            <Text style={styles.emptyText}>No organisations yet</Text>
            <Text style={styles.emptySub}>Create one from the dashboard</Text>
          </View>
        }
        renderItem={({ item: org }) => (
          <TouchableOpacity style={styles.card} onPress={() => openOrg(org)} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
              <View style={styles.cardLeft}>
                <View style={[styles.pauseDot, { backgroundColor: org.paused ? '#aaa' : '#22c55e' }]} />
                <Text style={styles.orgName}>{org.name}</Text>
              </View>
              <Switch
                value={!org.paused}
                onValueChange={() => togglePause(org)}
                trackColor={{ false: '#e0e0e0', true: '#bbf7d0' }}
                thumbColor={org.paused ? '#aaa' : '#22c55e'}
                style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
              />
            </View>

            <Text style={styles.mission} numberOfLines={2}>{org.mission}</Text>

            <View style={styles.cardFooter}>
              <View style={styles.pill}>
                <Ionicons name="people-outline" size={13} color="#666" />
                <Text style={styles.pillLabel}>{org.agents.length} agent{org.agents.length !== 1 ? 's' : ''}</Text>
              </View>
              {org.agents.filter(a => !a.paused).length > 0 && (
                <View style={[styles.pill, styles.pillActive]}>
                  <View style={styles.pillDot} />
                  <Text style={[styles.pillLabel, styles.pillLabelActive]}>
                    {org.agents.filter(a => !a.paused).length} active
                  </Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color="#ccc" style={styles.chevron} />
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 12, gap: 10 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#888' },
  emptySub: { fontSize: 13, color: '#bbb' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pauseDot: { width: 8, height: 8, borderRadius: 4 },
  orgName: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  mission: { fontSize: 13, color: '#666', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: '#f0f0f0', borderRadius: 10,
  },
  pillActive: { backgroundColor: '#f0fdf4' },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  pillLabel: { fontSize: 12, color: '#555', fontWeight: '500' },
  pillLabelActive: { color: '#16a34a' },
  chevron: { marginLeft: 'auto' },
});
