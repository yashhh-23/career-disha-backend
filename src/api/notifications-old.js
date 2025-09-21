const express = require('express');
const prisma = require('../config/prisma');
const socketService = require('../services/socketService');
const { requireMentorOrAdmin, requireAdmin } = require('../middlewares/roleAuth');
const nodemailer = require('nodemailer');

const router = express.Router();

/**
 * @swagger
 * /api/v1/notifications/send:
 *   post:
 *     tags: [Notifications]
 *     summary: Send real-time notification to user
 *     description: Send a real-time notification to a specific user (admin/mentor only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - title
 *               - message
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: Target user ID
 *               title:
 *                 type: string
 *                 description: Notification title
 *               message:
 *                 type: string
 *                 description: Notification message
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *                 default: normal
 *               actionUrl:
 *                 type: string
 *                 description: Optional URL for notification action
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/send', requireMentorOrAdmin(), async (req, res) => {
  try {
    const { userId, title, message, priority = 'normal', actionUrl } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        error: 'userId, title, and message are required'
      });
    }

    // Persist in DB respecting user preferences
    const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
    const inAppEnabled = prefs?.inAppEnabled !== false;
    const isMuted = prefs?.mutedTypes?.includes('SYSTEM');
    let saved = null;
    if (inAppEnabled && !isMuted) {
      saved = await prisma.notification.create({
        data: {
          userId,
          type: 'SYSTEM',
          title,
          message,
          channels: ['IN_APP'],
          priority: priority.toUpperCase(),
          data: { actionUrl }
        }
      });
      // Send real-time notification
      socketService.sendSystemNotification(userId, {
        title,
        message,
        priority,
        actionUrl
      });
    }

    // Email fallback (best-effort)
    if (prefs?.emailEnabled) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (user?.email) {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'no-reply@careerdisha.app',
            to: user.email,
            subject: title,
            text: message,
            html: `<p>${message}</p>${actionUrl ? `<p><a href="${actionUrl}">Open</a></p>` : ''}`
          });
        }
      } catch (emailErr) {
        console.warn('Email fallback failed:', emailErr.message);
      }
    }

    res.json({
      message: 'Notification sent successfully',
      notification: saved || null
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/notifications/broadcast:
 *   post:
 *     tags: [Notifications]
 *     summary: Broadcast message to users by role
 *     description: Send a broadcast message to all users or users of specific role (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Broadcast message
 *               targetRole:
 *                 type: string
 *                 enum: [all, student, mentor, admin]
 *                 default: all
 *                 description: Target user role
 *               title:
 *                 type: string
 *                 description: Optional broadcast title
 *     responses:
 *       200:
 *         description: Broadcast sent successfully
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/broadcast', requireAdmin(), async (req, res) => {
  try {
    const { message, targetRole = 'all', title } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    // Get connection info to see who will receive the broadcast
    const connectionInfo = socketService.getConnectionInfo();
    
    // Send broadcast via socket service
    if (targetRole === 'all') {
      socketService.io.emit('admin_message', {
        title: title || 'System Announcement',
        message: message.trim(),
        sentBy: req.user.id,
        timestamp: new Date().toISOString()
      });
    } else {
      socketService.io.to(`role:${targetRole}`).emit('admin_message', {
        title: title || 'System Announcement',
        message: message.trim(),
        targetRole,
        sentBy: req.user.id,
        timestamp: new Date().toISOString()
      });
    }

    // Calculate potential recipients
    const potentialRecipients = targetRole === 'all' 
      ? connectionInfo.connectedUsers
      : connectionInfo.connections.filter(conn => conn.role === targetRole).length;

    res.json({
      message: 'Broadcast sent successfully',
      broadcast: {
        message: message.trim(),
        title: title || 'System Announcement',
        targetRole,
        potentialRecipients,
        sentBy: req.user.id,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Broadcast error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/notifications/connections:
 *   get:
 *     tags: [Notifications]
 *     summary: Get real-time connection information
 *     description: Get information about currently connected users (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connectedUsers:
 *                   type: integer
 *                   description: Total connected users
 *                 rooms:
 *                   type: integer
 *                   description: Number of active rooms
 *                 connections:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: integer
 *                       role:
 *                         type: string
 *                       lastSeen:
 *                         type: string
 *                         format: date-time
 *                       socketId:
 *                         type: string
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/connections', requireAdmin(), (req, res) => {
  try {
    const connectionInfo = socketService.getConnectionInfo();
    
    res.json({
      ...connectionInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/notifications/mentorship/{questionId}/notify:
 *   post:
 *     tags: [Notifications]
 *     summary: Notify about mentorship question activity
 *     description: Send real-time notification about mentorship question updates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: questionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *               - message
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [question_answered, question_updated, new_message]
 *               message:
 *                 type: string
 *               notifyUser:
 *                 type: boolean
 *                 default: true
 *               notifyMentors:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/mentorship/:questionId/notify', requireMentorOrAdmin(), async (req, res) => {
  try {
    const { questionId } = req.params;
    const { event, message, notifyUser = true, notifyMentors = false } = req.body;

    if (!event || !message) {
      return res.status(400).json({
        error: 'Event and message are required'
      });
    }

    // Get question details
    const question = await prisma.mentorshipQuestion.findUnique({
      where: { id: questionId },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const notifications = [];

    // Notify question owner
    if (notifyUser) {
      socketService.notifyUser(question.userId, 'mentorship_notification', {
        questionId,
        event,
        message,
        title: 'Mentorship Update',
        priority: 'normal'
      });
      notifications.push({ target: 'user', userId: question.userId });
    }

    // Notify mentors
    if (notifyMentors) {
      socketService.notifyMentors('mentorship_notification', {
        questionId,
        event,
        message,
        title: 'New Mentorship Activity',
        priority: 'normal',
        questionOwner: question.user.email
      });
      notifications.push({ target: 'mentors' });
    }

    res.json({
      message: 'Notifications sent successfully',
      notifications,
      questionId,
      event,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Mentorship notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/v1/notifications/progress/notify:
 *   post:
 *     tags: [Notifications]
 *     summary: Notify about user progress updates
 *     description: Send real-time notifications about user progress to mentors
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - type
 *               - progress
 *             properties:
 *               userId:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [lesson, skill, recommendation, interview]
 *               progress:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               milestone:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Progress notification sent successfully
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/progress/notify', requireMentorOrAdmin(), async (req, res) => {
  try {
    const { userId, type, progress, milestone, message } = req.body;

    if (!userId || !type || progress === undefined) {
      return res.status(400).json({
        error: 'userId, type, and progress are required'
      });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const progressMessage = message || `${user.email} has made progress in ${type}: ${progress}%`;

    // Notify mentors about student progress
    if (user.role === 'student') {
      socketService.notifyMentors('student_progress_update', {
        userId,
        userEmail: user.email,
        type,
        progress,
        milestone,
        message: progressMessage,
        title: 'Student Progress Update'
      });
    }

    // Notify the user about their own milestone
    if (milestone) {
      socketService.notifyUser(userId, 'milestone_achieved', {
        type,
        progress,
        milestone,
        title: 'Milestone Achieved!',
        message: `Congratulations! You've achieved: ${milestone}`
      });
    }

    res.json({
      message: 'Progress notifications sent successfully',
      userId,
      type,
      progress,
      milestone,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Progress notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;