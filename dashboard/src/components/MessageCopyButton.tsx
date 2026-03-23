import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MessageCopyButtonProps {
  text: string;
}

export function MessageCopyButton({ text }: MessageCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      className="message-copy-btn"
      onClick={handleCopy}
      title="Copy message to clipboard"
    >
      {copied ? <Check size={14} style={{ color: 'var(--accent-success)' }} /> : <Copy size={14} />}
    </button>
  );
}
