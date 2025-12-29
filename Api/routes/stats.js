const express = require('express');
const router = express.Router();
const {
  getDiscrepanciaConsultaCirurgia,
  getStatisticsGeral
} = require('../controllers/statsController');

/**
 * @route   GET /api/v1/stats/geral
 * @desc    Estatísticas gerais do sistema
 * @access  Public
 */
router.get('/geral', getStatisticsGeral);

/**
 * @route   GET /api/v1/stats/discrepancia-consulta-cirurgia
 * @desc    Discrepância entre tempos médios de consultas e cirurgias
 * @access  Public
 */
router.get('/discrepancia-consulta-cirurgia', getDiscrepanciaConsultaCirurgia);

module.exports = router;
