const Consulta = require('../models/Consulta');
const Cirurgia = require('../models/Cirurgia');
const Servico = require('../models/Servico');

/**
 * Controller para estatísticas comparativas
 */

// @desc    Discrepância entre tempos médios de consultas e cirurgias
// @route   GET /api/v1/stats/discrepancia-consulta-cirurgia
// @query   hospitalId (opcional), especialidade (opcional), periodo (dia|semana|mes), ano, mes (opcional), semana (opcional), dia (opcional)
exports.getDiscrepanciaConsultaCirurgia = async (req, res, next) => {
  try {
    const { hospitalId, especialidade, periodo = 'mes', ano, mes, semana, dia } = req.query;

    // 1. Validação: Ano é obrigatório
    if (!ano) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "ano" é obrigatório'
      });
    }

    // 2. Validação: Parâmetros obrigatórios conforme período
    if (periodo === 'dia' && (!mes || !dia)) {
      return res.status(400).json({
        success: false,
        error: 'Para período "dia", é necessário fornecer "mes" e "dia"'
      });
    }
    if (periodo === 'semana' && !semana) {
      return res.status(400).json({
        success: false,
        error: 'Para período "semana", é necessário fornecer "semana"'
      });
    }
    if (periodo === 'mes' && !mes) {
      return res.status(400).json({
        success: false,
        error: 'Para período "mes", é necessário fornecer "mes"'
      });
    }

    // 3. Construir filtros base
    const matchFilter = { Year: parseInt(ano) };
    if (hospitalId) matchFilter.HospitalId = parseInt(hospitalId);
    if (especialidade) matchFilter.Speciality = especialidade;

    // 4. Adicionar filtros temporais conforme período
    switch (periodo.toLowerCase()) {
      case 'dia':
        matchFilter.Month = mes;
        matchFilter.Day = parseInt(dia);
        break;
      case 'semana':
        matchFilter.Week = parseInt(semana);
        break;
      case 'mes':
        matchFilter.Month = mes;
        break;
    }

    // 5. Definir agrupamento dinâmico (CORREÇÃO: Agrupar por hospital + especialidade + período)
    let groupId = {
      hospitalId: "$HospitalId",
      hospitalName: "$HospitalName",
      especialidade: "$Speciality",
      ano: "$Year"
    };

    // Adicionar campos de período ao agrupamento
    switch (periodo.toLowerCase()) {
      case 'dia':
        groupId.mes = "$Month";
        groupId.dia = "$Day";
        break;
      case 'semana':
        groupId.semana = "$Week";
        break;
      case 'mes':
        groupId.mes = "$Month";
        break;
    }

    // 6. Pipeline de agregação
    const pipeline = [
      { $match: matchFilter },
      {
        $project: {
          HospitalId: 1,
          HospitalName: 1,
          Speciality: 1,
          Year: 1,
          Month: 1,
          Week: 1,
          Day: 1,
          type: "consulta",
          // Tempo médio de resposta = média das 3 prioridades
          valorTempo: {
            $avg: [
              "$AverageWaitingTime.Normal",
              "$AverageWaitingTime.Prioritario",
              "$AverageWaitingTime.MuitoPrioritario"
            ]
          }
        }
      },
      {
        $unionWith: {
          coll: "Cirurgia",
          pipeline: [
            { $match: matchFilter },
            {
              $project: {
                HospitalId: 1,
                HospitalName: 1,
                Speciality: 1,
                Year: 1,
                Month: 1,
                Week: 1,
                Day: 1,
                type: "cirurgia",
                valorTempo: "$AverageWaitingTime"
              }
            }
          ]
        }
      },
      {
        $group: {
          _id: groupId,
          mediaConsulta: {
            $avg: { $cond: [{ $eq: ["$type", "consulta"] }, "$valorTempo", null] }
          },
          mediaCirurgia: {
            $avg: { $cond: [{ $eq: ["$type", "cirurgia"] }, "$valorTempo", null] }
          },
          totalRegistosConsulta: {
            $sum: { $cond: [{ $eq: ["$type", "consulta"] }, 1, 0] }
          },
          totalRegistosCirurgia: {
            $sum: { $cond: [{ $eq: ["$type", "cirurgia"] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          hospitalId: "$_id.hospitalId",
          hospital: "$_id.hospitalName",
          especialidade: "$_id.especialidade",
          periodo: {
            ano: "$_id.ano",
            mes: "$_id.mes",
            semana: "$_id.semana",
            dia: "$_id.dia"
          },
          consultas: {
            tempoMedio: { $round: [{ $ifNull: ["$mediaConsulta", 0] }, 2] },
            totalRegistos: "$totalRegistosConsulta"
          },
          cirurgias: {
            tempoMedio: { $round: [{ $ifNull: ["$mediaCirurgia", 0] }, 2] },
            totalRegistos: "$totalRegistosCirurgia"
          },
          discrepancia: {
            absoluta: {
              $round: [
                { $subtract: [{ $ifNull: ["$mediaCirurgia", 0] }, { $ifNull: ["$mediaConsulta", 0] }] },
                2
              ]
            },
            percentual: {
              $round: [
                {
                  $cond: [
                    { $eq: [{ $ifNull: ["$mediaConsulta", 0] }, 0] },
                    0,
                    {
                      $multiply: [
                        {
                          $divide: [
                            { $subtract: [{ $ifNull: ["$mediaCirurgia", 0] }, { $ifNull: ["$mediaConsulta", 0] }] },
                            { $ifNull: ["$mediaConsulta", 1] }
                          ]
                        },
                        100
                      ]
                    }
                  ]
                },
                2
              ]
            },
            unidade: "dias"
          }
        }
      },
      { $sort: { hospitalId: 1, especialidade: 1 } }
    ];

    const resultado = await Consulta.aggregate(pipeline);

    res.status(200).json({
      success: true,
      meta: {
        periodo: periodo,
        filtros: { hospitalId, especialidade, ano, mes, semana, dia },
        count: resultado.length
      },
      data: resultado
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Estatísticas gerais do sistema
// @route   GET /api/v1/stats/geral
exports.getStatisticsGeral = async (req, res, next) => {
  try {
    const [
      totalConsultas,
      totalCirurgias,
      totalUrgencias,
      totalHospitais
    ] = await Promise.all([
      Consulta.countDocuments(),
      Cirurgia.countDocuments(),
      require('../models/Urgencia').countDocuments(),
      require('../models/Hospital').countDocuments()
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalConsultas,
        totalCirurgias,
        totalUrgencias,
        totalHospitais,
        dataAtualizacao: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = exports;
