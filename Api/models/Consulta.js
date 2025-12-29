const mongoose = require('mongoose');

const consultaSchema = new mongoose.Schema({
    HospitalId: { type: Number, required: true, index: true },                      // [FK] Identificador do hospital
    HospitalName: { type: String, required: true, index: true },                    // Nome completo do hospital
    ServiceSK: { type: Number, required: true, index: true },                       // [PK/FK] Identificador do serviço
    TargetPopulation: { type: String, enum: ['Adulto', 'Criança'], index: true },  // População alvo: adulto ou criança
    WaitingListType: { 
        type: String, 
        enum: ['Geral', 'Não Oncológica', 'Oncológica'], 
        required: true,
        index: true 
    },                                                                               // Tipo de lista de espera
    AverageWaitingTime: {                                                            // Tempos médios de resposta por prioridade clínica
        Normal: { type: Number, default: 0 },                                       // Tempo médio para prioridade Normal (em dias)
        Prioritario: { type: Number, default: 0 },                                  // Tempo médio para prioridade Prioritário (em dias)
        MuitoPrioritario: { type: Number, default: 0 }                              // Tempo médio para prioridade Muito Prioritário (em dias)
    },
    Day: { type: Number, required: true },                                          // Dia do mês
    Week: { type: Number, required: true },                                         // Semana do ano
    Quarter: { type: Number, required: true },                                      // Trimestre do ano
    Month: { type: String, required: true },                                        // Mês em extenso em português
    Year: { type: Number, required: true, index: true },                            // Ano de referência dos dados
    NumberOfPeople: { type: Number, required: true, default: 0 },                   // Número de pacientes contabilizados
    PriorityDescription: String,                                                    // Descrição da prioridade
    Speciality: String                                                              // Especialidade médica
}, {
    timestamps: false,
    strict: false
});

// Índices compostos para queries analíticas
consultaSchema.index({ HospitalId: 1, Year: 1 });
consultaSchema.index({ HospitalId: 1, Speciality: 1, Year: 1 });
consultaSchema.index({ ServiceSK: 1, Year: 1 });
consultaSchema.index({ WaitingListType: 1, Year: 1 });
consultaSchema.index({ TargetPopulation: 1, Year: 1 });

module.exports = mongoose.model('Consulta', consultaSchema, 'Consulta');
