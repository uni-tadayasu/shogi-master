/* Browser analysis settings. Copyright (C) 2026 KASAI SOLUTIONS INC.
 * SPDX-License-Identifier: GPL-3.0-or-later */
export const ENGINE_LIMITS = Object.freeze({
  minimumTimeMs: 100,
  maximumTimeMs: 60000,
  hashMB: Object.freeze([32, 64, 128]),
  multiPV: Object.freeze([1, 3])
});

// A device-memory hint is not available in every browser. A mobile layout/user
// setting may supply isMobile without fingerprinting or collecting any data.
export function defaultHashMB({ deviceMemory, isMobile = false } = {}) {
  const memory = Number(deviceMemory);
  return isMobile || (Number.isFinite(memory) && memory > 0 && memory <= 4) ? 32 : 64;
}

function finiteNumber(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeEngineConfig(input = {}, defaults = {}) {
  const fallbackTime = finiteNumber(defaults.timeMs, 1000);
  const time = Math.round(finiteNumber(input.timeMs, fallbackTime));
  const fallbackPV = ENGINE_LIMITS.multiPV.includes(Number(defaults.multiPV)) ? Number(defaults.multiPV) : 1;
  const fallbackHash = ENGINE_LIMITS.hashMB.includes(Number(defaults.hashMB)) ? Number(defaults.hashMB) : 32;
  const pv = Number(input.multiPV), hash = Number(input.hashMB);
  return {
    timeMs: Math.max(ENGINE_LIMITS.minimumTimeMs, Math.min(ENGINE_LIMITS.maximumTimeMs, time)),
    multiPV: ENGINE_LIMITS.multiPV.includes(pv) ? pv : fallbackPV,
    hashMB: ENGINE_LIMITS.hashMB.includes(hash) ? hash : fallbackHash
  };
}
