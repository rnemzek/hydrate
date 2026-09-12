const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  getCachePath,
  fetchLatestVersion,
  getLatestVersion,
  isNewerVersion,
  checkVersionDrift,
  formatDriftBanner
} = require('../src/utils/version-check');

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-version-check-test-'));
}

function withTempHome(fn) {
  const dir = makeTempHome();
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('getCachePath() nests under .hydrate/version-cache.json in the given home dir', () => {
  assert.equal(getCachePath('/home/x'), path.join('/home/x', '.hydrate', 'version-cache.json'));
});

test('fetchLatestVersion() returns the trimmed stdout on a successful spawn', () => {
  const spawn = () => ({ status: 0, stdout: 'v1.4.0\n' });
  assert.equal(fetchLatestVersion({ spawn }), 'v1.4.0');
});

test('fetchLatestVersion() returns null on spawn error', () => {
  const spawn = () => ({ error: new Error('boom') });
  assert.equal(fetchLatestVersion({ spawn }), null);
});

test('fetchLatestVersion() returns null on non-zero exit', () => {
  const spawn = () => ({ status: 1, stdout: '' });
  assert.equal(fetchLatestVersion({ spawn }), null);
});

test('fetchLatestVersion() returns null on empty stdout', () => {
  const spawn = () => ({ status: 0, stdout: '   \n' });
  assert.equal(fetchLatestVersion({ spawn }), null);
});

test('getLatestVersion() fetches fresh and writes the cache when no cache exists', () => {
  withTempHome((homeDir) => {
    const fetch = () => '1.5.0';
    const result = getLatestVersion({ homeDir, fetch, now: 1000 });

    assert.equal(result.latest, '1.5.0');
    assert.equal(result.cached, false);

    const cache = JSON.parse(fs.readFileSync(getCachePath(homeDir), 'utf8'));
    assert.equal(cache.latest, '1.5.0');
    assert.equal(cache.checkedAt, 1000);
  });
});

test('getLatestVersion() serves a fresh cache without calling fetch', () => {
  withTempHome((homeDir) => {
    fs.mkdirSync(path.dirname(getCachePath(homeDir)), { recursive: true });
    fs.writeFileSync(getCachePath(homeDir), JSON.stringify({ latest: '1.5.0', checkedAt: 1000 }));

    let called = false;
    const fetch = () => {
      called = true;
      return '9.9.9';
    };

    const result = getLatestVersion({ homeDir, fetch, now: 1000 + 60000 });

    assert.equal(result.latest, '1.5.0');
    assert.equal(result.cached, true);
    assert.equal(called, false);
  });
});

test('getLatestVersion() refetches once the cache is past its TTL', () => {
  withTempHome((homeDir) => {
    fs.mkdirSync(path.dirname(getCachePath(homeDir)), { recursive: true });
    fs.writeFileSync(getCachePath(homeDir), JSON.stringify({ latest: '1.5.0', checkedAt: 0 }));

    const fetch = () => '1.6.0';
    const result = getLatestVersion({ homeDir, fetch, now: 25 * 60 * 60 * 1000, ttlMs: 24 * 60 * 60 * 1000 });

    assert.equal(result.latest, '1.6.0');
    assert.equal(result.cached, false);
  });
});

test('getLatestVersion() falls back to a stale cache when a fresh fetch fails', () => {
  withTempHome((homeDir) => {
    fs.mkdirSync(path.dirname(getCachePath(homeDir)), { recursive: true });
    fs.writeFileSync(getCachePath(homeDir), JSON.stringify({ latest: '1.5.0', checkedAt: 0 }));

    const fetch = () => null;
    const result = getLatestVersion({ homeDir, fetch, now: 99999999999, ttlMs: 1000 });

    assert.equal(result.latest, '1.5.0');
    assert.equal(result.cached, true);
  });
});

test('getLatestVersion() returns null latest when there is no cache and fetch fails', () => {
  withTempHome((homeDir) => {
    const result = getLatestVersion({ homeDir, fetch: () => null, now: 1000 });
    assert.equal(result.latest, null);
  });
});

test('getLatestVersion() tolerates a corrupt cache file', () => {
  withTempHome((homeDir) => {
    fs.mkdirSync(path.dirname(getCachePath(homeDir)), { recursive: true });
    fs.writeFileSync(getCachePath(homeDir), 'not json');

    const result = getLatestVersion({ homeDir, fetch: () => '1.5.0', now: 1000 });
    assert.equal(result.latest, '1.5.0');
  });
});

test('isNewerVersion() compares semver-ish strings numerically', () => {
  assert.equal(isNewerVersion('1.4.0', '1.2.4'), true);
  assert.equal(isNewerVersion('1.2.4', '1.4.0'), false);
  assert.equal(isNewerVersion('1.2.4', '1.2.4'), false);
  assert.equal(isNewerVersion('1.2.10', '1.2.9'), true);
  assert.equal(isNewerVersion('2.0.0', '1.9.9'), true);
});

test('isNewerVersion() handles missing/short version strings safely', () => {
  assert.equal(isNewerVersion(null, '1.0.0'), false);
  assert.equal(isNewerVersion('1.0.0', null), false);
  assert.equal(isNewerVersion('1.1', '1.0.9'), true);
});

test('checkVersionDrift() reports no drift when latest is unavailable', () => {
  withTempHome((homeDir) => {
    const result = checkVersionDrift('1.2.4', { homeDir, fetch: () => null, now: 1000 });
    assert.equal(result.driftDetected, false);
    assert.equal(result.latest, null);
  });
});

test('checkVersionDrift() reports drift when a newer version is published', () => {
  withTempHome((homeDir) => {
    const result = checkVersionDrift('1.2.4', { homeDir, fetch: () => '1.4.0', now: 1000 });
    assert.equal(result.driftDetected, true);
    assert.equal(result.latest, '1.4.0');
    assert.equal(result.current, '1.2.4');
  });
});

test('checkVersionDrift() reports no drift when already current', () => {
  withTempHome((homeDir) => {
    const result = checkVersionDrift('1.4.0', { homeDir, fetch: () => '1.4.0', now: 1000 });
    assert.equal(result.driftDetected, false);
  });
});

test('formatDriftBanner() renders the expected upgrade message', () => {
  const banner = formatDriftBanner({ latest: '1.4.0', current: '1.2.4' });
  assert.match(banner, /@nemzilla\/hydrate v1\.4\.0 is available \(current: v1\.2\.4\)/);
  assert.match(banner, /hydrate update/);
});
