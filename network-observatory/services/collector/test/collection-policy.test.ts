import assert from "node:assert/strict";
import test from "node:test";
import { simulatedPolicy, assertCollectionAllowed } from "../../../packages/contracts/src/index.ts";
import { BoundedObservationOutbox, InMemoryObservationOutbox } from "../src/outbox.ts";
import { CollectorSimulator } from "../src/collector.ts";
import { SimulatorProbe } from "../src/simulator-probe.ts";
import { MinimalControlPlane } from "../../control-plane/src/control-plane.ts";
import { InMemoryObservationRepository } from "../../control-plane/src/repository.ts";
import { PrinterTriageEngine } from "../../control-plane/src/triage-engine.ts";
const id = (n: number) => `018f1d92-a0e1-7b22-8f13-f6783977f00${n}`;
const now = new Date("2026-09-18T12:00:00Z");
const policy = () => simulatedPolicy(id(1), id(2), id(3), id(4));
const scope = {tenantId:id(1),siteId:id(2),collectorId:id(3),assetId:id(4)};
const record = { ...scope, id:id(5),kind:"icmp.reachable",value:true,provenance:"MEASURED" as const,observedAt:now.toISOString(),receivedAt:now.toISOString(),idempotencyKey:"policy-test-observation-one" };
test("policy denies missing, revoked, paused, expired and unauthorized metric/address", () => {
  for (const grant of [undefined, {...policy(),state:"REVOKED" as const}, {...policy(),state:"PAUSED" as const}, {...policy(),validUntil:now.toISOString()}]) assert.throws(() => assertCollectionAllowed(grant, scope, now));
  assert.throws(() => assertCollectionAllowed(policy(),scope,now,"passwords"));
  assert.throws(() => assertCollectionAllowed(policy(),scope,now,undefined,"192.168.1.99"));
  assert.doesNotThrow(() => assertCollectionAllowed(policy(),scope,now,"icmp.reachable","192.168.1.45"));
});
test("collector blocks before probe and rechecks revocation before transmitting queued records", async () => {
  const grant=policy();let probes=0;
  const collector=new CollectorSimulator({id:id(3),tenantId:id(1),siteId:id(2),name:"test",authorizedAssetIds:[id(4)],policy:grant}, {inspect(target){probes++;return new SimulatorProbe().inspect(target);}},new InMemoryObservationOutbox(),()=>now);
  const target={asset:{id:id(4),tenantId:id(1),siteId:id(2),name:"test",kind:"PRINTER" as const,status:"ACTIVE" as const,createdAt:now.toISOString()},ipAddress:"192.168.1.45",scenario:"NO_COMMUNICATION" as const};
  grant.state="PAUSED";assert.throws(()=>collector.collect(target));assert.equal(probes,0);
  grant.state="ACTIVE";collector.collect(target);assert.throws(()=>collector.collect(target), /interval/);grant.state="REVOKED";
  let sent=false;await assert.rejects(()=>collector.synchronize({async send(){sent=true;return [];}}));assert.equal(sent,false);assert.equal(collector.pendingObservations().length,3);
});
test("server rejects whole mixed-scope batch before any save", () => {
  const repo=new InMemoryObservationRepository();
  const plane=new MinimalControlPlane([{id:id(3),tenantId:id(1),siteId:id(2),status:"ACTIVE",policy:policy()}],repo,new PrinterTriageEngine(),()=>now);
  assert.throws(()=>plane.ingest(id(3),[record,{...record,id:id(6),kind:"documents",idempotencyKey:"policy-test-observation-two"}]));
  assert.equal(repo.findByAsset(id(1),id(4)).length,0);
  assert.equal(plane.ingest(id(3),[record]).accepted,1);
});
test("outbox preserves queued data on size and age limits and resumes after acknowledgement", () => {
  let clock=now;const store=new InMemoryObservationOutbox();
  const limit=Buffer.byteLength(JSON.stringify([record],null,2));
  const box=new BoundedObservationOutbox(store,{maxBytes:limit,maxAgeMs:1000},()=>clock);
  box.enqueue([record]);assert.equal(box.status().warning,true);
  assert.throws(()=>box.enqueue([{...record,id:id(6),idempotencyKey:"policy-test-observation-two"}]));assert.equal(box.pending().length,1);
  clock=new Date(now.getTime()+2000);assert.throws(()=>box.enqueue([]));assert.equal(box.status().expired,true);
  box.acknowledge([record.idempotencyKey]);assert.equal(box.pending().length,0);
});
