// GCS-triggered Resume Worker (Cloud Function)
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { UserProfile, FileUpload, Notification, Skill, UserSkill } = require('../models');
const ocrService = require('../services/ocrService');
const aiService = require('../services/aiService');

const storage = new Storage();

// Helper to read a GCS file into buffer
async function readGcsFileToBuffer(bucketName, objectName) {
  const file = storage.bucket(bucketName).file(objectName);
  const [data] = await file.download();
  return data;
}

// Exported handler for GCS finalize events
exports.handleResumeUpload = async (event) => {
  const { bucket, name, contentType, size, metadata = {} } = event;

  try {
    if (!name.startsWith('resumes/')) return; // ignore other paths

    // Expected path resumes/{userId}/{file}
    const parts = name.split('/');
    if (parts.length < 3) return;
    const userId = parts[1];

    // Find corresponding upload record if any (latest by path)
    const gcsUri = `gs://${bucket}/${name}`;
    const uploadRecord = await FileUpload.findOne({ path: gcsUri }).sort({ createdAt: -1 });

    // Download file
    const buffer = await readGcsFileToBuffer(bucket, name);

    // OCR service expects a file path; extend service to support buffer if needed
    // For now, write to tmp and pass path
    const tmpPath = path.join('/tmp', path.basename(name));
    const fs = require('fs');
    fs.writeFileSync(tmpPath, buffer);

    // Get user profile for context
    const userProfile = await UserProfile.findOne({ userId });

    // Update status to processing
    if (uploadRecord) {
      await FileUpload.findByIdAndUpdate(uploadRecord._id, {
        $set: { 'metadata.status': 'processing', 'metadata.processedAt': new Date().toISOString() }
      });
    }

    // OCR
    const ocrResult = await ocrService.processResume(tmpPath, userProfile);

    let normalized = null;
    try {
      if (ocrResult && ocrResult.extractedText) {
        normalized = await aiService.analyzeResumeText(ocrResult.extractedText, userProfile || {});
      }
    } catch (_) {}

    if (ocrResult.success) {
      // Update upload record with results
      if (uploadRecord) {
        await FileUpload.findByIdAndUpdate(uploadRecord._id, {
          $set: {
            'metadata.status': 'completed',
            'metadata.extractedData': {
              ...ocrResult.processedData,
              normalized: normalized || undefined,
              ocrConfidence: ocrResult.confidence,
              extractedText: (ocrResult.extractedText || '').substring(0, 5000),
              processedAt: new Date().toISOString()
            }
          }
        });
      }

      // Upsert profile skills
      if (ocrResult.confidence > 0.7) {
        await upsertSkillsFromResume(userId, normalized || ocrResult.processedData);
      }

      // Create notification
      await Notification.create({
        userId,
        type: 'SYSTEM',
        title: 'Resume processed',
        message: 'Your resume has been analyzed successfully',
        channels: ['IN_APP']
      });
    } else {
      if (uploadRecord) {
        await FileUpload.findByIdAndUpdate(uploadRecord._id, {
          $set: { 'metadata.status': 'failed', 'metadata.extractedData': { error: ocrResult.error, processedAt: new Date().toISOString() } }
        });
      }
    }
  } catch (error) {
    console.error('Resume worker error:', error);
  }
};

async function upsertSkillsFromResume(userId, processedData) {
  const { personalInfo, skills = [] } = processedData || {};
  const existingProfile = await UserProfile.findOne({ userId });
  const mergedSkills = [...new Set([...(skills || []), ...((existingProfile?.skills) || [])])];

  await UserProfile.findOneAndUpdate(
    { userId },
    {
      $set: {
        bio: `Profile auto-updated from resume. ${personalInfo?.summary || ''}`,
        skills: mergedSkills,
        interests: mergedSkills.slice(0, 20)
      }
    },
    { upsert: true, new: true }
  );

  for (const raw of mergedSkills.slice(0, 50)) {
    const name = String(raw).trim();
    if (!name) continue;
    const normalized = name.toLowerCase().replace(/[^a-z0-9+.#]+/g, '-');
    const skill = await Skill.findOneAndUpdate(
        { normalized },
        { $set: { name }, $setOnInsert: { normalized, tags: [] } },
        { upsert: true, new: true }
    );
    await UserSkill.findOneAndUpdate(
        { userId, skillId: skill._id },
        { $set: { source: 'resume', confidence: processedData?.normalizedConfidence || 0.7 } },
        { upsert: true, new: true }
    );
  }
}


