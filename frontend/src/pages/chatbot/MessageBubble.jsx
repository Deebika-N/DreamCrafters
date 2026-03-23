import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function MessageBubble({ message, isLast }) {
  const isBot = message.role === 'bot';
  const metadata = message.metadata || {};
  const sources = metadata.sources || [];

  const cleanMessage = (text) => {
    if (!text) return '';
    // Regex to match JSON-like objects at the end of the string
    try {
      const jsonStart = text.lastIndexOf('{');
      if (jsonStart !== -1) {
        const potentialJson = text.substring(jsonStart);
        if (potentialJson.includes('"intent"') || potentialJson.includes('"confidence"')) {
          return text.substring(0, jsonStart).trim();
        }
      }
    } catch (e) {}
    return text.replace(/\{"intent":.*?\}/g, '').trim();
  };

  const messageText = isBot ? cleanMessage(message.message) : message.message;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`message-bubble-container ${isBot ? 'bot' : 'user'}`}
    >
      <div className="message-icon">
        {isBot ? <Bot size={18} /> : <User size={18} />}
      </div>
      
      <div className="message-content-wrapper">
        <div className="message-bubble">
          <div className="message-text">
            <ReactMarkdown>{messageText}</ReactMarkdown>
          </div>
          
          {isBot && sources.length > 0 && (
            <div className="message-sources">
              <div className="sources-title">
                <FileText size={12} />
                <span>Sources:</span>
              </div>
              <div className="sources-list">
                {sources.map((src, i) => (
                  <span key={i} className="source-tag" title={`Similarity: ${Math.round(src.similarity * 100)}%`}>
                    {src.documentName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {isBot && metadata.quick_replies?.length > 0 && isLast && (
          <div className="quick-replies">
            {metadata.quick_replies.map((reply, i) => (
              <button 
                key={i} 
                className="quick-reply-btn"
                onClick={() => window.dispatchEvent(new CustomEvent('send-quick-reply', { detail: reply }))}
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        
        <div className="message-time">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </motion.div>
  );
}
