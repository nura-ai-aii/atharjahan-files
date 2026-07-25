import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authenticateToken, login, changePassword } from '../Controllers/authController.js';
import { handleFileUpload, listFiles, getFileDetails, downloadFile, previewFile } from '../Controllers/fileController.js';
import { createFolder, getFolderBreadcrumbs, getDashboardStats } from '../Controllers/folderController.js';
import { getSettings, saveSettings, getAuditLogs } from '../Controllers/settingsController.js';
import { STAGING_DIR } from '../Controllers/storageController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Strict Rate Limiting for Login authentication attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // max 10 failed login attempts per window
  message: { error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.' }
});

// Multer Staging Configuration (Stream processing up to 2GB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STAGING_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueHash = crypto.randomBytes(6).toString('hex');
    cb(null, `upload_${Date.now()}_${uniqueHash}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2000 * 1024 * 1024 // 2 GB ceiling for large ISO, APK, video streams
  }
});

// ==========================================
// PUBLIC & AUTHENTICATION ENDPOINTS
// ==========================================
router.post('/login', loginLimiter, login);

// ==========================================
// PROTECTED API ENDPOINTS (JWT REQUIREMENT)
// ==========================================
router.use(authenticateToken);

// Dashboard Statistics & Analytics
router.get('/stats', getDashboardStats);

// Folder Architecture & Breadcrumbs
router.post('/folders', createFolder);
router.get('/folders/:id/breadcrumbs', getFolderBreadcrumbs);

// File Exploration, Upload & Secure Streaming (Strictly NO DELETE or PUT endpoints)
router.post('/upload', upload.single('file'), handleFileUpload);
router.get('/files', listFiles);
router.get('/file/:id', getFileDetails);
router.get('/file/:id/download', downloadFile);
router.get('/file/:id/preview', previewFile);

// Administration Settings & Security Audit Logs
router.get('/settings', getSettings);
router.post('/settings', saveSettings);
router.post('/password', changePassword);
router.get('/audit-logs', getAuditLogs);

export default router;
