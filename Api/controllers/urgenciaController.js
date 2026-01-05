const Urgencia = require('../models/Urgencia');
const Hospital = require('../models/Hospital');

/**
 * Controller para análises de urgências
 */

// @desc    Média de utentes em espera para 1ª observação médica por tipologia e período
// @route   GET /api/v1/urgencias/media-espera
// @query   tipo, categoria, periodo (dia|mes|trimestre), dataInicio, dataFim
// @note    Triage.*.Length = número de utentes em espera para 1ª observação médica (triagem)
exports.getMediaEsperaPorTipologia = async (req, res, next) => {
  try {
    const { tipo, categoria, periodo = 'mes', dataInicio, dataFim } = req.query;

    // 1. Construção do Filtro ($match)
    const matchStage = {
      // Importante: Só queremos médias de quando a urgência estava, efetivamente, a funcionar.
      EmergencyStatus: 'Aberta'
    };

    // Filtro por Tipologia (ex: GERAL, PEDIATRIA)
    if (tipo) {
      matchStage['EmergencyType.Code'] = tipo;
    }

    // Filtro Temporal
    const inicio = dataInicio ? new Date(dataInicio) : new Date(new Date().setHours(0, 0, 0, 0)); // Default hoje 00:00
    const fim = dataFim ? new Date(dataFim) : new Date();

    matchStage.LastUpdate = {
      $gte: inicio,
      $lte: fim
    };

    // Filtro Opcional por Categoria (se o utilizador quiser focar a amostra)
    if (categoria) {
      const categoriaMap = {
        'muito-urgente': 'Red',     // Muito urgente (vermelho)
        'urgente': 'Orange',        // Urgente (laranja)  
        'pouco-urgente': 'Yellow',  // Pouco urgente (amarelo)
        'nao-urgente': 'Green'      // Não urgente (verde)
        // NOTA: Removido 'nao-prioritario' (azul) para cumprir requisito de 4 categorias
      };
      // Normalização: remove espaços e lowercase
      const key = categoria.toLowerCase().replace(/\s+/g, '-');
      const mappedColor = categoriaMap[key];

      if (mappedColor) {
        // Filtra documentos onde essa categoria específica tinha alguém (opcional)
        matchStage[`Triage.${mappedColor}.Length`] = { $gt: 0 };
      }
    }

    // 2. Definição do Agrupamento Temporal
    let groupByPeriodo = {};
    let sortPeriodo = {};

    switch (periodo.toLowerCase()) {
      case 'dia':
        groupByPeriodo = {
          ano: { $year: '$LastUpdate' },
          mes: { $month: '$LastUpdate' },
          dia: { $dayOfMonth: '$LastUpdate' }
        };
        sortPeriodo = { '_id.periodo.ano': 1, '_id.periodo.mes': 1, '_id.periodo.dia': 1 };
        break;
      case 'trimestre':
        groupByPeriodo = {
          ano: { $year: '$LastUpdate' },
          trimestre: { $ceil: { $divide: [{ $month: '$LastUpdate' }, 3] } }
        };
        sortPeriodo = { '_id.periodo.ano': 1, '_id.periodo.trimestre': 1 };
        break;
      case 'mes':
      default:
        groupByPeriodo = {
          ano: { $year: '$LastUpdate' },
          mes: { $month: '$LastUpdate' }
        };
        sortPeriodo = { '_id.periodo.ano': 1, '_id.periodo.mes': 1 };
        break;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            periodo: groupByPeriodo,
            tipo: '$EmergencyType.Code',
            descricao: '$EmergencyType.Description'
          },
          // REQUISITO: Discriminar por 4 categorias (não urgente, pouco urgente, urgente, muito urgente)
          mediaMuitoUrgente: { $avg: { $ifNull: ['$Triage.Red.Length', 0] } },
          mediaUrgente: { $avg: { $ifNull: ['$Triage.Orange.Length', 0] } },
          mediaPoucoUrgente: { $avg: { $ifNull: ['$Triage.Yellow.Length', 0] } },
          mediaNaoUrgente: { $avg: { $ifNull: ['$Triage.Green.Length', 0] } },
          // REMOVIDO: mediaNaoPrioridade para cumprir requisito de 4 categorias

          totalAmostras: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          periodo: '$_id.periodo',
          tipologia: '$_id.tipo',
          descricao: '$_id.descricao',
          mediasUtentesEmEspera: {
            muitoUrgente: { $round: ['$mediaMuitoUrgente', 2] },
            urgente: { $round: ['$mediaUrgente', 2] },
            poucoUrgente: { $round: ['$mediaPoucoUrgente', 2] },
            naoUrgente: { $round: ['$mediaNaoUrgente', 2] }
            // REMOVIDO: naoPrioridade para cumprir requisito de 4 categorias
          },
          totalAmostras: 1
        }
      },
      { $sort: sortPeriodo }
    ];

    const resultado = await Urgencia.aggregate(pipeline);

    res.status(200).json({
      success: true,
      count: resultado.length,
      filtros: { tipo, categoria, periodo, inicio, fim },
      data: resultado
    });

  } catch (error) {
    console.error('Erro na agregação:', error);
    res.status(500).json({ success: false, error: 'Erro ao processar médias de espera.' });
  }
};

