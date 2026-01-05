# HealthTime - Sistema de Monitorização de Tempos de Espera Hospitalares

## 📋 Sobre o Projeto

O **HealthTime** é um sistema integrado de monitorização de tempos de espera hospitalares que recolhe, armazena e disponibiliza informação sobre urgências, consultas e cirurgias de hospitais parceiros. O sistema permite análises comparativas e geração de relatórios através de uma API REST, utilizando MongoDB como base de dados NoSQL.

## 👥 Autores

- **João Coelho** - 8230465
- **Roberto Baptista** - 8230471
- **Diogo Moreira** - 8220767

**Unidade Curricular:** PEI (Processamento Estruturado de Informação)  
**Curso:** LEI/LSIRC  
**Ano Letivo:** 2025/2026  
**Instituição:** Escola Superior de Tecnologia e Gestão - Politécnico do Porto

## 🎯 Objetivo

Desenvolver uma solução completa que permita:
- Receção de dados em formato XML de hospitais parceiros
- Validação através de schemas XSD
- Transformação e armazenamento em MongoDB
- Disponibilização de dados através de uma API REST em formato JSON
- Visualização de estatísticas numa dashboard MongoDB Atlas

## 📦 Estrutura do Projeto

```
PEI-25.26/
├── Api/                          # API REST Node.js + Express
│   ├── app.js                   # Aplicação principal
│   ├── config/                  # Configurações (MongoDB)
│   ├── controllers/             # Lógica de negócio
│   ├── middleware/              # Validação XML e tratamento de erros
│   ├── models/                  # Modelos Mongoose
│   ├── routes/                  # Definição de rotas
│   └── schemas/                 # Schemas XSD
│
├── Collections/                  # Dados em formato JSON e CSV
│   ├── Cirurgia.json/csv
│   ├── Consulta.json/csv
│   ├── Hospital.json/csv
│   ├── Servico.json/csv
│   └── Urgencia.json/csv
│
├── Pipelines/                    # Pipelines de agregação MongoDB
│   ├── pipeline_cirurgias.js
│   ├── pipeline_consultas.js
│   ├── pipeline_emergencias.js
│   ├── pipeline_hospitais.js
│   └── pipeline_servicos.js
│
├── Raw Data/                     # Dados originais em CSV
│   ├── Hospitais.csv
│   ├── Servicos.csv
│   ├── TemposEsperaConsultaCirurgia.csv
│   └── TemposEsperaEmergencia.csv
│
├── XSD/                          # Vocabulário XML e exemplos
│   ├── Cirurgia-schema.xsd
│   ├── Cirurgia.xml
│   ├── Consulta-schema.xsd
│   ├── Consulta.xml
│   ├── Urgencia-schema.xsd
│   └── Urgencia.xml
│
├── Scripts/                      # Scripts de transformação
│   └── csv_to_json.py
│
└── postman/                      # Coleções Postman para testes
    └── collections/
```

## 🗂️ Vocabulário XML

O sistema suporta três tipos de documentos XML:

### 1. Urgências (submissão a cada 15 minutos)
- Tipologia da urgência
- Estado (Aberta/Fechada)
- Utentes em espera por categoria de triagem
- Utentes em observação
- Timestamp do registo

### 2. Consultas (submissão mensal)
- Especialidade médica
- População alvo (adulto/criança)
- Tipo de lista de espera (geral, não oncológica, oncológica)
- Tempos médios de resposta por prioridade clínica

### 3. Cirurgias (submissão mensal)
- Especialidade cirúrgica
- Tipo de lista de espera (geral, não oncológica, oncológica)
- Tempo médio de espera

Todos os documentos XML são validados através de schemas XSD disponíveis na pasta `/XSD/`.

## 🔧 Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web para API REST
- **MongoDB** - Base de dados NoSQL
- **Mongoose** - ODM para MongoDB
- **xsd-schema-validator** - Validação de schemas XSD
- **fast-xml-parser** - Parser XML para JavaScript
- **Python** - Scripts de transformação de dados
- **Postman** - Testes de API

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js (v14 ou superior)
- MongoDB (v4.4 ou superior)
- npm

### Passos de Instalação

1. **Clonar o repositório**
```bash
git clone https://github.com/djDARKWAY/PEI-25.26.git
cd PEI-25.26
```

2. **Instalar dependências da API**
```bash
cd Api
npm install
```

3. **Configurar a base de dados**
   - Editar o ficheiro `Api/config/database.js` com as credenciais do MongoDB
   - Criar a base de dados `healthtime` no MongoDB

4. **Executar a aplicação**
```bash
cd Api
npm start
```

A API estará disponível em `http://localhost:3000`

## 📡 Endpoints da API

### Hospitais
- `GET /api/v1/hospitais` - Listar todos os hospitais
- `GET /api/v1/hospitais/:id` - Obter detalhes de um hospital
- `GET /api/v1/hospitais/proximos/:longitude/:latitude` - Pesquisar hospitais próximos (geoespacial)

