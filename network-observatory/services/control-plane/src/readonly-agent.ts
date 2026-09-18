import type { Observation, ProvenanceClass } from "../../../packages/contracts/src/index.ts";

export type AgentQuestion = "status" | "evidence" | "limits";
export interface AgentReply {
  contractVersion: "atlas-reader/0.1";
  policyVersion: "readonly/0.1";
  provider: "DETERMINISTIC";
  classification: ProvenanceClass;
  answer: string;
  observationIds: string[];
  generatedAt: string;
  acquisition: "UNVERIFIED";
  execution: "NONE";
}

/** Pure reader: receives scoped data, has no repository, shell or network capability. */
export function answerAssetQuestion(
  question: AgentQuestion,
  observations: readonly Observation[],
  now = new Date(),
): AgentReply {
  const fresh = observations.filter(item => {
    const age = now.getTime() - Date.parse(item.observedAt);
    return Number.isFinite(age) && age >= 0 && age <= 300_000;
  });
  const reply: AgentReply = {
    contractVersion: "atlas-reader/0.1", policyVersion: "readonly/0.1",
    provider: "DETERMINISTIC", classification: "INDETERMINATE",
    answer: "", observationIds: [], generatedAt: now.toISOString(),
    acquisition: "UNVERIFIED", execution: "NONE",
  };
  if (question === "limits") {
    reply.answer = "Sou o assistente de consulta do ATLAS. Posso explicar os registros autorizados. Não executo comandos, altero equipamentos, abro chamados ou acesso outro cliente. Ainda não utilizo um modelo de IA. A origem real ou simulada das observações legadas não foi verificada.";
    return reply;
  }
  if (question === "evidence") {
    reply.observationIds = observations.map(item => item.id);
    reply.answer = observations.length
      ? `Há ${observations.length} observação(ões) disponíveis nesta consulta, limitada às 100 mais recentes. ${fresh.length} estão dentro da janela de cinco minutos. As referências indicam registros existentes; não comprovam que a coleta ocorreu em equipamento real.`
      : "Ainda não há observações deste equipamento. Não posso concluir que ele esteja saudável ou indisponível.";
    return reply;
  }
  if (!fresh.length) {
    reply.answer = "Não tenho observações recentes suficientes para descrever o estado atual. Dados ausentes, antigos ou com horário futuro não confirmam disponibilidade.";
    return reply;
  }
  reply.observationIds = fresh.map(item => item.id);
  reply.answer = `Encontrei ${fresh.length} observação(ões) nos últimos cinco minutos. Posso mostrar seus valores e classificações, mas a origem de aquisição não foi verificada. Uma falha isolada de ping não confirma que o equipamento esteja offline; ausência de incidentes também não comprova saúde. Consulte as observações vinculadas antes de decidir uma intervenção.`;
  return reply;
}
