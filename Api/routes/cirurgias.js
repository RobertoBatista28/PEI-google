const express = require('express');
const router = express.Router();
const {
  getTempoMedioPorEspecialidade,
  getCirurgias,
  submitCirurgiaXML
} = require('../controllers/cirurgiaController');

const validateAndParseXML = require('../middleware/validateXML');

/**
 * @route   GET /api/v1/cirurgias
 * @desc    Listar cirurgias com filtros
 * @access  Public
 */
router.get('/', getCirurgias);

/**
 * @route   GET /api/v1/cirurgias/tempo-medio-especialidade
 * @desc    Tempo médio de espera para cirurgia (geral vs. oncológica)
 * @access  Public
 */
router.get('/tempo-medio-especialidade', getTempoMedioPorEspecialidade);

/**
 * @route   POST /api/v1/cirurgias/submit-xml
 * @desc    Submeter dados de cirurgia via XML
 * @access  Public
 */
router.post('/submit-xml', 
    express.text({ type: ['application/xml', 'text/xml'] }), 
    validateAndParseXML('Cirurgia-schema.xsd'), 
    submitCirurgiaXML
);

module.exports = router;
