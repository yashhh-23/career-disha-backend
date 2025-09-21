const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const prisma = require('../config/prisma');
const ocrService = require('../services/ocrService');
const aiService = require('../services/aiService');

const router = express.Router();

// Google Cloud Storage setup
const storageClient = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;
if (!bucketName) {
  console.warn('GCS_BUCKET_NAME not set. Resume uploads will fail.');
}

// Configure multer for memory storage (for streaming to GCS)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept only PDF and common image formats
  const allowedTypes = /pdf|jpg|jpeg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// POST /api/v1/uploads - Upload resume (async processing)
router.post('/', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!bucketName) {
      return res.status(500).json({ error: 'Storage not configured' });
    }

    // Build GCS destination path: resumes/{userId}/{timestamp}-{random}{ext}
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const safeExt = path.extname(req.file.originalname) || '';
    const objectName = `resumes/${req.user.id}/${uniqueSuffix}${safeExt}`;

    const bucket = storageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    // Upload buffer to GCS
    await file.save(req.file.buffer, {
      contentType: req.file.mimetype,
      resumable: false,
      metadata: {
        contentType: req.file.mimetype,
        metadata: { uploadedBy: req.user.id }
      }
    });

    const gcsUri = `gs://${bucketName}/${objectName}`;

    // Create upload record in database and mark processing
    const uploadRecord = await prisma.fileUpload.create({
      data: {
        filename: path.basename(objectName),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: gcsUri,
        uploadedBy: req.user.id,
        purpose: 'RESUME',
        isPublic: false,
        metadata: {
          status: 'processing',
          extractedData: {
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date().toISOString()
          }
        }
      }
    });

    // Respond immediately with 202 Accepted
    return res.status(202).json({
      message: 'Resume received and queued for processing',
      uploadId: uploadRecord.id,
      status: 'processing',
      storagePath: gcsUri
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/uploads/:id - Get upload status and data
router.get('/:id', async (req, res) => {
  try {
    const uploadId = parseInt(req.params.id);
    
    if (isNaN(uploadId)) {
      return res.status(400).json({ error: 'Invalid upload ID' });
    }

    const upload = await prisma.fileUpload.findFirst({
      where: {
        id: uploadId,
        uploadedBy: req.user.id // Ensure user can only access their own uploads
      }
    });

    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    res.json({
      id: upload.id,
      status: upload.metadata?.status || 'unknown',
      extractedData: upload.metadata?.extractedData,
      createdAt: upload.createdAt,
      fileName: upload.originalName,
      fileSize: upload.size,
      mimeType: upload.mimeType,
      purpose: upload.purpose
    });

  } catch (error) {
    console.error('Get upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/uploads - Get all uploads for the user
router.get('/', async (req, res) => {
  try {
    const uploads = await prisma.fileUpload.findMany({
      where: { uploadedBy: req.user.id },
      select: {
        id: true,
        originalName: true,
        size: true,
        mimeType: true,
        purpose: true,
        createdAt: true,
        metadata: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedUploads = uploads.map(upload => ({
      id: upload.id,
      status: upload.metadata?.status || 'unknown',
      createdAt: upload.createdAt,
      fileName: upload.originalName,
      fileSize: upload.size,
      mimeType: upload.mimeType,
      purpose: upload.purpose,
      extractedData: upload.metadata?.extractedData
    }));

    res.json(formattedUploads);

  } catch (error) {
    console.error('Get uploads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/uploads/:id - Delete upload
router.delete('/:id', async (req, res) => {
  try {
    const uploadId = parseInt(req.params.id);
    
    if (isNaN(uploadId)) {
      return res.status(400).json({ error: 'Invalid upload ID' });
    }

    const upload = await prisma.fileUpload.findFirst({
      where: {
        id: uploadId,
        uploadedBy: req.user.id
      }
    });

    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    // Note: actual blob deletion should be handled in GCS (optional here)

    // Delete from database
    await prisma.fileUpload.delete({
      where: { id: uploadId }
    });

    res.json({ message: 'Upload deleted successfully' });

  } catch (error) {
    console.error('Delete upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Async processing moved to Cloud Function worker (see src/workers/resumeWorker.js)

// Function to update user profile with extracted resume data
async function updateUserProfileFromResume(uploadId, processedData) {
  try {
    // Get the upload to find the user
    const upload = await prisma.fileUpload.findUnique({
      where: { id: uploadId },
      select: { uploadedBy: true }
    });

    if (!upload) return;

    const { personalInfo, skills, experience, education } = processedData;

    // Update simple Profile store
    const existingProfile = await prisma.profile.findUnique({ where: { userId: upload.uploadedBy } });
    const mergedSkills = [...new Set([...(skills || []), ...((existingProfile?.skills) || [])])];
    await prisma.profile.upsert({
      where: { userId: upload.uploadedBy },
      update: {
        summary: `Profile auto-updated from resume. ${personalInfo?.summary || ''}`,
        skills: mergedSkills,
        tags: mergedSkills.slice(0, 20),
        languages: [],
        interests: existingProfile?.interests || []
      },
      create: {
        userId: upload.uploadedBy,
        summary: `Profile auto-generated from resume. ${personalInfo?.summary || ''}`,
        skills: skills || [],
        tags: skills || [],
        languages: [],
        interests: []
      }
    });

    // Map skills into Skill + UserSkill tables
    if (Array.isArray(mergedSkills)) {
      for (const raw of mergedSkills.slice(0, 50)) {
        const name = String(raw).trim();
        if (!name) continue;
        const normalized = name.toLowerCase().replace(/[^a-z0-9+.#]+/g, '-');
        const skill = await prisma.skill.upsert({
          where: { normalized },
          update: { name },
          create: { name, normalized, category: undefined, tags: [] }
        });
        await prisma.userSkill.upsert({
          where: { userId_skillId: { userId: upload.uploadedBy, skillId: skill.id } },
          update: { level: undefined, source: 'resume', confidence: processedData?.normalizedConfidence || 0.7 },
          create: { userId: upload.uploadedBy, skillId: skill.id, level: undefined, source: 'resume', confidence: processedData?.normalizedConfidence || 0.7 }
        });
      }
    }

    console.log(`Updated profile for user ${upload.uploadedBy} from resume data`);
  } catch (error) {
    console.error('Error updating profile from resume:', error);
  }
}

module.exports = router;