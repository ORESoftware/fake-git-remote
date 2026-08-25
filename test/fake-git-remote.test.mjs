import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { createFakeRemote } from '../src/index.mjs';

const exec = promisify(execFile);

test('creates a real bare remote that an isolated consumer can clone', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fake-git-remote-test-'));
  try {
    const result = await createFakeRemote({
      directory: root,
      seedFiles: {
        'README.md': '# consumer fixture\n',
        'nested/value.txt': 'ready\n',
      },
    });
    assert.match(result.head, /^[0-9a-f]{40}$/);

    const consumer = join(root, 'consumer');
    await exec('git', ['clone', '--quiet', result.remotePath, consumer]);
    assert.equal(await readFile(join(consumer, 'nested/value.txt'), 'utf8'), 'ready\n');
    const { stdout } = await exec('git', ['rev-parse', 'HEAD'], { cwd: consumer });
    assert.equal(stdout.trim(), result.head);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects traversal before creating a remote', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fake-git-remote-test-'));
  try {
    await assert.rejects(
      createFakeRemote({ directory: root, name: '../outside.git' }),
      /safe path segment/,
    );
    await assert.rejects(
      createFakeRemote({ directory: root, seedFiles: { '../outside': 'no' } }),
      /escapes the seed checkout/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the packaged CLI emits one machine-readable result', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fake-git-remote-cli-'));
  try {
    const { stdout, stderr } = await exec(
      process.execPath,
      ['bin/fake-git-remote.mjs', '--directory', root, '--name', 'cli.git'],
      { cwd: new URL('..', import.meta.url) },
    );
    assert.equal(stderr, '');
    const result = JSON.parse(stdout);
    assert.equal(result.defaultBranch, 'main');
    assert.match(result.head, /^[0-9a-f]{40}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
