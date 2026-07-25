import React, { useState, useRef } from 'react';
import { Upload, FilePlus, CheckCircle2, AlertTriangle, X, RefreshCw, Loader2, HardDrive } from 'lucide-react';
import api from '../utils/api.js';

export default function UploadZone({ currentFolderId, onUploadComplete }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [duplicateAlert, setDuplicateAlert] = useState(null);
  const fileInputRef = useRef(null);

  const formatMb = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0.00 MB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
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
      loadedMb: '0.00',
      totalMb: formatMb(file.size),
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
          const totalBytes = progressEvent.total || queueItem.file.size || 1;
          const percentCompleted = Math.min(99, Math.round((progressEvent.loaded * 100) / totalBytes));
          const loadedStr = formatMb(progressEvent.loaded).replace(' MB', '');
          const totalStr = formatMb(totalBytes);
          
          setUploadQueue(prev => prev.map(q => 
            q.id === queueItem.id ? { ...q, progress: percentCompleted, loadedMb: loadedStr, totalMb: totalStr } : q
          ));
        }
      });

      const finalMb = formatMb(queueItem.file.size);
      setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'done', progress: 100, loadedMb: finalMb.replace(' MB', ''), totalMb: finalMb } : q));
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
      setUploadQueue(prev => prev.map(q => q.id === queueItem.id ? { ...q, status: 'uploading', progress: 10 } : q));
      uploadSingleFile(queueItem, action);
    }
  };

  const removeQueueItem = (id) => {
    setUploadQueue(prev => prev.filter(q => q.id !== id));
  };

  const activeCount = uploadQueue.filter(q => q.status === 'uploading').length;

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
          border: `2px dashed ${dragActive ? '#2563eb' : activeCount > 0 ? '#3b82f6' : '#94a3b8'}`,
          backgroundColor: dragActive ? '#eff6ff' : '#f8fafc',
          borderRadius: '12px',
          padding: '1.75rem 1.5rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 200ms ease',
          boxShadow: dragActive ? '0 0 0 4px rgba(37, 99, 235, 0.15)' : '0 2px 4px rgba(0,0,0,0.02)',
          position: 'relative',
          overflow: 'hidden'
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
            backgroundColor: '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563eb',
            boxShadow: '0 2px 6px rgba(37,99,235,0.15)'
          }}>
            {activeCount > 0 ? <Loader2 size={24} className="spinner" color="#2563eb" /> : <Upload size={24} />}
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
          {activeCount > 0 ? (
            <span>Uploading {activeCount} file(s) right now... Click to queue more files</span>
          ) : (
            <span>Drag & Drop your files here or <span style={{ color: '#2563eb', textDecoration: 'underline' }}>Browse File Picker</span></span>
          )}
        </div>
        <div style={{ fontSize: '0.785rem', color: '#64748b', marginTop: '0.35rem', fontWeight: 500 }}>
          Supports all formats: PDF, DOCX, XLSX, MP4, ZIP, PSD, APK up to 2GB with streaming SHA-256 integrity verification.
        </div>
      </div>

      {/* Prominent High-Contrast Live Upload Monitor Panel */}
      {uploadQueue.length > 0 && (
        <div style={{
          marginTop: '1.25rem',
          padding: '1.25rem',
          backgroundColor: '#1e293b',
          color: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.35)',
          border: '1px solid #334155'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <HardDrive size={20} color="#60a5fa" />
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.025em' }}>
                LIVE UPLOAD PROGRESS MONITOR ({activeCount} processing)
              </span>
            </div>
            <button
              onClick={() => setUploadQueue(prev => prev.filter(q => q.status === 'uploading'))}
              style={{
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: 'none',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 150ms'
              }}
              title="Clear completed uploads from monitor"
            >
              Clear Completed
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto' }}>
            {uploadQueue.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '1rem',
                  backgroundColor: '#0f172a',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.625rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1', minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                      {item.file.name}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>
                      ({item.loadedMb} / {item.totalMb})
                    </span>
                  </div>

                  {/* Dynamic Status Badges & Bold Percent Counter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {item.status === 'uploading' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa' }}>
                          {item.progress}%
                        </span>
                        <span style={{ fontSize: '0.8rem', backgroundColor: '#1e3a8a', color: '#bfdbfe', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
                          ⏳ Uploading...
                        </span>
                      </div>
                    )}
                    {item.status === 'done' && (
                      <span style={{ backgroundColor: '#064e3b', color: '#6ee7b7', padding: '0.25rem 0.75rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.85rem' }}>
                        <CheckCircle2 size={16} color="#10b981" /> 100% Completed & Saved!
                      </span>
                    )}
                    {item.status === 'error' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                          ❌ {item.errorMessage}
                        </span>
                        <button onClick={() => uploadSingleFile(item, 'ask')} style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <RefreshCw size={12} /> Retry
                        </button>
                      </div>
                    )}
                    {item.status === 'waiting_duplicate' && (
                      <span style={{ backgroundColor: '#78350f', color: '#fde68a', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <AlertTriangle size={15} color="#f59e0b" /> Duplicate File Choice
                      </span>
                    )}

                    <button
                      onClick={() => removeQueueItem(item.id)}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
                      title="Dismiss from screen"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* High-Contrast Large Loading Bar */}
                <div style={{ width: '100%', height: '16px', backgroundColor: '#334155', borderRadius: '8px', overflow: 'hidden', position: 'relative', border: '1px solid #475569' }}>
                  <div style={{
                    width: `${item.progress}%`,
                    height: '100%',
                    background: item.status === 'done'
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : item.status === 'error'
                      ? '#ef4444'
                      : 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)',
                    borderRadius: '8px',
                    transition: 'width 250ms ease-out'
                  }} />
                  {/* Overlay text inside the bar when progress > 15% */}
                  {item.progress >= 15 && (
                    <span style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: '#ffffff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                    }}>
                      {item.progress}% COMPLETE ({item.loadedMb} / {item.totalMb})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SHA-256 Duplicate Checksum Dialog Modal */}
      {duplicateAlert && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '500px', padding: '1.75rem', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '50%', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={24} color="#f59e0b" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>Duplicate Content Detected</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Verified via SHA-256 cryptographic checksum</div>
              </div>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: '1.5', marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <strong>{duplicateAlert.queueItem.file.name}</strong> has identical content to a file already stored on your server. How would you like to handle this upload?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={() => handleDuplicateResolution('cancel')} className="btn btn-secondary">
                Cancel Upload
              </button>
              <button onClick={() => handleDuplicateResolution('keepBoth')} className="btn btn-secondary" style={{ backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#2563eb', fontWeight: 600 }}>
                Keep Both (Create Copy)
              </button>
              <button onClick={() => handleDuplicateResolution('replace')} className="btn btn-primary" style={{ backgroundColor: '#2563eb', fontWeight: 600 }}>
                Replace File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

