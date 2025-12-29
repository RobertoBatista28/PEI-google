require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const connectDB = require('./config/database');
const Hospital = require('./models/Hospital');
const Servico = require('./models/Servico');
const Urgencia = require('./models/Urgencia');
const Consulta = require('./models/Consulta');
const Cirurgia = require('./models/Cirurgia');

/**
 * Script para popular a base de dados com os dados das Collections
 */

// Mapeamento de meses em português para números
const mesesMap = {
  'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4,
  'Maio': 5, 'Junho': 6, 'Julho': 7, 'Agosto': 8,
  'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12
};

// Função para converter data DD/MM/YYYY HH:MM para Date
function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

// Seed Hospitais
async function seedHospitais() {
  try {
    console.log('📊 Carregando hospitais...');
    const data = await fs.readFile(
      path.join(__dirname, '../Collections/Hospital.json'),
      'utf-8'
    );
    const hospitais = JSON.parse(data);

    const hospitaisProcessed = hospitais.map(h => ({
      hospitalKey: h.HospitalKey,
      hospitalId: h.HospitalId,
      hospitalName: h.HospitalName,
      description: h.Description,
      address: h.Address,
      district: h.District,
      location: {
        type: 'Point',
        coordinates: [h.Longitude, h.Latitude]
      },
      nutsI: h.NUTSI,
      nutsII: h.NUTSII,
      nutsIII: h.NUTSIII,
      phoneNum: h.PhoneNum,
      email: h.Email
    }));

    await Hospital.deleteMany({});
    await Hospital.insertMany(hospitaisProcessed);
    console.log(`✅ ${hospitaisProcessed.length} hospitais inseridos`);
  } catch (error) {
    console.error('❌ Erro ao carregar hospitais:', error.message);
  }
}

// Seed Serviços
async function seedServicos() {
  try {
    console.log('📊 Carregando serviços...');
    const data = await fs.readFile(
      path.join(__dirname, '../Collections/Servico.json'),
      'utf-8'
    );
    const servicos = JSON.parse(data);

    const servicosProcessed = servicos.map(s => ({
      serviceKey: s.ServiceKey,
      speciality: s.Speciality,
      priorityCode: s.PriorityCode,
      priorityDescription: s.PriorityDescription,
      typeCode: s.TypeCode,
      typeDescription: s.TypeDescription,
      // Detectar se é oncologia
      isOncology: s.Speciality.toLowerCase().includes('oncolog')
    }));

    await Servico.deleteMany({});
    await Servico.insertMany(servicosProcessed);
    console.log(`✅ ${servicosProcessed.length} serviços inseridos`);
  } catch (error) {
    console.error('❌ Erro ao carregar serviços:', error.message);
  }
}

// Seed Urgências
async function seedUrgencias() {
  try {
    console.log('📊 Carregando urgências...');
    const data = await fs.readFile(
      path.join(__dirname, '../Collections/Urgencia.json'),
      'utf-8'
    );
    const urgencias = JSON.parse(data);

    const urgenciasProcessed = urgencias.map(u => ({
      lastUpdate: parseDate(u.LastUpdate),
      extractionDate: parseDate(u.ExtractionDate),
      hospitalId: u.HospitalId,
      emergencyType: {
        code: u['EmergencyType.Code'],
        description: u['EmergencyType.Description']
      },
      triage: {
        red: {
          time: parseInt(u['Triage.Red.Time']) || 0,
          length: parseInt(u['Triage.Red.Length']) || 0
        },
        orange: {
          time: parseInt(u['Triage.Orange.Time']) || 0,
          length: parseInt(u['Triage.Orange.Length']) || 0
        },
        yellow: {
          time: parseInt(u['Triage.Yellow.Time']) || 0,
          length: parseInt(u['Triage.Yellow.Length']) || 0
        },
        green: {
          time: parseInt(u['Triage.Green.Time']) || 0,
          length: parseInt(u['Triage.Green.Length']) || 0
        },
        blue: {
          time: parseInt(u['Triage.Blue.Time']) || 0,
          length: parseInt(u['Triage.Blue.Length']) || 0
        }
      }
    }));

    await Urgencia.deleteMany({});
    
    // Inserir em lotes para evitar problemas de memória
    const batchSize = 1000;
    for (let i = 0; i < urgenciasProcessed.length; i += batchSize) {
      const batch = urgenciasProcessed.slice(i, i + batchSize);
      await Urgencia.insertMany(batch);
      console.log(`   Progresso: ${Math.min(i + batchSize, urgenciasProcessed.length)}/${urgenciasProcessed.length}`);
    }
    
    console.log(`✅ ${urgenciasProcessed.length} urgências inseridas`);
  } catch (error) {
    console.error('❌ Erro ao carregar urgências:', error.message);
  }
}

