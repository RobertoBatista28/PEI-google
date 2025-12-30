const Consulta = require('../models/Consulta');
const Servico = require('../models/Servico');
const Hospital = require('../models/Hospital');

/**
 * Controller para análises de consultas
 */

// @desc    Diferença entre tempos médios oncologia vs. não-oncologia
// @route   GET /api/v1/consultas/diferenca-oncologia
// @query   especialidade, hospitalId (opcional), dataInicio, dataFim
exports.getDiferencaOncologia = async (req, res, next) => {
  try {
    const { especialidade, hospitalId, dataInicio, dataFim } = req.query;

    if (!especialidade) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro especialidade é obrigatório'
      });
    }

    // Primeiro, buscar os ServiceSK que correspondem à especialidade
    const servicos = await Servico.find({ 
      Speciality: { $regex: especialidade, $options: 'i' } 
    }).select('ServiceKey');

    if (servicos.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Especialidade ${especialidade} não encontrada`
      });
    }

    const servicoKeys = servicos.map(s => s.ServiceKey);

    const filters = { ServiceSK: { $in: servicoKeys } };
    
    if (hospitalId) filters.HospitalId = parseInt(hospitalId);
    
    // Nota: Consultas não tem campo de data direto, apenas Year e Month
    if (dataInicio || dataFim) {
      const anoInicio = dataInicio ? new Date(dataInicio).getFullYear() : null;
      const anoFim = dataFim ? new Date(dataFim).getFullYear() : null;
      
      if (anoInicio) filters.Year = { $gte: anoInicio };
      if (anoFim && !anoInicio) filters.Year = { $lte: anoFim };
      if (anoInicio && anoFim) filters.Year = { $gte: anoInicio, $lte: anoFim };
    }

    const resultado = await Consulta.aggregate([
      { $match: filters },
      {
        $lookup: {
          from: 'Servico',
          localField: 'ServiceSK',
          foreignField: 'ServiceKey',
          as: 'servico'
        }
      },
      { $unwind: { path: '$servico', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            isOncology: {
              $cond: [
                { 
                  $or: [
                    { $regexMatch: { input: { $ifNull: ['$servico.PriorityDescription', ''] }, regex: /oncológica/i } },
                    { $regexMatch: { input: { $ifNull: ['$servico.Speciality', ''] }, regex: /oncolog/i } }
                  ]
                },
                true,
                false
              ]
            },
            hospitalName: '$HospitalName'
          },
          tempoMedioEspera: { $avg: '$AverageWaitingTime' },
          totalUtentes: { $sum: '$NumberOfPeople' },
          totalRegistos: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            hospitalName: '$_id.hospitalName'
          },
          consultas: {
            $push: {
              tipo: { $cond: ['$_id.isOncology', 'Oncologia', 'Não-Oncologia'] },
              tempoMedioEspera: { $round: ['$tempoMedioEspera', 2] },
              totalUtentes: '$totalUtentes'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          hospitalName: '$_id.hospitalName',
          consultas: 1,
          diferencaTempo: {
            $let: {
              vars: {
                onco: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$consultas',
                        as: 'c',
                        cond: { $eq: ['$$c.tipo', 'Oncologia'] }
                      }
                    },
                    0
                  ]
                },
                naoOnco: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$consultas',
                        as: 'c',
                        cond: { $eq: ['$$c.tipo', 'Não-Oncologia'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: {
                $round: [
                  {
                    $subtract: [
                      { $ifNull: ['$$onco.tempoMedioEspera', 0] },
                      { $ifNull: ['$$naoOnco.tempoMedioEspera', 0] }
                    ]
                  },
                  2
                ]
              }
            }
          }
        }
      },
      { $sort: { diferencaTempo: -1 } }
    ]);

    res.status(200).json({
      success: true,
      count: resultado.length,
      especialidade: especialidade,
      periodo: { dataInicio, dataFim },
      data: resultado
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Listar todas as consultas com filtros
// @route   GET /api/v1/consultas
// @query   hospitalName, ano, mes, especialidade
exports.getConsultas = async (req, res, next) => {
  try {
    const { hospitalName, ano, mes, especialidade, page = 1, limit = 50 } = req.query;

    const filters = {};
    if (hospitalName) filters.HospitalName = { $regex: hospitalName, $options: 'i' };
    if (ano) filters.Year = parseInt(ano);
    if (mes) filters.Month = { $regex: mes, $options: 'i' };
    
    // Filtrar por especialidade requer lookup com Servico
    let query = Consulta.find(filters);

    if (especialidade) {
      // Buscar ServiceSK que correspondem à especialidade
      const servicos = await Servico.find({ 
        Speciality: { $regex: especialidade, $options: 'i' } 
      }).select('ServiceKey');
      
      const servicoKeys = servicos.map(s => s.ServiceKey);
      query = query.where('ServiceSK').in(servicoKeys);
    }

    const consultas = await query
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ Year: -1, Month: 1 });

    const total = await Consulta.countDocuments(filters);

    res.status(200).json({
      success: true,
      count: consultas.length,
      total: total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: consultas
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submeter dados de consulta via XML
// @route   POST /api/v1/consultas/submit-xml
exports.submitConsultaXML = async (req, res, next) => {
  try {
    // Dados já convertidos de XML para JSON pelo middleware
    const xmlData = req.body;
    
    // Validar estrutura do XML
    if (!xmlData || !xmlData.RelatorioConsultas) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'XML inválido: elemento <RelatorioConsultas> não encontrado'
      });
    }

    const cabecalho = xmlData.RelatorioConsultas.Cabecalho;
    const listaConsultas = xmlData.RelatorioConsultas.ListaConsultas;

    if (!cabecalho || !listaConsultas) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'XML inválido: Cabecalho ou ListaConsultas não encontrado'
      });
    }

    // Validar campos obrigatórios do cabeçalho
    if (!cabecalho.HospitalID || !cabecalho.HospitalName) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: 'Campos obrigatórios ausentes no cabeçalho: HospitalID e HospitalName'
      });
    }

    // Validar se o Hospital existe pelo HospitalId
    const hospitalExists = await Hospital.findOne({ 
      HospitalId: parseInt(cabecalho.HospitalID)
    });
    
    if (!hospitalExists) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: `Hospital com HospitalId ${cabecalho.HospitalID} não encontrado na base de dados`
      });
    }

    // Validar se o HospitalName corresponde ao HospitalId
    if (hospitalExists.HospitalName !== cabecalho.HospitalName) {
      return res.status(400).json({
        success: false,
        status: 'error',
        error: `HospitalName "${cabecalho.HospitalName}" não corresponde ao HospitalId ${cabecalho.HospitalID}`
      });
    }

    // Normalizar lista para array (caso venha apenas 1 item)
    let consultas = listaConsultas.Consulta;
    if (!Array.isArray(consultas)) {
      consultas = [consultas];
    }

    // Função auxiliar para converter mês em número
    const getMonthNumber = (mes) => {
      const meses = {
        'janeiro': 1, 'fevereiro': 2, 'março': 3, 'abril': 4,
        'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
        'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
      };
      return meses[mes.toLowerCase()] || 1;
    };

    // Preparar operações em lote
    const bulkOperations = [];
    const errors = [];

    for (let i = 0; i < consultas.length; i++) {
      const consultaData = consultas[i];

      try {
        // Validar se o ServiceSK existe na coleção Servico
        const servicoExists = await Servico.findOne({ ServiceKey: parseInt(consultaData.ServiceSK) });
        if (!servicoExists) {
          errors.push(`Consulta ${i + 1}: Serviço com ServiceKey ${consultaData.ServiceSK} não encontrado`);
          continue;
        }

        // Construir documento
        const doc = {
          HospitalId: parseInt(cabecalho.HospitalID),
          HospitalName: cabecalho.HospitalName,
          ServiceSK: parseInt(consultaData.ServiceSK),
          TargetPopulation: consultaData.TargetPopulation,
          WaitingListType: consultaData.WaitingListType,
          AverageWaitingTime: {
            Normal: parseFloat(consultaData.AverageWaitingTime.Normal || 0),
            Prioritario: parseFloat(consultaData.AverageWaitingTime.Prioritario || 0),
            MuitoPrioritario: parseFloat(consultaData.AverageWaitingTime.MuitoPrioritario || 0)
          },
          Day: parseInt(consultaData.Day),
          Week: Math.ceil(parseInt(consultaData.Day) / 7), // Aproximação simples
          Quarter: Math.ceil(getMonthNumber(cabecalho.Periodo.Mes) / 3),
          Month: cabecalho.Periodo.Mes,
          Year: parseInt(cabecalho.Periodo.Ano),
          NumberOfPeople: parseInt(consultaData.NumberOfPeople || 0),
          PriorityDescription: consultaData.PriorityDescription || null,
          Speciality: consultaData.Speciality || servicoExists.Speciality
        };

        // Critério de unicidade
        const filter = {
          HospitalId: doc.HospitalId,
          ServiceSK: doc.ServiceSK,
          Month: doc.Month,
          Year: doc.Year,
          Day: doc.Day
        };

        bulkOperations.push({
          updateOne: {
            filter: filter,
            update: { $set: doc },
            upsert: true
          }
        });

      } catch (err) {
        errors.push(`Consulta ${i + 1}: ${err.message}`);
      }
    }

    // Executar operações em lote
    if (bulkOperations.length > 0) {
      const result = await Consulta.bulkWrite(bulkOperations);

      return res.status(201).json({
        success: true,
        status: 'success',
        message: 'Dados de consulta processados com sucesso',
        stats: {
          recebidos: consultas.length,
          inseridos: result.upsertedCount,
          atualizados: result.modifiedCount,
          erros: errors.length
        },
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Nenhum dado válido para processar',
        errors: errors
      });
    }

  } catch (error) {
    next(error);
  }
};

module.exports = exports;
