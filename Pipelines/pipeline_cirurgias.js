[
    {
        $set: {
            ServiceSK: { $toInt: "$ServiceSK" },
            HospitalName: { $trim: { input: "$HospitalName" } },
            // Gerar tipo de lista de espera aleatório (60% Geral, 25% Não Oncológica, 15% Oncológica)
            WaitingListType: { 
                $ifNull: [
                    "$WaitingListType", 
                    {
                        $switch: {
                            branches: [
                                { case: { $lt: [{ $rand: {} }, 0.6] }, then: "Geral" },
                                { case: { $lt: [{ $rand: {} }, 0.85] }, then: "Não Oncológica" }
                            ],
                            default: "Oncológica"
                        }
                    }
                ] 
            },
            AverageWaitingTime: "$AverageWaitingTime_Speciality_Priority_Institution",
            Month: "$MonthPortuguese"
        }
    },
    {
        $lookup: {
            from: "Servico",
            localField: "ServiceSK",
            foreignField: "ServiceKey",
            as: "ServicoData"
        }
    },
    { $unwind: "$ServicoData" },
    // Lookup para obter HospitalId a partir do HospitalName
    {
        $lookup: {
            from: "Hospital",
            let: { hospitalName: "$HospitalName" },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $eq: [
                                { $trim: { input: "$HospitalName" } },
                                "$$hospitalName"
                            ]
                        }
                    }
                }
            ],
            as: "HospitalData"
        }
    },
    {
        $set: {
            PriorityDescription: "$ServicoData.PriorityDescription",
            TypeCode: "$ServicoData.TypeCode",
            Speciality: "$ServicoData.Speciality",
            // Extrair HospitalId do lookup (se encontrado, senão usar hash do nome)
            HospitalId: {
                $ifNull: [
                    { $arrayElemAt: ["$HospitalData.HospitalId", 0] },
                    // Fallback: Gerar ID único baseado no hash do nome do hospital
                    { $toInt: { $abs: { $toLong: { $toDate: { $concat: ["2024-01-01T", { $substrCP: ["$HospitalName", 0, 8] }] } } } } }
                ]
            },
            HospitalName: "$HospitalName"
        }
    },
    { $match: { TypeCode: 2 } },
    // --- Geração de data fictícia ---
    {
        $set: {
            FullDate: {
                $dateFromParts: {
                    year: "$Year", month: {
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
                            default: 1
                        }
                    }, day: 1
                }
            }
        }
    },
    {
        $set: {
            FullDate: {
                $dateAdd: {
                    startDate: "$FullDate",
                    unit: "day",
                    amount: { $floor: { $multiply: [{ $rand: {} }, 28] } }
                }
            }
        }
    },
    {
        $set: {
            Day: { $dayOfMonth: "$FullDate" },
            Week: { $isoWeek: "$FullDate" },
            Quarter: { $ceil: { $divide: [{ $month: "$FullDate" }, 3] } }
        }
    },
    {
        $project: {
            HospitalId: 1,
            HospitalName: 1,
            ServiceSK: 1,
            WaitingListType: 1,
            AverageWaitingTime: 1,
            NumberOfPeople: 1,
            PriorityDescription: 1,
            Speciality: 1,
            Day: 1,
            Week: 1,
            Month: 1,
            Quarter: 1,
            Year: 1
        }
    },
    {
        $merge: {
            into: "Cirurgia",
            whenMatched: "replace",
            whenNotMatched: "insert"
        }
    }
]
