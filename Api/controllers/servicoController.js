const Servico = require('../models/Servico');

/**
 * Controller para gestão de serviços
 */

// @desc    Listar todos os serviços
// @route   GET /api/v1/servicos
// @query   tipo, especialidade, page, limit
exports.getServicos = async (req, res, next) => {
  try {
    const { tipo, especialidade, page = 1, limit = 50 } = req.query;

    const filters = {};
    if (tipo) filters.TypeDescription = { $regex: tipo, $options: 'i' };
    if (especialidade) filters.Speciality = { $regex: especialidade, $options: 'i' };

    const servicos = await Servico.find(filters)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ Speciality: 1 });

    const total = await Servico.countDocuments(filters);

    res.status(200).json({
      success: true,
      count: servicos.length,
      total: total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: servicos
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obter detalhes de um serviço
// @route   GET /api/v1/servicos/:id
exports.getServico = async (req, res, next) => {
  try {
    const servico = await Servico.findOne({ 
      ServiceKey: parseInt(req.params.id)
    });

    if (!servico) {
      return res.status(404).json({
        success: false,
        error: 'Serviço não encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: servico
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
