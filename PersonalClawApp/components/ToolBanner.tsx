import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { ToolUpdate } from '../types';

interface Props {
  toolFeed: ToolUpdate[];
}

// Format tool name: "browser_navigate" → "Browser Navigate"
function formatTool(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

export default function ToolBanner({ toolFeed }: Props) {
  const [elapsed, setElapsed] = useState(0);

  // Find the active tool: last 'started' entry that has no subsequent 'completed' for same tool+timestamp
  const activeTool: ToolUpdate | null = (() => {
    for (let i = toolFeed.length - 1; i >= 0; i--) {
      const item = toolFeed[i];
      if (item.type === 'started') return item;
      if (item.type === 'completed' || item.type === 'failed') return null;
    }
    return null;
  })();

  // Most recently completed tool (for brief flash after completion)
  const lastCompleted: ToolUpdate | null = (() => {
    for (let i = toolFeed.length - 1; i >= 0; i--) {
      if (toolFeed[i].type === 'completed' || toolFeed[i].type === 'failed') return toolFeed[i];
    }
    return null;
  })();

  useEffect(() => {
    if (!activeTool) { setElapsed(0); return; }
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Date.now() - activeTool.timestamp);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTool?.timestamp]);

  if (!activeTool && !lastCompleted) return null;

  if (activeTool) {
    return (
      <View style={styles.banner}>
        <View style={styles.pulse} />
        <Text style={styles.label} numberOfLines={1}>
          {formatTool(activeTool.tool)}
        </Text>
        <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
      </View>
    );
  }

  // Brief completed state — shown until thinking ends
  return (
    <View style={[styles.banner, styles.bannerDone]}>
      <Text style={styles.doneIcon}>✓</Text>
      <Text style={[styles.label, styles.labelDone]} numberOfLines={1}>
        {formatTool(lastCompleted!.tool)}
      </Text>
      {lastCompleted!.durationMs !== undefined && (
        <Text style={styles.elapsed}>{formatElapsed(lastCompleted!.durationMs)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: '#fffbeb',
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
  },
  bannerDone: {
    backgroundColor: '#f0fdf4',
    borderTopColor: '#bbf7d0',
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  doneIcon: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '700',
  },
  label: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
  },
  labelDone: {
    color: '#15803d',
  },
  elapsed: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
});
