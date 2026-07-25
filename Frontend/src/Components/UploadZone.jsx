import React, { useState, useRef } from 'react';
import { Upload, FilePlus, CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';
import api from '../utils/api.js';

export default function UploadZone({ currentFolderId, onUploadComplete }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [duplicateAlert, setDuplicateAlert] = useState(null);
  const fileInputRef = useRef(null);

  // Helper to generate exact visual ASCII progress representation (e.g. █████████ 90%)
  const generateAsciiProgress = (percent) => {
    const filledCount = Math.round(percent / 10);
    const emptyCount = 10 - filledCount;
    const bar = '█'.repeat(filledCount) + '░'.repeat(emptyCount);
    return `${bar} ${percent}%`;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      startUploads(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      startUploads(Array.from(e.target.files));
    }
  };

  const startUploads = (files) => {
    const newQueueItems = files.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      file,
      progress: 0,
      status: 'uploading', // uploading, error, done, waiting_duplicate
      errorMessage: ''
    }));

    setUploadQueue(prev => [...newQueueItems, ...prev]);

    newQueueItems.forEach(item => {
      uploadSingleFile(item, 'ask');
    });
  };

  const uploadSingleFile = async (queueItem, duplicateAction = 'ask') => {
    const formData = new FormData();
    formData.append('file', queueItem.file);
    if (currentFolderId && currentFolderId !== 'null' && currentFolderId !== 'root') {
      formData.append('folderId', currentFolderId);
    }
    formData.append('duplicateAction', duplicateAction);

    try {
      await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || queueItem.file.size));
          setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, progress: percentCompleted } : q));
        }
      });

      setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'done', progress: 100 } : q));
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      if (err.response && err.response.status === 409) {
        // SHA-256 Duplicate Checksum Match!
        setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'waiting_duplicate' } : q));
        setDuplicateAlert({
          queueItem,
          existingFile: err.response.data.existingFile,
          checksum: err.response.data.checksum
        });
      } else {
        const msg = err.response?.data?.error || 'Upload failed due to network interrupted stream.';
        setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'error', errorMessage: msg } : q));
      }
    }
  };

  const handleDuplicateResolution = (action) => {
    if (!duplicateAlert) return;
    const { queueItem } = duplicateAlert;
    setDuplicateAlert(null);

    if (action === 'cancel') {
      setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'error', errorMessage: 'Cancelled due to identical content.' } : q));
    } else {
      setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'uploading', progress: 50 } : q));
      uploadSingleFile(queueItem, action);
    }
  };

  const removeQueueItem = (id) => {
    setUploadQueue(prev => prev.filter(q => q.id !== id));
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Drag & Drop Dropzone Box */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? 'var(--primary-blue)' : 'var(--border-color)'}`,
          backgroundColor: dragActive ? 'var(--primary-blue-light)' : 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          padding: '1.75rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 200ms ease',
          boxShadow: dragActive ? '0 0 0 4px rgba(37, 99, 235, 0.1)' : 'var(--shadow-sm)'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <div className="flex-center" style={{ marginBottom: '0.75rem' }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-blue-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary-blue)'
          }}>
            <Upload size={24} />
          </div>
        </div>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)' }}>
          Drag & Drop your files here or <span style={{ color: 'var(--primary-blue)', textDecoration: 'underline' }}>Browse File Picker</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          Supports all formats: PDF, DOCX, XLSX, MP4, ZIP, PSD, APK up to 2GB with streaming SHA-256 integrity check.
        </div>
      </div>

      {/* Real-time Multi-file Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="card" style={{ marginTop: '1rem', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Upload Queue ({uploadQueue.filter(q => q.status === 'uploading').length} processing)
            </span>
            <button onClick={() => setUploadQueue([])} className="btn-icon" title="Clear upload list" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.2rem 0.5rem' }}>
              Clear Done
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '220px', overflowY: 'auto' }}>
            {uploadQueue.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{item.file.name}</span>
                    {item.status === 'uploading' && (
                      <span className="progress-ascii">{generateAsciiProgress(item.progress)}</span>
                    )}
                    {item.status === 'done' && (
                      <span style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                        <CheckCircle2 size={15} /> Uploaded to Vault
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span style={{ color: 'var(--error-color)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {item.errorMessage}
                      </span>
                    )}
                    {item.status === 'waiting_duplicate' && (
                      <span style={{ color: 'var(--warning-color)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertTriangle size={15} /> Duplicate Detected
                      </span>
                    )}
                  </div>
                  {item.status === 'uploading' && (
                    <div className="progress-container" style={{ margin: 0, height: '0.4rem' }}>
                      <div className="progress-bar" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </div>
                {item.status === 'error' && (
                  <button onClick={() => uploadSingleFile(item, 'ask')} className="btn-icon" title="Retry Upload" style={{ color: 'var(--primary-blue)' }}>
                    <RefreshCw size={16} />
                  </button>
                )}
                <button onClick={() => removeQueueItem(item.id)} className="btn-icon" title="Dismiss item">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SHA-256 Duplicate Checksum Dialog Modal */}
      {duplicateAlert && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={24} color="#f59e0b" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>Duplicate Content Detected</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verified via SHA-256 cryptographic checksum</div>
              </div>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5', marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <strong>{duplicateAlert.queueItem.file.name}</strong> has identical binary content to an existing file already saved in your cloud vault repository. What action would you like to take?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={() => handleDuplicateResolution('cancel')} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={() => handleDuplicateResolution('keepBoth')} className="btn btn-secondary" style={{ backgroundColor: '#eff6ff', color: 'var(--primary-blue)', borderColor: 'var(--primary-blue)' }}>
                Keep Both (Copy)
              </button>
              <button onClick={() => handleDuplicateResolution('replace')} className="btn btn-primary" style={{ backgroundColor: '#2563eb' }}>
                Replace Metadata
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
