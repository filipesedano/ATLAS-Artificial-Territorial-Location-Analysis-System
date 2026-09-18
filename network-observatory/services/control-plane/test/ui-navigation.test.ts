import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(
  new URL("../../../index.html", import.meta.url),
  "utf8",
);

test("sidebar exposes every planned hash route", () => {
  for (const route of [
    "overview",
    "equipment",
    "servers",
    "network",
    "printers",
    "services",
    "incidents",
    "history",
  ]) {
    assert.match(html, new RegExp(`data-view="${route}"`));
  }
});

test("navigation has active state, hash routing and dynamic section content", () => {
  assert.match(html, /window\.addEventListener\('hashchange'/);
  assert.match(html, /button\.classList\.toggle\('active'/);
  assert.match(html, /id="sectionView"/);
  assert.match(html, /function renderSection\(view\)/);
});

test("API integration remains isolated behind the local data mode", () => {
  assert.match(html, /currentMode === 'API_LOCAL'/);
  assert.match(html, /apiCache\.incidents/);
  assert.match(html, /Inventory & Status Manager do Control Plane local/);
  assert.match(html, /\/overview`/);
  assert.match(html, /\/printers`/);
  assert.match(html, /\/servers`/);
  assert.match(html, /\/network`/);
});

test("globe body cannot disappear through a rotateY edge-on transform", () => {
  assert.doesNotMatch(html, /rotateY\(/);
  assert.match(html, /--spin/);
});
