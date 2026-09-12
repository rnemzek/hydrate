const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PACKAGE_NAME = '@nemzilla/hydrate';

function getCachePath(homeDir = os.homedir()) {
  return path.join(homeDir, '.hydrate', 'version-cache.json');
}

function readCache(cachePath) {
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(cachePath, data) {
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(data), 'utf8');
  } catch {
    // Best-effort cache — a write failure shouldn't break the drift check.
  }
}

// Shells out to npm with a short timeout so a slow/offline network never
// blocks `hydrate checkup`. Returns null on any failure (offline, npm
// missing, timeout, non-zero exit).
function fetchLatestVersion({ packageName = DEFAULT_PACKAGE_NAME, timeout = 1500, spawn = spawnSync } = {}) {
  const result = spawn('npm', ['show', packageName, 'version'], { encoding: 'utf8', timeout });
  if (!result || result.error || result.status !== 0) return null;
  const version = String(result.stdout || '').trim();
  return version || null;
}

// Returns { latest, cached }. Serves a same-day cached value without
// touching the network; otherwise fetches fresh and refreshes the cache.
// Falls back to a stale cache if the live fetch fails, so a single offline
// blip doesn't erase a previously known "update available" signal.
function getLatestVersion({
  homeDir = os.homedir(),
  now = Date.now(),
  ttlMs = CACHE_TTL_MS,
  fetch = fetchLatestVersion
} = {}) {
  const cachePath = getCachePath(homeDir);
  const cache = readCache(cachePath);

  if (cache && typeof cache.checkedAt === 'number' && now - cache.checkedAt < ttlMs && cache.latest) {
    return { latest: cache.latest, cached: true };
  }

  const latest = fetch();
  if (latest) {
    writeCache(cachePath, { latest, checkedAt: now });
    return { latest, cached: false };
  }

  if (cache && cache.latest) {
    return { latest: cache.latest, cached: true };
  }

  return { latest: null, cached: false };
}

function isNewerVersion(latest, current) {
  if (!latest || !current) return false;
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function checkVersionDrift(currentVersion, options = {}) {
  const { latest } = getLatestVersion(options);
  if (!latest) return { driftDetected: false, latest: null, current: currentVersion };
  return { driftDetected: isNewerVersion(latest, currentVersion), latest, current: currentVersion };
}

function formatDriftBanner({ latest, current }, { packageName = DEFAULT_PACKAGE_NAME } = {}) {
  return `\n💡 ${packageName} v${latest} is available (current: v${current}). Run 'hydrate update' to upgrade globally.\n`;
}

module.exports = {
  CACHE_TTL_MS,
  getCachePath,
  fetchLatestVersion,
  getLatestVersion,
  isNewerVersion,
  checkVersionDrift,
  formatDriftBanner
};
