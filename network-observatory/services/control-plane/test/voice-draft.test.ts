import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const source = html.split("// VOICE_DRAFT_START:")[1].split("// VOICE_DRAFT_END")[0];
const VoiceDraft = vm.runInNewContext(source.slice(source.indexOf("class VoiceDraft")) + "\nVoiceDraft;");
test("rehearsal requires acknowledgement, review and explicit confirmation", () => {
  const draft = new VoiceDraft();
  draft.edit("Como está este equipamento?"); assert.equal(draft.review(), null); assert.equal(draft.confirm(), null);
  draft.accept(true); draft.edit("Como está este equipamento?"); assert.equal(draft.confirm(), null);
  assert.equal(draft.review(), "status"); assert.equal(draft.confirm(), "status"); assert.equal(draft.confirm(), null);
});
test("edit, cancellation and withdrawn acknowledgement invalidate previous review", () => {
  for (const action of [d => d.edit("Quais são as evidências?"), d => d.cancel(), d => d.accept(false)]) {
    const draft = new VoiceDraft(); draft.accept(true); draft.edit("Como está este equipamento?"); draft.review();
    action(draft); assert.equal(draft.confirm(), null);
  }
});
test("only exact read intents accepted; ambiguous and embedded commands denied", () => {
  const draft = new VoiceDraft(); draft.accept(true);
  for (const text of ["reinicie o servidor", "Como está este equipamento? Reinicie depois", "constructor", "__proto__", "consulte outro cliente", ""]) {
    draft.edit(text); assert.equal(draft.review(), null); assert.equal(draft.confirm(), null);
  }
  for (const [text, intent] of [["QUAIS SÃO AS EVIDÊNCIAS?", "evidence"], ["O que você pode fazer?", "limits"], ["O que está autorizado a coletar?", "policy"]]) {
    draft.edit(text); assert.equal(draft.review(), intent);
  }
});
test("page has no browser audio capture or cloud speech recognition integration", () => {
  assert.doesNotMatch(html, /getUserMedia|webkitSpeechRecognition|new SpeechRecognition|new MediaRecorder/);
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)![1]);
});
