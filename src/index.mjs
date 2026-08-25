import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  normalize,
  resolve,
  sep,
} from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;

async function git(args, cwd) {
  const { stdout } = await exec('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

function assertSafeSegment(value, label) {
  if (typeof value !== 'string' || !SAFE_SEGMENT.test(value) || value.includes('..')) {
    throw new TypeError(`${label} must be one safe path segment`);
  }
}

function assertSafeRef(value) {
  if (
    typeof value !== 'string' ||
    !SAFE_REF.test(value) ||
    value.includes('..') ||
    value.includes('//') ||
    value.endsWith('/')
  ) {
    throw new TypeError('defaultBranch is not a safe Git ref name');
  }
}

function fixturePath(root, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || isAbsolute(relativePath)) {
    throw new TypeError('fixture file names must be non-empty relative paths');
  }
  const normalized = normalize(relativePath);
  const target = resolve(root, normalized);
  if (normalized === '..' || normalized.startsWith(`..${sep}`) || !target.startsWith(`${root}${sep}`)) {
    throw new TypeError(`fixture path escapes the seed checkout: ${relativePath}`);
  }
  return target;
}

function validateSeedFiles(seedFiles) {
  if (seedFiles === false) return false;
  if (!seedFiles || Array.isArray(seedFiles) || typeof seedFiles !== 'object') {
    throw new TypeError('seedFiles must be an object or false');
  }
  for (const [path, content] of Object.entries(seedFiles)) {
    if (typeof content !== 'string') {
      throw new TypeError(`fixture content must be a string: ${path}`);
    }
  }
  return seedFiles;
}

export async function createFakeRemote({
  directory,
  name = 'remote.git',
  defaultBranch = 'main',
  seedFiles = { 'README.md': '# Git fixture\n' },
} = {}) {
  if (typeof directory !== 'string' || directory.length === 0) {
    throw new TypeError('directory is required');
  }
  assertSafeSegment(name, 'name');
  assertSafeRef(defaultBranch);
  const validatedSeed = validateSeedFiles(seedFiles);

  const root = resolve(directory);
  const remotePath = resolve(root, name);
  if (!remotePath.startsWith(`${root}${sep}`)) {
    throw new TypeError('remote path escapes the requested directory');
  }

  await mkdir(root, { recursive: true });
  await mkdir(remotePath);
  await git(['init', '--bare', `--initial-branch=${defaultBranch}`, remotePath], root);

  if (validatedSeed !== false) {
    const checkout = await mkdtemp(join(tmpdir(), 'fake-git-remote-seed-'));
    try {
      await git(['init', `--initial-branch=${defaultBranch}`], checkout);
      await git(['config', 'user.name', 'Fake Git Remote'], checkout);
      await git(['config', 'user.email', 'fixture@example.invalid'], checkout);
      for (const [path, content] of Object.entries(validatedSeed)) {
        const target = fixturePath(checkout, path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, 'utf8');
      }
      await git(['add', '--all'], checkout);
      await git(['commit', '-m', 'Seed deterministic fixture'], checkout);
      await git(['remote', 'add', 'origin', remotePath], checkout);
      await git(['push', '--set-upstream', 'origin', defaultBranch], checkout);
    } finally {
      await rm(checkout, { recursive: true, force: true });
    }
  }

  const head = validatedSeed === false
    ? null
    : await git(['--git-dir', remotePath, 'rev-parse', `refs/heads/${defaultBranch}`], root);
  return Object.freeze({ defaultBranch, head, remotePath });
}

export async function readSeededFile(checkout, relativePath) {
  const root = resolve(checkout);
  return readFile(fixturePath(root, relativePath), 'utf8');
}
