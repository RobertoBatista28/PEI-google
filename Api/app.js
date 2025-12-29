require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Inicializar Express
const app = express();

// Conectar à base de dados
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger (apenas em desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rota de boas-vindas
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bem-vindo à HealthTime API',
    version: '1.0.0',
    endpoints: {
      hospitais: '/api/v1/hospitais',
      servicos: '/api/v1/servicos',
      urgencias: '/api/v1/urgencias',
      consultas: '/api/v1/consultas',
      cirurgias: '/api/v1/cirurgias',
      stats: '/api/v1/stats'
    },
    documentation: {
      urgencias: {
        mediaEspera: 'GET /api/v1/urgencias/media-espera',
        percentagensTriagem: 'GET /api/v1/urgencias/percentagens-triagem',
        tempoMedioPediatricas: 'GET /api/v1/urgencias/tempo-medio-pediatricas',
        topHospitaisPediatricas: 'GET /api/v1/urgencias/top-hospitais-pediatricas',
        evolucaoTemporal: 'GET /api/v1/urgencias/evolucao-temporal'
      },
      consultas: {
        diferencaOncologia: 'GET /api/v1/consultas/diferenca-oncologia',
        listar: 'GET /api/v1/consultas'
      },
      cirurgias: {
        tempoMedioEspecialidade: 'GET /api/v1/cirurgias/tempo-medio-especialidade',
        listar: 'GET /api/v1/cirurgias'
      },
      stats: {
        discrepancia: 'GET /api/v1/stats/discrepancia-consulta-cirurgia',
        geral: 'GET /api/v1/stats/geral'
      }
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// Rotas da API
app.use('/api/v1/hospitais', require('./routes/hospitais'));
app.use('/api/v1/servicos', require('./routes/servicos'));
app.use('/api/v1/urgencias', require('./routes/urgencias'));
app.use('/api/v1/consultas', require('./routes/consultas'));
app.use('/api/v1/cirurgias', require('./routes/cirurgias'));
app.use('/api/v1/stats', require('./routes/stats'));

// Middleware de erro (deve estar por último)
app.use(notFound);
app.use(errorHandler);

// Iniciar servidor
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              🏥  HealthTime API Server                    ║
║                                                           ║
║  Servidor rodando em modo: ${process.env.NODE_ENV || 'development'}                    ║
║  Porta: ${PORT}                                              ║
║  URL: http://localhost:${PORT}                               ║
║                                                           ║
║  📚 Documentação: http://localhost:${PORT}/                  ║
║  ❤️  Health Check: http://localhost:${PORT}/health            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Erro não tratado:', err);
  server.close(() => process.exit(1));
});

module.exports = app;
