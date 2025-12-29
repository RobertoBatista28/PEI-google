const mongoose = require('mongoose');

const cirurgiaSchema = new mongoose.Schema({
    HospitalId: { type: Number, required: true, index: true },                      // [FK] Identificador do hospital
    HospitalName: { type: String, required: true, index: true },                    // Nome completo do hospital
    ServiceSK: { type: Number, required: true, index: true },                       // [PK/FK] Identificador do serviço
    WaitingListType: { 
        type: String, 
        enum: ['Geral', 'Não Oncológica', 'Oncológica'], 
        required: true,
        index: true 
    },                                                                               // Tipo de lista de espera
    AverageWaitingTime: { type: Number, required: true, default: 0 },               // Tempo médio de espera para cirurgia programada (em dias)
    Day: { type: Number, required: true },                                          // Dia do mês
    Week: { type: Number, required: true },                                         // Semana do ano
    Quarter: { type: Number, required: true },                                      // Trimestre do ano
    Month: { type: String, required: true },                                        // Mês em extenso em português
    Year: { type: Number, required: true, index: true },                            // Ano de referência dos dados
    NumberOfPeople: { type: Number, required: true, default: 0 },                   // Número de pacientes contabilizados
    PriorityDescription: String,                                                    // Descrição da prioridade
    Speciality: { type: String, required: true, index: true },                      // Especialidade cirúrgica
}, {
    timestamps: false,
    strict: false
});

// Índices compostos para queries analíticas
cirurgiaSchema.index({ HospitalId: 1, Year: 1, Month: 1 });
cirurgiaSchema.index({ HospitalId: 1, Speciality: 1, Year: 1 });
cirurgiaSchema.index({ ServiceSK: 1, Year: 1 });
cirurgiaSchema.index({ WaitingListType: 1, Year: 1 });
cirurgiaSchema.index({ Year: 1, Month: 1 });

module.exports = mongoose.model('Cirurgia', cirurgiaSchema, 'Cirurgia');
