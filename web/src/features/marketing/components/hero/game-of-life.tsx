/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface GameOfLifeProps extends React.HTMLAttributes<HTMLDivElement> {
  cellSize?: number;
  cellSizeAlt?: number;
  gap?: number;
  tickMs?: number;
  maxOpacity?: number;
  borderRadius?: number;
  fadeInMs?: number;
}

const HUES: [number, number, number][] = [
  [42, 187, 248],
  [0, 247, 1],
  [255, 204, 2],
  [250, 78, 223],
];

const HUE_INTENSITIES = [1.0, 0.6, 0.4];

function createGrid(cols: number, rows: number, density: number): Uint8Array {
  const grid = new Uint8Array(cols * rows);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.random() < density ? 1 : 0;
  }
  return grid;
}

function stepGrid(grid: Uint8Array, cols: number, rows: number): Uint8Array {
  const next = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      let neighbors = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (x + dx + cols) % cols;
          const ny = (y + dy + rows) % rows;
          neighbors += grid[nx * rows + ny];
        }
      }
      const idx = x * rows + y;
      const alive = grid[idx];
      if (alive && (neighbors === 2 || neighbors === 3)) {
        next[idx] = 1;
      } else if (!alive && neighbors === 3) {
        next[idx] = 1;
      }
    }
  }
  return next;
}

function seedPatterns(grid: Uint8Array, cols: number, rows: number) {
  const place = (ox: number, oy: number, cells: [number, number][]) => {
    for (const [dx, dy] of cells) {
      const x = (ox + dx + cols) % cols;
      const y = (oy + dy + rows) % rows;
      grid[x * rows + y] = 1;
    }
  };

  const randX = () => Math.floor(Math.random() * cols);
  const randY = () => Math.floor(Math.random() * rows);

  const glider: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ];

  const rPentomino: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [2, 1],
  ];

  const gliderGun: [number, number][] = [
    [0, 4],
    [0, 5],
    [1, 4],
    [1, 5],
    [10, 4],
    [10, 5],
    [10, 6],
    [11, 3],
    [11, 7],
    [12, 2],
    [12, 8],
    [13, 2],
    [13, 8],
    [14, 5],
    [15, 3],
    [15, 7],
    [16, 4],
    [16, 5],
    [16, 6],
    [17, 5],
    [20, 2],
    [20, 3],
    [20, 4],
    [21, 2],
    [21, 3],
    [21, 4],
    [22, 1],
    [22, 5],
    [24, 0],
    [24, 1],
    [24, 5],
    [24, 6],
    [34, 2],
    [34, 3],
    [35, 2],
    [35, 3],
  ];

  const lwss: [number, number][] = [
    [0, 0],
    [0, 3],
    [1, 4],
    [2, 0],
    [2, 4],
    [3, 1],
    [3, 2],
    [3, 3],
    [3, 4],
  ];

  const pulsar: [number, number][] = [
    [2, 0],
    [3, 0],
    [4, 0],
    [8, 0],
    [9, 0],
    [10, 0],
    [0, 2],
    [0, 3],
    [0, 4],
    [5, 2],
    [5, 3],
    [5, 4],
    [7, 2],
    [7, 3],
    [7, 4],
    [12, 2],
    [12, 3],
    [12, 4],
    [2, 5],
    [3, 5],
    [4, 5],
    [8, 5],
    [9, 5],
    [10, 5],
    [2, 7],
    [3, 7],
    [4, 7],
    [8, 7],
    [9, 7],
    [10, 7],
    [0, 8],
    [0, 9],
    [0, 10],
    [5, 8],
    [5, 9],
    [5, 10],
    [7, 8],
    [7, 9],
    [7, 10],
    [12, 8],
    [12, 9],
    [12, 10],
    [2, 12],
    [3, 12],
    [4, 12],
    [8, 12],
    [9, 12],
    [10, 12],
  ];

  if (cols >= 40 && rows >= 20) {
    place(randX(), randY(), gliderGun);
  }
  if (cols >= 80 && rows >= 20) {
    place(randX(), randY(), gliderGun);
  }

  for (let i = 0; i < 3; i++) place(randX(), randY(), rPentomino);
  for (let i = 0; i < 4; i++) place(randX(), randY(), glider);
  for (let i = 0; i < 2; i++) place(randX(), randY(), lwss);

  if (cols >= 60 && rows >= 30) {
    place(randX(), randY(), pulsar);
  }
}

