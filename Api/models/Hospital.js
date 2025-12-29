const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
    HospitalKey: { type: Number, required: true },                                  // [PK] Chave única do hospital
    HospitalId: { type: Number, required: true, index: true },                      // Identificador do hospital
    HospitalName: { type: String, required: true, index: true },                    // Nome completo do hospital
    Description: { type: String },                                                  // Descrição do hospital
    Address: { type: String },                                                      // Morada do hospital
    District: { type: String, index: true },                                        // Distrito onde está localizado
    Latitude: { type: Number },                                                     // Latitude geográfica do hospital
    Longitude: { type: Number },                                                    // Longitude geográfica do hospital
    NUTSI: { type: String },                                                        // Região NUTS I
    NUTSII: { type: String, index: true },                                          // Região NUTS II
    NUTSIII: { type: String, index: true },                                         // Região NUTS III
    PhoneNum: { type: String },                                                     // Número de telefone do hospital
    Email: { type: String }                                                         // Endereço de email do hospital
}, {
    timestamps: false,
    strict: false
});

// Índices compostos para queries eficientes
hospitalSchema.index({ District: 1, HospitalName: 1 });
hospitalSchema.index({ NUTSII: 1, NUTSIII: 1 });

module.exports = mongoose.model('Hospital', hospitalSchema, 'Hospital');
