const express = require('express');
const router = express.Router();

// All recommendation endpoints temporarily disabled during MongoDB migration
router.get('/', async (req, res) => {
  res.status(501).json({ 
    message: 'Recommendation functionality temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

router.post('/', async (req, res) => {
  res.status(501).json({ 
    message: 'Recommendation functionality temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

module.exports = router;