function buildColorMap(cols: number, rows: number): Uint8Array {
  const map = new Uint8Array(cols * rows);

  const anchors: [number, number][] = [
    [0.2, 0.25],
    [0.8, 0.25],
    [0.2, 0.75],
    [0.8, 0.75],
  ];

  const seeds: { x: number; y: number; hue: number }[] = anchors.map(([ax, ay], i) => ({
    x: (ax + (Math.random() - 0.5) * 0.15) * cols,
    y: (ay + (Math.random() - 0.5) * 0.15) * rows,
    hue: i,
  }));

  for (let i = 0; i < 4; i++) {
    seeds.push({
      x: (0.3 + Math.random() * 0.4) * cols,
      y: (0.2 + Math.random() * 0.6) * rows,
      hue: Math.floor(Math.random() * HUES.length),
    });
  }

  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      let minDist = Number.POSITIVE_INFINITY;
      let closest = 0;
      for (const seed of seeds) {
        const dx = x - seed.x;
        const dy = y - seed.y;
        const d = dx * dx + dy * dy;
        if (d < minDist) {
          minDist = d;
          closest = seed.hue;
        }
      }
      map[x * rows + y] = closest;
    }
  }

  return map;
}

function buildIntensityMap(cols: number, rows: number): Uint8Array {
  const map = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      map[x * rows + y] = Math.floor(Math.random() * HUE_INTENSITIES.length);
    }
  }
  return map;
}

function buildSizeMap(cols: number, rows: number): Uint8Array {
  const map = new Uint8Array(cols * rows);
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      map[x * rows + y] = (x + y) % 2 === 0 ? 0 : 1;
    }
  }
  return map;
}

const AFTERGLOW_TICKS = 4;

