const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

// GET /api/v1/account/me/export - Export user's data (GDPR)
router.get('/me/export', async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      user,
      userProfile,
      mentorProfile,
      uploads,
      interviews,
      interviewSessions,
      recommendations,
      progress,
      achievements,
      notifications,
      skills,
      userSkills,
      enrollments,
      lessonProgress,
      careerPaths,
      settings,
      analytics,
      notificationPrefs
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true, isActive: true } }),
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.mentorProfile.findUnique({ where: { userId } }),
      prisma.fileUpload.findMany({ where: { uploadedBy: userId } }),
      prisma.interview.findMany({ where: { userId } }),
      prisma.interviewSession.findMany({ where: { userId } }),
      prisma.recommendation.findMany({ where: { userId } }),
      prisma.progress.findMany({ where: { userId } }),
      prisma.achievement.findMany({ where: { userId } }),
      prisma.notification.findMany({ where: { userId } }),
      prisma.skill.findMany({ where: { userSkills: { some: { userId } } } }),
      prisma.userSkill.findMany({ where: { userId } }),
      prisma.enrollment.findMany({ where: { userId } }),
      prisma.lessonProgress.findMany({ where: { userId } }),
      prisma.careerPath.findMany({ where: { userId } }),
      prisma.setting.findMany({ where: { isPublic: true } }),
      prisma.analytics.findMany({ where: { userId } }),
      prisma.notificationPreference.findUnique({ where: { userId } })
    ]);

    const exportPayload = {
      user,
      userProfile,
      mentorProfile,
      uploads,
      interviews,
      interviewSessions,
      recommendations,
      progress,
      achievements,
      notifications,
      skills,
      userSkills,
      enrollments,
      lessonProgress,
      careerPaths,
      settings,
      analytics,
      notificationPrefs,
      exportedAt: new Date().toISOString()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="careerdisha-export-${userId}.json"`);
    return res.status(200).send(JSON.stringify(exportPayload));
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Failed to export data' });
  }
});

// DELETE /api/v1/account/me - Delete user account (GDPR)
router.delete('/me', async (req, res) => {
  try {
    const userId = req.user.id;

    // Soft delete strategy + PII minimization
    const anonymizedEmail = `deleted_${userId}@example.local`;

    // Best-effort transactional cleanup
    const result = await prisma.$transaction(async (tx) => {
      // Revoke tokens and pending resets
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.passwordReset.deleteMany({ where: { userId } });

      // Null or wipe PII in profiles
      await tx.userProfile.updateMany({ where: { userId }, data: {
        firstName: null,
        lastName: null,
        dateOfBirth: null,
        phone: null,
        avatar: null,
        bio: null,
        location: null,
        timezone: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        currentJobTitle: null,
        company: null,
        careerGoals: null,
        skills: [],
        interests: [],
        preferredLanguages: []
      } });

      // Legacy profile
      await tx.profile.updateMany({ where: { userId }, data: {
        summary: null,
        tags: [],
        skills: [],
        languages: [],
        interests: [],
        experience: null,
        education: null
      } });

      // Mark notifications as read and low-retain
      await tx.notification.updateMany({ where: { userId }, data: { isRead: true } });

      // Deactivate user and anonymize email/name
      const updatedUser = await tx.user.update({ where: { id: userId }, data: {
        isActive: false,
        email: anonymizedEmail,
        name: 'Deleted User'
      }, select: { id: true } });

      return updatedUser;
    });

    return res.status(200).json({ success: true, userId: result.id, status: 'deleted' });
  } catch (error) {
    console.error('Account delete error:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;


