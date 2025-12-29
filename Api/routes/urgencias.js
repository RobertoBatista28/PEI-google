const express = require('express');
const router = express.Router();
const {
  getUrgencias,
  getUrgencia,
  getMediaEsperaPorTipologia,
  getPercentagensPorCategoria,
  getTempoMedioPediatricas,
  getTopHospitaisPediatricas,
  getEvolucaoTemporal,
  submitUrgenciaXML
} = require('../controllers/urgenciaController');

const validateAndParseXML = require('../middleware/validateXML');

/**
 * @route   GET /api/v1/urgencias/media-espera
 * @desc    Média de utentes em espera por tipologia e categoria de triagem
 * @access  Public
 */
router.get('/media-espera', getMediaEsperaPorTipologia);

/**
 * @route   GET /api/v1/urgencias/percentagens-triagem
 * @desc    Percentagem por categoria de triagem num hospital
 * @access  Public
 */
router.get('/percentagens-triagem', getPercentagensPorCategoria);

/**
 * @route   GET /api/v1/urgencias/tempo-medio-pediatricas
 * @desc    Tempo médio de espera para triagem nas urgências pediátricas por região
 * @access  Public
 */
router.get('/tempo-medio-pediatricas', getTempoMedioPediatricas);

/**
 * @route   GET /api/v1/urgencias/top-hospitais-pediatricas
 * @desc    Top 10 hospitais com menores tempos médios (urgências pediátricas)
 * @access  Public
 */
router.get('/top-hospitais-pediatricas', getTopHospitaisPediatricas);

/**
 * @route   GET /api/v1/urgencias/evolucao-temporal
 * @desc    Evolução temporal dos tempos de espera (agregação 15 em 15 min)
 * @access  Public
 */
router.get('/evolucao-temporal', getEvolucaoTemporal);

/**
 * @route   POST /api/v1/urgencias/submit-xml
 * @desc    Submeter dados de urgência via XML
 * @access  Public
 */
router.post('/submit-xml', express.text({ type: ['application/xml', 'text/xml'] }), validateAndParseXML('Urgencia-schema.xsd'), submitUrgenciaXML);

/**
 * @route   GET /api/v1/urgencias/:id
 * @desc    Obter uma urgência específica por ID
 * @access  Public
 */
router.get('/:id', getUrgencia);

/**
 * @route   GET /api/v1/urgencias
 * @desc    Listar todas as urgências com filtros
 * @access  Public
 */
router.get('/', getUrgencias);

module.exports = router;
