# HealthTime API

API REST para gestão e análise de tempos de espera em serviços de saúde portugueses (Urgências, Consultas e Cirurgias).

## 🚀 Características

- **Base de Dados**: MongoDB Atlas
- **Arquitetura**: REST API com Node.js e Express
- **Padrões**: MVC, boas práticas de APIs REST
- **Análises**: 7 queries analíticas complexas
- **Geolocalização**: Pesquisa de hospitais próximos
- **Submissão XML**: Endpoint para integração via XML

## 📋 Pré-requisitos

- Node.js >= 16.x
- NPM >= 8.x
- Acesso à Internet (MongoDB Atlas)

## 🔧 Instalação

### Opção 1: Script Automático (Windows)

```bash
start.bat
```

### Opção 2: Manual

```bash
# Instalar dependências
npm install

# Popular base de dados
npm run seed

# Iniciar servidor
npm start
```

## 🌐 Endpoints da API

### Base URL
```
http://localhost:3000/api/v1
```

### 1. Urgências

#### Média de utentes em espera por tipologia
```http
GET /urgencias/media-espera?tipo=PED&dataInicio=2025-01-01&dataFim=2025-02-28
```

**Parâmetros:**
- `tipo` (opcional): GER, PED, GO, MED, PSI
- `dataInicio` (opcional): Data início (YYYY-MM-DD)
- `dataFim` (opcional): Data fim (YYYY-MM-DD)

#### Percentagens por categoria de triagem
```http
GET /urgencias/percentagens-triagem?hospitalId=75458&dataInicio=2025-02-01&dataFim=2025-02-28&periodoDia=manha
```

**Parâmetros:**
- `hospitalId` (obrigatório): ID do hospital
- `dataInicio`, `dataFim` (opcional): Período
- `periodoDia` (opcional): manha, tarde, noite

#### Tempo médio urgências pediátricas por região
```http
GET /urgencias/tempo-medio-pediatricas?periodo=mes&dataInicio=2025-01-01
```

#### Top 10 hospitais (menores tempos)
```http
GET /urgencias/top-hospitais-pediatricas?dataInicio=2025-01-01&limit=10
```

#### Evolução temporal (15 em 15 minutos)
```http
GET /urgencias/evolucao-temporal?data=2025-02-16&hospitalId=75458
```

**Retorna:** Evolução completa + top 3 picos de afluência

### 2. Consultas

#### Diferença oncologia vs. não-oncologia
```http
GET /consultas/diferenca-oncologia?especialidade=Cirurgia&dataInicio=2024-12-01
```

**Parâmetros:**
- `especialidade` (obrigatório): Nome da especialidade
- `hospitalId` (opcional): Filtrar por hospital
- `dataInicio`, `dataFim` (opcional): Período

#### Listar consultas
```http
GET /consultas?hospitalId=151&ano=2024&mes=12&page=1&limit=50
```

### 3. Cirurgias

#### Tempo médio por especialidade (geral vs. oncológica)
```http
GET /cirurgias/tempo-medio-especialidade?especialidade=Cirurgia&mes=12&ano=2024
```

**Retorna:** Comparação entre lista geral e lista oncológica

#### Listar cirurgias
```http
GET /cirurgias?ano=2024&mes=12&page=1&limit=50
```

### 4. Estatísticas

#### Discrepância consultas vs. cirurgias
```http
GET /stats/discrepancia-consulta-cirurgia?especialidade=Ortopedia&dataInicio=2024-12-01
```

**Parâmetros:**
- `hospitalId` (opcional): Filtrar por hospital
- `especialidade` (opcional): Filtrar por especialidade
- `periodo` (opcional): dia, semana, mes
- `dataInicio`, `dataFim` (opcional): Período

#### Estatísticas gerais
```http
GET /stats/geral
```

### 5. Hospitais

#### Listar hospitais
```http
GET /hospitais?distrito=Porto&regiao=Norte&page=1&limit=50
```

#### Detalhes de um hospital
```http
GET /hospitais/:id
```

#### Hospitais próximos (geoespacial)
```http
GET /hospitais/proximos/-8.080458/41.270974?distancia=50000
```

### 6. Serviços

#### Listar serviços
```http
GET /servicos?tipo=Appointment&especialidade=Cirurgia&page=1
```

#### Detalhes de um serviço
```http
GET /servicos/:id
```

### 7. Submissão XML

```http
POST /urgencias/submit-xml
Content-Type: application/xml

<Urgencia>
  <!-- XML data -->
</Urgencia>
```

Também disponível para `/consultas/submit-xml` e `/cirurgias/submit-xml`

## 📊 Respostas Analíticas

### 1. Média de utentes em espera por tipologia e triagem
Query MongoDB implementada em `urgenciaController.js > getMediaEsperaPorTipologia`

