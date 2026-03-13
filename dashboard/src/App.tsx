import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatInput from './components/ChatInput';

import { io, Socket } from 'socket.io-client';
import {
  Bot,
  User,
  FileCode,
  Shield,
  LayoutDashboard,
  Activity,
  Sun,
  Moon,
  Clock,
  HardDrive,
  Cpu,
  Database,
  Copy,
  Check
} from 'lucide-react';


import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  image?: string;
}

type TabType = 'command' | 'metrics' | 'files' | 'security';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Welcome back, System Admin. PersonalClaw is active and monitoring.', sender: 'bot', timestamp: new Date() }
  ]);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [metrics, setMetrics] = useState({ cpu: 0, ram: '0', totalRam: '0' });
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [pendingScreenshot, setPendingScreenshot] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('command');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('metrics', (data: { cpu: number, ram: string, totalRam: string }) => {
      setMetrics(data);
    });

    newSocket.on('response', (data: { text: string }) => {
      setIsBotTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: data.text,
        sender: 'bot',
        timestamp: new Date()
      }]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'command') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isBotTyping, activeTab]);

  useEffect(() => {
    if (isLightTheme) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [isLightTheme]);

  const handleSendMessage = useCallback((text: string) => {
    if ((!text.trim() && !pendingScreenshot) || !socket) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: text || (pendingScreenshot ? '[Sent an image for analysis]' : ''),
      sender: 'user',
      timestamp: new Date(),
      image: pendingScreenshot || undefined
    };

    setMessages(prev => [...prev, newMessage]);
    setIsBotTyping(true);
    
    socket.emit('message', { 
      text: text || 'Analyze this image.', 
      image: pendingScreenshot 
    });

    setPendingScreenshot(null);
  }, [pendingScreenshot, socket]);


  const handleScreenshot = async () => {
    if (!socket) return;
    setIsCapturing(true);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve(true);
        };
      });

      await new Promise(r => setTimeout(r, 500));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = canvas.toDataURL('image/png');
      stream.getTracks().forEach(track => track.stop());

      setPendingScreenshot(imageData);
    } catch (err) {
      console.error('Screenshot failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };


  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h1>PersonalClaw</h1>
        <nav style={{ flex: 1 }}>
          <ul style={{ listStyle: 'none' }}>
            <li className={`nav-item ${activeTab === 'command' ? 'active' : ''}`} onClick={() => setActiveTab('command')}>
              <LayoutDashboard size={20} />
              <span>Command Center</span>
            </li>
            <li className={`nav-item ${activeTab === 'metrics' ? 'active' : ''}`} onClick={() => setActiveTab('metrics')}>
              <Activity size={20} />
              <span>System Metrics</span>
            </li>
            <li className={`nav-item ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>
              <FileCode size={20} />
              <span>File Explorer</span>
            </li>
            <li className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
              <Shield size={20} />
              <span>Security Logs</span>
            </li>
          </ul>
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="theme-toggle"
            onClick={() => setIsLightTheme(!isLightTheme)}
            title="Toggle Light/Dark Mode"
          >
            {isLightTheme ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <div className="agent-status">
            <div className="dot green" />
            <div style={{ fontSize: '0.8rem' }}>
              <div style={{ color: 'var(--text-dim)' }}>Agent Status</div>
              <div style={{ fontWeight: 600 }}>Online</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="status-grid">
          <div className="stat-card">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>CPU LOAD</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{metrics.cpu}%</div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '8px' }}>
              <div style={{ width: `${metrics.cpu}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '2px', transition: 'width 0.5s' }} />
            </div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>RAM USAGE</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{metrics.ram} GB / {metrics.totalRam} GB</div>
          </div>
          <div className="stat-card">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>TASKS COMPLETED</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{messages.filter(m => m.sender === 'bot').length}</div>
          </div>
        </div>

        <div className="content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'command' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="chat-panel"
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                <div className="terminal-header">
                  <div className="dot red" />
                  <div className="dot yellow" />
                  <div className="dot green" />
                  <span style={{ marginLeft: '12px', fontSize: '0.8rem', opacity: 0.6, fontFamily: 'monospace' }}>personal-claw-v1.10.0 --active</span>
                </div>

                <div className="messages-container">
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`message ${msg.sender}`}
                      >
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ marginTop: '4px' }}>
                            {msg.sender === 'bot' ? <Bot size={18} /> : <User size={18} />}
                          </div>
                          <div className="message-text">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.text}
                            </ReactMarkdown>
                            {msg.image && (
                              <img 
                                src={msg.image} 
                                alt="Uploaded content" 
                                style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '10px', border: '1px solid var(--border)' }} 
                              />
                            )}
                            {msg.sender === 'bot' && (
                              <button 
                                className="copy-btn" 
                                onClick={() => handleCopy(msg.text, msg.id)}
                                title="Copy to clipboard"
                              >
                                {copiedId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            )}
                          </div>

                        </div>
                      </motion.div>
                    ))}
                    {isBotTyping && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="message bot"
                        style={{ background: 'transparent', border: 'none', padding: '0 20px' }}
                      >
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <Bot size={18} />
                          <div className="typing-indicator">
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>

                <ChatInput 
                  onSendMessage={handleSendMessage}
                  onScreenshot={handleScreenshot}
                  isCapturing={isCapturing}
                  pendingScreenshot={pendingScreenshot}
                  onRemoveScreenshot={() => setPendingScreenshot(null)}
                />

              </motion.div>
            )}

            {activeTab === 'metrics' && (
              <motion.div
                key="metrics"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="metrics-view panel-glass"
                style={{ flex: 1, padding: '30px', overflowY: 'auto' }}
              >
                <h2>System Telemetry</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginTop: '30px' }}>
                  <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                      <Cpu size={20} color="var(--accent-primary)" />
                      <span style={{ fontWeight: 600 }}>Processor Load</span>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{metrics.cpu}%</div>
                  </div>
                  <div className="stat-card" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                      <Database size={20} color="var(--accent-secondary)" />
                      <span style={{ fontWeight: 600 }}>Memory Usage</span>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{metrics.ram} GB</div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>of {metrics.totalRam} GB available</div>
                  </div>
                </div>
                {/* Visual Placeholder for Graph */}
                <div style={{ marginTop: '30px', height: '200px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <Activity size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
                    <p>Real-time performance graph incoming...</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'files' && (
              <motion.div
                key="files"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="files-view panel-glass"
                style={{ flex: 1, padding: '30px', overflowY: 'auto' }}
              >
                <h2>File Explorer</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '30px' }}>
                   {['Screenshots', 'Memory', 'Downloads', 'Documents', 'Skills', 'Logs'].map(folder => (
                     <div key={folder} className="stat-card" style={{ background: 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'var(--transition)' }}>
                        <HardDrive size={24} style={{ marginBottom: '10px', color: 'var(--accent-primary)' }} />
                        <div style={{ fontWeight: 600 }}>{folder}</div>
                     </div>
                   ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="security-view panel-glass"
                style={{ flex: 1, padding: '30px', overflowY: 'auto' }}
              >
                <h2>Security & Activity Logs</h2>
                <div style={{ marginTop: '30px' }}>
                  <div className="log-entry" style={{ padding: '15px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '15px' }}>
                    <Clock size={16} color="var(--accent-primary)" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>System Initialized</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{new Date().toLocaleString()} - Agent online and scanning environment.</div>
                    </div>
                  </div>
                  <div className="log-entry" style={{ padding: '15px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '15px' }}>
                    <Clock size={16} color="var(--accent-secondary)" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Dashboard Connected</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Session handshake completed via Socket.io.</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <style>{`
        .panel-glass {
          background: var(--panel-bg);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: 24px;
          box-shadow: var(--glass-shadow);
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 12px;
          color: var(--text-dim);
          cursor: pointer;
          transition: var(--transition);
          margin-bottom: 8px;
        }
        .nav-item:hover {
          color: var(--text-main);
          background: rgba(255,255,255,0.05);
        }
        body.light-theme .nav-item:hover {
          background: rgba(0,0,0,0.05);
        }
        .nav-item.active {
          color: white;
          background: var(--accent-primary);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }
        .agent-status {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          flex: 1;
        }
        .message-text p {
          margin: 0;
        }
        .theme-toggle {
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-main);
          transition: var(--transition);
        }
        .theme-toggle:hover {
          border-color: var(--accent-primary);
          color: var(--accent-primary);
        }
        .screenshot-btn {
          height: 48px;
          width: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--text-dim);
          cursor: pointer;
          transition: var(--transition);
        }
        .screenshot-btn:hover:not(:disabled) {
          border-color: var(--accent-primary);
          color: var(--accent-primary);
          background: rgba(99, 102, 241, 0.1);
        }
        .screenshot-btn:disabled {
          opacity: 0.5;
          cursor: wait;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        .typing-indicator {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
          background: var(--msg-bot-bg);
          border: 1px solid var(--border);
          border-radius: 12px;
          border-bottom-left-radius: 4px;
          width: fit-content;
        }
        .typing-dot {
          width: 6px;
          height: 6px;
          background: var(--accent-primary);
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out;
        }
        .typing-dot:nth-child(1) { animation-delay: 0s; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        .input-area-outer {
          background: rgba(0, 0, 0, 0.1);
          border-top: 1px solid var(--border);
        }
        .pending-preview {
          padding: 10px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
        }
        .pending-preview img {
          height: 50px;
          width: 50px;
          object-fit: cover;
          border-radius: 8px;
          border: 2px solid var(--accent-primary);
        }
        .remove-preview {
          position: absolute;
          top: 5px;
          left: 55px;
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .message-text {
          position: relative;
          padding-right: 30px !important;
        }
        .copy-btn {
          position: absolute;
          top: 0;
          right: 0;
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          opacity: 0;
          transition: var(--transition);
          padding: 4px;
        }
        .message.bot:hover .copy-btn {
          opacity: 1;
        }
        .copy-btn:hover {
          color: var(--accent-primary);
        }
      `}</style>

    </div>
  );
};

export default App;
