const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function loadTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.template`), 'utf8');
}

// Replaces every `{{KEY}}` placeholder in the named template with its value
// from `vars`. Placeholders with no matching key are left untouched.
function renderTemplate(name, vars = {}) {
  let content = loadTemplate(name);
  for (const [key, value] of Object.entries(vars)) {
    content = content.split(`{{${key}}}`).join(value);
  }
  return content;
}

module.exports = { loadTemplate, renderTemplate, TEMPLATES_DIR };
