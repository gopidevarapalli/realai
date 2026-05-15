'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession, signOut, signIn } from 'next-auth/react'; // ← add this
import SettingsModal from '@/components/SettingsModal';

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0f0f0f; color: #e8e4dc; font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2e2e2e; border-radius: 4px; }
        .app { display: flex; height: 100vh; overflow: hidden; }

        /* Sidebar */
        .sidebar { width: ${sidebarOpen ? '260px' : '0px'}; min-width: ${sidebarOpen ? '260px' : '0px'}; background: #141414; border-right: 1px solid #1e1e1e; display: flex; flex-direction: column; overflow: hidden; transition: all 0.25s ease; }
        .sidebar-header { padding: 18px 16px 12px; border-bottom: 1px solid #1e1e1e; display: flex; align-items: center; justify-content: space-between; }
        .sidebar-logo { font-family: 'Instrument Serif', serif; font-size: 17px; color: #e8e4dc; letter-spacing: -0.3px; }
        .new-chat-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid #2a2a2a; background: transparent; color: #888; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; line-height: 1; transition: all 0.15s; }
        .new-chat-btn:hover { background: #1e1e1e; color: #e8e4dc; }
        .chat-list { flex: 1; overflow-y: auto; padding: 8px; }
        .chat-item { display: flex; align-items: center; justify-content: space-between; padding: 9px 10px; border-radius: 8px; cursor: pointer; transition: background 0.12s; gap: 8px; }
        .chat-item:hover { background: #1a1a1a; }
        .chat-item.active { background: #1e1e1e; }
        .chat-item-left { flex: 1; min-width: 0; }
        .chat-item-title { font-size: 13px; color: #c8c4bc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 400; }
        .chat-item.active .chat-item-title { color: #e8e4dc; }
        .chat-item-date { font-size: 11px; color: #555; margin-top: 2px; }
        .delete-btn { width: 22px; height: 22px; border-radius: 4px; border: none; background: transparent; color: #444; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; opacity: 0; transition: all 0.12s; flex-shrink: 0; }
        .chat-item:hover .delete-btn { opacity: 1; }
        .delete-btn:hover { background: #2a1515; color: #e05555; }

        /* Main */
        .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; }
        .topbar { padding: 14px 20px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: center; gap: 12px; background: #0f0f0f; }
        .toggle-sidebar { width: 32px; height: 32px; border-radius: 7px; border: 1px solid #1e1e1e; background: transparent; color: #666; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .toggle-sidebar:hover { background: #1a1a1a; color: #e8e4dc; }
        .chat-title-bar { font-family: 'Instrument Serif', serif; font-size: 15px; color: #888; font-style: italic; }
        .model-badge { margin-left: auto; font-size: 11px; color: #444; background: #161616; border: 1px solid #1e1e1e; border-radius: 20px; padding: 3px 10px; }

        /* Messages */
        .messages { flex: 1; overflow-y: auto; padding: 32px 0; }
        .messages-inner { max-width: 680px; margin: 0 auto; padding: 0 24px; }
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; padding-bottom: 80px; }
        .empty-icon { font-family: 'Instrument Serif', serif; font-size: 48px; color: #2a2a2a; }
        .empty-title { font-family: 'Instrument Serif', serif; font-size: 26px; color: #3a3a3a; }
        .empty-sub { font-size: 13px; color: #444; }

        .message-row { display: flex; gap: 12px; margin-bottom: 28px; animation: fadeUp 0.2s ease; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .message-row.user { flex-direction: row-reverse; }
        .avatar { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; flex-shrink: 0; margin-top: 2px; }
        .avatar.user { background: #1e2a3a; color: #5b9bd5; font-family: 'DM Sans', sans-serif; }
        .avatar.ai { background: #1a1f1a; color: #5b9b6a; font-size: 14px; }
        .bubble { max-width: 82%; }
        .bubble.user { align-items: flex-end; }
        .bubble-text { padding: 11px 15px; border-radius: 12px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
        .user .bubble-text { background: #1a2535; color: #c8dff5; border-bottom-right-radius: 3px; }
        .ai .bubble-text { background: #161616; color: #d8d4cc; border: 1px solid #1e1e1e; border-bottom-left-radius: 3px; }
        .typing { display: flex; gap: 4px; padding: 14px 15px; background: #161616; border: 1px solid #1e1e1e; border-radius: 12px; border-bottom-left-radius: 3px; width: fit-content; }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: #444; animation: bounce 1.2s infinite; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); background: #666; } }

        /* Input */
        .input-area { padding: 16px 24px 24px; background: #0f0f0f; }
        .input-wrap { max-width: 680px; margin: 0 auto; background: #141414; border: 1px solid #232323; border-radius: 14px; display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px; transition: border-color 0.15s; }
        .input-wrap:focus-within { border-color: #2e3e50; }
        textarea { flex: 1; background: transparent; border: none; outline: none; color: #e8e4dc; font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.6; resize: none; max-height: 140px; min-height: 24px; overflow-y: auto; }
        textarea::placeholder { color: #444; }
        .send-btn { width: 34px; height: 34px; border-radius: 8px; border: none; background: #1e3a5f; color: #5b9bd5; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; flex-shrink: 0; }
        .send-btn:hover:not(:disabled) { background: #1e4a7f; color: #7bb8f5; }
        .send-btn:disabled { background: #161616; color: #333; cursor: not-allowed; }
        .input-hint { text-align: center; font-size: 11px; color: #333; margin-top: 8px; max-width: 680px; margin-left: auto; margin-right: auto; }
      `}</style>

      <div className="app">
        {/* Sidebar */}
        <div className="sidebar">
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
            style={{
              background: 'transparent',
              border: '1px solid #2a2a2a',
              borderRadius: 6,
              color: '#888',
              fontSize: 11,
              padding: '4px 8px',
              cursor: 'pointer',
              marginTop: 6,
            }}
          >
            ⚙ Settings
          </button>}
          {/* Bottom of sidebar */}
          <div style={{
            padding: '12px 16px', borderTop: '1px solid #1e1e1e',
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
                    justifyContent: 'center', fontSize: 12, color: '#5b9bd5', fontWeight: 500
                  }}>
                    {session.user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, color: '#c8c4bc', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {session.user.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#444' }}>
                    {session.user.email}
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  style={{
                    background: 'transparent', border: '1px solid #2a2a2a',
                    borderRadius: 6, color: '#555', fontSize: 11,
                    padding: '4px 8px', cursor: 'pointer'
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
        </div>


        {/* Main */}
        <div className="main">
          <div className="topbar">
            <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="3" width="13" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="1" y="7" width="13" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="1" y="11" width="13" height="1.5" rx="0.75" fill="currentColor" />
              </svg>
            </button>
            <span className="chat-title-bar">{activeChat?.title || 'New chat'}</span>
            <span className="model-badge">Llama 3.3 · Groq</span>
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
                        <div className="bubble-text">{m.content}</div>
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