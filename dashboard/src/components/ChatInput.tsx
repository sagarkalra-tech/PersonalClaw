import React, { useState } from 'react';
import { Send, Camera, Loader2, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onScreenshot: () => void;
  isCapturing: boolean;
  pendingScreenshot: string | null;
  onRemoveScreenshot: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  onScreenshot, 
  isCapturing, 
  pendingScreenshot, 
  onRemoveScreenshot 
}) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim() && !pendingScreenshot) return;
    onSendMessage(text);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-area-outer">
      {pendingScreenshot && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="pending-preview"
        >
          <img src={pendingScreenshot} alt="Pending" />
          <button className="remove-preview" onClick={onRemoveScreenshot}>
            <X size={14} />
          </button>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginLeft: '10px' }}>
            Screenshot attached. Type your request and send.
          </span>
        </motion.div>
      )}
      <div className="input-area" style={{ alignItems: 'flex-end' }}>
        <textarea
          placeholder="Ask PersonalClaw to do something..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button 
          className="screenshot-btn" 
          onClick={onScreenshot} 
          disabled={isCapturing}
          title="Capture Screenshot"
        >
          {isCapturing ? <Loader2 size={20} className="spin" /> : <Camera size={20} />}
        </button>
        <button className="send-btn" onClick={handleSend} style={{ height: '48px' }}>
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default React.memo(ChatInput);
