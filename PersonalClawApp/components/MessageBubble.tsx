import { View, Text, StyleSheet } from 'react-native';
import Markdown from '@ronradtke/react-native-markdown-display';
import type { Message } from '../types';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.assistantRow}>
      <View style={styles.assistantBubble}>
        <Markdown style={markdownStyles}>{message.content}</Markdown>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  userBubble: {
    backgroundColor: '#1a1a1a',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
  },
  assistantRow: {
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  assistantBubble: {
    backgroundColor: '#f5f5f5',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '88%',
  },
});

const markdownStyles = {
  body: { fontSize: 15, lineHeight: 22, color: '#1a1a1a' },
  paragraph: { marginTop: 0, marginBottom: 6 },
  strong: { fontWeight: '700' as const },
  em: { fontStyle: 'italic' as const },
  heading1: { fontSize: 20, fontWeight: '700' as const, marginBottom: 8, color: '#1a1a1a' },
  heading2: { fontSize: 17, fontWeight: '700' as const, marginBottom: 6, color: '#1a1a1a' },
  heading3: { fontSize: 15, fontWeight: '700' as const, marginBottom: 4, color: '#1a1a1a' },
  code_inline: {
    fontFamily: 'monospace',
    backgroundColor: '#e8e8e8',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 13,
    color: '#c7254e',
  },
  fence: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
  },
  code_block: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#d4d4d4',
    lineHeight: 20,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#ccc',
    paddingLeft: 12,
    marginLeft: 0,
    color: '#666',
  },
  bullet_list: { marginBottom: 6 },
  ordered_list: { marginBottom: 6 },
  list_item: { marginBottom: 2 },
  link: { color: '#2563eb', textDecorationLine: 'underline' as const },
  hr: { backgroundColor: '#e0e0e0', height: 1, marginVertical: 12 },
  table: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 6, marginVertical: 8 },
  th: { backgroundColor: '#f0f0f0', padding: 8, fontWeight: '700' as const, fontSize: 13 },
  td: { padding: 8, fontSize: 13, borderTopWidth: 1, borderColor: '#e0e0e0' },
};