// Seed Consultas
async function seedConsultas() {
  try {
    console.log('📊 Carregando consultas...');
    const data = await fs.readFile(
      path.join(__dirname, '../Collections/Consulta.json'),
      'utf-8'
    );
    const consultas = JSON.parse(data);

    // Criar mapa de serviços para lookup rápido
    const servicos = await Servico.find({});
    const servicosMap = new Map(servicos.map(s => [parseInt(s.serviceKey), s]));

    // Criar mapa de hospitais para lookup rápido
    const hospitais = await Hospital.find({});
    const hospitaisMap = new Map(hospitais.map(h => [h.hospitalName, h.hospitalId]));

    const consultasProcessed = consultas.map(c => {
      const servico = servicosMap.get(c.ServiceSK);
      const mes = mesesMap[c.Month.toLowerCase()] || 1;
      
      return {
        hospitalName: c.HospitalName,
        hospitalId: hospitaisMap.get(c.HospitalName),
        serviceSK: c.ServiceSK,
        averageWaitingTime: c.AverageWaitingTime,
        Month: c.Month,
        month: mes,
        year: c.Year,
        numberOfPeople: c.NumberOfPeople,
        date: new Date(c.Year, mes - 1, 1),
        isOncology: servico ? servico.isOncology : false,
        speciality: servico ? servico.speciality : 'Desconhecida'
      };
    });

    await Consulta.deleteMany({});
    await Consulta.insertMany(consultasProcessed);
    console.log(`✅ ${consultasProcessed.length} consultas inseridas`);
  } catch (error) {
    console.error('❌ Erro ao carregar consultas:', error.message);
  }
}

// Seed Cirurgias
async function seedCirurgias() {
  try {
    console.log('📊 Carregando cirurgias...');
    const data = await fs.readFile(
      path.join(__dirname, '../Collections/Cirurgia.json'),
      'utf-8'
    );
    const cirurgias = JSON.parse(data);

    // Criar mapa de serviços para lookup rápido
    const servicos = await Servico.find({});
    const servicosMap = new Map(servicos.map(s => [parseInt(s.serviceKey), s]));

    // Criar mapa de hospitais para lookup rápido
    const hospitais = await Hospital.find({});
    const hospitaisMap = new Map(hospitais.map(h => [h.hospitalName, h.hospitalId]));

    const cirurgiasProcessed = cirurgias.map(c => {
      const servico = servicosMap.get(c.ServiceSK);
      const mes = mesesMap[c.Month.toLowerCase()] || 1;
      
      return {
        hospitalName: c.HospitalName,
        hospitalId: hospitaisMap.get(c.HospitalName),
        serviceSK: c.ServiceSK,
        averageWaitingTime: c.AverageWaitingTime,
        Month: c.Month,
        month: mes,
        year: c.Year,
        numberOfPeople: c.NumberOfPeople,
        date: new Date(c.Year, mes - 1, 1),
        isOncology: servico ? servico.isOncology : false,
        speciality: servico ? servico.speciality : 'Desconhecida'
      };
    });

    await Cirurgia.deleteMany({});
    await Cirurgia.insertMany(cirurgiasProcessed);
    console.log(`✅ ${cirurgiasProcessed.length} cirurgias inseridas`);
  } catch (error) {
    console.error('❌ Erro ao carregar cirurgias:', error.message);
  }
}

// Função principal
async function seed() {
  try {
    console.log('\n🌱 Iniciando seed da base de dados...\n');
    
    await connectDB();
    
    await seedHospitais();
    await seedServicos();
    await seedUrgencias();
    await seedConsultas();
    await seedCirurgias();
    
    console.log('\n✅ Seed completo com sucesso!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro no seed:', error);
    process.exit(1);
  }
}

// Executar seed
seed();
