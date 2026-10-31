"""Build the static frontend without copying backend or Electron files."""
import json
import os
import shutil
from pathlib import Path
from urllib.parse import urlsplit

root = Path(__file__).resolve().parent.parent
output = root / '_site'
api_url = os.environ.get('NEON_API_BASE_URL', '').strip().rstrip('/')
if api_url:
    url = urlsplit(api_url)
    if url.scheme not in ('https', 'http') or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise SystemExit('NEON_API_BASE_URL must be an HTTP(S) URL without credentials/query/fragment.')
if output.exists():
    shutil.rmtree(output)
shutil.copytree(root / 'frontend', output)
(output / 'config.js').write_text('// Public build configuration; never put secrets here.\nwindow.NEON_CONFIG = Object.freeze(' + json.dumps({'apiBaseUrl': api_url}, ensure_ascii=True) + ');\n')
print(output)
