const express = require('express');
const router = express.Router();
const {
  getHospitais,
  getHospital,
  getHospitaisProximos
} = require('../controllers/hospitalController');

/**
 * @route   GET /api/v1/hospitais
 * @desc    Listar todos os hospitais
 * @access  Public
 */
router.get('/', getHospitais);

/**
 * @route   GET /api/v1/hospitais/proximos/:longitude/:latitude
 * @desc    Pesquisar hospitais próximos (geoespacial)
 * @access  Public
 */
router.get('/proximos/:longitude/:latitude', getHospitaisProximos);

/**
 * @route   GET /api/v1/hospitais/:id
 * @desc    Obter detalhes de um hospital
 * @access  Public
 */
router.get('/:id', getHospital);

module.exports = router;
