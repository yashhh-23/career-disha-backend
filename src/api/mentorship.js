const express = require('express');
const router = express.Router();

// All mentorship endpoints temporarily disabled during MongoDB migration
router.get('/', async (req, res) => {
  res.status(501).json({ 
    message: 'Mentorship functionality temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

router.post('/', async (req, res) => {
  res.status(501).json({ 
    message: 'Mentorship functionality temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

module.exports = router;