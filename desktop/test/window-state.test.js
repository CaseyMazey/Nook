const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadWindowState, saveWindowState } = require('../lib/window-state.js');

const DISPLAYS = [{ x: 0, y: 0, width: 1920, height: 1080 }];
const DEFAULT_STATE = { width: 1280, height: 820 };

let dir;
let file;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-window-state-'));
  file = path.join(dir, 'window-state.json');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

test('fehlende Datei ergibt die Standardgröße', () => {
  assert.deepEqual(loadWindowState(file, DISPLAYS), DEFAULT_STATE);
});

test('kaputtes JSON ergibt die Standardgröße', () => {
  fs.writeFileSync(file, '{ kaputt');
  assert.deepEqual(loadWindowState(file, DISPLAYS), DEFAULT_STATE);
});

test('gültiges JSON mit falschem Inhalt ergibt die Standardgröße', () => {
  for (const inhalt of ['null', '[]', '42', '{"width":"gross","height":800}', '{"width":0,"height":800}', '{"width":800,"height":600,"x":"links","y":0}']) {
    fs.writeFileSync(file, inhalt);
    assert.deepEqual(loadWindowState(file, DISPLAYS), DEFAULT_STATE, inhalt);
  }
});

test('Lage ohne Überschneidung mit einem Display ergibt Standardgröße ohne x/y', () => {
  fs.writeFileSync(file, JSON.stringify({ x: 5000, y: 5000, width: 900, height: 700 }));
  assert.deepEqual(loadWindowState(file, DISPLAYS), DEFAULT_STATE);
});

test('nur berührende Kante zählt nicht als Überschneidung', () => {
  fs.writeFileSync(file, JSON.stringify({ x: 1920, y: 0, width: 900, height: 700 }));
  assert.deepEqual(loadWindowState(file, DISPLAYS), DEFAULT_STATE);
});

test('gültige Lage bleibt unverändert', () => {
  const lage = { x: 100, y: 50, width: 900, height: 700 };
  fs.writeFileSync(file, JSON.stringify(lage));
  assert.deepEqual(loadWindowState(file, DISPLAYS), lage);
});

test('Lage auf einem zweiten Display mit negativen Koordinaten bleibt gültig', () => {
  const lage = { x: -1500, y: 100, width: 900, height: 700 };
  fs.writeFileSync(file, JSON.stringify(lage));
  const displays = [...DISPLAYS, { x: -1920, y: 0, width: 1920, height: 1080 }];
  assert.deepEqual(loadWindowState(file, displays), lage);
});

test('Titelleiste muss erreichbar auf einem Display liegen, sonst Standardgröße', () => {
  const lagen = [
    { x: 1919, y: 0, width: 900, height: 700 }, // nur 1 px sichtbar
    { x: 0, y: -500, width: 900, height: 700 }, // Titelleiste oberhalb
    { x: 1821, y: 0, width: 900, height: 700 }, // 99 px breit sichtbar
    { x: -801, y: 0, width: 900, height: 700 }, // links nur 99 px sichtbar
    { x: 0, y: 1041, width: 900, height: 700 }, // nur 39 px hoch sichtbar
    { x: 0, y: -1, width: 900, height: 700 }, // oben ragt 1 px hinaus
  ];
  for (const lage of lagen) {
    fs.writeFileSync(file, JSON.stringify(lage));
    assert.deepEqual(loadWindowState(file, DISPLAYS), DEFAULT_STATE, JSON.stringify(lage));
  }
});

test('Titelleiste genau an der Grenze bleibt gültig', () => {
  const lagen = [
    { x: 1820, y: 0, width: 900, height: 700 }, // genau 100 px breit
    { x: 0, y: 1040, width: 900, height: 700 }, // genau 40 px hoch
  ];
  for (const lage of lagen) {
    fs.writeFileSync(file, JSON.stringify(lage));
    assert.deepEqual(loadWindowState(file, DISPLAYS), lage);
  }
});

test('unsinnige Größen ergeben die Standardgröße', () => {
  const lagen = [
    '{"x":0,"y":0,"width":1e308,"height":700}',
    '{"x":0,"y":0,"width":900,"height":1e308}',
    '{"x":0,"y":0,"width":199,"height":700}',
    '{"x":0,"y":0,"width":900,"height":199}',
    '{"x":0,"y":0,"width":20001,"height":700}',
    '{"x":0,"y":0,"width":900,"height":20001}',
    '{"x":0,"y":0,"width":900.5,"height":700}',
    '{"x":0.5,"y":0,"width":900,"height":700}',
  ];
  for (const lage of lagen) {
    fs.writeFileSync(file, lage);
    assert.deepEqual(loadWindowState(file, DISPLAYS), DEFAULT_STATE, lage);
  }
});

test('Größen an den Grenzen 200 und 20000 bleiben gültig', () => {
  for (const lage of [{ x: 0, y: 0, width: 200, height: 200 }, { x: 0, y: 0, width: 20000, height: 20000 }]) {
    fs.writeFileSync(file, JSON.stringify(lage));
    assert.deepEqual(loadWindowState(file, DISPLAYS), lage);
  }
});

test('saveWindowState lässt sich wieder laden und hinterlässt keine Hilfsdatei', () => {
  const lage = { x: 10, y: 20, width: 1000, height: 800 };
  saveWindowState(file, lage);
  assert.deepEqual(loadWindowState(file, DISPLAYS), lage);
  assert.deepEqual(fs.readdirSync(dir), ['window-state.json']);
});