### Serviços
- `GET /api/v1/servicos` - Listar todos os serviços
- `GET /api/v1/servicos/:id` - Obter detalhes de um serviço

### Urgências
- `GET /api/v1/urgencias` - Listar urgências com filtros
- `GET /api/v1/urgencias/:id` - Obter uma urgência específica por ID
- `POST /api/v1/urgencias/submit-xml` - Submeter dados de urgência via XML
- `GET /api/v1/urgencias/media-espera` - Média de utentes em espera por tipologia e categoria de triagem
- `GET /api/v1/urgencias/percentagens-triagem` - Percentagem por categoria de triagem num hospital
- `GET /api/v1/urgencias/tempo-medio-pediatricas` - Tempo médio de espera nas urgências pediátricas por região
- `GET /api/v1/urgencias/top-hospitais-pediatricas` - Top 10 hospitais com menores tempos médios (urgências pediátricas)
- `GET /api/v1/urgencias/evolucao-temporal` - Evolução temporal dos tempos de espera (agregação 15 em 15 min)

### Consultas
- `GET /api/v1/consultas` - Listar consultas com filtros
- `GET /api/v1/consultas/diferenca-oncologia` - Diferença entre tempos médios oncologia vs. não-oncologia
- `POST /api/v1/consultas/submit-xml` - Submeter dados de consulta via XML

### Cirurgias
- `GET /api/v1/cirurgias` - Listar cirurgias com filtros
- `GET /api/v1/cirurgias/tempo-medio-especialidade` - Tempo médio de espera para cirurgia (geral vs. oncológica)
- `POST /api/v1/cirurgias/submit-xml` - Submeter dados de cirurgia via XML

### Estatísticas Gerais
- `GET /api/v1/stats/geral` - Estatísticas gerais do sistema
- `GET /api/v1/stats/discrepancia-consulta-cirurgia` - Discrepância entre tempos médios de consultas e cirurgias

## 📊 Questões Analíticas Implementadas

1. **Média de utentes em espera** por tipologia e categoria de triagem
2. **Percentagem por categoria de triagem** em relação ao total
3. **Tempo médio de espera para triagem** nas urgências pediátricas por região
4. **Diferença entre tempos médios** de consultas oncológicas vs não-oncológicas
5. **Tempo médio de espera para cirurgia** por especialidade
6. **Discrepância entre tempos** de consultas e cirurgias
7. **Top 10 hospitais** com menores tempos de espera
8. **Evolução temporal** dos tempos de espera nas urgências

Cada questão é implementada através de pipelines de agregação MongoDB otimizadas.

## 🧪 Testes

Utilizar a coleção Postman disponível em `/postman/collections/API-PEI.postman_collection.json` para testar todos os endpoints da API.

### Importar no Postman
1. Abrir Postman
2. File → Import
3. Selecionar o ficheiro `API-PEI.postman_collection.json`
4. Importar variáveis globais de `workspace.postman_globals.json`

## 📈 Dashboard MongoDB Atlas

O projeto inclui visualizações no MongoDB Atlas que apresentam:
- Estatísticas de urgências em tempo real
- Comparação de tempos de espera entre hospitais
- Evolução temporal dos indicadores
- Análise geográfica por região

## 🗃️ Modelação de Dados

O sistema utiliza as seguintes coleções MongoDB:

- **hospitais** - Informação sobre hospitais e serviços
- **urgencias** - Registos de urgências (atualizados a cada 15 minutos)
- **consultas** - Dados mensais de consultas por especialidade
- **cirurgias** - Dados mensais de cirurgias programadas
- **servicos** - Catálogo de serviços e especialidades

A modelação segue princípios de design orientado a documentos, com embedding e referências conforme apropriado para otimizar consultas.

## 📝 Validação XML

Todos os documentos XML submetidos são validados contra schemas XSD:
- `Urgencia-schema.xsd`
- `Consulta-schema.xsd`
- `Cirurgia-schema.xsd`

Documentos inválidos são rejeitados com mensagens de erro descritivas.

## 🔒 Tratamento de Erros

O sistema implementa:
- Validação de schemas XSD
- Tratamento de dados omissos
- Identificação de registos com erros
- Middleware de tratamento centralizado de erros
- Logging de operações

## 📚 Documentação Adicional

- **Relatório Técnico** - Análise detalhada do domínio e justificação das decisões
- **Schemas XSD** - Disponíveis na pasta `/XSD/`
- **Pipelines MongoDB** - Documentadas na pasta `/Pipelines/`
- **API Documentation** - Coleção Postman com exemplos

## 🤝 Contribuições

Este é um projeto académico desenvolvido no âmbito da UC de Processamento Estruturado de Informação.

## 📄 Licença

Este projeto foi desenvolvido para fins académicos na ESTG - Politécnico do Porto.

---

**Desenvolvido com 💙 na ESTG - Politécnico do Porto**
