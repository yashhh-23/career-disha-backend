const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  res.status(501).json({ 
    message: 'Constellation functionality temporarily disabled during MongoDB migration',
    error: 'Feature under development'
  });
});

module.exports = router;