"""Build the installable / Chrome Web Store zip from the extension folder.

    python scripts/package.py              -> dist/reviewsend-<version>.zip
    python scripts/package.py --tag v1.2.0 -> also fail unless the manifest version is 1.2.0
    python scripts/package.py --check      -> run the checks only, write nothing

The same zip is used for manual installs and for uploading to the Chrome Web
Store, so the checks below cover what the store rejects or reviews closely.
Only the Python standard library is used.
"""
import argparse
import hashlib
import json
import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXT = ROOT / 'extension'
DIST = ROOT / 'dist'

ALLOWED_SUFFIXES = {'.json', '.js', '.html', '.css', '.png'}
ALLOWED_PERMISSIONS = {'storage'}
ALLOWED_HOSTS = {'https://mail.google.com/*'}
# The extension promises to run locally: no dynamic code and no network calls.
FORBIDDEN_CODE = [
    (r'\beval\s*\(', 'eval()'),
    (r'\bnew\s+Function\s*\(', 'new Function()'),
    # Reading a file bundled in the extension is fine; anything else is a network call.
    (r'\bfetch\s*\((?!\s*chrome\.runtime\.getURL\()', 'fetch() of something other than a bundled file'),
    (r'\bXMLHttpRequest\b', 'XMLHttpRequest'),
    (r'\bWebSocket\b', 'WebSocket'),
    (r'\bsendBeacon\b', 'sendBeacon'),
    (r'\bimportScripts\s*\(', 'importScripts()'),
]
ZIP_TIME = (2020, 1, 1, 0, 0, 0)   # fixed timestamp so the same source gives the same zip

errors = []


def fail(msg):
    errors.append(msg)


def referenced_files(manifest):
    """Every file path the manifest points at."""
    out = set()
    out.update((manifest.get('icons') or {}).values())
    action = manifest.get('action') or {}
    out.update((action.get('default_icon') or {}).values())
    if action.get('default_popup'):
        out.add(action['default_popup'])
    if (manifest.get('background') or {}).get('service_worker'):
        out.add(manifest['background']['service_worker'])
    for cs in manifest.get('content_scripts') or []:
        out.update(cs.get('js') or [])
        out.update(cs.get('css') or [])
    if (manifest.get('options_ui') or {}).get('page'):
        out.add(manifest['options_ui']['page'])
    if (manifest.get('storage') or {}).get('managed_schema'):
        out.add(manifest['storage']['managed_schema'])
    return out


def localized(manifest, field):
    """The value of a manifest field per locale; a plain string counts as one entry."""
    value = str(manifest.get(field, ''))
    m = re.fullmatch(r'__MSG_(\w+)__', value)
    if not m:
        return {'-': value}
    default = manifest.get('default_locale')
    if not default or not (EXT / '_locales' / default / 'messages.json').is_file():
        fail(f'{field} uses __MSG_ but default_locale "{default}" has no _locales/{default}/messages.json')
        return {}
    out = {}
    for f in sorted((EXT / '_locales').glob('*/messages.json')):
        try:
            msgs = {k.lower(): v for k, v in json.loads(f.read_text(encoding='utf-8')).items()}
        except ValueError:
            continue                                   # reported by check_files
        entry = msgs.get(m.group(1).lower())
        if entry is None and f.parent.name == default:
            fail(f'_locales/{default}/messages.json has no "{m.group(1)}" (needed by {field})')
        elif entry is not None:
            out[f.parent.name] = str(entry.get('message', ''))
    return out


