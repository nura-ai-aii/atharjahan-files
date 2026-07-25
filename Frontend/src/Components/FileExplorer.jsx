import React from 'react';
import { 
  FileText, Folder as FolderIcon, Image, Table, Video, Music, Package, 
  Code, File, Eye, Download, Info, ArrowUp, ArrowDown, Grid, List, Minimize 
} from 'lucide-react';
import api from '../utils/api.js';

export default function FileExplorer({ 
  files = [], 
  folders = [], 
  loading, 
  viewMode = 'grid', 
  setViewMode, 
  sortField, 
  sortOrder, 
  onSortChange, 
  onSelectFolder,
  onOpenPreview 
}) {

  // Helper to get matching file type icon
  const getFileIcon = (category, filename = '') => {
    switch (category) {
      case 'Images': return <Image size={24} color="#d97706" />;
      case 'PDFs': return <FileText size={24} color="#dc2626" />;
      case 'Excel': return <Table size={24} color="#16a34a" />;
      case 'Word': return <FileText size={24} color="#2563eb" />;
      case 'Videos': return <Video size={24} color="#7c3aed" />;
      case 'Audio': return <Music size={24} color="#ec4899" />;
      case 'ZIP': return <Package size={24} color="#854d0e" />;
      case 'Text': return <Code size={24} color="#0284c7" />;
      default: return <File size={24} color="var(--text-muted)" />;
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDownload = async (file) => {
    try {
      const response = await api.get(`/file/${file._id}/download`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: file.mimeType });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', file.originalName || file.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert('Download stream interrupted - please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ padding: '4rem 0' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const isEmpty = files.length === 0 && folders.length === 0;

  return (
    <div>
      {/* Explorer Ribbon & Sort Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Sort Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sort by:</span>
          {['filename', 'uploadedAt', 'size', 'category'].map((field) => {
            const label = field === 'filename' ? 'Name' : field === 'uploadedAt' ? 'Date' : field === 'size' ? 'Size' : 'Type';
            const active = sortField === field;
            return (
              <button
                key={field}
                onClick={() => onSortChange(field)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.35rem 0.65rem',
                  border: '1px solid',
                  borderColor: active ? 'var(--primary-blue)' : 'var(--border-color)',
                  backgroundColor: active ? 'var(--primary-blue-light)' : 'var(--bg-card)',
                  color: active ? 'var(--primary-blue)' : 'var(--text-main)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                <span>{label}</span>
                {active && (sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher (Grid / List / Compact) */}
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-card)', overflow: 'hidden' }}>
          <button
            onClick={() => setViewMode('grid')}
            title="Grid Cards View"
            style={{ padding: '0.4rem 0.75rem', border: 'none', backgroundColor: viewMode === 'grid' ? 'var(--primary-blue)' : 'transparent', color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="List Table View"
            style={{ padding: '0.4rem 0.75rem', border: 'none', backgroundColor: viewMode === 'list' ? 'var(--primary-blue)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('compact')}
            title="Compact Tiles View"
            style={{ padding: '0.4rem 0.75rem', border: 'none', backgroundColor: viewMode === 'compact' ? 'var(--primary-blue)' : 'transparent', color: viewMode === 'compact' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <Minimize size={16} />
          </button>
        </div>

      </div>

      {isEmpty && (
        <div className="card flex-col flex-center" style={{ padding: '5rem 2rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          <FolderIcon size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>No files or folders found here</div>
          <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Drag and drop documents above or create a directory folder to begin.</div>
        </div>
      )}

      {/* ========================================================
          GRID CARDS VIEW MODE
          ======================================================== */}
      {viewMode === 'grid' && !isEmpty && (
        <div className="grid-view">
          {/* Folders first */}
          {folders.map(folder => (
            <div
              key={folder._id}
              onClick={() => onSelectFolder(folder._id)}
              className="card card-hover"
              style={{ padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}
            >
              <FolderIcon size={26} color="var(--primary-blue)" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {folder.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Directory</div>
              </div>
            </div>
          ))}

          {/* Files grid cards */}
          {files.map(file => (
            <div key={file._id} className="card card-hover flex-col" style={{ justifyContent: 'space-between', minHeight: '160px' }}>
              <div onClick={() => onOpenPreview(file)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-hover)' }}>
                    {getFileIcon(file.category, file.filename)}
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.5rem', backgroundColor: '#f1f5f9', color: 'var(--text-muted)', borderRadius: '9999px', textTransform: 'uppercase' }}>
                    {file.category}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.filename}>
                  📄 {file.filename}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                  <span>{formatSize(file.size)}</span>
                  <span>{formatDate(file.uploadedAt)}</span>
                </div>
              </div>

              {/* Card Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => onOpenPreview(file)}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem', gap: '0.25rem' }}
                  title="Direct browser preview (No download forced)"
                >
                  <Eye size={14} /> Open
                </button>
                <button
                  onClick={() => handleDownload(file)}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                  title="Download unmodified file"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================
          LIST TABLE VIEW MODE
          ======================================================== */}
      {viewMode === 'list' && !isEmpty && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="list-view" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Type</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {folders.map(folder => (
                <tr key={folder._id} onClick={() => onSelectFolder(folder._id)} style={{ cursor: 'pointer' }}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, color: 'var(--primary-blue)' }}>
                    <FolderIcon size={20} color="var(--primary-blue)" />
                    <span>{folder.name}</span>
                  </td>
                  <td style={{ color: 'var(--text-light)' }}>—</td>
                  <td><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Directory</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(folder.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 500 }}>Open Folder →</span>
                  </td>
                </tr>
              ))}
              {files.map(file => (
                <tr key={file._id}>
                  <td onClick={() => onOpenPreview(file)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 500 }}>
                    {getFileIcon(file.category, file.filename)}
                    <span title={file.filename}>📄 {file.filename}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{formatSize(file.size)}</td>
                  <td><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{file.category}</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatDate(file.uploadedAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => onOpenPreview(file)} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', marginRight: '0.5rem' }}>
                      <Eye size={13} /> Preview
                    </button>
                    <button onClick={() => handleDownload(file)} className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                      <Download size={13} /> Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================
          COMPACT VIEW MODE
          ======================================================== */}
      {viewMode === 'compact' && !isEmpty && (
        <div className="compact-view">
          {folders.map(folder => (
            <div
              key={folder._id}
              onClick={() => onSelectFolder(folder._id)}
              className="card card-hover"
              style={{ padding: '0.6rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}
            >
              <FolderIcon size={18} color="var(--primary-blue)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--primary-blue)' }}>
                {folder.name}
              </span>
            </div>
          ))}
          {files.map(file => (
            <div
              key={file._id}
              onClick={() => onOpenPreview(file)}
              className="card card-hover"
              style={{ padding: '0.6rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
              title={`${file.filename} (${formatSize(file.size)}) - Click to preview`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                <span style={{ flexShrink: 0 }}>📄</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }}>
                  {file.filename}
                </span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
