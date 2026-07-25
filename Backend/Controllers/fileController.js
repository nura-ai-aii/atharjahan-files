import File from '../Models/File.js';
import Folder from '../Models/Folder.js';
import AuditLog from '../Models/AuditLog.js';
import { detectCategory } from './categoryDetector.js';
import { computeSha256, verifyFileSignature, uploadToStorage, getFileStream, deleteFromStorage } from './storageController.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Handle multipart streaming file upload with duplicate checksum check & magic number verification
 */
export async function handleFileUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No upload file stream provided.' });
    }

    const { originalname, size, mimetype, path: tempPath } = req.file;
    const folderId = req.body.folderId && req.body.folderId !== 'null' ? req.body.folderId : null;
    const duplicateAction = req.body.duplicateAction || 'ask'; // 'ask', 'replace', 'keepBoth', 'cancel'

    // 1. Calculate SHA-256 Checksum on staging file stream
    const checksum = await computeSha256(tempPath);

    // 2. Duplicate Check
    const existingFile = await File.findOne({ checksum, folderId });
    if (existingFile) {
      if (duplicateAction === 'ask') {
        // Leave staging file intact for follow-up choice or clean up
        fs.unlinkSync(tempPath);
        return res.status(409).json({
          status: 'duplicate_detected',
          message: `File "${existingFile.filename}" with identical contents already exists in this directory.`,
          existingFile: { id: existingFile._id, filename: existingFile.filename, size: existingFile.size },
          checksum
        });
      } else if (duplicateAction === 'cancel') {
        fs.unlinkSync(tempPath);
        return res.status(200).json({ status: 'cancelled', message: 'Upload cancelled due to duplicate detection.' });
      }
    }

    // 3. Verify magic number signatures against extension spoofing
    const signature = await verifyFileSignature(tempPath, mimetype);
    const finalMime = signature.mimeType || mimetype || 'application/octet-stream';

    // 4. Auto-detect category
    const category = detectCategory(originalname, finalMime);

    // 5. Generate unique cloud object key
    const uniqueHash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalname);
    const baseName = path.basename(originalname, ext);
    let finalFilename = originalname;
    let storageKey = `${baseName}_${Date.now()}_${uniqueHash}${ext}`;

    if (existingFile && duplicateAction === 'replace') {
      // With our strict Zero-Destruction rule, "replace" updates metadata filename/pointer rather than destroying prior backups
      finalFilename = existingFile.filename;
    } else if (existingFile && duplicateAction === 'keepBoth') {
      finalFilename = `${baseName} (Copy)${ext}`;
    }

    // 6. Stream file to persistent Cloudflare R2 / S3 object storage (or local vault fallback)
    await uploadToStorage(tempPath, storageKey, finalMime);

    // 7. Save structural metadata in MongoDB Atlas
    const fileDoc = await File.create({
      filename: finalFilename,
      originalName: originalname,
      mimeType: finalMime,
      size,
      storageKey,
      url: `/api/file/download/${storageKey}`, // Internal secure route only
      category,
      checksum,
      folderId
    });

    // 8. Log audit trail
    await AuditLog.create({
      action: 'upload',
      fileId: fileDoc._id,
      details: `Uploaded ${finalFilename} (${size} bytes, Category: ${category})`,
      ip: req.ip
    });

    return res.status(201).json({
      status: 'success',
      message: 'File uploaded and secured in personal cloud vault.',
      file: fileDoc
    });
  } catch (err) {
    console.error('File Upload Exception:', err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
    return res.status(500).json({ error: 'File transfer failed. Please retry your upload.' });
  }
}

/**
 * List files with folder filtering, search queries, categories, sorting, and pagination
 */
