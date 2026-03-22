import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrgStore } from '../../store';
import AgentsView from '../../components/orgs/AgentsView';
import TicketsView from '../../components/orgs/TicketsView';
import ProposalsView from '../../components/orgs/ProposalsView';
import BlockersView from '../../components/orgs/BlockersView';
import MemoryView from '../../components/orgs/MemoryView';

type Tab = 'agents' | 'tickets' | 'proposals' | 'blockers' | 'memory';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'agents',    label: 'Agents',    icon: 'people-outline' },
  { key: 'tickets',   label: 'Tickets',   icon: 'layers-outline' },
  { key: 'proposals', label: 'Proposals', icon: 'document-text-outline' },
  { key: 'blockers',  label: 'Blockers',  icon: 'warning-outline' },
  { key: 'memory',    label: 'Memory',    icon: 'library-outline' },
];

export default function OrgDetailScreen() {
  const { orgId, tab } = useLocalSearchParams<{ orgId: string; tab?: string }>();
  const org = useOrgStore(s => s.orgs.find(o => o.id === orgId));
  const [activeTab, setActiveTab] = useState<Tab>('agents');

  // Deep-link from push notification can specify a tab
  useEffect(() => {
    const validTabs: Tab[] = ['agents', 'tickets', 'proposals', 'blockers', 'memory'];
    if (tab && validTabs.includes(tab as Tab)) {
      setActiveTab(tab as Tab);
    }
  }, [tab]);

  if (!org) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={40} color="#ddd" />
          <Text style={styles.notFoundText}>Organisation not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
          <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.statusDot, { backgroundColor: org.paused ? '#aaa' : '#22c55e' }]} />
          <Text style={styles.headerTitle} numberOfLines={1}>{org.name}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Mission strip */}
      {org.mission && (
        <View style={styles.missionStrip}>
          <Text style={styles.missionText} numberOfLines={2}>{org.mission}</Text>
        </View>
      )}

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={activeTab === tab.key ? '#1a1a1a' : '#aaa'}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'agents'    && <AgentsView org={org} />}
        {activeTab === 'tickets'   && <TicketsView orgId={org.id} />}
        {activeTab === 'proposals' && <ProposalsView orgId={org.id} />}
        {activeTab === 'blockers'  && <BlockersView orgId={org.id} />}
        {activeTab === 'memory'    && <MemoryView org={org} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backArrow: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, backgroundColor: '#f5f5f5',
  },
  headerCenter: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', flex: 1, textAlign: 'center' },
  missionStrip: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  missionText: { fontSize: 13, color: '#888', lineHeight: 18 },
  tabBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#f5f5f5',
  },
  tabActive: { backgroundColor: '#1a1a1a' },
  tabLabel: { fontSize: 13, color: '#aaa', fontWeight: '500' },
  tabLabelActive: { color: '#fff', fontWeight: '600' },
  content: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16, color: '#888', fontWeight: '600' },
  backBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
