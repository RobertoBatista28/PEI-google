const mongoose = require('mongoose');

const servicoSchema = new mongoose.Schema({
    ServiceKey: { type: Number, required: true, index: true },                      // [PK] Chave única do serviço
    ServiceName: { type: String, required: true },                                  // Nome do serviço
    Speciality: { type: String, required: true, index: true },                      // Especialidade médica
    PriorityCode: { type: Number, required: true },                                 // Código da prioridade
    PriorityDescription: { type: String, required: true },                          // Descrição da prioridade
    TypeCode: { type: Number, required: true },                                     // Código do tipo de serviço
    TypeDescription: { type: String, required: true, index: true }                  // Descrição do tipo de serviço
}, {
    timestamps: false,
    strict: false
});

// Índice composto para queries
servicoSchema.index({ Speciality: 1, TypeDescription: 1 });

module.exports = mongoose.model('Servico', servicoSchema, 'Servico');
