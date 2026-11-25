"""Keep personal and company data out of this public repository.

Checks the added lines and file names of a change, and commit messages, for
things no public repository should get: home folders with a user name in them,
real e-mail addresses, private network addresses, network share paths, paths on
drives E: to Z:, internal domain names, keys and tokens, and metadata hidden in
PNG files. Words of your own (an employer, a customer, a computer name) go in a
file that is never committed:

    <git dir>/sensitive-words.txt   one word or /regular expression/ a line,
                                    # for comments; matched ignoring case.
                                    A line "!LICENSE" names a file the words are
                                    not applied to (the general checks still are).

Usage:
    python scripts/check_private.py                 staged changes (pre-commit)
    python scripts/check_private.py --msg <file>    a commit message (commit-msg)
    python scripts/check_private.py --since <ref>   everything after <ref>, messages included
    python scripts/check_private.py --all           every file and every message up to HEAD

Exit code 1 and "BLOCKED" when something is found. New or changed pictures are
listed under "REVIEW": look at them, a screenshot can show anything.

Only Python is needed, with no extra packages. Turn the checks on in a clone with:

    git config core.hooksPath .githooks
"""
import os
import re
import struct
import subprocess
import sys

# Addresses allowed in text: no-reply senders, the reserved example domains, and
# the made-up addresses used by the tests, the screenshots and the documentation.
ALLOWED_EMAIL = re.compile(
    r'^(noreply|no-reply)@'
    r'|@(example\.(com|org|net)|[a-z0-9-]+\.example|users\.noreply\.github\.com'
    r'|customer-[a-z]\.com|competitor\.com|other\.(com|org)|[a-d]\.com)$'
    r'|^someone@gmail\.com$', re.I)

RULES = [
    ('home folder with a user name', re.compile(
        r'\b[A-Za-z]:[\\/]+Users[\\/]+(?!(?:Public|Default|All Users)\b)[^\\/\s\'"`<>|:*?]+'
        r'|/home/(?!runner\b)[a-z0-9._-]+|/Users/(?!(?:Shared|Public)\b)[A-Za-z0-9._-]+'), None),
    ('e-mail address', re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}'),
     lambda m: ALLOWED_EMAIL.search(m)),
    ('private network address', re.compile(
        r'\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b'), None),
    # two backslashes, a server and a share: a company share, most of the time
    ('network share path', re.compile(r'(?<![:\w\\])\\\\[A-Za-z0-9][A-Za-z0-9._$-]*\\[A-Za-z0-9._$ -]+'), None),
    # E:\ to Z:\ are mapped network drives or work disks more often than not; examples use C: or D:
    ('path on a drive E: to Z:', re.compile(r'\b[E-Ze-z]:[\\/]+[^\s\'"`<>|*?]+'), None),
    ('internal domain', re.compile(
        r'\b(?:https?|ftp|smb|file|wss?)://(?:[^\s/\'"@]*@)?[A-Za-z0-9.-]+\.(?:local|internal|corp|lan|intranet|home\.arpa)\b', re.I), None),
    ('key or token', re.compile(
        r'-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{36,}\b'
        r'|\bgithub_pat_[A-Za-z0-9_]{20,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bsk-[A-Za-z0-9_-]{20,}|\bAIza[0-9A-Za-z_-]{35}\b'), None),
]

