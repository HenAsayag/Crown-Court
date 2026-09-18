/* Standalone WebGL 1 renderer. Coordinates are logical pixels; begin's width and
 * height are backing-store pixels. Shake is applied before scale. Text uses a
 * centered alignment and middle baseline. Images are immutable after first upload. */
(function (root) {
  'use strict';

  const VERTEX = `
    attribute vec2 aPosition;
    attribute vec2 aUV;
    uniform vec2 uViewport;
    uniform vec3 uView;
    varying mediump vec2 vUV;
    void main() {
      vec2 p = (aPosition + uView.yz) * uView.x;
      gl_Position = vec4(p.x / uViewport.x * 2.0 - 1.0,
                         1.0 - p.y / uViewport.y * 2.0, 0.0, 1.0);
      vUV = aUV;
    }`;
  const FRAGMENT = `
    precision mediump float;
    varying mediump vec2 vUV;
    uniform sampler2D uTexture;
    uniform vec4 uColor;
    uniform float uMode;
    uniform vec2 uRadius;
    uniform float uStroke;
    void main() {
      if (uMode < 0.5) {
        vec4 texel = texture2D(uTexture, vUV);
        gl_FragColor = vec4(texel.rgb * uColor.rgb * uColor.a,
                            texel.a * uColor.a);
      } else {
        vec2 p = vUV * 2.0 - 1.0;
        float d = length(p);
        float coverage;
        if (uMode > 2.5) {
          coverage = max(0.0, (exp(-4.0 * d * d) - exp(-4.0)) /
                             (1.0 - exp(-4.0)));
        } else if (uMode > 1.5) {
          // Approximate signed distance in backing-store pixels; no extension needed.
          float gradient = length(p / uRadius) / max(d, 0.0001);
          float distance = (1.0 - d) / max(gradient, 0.0001);
          coverage = smoothstep(-0.5, 0.5, distance);
          if (uStroke > 0.0)
            coverage *= 1.0 - smoothstep(uStroke - 0.5, uStroke + 0.5, distance);
        } else {
          coverage = 1.0;
        }
        float a = uColor.a * coverage;
        gl_FragColor = vec4(uColor.rgb * a, a);
      }
    }`;

  class CourtGL {
    static create(canvas) {
      let renderer;
      try {
        const gl = canvas.getContext('webgl', {
          alpha: true, premultipliedAlpha: true, antialias: false
        });
        if (!gl) return null;
        renderer = new CourtGL(canvas, gl);
        return renderer;
      } catch (error) {
        // A failed initialization can still bind this canvas to WebGL. Callers
        // switching to Canvas 2D must replace the canvas in that case.
        if (root.console) root.console.error('CourtGL initialization failed:', error);
        return null;
      }
    }

    constructor(canvas, gl) {
      this.canvas = canvas;
      this.gl = gl;
      this.lost = false;
      this.active = false;
      this.scale = 1;
      this.colors = new Map();
      this.vertices = new Float32Array(16);
      this._initialize();
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        this.lost = true;
        this.active = false;
        canvas.dataset.renderStatus = 'lost';
      });
      canvas.addEventListener('webglcontextrestored', () => {
        try {
          this._initialize();
          this.lost = false;
          canvas.dataset.renderStatus = 'ready';
        } catch (error) {
          this.lost = true;
          canvas.dataset.renderStatus = 'lost';
          if (root.console) root.console.error('CourtGL restoration failed:', error);
        }
      });
      canvas.dataset.renderer = 'webgl';
      canvas.dataset.renderStatus = 'ready';
    }

    _initialize() {
      const gl = this.gl;
      const shaders = [];
      let program, buffer, white;
      try {
        for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
          const shader = gl.createShader(type);
          if (!shader) throw new Error('Cannot allocate shader');
          shaders.push(shader);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
        }
        program = gl.createProgram();
        if (!program) throw new Error('Cannot allocate shader program');
        shaders.forEach(shader => gl.attachShader(program, shader));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          throw new Error(gl.getProgramInfoLog(program) || 'Shader linking failed');
        buffer = gl.createBuffer();
        if (!buffer) throw new Error('Cannot allocate vertex buffer');
        white = this._upload(null);
      } catch (error) {
        if (program) gl.deleteProgram(program);
        if (buffer) gl.deleteBuffer(buffer);
        if (white) gl.deleteTexture(white);
        throw error;
      } finally {
        shaders.forEach(shader => gl.deleteShader(shader));
      }
      this.program = program;
      this.buffer = buffer;
      this.white = white;
      this.images = new WeakMap();
      this.textures = new Map();
      this.textBytes = 0;
      this.locations = {};
      for (const name of ['uViewport', 'uView', 'uTexture', 'uColor', 'uMode', 'uRadius', 'uStroke'])
        this.locations[name] = gl.getUniformLocation(program, name);
      this.position = gl.getAttribLocation(program, 'aPosition');
      this.uv = gl.getAttribLocation(program, 'aUV');
      this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    }

    _upload(image) {
      const gl = this.gl;
      const texture = gl.createTexture();
      if (!texture) throw new Error('Cannot allocate texture');
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        return texture;
      } catch (error) {
        gl.deleteTexture(texture);
        throw error;
      }
    }

    begin(width, height, scale = 1, shakeX = 0, shakeY = 0) {
      this.active = false;
      if (this.lost || this.gl.isContextLost()) return false;
      if (!(width > 0 && height > 0 && scale > 0)) return false;
      const gl = this.gl, loc = this.locations;
      if (this.canvas.width !== width) this.canvas.width = width;
      if (this.canvas.height !== height) this.canvas.height = height;
      this.scale = scale;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.SCISSOR_TEST);
      gl.colorMask(true, true, true, true);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.useProgram(this.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.position);
      gl.enableVertexAttribArray(this.uv);
      gl.vertexAttribPointer(this.position, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(this.uv, 2, gl.FLOAT, false, 16, 8);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(loc.uTexture, 0);
      gl.uniform2f(loc.uViewport, width, height);
      gl.uniform3f(loc.uView, scale, shakeX, shakeY);
      this.active = true;
      return true;
    }

    _draw(texture, x, y, w, h, color, alpha, mode = 0, additive = false,
          rotation = 0, anchorX = 0, anchorY = 0, uv = [0, 0, 1, 1], rx = 1, ry = 1, stroke = 0,
          stretchX = 1, stretchY = 1, stretchRotation = 0) {
      if (!this.active || this.lost || !(alpha > 0) || !w || !h) return;
      const gl = this.gl, loc = this.locations;
      const c = Math.cos(rotation), s = Math.sin(rotation);
      const sc = Math.cos(stretchRotation), ss = Math.sin(stretchRotation);
      for (let i = 0; i < 4; i++) {
        const right = i & 1, bottom = i >> 1;
        const px = (right - anchorX) * w, py = (bottom - anchorY) * h;
        const rotatedX = px * c - py * s, rotatedY = px * s + py * c;
        // T * R(stretchRotation) * S * R(-stretchRotation) * R(rotation).
        const stretchedX = (sc * rotatedX + ss * rotatedY) * stretchX;
        const stretchedY = (-ss * rotatedX + sc * rotatedY) * stretchY;
        this.vertices.set([x + sc * stretchedX - ss * stretchedY, y + ss * stretchedX + sc * stretchedY,
          uv[right ? 2 : 0], uv[bottom ? 3 : 1]], i * 4);
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Keep destination alpha bounded even for additive RGB lighting.
      gl.blendFuncSeparate(gl.ONE, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform4f(loc.uColor, color[0], color[1], color[2], Math.min(1, alpha * (color[3] === undefined ? 1 : color[3])));
      gl.uniform1f(loc.uMode, mode);
      gl.uniform2f(loc.uRadius, Math.max(0.001, rx * this.scale), Math.max(0.001, ry * this.scale));
      gl.uniform1f(loc.uStroke, stroke * this.scale);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    sprite(image, x, y, w, h, { alpha = 1, rotation = 0, anchorX = 0, anchorY = 0,
      sx = 0, sy = 0, sw = image?.width, sh = image?.height, additive = false, tint = [1, 1, 1],
      color, stretchX = 1, stretchY = 1, stretchRotation = 0 } = {}) {
      if (!this.active || this.lost || !image || !(alpha > 0)) return;
      const iw = image.naturalWidth || image.videoWidth || image.width;
      const ih = image.naturalHeight || image.videoHeight || image.height;
      if (!iw || !ih || image.complete === false) return;
      let texture = this.images.get(image);
      if (!texture) {
        if (iw > this.maxTextureSize || ih > this.maxTextureSize) throw new Error('Image exceeds WebGL texture size limit');
        texture = this._upload(image);
        this.images.set(image, texture);
      }
      const cssTint = color === undefined ? [1, 1, 1, 1] : this._color(color);
      const combinedTint = [tint[0] * cssTint[0], tint[1] * cssTint[1], tint[2] * cssTint[2], cssTint[3]];
      this._draw(texture, x, y, w, h, combinedTint, alpha, 0, additive, rotation, anchorX, anchorY,
        [sx / iw, sy / ih, (sx + sw) / iw, (sy + sh) / ih], 1, 1, 0,
        stretchX, stretchY, stretchRotation);
    }

    _color(css) {
      if (this.colors.has(css)) return this.colors.get(css);
      let parsed;
      const input = String(css).trim();
      const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(input);
      if (hex) {
        let digits = hex[1];
        if (digits.length < 5) digits = Array.from(digits, digit => digit + digit).join('');
        parsed = [0, 2, 4].map(offset => parseInt(digits.slice(offset, offset + 2), 16) / 255);
        parsed.push(digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1);
      } else if (/^rgba?\(/i.test(input)) {
        const parts = input.slice(input.indexOf('(') + 1, -1).trim().split(/[\s,/]+/);
        if ((parts.length === 3 || parts.length === 4) && parts.every(part => /^[-+]?(?:\d*\.)?\d+%?$/.test(part))) {
          const clamp = value => Math.max(0, Math.min(1, value));
          parsed = parts.slice(0, 3).map(part => clamp(parseFloat(part) / (part.endsWith('%') ? 100 : 255)));
          parsed.push(parts.length === 4 ? clamp(parseFloat(parts[3]) / (parts[3].endsWith('%') ? 100 : 1)) : 1);
        }
      }
      if (parsed) {
        if (this.colors.size >= 128) this.colors.delete(this.colors.keys().next().value);
        this.colors.set(css, parsed);
        return parsed;
      }
      // CSS parsing uses the DOM, never a raster canvas or a frame upload.
      const doc = this.canvas.ownerDocument || root.document;
      const probe = doc.createElement('span');
      probe.style.color = css;
      if (!probe.style.color) throw new Error('Invalid CSS color: ' + css);
      probe.style.display = 'none';
      (doc.body || doc.documentElement).appendChild(probe);
      let value;
      try { value = doc.defaultView.getComputedStyle(probe).color; }
      finally { probe.remove(); }
      const channels = value.match(/[\d.]+/g);
      if (!/^rgba?\(/.test(value) || !channels) throw new Error('Unsupported CSS color space: ' + css);
      const color = [Number(channels[0]) / 255, Number(channels[1]) / 255, Number(channels[2]) / 255,
        channels.length > 3 ? Number(channels[3]) : 1];
      if (this.colors.size >= 128) this.colors.delete(this.colors.keys().next().value);
      this.colors.set(css, color);
      return color;
    }

    rect(x, y, w, h, color, alpha = 1) {
      if (this.active && !this.lost) this._draw(this.white, x, y, w, h, this._color(color), alpha, 1);
    }

    ellipse(x, y, rx, ry, color, alpha = 1, strokeWidth = 0, additive = false) {
      if (!this.active || this.lost || !(rx > 0 && ry > 0)) return;
      this._draw(this.white, x, y, rx * 2, ry * 2, this._color(color), alpha, 2,
        additive, 0, 0.5, 0.5, undefined, rx, ry, Math.max(0, strokeWidth));
    }

    glow(x, y, r, color, alpha = 1) {
      if (!this.active || this.lost || !(r > 0)) return;
      this._draw(this.white, x, y, r * 2, r * 2, this._color(color), alpha, 3, true, 0, 0.5, 0.5);
    }

    text(text, x, y, { size = 30, color = '#fff', alpha = 1, scale = 1, font = 'system-ui', stroke = 7 } = {}) {
      if (!this.active || this.lost || !(size > 0 && scale > 0 && alpha > 0) || !String(text)) return;
      text = String(text);
      stroke = Math.max(0, stroke);
      const key = JSON.stringify([text, size, color, font, stroke]);
      let entry = this.textures.get(key);
      if (entry) {
        this.textures.delete(key);
        this.textures.set(key, entry);
      } else {
        const doc = this.canvas.ownerDocument || root.document;
        const canvas = doc.createElement('canvas'); // Detached, text-only rasterization.
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.font = `900 ${size}px ${font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(text);
        const pad = Math.ceil(stroke / 2 + 2);
        const width = Math.max(1, Math.ceil(Math.max(metrics.width,
          2 * Math.abs(metrics.actualBoundingBoxLeft || 0),
          2 * Math.abs(metrics.actualBoundingBoxRight || 0))) + pad * 2);
        const height = Math.max(1, Math.ceil(Math.max(size * 2,
          2 * Math.abs(metrics.actualBoundingBoxAscent || 0),
          2 * Math.abs(metrics.actualBoundingBoxDescent || 0))) + pad * 2);
        const bytes = width * height * 4;
        // A hard byte bound also prevents one huge label from exhausting memory.
        if (width > this.maxTextureSize || height > this.maxTextureSize || bytes > 4 * 1024 * 1024) return;
        canvas.width = width;
        canvas.height = height;
        ctx.font = `900 ${size}px ${font}`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = stroke;
        ctx.strokeStyle = '#000';
        ctx.fillStyle = color;
        if (stroke) ctx.strokeText(text, width / 2, height / 2);
        ctx.fillText(text, width / 2, height / 2);
        while (this.textures.size >= 64 || this.textBytes + bytes > 4 * 1024 * 1024) {
          const oldest = this.textures.keys().next().value;
          const evicted = this.textures.get(oldest);
          this.gl.deleteTexture(evicted.texture);
          this.textBytes -= evicted.bytes;
          this.textures.delete(oldest);
        }
        entry = { texture: this._upload(canvas), width, height, bytes };
        this.textures.set(key, entry);
        this.textBytes += bytes;
      }
      this._draw(entry.texture, x - entry.width * scale / 2, y - entry.height * scale / 2,
        entry.width * scale, entry.height * scale, [1, 1, 1], alpha);
    }

    end() {
      if (this.active && !this.lost) this.gl.flush();
      this.active = false;
    }
  }

  root.CourtGL = CourtGL;
})(typeof globalThis !== 'undefined' ? globalThis : window);
