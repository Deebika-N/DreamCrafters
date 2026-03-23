import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Folder, CheckCircle, AlertCircle, X, Loader2, FileText } from 'lucide-react';

export default function RagPanel({ 
  documents, 
  onUpload, 
  onDelete, 
  selectedIds, 
  onToggleSelect,
  isUploading 
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) onUpload(file);
  };

  return (
    <div className="rag-panel">
      <div className="rag-header">
        <h3>My Notebook</h3>
        <p>Ground your chat in these docs</p>
      </div>

      <div className="upload-section">
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept=".pdf,.docx,.txt"
        />
        <button 
          className="upload-btn"
          onClick={() => fileInputRef.current.click()}
          disabled={isUploading}
        >
          {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          <span>{isUploading ? 'Uploading...' : 'Add Document'}</span>
        </button>
      </div>

      <div className="documents-list">
        <AnimatePresence>
          {documents.map((doc) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`doc-card ${selectedIds.includes(doc.id) ? 'selected' : ''}`}
            >
              <div className="doc-select">
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(doc.id)}
                  onChange={() => onToggleSelect(doc.id)}
                  disabled={doc.status !== 'ready'}
                />
              </div>
              
              <div className="doc-info" onClick={() => doc.status === 'ready' && onToggleSelect(doc.id)}>
                <div className="doc-name" title={doc.original_name}>
                  {doc.original_name}
                </div>
                <div className="doc-meta">
                  <span className={`status-badge ${doc.status}`}>
                    {doc.status === 'processing' && <Loader2 className="animate-spin" size={10} style={{ marginRight: '4px' }} />}
                    {doc.status === 'ready' && <CheckCircle size={10} style={{ marginRight: '4px' }} />}
                    {doc.status === 'failed' && <AlertCircle size={10} style={{ marginRight: '4px' }} />}
                    {doc.status}
                  </span>
                  {doc.total_chunks && <span> - {doc.total_chunks} chunks</span>}
                </div>
              </div>

              <button className="doc-delete-btn" onClick={() => onDelete(doc.id)}>
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {documents.length === 0 && !isUploading && (
          <div className="empty-rag">
            <Folder size={32} color="#cbd5e1" style={{ marginBottom: '0.5rem' }} />
            <p>Upload PDFs or docs to start research mode.</p>
          </div>
        )}
      </div>
      
      {selectedIds.length > 0 && (
        <div className="rag-footer">
          <div className="selection-info">
            {selectedIds.length} document{selectedIds.length > 1 ? 's' : ''} for context.
          </div>
        </div>
      )}
    </div>
  );
}
