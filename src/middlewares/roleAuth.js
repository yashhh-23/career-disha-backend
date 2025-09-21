const { User } = require('../models');

/**
 * Role-based authorization middleware
 * @param {Array<string>} allowedRoles - Array of roles that can access this endpoint
 * @returns {Function} Express middleware function
 */
function requireRole(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      // Must have valid JWT token first (from auth middleware)
      if (!req.user || !req.user.id) {
        return res.status(401).json({ 
          error: 'Authentication required' 
        });
      }

      // Get user with role information
      const user = await User.findById(req.user.id)
        .select('email role');

      if (!user) {
        return res.status(401).json({ 
          error: 'User not found' 
        });
      }

      // Check if user's role is in allowed roles
      // Normalize allowedRoles to uppercase to match DB enum
      const normalizedAllowed = allowedRoles.map(r => String(r).toUpperCase());
      if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(String(user.role).toUpperCase())) {
        return res.status(403).json({ 
          error: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${user.role}` 
        });
      }

      // Add role information to request object for further use
      req.user.role = user.role;
      next();

    } catch (error) {
      console.error('Role authorization error:', error);
      return res.status(500).json({ 
        error: 'Internal server error during authorization' 
      });
    }
  };
}

/**
 * Convenience middleware functions for common role checks
 */
const requireAdmin = () => requireRole(['ADMIN']);
const requireMentor = () => requireRole(['MENTOR', 'ADMIN']);
const requireStudent = () => requireRole(['STUDENT']);
const requireMentorOrAdmin = () => requireRole(['MENTOR', 'ADMIN']);
const requireAnyRole = () => requireRole([]); // Just authenticated user

/**
 * Check if user owns resource or has appropriate role
 * @param {number} resourceUserId - User ID that owns the resource
 * @param {Object} req - Express request object
 * @returns {boolean} - True if user can access resource
 */
function canAccessResource(resourceUserId, req) {
  const currentUserId = req.user.id;
  const userRole = req.user.role;

  // User owns the resource
  if (currentUserId === resourceUserId) {
    return true;
  }

  // Admin can access anything
  if (userRole === 'admin') {
    return true;
  }

  // Mentors can access student resources
  if (userRole === 'mentor') {
    return true;
  }

  return false;
}

/**
 * Resource ownership middleware
 * Checks if user owns resource or has appropriate role to access it
 * @param {string} userIdParam - Name of the parameter containing user ID (default: 'userId')
 */
function requireResourceAccess(userIdParam = 'userId') {
  return async (req, res, next) => {
    try {
      const resourceUserId = parseInt(req.params[userIdParam]);
      
      if (isNaN(resourceUserId)) {
        return res.status(400).json({ 
          error: 'Invalid user ID parameter' 
        });
      }

      if (!canAccessResource(resourceUserId, req)) {
        return res.status(403).json({ 
          error: 'Access denied. You can only access your own resources unless you are a mentor/admin.' 
        });
      }

      next();
    } catch (error) {
      console.error('Resource access authorization error:', error);
      return res.status(500).json({ 
        error: 'Internal server error during resource authorization' 
      });
    }
  };
}

/**
 * Get user role for display/filtering purposes
 * @param {number} userId - User ID to get role for
 * @returns {Promise<string>} - User role
 */
async function getUserRole(userId) {
  try {
    const user = await User.findById(userId)
      .select('role');
    
    return user?.role || 'STUDENT';
  } catch (error) {
    console.error('Error getting user role:', error);
    return 'STUDENT'; // Default fallback
  }
}

/**
 * Role validation utility
 * @param {string} role - Role to validate
 * @returns {boolean} - True if role is valid
 */
function isValidRole(role) {
  const validRoles = ['STUDENT', 'MENTOR', 'ADMIN', 'SUPER_ADMIN'];
  return validRoles.includes(String(role).toUpperCase());
}

module.exports = {
  requireRole,
  requireAdmin,
  requireMentor,
  requireStudent,
  requireMentorOrAdmin,
  requireAnyRole,
  requireResourceAccess,
  canAccessResource,
  getUserRole,
  isValidRole
};