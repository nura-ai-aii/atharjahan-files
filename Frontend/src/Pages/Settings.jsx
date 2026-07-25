import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Key, HardDrive, Shield, Sliders, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../utils/api.js';

export default function Settings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [settings, setSettings] = useState(null);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await api.get('/settings');
        if (res.data && res.data.settings) {
          setSettings(res.data.settings);
        }
      } catch (err) {
        console.error('Failed to load system preferences');
      }
    }
    loadSettings();
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'New password and confirm password do not match.' });
      return;
    }
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      await api.post('/password', { currentPassword, newPassword });
      setStatusMsg({ type: 'success', text: 'Master password updated securely! Use your new password on next login.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.error || 'Password verification failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      await api.post('/settings', settings);
      setStatusMsg({ type: 'success', text: 'System preferences saved successfully!' });
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to update system preferences.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="full-screen" style={{ backgroundColor: '#f1f5f9', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Navigation Return Button */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/" className="btn btn-secondary" style={{ textDecoration: 'none', width: 'fit-content' }}>
            <ArrowLeft size={16} />
            <span>Return to Vault Dashboard</span>
          </Link>
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.5rem', letterSpacing: '-0.025em' }}>
          Vault Security & Preferences
        </h1>

        {statusMsg.text && (
          <div style={{
            padding: '1rem',
            backgroundColor: statusMsg.type === 'error' ? 'var(--error-bg)' : 'var(--success-bg)',
            color: statusMsg.type === 'error' ? 'var(--error-color)' : 'var(--success-color)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid currentColor',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            {statusMsg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{statusMsg.text}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 1. Master Password Modification */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <Key size={22} color="var(--primary-blue)" />
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>Change Master Login Password</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Encrypted immediately with 12-round bcrypt hashing</div>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>CURRENT PASSWORD</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter current password..."
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>NEW PASSWORD</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="New strong password..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>CONFIRM NEW PASSWORD</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Repeat new password..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }} disabled={loading}>
                Update Master Password
              </button>
            </form>
          </div>

          {/* 2. System Configuration & Upload Bounds */}
          {settings && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                <Sliders size={22} color="var(--primary-blue)" />
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>System & Upload Bounds</h2>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configure stream bandwidth and theme presentation</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                    MAXIMUM STREAM UPLOAD LIMIT (MB)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={settings.uploadLimitMb || 2000}
                    onChange={(e) => setSettings({ ...settings, uploadLimitMb: parseInt(e.target.value, 10) })}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                    Default ceiling is 2000 MB (2 GB) using streaming buffer chunking to prevent memory overload.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                    ACTIVE THEME STYLESHEET
                  </label>
                  <select
                    className="input-field"
                    value={settings.defaultTheme || 'simple-white'}
                    onChange={(e) => setSettings({ ...settings, defaultTheme: e.target.value })}
                    style={{ padding: '0.625rem 1rem' }}
                  >
                    <option value="simple-white">Simple White (Crisp Modern White + Vibrant Tailored Blue Buttons)</option>
                    <option value="sleek-dark">Sleek Obsidian Dark (Coming Soon)</option>
                  </select>
                </div>

                <button onClick={handleSavePreferences} className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={loading}>
                  Save System Preferences
                </button>
              </div>
            </div>
          )}

          {/* 3. Architecture Safety & Zero-Destruction Status */}
          <div className="card" style={{ backgroundColor: '#f8fafc', borderLeft: '4px solid #10b981' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Shield size={22} color="#10b981" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Strict Safety Policy Active</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              All 519 existing project root files in <code>c:/files mmm</code> are protected under our mandatory Zero-Destruction Policy. Permanent file deletion and modification endpoints (<code>DELETE / PUT</code>) are strictly excluded from the server routing layer.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