export function GameOfLife({
  cellSize = 8,
  cellSizeAlt = 6,
  gap = 4,
  tickMs = 200,
  maxOpacity = 0.35,
  borderRadius = 1.5,
  fadeInMs = 800,
  className,
  ...props
}: GameOfLifeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  const colorMapRef = useRef<Uint8Array | null>(null);
  const intensityMapRef = useRef<Uint8Array | null>(null);
  const sizeMapRef = useRef<Uint8Array | null>(null);
  const opacityRef = useRef<Float32Array | null>(null);
  const targetRef = useRef<Float32Array | null>(null);
  const afterglowRef = useRef<Uint8Array | null>(null);
  const mountTimeRef = useRef(0);
  const gridRef = useRef<Uint8Array | null>(null);
  const dimsRef = useRef<{ cols: number; rows: number; dpr: number }>({
    cols: 0,
    rows: 0,
    dpr: 1,
  });

  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement, width: number, height: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const step = cellSize + gap;
      const cols = Math.floor(width / step);
      const rows = Math.floor(height / step);

      const prevDims = dimsRef.current;
      const sizeChanged = cols !== prevDims.cols || rows !== prevDims.rows;

      if (sizeChanged || !gridRef.current) {
        const grid = createGrid(cols, rows, 0.08);
        seedPatterns(grid, cols, rows);
        gridRef.current = grid;

        const total = cols * rows;
        const colorMap = buildColorMap(cols, rows);
        const intensityMap = buildIntensityMap(cols, rows);
        const sizeMap = buildSizeMap(cols, rows);
        const opacity = new Float32Array(total);
        const target = new Float32Array(total);
        const afterglow = new Uint8Array(total);
        for (let i = 0; i < total; i++) {
          const intensity = HUE_INTENSITIES[intensityMap[i]];
          target[i] = grid[i] ? maxOpacity * intensity : 0;
          opacity[i] = 0;
        }
        colorMapRef.current = colorMap;
        intensityMapRef.current = intensityMap;
        sizeMapRef.current = sizeMap;
        opacityRef.current = opacity;
        targetRef.current = target;
        afterglowRef.current = afterglow;
      }

      dimsRef.current = { cols, rows, dpr };

      if (mountTimeRef.current === 0) {
        mountTimeRef.current = performance.now();
      }

      return { cols, rows, dpr };
    },
    [cellSize, gap, maxOpacity]
  );

  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvasW: number,
      canvasH: number,
      cols: number,
      rows: number,
      dpr: number,
      globalAlpha: number
    ) => {
      ctx.clearRect(0, 0, canvasW, canvasH);
      if (globalAlpha < 0.003) return;

      const step = (cellSize + gap) * dpr;
      const sizeA = cellSize * dpr;
      const sizeB = cellSizeAlt * dpr;
      const rA = borderRadius * dpr;
      const rB = ((borderRadius * cellSizeAlt) / cellSize) * dpr;
      const colorMap = colorMapRef.current;
      const intensityMap = intensityMapRef.current;
      const sizeMap = sizeMapRef.current;
      const opacityMap = opacityRef.current;
      if (!colorMap || !intensityMap || !sizeMap || !opacityMap) return;

      const offsetB = (sizeA - sizeB) * 0.5;

      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          const idx = x * rows + y;
          const op = opacityMap[idx] * globalAlpha;
          if (op < 0.003) continue;

          const hue = HUES[colorMap[idx]];
          const isAlt = sizeMap[idx] === 1;
          const size = isAlt ? sizeB : sizeA;
          const r = isAlt ? rB : rA;
          const off = isAlt ? offsetB : 0;

          ctx.fillStyle = `rgba(${hue[0]}, ${hue[1]}, ${hue[2]}, ${op})`;
          ctx.beginPath();
          ctx.roundRect(x * step + off, y * step + off, size, size, r);
          ctx.fill();
        }
      }
    },
    [cellSize, cellSizeAlt, gap, borderRadius]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;
    let tickTimer: ReturnType<typeof setTimeout>;

    const updateSize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      setupCanvas(canvas, w, h);
      const { cols, rows, dpr } = dimsRef.current;
      const elapsed = performance.now() - mountTimeRef.current;
      const globalAlpha = Math.min(1, elapsed / fadeInMs);
      drawGrid(ctx, canvas.width, canvas.height, cols, rows, dpr, globalAlpha);
    };

    updateSize();

    let lastFrame = 0;
    const interpolate = (time: number) => {
      if (!isInView) return;
      const dt = Math.min((time - lastFrame) / 1000, 0.05);
      lastFrame = time;

      const elapsed = time - mountTimeRef.current;
      const globalAlpha = Math.min(1, elapsed / fadeInMs);

      const opacity = opacityRef.current;
      const target = targetRef.current;
      if (!opacity || !target) return;

      let needsDraw = false;
      const lerpRate = 6 * dt;
      for (let i = 0; i < opacity.length; i++) {
        const diff = target[i] - opacity[i];
        if (Math.abs(diff) < 0.002) {
          if (opacity[i] !== target[i]) {
            opacity[i] = target[i];
            needsDraw = true;
          }
          continue;
        }
        opacity[i] += diff * lerpRate;
        needsDraw = true;
      }

      if (needsDraw || globalAlpha < 1) {
        const { cols, rows, dpr } = dimsRef.current;
        drawGrid(ctx, canvas.width, canvas.height, cols, rows, dpr, globalAlpha);
      }
      animFrameId = requestAnimationFrame(interpolate);
    };

    const tick = () => {
      if (!isInView) return;
      const grid = gridRef.current;
      const { cols, rows } = dimsRef.current;
      if (!grid) return;

      const prevGrid = new Uint8Array(grid);
      gridRef.current = stepGrid(grid, cols, rows);
      const nextGrid = gridRef.current;

      const alive = nextGrid.reduce((sum, v) => sum + v, 0);
      const total = cols * rows;
      if (alive < total * 0.01 || alive > total * 0.5) {
        const fresh = createGrid(cols, rows, 0.08);
        seedPatterns(fresh, cols, rows);
        gridRef.current = fresh;
      }

      const currentGrid = gridRef.current;
      const target = targetRef.current;
      const intensityMap = intensityMapRef.current;
      const afterglow = afterglowRef.current;
      if (target && intensityMap && afterglow) {
        for (let i = 0; i < target.length; i++) {
          const intensity = HUE_INTENSITIES[intensityMap[i]];
          if (currentGrid[i]) {
            target[i] = maxOpacity * intensity;
            afterglow[i] = 0;
          } else if (prevGrid[i] && !currentGrid[i]) {
            target[i] = maxOpacity * intensity * 0.4;
            afterglow[i] = AFTERGLOW_TICKS;
          } else if (afterglow[i] > 1) {
            afterglow[i]--;
            target[i] = maxOpacity * intensity * 0.4 * (afterglow[i] / AFTERGLOW_TICKS);
          } else {
            target[i] = 0;
            afterglow[i] = 0;
          }
        }
      }

      tickTimer = setTimeout(tick, tickMs);
    };

    if (isInView) {
      animFrameId = requestAnimationFrame(interpolate);
      tickTimer = setTimeout(tick, tickMs);
    }

    const ro = new ResizeObserver(() => updateSize());
    ro.observe(container);

    const io = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(animFrameId);
      clearTimeout(tickTimer);
      ro.disconnect();
      io.disconnect();
    };
  }, [setupCanvas, drawGrid, maxOpacity, fadeInMs, isInView, tickMs]);

  return (
    <div ref={containerRef} className={cn("h-full w-full", className)} {...props}>
      <canvas ref={canvasRef} className="pointer-events-none" />
    </div>
  );
}