export async function listFiles(req, res) {
  try {
    const { folderId, category, search, sort = 'uploadedAt', order = 'desc', page = 1, limit = 100 } = req.query;
    const query = {};

    // Folder constraint (default Root is null)
    if (folderId && folderId !== 'null' && folderId !== 'root') {
      query.folderId = folderId;
    } else if (!search && !category) {
      // If browsing normal directory without global search or category filter, restrict to Root
      query.folderId = null;
    }

    // Category filter
    if (category && category !== 'All' && category !== 'Folders') {
      query.category = category;
    }

    // Instant search query
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { filename: searchRegex },
        { originalName: searchRegex },
        { mimeType: searchRegex },
        { category: searchRegex }
      ];
    }

    // Sort mapping
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions = {};
    sortOptions[sort] = sortOrder;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [files, totalCount] = await Promise.all([
      File.find(query).sort(sortOptions).skip(skip).limit(parseInt(limit, 10)).populate('folderId', 'name path'),
      File.countDocuments(query)
    ]);

    // Also get folders in this directory if not searching globally
    let folders = [];
    if (!search && (!category || category === 'All' || category === 'Folders')) {
      const folderQuery = { parentFolderId: (folderId && folderId !== 'null' && folderId !== 'root') ? folderId : null };
      folders = await Folder.find(folderQuery).sort({ name: 1 });
    }

    return res.status(200).json({
      files,
      folders,
      pagination: {
        total: totalCount,
        page: parseInt(page, 10),
        pages: Math.ceil(totalCount / parseInt(limit, 10))
      }
    });
  } catch (err) {
    console.error('List Files Error:', err);
    return res.status(500).json({ error: 'Failed to query file directory.' });
  }
}

/**
 * Get file details and generate safe preview metadata
 */
export async function getFileDetails(req, res) {
  try {
    const file = await File.findById(req.params.id).populate('folderId', 'name path');
    if (!file) {
      return res.status(404).json({ error: 'File document not located in directory.' });
    }

    await AuditLog.create({ action: 'preview', fileId: file._id, details: `Inspect metadata for ${file.filename}`, ip: req.ip });

    return res.status(200).json({ file });
  } catch (err) {
    console.error('Get details error:', err);
    return res.status(500).json({ error: 'Failed to read file attributes.' });
  }
}

/**
 * Secure Backend Stream Download (No exposed public URL) with original filename preservation
 */
export async function downloadFile(req, res) {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'Requested file is no longer available.' });
    }

    const stream = await getFileStream(file.storageKey);

    await AuditLog.create({ action: 'download', fileId: file._id, details: `Downloaded ${file.filename}`, ip: req.ip });

    // Set precise headers for uncorrupted original filename & extension download
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);

    stream.pipe(res);
  } catch (err) {
    console.error('Download stream error:', err);
    return res.status(500).json({ error: 'Failed to stream download from vault storage.' });
  }
}

/**
 * Secure Backend Stream for In-Browser Preview (Never forces download)
 */
export async function previewFile(req, res) {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const stream = await getFileStream(file.storageKey);

    // Set inline content disposition so browser displays rather than saving to disk
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);

    stream.pipe(res);
  } catch (err) {
    console.error('Preview stream error:', err);
    return res.status(500).json({ error: 'Failed to stream file preview.' });
  }
}

/**
 * Selective Batch File Deletion for Settings Storage Manager
 */
export async function batchDeleteFiles(req, res) {
  try {
    const { fileIds } = req.body;
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'No files specified for deletion.' });
    }

    const filesToDelete = await File.find({ _id: { $in: fileIds } });
    if (filesToDelete.length === 0) {
      return res.status(404).json({ error: 'Selected files were not found in database.' });
    }

    let totalDeletedBytes = 0;
    const deletedCount = filesToDelete.length;

    // Securely delete each item from vault disk / cloud storage
    for (const file of filesToDelete) {
      try {
        await deleteFromStorage(file.storageKey);
        totalDeletedBytes += (file.size || 0);
      } catch (err) {
        console.error(`Warning: Failed to delete storage object ${file.storageKey}:`, err);
      }
    }

    // Remove metadata records from MongoDB
    await File.deleteMany({ _id: { $in: fileIds } });

    // Audit Log record for security transparency
    await AuditLog.create({
      action: 'delete_files',
      details: `Batch deleted ${deletedCount} file(s) freeing ${(totalDeletedBytes / (1024 * 1024)).toFixed(2)} MB of vault storage`,
      ip: req.ip
    });

    return res.status(200).json({
      message: `Successfully deleted ${deletedCount} file(s) and reclaimed ${(totalDeletedBytes / (1024 * 1024)).toFixed(2)} MB of server space!`,
      deletedIds: fileIds,
      freedBytes: totalDeletedBytes
    });
  } catch (err) {
    console.error('Batch delete error:', err);
    return res.status(500).json({ error: 'Failed to complete selective deletion operation.' });
  }
}

