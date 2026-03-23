import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, FileText, Trash2 } from 'lucide-react';

export default function ChatSidebar({ sessions, activeId, onSelect, onDelete, onNewChat, isLoading }) {
  // Sort sessions by date (newest first)
  const sortedSessions = [...sessions].sort((a, b) => 
    new Date(b.started_at) - new Date(a.started_at)
  );

  return (
    <div className="chat-sidebar">
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onNewChat}>
          <Plus size={18} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="sessions-list">
        {isLoading && <div className="loading-history">Loading history...</div>}
        
        {!isLoading && sortedSessions.length === 0 && (
          <div className="empty-history">No conversations yet</div>
        )}

        <AnimatePresence>
          {sortedSessions.map((session) => (
            <motion.div
              key={session.session_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`session-item ${activeId === session.session_id ? 'active' : ''}`}
              onClick={() => onSelect(session.session_id)}
            >
              <div className="session-icon">
                {session.session_type === 'rag' ? <FileText size={16} /> : <MessageSquare size={16} />}
              </div>
              <div className="session-info">
                <div className="session-title">
                  {session.last_message_preview || `New ${session.session_type} chat`}
                </div>
                <div className="session-date">
                  {new Date(session.started_at).toLocaleDateString()}
                </div>
              </div>
              <button 
                className="delete-session-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(session.session_id);
                }}
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
