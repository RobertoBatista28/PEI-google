const Consulta = require('../models/Consulta');
const Servico = require('../models/Servico');
const Hospital = require('../models/Hospital');

// --- Utilitários ---

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getQuarter(monthStr) {
    const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", 
                   "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const monthIndex = months.indexOf(monthStr.toLowerCase());
    return Math.floor(monthIndex / 3) + 1;
}

/**
 * Controller para análises de consultas
 */

// @desc    Diferença entre tempos médios oncologia vs. não-oncologia
// @route   GET /api/v1/consultas/diferenca-oncologia
// @query   especialidade, hospitalId (opcional), dataInicio, dataFim
exports.getDiferencaOncologia = async (req, res, next) => {
  try {
    const { especialidade, hospitalId, dataInicio, dataFim } = req.query;

    // 1. Validação Obrigatória
    if (!especialidade) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "especialidade" é obrigatório.'
      });
    }

    // 2. Filtros Iniciais (Match) - Aproveitar Índices
    const matchStage = {
      Speciality: { $regex: especialidade, $options: 'i' }
    };

    if (hospitalId) {
      matchStage.HospitalId = parseInt(hospitalId);
    }

    // Otimização: Filtrar pelo ano primeiro (se possível) para reduzir documentos antes do processamento pesado de datas
    if (dataInicio && dataFim) {
      const startYear = new Date(dataInicio).getFullYear();
      const endYear = new Date(dataFim).getFullYear();
      matchStage.Year = { $gte: startYear, $lte: endYear };
    }

    // 3. Pipeline de Agregação
    const pipeline = [
      { $match: matchStage },

      // Convertemos para número para criar uma data comparável
      {
        $addFields: {
          monthNum: {
            $switch: {
              branches: [
                { case: { $eq: ["$Month", "Janeiro"] }, then: 1 },
                { case: { $eq: ["$Month", "Fevereiro"] }, then: 2 },
                { case: { $eq: ["$Month", "Março"] }, then: 3 },
                { case: { $eq: ["$Month", "Abril"] }, then: 4 },
                { case: { $eq: ["$Month", "Maio"] }, then: 5 },
                { case: { $eq: ["$Month", "Junho"] }, then: 6 },
                { case: { $eq: ["$Month", "Julho"] }, then: 7 },
                { case: { $eq: ["$Month", "Agosto"] }, then: 8 },
                { case: { $eq: ["$Month", "Setembro"] }, then: 9 },
                { case: { $eq: ["$Month", "Outubro"] }, then: 10 },
                { case: { $eq: ["$Month", "Novembro"] }, then: 11 },
                { case: { $eq: ["$Month", "Dezembro"] }, then: 12 }
              ],
              default: 0
            }
          }
        }
      },
      // Criar objeto Data real para filtragem precisa
      {
        $addFields: {
          computedDate: {
            $dateFromParts: {
              year: "$Year",
              month: "$monthNum",
              day: "$Day"
            }
          }
        }
      },
      // Filtrar pelo range exato de datas (Dia/Mês/Ano)
      ...(dataInicio || dataFim ? [{
        $match: {
          computedDate: {
            ...(dataInicio && { $gte: new Date(dataInicio) }),
            ...(dataFim && { $lte: new Date(dataFim) })
          }
        }
      }] : []),

      // --- AGRUPAMENTO 1: Por Hospital e Tipo ---
      {
        $group: {
          _id: {
            hospitalId: '$HospitalId', // Agrupar só pelo ID
            waitingListType: '$WaitingListType'
          },
          hospitalName: { $first: '$HospitalName' }, // Obter o nome (primeira ocorrência)
          mediaTempo: {
            $avg: {
              // Média dos 3 campos de tempo por registo
              $avg: [
                { $ifNull: ['$AverageWaitingTime.Normal', 0] },
                { $ifNull: ['$AverageWaitingTime.Prioritario', 0] },
                { $ifNull: ['$AverageWaitingTime.MuitoPrioritario', 0] }
              ]
            }
          },
          totalRegistos: { $sum: '$NumberOfPeople' },
          countDocs: { $sum: 1 }
        }
      },

      // --- AGRUPAMENTO 2: Consolidar no Hospital ---
      {
        $group: {
          _id: '$_id.hospitalId',
          hospitalName: { $first: '$hospitalName' },
          dados: {
            $push: {
              tipo: '$_id.waitingListType',
              media: '$mediaTempo',
              registos: '$totalRegistos'
            }
          }
        }
      },

      // --- PROJEÇÃO FINAL E CÁLCULOS ---
      {
        $project: {
          _id: 0,
          hospitalId: '$_id',
          hospitalName: 1,
          estatisticas: {
            // Extrair dados Oncológicos
            oncologia: {
              $let: {
                vars: {
                  item: {
                    $arrayElemAt: [
                      { $filter: { input: '$dados', as: 'd', cond: { $eq: ['$$d.tipo', 'Oncológica'] } } },
                      0
                    ]
                  }
                },
                in: {
                  tempoMedio: { $ifNull: ['$$item.media', 0] },
                  totalRegistos: { $ifNull: ['$$item.registos', 0] }
                }
              }
            },
            // Extrair dados Não Oncológica
            naoOncologia: {
              $let: {
                vars: {
                  item: {
                    $arrayElemAt: [
                      { $filter: { input: '$dados', as: 'd', cond: { $eq: ['$$d.tipo', 'Não Oncológica'] } } },
                      0
                    ]
                  }
                },
                in: {
                  tempoMedio: { $ifNull: ['$$item.media', 0] },
                  totalRegistos: { $ifNull: ['$$item.registos', 0] }
                }
              }
            }
          }
        }
      },
      // Calcular Diferença
      {
        $addFields: {
          diferencaTempo: {
            // Usar $abs para evitar valores negativos
            $abs: {
              $subtract: [
                { $ifNull: ['$estatisticas.oncologia.tempoMedio', 0] },
                { $ifNull: ['$estatisticas.naoOncologia.tempoMedio', 0] }
              ]
            }
          }
        }
      },
      // Remover hospitais que não têm dados nenhuns (opcional, mas recomendado)
      {
        $match: {
          $or: [
            { 'estatisticas.oncologia.totalRegistos': { $gt: 0 } },
            { 'estatisticas.naoOncologia.totalRegistos': { $gt: 0 } }
          ]
        }
      },
      { $sort: { diferencaTempo: -1 } }
    ];

    const resultado = await Consulta.aggregate(pipeline);

    res.status(200).json({
      success: true,
      meta: {
        count: resultado.length,
        filtros: { especialidade, hospitalId, dataInicio, dataFim }
      },
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
          Week: getWeekNumber(new Date(parseInt(cabecalho.Periodo.Ano), getMonthNumber(cabecalho.Periodo.Mes) - 1, parseInt(consultaData.Day))),
          Quarter: getQuarter(cabecalho.Periodo.Mes),
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
