#!/usr/bin/env node
import { createFakeRemote } from '../src/index.mjs';

function usage() {
  return 'usage: fake-git-remote --directory PATH [--name remote.git] [--branch main] [--empty]';
}

function parse(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--empty') {
      options.seedFiles = false;
      continue;
    }
    const names = {
      '--directory': 'directory',
      '--name': 'name',
      '--branch': 'defaultBranch',
    };
    const name = names[argument];
    const value = argv[index + 1];
    if (!name || !value) throw new TypeError(usage());
    options[name] = value;
    index += 1;
  }
  return options;
}

try {
  const result = await createFakeRemote(parse(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n${usage()}\n`);
  process.exitCode = 2;
}
