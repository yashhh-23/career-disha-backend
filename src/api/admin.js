const express = require('express');
const router = express.Router();

// All admin endpoints temporarily disabled during MongoDB migration
router.get('/users', async (req, res) => {
  res.status(501).json({ 
    message: 'Admin functionality temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

router.get('/analytics', async (req, res) => {
  res.status(501).json({ 
    message: 'Admin functionality temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

module.exports = router;