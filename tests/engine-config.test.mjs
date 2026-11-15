import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultHashMB, normalizeEngineConfig, ENGINE_LIMITS } from '../engine-config.js';

test('mobile and low-memory devices use a conservative search cache', () => {
  assert.equal(defaultHashMB({isMobile:true,deviceMemory:8}),32);
  assert.equal(defaultHashMB({deviceMemory:2}),32);
  assert.equal(defaultHashMB({deviceMemory:4}),32);
  assert.equal(defaultHashMB({deviceMemory:8}),64);
  assert.equal(defaultHashMB(),64);
});

test('search choices preserve explicit focused and comparison analysis settings', () => {
  assert.deepEqual(normalizeEngineConfig({timeMs:'60000',multiPV:'1',hashMB:'128'}),{timeMs:60000,multiPV:1,hashMB:128});
  assert.deepEqual(normalizeEngineConfig({timeMs:8000,multiPV:3,hashMB:64}),{timeMs:8000,multiPV:3,hashMB:64});
});

test('untrusted settings cannot exceed analysis duration or memory choices', () => {
  assert.deepEqual(normalizeEngineConfig({timeMs:900000,multiPV:500,hashMB:65536}),{timeMs:60000,multiPV:1,hashMB:32});
  assert.equal(normalizeEngineConfig({timeMs:0}).timeMs,100);
  assert.equal(normalizeEngineConfig({timeMs:-100}).timeMs,100);
  assert.deepEqual(normalizeEngineConfig({timeMs:Infinity,multiPV:NaN,hashMB:-1}),{timeMs:1000,multiPV:1,hashMB:32});
});

test('missing or invalid stored values use validated device defaults', () => {
  assert.deepEqual(normalizeEngineConfig({timeMs:'',multiPV:2,hashMB:null},{timeMs:8000,multiPV:1,hashMB:64}),{timeMs:8000,multiPV:1,hashMB:64});
  assert.deepEqual(normalizeEngineConfig({}, {timeMs:Infinity,multiPV:99,hashMB:9999}),{timeMs:1000,multiPV:1,hashMB:32});
  assert.equal(Object.isFrozen(ENGINE_LIMITS.hashMB),true);
});
