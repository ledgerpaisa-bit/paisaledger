// Patches nested ajv/ajv-keywords for webpack loaders that still expect the
// legacy (v6/v3) API, while the project's top-level packages use the newer
// ajv@8/ajv-keywords@5. npm doesn't isolate these nested overrides the way
// this project needs, so we build one clean legacy install in a scratch
// folder and copy it into every nested node_modules that needs it - Node's
// require() resolution finds these local copies before walking up to the
// newer root ones.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function findFiles(dir, filename, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name === '.bin') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(full, filename, results);
    } else if (entry.name === filename) {
      results.push(full);
    }
  }
  return results;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const root = path.join(process.cwd(), 'node_modules');
const schemaUtilsPkgs = findFiles(root, 'package.json').filter((p) =>
  p.includes(`${path.sep}schema-utils${path.sep}package.json`)
);

const targets = new Set();
for (const pkgPath of schemaUtilsPkgs) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    continue;
  }
  const akRange = (data.dependencies || {})['ajv-keywords'] || '';
  if (/^\^?[123]\./.test(akRange)) {
    const parentNodeModules = path.dirname(path.dirname(pkgPath));
    targets.add(parentNodeModules);
  }
}

if (targets.size === 0) {
  console.log('fix-ajv: no legacy schema-utils consumers found - nothing to patch.');
  process.exit(0);
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'oldajv-'));
fs.writeFileSync(
  path.join(scratch, 'package.json'),
  JSON.stringify({ name: 'scratch', version: '1.0.0', private: true })
);
execSync(
  'npm install ajv@6.12.6 ajv-keywords@3.5.2 --no-audit --no-fund --no-package-lock',
  { cwd: scratch, stdio: 'inherit' }
);

const src = path.join(scratch, 'node_modules');
const pkgs = [
  'ajv',
  'ajv-keywords',
  'fast-deep-equal',
  'fast-json-stable-stringify',
  'json-schema-traverse',
  'uri-js',
  'punycode',
];

for (const dest of targets) {
  fs.mkdirSync(dest, { recursive: true });
  for (const pkg of pkgs) {
    const s = path.join(src, pkg);
    if (!fs.existsSync(s)) continue;
    copyDir(s, path.join(dest, pkg));
  }
  console.log('fix-ajv: patched', dest);
}

fs.rmSync(scratch, { recursive: true, force: true });
console.log('fix-ajv: done.');
