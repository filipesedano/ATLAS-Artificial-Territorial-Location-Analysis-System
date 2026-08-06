Insight 009 — Modelo de Normalidade Adaptativa
=============================================

Resumo
------
O Modelo de Normalidade Adaptativa (ATLAS) define como um sistema cognitivo identifica se seu estado atual é "normal" ou anômalo, considerando contexto, histórico operacional e confiança. Em vez de usar uma média estática, o modelo trata normalidade como um conceito contextual, hierárquico e baseado em experiência.

Objetivo
--------
- Fornecer uma camada de comparação contextual que responda: "Isso é normal ou não, considerando o contexto?"
- Produzir um estado de confiança cognitiva (Normal / Atenção / Crítico) que direcione o runtime cognitivo e políticas de ação.
- Integrar com os Insights adjacentes (008, 010, 011) para formar uma linha coerente de observação → avaliação → reação → recomendação.

Relação com outros insights
---------------------------
- Insight 008 (Consciência Situacional) responde: "O que está acontecendo?"
- Insight 009 (Modelo de Normalidade Adaptativa) responde: "Isso é normal ou não, considerando o contexto?"
- Insight 010 (Sistema de Eventos e Resposta Cognitiva) responde: "Eu sei quando devo reagir"
- Insight 011 (Motor de Recomendação e Decisão Contextual) responde: "Eu sei como ajudar o usuário"

Fluxo lógico do Modelo de Normalidade Adaptativa
------------------------------------------------
(Adicionar antes de "Próximos passos" conforme solicitado)

AMBIENTE OPERACIONAL
                       │
                       ▼
              Environment Scanner
                       │
                       ▼
             Coleta de sinais brutos
        (CPU, GPU, RAM, temperatura, I/O)
                       │
                       ▼
            Context Understanding Layer
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
 Baseline          Baseline          Baseline
 Hardware          Usuário           Aplicação
       │               │                │
       └───────────────┼────────────────┘
                       │
                       ▼
          Memória de Experiência Operacional
                       │
                       ▼
              Comparação contextual
                       │
                       ▼
             Confiança Cognitiva
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
   Normal          Atenção          Crítico
   Verde           Amarelo          Vermelho
                       │
                       ▼
             Cognitive Runtime
                       │
                       ▼
      Explicação + Recomendação + Ação

Esse diagrama conecta diretamente os Insights 008 e 009.

Observações:
- O diagrama conecta diretamente os Insights 008 e 009: o scanner e a camada de entendimento vêm de 008; a comparação contextual e confiança cognitiva são o núcleo do 009.
- A saída (Normal/Atenção/Crítico) alimenta políticas de escalonamento, notificações e ações automatizadas (Insight 010 e 011).

Schema conceitual da Memória de Experiência Operacional
-------------------------------------------------------
(Adicionar antes de "Próximos passos" conforme solicitado)

A Memória de Experiência Operacional armazena episódios (episódios/experiências) que capturam contexto, sinais brutos, versão de baseline e resultado/outcome. Esse schema orientará a implementação do protótipo em Python e o desenho do banco de episódios.

Exemplo de schema (JSON)
{
  "experience_id": "exp_000001",
  "timestamp": "2026-08-06T12:00:00Z",
  "context": {
    "mode": "AI_training",
    "user_profile": "developer",
    "application": "model_training"
  },
  "signals": {
    "gpu_temperature": 85,
    "cpu_usage": 92,
    "memory_usage": 87
  },
  "baseline_version": "baseline_v1.0",
  "baseline_snapshot": {
    "hardware_profile": "hp_server_v1",
    "environment_state": "stable"
  },
  "prediction": {
    "classification": "normal",
    "confidence": 0.94
  },
  "outcome": {
    "failure": false,
    "user_action": "continued_operation"
  }
}

Campos sugeridos (descrição curta):
- experience_id: identificador único do episódio.
- timestamp: momento da captura.
- context: rótulos/contexto operacional (modo, perfil de usuário, aplicação, fase).
- signals: mapa de sinais brutos capturados (nome → valor).
- baseline_version: referência à baseline usada na comparação.
- baseline_snapshot: snapshot do estado da baseline (hardware, ambiente) para reconstrução de contexto histórico.
- prediction: classificação gerada pelo modelo de normalidade + confiança.
- outcome: resultado observado após o episódio (falha, ação do usuário, resultado do remédio).
- metadados opcionais: tags, duração, versão do agente, localização.

Importância:
- Facilita consultas históricas (buscar episódios semelhantes).
- Permite aprendizado adaptativo baseado em experiência (ajuste de baselines, atualização de thresholds).
- Serve como base para treinamento off-line e validação de políticas.

Homeostase cognitiva
--------------------
O Modelo de Normalidade Adaptativa funciona como um mecanismo de homeostase cognitiva, mantendo o sistema consciente de seu estado interno e externo, identificando desvios relevantes e evitando reações desnecessárias diante de variações esperadas. Esse mecanismo ajuda a preservar estabilidade operacional enquanto permite adaptação incremental diante de mudanças persistentes.

Arquitetura e componentes
------------------------
- Environment Scanner: coleta sinais e eventos.
- Context Understanding Layer: interpreta ambiente, usuário e aplicação.
- Baselines (hierárquicos): hardware, usuário, aplicação — mantidos e versionados.
- Memória de Experiência Operacional: banco de episódios indexados por contexto e features.
- Módulo de comparação contextual: busca episódios similares e compara.
- Camada de decisão (Confiança Cognitiva): produz estados Normal/Atenção/Crítico.
- Cognitive Runtime: traduz o estado em explicação, recomendação e ação.

Critérios de avaliação
----------------------
- Precisão da classificação em cenários reais (FP/FN).
- Latência de decisão (tempo entre coleta e produção de estado).
- Robustez a mudanças de baseline (drift).
- Auditabilidade das decisões (explicações ligadas às experiências usadas).

Próximos passos
---------------
- Implementar o protótipo da Memória de Experiência Operacional (schema + APIs CRUD).
- Construir um indexador de similaridade para episódios (vetores/embeddings ou features heurísticas).
- Definir processos de versionamento de baseline e migração de episódios históricos.
- Integrar saída de confiança ao sistema de eventos/ações (Insight 010).
- Criar bateria de testes com cenários normais, de atenção e críticos para validação.
