import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../webgl-renderer.js', import.meta.url), 'utf8');

function setup({ supported = true, compile = true, link = true } = {}) {
  const calls = [];
  const events = {};
  let id = 0;
  const gl = new Proxy({ drawingBufferWidth: 800, drawingBufferHeight: 600 }, {
    get(target, name) {
      if (name in target) return target[name];
      if (/^[A-Z_0-9]+$/.test(name)) return name;
      return (...args) => {
        calls.push([name, ...args.map(arg => ArrayBuffer.isView(arg) ? Array.from(arg) : arg)]);
        if (name.startsWith('create')) return { id: ++id };
        if (name === 'getShaderParameter') return compile;
        if (name === 'getProgramParameter') return link;
        if (name === 'getShaderInfoLog' || name === 'getProgramInfoLog') return 'test failure';
        if (name === 'getUniformLocation') return args[1];
        if (name === 'getAttribLocation') return args[1] === 'aPosition' ? 0 : 1;
        if (name === 'getParameter') return 4096;
        if (name === 'isContextLost') return false;
      };
    }
  });
  const canvas = {
    width: 800, height: 600, dataset: {},
    getContext: () => supported ? gl : null,
    addEventListener: (name, callback) => { events[name] = callback; },
    ownerDocument: {
      createElement(name) {
        assert.equal(name, 'canvas', 'only text should request a canvas');
        return { getContext: () => ({
          measureText: () => ({ width: 40, actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 5 }),
          strokeText() {}, fillText() {}
        }) };
      }
    }
  };
  const errors = [];
  const context = vm.createContext({ console: { error: (...args) => errors.push(args) } });
  vm.runInContext(source, context);
  return { renderer: context.CourtGL.create(canvas), calls, canvas, events, errors };
}

test('unsupported contexts and native shader failures return null', () => {
  assert.equal(setup({ supported: false }).renderer, null);
  for (const options of [{ compile: false }, { link: false }]) {
    const result = setup(options);
    assert.equal(result.renderer, null);
    assert.equal(result.errors.length, 1);
    assert.ok(result.calls.some(call => call[0] === 'deleteShader'));
  }
});

test('sprite rotates around its anchor and reuses one premultiplied image upload', () => {
  const { renderer, calls, canvas } = setup();
  assert.equal(canvas.dataset.renderer, 'webgl');
  assert.equal(renderer.begin(800, 600, 2, 3, 4), true);
  assert.doesNotThrow(() => renderer.sprite(null, 0, 0, 10, 10));
  assert.doesNotThrow(() => renderer.sprite(undefined, 0, 0, 10, 10));
  const image = { width: 100, height: 50 };
  renderer.sprite(image, 10, 20, 20, 10, {
    rotation: Math.PI / 2, anchorX: 0.5, anchorY: 0.5,
    sx: 25, sy: 10, sw: 50, sh: 20, alpha: 0.5
  });
  const vertices = calls.find(call => call[0] === 'bufferSubData')[3];
  const expected = [15, 10, 0.25, 0.2, 15, 30, 0.75, 0.2,
    5, 10, 0.25, 0.6, 5, 30, 0.75, 0.6];
  vertices.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6));
  renderer.sprite(image, 0, 0, 10, 10, { additive: true });
  assert.equal(calls.filter(call => call[0] === 'texImage2D').length, 2); // White + image.
  assert.ok(calls.some(call => call[0] === 'pixelStorei' && call[1] === 'UNPACK_PREMULTIPLY_ALPHA_WEBGL' && call[2]));
  assert.deepEqual(calls.filter(call => call[0] === 'blendFuncSeparate').at(-1),
    ['blendFuncSeparate', 'ONE', 'ONE', 'ONE', 'ONE_MINUS_SRC_ALPHA']);
  renderer.end();
  const count = calls.length;
  renderer.sprite(image, 0, 0, 1, 1);
  assert.equal(calls.length, count);
});

test('loss prevents draws; restoration rebuilds resources and image cache', () => {
  const { renderer, canvas, events, calls } = setup();
  const image = { width: 10, height: 10 };
  renderer.begin(800, 600);
  renderer.sprite(image, 0, 0, 10, 10);
  let prevented = false;
  events.webglcontextlost({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(renderer.lost, true);
  assert.equal(canvas.dataset.renderStatus, 'lost');
  assert.equal(renderer.begin(800, 600), false);
  events.webglcontextrestored();
  assert.equal(renderer.lost, false);
  assert.equal(canvas.dataset.renderStatus, 'ready');
  renderer.begin(800, 600);
  renderer.sprite(image, 0, 0, 10, 10);
  assert.equal(calls.filter(call => call[0] === 'createProgram').length, 2);
  assert.equal(calls.filter(call => call[0] === 'texImage2D').length, 4);
});

test('CSS tint multiplies tint and alpha; affine squash follows independent axes', () => {
  const { renderer, calls } = setup();
  renderer.begin(800, 600);
  renderer.sprite({ width: 1, height: 1 }, 10, 20, 4, 2, {
    anchorX: 0.5, anchorY: 0.5, rotation: Math.PI / 2,
    stretchX: 2, stretchY: 0.5, stretchRotation: Math.PI / 4,
    color: 'rgba(128, 64, 255, 0.5)', tint: [0.5, 1, 0.25], alpha: 0.4
  });
  const vertices = calls.find(call => call[0] === 'bufferSubData')[3];
  // First local vertex (-2,-1), artwork-rotated to (1,-2), then
  // stretched by [[1.25,.75],[.75,1.25]] and translated by (10,20).
  assert.ok(Math.abs(vertices[0] - 9.75) < 1e-6);
  assert.ok(Math.abs(vertices[1] - 18.25) < 1e-6);
  const tint = calls.find(call => call[0] === 'uniform4f');
  assert.deepEqual(tint, ['uniform4f', 'uColor', 64 / 255, 64 / 255, 0.25, 0.2]);
  assert.deepEqual(Array.from(renderer._color('#f08c')), [1, 0, 136 / 255, 204 / 255]);
  assert.deepEqual(Array.from(renderer._color('#102030')), [16 / 255, 32 / 255, 48 / 255, 1]);
});

test('text cache reuses labels and evicts textures at its entry bound', () => {
  const { renderer, calls } = setup();
  renderer.begin(800, 600);
  renderer.text('score', 10, 20);
  const vertices = calls.filter(call => call[0] === 'bufferSubData').at(-1)[3];
  assert.equal((vertices[0] + vertices[12]) / 2, 10);
  assert.equal((vertices[1] + vertices[13]) / 2, 20);
  renderer.text('score', 30, 40, { alpha: 0.5, scale: 2 });
  assert.equal(calls.filter(call => call[0] === 'texImage2D').length, 2);
  for (let i = 0; i < 70; i++) renderer.text(String(i), 0, 0);
  assert.equal(renderer.textures.size, 64);
  assert.ok(renderer.textBytes <= 4 * 1024 * 1024);
  assert.equal(calls.filter(call => call[0] === 'deleteTexture').length, 7);
});
