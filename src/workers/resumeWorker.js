// GCS-triggered Resume Worker (Cloud Function)
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const prisma = require('../config/prisma');
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
    const uploadRecord = await prisma.fileUpload.findFirst({
      where: { path: gcsUri },
      orderBy: { createdAt: 'desc' }
    });

    // Download file
    const buffer = await readGcsFileToBuffer(bucket, name);

    // OCR service expects a file path; extend service to support buffer if needed
    // For now, write to tmp and pass path
    const tmpPath = path.join('/tmp', path.basename(name));
    const fs = require('fs');
    fs.writeFileSync(tmpPath, buffer);

    // Get user profile for context
    const userProfile = await prisma.userProfile.findUnique({ where: { userId } });

    // Update status to processing
    if (uploadRecord) {
      await prisma.fileUpload.update({
        where: { id: uploadRecord.id },
        data: { metadata: { status: 'processing', processedAt: new Date().toISOString() } }
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
        await prisma.fileUpload.update({
          where: { id: uploadRecord.id },
          data: {
            metadata: {
              status: 'completed',
              extractedData: {
                ...ocrResult.processedData,
                normalized: normalized || undefined,
                ocrConfidence: ocrResult.confidence,
                extractedText: (ocrResult.extractedText || '').substring(0, 5000),
                processedAt: new Date().toISOString()
              }
            }
          }
        });
      }

      // Upsert profile skills
      if (ocrResult.confidence > 0.7) {
        await upsertSkillsFromResume(userId, normalized || ocrResult.processedData);
      }

      // Create notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'SYSTEM',
          title: 'Resume processed',
          message: 'Your resume has been analyzed successfully',
          channels: ['IN_APP']
        }
      });
    } else {
      if (uploadRecord) {
        await prisma.fileUpload.update({
          where: { id: uploadRecord.id },
          data: { metadata: { status: 'failed', extractedData: { error: ocrResult.error, processedAt: new Date().toISOString() } } }
        });
      }
    }
  } catch (error) {
    console.error('Resume worker error:', error);
  }
};

async function upsertSkillsFromResume(userId, processedData) {
  const { personalInfo, skills = [] } = processedData || {};
  const existingProfile = await prisma.profile.findUnique({ where: { userId } });
  const mergedSkills = [...new Set([...(skills || []), ...((existingProfile?.skills) || [])])];

  await prisma.profile.upsert({
    where: { userId },
    update: {
      summary: `Profile auto-updated from resume. ${personalInfo?.summary || ''}`,
      skills: mergedSkills,
      tags: mergedSkills.slice(0, 20)
    },
    create: {
      userId,
      summary: `Profile auto-generated from resume. ${personalInfo?.summary || ''}`,
      skills: mergedSkills,
      tags: mergedSkills
    }
  });

  for (const raw of mergedSkills.slice(0, 50)) {
    const name = String(raw).trim();
    if (!name) continue;
    const normalized = name.toLowerCase().replace(/[^a-z0-9+.#]+/g, '-');
    const skill = await prisma.skill.upsert({
      where: { normalized },
      update: { name },
      create: { name, normalized, tags: [] }
    });
    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId: skill.id } },
      update: { source: 'resume', confidence: processedData?.normalizedConfidence || 0.7 },
      create: { userId, skillId: skill.id, source: 'resume', confidence: processedData?.normalizedConfidence || 0.7 }
    });
  }
}