// @desc    Percentagem por categoria de triagem num hospital por período
// @route   GET /api/v1/urgencias/percentagens-triagem
// @query   hospitalId (obrigatório), periodo (dia|semana|mes), periodoDia (manha|tarde|noite), dataInicio, dataFim
exports.getPercentagensPorCategoria = async (req, res, next) => {
  try {
    const { hospitalId, periodo = 'geral', periodoDia, dataInicio, dataFim } = req.query;

    if (!hospitalId) {
      return res.status(400).json({ success: false, error: 'hospitalId é obrigatório' });
    }

    // 1. Filtro inicial
    const matchStage = {
      HospitalId: parseInt(hospitalId),
      EmergencyStatus: 'Aberta'
    };

    if (dataInicio || dataFim) {
      matchStage.LastUpdate = {};
      if (dataInicio) matchStage.LastUpdate.$gte = new Date(dataInicio);
      if (dataFim) matchStage.LastUpdate.$lte = new Date(dataFim);
    }

    const pipeline = [
      { $match: matchStage },
      // 2. Calcular período do dia
      { $addFields: { hora: { $hour: '$LastUpdate' } } },
      {
        $addFields: {
          calculatedPeriodoDia: {
            $switch: {
              branches: [
                { case: { $and: [{ $gte: ['$hora', 7] }, { $lt: ['$hora', 13] }] }, then: 'manha' },
                { case: { $and: [{ $gte: ['$hora', 14] }, { $lt: ['$hora', 21] }] }, then: 'tarde' },
                { case: { $or: [{ $gte: ['$hora', 21] }, { $lt: ['$hora', 7] }] }, then: 'noite' }
              ],
              default: 'desconhecido'
            }
          }
        }
      }
    ];

    // 3. Filtrar por período do dia (opcional)
    if (periodoDia) {
      pipeline.push({ $match: { calculatedPeriodoDia: periodoDia.toLowerCase() } });
    }

    // 4. Definir agrupamento conforme 'periodo'
    let groupID = {};
    let sortStage = {};

    switch (periodo.toLowerCase()) {
      case 'dia':
        groupID = { ano: { $year: '$LastUpdate' }, mes: { $month: '$LastUpdate' }, dia: { $dayOfMonth: '$LastUpdate' } };
        sortStage = { '_id.ano': 1, '_id.mes': 1, '_id.dia': 1 };
        break;
      case 'semana':
        groupID = { ano: { $isoWeekYear: '$LastUpdate' }, semana: { $isoWeek: '$LastUpdate' } };
        sortStage = { '_id.ano': 1, '_id.semana': 1 };
        break;
      case 'mes':
        groupID = { ano: { $year: '$LastUpdate' }, mes: { $month: '$LastUpdate' } };
        sortStage = { '_id.ano': 1, '_id.mes': 1 };
        break;
      case 'periododia':
        groupID = { periodoDia: '$calculatedPeriodoDia' };
        sortStage = { '_id.periodoDia': 1 };
        break;
      default:
        groupID = null;
    }

    // 5. Agrupar e calcular médias
    pipeline.push({
      $group: {
        _id: groupID,
        avgVermelho: { $avg: '$Triage.Red.Length' },
        avgLaranja: { $avg: '$Triage.Orange.Length' },
        avgAmarelo: { $avg: '$Triage.Yellow.Length' },
        avgVerde: { $avg: '$Triage.Green.Length' },
        avgAzul: { $avg: '$Triage.Blue.Length' },
        numRegistos: { $sum: 1 }
      }
    });

    // 6. Calcular percentagens
    pipeline.push(
      { $addFields: { totalMediaUtentes: { $add: ['$avgVermelho', '$avgLaranja', '$avgAmarelo', '$avgVerde', '$avgAzul'] } } },
      {
        $project: {
          _id: 0,
          periodo: '$_id',
          totalMediaUtentes: { $round: ['$totalMediaUtentes', 0] },
          percentagens: {
            muitoUrgente: { $cond: [{ $eq: ['$totalMediaUtentes', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$avgVermelho', '$totalMediaUtentes'] }, 100] }, 2] }] },
            urgente: { $cond: [{ $eq: ['$totalMediaUtentes', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$avgLaranja', '$totalMediaUtentes'] }, 100] }, 2] }] },
            poucoUrgente: { $cond: [{ $eq: ['$totalMediaUtentes', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$avgAmarelo', '$totalMediaUtentes'] }, 100] }, 2] }] },
            naoUrgente: { $cond: [{ $eq: ['$totalMediaUtentes', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$avgVerde', '$totalMediaUtentes'] }, 100] }, 2] }] },
            naoPrioridade: { $cond: [{ $eq: ['$totalMediaUtentes', 0] }, 0, { $round: [{ $multiply: [{ $divide: ['$avgAzul', '$totalMediaUtentes'] }, 100] }, 2] }] }
          }
        }
      }
    );

    if (Object.keys(sortStage).length > 0) {
      pipeline.push({ $sort: sortStage });
    }

    const resultado = await Urgencia.aggregate(pipeline);

    const hospital = await Hospital.findOne({ HospitalId: parseInt(hospitalId) })
      .select('HospitalName District NUTSII Region');

    res.status(200).json({
      success: true,
      hospital: hospital,
      meta: {
        periodoAgrupamento: periodo,
        filtroPeriodoDia: periodoDia || 'todos',
        intervaloDatas: { inicio: dataInicio, fim: dataFim }
      },
      count: resultado.length,
      data: resultado
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Tempo médio de espera para triagem nas urgências pediátricas por região
// @route   GET /api/v1/urgencias/tempo-medio-pediatricas
// @query   periodo (semana|mes|trimestre), regiao (opcional - se não fornecido, retorna todas)
// Tempo médio de espera para triagem nas urgências pediátricas por região
exports.getTempoMedioPediatricas = async (req, res, next) => {
  try {
    const { periodo = 'mes', regiao } = req.query;

    // intervalo temporal
    const dataFim = new Date();
    const dataInicio = new Date();
    switch (periodo.toLowerCase()) {
      case 'semana': dataInicio.setDate(dataFim.getDate() - 7); break;
      case 'trimestre': dataInicio.setMonth(dataFim.getMonth() - 3); break;
      case 'mes':
      default: dataInicio.setMonth(dataFim.getMonth() - 1); break;
    }

    const pipeline = [
      // filtragem por tipologia pediátrica, datas e estado
      {
        $match: {
          $text: { $search: "pediátrica pediatria pediatrica pediátrico pediatrico" },
          LastUpdate: { $gte: dataInicio, $lte: dataFim },
          EmergencyStatus: 'Aberta'
        }
      },

      // junção com Hospital
      {
        $lookup: {
          from: 'Hospital',
          localField: 'HospitalId',
          foreignField: 'HospitalId',
          as: 'hospitalInfo'
        }
      },
      { $unwind: '$hospitalInfo' },

      // calcular somas ponderadas (tempo * pessoas) e total de pessoas
      {
        $project: {
          regiao: '$hospitalInfo.NUTSII',
          weightedSum: {
            $add: [
              { $multiply: ['$Triage.Red.Time', '$Triage.Red.Length'] },
              { $multiply: ['$Triage.Orange.Time', '$Triage.Orange.Length'] },
              { $multiply: ['$Triage.Yellow.Time', '$Triage.Yellow.Length'] },
              { $multiply: ['$Triage.Green.Time', '$Triage.Green.Length'] },
              { $multiply: ['$Triage.Blue.Time', '$Triage.Blue.Length'] }
            ]
          },
          totalPeople: {
            $add: [
              '$Triage.Red.Length', '$Triage.Orange.Length',
              '$Triage.Yellow.Length', '$Triage.Green.Length', '$Triage.Blue.Length'
            ]
          }
        }
      },

      // Filtrar por região se especificado
      ...(regiao ? [{ $match: { regiao: regiao } }] : []),

      // agrupar por região
      {
        $group: {
          _id: "$regiao",
          somaTemposPonderados: { $sum: "$weightedSum" },
          totalUtentesRegiao: { $sum: "$totalPeople" }
        }
      },

      // média ponderada por região
      {
        $project: {
          _id: 0,
          regiao: "$_id",
          tempoMedioEspera: {
            $cond: [
              { $eq: ["$totalUtentesRegiao", 0] },
              0,
              { $round: [{ $divide: ["$somaTemposPonderados", "$totalUtentesRegiao"] }, 2] }
            ]
          },
          totalUtentes: "$totalUtentesRegiao"
        }
      },

      // ordenar por tempo médio
      { $sort: { tempoMedioEspera: 1 } }
    ];

    const resultado = await Urgencia.aggregate(pipeline);

    res.status(200).json({
      success: true,
      meta: { periodo, regiao: regiao || 'todas', dataInicio, dataFim, count: resultado.length },
      data: resultado
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Top 10 hospitais com menores tempos médios de espera (urgências pediátricas)
// @route   GET /api/v1/urgencias/top-hospitais-pediatricas
// @query   dataInicio, dataFim, limit (default: 10)
exports.getTopHospitaisPediatricas = async (req, res, next) => {
  try {
    const { dataInicio, dataFim, limit = 10 } = req.query;

    // Filtro por tipologia pediátrica (case-insensitive) e por datas se fornecidas
    const matchStage = {
      $text: { $search: "pediátrica pediatria pediatrica pediátrico pediatrico" },
    };
    // Filtro temporal opcional
    if (dataInicio || dataFim) {
      matchStage.LastUpdate = {};
      if (dataInicio) matchStage.LastUpdate.$gte = new Date(dataInicio);
      if (dataFim) matchStage.LastUpdate.$lte = new Date(dataFim);
    }

    const resultado = await Urgencia.aggregate([
      // ETAPA 1: Filtragem
      { $match: matchStage },

      // ETAPA 2: Agrupamento e Cálculo (Otimizado)
      {
        $group: {
          _id: '$HospitalId',
          // Guardar tipologia para referência
          descricaoTipologia: { $first: '$EmergencyType.Description' },

          // Soma Ponderada (Tempo * Quantidade)
          totalMinutosPonderados: {
            $sum: {
              $add: [
                { $multiply: ['$Triage.Red.Time', '$Triage.Red.Length'] },
                { $multiply: ['$Triage.Orange.Time', '$Triage.Orange.Length'] },
                { $multiply: ['$Triage.Yellow.Time', '$Triage.Yellow.Length'] },
                { $multiply: ['$Triage.Green.Time', '$Triage.Green.Length'] },
                { $multiply: ['$Triage.Blue.Time', '$Triage.Blue.Length'] }
              ]
            }
          },

          // Total de Utentes
          totalUtentes: {
            $sum: {
              $add: [
                '$Triage.Red.Length', '$Triage.Orange.Length',
                '$Triage.Yellow.Length', '$Triage.Green.Length', '$Triage.Blue.Length'
              ]
            }
          }
        }
      },

      // ETAPA 3: Calcular Média Final
      {
        $addFields: {
          tempoMedioEspera: {
            $cond: [
              { $eq: ['$totalUtentes', 0] },
              0,
              { $round: [{ $divide: ['$totalMinutosPonderados', '$totalUtentes'] }, 2] }
            ]
          }
        }
      },

      // ETAPA 4: Ordenar (Menor tempo primeiro)
      { $sort: { tempoMedioEspera: 1 } },

      // ETAPA 5: Limitar
      { $limit: parseInt(limit) },

      // ETAPA 6: Enriquecer com dados do Hospital
      {
        $lookup: {
          from: 'Hospital',
          localField: '_id',
          foreignField: 'HospitalId',
          as: 'detalhesHospital'
        }
      },

      { $unwind: '$detalhesHospital' },

      // ETAPA 7: Formatação Final 
      {
        $project: {
          _id: 0,
          hospitalId: '$_id',
          hospital: '$detalhesHospital.HospitalName',
          tipologia: '$descricaoTipologia',
          regiao: '$detalhesHospital.NUTSII',
          distrito: '$detalhesHospital.District',
          tempoMedioEspera: 1,
          totalUtentesProcessados: '$totalUtentes',
          contactos: {
            telefone: '$detalhesHospital.PhoneNum',
            email: '$detalhesHospital.Email',
            morada: '$detalhesHospital.Address'
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: resultado.length,
      filtros: { dataInicio, dataFim },
      data: resultado
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Evolução temporal dos tempos de espera (agregação de 15 em 15 minutos)
// @route   GET /api/v1/urgencias/evolucao-temporal
// @query   data (YYYY-MM-DD), hospitalId, tipo (opcional)
exports.getEvolucaoTemporal = async (req, res, next) => {
  try {
    const { data, hospitalId, tipo = 'Geral' } = req.query;

    // Validação do parâmetro data
    if (!data) {
      return res.status(400).json({ success: false, error: 'Parâmetro "data" é obrigatório (YYYY-MM-DD)' });
    }

    // Janela temporal: início e fim do dia
    const dataInicio = new Date(data);
    dataInicio.setHours(0, 0, 0, 0);
    const dataFim = new Date(data);
    dataFim.setHours(23, 59, 59, 999);

    if (isNaN(dataInicio.getTime())) {
      return res.status(400).json({ success: false, error: 'Data inválida.' });
    }

    // Construção do filtro
    const matchStage = {};
    if (hospitalId) matchStage.HospitalId = parseInt(hospitalId);
    if (tipo) matchStage.$text = { $search: tipo };
    matchStage.LastUpdate = { $gte: dataInicio, $lte: dataFim };

    const resultado = await Urgencia.aggregate([
      { $match: matchStage },

      // Criar bucket de 15 minutos e calcular somas ponderadas
      {
        $project: {
          timeBucket: {
            $dateFromParts: {
              year: { $year: "$LastUpdate" },
              month: { $month: "$LastUpdate" },
              day: { $dayOfMonth: "$LastUpdate" },
              hour: { $hour: "$LastUpdate" },
              minute: {
                $multiply: [
                  { $floor: { $divide: [{ $minute: "$LastUpdate" }, 15] } },
                  15
                ]
              },
              second: 0
            }
          },
          totalMinutosPonderados: {
            $add: [
              { $multiply: ['$Triage.Red.Time', '$Triage.Red.Length'] },
              { $multiply: ['$Triage.Orange.Time', '$Triage.Orange.Length'] },
              { $multiply: ['$Triage.Yellow.Time', '$Triage.Yellow.Length'] },
              { $multiply: ['$Triage.Green.Time', '$Triage.Green.Length'] },
              { $multiply: ['$Triage.Blue.Time', '$Triage.Blue.Length'] }
            ]
          },
          totalUtentesSnapshot: {
            $add: [
              '$Triage.Red.Length', '$Triage.Orange.Length',
              '$Triage.Yellow.Length', '$Triage.Green.Length', '$Triage.Blue.Length'
            ]
          }
        }
      },

      // Agrupar por bucket
      {
        $group: {
          _id: "$timeBucket",
          somaTemposPonderados: { $sum: "$totalMinutosPonderados" },
          totalUtentesNoPeriodo: { $sum: "$totalUtentesSnapshot" },
          numRegistos: { $sum: 1 }
        }
      },

      // Calcular KPIs por bucket
      {
        $project: {
          _id: 0,
          timestamp: "$_id",
          hora: { $dateToString: { format: "%H:%M", date: "$_id" } },
          tempoMedioEspera: {
            $cond: [
              { $eq: ["$totalUtentesNoPeriodo", 0] },
              0,
              { $round: [{ $divide: ["$somaTemposPonderados", "$totalUtentesNoPeriodo"] }, 2] }
            ]
          },
          totalUtentes: "$totalUtentesNoPeriodo"
        }
      },

      // Saídas: evolução cronológica e top3 picos
      {
        $facet: {
          "evolucaoTemporal": [
            { $sort: { timestamp: 1 } }
          ],
          "top3Picos": [
            { $sort: { totalUtentes: -1 } },
            { $limit: 3 },
            { $project: { hora: 1, totalUtentes: 1, tempoMedio: "$tempoMedioEspera" } }
          ]
        }
      }
    ]);

    const dados = resultado[0];

    res.status(200).json({
      success: true,
      meta: { data, tipo, hospitalId: hospitalId || 'Todos' },
      data: { timeline: dados.evolucaoTemporal, picos: dados.top3Picos }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Listar todas as urgências com filtros
// @route   GET /api/v1/urgencias
// @query   hospitalId, tipo, dataInicio, dataFim, page, limit
exports.getUrgencias = async (req, res, next) => {
  try {
    const { hospitalId, tipo, dataInicio, dataFim, page = 1, limit = 50 } = req.query;

    const filters = {};
    if (hospitalId) filters.HospitalId = parseInt(hospitalId);
    if (tipo) filters['EmergencyType.Code'] = tipo;

    if (dataInicio || dataFim) {
      filters.LastUpdate = {};
      if (dataInicio) filters.LastUpdate.$gte = new Date(dataInicio);
      if (dataFim) filters.LastUpdate.$lte = new Date(dataFim);
    }

    const urgencias = await Urgencia.find(filters)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ LastUpdate: -1 });

    const total = await Urgencia.countDocuments(filters);

    res.status(200).json({
      success: true,
      count: urgencias.length,
      total: total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: urgencias
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obter uma urgência específica por ID
// @route   GET /api/v1/urgencias/:id
exports.getUrgencia = async (req, res, next) => {
  try {
    const urgencia = await Urgencia.findById(req.params.id);

    if (!urgencia) {
      return res.status(404).json({
        success: false,
        error: 'Urgência não encontrada'
      });
    }

    // Buscar informações do hospital
    const hospital = await Hospital.findOne({ HospitalId: urgencia.HospitalId })
      .select('HospitalName District NUTSII PhoneNum Email Address');

    res.status(200).json({
      success: true,
      data: {
        ...urgencia.toObject(),
        hospitalInfo: hospital
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submeter dados de urgência via XML
// @route   POST /api/v1/urgencias/submit-xml
// @access  Public (deveria ter autenticação em produção)
exports.submitUrgenciaXML = async (req, res, next) => {
  try {
    const xmlData = req.body;

    // 1. Validação Básica da Estrutura
    if (!xmlData.RelatorioUrgencia) {
      return res.status(400).json({
        success: false,
        error: 'Estrutura XML inválida. Esperado RelatorioUrgencia'
      });
    }

    const cabecalho = xmlData.RelatorioUrgencia.Cabecalho;
    const listaUrgencias = xmlData.RelatorioUrgencia.ListaUrgencias;

    if (!cabecalho || !listaUrgencias) {
      return res.status(400).json({
        success: false,
        error: 'Estrutura XML inválida. Esperado Cabecalho e ListaUrgencias'
      });
    }

    // 2. Validar dados do cabeçalho
    if (!cabecalho.HospitalId) {
      return res.status(400).json({
        success: false,
        error: 'HospitalId é obrigatório no Cabecalho'
      });
    }

    const hospitalId = parseInt(cabecalho.HospitalId);
    const hospitalName = cabecalho.HospitalName;
    const hospitalAddress = cabecalho.HospitalAddress;
    const submissionTimestamp = new Date(cabecalho.SubmissionTimestamp || Date.now());

    // 3. Validar se o hospital existe na base de dados
    const hospital = await Hospital.findOne({ HospitalId: hospitalId });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        error: `Hospital com ID ${hospitalId} não encontrado na base de dados`
      });
    }

    // 4. Normalizar lista de urgências para array
    let urgencias = listaUrgencias.Urgencia;
    if (!Array.isArray(urgencias)) {
      urgencias = [urgencias];
    }

    // 5. Função auxiliar para extrair dados de triagem/observação
    const extractColorData = (colorData) => {
      if (!colorData) return { Time: 0, Length: 0 };
      return {
        Time: parseInt(colorData.Time || 0),
        Length: parseInt(colorData.Length || 0)
      };
    };

    // 6. Preparar operações em lote (BulkWrite)
    const bulkOperations = [];
    const errors = [];

    for (let i = 0; i < urgencias.length; i++) {
      const urgencia = urgencias[i];

      try {
        // Validar EmergencyType
        if (!urgencia.EmergencyType || !urgencia.EmergencyType.Code) {
          errors.push(`Urgência ${i + 1}: EmergencyType.Code é obrigatório`);
          continue;
        }

        // Validar EmergencyStatus
        if (!urgencia.EmergencyStatus) {
          errors.push(`Urgência ${i + 1}: EmergencyStatus é obrigatório`);
          continue;
        }

        // Validar LastUpdate
        if (!urgencia.LastUpdate) {
          errors.push(`Urgência ${i + 1}: LastUpdate é obrigatório`);
          continue;
        }

        // Construir documento
        const doc = {
          SubmissionTimestamp: submissionTimestamp,
          LastUpdate: new Date(urgencia.LastUpdate),
          ExtractionDate: submissionTimestamp,
          HospitalId: hospitalId,
          HospitalName: hospitalName,
          HospitalAddress: hospitalAddress,
          EmergencyStatus: urgencia.EmergencyStatus,
          EmergencyType: {
            Code: urgencia.EmergencyType.Code,
            Description: urgencia.EmergencyType.Description || ''
          },
          Triage: {
            Red: extractColorData(urgencia.Triage?.Red),
            Orange: extractColorData(urgencia.Triage?.Orange),
            Yellow: extractColorData(urgencia.Triage?.Yellow),
            Green: extractColorData(urgencia.Triage?.Green),
            Blue: extractColorData(urgencia.Triage?.Blue)
          },
          Observation: {
            Red: extractColorData(urgencia.Observation?.Red),
            Orange: extractColorData(urgencia.Observation?.Orange),
            Yellow: extractColorData(urgencia.Observation?.Yellow),
            Green: extractColorData(urgencia.Observation?.Green),
            Blue: extractColorData(urgencia.Observation?.Blue)
          }
        };

        // Critério de unicidade: Hospital + EmergencyType + LastUpdate
        const filter = {
          HospitalId: doc.HospitalId,
          'EmergencyType.Code': doc.EmergencyType.Code,
          LastUpdate: doc.LastUpdate
        };

        bulkOperations.push({
          updateOne: {
            filter: filter,
            update: { $set: doc },
            upsert: true
          }
        });

      } catch (err) {
        errors.push(`Urgência ${i + 1}: ${err.message}`);
      }
    }

    // 7. Se houver erros críticos, retornar
    if (errors.length > 0 && bulkOperations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma urgência válida para processar',
        details: errors
      });
    }

    // 8. Executar operações em lote
    if (bulkOperations.length > 0) {
      const result = await Urgencia.bulkWrite(bulkOperations);

      return res.status(201).json({
        success: true,
        message: 'Dados de urgência processados com sucesso',
        stats: {
          recebidos: urgencias.length,
          inseridos: result.upsertedCount,
          atualizados: result.modifiedCount,
          erros: errors.length
        },
        errors: errors.length > 0 ? errors : undefined
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Nenhum dado válido para processar',
        errors: errors
      });
    }

  } catch (error) {
    console.error('Erro no submitUrgenciaXML:', error);

    // Erro de validação do Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: messages
      });
    }

    next(error);
  }
};

module.exports = exports;