PICTURE = re.compile(r'\.(png|jpe?g|gif|webp|svg|ico|bmp|avif|pdf)$', re.I)
# PNG chunks that only describe the pixels; anything else can carry text, dates or a device name
PNG_PLAIN = {'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'sRGB', 'pHYs', 'bKGD', 'sBIT', 'cHRM'}
EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'


def parse_words(text):
    """Words from <git dir>/sensitive-words.txt, as regular expressions, and the files they skip."""
    out, skip = [], set()
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('!'):
            skip.add(line[1:].strip())
            continue
        m = re.fullmatch(r'/(.+)/', line)
        out.append(re.compile(m.group(1) if m else re.escape(line), re.I))
    return out, skip


def find_problems(text, words=()):
    """What a piece of text breaks: [(rule, found)]."""
    out = []
    for name, rx, allow in RULES:
        for m in rx.finditer(text):
            if allow and allow(m.group(0)):
                continue
            out.append((name, m.group(0)))
    for w in words:
        m = w.search(text)
        if m:
            out.append(('a word in sensitive-words.txt', m.group(0)))
    return out


def git(*args, binary=False):
    r = subprocess.run(['git', '-c', 'core.quotepath=off', *args], capture_output=True)
    if r.returncode:
        sys.exit(f'check_private: git {" ".join(args)}: {r.stderr.decode("utf-8", "replace").strip()}')
    return r.stdout if binary else r.stdout.decode('utf-8', 'replace')


def load_words():
    path = os.path.join(git('rev-parse', '--git-common-dir').strip(), 'sensitive-words.txt')
    if not os.path.isfile(path):
        return [], set()
    with open(path, encoding='utf-8-sig') as f:
        return parse_words(f.read())


def added_lines(diff):
    """Added lines of a diff, with their file and line number."""
    file, line = '', 0
    for l in diff.split('\n'):
        if l.startswith('+++ '):
            file = re.sub(r'^b/', '', l[4:].strip().strip('"'))
        elif l.startswith('@@'):
            m = re.search(r'\+(\d+)', l)
            line = int(m.group(1)) if m else 0
        elif l.startswith('+'):
            yield file, line, l[1:]
            line += 1


def png_extras(data):
    """Names of the chunks in a PNG that are not plain picture data."""
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        return []
    pos, found = 8, set()
    while pos + 8 <= len(data):
        size, kind = struct.unpack('>I4s', data[pos:pos + 8])
        kind = kind.decode('latin-1')
        if kind not in PNG_PLAIN:
            found.add(kind)
        pos += 12 + size
    return sorted(found)


def main(argv):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='replace')
    words, skip = load_words()
    problems, pictures = [], []

    def report(where, text, file=None):
        for rule, found in find_problems(text, () if file in skip else words):
            problems.append((where, rule, found))

    if '--msg' in argv:
        with open(argv[argv.index('--msg') + 1], encoding='utf-8', errors='replace') as f:
            for i, t in enumerate(f.read().splitlines(), 1):
                if not t.startswith('#'):
                    report(f'commit message:{i}', t)
    else:
        if '--all' in argv:
            rng, log_rng, at = [EMPTY_TREE, 'HEAD'], ['HEAD'], 'HEAD:'
        elif '--since' in argv:
            ref = argv[argv.index('--since') + 1]
            rng, log_rng, at = [ref, 'HEAD'], [f'{ref}..HEAD'], 'HEAD:'
        else:
            rng, log_rng, at = ['--cached'], None, ':'
        for file, line, text in added_lines(git('diff', *rng, '-U0', '--no-color', '--no-ext-diff')):
            report(f'{file}:{line}', text, file)
        for n in filter(None, git('diff', *rng, '--name-only').split('\n')):
            report(f'file name {n}', n)
        for n in filter(None, git('diff', *rng, '--name-only', '--diff-filter=AM').split('\n')):
            if not PICTURE.search(n):
                continue
            pictures.append(n)
            if n.lower().endswith('.png'):
                extras = png_extras(git('show', at + n, binary=True))
                if extras:
                    problems.append((n, 'metadata inside the PNG', ', '.join(extras)))
        if log_rng:
            # Author names and addresses come from git config and are not checked here.
            for block in git('log', *log_rng, '--format=%H%n%B%n@@end').split('@@end\n'):
                lines = block.strip('\n').split('\n')
                if not lines[0]:
                    continue
                for i, t in enumerate(lines[1:], 1):
                    report(f'message of {lines[0][:7]}:{i}', t)
            for tag in filter(None, git('tag', '--merged', 'HEAD').split('\n')):
                for i, t in enumerate(git('for-each-ref', f'refs/tags/{tag}', '--format=%(contents)').splitlines(), 1):
                    report(f'message of tag {tag}:{i}', t)

    for where, rule, found in problems:
        print(f'BLOCKED {where}: {rule}: {found}')
    if pictures:
        print('REVIEW new or changed pictures (look at each one):')
        for n in pictures:
            print(f'  {n}')
    if not words and '--msg' not in argv:
        print('note: no sensitive-words.txt in the git folder; only the general checks ran')
    if problems:
        print(f'check_private: {len(problems)} problem(s); remove them before committing')
        return 1
    print('check_private: OK')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
