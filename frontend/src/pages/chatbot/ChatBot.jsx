import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Plus,
  Send,
  Trash2,
  MessageSquare,
  FileText,
  Bot,
  User,
  Sparkles,
  BookOpen
} from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import './ChatBot.css';
import { chatbotAPI, ragAPI } from '../../api';
import ChatSidebar from './ChatSidebar';
import RagPanel from './RagPanel';
import MessageBubble from './MessageBubble';

const ChatBot = () => {
  // --- State ---
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // RAG State
  const [documents, setDocuments] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [isRagPanelVisible, setIsRagPanelVisible] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const pollingInterval = useRef(null);

  // --- Initial Load ---
  useEffect(() => {
    fetchSessions();
    fetchDocuments();
    
    // Listen for quick reply clicks from MessageBubble
    const handleQuickReply = (e) => {
      handleSendMessage(e.detail);
    };
    window.addEventListener('send-quick-reply', handleQuickReply);
    
    return () => {
      window.removeEventListener('send-quick-reply', handleQuickReply);
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  // --- Auto-scroll ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Polling for Processing Docs ---
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'processing');
    if (hasProcessing && !pollingInterval.current) {
      pollingInterval.current = setInterval(fetchDocuments, 5000);
    } else if (!hasProcessing && pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, [documents]);

  // --- API Actions ---
  const fetchSessions = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await chatbotAPI.listSessions();
      if (res.data.success) {
        setSessions(res.data.data);
        if (res.data.data.length > 0 && !activeSessionId) {
          handleSelectSession(res.data.data[0].session_id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await ragAPI.listDocuments();
      if (res.data.success) {
        setDocuments(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const handleSelectSession = async (id) => {
    setActiveSessionId(id);
    setIsLoadingMessages(true);
    try {
      const res = await chatbotAPI.getMessages(id);
      if (res.data.success) {
        setMessages(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleNewChat = async () => {
    // If docs are selected, create a RAG session
    const isRag = selectedDocIds.length > 0;
    try {
      const res = await chatbotAPI.createSession({
        session_type: isRag ? 'rag' : 'general',
        document_ids: isRag ? selectedDocIds : []
      });
      if (res.data.success) {
        const newSession = res.data.data;
        setSessions([
          { 
            session_id: newSession.session_id, 
            session_type: newSession.session_type, 
            started_at: newSession.started_at,
            last_message_preview: null 
          }, 
          ...sessions
        ]);
        setActiveSessionId(newSession.session_id);
        setMessages([]);
        // Keep selected docs for context, but reset if user wants a clean start
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleDeleteSession = async (id) => {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await chatbotAPI.deleteSession(id);
      setSessions(sessions.filter(s => s.session_id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleSendMessage = async (text = inputValue) => {
    if (!text.trim() || !activeSessionId || isSending) return;
    
    setIsSending(true);
    setInputValue('');
    
    // Optimistic user message
    const tempId = Date.now();
    const userMsg = { id: tempId, role: 'user', message: text, createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await chatbotAPI.sendMessage(activeSessionId, { 
        message: text,
        document_ids: selectedDocIds // Send current selections for dynamic RAG
      });

      if (res.data.success) {
        const { botReply } = res.data.data;
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempId),
          userMsg,
          { 
            id: botReply.id, 
            role: 'bot', 
            message: botReply.message, 
            metadata: botReply.metadata,
            createdAt: botReply.created_at 
          }
        ]);

        // If the session recently became a RAG session, update local state
        if (selectedDocIds.length > 0) {
          setSessions(prev => prev.map(s => 
            s.session_id === activeSessionId ? { ...s, session_type: 'rag' } : s
          ));
        }
        // Update session preview in sidebar
        const preview = text.length > 60 ? `${text.substring(0, 60)}...` : text;
        setSessions(prev => prev.map(s => 
          s.session_id === activeSessionId 
            ? { ...s, last_message_preview: preview }
            : s
        ));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => [...prev, { 
        id: 'err', 
        role: 'bot', 
        message: 'Sorry, I hit a snag. Please check your connection.', 
        createdAt: new Date() 
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleUploadDocument = async (file) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await ragAPI.uploadDocument(formData);
      if (res.data.success) {
        fetchDocuments();
      }
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (id) => {
    if (!window.confirm('Delete this document? All associated AI context will be lost.')) return;
    try {
      await ragAPI.deleteDocument(id);
      setDocuments(documents.filter(d => d.id !== id));
      setSelectedDocIds(selectedDocIds.filter(sid => sid !== id));
    } catch (err) {
      console.error('Failed to delete doc:', err);
    }
  };

  const toggleDocSelection = (id) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // --- Rendering ---
  const activeSession = sessions.find(s => s.session_id === activeSessionId);

  return (
    <DashboardLayout title="AI Guidance Bot">
      <div className="chatbot-page">
        {/* 1. SESSION HISTORY SIDEBAR */}
        <AnimatePresence>
          {isHistoryOpen && (
            <motion.div
              className="chat-sidebar-wrapper"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <ChatSidebar 
                sessions={sessions}
                activeId={activeSessionId}
                onSelect={handleSelectSession}
                onDelete={handleDeleteSession}
                onNewChat={handleNewChat}
                isLoading={isLoadingHistory}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. MAIN CHAT AREA */}
        <main className="chat-main">
          <header className="chat-header">
            <div className="header-left">
              <button 
                className="menu-toggle-btn" 
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                title="Toggle History"
              >
                <Menu size={20} />
              </button>
              <div className="header-info">
                <h2>
                  {activeSession?.session_type === 'rag' ? 'Notebook Mode' : 'General Chat'}
                </h2>
                {selectedDocIds.length > 0 && (
                  <span className="rag-active-badge">
                    <Sparkles size={12} style={{ marginRight: '4px' }} />
                    Retrieval Active ({selectedDocIds.length})
                  </span>
                )}
              </div>
            </div>
            <div className="header-actions">
              <button 
                className={`toggle-rag-btn ${isRagPanelVisible ? 'active' : ''}`}
                onClick={() => setIsRagPanelVisible(!isRagPanelVisible)}
                title="Manage Documents"
              >
                <BookOpen size={16} />
                <span>{isRagPanelVisible ? 'Hide Documents' : 'Show Documents'}</span>
              </button>
            </div>
          </header>

          <div className="chat-messages">
            {isLoadingMessages ? (
              <div className="loading-state">
                <div className="pulse-loader"></div>
                <p>Reliving our conversation...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="welcome-state">
                <div className="bot-icon">
                  <Bot size={48} color="var(--cb-primary)" />
                </div>
                <h1>Hello! I'm DreamBot.</h1>
                <p>Ask me anything about your study plans, career goals, or the documents you've uploaded.</p>
                <div className="starter-chips">
                  <button onClick={() => handleSendMessage("What's our plan for today?")}>
                    Today's Plan
                  </button>
                  <button onClick={() => handleSendMessage("Help me find a career path.")}>
                    Career Help
                  </button>
                  <button onClick={() => handleSendMessage("Summarize my documents.")}>
                    Document Summary
                  </button>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isLast={index === messages.length - 1}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <form className="input-container" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
              <input 
                type="text" 
                className="chat-input"
                placeholder={activeSessionId ? "Type a message..." : "Start a new chat to begin..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={!activeSessionId || isSending}
              />
              <button 
                type="submit" 
                className="send-btn"
                disabled={!activeSessionId || !inputValue.trim() || isSending}
              >
                {isSending ? '...' : <Send size={20} />}
              </button>
            </form>
          </div>
        </main>

        {/* 3. RAG NOTEBOOK PANEL */}
        <AnimatePresence>
          {isRagPanelVisible && (
            <motion.div 
              className="rag-panel-wrapper"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <RagPanel 
                documents={documents}
                selectedIds={selectedDocIds}
                onUpload={handleUploadDocument}
                onDelete={handleDeleteDocument}
                onToggleSelect={toggleDocSelection}
                isUploading={isUploading}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};

export default ChatBot;
