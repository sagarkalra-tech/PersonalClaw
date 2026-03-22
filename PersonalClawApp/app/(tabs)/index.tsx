import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Pressable, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatStore, useConnectionStore, EMPTY_ARR } from '../../store';
import { socketService } from '../../services/socket';
import { transcribeAudio } from '../../services/voice';
import MessageBubble from '../../components/MessageBubble';
import TypingIndicator from '../../components/TypingIndicator';
import ToolBanner from '../../components/ToolBanner';
import WorkerPanel from '../../components/WorkerPanel';
import type { Message } from '../../types';

type RecordingState = 'idle' | 'recording' | 'transcribing';

export default function ChatScreen() {
  // ── Store ────────────────────────────────────────────────────────────
  const conversations = useChatStore(s => s.conversations);
  const activeId = useChatStore(s => s.activeConversationId);
  const messages = useChatStore(s => s.messages[activeId ?? ''] ?? EMPTY_ARR);
  const toolFeed = useChatStore(s => s.toolFeed[activeId ?? ''] ?? EMPTY_ARR);
  const workers = useChatStore(s => s.workers[activeId ?? ''] ?? EMPTY_ARR);
  const isThinking = useChatStore(s => activeId ? (s.isThinking[activeId] ?? false) : false);
  const setActiveConversation = useChatStore(s => s.setActiveConversation);
  const setConversations = useChatStore(s => s.setConversations);
  const addMessage = useChatStore(s => s.addMessage);
  const setMessages = useChatStore(s => s.setMessages);
  const setThinking = useChatStore(s => s.setThinking);
  const clearToolFeed = useChatStore(s => s.clearToolFeed);
  const isConnected = useConnectionStore(s => s.isConnected);

  // ── Local state ──────────────────────────────────────────────────────
  const [inputText, setInputText] = useState('');
  const [inputHeight, setInputHeight] = useState(40);
  const [showWorkers, setShowWorkers] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState<Set<string>>(new Set());
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [pendingImage, setPendingImage] = useState<string | null>(null); // base64
  const listRef = useRef<FlatList>(null);

  // ── Audio recorder ───────────────────────────────────────────────────
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Init: select first convo or create one ───────────────────────────
  useEffect(() => {
    if (conversations.length > 0 && !activeId) {
      setActiveConversation(conversations[0].id);
    } else if (conversations.length === 0 && isConnected) {
      socketService.send('conversation:create', {});
    }
  }, [conversations, isConnected]);

  // ── Load history when switching conversation ──────────────────────────
  useEffect(() => {
    if (!activeId || historyLoaded.has(activeId)) return;
    socketService.send('conversation:history', { conversationId: activeId });
  }, [activeId]);

  // ── Socket: conversation-specific events ─────────────────────────────
  useEffect(() => {
    const unsubs = [
      socketService.on('conversation:history', (data: any) => {
        const { conversationId, messages: raw } = data;
        if (!Array.isArray(raw)) return;
        const normalized: Message[] = raw.map((m: any) => ({
          role: (m.role === 'model' ? 'assistant' : m.role) as 'user' | 'assistant',
          content: m.text ?? m.content ?? '',
          timestamp: m.timestamp ?? Date.now(),
        }));
        setMessages(conversationId, normalized);
        setHistoryLoaded(prev => new Set(prev).add(conversationId));
      }),

      socketService.on('conversation:created', (convo: any) => {
        setActiveConversation(convo.id);
        setHistoryLoaded(prev => new Set(prev).add(convo.id));
      }),

      socketService.on('conversation:closed', ({ conversationId }: any) => {
        const state = useChatStore.getState();
        const remaining = state.conversations.filter(c => c.id !== conversationId);
        setConversations(remaining);
        if (state.activeConversationId === conversationId) {
          setActiveConversation(remaining[0]?.id ?? null);
        }
      }),

      // TTS — speak new AI responses
      socketService.on('response', (data: any) => {
        if (ttsEnabled && data.text && !data.isError && !data.isAborted) {
          Speech.stop();
          Speech.speak(data.text, { language: 'en-US', rate: 1.05, pitch: 1.0 });
        }
      }),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [ttsEnabled]);

  // ── Send message ──────────────────────────────────────────────────────
  const sendMessage = useCallback((overrideText?: string, overrideImage?: string | null) => {
    const text = (overrideText ?? inputText).trim();
    const image = overrideImage !== undefined ? overrideImage : pendingImage;
    if (!text || !activeId) return;

    setInputText('');
    setInputHeight(40);
    setPendingImage(null);
    addMessage(activeId, { role: 'user', content: text, timestamp: Date.now() });
    setThinking(activeId, true);
    clearToolFeed(activeId);
    setShowWorkers(false);
    Speech.stop();

    socketService.send('message', {
      text,
      conversationId: activeId,
      ...(image ? { image: `data:image/jpeg;base64,${image}` } : {}),
    });
  }, [inputText, activeId, pendingImage]);

  // ── Abort ─────────────────────────────────────────────────────────────
  const abort = useCallback(() => {
    if (!activeId) return;
    socketService.send('conversation:abort', { conversationId: activeId });
    setThinking(activeId, false);
    Speech.stop();
  }, [activeId]);

  // ── Conversation management ───────────────────────────────────────────
  const createConversation = () => {
    if (conversations.length >= 3) return;
    socketService.send('conversation:create', {});
  };
  const closeConversation = (id: string) => {
    socketService.send('conversation:close', { conversationId: id });
  };
  const selectConversation = (id: string) => {
    if (id === activeId) return;
    setActiveConversation(id);
    if (!historyLoaded.has(id)) {
      socketService.send('conversation:history', { conversationId: id });
    }
  };

  // ── Voice recording ───────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Microphone access is required for voice input.');
        return;
      }
      setRecordingState('recording');
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err) {
      console.warn('[Voice] Start error:', err);
      setRecordingState('idle');
    }
  };

  const stopRecording = async () => {
    if (recordingState !== 'recording') return;
    setRecordingState('transcribing');
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) { setRecordingState('idle'); return; }

      const text = await transcribeAudio(uri);
      if (text) {
        setInputText(prev => prev ? `${prev} ${text}` : text);
      }
    } catch (err) {
      console.warn('[Voice] Transcription error:', err);
      Alert.alert('Transcription failed', 'Could not transcribe audio. Try again.');
    } finally {
      setRecordingState('idle');
    }
  };

  // ── Image picker ──────────────────────────────────────────────────────
  const pickImage = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission needed', 'Photo library access is required to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPendingImage(result.assets[0].base64);
    }
  };

  const activeWorkerCount = workers.filter(w => w.status === 'running' || w.status === 'queued').length;
  const canSend = inputText.trim().length > 0 && !!activeId && isConnected;

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble message={item} />
  ), []);

  const keyExtractor = useCallback((item: Message, index: number) =>
    `${item.role}_${index}_${item.timestamp ?? index}`, []);

  const micColor = recordingState === 'recording' ? '#ef4444'
    : recordingState === 'transcribing' ? '#f59e0b'
    : isConnected ? '#666' : '#ccc';

  const micIcon = recordingState === 'recording' ? 'radio-button-on'
    : recordingState === 'transcribing' ? 'hourglass-outline'
    : 'mic-outline';

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Conversation Switcher */}
        <View style={styles.switcherBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.switcherContent}
          >
            {conversations.map(convo => {
              const active = convo.id === activeId;
              return (
                <TouchableOpacity
                  key={convo.id}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => selectConversation(convo.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
                    {convo.label}
                  </Text>
                  <TouchableOpacity
                    onPress={() => closeConversation(convo.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={styles.pillClose}
                  >
                    <Ionicons name="close" size={13} color={active ? '#fff' : '#aaa'} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
            {conversations.length < 3 && (
              <TouchableOpacity style={styles.newBtn} onPress={createConversation}>
                <Ionicons name="add" size={18} color="#666" />
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* TTS toggle */}
          <TouchableOpacity
            style={styles.ttsBtn}
            onPress={() => { Speech.stop(); setTtsEnabled(v => !v); }}
          >
            <Ionicons
              name={ttsEnabled ? 'volume-high' : 'volume-mute'}
              size={18}
              color={ttsEnabled ? '#1a1a1a' : '#ccc'}
            />
          </TouchableOpacity>

          {/* Worker badge */}
          {activeWorkerCount > 0 && (
            <TouchableOpacity
              style={styles.workerBadge}
              onPress={() => setShowWorkers(v => !v)}
            >
              <View style={styles.workerDot} />
              <Text style={styles.workerBadgeLabel}>{activeWorkerCount}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Not connected state */}
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color="#92400e" />
            <Text style={styles.offlineLabel}>Connecting to server…</Text>
          </View>
        )}

        {/* Message List */}
        <FlatList
          ref={listRef}
          data={[...messages].reverse()}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          inverted
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={10}
          ListHeaderComponent={<>{isThinking && <TypingIndicator />}</>}
          ListEmptyComponent={
            !isThinking ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color="#ddd" />
                <Text style={styles.emptyText}>
                  {isConnected ? 'Send a message to get started' : 'Connecting…'}
                </Text>
              </View>
            ) : null
          }
        />

        {/* Worker Panel */}
        <WorkerPanel workers={workers} visible={showWorkers} onClose={() => setShowWorkers(false)} />

        {/* Tool Banner */}
        {isThinking && <ToolBanner toolFeed={toolFeed} />}

        {/* Pending image preview */}
        {pendingImage && (
          <View style={styles.imagePreviewBar}>
            <Ionicons name="image" size={16} color="#2563eb" />
            <Text style={styles.imagePreviewLabel}>Image attached</Text>
            <TouchableOpacity onPress={() => setPendingImage(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#aaa" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          {/* Mic — hold to talk */}
          <Pressable
            style={styles.iconBtn}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            disabled={!isConnected || recordingState === 'transcribing'}
          >
            <Ionicons name={micIcon as any} size={22} color={micColor} />
          </Pressable>

          <TextInput
            style={[styles.input, { height: Math.max(40, Math.min(inputHeight, 120)) }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={
              recordingState === 'recording' ? '🔴 Recording…'
              : recordingState === 'transcribing' ? '⏳ Transcribing…'
              : isConnected ? 'Message PersonalClaw…' : 'Connecting…'
            }
            placeholderTextColor={recordingState !== 'idle' ? '#f59e0b' : '#bbb'}
            multiline
            onContentSizeChange={e => setInputHeight(e.nativeEvent.contentSize.height)}
            onSubmitEditing={Platform.OS === 'ios' ? () => sendMessage() : undefined}
            blurOnSubmit={false}
            editable={isConnected && recordingState === 'idle'}
          />

          {/* Image picker */}
          <TouchableOpacity
            style={[styles.iconBtn, pendingImage && styles.iconBtnActive]}
            onPress={pickImage}
            disabled={!isConnected}
          >
            <Ionicons
              name="image-outline"
              size={22}
              color={pendingImage ? '#2563eb' : isConnected ? '#666' : '#ccc'}
            />
          </TouchableOpacity>

          {/* Send / Stop */}
          {isThinking ? (
            <TouchableOpacity style={[styles.sendBtn, styles.stopBtn]} onPress={abort}>
              <Ionicons name="stop" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!canSend}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1 },

  switcherBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  switcherContent: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
    flexGrow: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  pillActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  pillLabel: { fontSize: 13, fontWeight: '500', color: '#555' },
  pillLabelActive: { color: '#fff' },
  pillClose: { marginLeft: 2 },
  newBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#e0e0e0', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  ttsBtn: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 4,
  },
  workerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#fff7ed', borderRadius: 12,
    borderWidth: 1, borderColor: '#fed7aa',
  },
  workerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  workerBadgeLabel: { fontSize: 12, fontWeight: '600', color: '#92400e' },

  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1, borderBottomColor: '#fde68a',
  },
  offlineLabel: { fontSize: 12, color: '#92400e' },

  list: { flex: 1 },
  listContent: { paddingVertical: 12 },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingVertical: 60,
    transform: [{ scaleY: -1 }],
  },
  emptyText: { fontSize: 15, color: '#bbb' },

  imagePreviewBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: '#eff6ff',
    borderTopWidth: 1, borderTopColor: '#bfdbfe',
  },
  imagePreviewLabel: { flex: 1, fontSize: 13, color: '#2563eb', fontWeight: '500' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  iconBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: '#eff6ff', borderRadius: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1.5, borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 15, color: '#1a1a1a',
    maxHeight: 120, lineHeight: 21,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#d0d0d0' },
  stopBtn: { backgroundColor: '#ef4444' },
});
