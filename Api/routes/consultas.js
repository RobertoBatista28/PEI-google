const express = require('express');
const router = express.Router();
const {
  getDiferencaOncologia,
  getConsultas,
  submitConsultaXML
} = require('../controllers/consultaController');

const validateAndParseXML = require('../middleware/validateXML');

/**
 * @route   GET /api/v1/consultas
 * @desc    Listar consultas com filtros
 * @access  Public
 */
router.get('/', getConsultas);

/**
 * @route   GET /api/v1/consultas/diferenca-oncologia
 * @desc    Diferença entre tempos médios oncologia vs. não-oncologia
 * @access  Public
 */
router.get('/diferenca-oncologia', getDiferencaOncologia);

/**
 * @route   POST /api/v1/consultas/submit-xml
 * @desc    Submeter dados de consulta via XML
 * @access  Public
 */
router.post('/submit-xml', 
  express.text({ type: ['application/xml', 'text/xml'] }), 
  validateAndParseXML('Consulta-schema.xsd'), 
  submitConsultaXML
);

module.exports = router;
