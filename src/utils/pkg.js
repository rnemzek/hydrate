const fs = require('fs');
const path = require('path');

let cached = null;

// Cached read of the running @nemzilla/hydrate package.json — shared by
// anything that needs the current version (help.js's printVersion(),
// managed-block tagging, version-drift comparisons) so it isn't re-parsed
// from disk on every call.
function getPackageInfo() {
  if (!cached) {
    cached = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  }
  return cached;
}

function getPackageVersion() {
  return getPackageInfo().version;
}

module.exports = { getPackageInfo, getPackageVersion };
