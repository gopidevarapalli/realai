'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession, signOut, signIn } from 'next-auth/react'; // ← add this
import SettingsModal from '@/components/SettingsModal';
import ReactMarkdown from 'react-markdown';

import {
  loadMemory,
  saveMemory,
  UserMemory,
} from '@/lib/memory';

type Message = { role: 'user' | 'assistant'; content: string };
type Chat = { id: string; title: string; messages: Message[]; createdAt: number };

const STORAGE_KEY = 'ai_chat_history';

function loadChats(): Chat[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveChats(chats: Chat[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function newChat(): Chat {
  return { id: Date.now().toString(), title: 'New chat', messages: [], createdAt: Date.now() };
}

export default function ChatApp() {
  const { data: session } = useSession(); // ← add this
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [memory, setMemory] = useState<UserMemory>({});
  const [skillsInput, setSkillsInput] = useState('');

  useEffect(() => {
    const stored = loadChats();
    if (stored.length > 0) {
      setChats(stored);
      setActiveChatId(stored[0].id);
    } else {
      const first = newChat();
      setChats([first]);
      setActiveChatId(first.id);
    }
  }, []);
  useEffect(() => {
    if (!session?.user?.email) return;

    const storedMemory = loadMemory(session.user.email);

    if (Object.keys(storedMemory).length > 0) {
      setMemory(storedMemory);
      setSkillsInput((storedMemory.skills || []).join(', '));
      return;
    }

    const fullName = session.user.name || '';

    const [firstName, ...rest] = fullName.split(' ');

    const lastName = rest.join(' ');

    const defaultMemory: UserMemory = {
      firstName,
      lastName,
    };

    setMemory(defaultMemory);

    saveMemory(session.user.email, defaultMemory);
  }, [session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, activeChatId]);

  const activeChat = chats.find(c => c.id === activeChatId);

  const createNewChat = () => {
    const chat = newChat();
    const updated = [chat, ...chats];
    setChats(updated);
    saveChats(updated);
    setActiveChatId(chat.id);
    setInput('');
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = chats.filter(c => c.id !== id);
    if (updated.length === 0) {
      const fresh = newChat();
      setChats([fresh]);
      saveChats([fresh]);
      setActiveChatId(fresh.id);
    } else {
      setChats(updated);
      saveChats(updated);
      if (activeChatId === id) setActiveChatId(updated[0].id);
    }
  };

  const updateChat = (id: string, messages: Message[]) => {
    const title = messages[0]?.content?.slice(0, 36) + (messages[0]?.content?.length > 36 ? '...' : '') || 'New chat';
    const updated = chats.map(c => c.id === id ? { ...c, messages, title } : c);
    setChats(updated);
    saveChats(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !activeChat) return;

    const userMsg: Message = { role: 'user', content: input };
    const history = [...activeChat.messages, userMsg];
    updateChat(activeChatId, history);
    setInput('');
    setIsLoading(true);
    // console.log('MEMORY SENT TO API:', memory);
    const fullName = session?.user?.name || '';
    // console.log('fullName=', session);
    const [sessionFirstName, ...rest] = fullName.split(' ');

    const sessionLastName = rest.join(' ');

    const finalMemory = {
      ...memory,

      firstName:
        memory?.firstName || sessionFirstName || '',

      lastName:
        memory?.lastName || sessionLastName || '',
    };

    // console.log('FINAL MEMORY:', finalMemory);

    const response = await fetch('/api/chat', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        messages: history,
        memory: finalMemory,
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let aiText = '';
    const withAssistant = [...history, { role: 'assistant' as const, content: '' }];
    updateChat(activeChatId, withAssistant);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      aiText += decoder.decode(value);
      updateChat(activeChatId, [...history, { role: 'assistant', content: aiText }]);
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  const handleSaveMemory = () => {
    saveMemory(session?.user?.email, memory);

    setSettingsOpen(false);

    alert('Settings saved successfully');
  };
  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  overflow: hidden;

  background: #f5f7fb;

  color: #111827;

  font-family: 'DM Sans', sans-serif;
}

::selection {
  background: rgba(59,130,246,0.35);
}

::-webkit-scrollbar {
  width: 5px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.12);
  border-radius: 20px;
}

.app {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar */

.sidebar {
  width: ${sidebarOpen ? '290px' : '0px'};
  min-width: ${sidebarOpen ? '290px' : '0px'};

  background: #ffffff;

  border-right: 1px solid #dbe3ee;

  display: flex;
  flex-direction: column;

  overflow: hidden;

  transition: all 0.25s ease;
}

.sidebar-header {
  padding: 22px 20px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  border-bottom: 1px solid #eef2f7;

  background: white;
}

.sidebar-logo {
  font-family: 'Instrument Serif', serif;

  font-size: 34px;

  color: #111827;

  letter-spacing: -1px;

  font-weight: 600;
}

.new-chat-btn {
  width: 44px;
  height: 44px;

  border-radius: 14px;

  border: 1px solid #dbe3ee;

  background: white;

  color: #111827;

  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 24px;

  transition: all 0.18s ease;

  box-shadow:
    0 2px 8px rgba(15,23,42,0.04);
}

.new-chat-btn:hover {
  background: #eff6ff;

  border-color: #bfdbfe;

  color: #2563eb;

  transform: translateY(-1px);
}

.chat-list {
  flex: 1;

  overflow-y: auto;

  padding: 14px;
}

.chat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 14px;

  border-radius: 18px;

  cursor: pointer;

  transition: all 0.18s ease;

  margin-bottom: 8px;

  border: 1px solid transparent;
}

.chat-item:hover {
  background: #f3f4f6;

  border-color: #d1d5db;
}

.chat-item.active {
  background: #dbeafe;

  border: 1px solid #93c5fd;
}

.chat-item-title {
  font-size: 14px;

  color: #111827;

  font-weight: 600;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item-date {
  font-size: 12px;

  color: #6b7280;

  margin-top: 5px;
}

.delete-btn {
  width: 28px;
  height: 28px;

  border-radius: 10px;

  border: none;

  background: transparent;

  color: #777;

  cursor: pointer;

  opacity: 0;

  transition: all 0.18s ease;
}

.chat-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: rgba(239,68,68,0.12);

  color: #ef4444;
}

/* Main */

.main {
  flex: 1;

  display: flex;
  flex-direction: column;

  overflow: hidden;

  position: relative;

  background:
    linear-gradient(
      180deg,
      #f8fafc 0%,
      #f5f7fb 100%
    );
}

.topbar {
  padding: 18px 24px;

  display: flex;
  align-items: center;
  gap: 14px;

  border-bottom: 1px solid #dbe3ee;

  background: rgba(255,255,255,0.95);

  backdrop-filter: blur(14px);

  position: sticky;
  top: 0;

  z-index: 10;
}

.toggle-sidebar {
  width: 44px;
  height: 44px;

  border-radius: 14px;

  border: 1px solid #dbe3ee;

  background: white;

  color: #111827;

  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;

  transition: all 0.18s ease;

  box-shadow:
    0 2px 8px rgba(15,23,42,0.04);
}

.toggle-sidebar:hover {
  background: #eff6ff;

  border-color: #bfdbfe;

  color: #2563eb;

  transform: translateY(-1px);
}

.chat-title-bar {
  font-family: 'Instrument Serif', serif;

  font-size: 24px;

  color: #111827;

  letter-spacing: -0.8px;
}

.model-badge {
  margin-left: auto;

  padding: 8px 14px;

  border-radius: 999px;

  background: #eff6ff;

  border: 1px solid #bfdbfe;

  color: #2563eb;

  font-size: 12px;

  font-weight: 600;
}

/* Messages */

.messages {
  flex: 1;

  overflow-y: auto;

  padding: 36px 0;

  background: #f8fafc;
}

.messages-inner {
  max-width: 860px;

  margin: 0 auto;

  padding: 0 28px 120px;
}

.empty-state {
  height: 100%;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  gap: 16px;
}

.empty-icon {
  font-size: 58px;

  color: #2563eb;

  opacity: 0.9;
}

.empty-title {
  font-family: 'Instrument Serif', serif;

  font-size: 56px;

  line-height: 1;

  color: #111827;

  letter-spacing: -2px;

  text-align: center;
}

.empty-sub {
  color: #6b7280;

  font-size: 15px;

  text-align: center;
}

.message-row {
  display: flex;

  gap: 14px;

  margin-bottom: 32px;

  animation: fadeUp 0.22s ease;
}

.message-row.user {
  flex-direction: row-reverse;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.avatar {
  width: 38px;
  height: 38px;

  border-radius: 14px;

  display: flex;
  align-items: center;
  justify-content: center;

  flex-shrink: 0;

  font-size: 13px;

  font-weight: 600;
}

.avatar.user {
  background:
    linear-gradient(
      135deg,
      #2563eb,
      #1d4ed8
    );

  color: white;

  box-shadow:
    0 10px 25px rgba(37,99,235,0.28);
}

.avatar.ai {
  background:
    linear-gradient(
      135deg,
      #10b981,
      #059669
    );

  color: white;
}

.bubble {
  max-width: 82%;
}

.bubble-text {
  padding: 16px 18px;

  border-radius: 24px;

  font-size: 15px;

  line-height: 1.85;

  white-space: pre-wrap;

  word-break: break-word;
}

.user .bubble-text {
  background:
    linear-gradient(
      135deg,
      #2563eb,
      #1d4ed8
    );

  color: white;

  border-bottom-right-radius: 8px;

  box-shadow:
    0 12px 30px rgba(37,99,235,0.25);
}

.ai .bubble-text {
  background: white;

  color: #111827;

  border: 1px solid #e5e7eb;

  border-bottom-left-radius: 8px;

  box-shadow:
    0 2px 10px rgba(15,23,42,0.05);
}

.typing {
  display: flex;

  gap: 5px;

  padding: 16px 18px;

  border-radius: 20px;

  background: rgba(255,255,255,0.04);

  border: 1px solid rgba(255,255,255,0.06);
}

.dot {
  width: 7px;
  height: 7px;

  border-radius: 50%;

  background: #6b7280;

  animation: bounce 1.2s infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%,60%,100% {
    transform: translateY(0);
  }

  30% {
    transform: translateY(-6px);
  }
}

/* Input */

.input-area {
  padding: 20px 24px 30px;

  background: #f8fafc;
}

.input-wrap {
  max-width: 860px;

  margin: 0 auto;

  background: #ffffff;

  border: 1px solid #cbd5e1;

  border-radius: 30px;

  display: flex;
  align-items: flex-end;

  gap: 10px;

  padding: 16px 18px;

  transition: all 0.18s ease;

  box-shadow:
    0 6px 20px rgba(15,23,42,0.08);
}

.input-wrap:focus-within {
  border-color: #60a5fa;

  box-shadow:
    0 0 0 4px rgba(59,130,246,0.10),
    0 10px 25px rgba(15,23,42,0.08);
}

textarea {
  flex: 1;

  background: transparent;

  border: none;

  outline: none;

  color: #111827;

  font-size: 16px;

  line-height: 1.8;

  resize: none;

  max-height: 140px;

  min-height: 26px;

  overflow-y: auto;

  font-family: 'DM Sans', sans-serif;

  font-weight: 500;
}

textarea::placeholder {
  color: #94a3b8;
}

.send-btn {
  width: 52px;
  height: 52px;

  border-radius: 18px;

  border: none;

  background:
    linear-gradient(
      135deg,
      #3b82f6,
      #2563eb
    );

  color: white;

  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;

  transition: all 0.18s ease;

  box-shadow:
    0 10px 24px rgba(37,99,235,0.25);
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px) scale(1.03);

  box-shadow:
    0 16px 34px rgba(37,99,235,0.38);
}

.send-btn:disabled {
  opacity: 0.45;

  cursor: not-allowed;
}

.input-hint {
  text-align: center;

  font-size: 12px;

  color: #64748b;

  margin-top: 12px;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;

    left: 0;
    top: 0;
    bottom: 0;

    z-index: 100;
  }

  .messages-inner {
    padding: 0 16px 120px;
  }

  .bubble {
    max-width: 92%;
  }

  .empty-title {
    font-size: 42px;
  }

  .chat-title-bar {
    font-size: 18px;
  }
}
`}</style>

      <div className="app">
        {/* Sidebar */}
        {sidebarOpen && <div className="sidebar">
          <div className="sidebar-header">
            <span className="sidebar-logo">Real AI</span>
            <button className="new-chat-btn" onClick={createNewChat} title="New chat">+</button>
          </div>
          <div className="chat-list">
            {chats.map(chat => (
              <div
                key={chat.id}
                className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                onClick={() => setActiveChatId(chat.id)}
              >
                <div className="chat-item-left">
                  <div className="chat-item-title">{chat.title}</div>
                  <div className="chat-item-date">{formatTime(chat.createdAt)} · {chat.messages.length} msgs</div>
                </div>
                <button className="delete-btn" onClick={(e) => deleteChat(chat.id, e)}>×</button>
              </div>
            ))}
          </div>
          {/* bottom of sidebar, after chat-list */}
          {/* Settings */}
          {session?.user && <button
            onClick={() => setSettingsOpen(true)}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#eff6ff';
              e.currentTarget.style.borderColor = '#bfdbfe';
            }}

            onMouseOut={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#dbe3ee';
            }}
            style={{
              background: '#ffffff',
              border: '1px solid #dbe3ee',
              borderRadius: 12,
              color: '#111827',
              fontSize: 13,
              fontWeight: 500,
              padding: '12px 14px',
              cursor: 'pointer',
              margin: '12px',
              transition: 'all 0.18s ease',
              boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
            }}
          >
            ⚙ Settings
          </button>}
          {/* Bottom of sidebar */}
          <div style={{
            padding: '18px',
            borderTop: '1px solid #eef2f7',
            background: '#ffffff',
          }}>
            {session?.user ? (<>
              {/*  Logged in — show profile + sign out */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {session.user.image
                  ? <img src={session.user.image} alt="avatar" referrerPolicy="no-referrer"
                    style={{ width: 28, height: 28, borderRadius: '50%' }} />
                  : <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#1e2a3a', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 600, color: '#111827'
                  }}>
                    {session.user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, color: 'black', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {session.user.name}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: '#6b7280',
                    marginTop: 2,
                  }}>
                    {session.user.email}
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.borderColor = '#fecaca';
                  }}

                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#dbe3ee';
                  }}
                  style={{
                    background: 'white',
                    border: '1px solid #dbe3ee',
                    borderRadius: 10,
                    color: '#111827',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                  }}
                >
                  Out
                </button>
              </div></>
            ) : (
              /* Logged out — show sign in button */
              <button
                onClick={() => signIn('google')}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: 10, color: '#c8c4bc', fontSize: 13,
                  fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, transition: 'all 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = '#222')}
                onMouseOut={e => (e.currentTarget.style.background = '#1a1a1a')}
              >
                <svg width="16" height="16" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                </svg>
                Sign in with Google
              </button>
            )}
          </div>
        </div>}


        {/* Main */}
        <div className="main">
          <div className="topbar">
            <button className="toggle-sidebar" onClick={() => setSidebarOpen((prev) => !prev)}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="3" width="13" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="1" y="7" width="13" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="1" y="11" width="13" height="1.5" rx="0.75" fill="currentColor" />
              </svg>
            </button>
            <span className="chat-title-bar">{activeChat?.title || 'New chat'}</span>
            {/* <span className="model-badge">Llama 3.3 · Groq</span> */}
            {!(session?.user) && <span className="model-badge">
              <button
                onClick={() => signIn('google')}
                style={{
                  width: '100%', padding: '2px 14px',
                  background: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: 10, color: '#c8c4bc', fontSize: 13,
                  fontFamily: 'DM Sans, sans-serif', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, transition: 'all 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = '#222')}
                onMouseOut={e => (e.currentTarget.style.background = '#1a1a1a')}
              >
                <svg width="16" height="16" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                </svg>
                Sign in with Google
              </button>
            </span>}
          </div>

          <div className="messages">
            {!activeChat || activeChat.messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✦</div>
                <div className="empty-title">What's on your mind?</div>
                <div className="empty-sub">Start a conversation — it'll be saved in history</div>
              </div>
            ) : (
              <div className="messages-inner">
                {activeChat.messages.map((m, i) => (
                  <div key={i} className={`message-row ${m.role}`}>
                    <div className={`avatar ${m.role === 'user' ? 'user' : 'ai'}`}>
                      {m.role === 'user' ? (session?.user?.name?.[0]?.toUpperCase() || 'U') : 'AI'}
                    </div>
                    <div className={`bubble ${m.role}`}>
                      {m.content === '' && m.role === 'assistant' ? (
                        <div className="typing">
                          <div className="dot" /><div className="dot" /><div className="dot" />
                        </div>
                      ) : (
                          <div className="bubble-text"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="input-area">
            <div className="input-wrap">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message Real AI..."
                rows={1}
                disabled={isLoading}
              />
              <button className="send-btn" onClick={sendMessage} disabled={isLoading || !input.trim()}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 12V2M7 2L2 7M7 2L12 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className="input-hint">Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      </div>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        memory={memory}
        setMemory={setMemory}
        onSave={handleSaveMemory}
        skillsInput={skillsInput}
        setSkillsInput={setSkillsInput}
      />
    </>
  );
}