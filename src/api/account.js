const express = require('express');
const router = express.Router();

// All account management endpoints temporarily disabled during MongoDB migration
router.get('/', async (req, res) => {
  res.status(501).json({ 
    message: 'Account management temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

router.put('/', async (req, res) => {
  res.status(501).json({ 
    message: 'Account management temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

router.delete('/', async (req, res) => {
  res.status(501).json({ 
    message: 'Account management temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

module.exports = router;