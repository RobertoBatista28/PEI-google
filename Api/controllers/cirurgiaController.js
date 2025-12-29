const Cirurgia = require('../models/Cirurgia');
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
 * Controller para análises de cirurgias
 */

// @desc    Tempo médio de espera para cirurgia programada por especialidade, comparando
//          entre lista geral e lista oncológica, no mês
// @route   GET /api/v1/cirurgias/tempo-medio-especialidade
// @query   mes (obrigatório), ano (opcional - se não fornecido, calcula para TODOS os anos)
// @note    Retorna APENAS especialidades que tenham AMBAS as listas (Geral E Oncológica) para comparação válida
exports.getTempoMedioPorEspecialidade = async (req, res, next) => {
    try {
        const { mes, ano } = req.query;

        // Validação: mês é obrigatório
        if (!mes) {
            return res.status(400).json({ 
                success: false, 
                error: 'Parâmetro "mes" é obrigatório' 
            });
        }

        // Construir filtro: se ano foi fornecido, filtra por ano; senão, retorna todos os anos
        const matchFilter = {
            Month: { $regex: mes, $options: 'i' }
        };
        
        if (ano) {
            matchFilter.Year = parseInt(ano);
        }

        const pipeline = [
            // 1. Filtrar por mês (e ano se fornecido)
            {
                $match: matchFilter
            },

            // 2. Agrupar por especialidade (usa o campo Speciality embebido no documento) e tipo de lista
            {
                $group: {
                    _id: {
                        especialidade: "$Speciality",
                        tipoLista: "$WaitingListType"
                    },
                    mediaTempo: { $avg: "$AverageWaitingTime" },
                    totalCirurgias: { $sum: 1 },
                    totalUtentes: { $sum: "$NumberOfPeople" }
                }
            },

            // 3. Agrupar por especialidade e separar os tipos de lista
            {
                $group: {
                    _id: "$_id.especialidade",
                    dados: {
                        $push: {
                            tipoLista: "$_id.tipoLista",
                            mediaTempo: "$mediaTempo",
                            totalCirurgias: "$totalCirurgias",
                            totalUtentes: "$totalUtentes"
                        }
                    }
                }
            },

            // 4. Project para estruturar os dados e extrair Geral e Oncológica
            {
                $project: {
                    _id: 0,
                    especialidade: "$_id",
                    listaGeral: {
                        $let: {
                            vars: {
                                geral: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: "$dados",
                                                as: "d",
                                                cond: { $eq: ["$$d.tipoLista", "Geral"] }
                                            }
                                        },
                                        0
                                    ]
                                }
                            },
                            in: {
                                media: { $round: [{ $ifNull: ["$$geral.mediaTempo", 0] }, 2] },
                                totalCirurgias: { $ifNull: ["$$geral.totalCirurgias", 0] },
                                totalUtentes: { $ifNull: ["$$geral.totalUtentes", 0] }
                            }
                        }
                    },
                    listaOncologica: {
                        $let: {
                            vars: {
                                oncologica: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: "$dados",
                                                as: "d",
                                                cond: { $eq: ["$$d.tipoLista", "Oncológica"] }
                                            }
                                        },
                                        0
                                    ]
                                }
                            },
                            in: {
                                media: { $round: [{ $ifNull: ["$$oncologica.mediaTempo", 0] }, 2] },
                                totalCirurgias: { $ifNull: ["$$oncologica.totalCirurgias", 0] },
                                totalUtentes: { $ifNull: ["$$oncologica.totalUtentes", 0] }
                            }
                        }
                    },
                    // Campos auxiliares para filtrar depois
                    temGeral: {
                        $gt: [
                            {
                                $size: {
                                    $filter: {
                                        input: "$dados",
                                        as: "d",
                                        cond: { $eq: ["$$d.tipoLista", "Geral"] }
                                    }
                                }
                            },
                            0
                        ]
                    },
                    temOncologica: {
                        $gt: [
                            {
                                $size: {
                                    $filter: {
                                        input: "$dados",
                                        as: "d",
                                        cond: { $eq: ["$$d.tipoLista", "Oncológica"] }
                                    }
                                }
                            },
                            0
                        ]
                    }
                }
            },

            // 5. FILTRAR: Só mantém especialidades que tenham AMBAS as listas
            {
                $match: {
                    temGeral: true,
                    temOncologica: true
                }
            },

            // 6. Calcular diferença (agora que sabemos que ambas existem)
            {
                $addFields: {
                    diferenca: {
                        $round: [
                            {
                                $subtract: [
                                    "$listaGeral.media",
                                    "$listaOncologica.media"
                                ]
                            },
                            2
                        ]
                    }
                }
            },

            // 7. Remover campos auxiliares
            {
                $project: {
                    temGeral: 0,
                    temOncologica: 0
                }
            },

            // 8. Ordenar por diferença (maior diferença primeiro = maior gap entre Geral e Oncológica)
            { $sort: { diferenca: -1 } }
        ];

        const results = await Cirurgia.aggregate(pipeline);

        // Adicionar metadados à resposta
        res.status(200).json({
            success: true,
            mes: mes,
            ano: ano ? parseInt(ano) : "todos",
            count: results.length,
            nota: "Mostra apenas especialidades com AMBAS as listas (Geral E Oncológica) para comparação válida",
            data: results
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Listar todas as cirurgias com filtros
// @route   GET /api/v1/cirurgias
// @query   hospitalName, ano, mes, especialidade, page, limit, sort
exports.getCirurgias = async (req, res, next) => {
    try {
        const { hospitalName, ano, mes, especialidade, page = 1, limit = 50, sort = '-Year' } = req.query;

        const filters = {};
        if (hospitalName) filters.HospitalName = { $regex: hospitalName, $options: 'i' };
        if (ano) filters.Year = parseInt(ano);
        if (mes) filters.Month = { $regex: mes, $options: 'i' };

        // Se houver filtro de especialidade, precisamos primeiro encontrar os IDs dos serviços
        if (especialidade) {
            const servicos = await Servico.find({ 
                Speciality: { $regex: especialidade, $options: 'i' } 
            }).select('ServiceKey');
            
            // Se não encontrar serviços com esse nome, retorna vazio imediatamente
            if (servicos.length === 0) {
                return res.status(200).json({ success: true, count: 0, data: [] });
            }

            const servicoKeys = servicos.map(s => s.ServiceKey);
            filters.ServiceSK = { $in: servicoKeys };
        }

        const cirurgias = await Cirurgia.find(filters)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .sort(sort);

        const total = await Cirurgia.countDocuments(filters);

        res.status(200).json({
            success: true,
            count: cirurgias.length,
            total: total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: cirurgias
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Submeter dados de cirurgia via XML
// @route   POST /api/v1/cirurgias/submit-xml
exports.submitCirurgiaXML = async (req, res, next) => {
    try {
        const xmlData = req.body;
        
        // 1. Validação Básica da Estrutura
        if (!xmlData.RelatorioCirurgias || !xmlData.RelatorioCirurgias.ListaCirurgias) {
            return res.status(400).json({ 
                success: false, 
                error: 'Estrutura XML inválida. Esperado RelatorioCirurgias > ListaCirurgias' 
            });
        }

        const cabecalho = xmlData.RelatorioCirurgias.Cabecalho;
        let lista = xmlData.RelatorioCirurgias.ListaCirurgias.Cirurgia;
        
        // Normalizar lista para array (caso venha apenas 1 item)
        if (!Array.isArray(lista)) lista = [lista];

        // 2. Validação do Hospital (MOVIDO PARA FORA DO LOOP - PERFORMANCE)
        // Validamos o hospital apenas uma vez, pois o cabeçalho é único para o ficheiro
        
        // Validar campos obrigatórios no cabeçalho
        if (!cabecalho.HospitalID || !cabecalho.HospitalName) {
            return res.status(400).json({ 
                success: false, 
                error: 'Campos obrigatórios ausentes no cabeçalho: HospitalID e HospitalName são obrigatórios' 
            });
        }

        // Buscar hospital pelo HospitalId
        const hospital = await Hospital.findOne({ HospitalId: parseInt(cabecalho.HospitalID) });

        if (!hospital) {
            return res.status(404).json({ 
                success: false, 
                error: `Hospital com HospitalId ${cabecalho.HospitalID} não encontrado na base de dados.` 
            });
        }

        // Validar se o HospitalName corresponde ao HospitalId
        if (hospital.HospitalName !== cabecalho.HospitalName) {
            return res.status(400).json({
                success: false,
                error: `HospitalName "${cabecalho.HospitalName}" não corresponde ao HospitalId ${cabecalho.HospitalID}`
            });
        }

        // 3. Preparação dos dados para BulkWrite
        const bulkOperations = [];
        const monthMap = {
            'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5,
            'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
        };

        for (const item of lista) {
            const ano = parseInt(cabecalho.Periodo.Ano);
            const mesStr = cabecalho.Periodo.Mes.toLowerCase();
            const mesIndex = monthMap[mesStr];
            
            // Validação de mês
            if (mesIndex === undefined) {
                console.warn(`Mês inválido encontrado: ${cabecalho.Periodo.Mes}`);
                continue; // Pula este item se o mês for inválido
            }

            const dia = parseInt(item.Day);
            const dataRegisto = new Date(ano, mesIndex, dia);

            // Construção do Documento
            const doc = {
                HospitalId: hospital.HospitalId, // Usa o ID do hospital validado
                HospitalName: hospital.HospitalName, // Usa o nome normalizado da BD
                ServiceSK: parseInt(item.ServiceSK),
                WaitingListType: item.WaitingListType,
                AverageWaitingTime: parseFloat(item.AverageWaitingTime),
                Day: dia,
                Week: getWeekNumber(dataRegisto),
                Quarter: getQuarter(mesStr),
                Month: cabecalho.Periodo.Mes, // Mantém o original (ex: "Dezembro")
                Year: ano,
                NumberOfPeople: parseInt(item.NumberOfPeople || 0),
                PriorityDescription: item.PriorityDescription,
                Speciality: item.Speciality
            };

            // Critério de Unicidade: Se recebermos dados para o mesmo Hospital, Serviço, Tipo, Ano, Mês e Dia, ATUALIZAMOS.
            const filter = {
                HospitalId: doc.HospitalId,
                ServiceSK: doc.ServiceSK,
                WaitingListType: doc.WaitingListType,
                Year: doc.Year,
                Month: doc.Month,
                Day: doc.Day
            };

            bulkOperations.push({
                updateOne: {
                    filter: filter,
                    update: { $set: doc },
                    upsert: true
                }
            });
        }

        // 4. Execução em Lote (BulkWrite)
        if (bulkOperations.length > 0) {
            const result = await Cirurgia.bulkWrite(bulkOperations);

            return res.status(201).json({
                success: true,
                message: "Dados de cirurgia processados com sucesso.",
                stats: {
                    recebidos: lista.length,
                    inseridos: result.upsertedCount,
                    atualizados: result.modifiedCount
                }
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: "Nenhum dado válido para processar." 
            });
        }

    } catch (error) {
        console.error("Erro no submitCirurgiaXML:", error);
        next(error);
    }
};

module.exports = exports;
