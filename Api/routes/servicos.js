const express = require('express');
const router = express.Router();
const {
  getServicos,
  getServico
} = require('../controllers/servicoController');

/**
 * @route   GET /api/v1/servicos
 * @desc    Listar todos os serviços
 * @access  Public
 */
router.get('/', getServicos);

/**
 * @route   GET /api/v1/servicos/:id
 * @desc    Obter detalhes de um serviço
 * @access  Public
 */
router.get('/:id', getServico);

module.exports = router;
