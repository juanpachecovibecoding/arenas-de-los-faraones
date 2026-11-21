import * as THREE from 'three';

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

function createTiledTexture(canvas, repeatX = 1, repeatY = 1, isColor = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = 4;
  return tex;
}

export function createDesertTextures() {
  // 1. Sand ripples (color + bump)
  const sandColor = makeCanvas(512, 512);
  const sandBump = makeCanvas(512, 512);
  {
    const { ctx } = sandColor;
    const { ctx: bctx } = sandBump;

    ctx.fillStyle = '#d9b171';
    ctx.fillRect(0, 0, 512, 512);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, 512, 512);

    // Wind ripples
    for (let y = 0; y < 512; y += 2) {
      const wave = Math.sin((y / 512) * Math.PI * 22);
      const shade = Math.round(wave * 10);
      ctx.fillStyle = `rgb(${216 + shade}, ${175 + shade}, ${112 + Math.round(shade * 0.7)})`;
      ctx.fillRect(0, y, 512, 2);

      const bVal = Math.round(128 + wave * 42);
      bctx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      bctx.fillRect(0, y, 512, 2);
    }

    // Subtle curved ripple bands
    for (let i = 0; i < 42; i++) {
      const y = (i / 42) * 512;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(246, 217, 159, 0.25)' : 'rgba(166, 121, 64, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 32) {
        const dy = Math.sin((x / 512) * Math.PI * 2 + i * 0.7) * 5;
        if (x === 0) ctx.moveTo(x, y + dy);
        else ctx.lineTo(x, y + dy);
      }
      ctx.stroke();
    }

    // Sand grain speckles
    for (let i = 0; i < 6500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const bright = Math.random() > 0.5;
      ctx.fillStyle = bright ? 'rgba(255, 236, 188, 0.22)' : 'rgba(140, 98, 48, 0.22)';
      ctx.fillRect(x, y, 2, 2);

      const bv = bright ? 165 : 95;
      bctx.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
      bctx.fillRect(x, y, 2, 2);
    }
  }

  // 2. Pyramid limestone blocks
  const pyramidBlocks = makeCanvas(512, 512);
  const pyramidBump = makeCanvas(512, 512);
  {
    const { ctx } = pyramidBlocks;
    const { ctx: bctx } = pyramidBump;
    ctx.fillStyle = '#c8a46b';
    ctx.fillRect(0, 0, 512, 512);
    bctx.fillStyle = '#909090';
    bctx.fillRect(0, 0, 512, 512);

    const rows = 16;
    const rowH = 512 / rows;
    for (let r = 0; r < rows; r++) {
      const cols = 8;
      const colW = 512 / cols;
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;
        const jitter = (Math.random() - 0.5) * 26;
        const R = Math.min(240, Math.max(155, Math.round(206 + jitter)));
        const G = Math.min(210, Math.max(128, Math.round(170 + jitter * 0.85)));
        const B = Math.min(155, Math.max(85, Math.round(112 + jitter * 0.65)));

        ctx.fillStyle = `rgb(${R},${G},${B})`;
        ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

        // Weathered top highlight
        ctx.fillStyle = 'rgba(255, 240, 200, 0.14)';
        ctx.fillRect(x + 2, y + 2, colW - 4, 4);

        // Mortar line
        ctx.strokeStyle = 'rgba(98, 72, 40, 0.65)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, colW - 2, rowH - 2);

        bctx.fillStyle = `rgb(${155 + Math.round(jitter * 0.5)},${155 + Math.round(jitter * 0.5)},${155 + Math.round(jitter * 0.5)})`;
        bctx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);
        bctx.strokeStyle = '#303030';
        bctx.lineWidth = 3;
        bctx.strokeRect(x + 1, y + 1, colW - 2, rowH - 2);
      }
    }

    // Fine stone erosion speckles
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(90,65,35,0.16)' : 'rgba(255,235,190,0.15)';
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // 3. Desert rock sandstone
  const rockCanvas = makeCanvas(256, 256);
  {
    const { ctx } = rockCanvas;
    ctx.fillStyle = '#9c7850';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 32; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(130, 96, 58, 0.35)' : 'rgba(196, 154, 102, 0.28)';
      ctx.fillRect(0, (i / 32) * 256, 256, 6 + Math.random() * 6);
    }
    for (let i = 0; i < 2500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(58, 41, 24, 0.25)' : 'rgba(225, 188, 134, 0.22)';
      ctx.fillRect(x, y, 3, 2);
    }
  }

  // 4. Obelisk / Hieroglyph carved sandstone
  const hieroCanvas = makeCanvas(256, 512);
  {
    const { ctx } = hieroCanvas;
    ctx.fillStyle = '#c9a268';
    ctx.fillRect(0, 0, 256, 512);

    // Vertical column borders
    ctx.strokeStyle = 'rgba(102, 72, 36, 0.7)';
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 16, 220, 480);

    // Stylized carved Egyptian motifs (ankh, eye, sun disc, waves)
    ctx.strokeStyle = 'rgba(84, 56, 26, 0.78)';
    ctx.fillStyle = 'rgba(176, 128, 52, 0.5)';
    ctx.lineWidth = 3;

    for (let row = 0; row < 8; row++) {
      const cy = 54 + row * 56;
      const cx = 128;
      if (row % 4 === 0) {
        // Sun disc + wings
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 56, cy);
        ctx.lineTo(cx - 16, cy - 6);
        ctx.lineTo(cx - 16, cy + 6);
        ctx.closePath();
        ctx.moveTo(cx + 56, cy);
        ctx.lineTo(cx + 16, cy - 6);
        ctx.lineTo(cx + 16, cy + 6);
        ctx.closePath();
        ctx.stroke();
      } else if (row % 4 === 1) {
        // Ankh
        ctx.beginPath();
        ctx.ellipse(cx, cy - 10, 8, 11, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + 1);
        ctx.lineTo(cx, cy + 20);
        ctx.moveTo(cx - 14, cy + 7);
        ctx.lineTo(cx + 14, cy + 7);
        ctx.stroke();
      } else if (row % 4 === 2) {
        // Water zigzag lines
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          for (let x = 58; x <= 198; x += 14) {
            const yy = cy + k * 10 + ((x / 14) % 2 === 0 ? -3 : 3);
            if (x === 58) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
      } else {
        // Cartouche oval
        ctx.beginPath();
        ctx.roundRect(cx - 38, cy - 14, 76, 28, 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx - 14, cy, 5, 0, Math.PI * 2);
        ctx.arc(cx + 14, cy, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // 5. Snake scale pattern
  const snakeCanvas = makeCanvas(256, 256);
  {
    const { ctx } = snakeCanvas;
    ctx.fillStyle = '#3f5228';
    ctx.fillRect(0, 0, 256, 256);

    // Diamond viper bands
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = '#253016';
      ctx.beginPath();
      ctx.moveTo(128, y);
      ctx.lineTo(220, y + 16);
      ctx.lineTo(128, y + 32);
      ctx.lineTo(36, y + 16);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#c9a64a';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Scales dots
    for (let y = 0; y < 256; y += 10) {
      for (let x = 0; x < 256; x += 12) {
        ctx.fillStyle = 'rgba(255, 240, 175, 0.12)';
        ctx.beginPath();
        ctx.arc(x + ((y / 10) % 2) * 6, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return {
    sandMap: createTiledTexture(sandColor.canvas, 46, 46, true),
    sandBump: createTiledTexture(sandBump.canvas, 46, 46, false),
    pyramidMap: createTiledTexture(pyramidBlocks.canvas, 6, 6, true),
    pyramidBump: createTiledTexture(pyramidBump.canvas, 6, 6, false),
    rockMap: createTiledTexture(rockCanvas.canvas, 2, 2, true),
    hieroMap: createTiledTexture(hieroCanvas.canvas, 1, 1, true),
    snakeMap: createTiledTexture(snakeCanvas.canvas, 2, 2, true),
  };
}