def check_manifest(manifest, tag):
    version = str(manifest.get('version', ''))
    parts = version.split('.')
    if not (1 <= len(parts) <= 4 and all(p.isdigit() and int(p) <= 65535 and str(int(p)) == p for p in parts)):
        fail(f'version "{version}" must be 1-4 dot-separated integers (0-65535, no leading zeros)')
    if tag is not None and tag.removeprefix('v') != version:
        fail(f'tag "{tag}" does not match manifest version "{version}" - update extension/manifest.json first')
    if manifest.get('manifest_version') != 3:
        fail('manifest_version must be 3')
    # Chrome Web Store listing limits
    if not 0 < len(manifest.get('name', '')) <= 75:
        fail('name must be 1-75 characters')
    if len(manifest.get('short_name', '')) > 12:
        fail('short_name must be at most 12 characters')
    for locale, text in localized(manifest, 'description').items():
        if not 0 < len(text) <= 132:
            fail(f'description ({locale}) must be 1-132 characters, got {len(text)}')
    if '128' not in (manifest.get('icons') or {}):
        fail('a 128x128 icon is required')
    # Anything beyond these needs a deliberate decision (and a store justification).
    extra = set(manifest.get('permissions') or []) - ALLOWED_PERMISSIONS
    if extra:
        fail(f'unexpected permissions {sorted(extra)} - add them to ALLOWED_PERMISSIONS if intended')
    hosts = set(manifest.get('host_permissions') or [])
    for cs in manifest.get('content_scripts') or []:
        hosts.update(cs.get('matches') or [])
    if hosts - ALLOWED_HOSTS:
        fail(f'unexpected host patterns {sorted(hosts - ALLOWED_HOSTS)} - add them to ALLOWED_HOSTS if intended')
    for rel in sorted(referenced_files(manifest)):
        if not (EXT / rel).is_file():
            fail(f'manifest refers to a missing file: {rel}')
    return version


def check_files(files):
    for f in files:
        rel = f.relative_to(EXT).as_posix()
        if f.suffix.lower() not in ALLOWED_SUFFIXES:
            fail(f'unexpected file type in extension/: {rel}')
            continue
        if f.suffix.lower() == '.json':
            try:
                json.loads(f.read_text(encoding='utf-8'))
            except ValueError as e:
                fail(f'{rel} is not valid JSON: {e}')
        if f.suffix.lower() in ('.js', '.html'):
            text = f.read_text(encoding='utf-8')
            for pattern, label in FORBIDDEN_CODE:
                if re.search(pattern, text):
                    fail(f'{rel} uses {label}, which the extension promises not to use')
        if f.suffix.lower() == '.html':
            text = f.read_text(encoding='utf-8')
            if re.search(r'<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)\s*=\s*["\']?(?:https?:)?//', text, re.I):
                fail(f'{rel} loads a remote resource; everything must be bundled')
            if re.search(r'<script\b(?![^>]*\bsrc\s*=)', text, re.I):
                fail(f'{rel} has an inline <script>; Manifest V3 pages must use external files')


def build(files, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files:
            info = zipfile.ZipInfo(f.relative_to(EXT).as_posix(), ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, f.read_bytes())
    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        if 'manifest.json' not in names:
            fail('manifest.json is not at the top level of the zip')
        if z.testzip() is not None:
            fail('the zip failed its integrity check')
    return names


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--tag', help='release tag (e.g. v1.2.0) that must match the manifest version')
    ap.add_argument('--check', action='store_true', help='run the checks only')
    args = ap.parse_args()

    manifest = json.loads((EXT / 'manifest.json').read_text(encoding='utf-8'))
    version = check_manifest(manifest, args.tag)
    files = sorted((f for f in EXT.rglob('*') if f.is_file()), key=lambda f: f.relative_to(EXT).as_posix())
    check_files(files)

    out = DIST / f'reviewsend-{version}.zip'
    if not errors and not args.check:
        names = build(files, out)

    if errors:
        print('Packaging checks failed:')
        for e in errors:
            print('  - ' + e)
        return 1
    if args.check:
        print(f'OK: version {version}, {len(files)} files, all checks passed')
        return 0
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    print(f'{out.relative_to(ROOT).as_posix()}  {out.stat().st_size} bytes  {len(names)} files')
    print(f'sha256 {digest}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
