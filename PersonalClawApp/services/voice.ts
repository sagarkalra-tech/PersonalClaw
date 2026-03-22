import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { getSecure } from './secure-store';
import { DEFAULT_SERVER_URL, SECURE_STORE_KEYS } from '../constants';

export async function requestMicPermission(): Promise<boolean> {
  const { granted } = await AudioModule.requestRecordingPermissionsAsync();
  return granted;
}

export async function transcribeAudio(uri: string): Promise<string> {
  const base = (await getSecure(SECURE_STORE_KEYS.SERVER_URL)) ?? DEFAULT_SERVER_URL;

  const formData = new FormData();
  formData.append('audio', {
    uri,
    type: 'audio/m4a',
    name: 'voice.m4a',
  } as any);

  const res = await fetch(`${base}/api/voice/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error(`STT failed: ${res.status}`);
  const json = await res.json();
  return (json.text ?? '').trim();
}

// Re-export the hook and presets so callers don't need to import expo-audio directly
export { useAudioRecorder, RecordingPresets };
