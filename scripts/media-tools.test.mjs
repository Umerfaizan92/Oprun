import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writePrivateFile } from '../src/media-tools.js';

test('private media replaces a symlink without writing its target and remains private on replacement', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oprun-private-media-'));
  try {
    const target = path.join(dir, 'unrelated.txt'), recording = path.join(dir, 'recording.webm');
    fs.writeFileSync(target, 'preserve this file');
    fs.symlinkSync(target, recording);
    writePrivateFile(recording, Buffer.from('first recording'));
    assert.equal(fs.readFileSync(target, 'utf8'), 'preserve this file');
    assert.equal(fs.lstatSync(recording).isSymbolicLink(), false);
    assert.equal(fs.readFileSync(recording, 'utf8'), 'first recording');
    assert.equal(fs.statSync(recording).mode & 0o777, 0o600);
    writePrivateFile(recording, Buffer.from('replacement recording'));
    assert.equal(fs.readFileSync(recording, 'utf8'), 'replacement recording');
    assert.equal(fs.statSync(recording).mode & 0o777, 0o600);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['recording.webm', 'unrelated.txt']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
