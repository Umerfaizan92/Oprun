import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { writePrivateFile,copyPrivateFile,concat,probe,ffmpegPath } from '../src/media-tools.js';

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

test('large media copy is private and cannot overwrite a symlink target',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oprun-private-copy-'));
  try{
    const source=path.join(dir,'source.mp4'),target=path.join(dir,'unrelated.txt'),out=path.join(dir,'video.mp4');
    fs.writeFileSync(source,'video bytes');fs.writeFileSync(target,'preserved');fs.symlinkSync(target,out);
    copyPrivateFile(source,out);assert.equal(fs.readFileSync(target,'utf8'),'preserved');assert.equal(fs.readFileSync(out,'utf8'),'video bytes');
    assert.equal(fs.statSync(out).mode&0o777,0o600);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('one-, five- and ten-minute videos are assembled as one file at the requested duration',{timeout:120000},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oprun-full-length-'));
  try{
    const part=path.join(dir,'input.mp4');execFileSync(ffmpegPath(),['-y','-loglevel','error','-f','lavfi','-i','color=c=blue:size=160x90:rate=10','-t','15','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',part]);
    for(const seconds of [60,300,600]){
      const out=path.join(dir,`full-${seconds}.mp4`);await concat(Array(seconds/15).fill(part),out,undefined,{seconds});
      const info=await probe(out);assert.ok(info.video&&info.audio);assert.ok(Math.abs(info.seconds-seconds)<0.2,JSON.stringify(info));
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