### 2. Percentagem por categoria de triagem
Query MongoDB implementada em `urgenciaController.js > getPercentagensPorCategoria`

### 3. Tempo médio triagem pediátricas por região
Query MongoDB implementada em `urgenciaController.js > getTempoMedioPediatricas`

### 4. Diferença oncologia vs. não-oncologia
Query MongoDB implementada em `consultaController.js > getDiferencaOncologia`

### 5. Tempo médio cirurgia (geral vs. oncológica)
Query MongoDB implementada em `cirurgiaController.js > getTempoMedioPorEspecialidade`

### 6. Discrepância consultas vs. cirurgias
Query MongoDB implementada em `statsController.js > getDiscrepanciaConsultaCirurgia`

### 7. Top 10 hospitais pediátricas
Query MongoDB implementada em `urgenciaController.js > getTopHospitaisPediatricas`

### 8. Evolução temporal (15 em 15 min)
Query MongoDB implementada em `urgenciaController.js > getEvolucaoTemporal`

## 🗂️ Estrutura do Projeto

```
Api/
├── config/
│   └── database.js          # Configuração MongoDB Atlas
├── models/
│   ├── Hospital.js          # Schema Hospital
│   ├── Servico.js           # Schema Serviço
│   ├── Urgencia.js          # Schema Urgência
│   ├── Consulta.js          # Schema Consulta
│   └── Cirurgia.js          # Schema Cirurgia
├── controllers/
│   ├── hospitalController.js
│   ├── servicoController.js
│   ├── urgenciaController.js
│   ├── consultaController.js
│   ├── cirurgiaController.js
│   └── statsController.js
├── routes/
│   ├── hospitais.js
│   ├── servicos.js
│   ├── urgencias.js
│   ├── consultas.js
│   ├── cirurgias.js
│   └── stats.js
├── middleware/
│   ├── errorHandler.js      # Tratamento de erros
│   └── validateXML.js       # Validação XML
├── app.js                # Servidor Express
├── seed.js                  # Popular BD
├── package.json
├── .env
└── README.md
```

## 🔒 Variáveis de Ambiente

Ficheiro `.env`:
```env
MONGODB_URI=mongodb+srv://8230465:ferwf@pei.das.mongodb.net/healthtime
PORT=3000
NODE_ENV=development
```

## 🧪 Testes

```bash
# Teste de ligação e endpoints principais
npm run test

# Teste manual com ficheiro .http
# Use a extensão REST Client no VS Code
# Abrir: api-tests.http
```

## 📈 MongoDB Atlas Dashboard

1. Aceder a: https://cloud.mongodb.com
2. Login com credenciais
3. Cluster: pei.das.mongodb.net
4. Database: HealthTime
5. Collections: Hospital, Servico, Urgencia, Consulta, Cirurgia

### Visualizações Recomendadas

- **Mapa de Hospitais**: Usando geolocalização
- **Timeline Urgências**: Tempos médios ao longo do tempo
- **Comparativo Oncologia**: Gráfico de barras
- **Distribuição Triagem**: Gráfico de pizza

## 🎯 Boas Práticas Implementadas

✅ Arquitetura MVC
✅ Middlewares de erro centralizados
✅ Validação de inputs
✅ Índices MongoDB otimizados
✅ Agregações eficientes
✅ Paginação
✅ CORS habilitado
✅ Logging (Morgan)
✅ Variáveis de ambiente
✅ Documentação inline
✅ Tratamento de erros assíncrono
✅ Geolocalização (2dsphere index)

## 📝 Exemplos de Uso

### Exemplo 1: Picos de afluência num dia
```bash
curl "http://localhost:3000/api/v1/urgencias/evolucao-temporal?data=2025-02-16&hospitalId=75458"
```

### Exemplo 2: Comparar tempos oncologia
```bash
curl "http://localhost:3000/api/v1/consultas/diferenca-oncologia?especialidade=Cirurgia Geral"
```

### Exemplo 3: Top hospitais pediátricos
```bash
curl "http://localhost:3000/api/v1/urgencias/top-hospitais-pediatricas?limit=10"
```

## 🐛 Troubleshooting

### Erro de ligação MongoDB
- Verificar credenciais no `.env`
- Confirmar IP na whitelist do MongoDB Atlas
- Verificar conectividade à Internet

### Porta já em uso
- Alterar `PORT` no `.env`
- Ou matar processo: `npx kill-port 3000`

### Seed falha
- Verificar estrutura dos ficheiros JSON
- Confirmar caminhos relativos corretos
- Verificar espaço em disco

## 👥 Autores

Projeto desenvolvido no âmbito de PEI - LSIRC - LEI 2025

## 📄 Licença

ISC
