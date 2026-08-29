#!/bin/bash
# Paise Ledger - local run script for macOS
# Run this from Terminal.app: bash run_local.sh
set -e
cd "$(dirname "$0")"

# Homebrew's newer Node (installed as a mongodb-community dependency) is needed
# for the frontend build tooling (global `crypto`, etc.) - use it everywhere.
export PATH="/opt/homebrew/bin:$PATH"

echo "== 1/4: MongoDB check =="
if ! command -v mongod >/dev/null 2>&1; then
  echo "MongoDB nahi mila. Installing via Homebrew..."
  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew bhi nahi mila. Pehle https://brew.sh se install karo, phir yeh script dobara chalao."
    exit 1
  fi
  brew tap mongodb/brew
  brew trust mongodb/brew 2>/dev/null || brew tap --force mongodb/brew 2>/dev/null || true
  brew install mongodb-community
fi
brew services start mongodb-community 2>/dev/null || (mongod --config /opt/homebrew/etc/mongod.conf --fork 2>/dev/null || mongod --fork --logpath /tmp/mongod.log --dbpath /tmp/mongodb-data || true)
echo "MongoDB ready (localhost:27017)"

echo "== 2/4: Backend setup =="
cd backend
if [ ! -d venv ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt || (grep -v emergentintegrations requirements.txt > /tmp/reqs_fallback.txt && pip install --quiet -r /tmp/reqs_fallback.txt)
pip install --quiet httpx
echo "Starting backend on http://localhost:8001 ..."
nohup uvicorn server:app --host 0.0.0.0 --port 8001 > ../backend.log 2>&1 &
echo $! > ../backend.pid
deactivate
cd ..

echo "== 3/4: Frontend setup =="
cd frontend
rm -rf node_modules yarn.lock
npx --yes yarn@1.22.22 install --ignore-engines

# The project pins ajv@8 + ajv-keywords@5 globally (needed by the root
# schema-utils/webpack toolchain), but several webpack loaders/plugins
# (babel-loader, file-loader, fork-ts-checker-webpack-plugin, and things
# nested under it) bundle an OLDER schema-utils that only understands
# ajv@6 + ajv-keywords@3's keyword set (e.g. "formatMinimum"). Yarn's
# `resolutions` field can't isolate just these nested copies, so instead
# we build one clean ajv@6/ajv-keywords@3 install in a scratch folder and
# copy it into every nested node_modules that needs it - Node's require()
# resolution finds these local copies before walking up to the root ones.
echo "Patching nested ajv/ajv-keywords for legacy webpack loaders..."
python3 << 'PYEOF'
import json, os, subprocess, shutil, tempfile, glob

root = os.path.join(os.getcwd(), "node_modules")
targets = set()
for su_pkg in glob.glob(os.path.join(root, "**", "schema-utils", "package.json"), recursive=True):
    try:
        data = json.load(open(su_pkg))
    except Exception:
        continue
    ak_range = data.get("dependencies", {}).get("ajv-keywords", "")
    if ak_range.startswith("^3") or ak_range.startswith("^1") or ak_range.startswith("^2"):
        # parent node_modules dir that should get the legacy ajv/ajv-keywords copy
        parent_nm = os.path.dirname(os.path.dirname(su_pkg))
        targets.add(parent_nm)

if not targets:
    print("No legacy schema-utils consumers found - nothing to patch.")
else:
    scratch = tempfile.mkdtemp(prefix="oldajv-")
    json.dump({"name": "scratch", "version": "1.0.0", "private": True},
               open(os.path.join(scratch, "package.json"), "w"))
    subprocess.run(
        ["npm", "install", "ajv@6.12.6", "ajv-keywords@3.5.2",
         "--no-audit", "--no-fund", "--no-package-lock"],
        cwd=scratch, check=True,
    )
    src = os.path.join(scratch, "node_modules")
    pkgs = ["ajv", "ajv-keywords", "fast-deep-equal",
            "fast-json-stable-stringify", "json-schema-traverse",
            "uri-js", "punycode"]
    for dest in sorted(targets):
        os.makedirs(dest, exist_ok=True)
        for pkg in pkgs:
            s = os.path.join(src, pkg)
            if not os.path.isdir(s):
                continue
            d = os.path.join(dest, pkg)
            if os.path.isdir(d):
                # dir already exists (maybe empty) - copy contents into it
                for name in os.listdir(s):
                    sp, dp = os.path.join(s, name), os.path.join(d, name)
                    if os.path.isdir(sp):
                        shutil.copytree(sp, dp, dirs_exist_ok=True)
                    else:
                        shutil.copy2(sp, dp)
            else:
                shutil.copytree(s, d)
        print("  patched:", dest)
    shutil.rmtree(scratch, ignore_errors=True)
PYEOF

echo "Starting frontend on http://localhost:3000 ..."
nohup npx --yes yarn@1.22.22 --ignore-engines start > ../frontend.log 2>&1 &
echo $! > ../frontend.pid
cd ..

echo "== 4/4: Done =="
echo "Backend log: backend.log | Frontend log: frontend.log"
echo "Kuch second wait karo, phir browser mein kholo: http://localhost:3000"
