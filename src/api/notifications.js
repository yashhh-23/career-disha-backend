const express = require('express');
const router = express.Router();

// All notification endpoints temporarily disabled during MongoDB migration
router.get('/', async (req, res) => {
  res.status(501).json({ 
    message: 'Notification functionality temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

router.post('/', async (req, res) => {
  res.status(501).json({ 
    message: 'Notification functionality temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

router.put('/:id/read', async (req, res) => {
  res.status(501).json({ 
    message: 'Notification functionality temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

module.exports = router;