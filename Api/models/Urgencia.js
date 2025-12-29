const mongoose = require('mongoose');

const urgenciaSchema = new mongoose.Schema({
    SubmissionTimestamp: { type: Date, required: true, index: true },            // Horário do registo (timestamp da submissão)
    LastUpdate: { type: Date, required: true, index: true },                        // Data da última atualização dos dados
    ExtractionDate: { type: Date, required: true },                                 // Data de extração dos dados
    HospitalId: { type: Number, required: true, index: true },                      // [FK] Identificador do hospital
    HospitalName: { type: String, required: true },                                 // Nome do hospital
    HospitalAddress: { type: String, required: true },                              // Morada do hospital
    EmergencyStatus: { type: String, enum: ['Aberta', 'Fechada'], required: true, index: true }, // Estado da urgência
    EmergencyType: {
        Code: { type: String, required: true, index: true },                        // Código do tipo de emergência
        Description: { type: String, required: true }                               // Descrição do tipo de emergência
    },
    Triage: {                                                                       // Dados de triagem por cor
        Red: {
            Time: { type: Number, default: 0 },
            Length: { type: Number, default: 0 }
        },
        Orange: {
            Time: { type: Number, default: 0 },
            Length: { type: Number, default: 0 }
        },
        Yellow: {
            Time: { type: Number, default: 0 },
            Length: { type: Number, default: 0 }
        },
        Green: {
            Time: { type: Number, default: 0 },
            Length: { type: Number, default: 0 }
        },
        Blue: {
            Time: { type: Number, default: 0 },
            Length: { type: Number, default: 0 }
        }
    },
    Observation: {                                                                  // Dados de observação por cor
        Red: {
            Time: { type: Number, default: 0 },
            Length: { type: Number, default: 0 }
        },
        Orange: {
            Time: { type: Number, default: 0 },
            Length: { type: Number, default: 0 }
        },
        Yellow: {
            Time: { type: Number, default: 0 },
            Length: { type: Number, default: 0 }
        },
        Green: {
            Time: { type: Number, default: 0 },
            Length: { type: Number, default: 0 }
        },
        Blue: {
            Time: { type: Number, default: 0 },
            Length: { type: Number, default: 0 }
        }
    }
}, {
    timestamps: false,
    strict: false
});

// Índices compostos para queries analíticas otimizadas
urgenciaSchema.index({ LastUpdate: 1, HospitalId: 1 });
urgenciaSchema.index({ 'EmergencyType.Code': 1, LastUpdate: 1 });
urgenciaSchema.index({ HospitalId: 1, 'EmergencyType.Code': 1, LastUpdate: 1 });
urgenciaSchema.index({ 'EmergencyType.Code': 1, LastUpdate: 1, EmergencyStatus: 1 });
urgenciaSchema.index({ EmergencyStatus: 1, LastUpdate: 1 });
urgenciaSchema.index({ 'EmergencyType.Description': 1, LastUpdate: 1 });
// Índice text search para pesquisas com regex em descrições (ex: "Pediátrica")
// Usado por: getTopHospitaisPediatricas, getTempoMedioPediatricas
urgenciaSchema.index({ 'EmergencyType.Description': 'text' });
// Índice específico para endpoint de percentagens por categoria (getPercentagensPorCategoria)
urgenciaSchema.index({ HospitalId: 1, EmergencyStatus: 1, LastUpdate: 1 });
// Índice específico para endpoint de evolução temporal (getEvolucaoTemporal)
// Suporta filtros: HospitalId (equality) + EmergencyType.Code (equality) + LastUpdate (range)
urgenciaSchema.index({ HospitalId: 1, 'EmergencyType.Code': 1, LastUpdate: 1 });

module.exports = mongoose.model('Urgencia', urgenciaSchema, 'Urgencia');
