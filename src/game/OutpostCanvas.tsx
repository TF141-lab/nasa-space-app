import React, { useEffect, useRef } from 'react';
import { MISSION_SITES, SiteId, StationId, STATION_ACTIONS } from './rules';
import { soundFX } from './sound';

export interface StationNode {
  id: StationId;
  label: string;
  shortTag: string;
  keyHint: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accentColor: string;
}

export const OUTPOST_STATIONS: StationNode[] = [
  {
    id: 'solar_array',
    label: 'Solar & Kilopower Array',
    shortTag: '+32% PWR / -7% O2 / -5% SHD',
    keyHint: '1',
    x: 210,
    y: 195,
    width: 112,
    height: 82,
    accentColor: '#f59e0b',
  },
  {
    id: 'hydroponics_dome',
    label: 'Hydroponics & O2 Dome',
    shortTag: '+34% O2 / -11% PWR / +25 SCI',
    keyHint: '2',
    x: 740,
    y: 195,
    width: 116,
    height: 86,
    accentColor: '#10b981',
  },
  {
    id: 'hab_bunk',
    label: 'Central Habitat Bunk',
    shortTag: '+18% PWR · +16% O2 · -15 SCI',
    keyHint: '5',
    x: 475,
    y: 300,
    width: 120,
    height: 92,
    accentColor: '#38bdf8',
  },
  {
    id: 'rad_shield_core',
    label: 'Water-Wall Shield Core',
    shortTag: '+34% SHD / -10% PWR / -5% O2',
    keyHint: '3',
    x: 220,
    y: 430,
    width: 114,
    height: 84,
    accentColor: '#a855f7',
  },
  {
    id: 'rover_science_bay',
    label: 'OSDR Rover Science Lab',
    shortTag: '+95 SCI / -10% PWR / -9% O2',
    keyHint: '4',
    x: 735,
    y: 430,
    width: 118,
    height: 84,
    accentColor: '#f43f5e',
  },
];

interface OutpostCanvasProps {
  siteId: SiteId;
  gameMode: 'title' | 'playing' | 'paused' | 'gameover';
  sol: number;
  power: number;
  lifeSupport: number;
  shielding: number;
  actionsRemaining: number;
  activeStation: StationId | null;
  activeEventId?: string | null;
  onNearStationChange: (stationId: StationId | null) => void;
  onTriggerStationModal: (stationId: StationId) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

interface Footprint {
  x: number;
  y: number;
  alpha: number;
  side: number;
}

export const OutpostCanvas: React.FC<OutpostCanvasProps> = ({
  siteId,
  gameMode,
  sol,
  power,
  lifeSupport,
  shielding,
  actionsRemaining,
  activeEventId = null,
  onNearStationChange,
  onTriggerStationModal,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store latest props in ref so RAF never tears down or resets player position
  const propsRef = useRef({
    siteId,
    gameMode,
    sol,
    power,
    lifeSupport,
    shielding,
    actionsRemaining,
    activeEventId,
    onNearStationChange,
    onTriggerStationModal,
  });

  useEffect(() => {
    propsRef.current = {
      siteId,
      gameMode,
      sol,
      power,
      lifeSupport,
      shielding,
      actionsRemaining,
      activeEventId,
      onNearStationChange,
      onTriggerStationModal,
    };
  }, [
    siteId,
    gameMode,
    sol,
    power,
    lifeSupport,
    shielding,
    actionsRemaining,
    activeEventId,
    onNearStationChange,
    onTriggerStationModal,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const WORLD_W = 960;
    const WORLD_H = 560;

    let viewW = window.innerWidth || WORLD_W;
    let viewH = window.innerHeight || WORLD_H;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const targetEl = canvas.parentElement || canvas;
      const rect = targetEl.getBoundingClientRect();
      viewW = Math.max(1, rect.width || window.innerWidth || WORLD_W);
      viewH = Math.max(1, rect.height || window.innerHeight || WORLD_H);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextW = Math.round(viewW * dpr);
      const nextH = Math.round(viewH * dpr);
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
    };
    resize();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    if (resizeObserver && canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    window.addEventListener('resize', resize);

    // Player state spawned on open path facing clear walkway below Central Habitat
    const player = {
      x: 475,
      y: 390,
      targetX: null as number | null,
      targetY: null as number | null,
      vx: 0,
      vy: 0,
      speed: 195,
      facing: 'down' as 'up' | 'down' | 'left' | 'right',
      walkDist: 0,
      stepCooldown: 0,
      footprintAccum: 0,
      footprintSide: 1,
      scaleX: 1,
      scaleY: 1,
    };

    let camX = 0;
    const transformState = {
      scale: 1,
      baseOffsetX: 0,
      baseOffsetY: 0,
      camX: 0,
    };

    let currentNearStation: StationId | null = null;
    const keysPressed = new Set<string>();
    let interactJustPressed = false;

    const footprints: Footprint[] = [];

    // Pre-allocated particle ring buffer (zero GC inside RAF)
    const PARTICLE_COUNT = 55;
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: (i * 73) % WORLD_W,
      y: (i * 41) % WORLD_H,
      vx: 14 + (i % 5) * 6,
      vy: 4 + (i % 3) * 2,
      size: 3 + (i % 4) * 1.4,
      alpha: 0.22 + (i % 4) * 0.12,
      color: '#e2e8f0',
      life: (i * 0.3) % 4,
      maxLife: 4,
    }));

    // Normalized starfield across entire upper sky (top 92% of sky band)
    const stars = Array.from({ length: 96 }, (_, i) => ({
      u: ((i * 137.508) % 1000) / 1000,
      v: ((i * 73.13) % 900) / 1000,
      size: i % 5 === 0 ? 2.4 : i % 3 === 0 ? 1.7 : 1.2,
      twinkleOffset: i * 0.7,
    }));

    // Surface craters & scattered smooth rocks extending beyond 960x560 for seamless wide/tall viewports
    const craters = [
      { x: 110, y: 310, rx: 38, ry: 18 },
      { x: 860, y: 325, rx: 44, ry: 20 },
      { x: 480, y: 155, rx: 48, ry: 21 },
      { x: 350, y: 495, rx: 34, ry: 15 },
      { x: 625, y: 485, rx: 40, ry: 16 },
      { x: -130, y: 260, rx: 52, ry: 22 },
      { x: 1110, y: 245, rx: 56, ry: 23 },
      { x: -160, y: 465, rx: 42, ry: 17 },
      { x: 1130, y: 470, rx: 46, ry: 19 },
      { x: 460, y: 650, rx: 64, ry: 26 },
    ];

    const rocks = Array.from({ length: 48 }, (_, i) => {
      const rx = -380 + ((i * 193) % 1720);
      const ry = 135 + ((i * 127) % 690);
      const rad = 3 + (i % 5) * 2.2;
      return { x: rx, y: ry, r: rad, tilt: (i % 7) * 0.45 };
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (propsRef.current.activeEventId) {
        keysPressed.clear();
        return;
      }
      const key = e.key.toLowerCase();
      keysPressed.add(key);

      if (propsRef.current.gameMode === 'playing') {
        if (key === 'e' || key === ' ' || key === 'enter') {
          interactJustPressed = true;
        }
        // Direct station hotkeys 1-5 for accessibility & fast testing
        const stationByKey = OUTPOST_STATIONS.find((s) => s.keyHint === key);
        if (stationByKey) {
          player.targetX = stationByKey.x;
          player.targetY = stationByKey.y + 52;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase());
    };

    const onWindowBlur = () => {
      keysPressed.clear();
    };

    const handlePointerAt = (clientX: number, clientY: number) => {
      if (propsRef.current.gameMode !== 'playing') return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const worldX =
        (localX - transformState.baseOffsetX) / transformState.scale - transformState.camX;
      const worldY = (localY - transformState.baseOffsetY) / transformState.scale;

      // Check if user clicked directly on a station building
      for (const st of OUTPOST_STATIONS) {
        const dx = Math.abs(worldX - st.x);
        const dy = Math.abs(worldY - st.y);
        if (dx <= st.width * 0.65 && dy <= st.height * 0.75) {
          // Move astronaut to station door and open station panel
          player.targetX = st.x;
          player.targetY = st.y + 54;
          soundFX.playInteract();
          propsRef.current.onTriggerStationModal(st.id);
          return;
        }
      }

      // Otherwise set click-to-move target
      player.targetX = Math.max(60, Math.min(WORLD_W - 60, worldX));
      player.targetY = Math.max(135, Math.min(WORLD_H - 35, worldY));
    };

    const onPointerDown = (e: MouseEvent) => {
      handlePointerAt(e.clientX, e.clientY);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    canvas.addEventListener('mousedown', onPointerDown);

    let lastTime = performance.now();
    let animId = 0;

    // Helper: draw smooth rounded rectangle with gradient/solid fill & optional stroke
    const drawSmoothRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
      fill: string | CanvasGradient,
      stroke?: string,
      lineWidth = 1.5
    ) => {
      const rad = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.lineTo(x + w - rad, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
      ctx.lineTo(x + w, y + h - rad);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
      ctx.lineTo(x + rad, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
      ctx.lineTo(x, y + rad);
      ctx.quadraticCurveTo(x, y, x + rad, y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    };

    // Helper: draw 3 smooth parallax mountain layers anchored to horizonY
    const drawParallaxMountains = (
      horizonY: number,
      isMars: boolean,
      panPx: number
    ) => {
      const layers = isMars
        ? [
            {
              speed: 0.14,
              colorTop: '#7a3c35',
              colorBot: '#5e2b27',
              amp: 58,
              base: 10,
              freq: 0.0045,
              phase: 0.4,
            },
            {
              speed: 0.34,
              colorTop: '#692d1b',
              colorBot: '#4c1e12',
              amp: 42,
              base: 4,
              freq: 0.0075,
              phase: 1.9,
            },
            {
              speed: 0.58,
              colorTop: '#4e200d',
              colorBot: '#381507',
              amp: 28,
              base: 0,
              freq: 0.0115,
              phase: 3.1,
            },
          ]
        : [
            {
              speed: 0.14,
              colorTop: '#243247',
              colorBot: '#141e2e',
              amp: 56,
              base: 10,
              freq: 0.0048,
              phase: 0.8,
            },
            {
              speed: 0.34,
              colorTop: '#334155',
              colorBot: '#1e293b',
              amp: 40,
              base: 4,
              freq: 0.0082,
              phase: 2.3,
            },
            {
              speed: 0.58,
              colorTop: '#475569',
              colorBot: '#293548',
              amp: 26,
              base: 0,
              freq: 0.0125,
              phase: 4.1,
            },
          ];

      for (const layer of layers) {
        const shift = panPx * layer.speed;
        const grad = ctx.createLinearGradient(0, horizonY - layer.amp - 14, 0, horizonY + 4);
        grad.addColorStop(0, layer.colorTop);
        grad.addColorStop(1, layer.colorBot);
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.moveTo(-40, horizonY + 4);
        const step = 36;
        for (let sx = -40; sx <= viewW + 60; sx += step) {
          const wx = sx - shift;
          const h1 = Math.sin(wx * layer.freq + layer.phase) * 0.55;
          const h2 = Math.cos(wx * layer.freq * 2.15 + layer.phase * 1.4) * 0.3;
          const h3 = Math.sin(wx * layer.freq * 3.7 + 0.5) * 0.15;
          const ridgeH = Math.max(6, (0.5 + 0.5 * (h1 + h2 + h3)) * layer.amp + layer.base);
          ctx.lineTo(sx, horizonY - ridgeH);
        }
        ctx.lineTo(viewW + 60, horizonY + 4);
        ctx.closePath();
        ctx.fill();
      }
    };

    // Helper: draw sky gradient, stars, Earth (Moon) or Sun + Phobos/Deimos (Mars)
    const drawSky = (
      horizonY: number,
      isMars: boolean,
      curSol: number,
      tSec: number,
      panPx: number
    ) => {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY + 4);
      // Optional subtle day/sol warmth shift
      const solPhase = ((curSol - 1) % 4) / 3;
      if (isMars) {
        skyGrad.addColorStop(0, solPhase > 0.6 ? '#170d26' : '#1e102e');
        skyGrad.addColorStop(0.38, '#5a283c');
        skyGrad.addColorStop(0.75, '#ad4e32');
        skyGrad.addColorStop(1, '#e68c53');
      } else {
        skyGrad.addColorStop(0, '#02040a');
        skyGrad.addColorStop(0.55, '#070f24');
        skyGrad.addColorStop(1, '#10203d');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, viewW, horizonY + 4);

      // Twinkling stars
      for (let i = 0; i < stars.length; i++) {
        const st = stars[i];
        const sx = (st.u * viewW + panPx * 0.04 + viewW) % viewW;
        const sy = st.v * Math.max(40, horizonY - 12);
        const baseAlpha = isMars ? (sy < horizonY * 0.45 ? 0.35 : 0.08) : 0.55;
        const alpha = Math.max(0.05, baseAlpha + 0.4 * Math.sin(tSec * 2.2 + st.twinkleOffset));
        ctx.fillStyle = `rgba(248, 250, 252, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, st.size * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }

      const celestialX = viewW * 0.8 + panPx * 0.08;
      const celestialY = Math.max(44, horizonY * 0.42);

      if (!isMars) {
        // Large glowing Earth over Lunar South Pole
        const earthR = Math.max(22, Math.min(38, horizonY * 0.24));
        const halo = ctx.createRadialGradient(
          celestialX,
          celestialY,
          earthR * 0.7,
          celestialX,
          celestialY,
          earthR * 2.6
        );
        halo.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        halo.addColorStop(0.5, 'rgba(14, 165, 233, 0.12)');
        halo.addColorStop(1, 'rgba(14, 165, 233, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, earthR * 2.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, earthR, 0, Math.PI * 2);
        ctx.clip();

        const ocean = ctx.createRadialGradient(
          celestialX - earthR * 0.35,
          celestialY - earthR * 0.35,
          earthR * 0.2,
          celestialX,
          celestialY,
          earthR
        );
        ocean.addColorStop(0, '#38bdf8');
        ocean.addColorStop(0.65, '#0284c7');
        ocean.addColorStop(1, '#0c4a6e');
        ctx.fillStyle = ocean;
        ctx.fillRect(celestialX - earthR, celestialY - earthR, earthR * 2, earthR * 2);

        // Soft continents & cloud swirls
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(celestialX - earthR * 0.22, celestialY - earthR * 0.1, earthR * 0.34, earthR * 0.22, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(celestialX + earthR * 0.28, celestialY + earthR * 0.22, earthR * 0.24, earthR * 0.18, -0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.ellipse(celestialX - earthR * 0.1, celestialY - earthR * 0.36, earthR * 0.45, earthR * 0.12, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Martian soft Sun with cool bluish Martian halo + Phobos & Deimos
        const sunR = Math.max(15, Math.min(24, horizonY * 0.16));
        const sunHalo = ctx.createRadialGradient(
          celestialX,
          celestialY,
          sunR * 0.4,
          celestialX,
          celestialY,
          sunR * 4.5
        );
        sunHalo.addColorStop(0, 'rgba(255, 251, 235, 0.95)');
        sunHalo.addColorStop(0.25, 'rgba(186, 230, 253, 0.48)'); // Real Martian blue sunset/sun halo!
        sunHalo.addColorStop(0.58, 'rgba(251, 146, 60, 0.18)');
        sunHalo.addColorStop(1, 'rgba(251, 146, 60, 0)');
        ctx.fillStyle = sunHalo;
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, sunR * 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, sunR, 0, Math.PI * 2);
        ctx.fill();

        // Phobos & Deimos moons
        const phobosX = viewW * 0.24 + panPx * 0.06;
        const phobosY = Math.max(30, horizonY * 0.34);
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.ellipse(phobosX, phobosY, 6, 4.5, 0.2, 0, Math.PI * 2);
        ctx.fill();

        const deimosX = viewW * 0.56 + panPx * 0.05;
        const deimosY = Math.max(24, horizonY * 0.25);
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(deimosX, deimosY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    // Helper: draw smooth 2.5D station building with rounded silhouettes, gradients, cast shadow & ambient glow
    const drawStation25D = (st: StationNode, timeSec: number, isNear: boolean) => {
      const left = st.x - st.width / 2;
      const top = st.y - st.height / 2;

      // 1. Soft 2.5D elliptical ground shadow
      const shGrad = ctx.createRadialGradient(
        st.x + 8,
        st.y + st.height / 2 + 8,
        8,
        st.x + 8,
        st.y + st.height / 2 + 8,
        st.width * 0.65
      );
      shGrad.addColorStop(0, 'rgba(2, 6, 23, 0.52)');
      shGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = shGrad;
      ctx.beginPath();
      ctx.ellipse(st.x + 8, st.y + st.height / 2 + 8, st.width * 0.65, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ambient ground glow when nearby
      if (isNear) {
        const pulse = 0.55 + 0.35 * Math.sin(timeSec * 6);
        ctx.save();
        ctx.strokeStyle = st.accentColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = st.accentColor;
        ctx.shadowBlur = 14;
        drawSmoothRect(
          left - 8,
          top - 8,
          st.width + 16,
          st.height + 18,
          14,
          `rgba(56, 189, 248, ${(pulse * 0.14).toFixed(2)})`,
          st.accentColor,
          2.5
        );
        ctx.restore();
      }

      if (st.id === 'solar_array') {
        // Pedestal base
        const pedGrad = ctx.createLinearGradient(st.x - 18, st.y + 10, st.x + 18, st.y + 38);
        pedGrad.addColorStop(0, '#64748b');
        pedGrad.addColorStop(1, '#334155');
        drawSmoothRect(st.x - 18, st.y + 10, 36, 28, 7, pedGrad, '#0f172a', 1.5);

        // Angled smooth solar wings with glossy sheen
        for (const wingX of [left, st.x + 10]) {
          const panelGrad = ctx.createLinearGradient(wingX, top + 6, wingX + 46, top + 58);
          panelGrad.addColorStop(0, '#1d4ed8');
          panelGrad.addColorStop(0.5, '#1e3a8a');
          panelGrad.addColorStop(1, '#172554');
          drawSmoothRect(wingX, top + 6, 46, 52, 7, panelGrad, '#93c5fd', 1.8);

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.lineWidth = 1;
          for (let r = 1; r < 4; r++) {
            ctx.beginPath();
            ctx.moveTo(wingX + 3, top + 6 + r * 13);
            ctx.lineTo(wingX + 43, top + 6 + r * 13);
            ctx.stroke();
          }
          // Specular gloss streak
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(wingX + 5, top + 10, 10, 44);
        }

        // Central Kilopower Gold Core
        const coreGrad = ctx.createLinearGradient(st.x - 10, top + 14, st.x + 10, top + 50);
        coreGrad.addColorStop(0, '#fbbf24');
        coreGrad.addColorStop(1, '#d97706');
        drawSmoothRect(st.x - 10, top + 14, 20, 36, 6, coreGrad, '#0f172a', 1.5);
      } else if (st.id === 'hydroponics_dome') {
        // Rounded biodome base
        const baseGrad = ctx.createLinearGradient(left + 6, st.y, left + st.width - 6, st.y + 38);
        baseGrad.addColorStop(0, '#e2e8f0');
        baseGrad.addColorStop(1, '#94a3b8');
        drawSmoothRect(left + 6, st.y, st.width - 12, 38, 10, baseGrad, '#1e293b', 1.8);

        // Glass dome upper arch with radial emerald bio-glow
        const domeGrad = ctx.createRadialGradient(
          st.x - 12,
          st.y - 16,
          6,
          st.x,
          st.y,
          st.width * 0.45
        );
        domeGrad.addColorStop(0, 'rgba(52, 211, 153, 0.55)');
        domeGrad.addColorStop(1, 'rgba(6, 95, 70, 0.45)');
        ctx.fillStyle = domeGrad;
        ctx.beginPath();
        ctx.arc(st.x, st.y + 2, st.width * 0.44, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#d1fae5';
        ctx.stroke();

        // Smooth hydroponic crop pods
        for (let c = -2; c <= 2; c++) {
          drawSmoothRect(st.x + c * 15 - 5, st.y - 12, 10, 14, 4, '#10b981', '#065f46', 1.2);
          ctx.fillStyle = '#fb7185';
          ctx.beginPath();
          ctx.arc(st.x + c * 15, st.y - 15, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (st.id === 'rad_shield_core') {
        // Sintered regolith bunker + glowing water-wall columns
        const wallGrad = ctx.createLinearGradient(left + 4, top + 18, left + 4, top + 74);
        wallGrad.addColorStop(0, '#94a3b8');
        wallGrad.addColorStop(1, '#475569');
        drawSmoothRect(left + 4, top + 18, st.width - 8, 56, 10, wallGrad, '#0f172a', 1.8);
        drawSmoothRect(left + 10, top + 6, st.width - 20, 18, 8, '#cbd5e1', '#1e293b', 1.5);

        const tankGlow = 0.75 + 0.25 * Math.sin(timeSec * 3.2);
        const c1 = ctx.createLinearGradient(0, top + 26, 0, top + 62);
        c1.addColorStop(0, '#38bdf8');
        c1.addColorStop(1, '#0284c7');
        drawSmoothRect(left + 14, top + 26, 22, 36, 6, c1, '#bae6fd', 1.5);

        const c2 = ctx.createLinearGradient(0, top + 26, 0, top + 62);
        c2.addColorStop(0, `rgba(192, 132, 252, ${tankGlow})`);
        c2.addColorStop(1, '#7e22ce');
        drawSmoothRect(st.x - 11, top + 26, 22, 36, 6, c2, '#f3e8ff', 1.5);
        drawSmoothRect(st.x + 20, top + 26, 22, 36, 6, c1, '#bae6fd', 1.5);
      } else if (st.id === 'rover_science_bay') {
        // Lab module + parked 6-wheel NASA rover
        const labGrad = ctx.createLinearGradient(left + 4, top + 12, left + 4, top + 70);
        labGrad.addColorStop(0, '#f1f5f9');
        labGrad.addColorStop(1, '#94a3b8');
        drawSmoothRect(left + 4, top + 12, 68, 58, 10, labGrad, '#0f172a', 1.8);
        drawSmoothRect(left + 8, top + 4, 60, 14, 6, '#cbd5e1', '#1e293b', 1.5);
        drawSmoothRect(left + 16, top + 24, 44, 18, 6, '#0f172a', '#38bdf8', 1.5);

        // Animated telemetry screen pulse inside lab window
        const barW = 14 + Math.sin(timeSec * 4) * 10;
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(left + 21, top + 31, Math.max(6, barW), 4);

        // Smooth Rover
        drawSmoothRect(st.x + 14, st.y + 4, 38, 22, 6, '#f8fafc', '#0f172a', 1.5);
        drawSmoothRect(st.x + 22, st.y - 10, 12, 14, 4, '#f59e0b', '#78350f', 1.5);
        for (const wx of [st.x + 17, st.x + 33, st.x + 49]) {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(wx, st.y + 26, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Central Habitat Command Module (hab_bunk)
        const habGrad = ctx.createLinearGradient(left, top + 20, left, top + 80);
        habGrad.addColorStop(0, '#f8fafc');
        habGrad.addColorStop(1, '#94a3b8');
        drawSmoothRect(left, top + 20, st.width, 60, 12, habGrad, '#0f172a', 1.8);
        drawSmoothRect(left + 8, top + 4, st.width - 16, 22, 9, '#f8fafc', '#334155', 1.5);

        // NASA stripe & glowing airlock
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(left + 2, top + 30, st.width - 4, 7);
        drawSmoothRect(st.x - 14, top + 44, 28, 36, 7, '#334155', '#38bdf8', 1.8);

        // Warm illuminated habitat windows
        const winGrad = ctx.createLinearGradient(0, top + 46, 0, top + 62);
        winGrad.addColorStop(0, '#fef08a');
        winGrad.addColorStop(1, '#f59e0b');
        drawSmoothRect(left + 14, top + 46, 18, 16, 5, winGrad, '#78350f', 1.2);
        drawSmoothRect(st.x + 26, top + 46, 18, 16, 5, winGrad, '#78350f', 1.2);
      }

      // Floating Rounded Nameplate & Key Hint above building
      const tagW = 196;
      const tagH = 38;
      const tagX = st.x - tagW / 2;
      const tagY = top - 38;

      ctx.save();
      ctx.shadowColor = 'rgba(2, 6, 23, 0.55)';
      ctx.shadowBlur = 10;
      drawSmoothRect(
        tagX,
        tagY,
        tagW,
        tagH,
        10,
        isNear ? '#0f172a' : 'rgba(15, 23, 42, 0.94)',
        isNear ? st.accentColor : 'rgba(148, 163, 184, 0.5)',
        isNear ? 2 : 1.2
      );
      ctx.restore();

      ctx.font = 'bold 11px "Outfit", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(`[${st.keyHint}] ${st.label}`, st.x, tagY + 15);

      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = st.accentColor;
      ctx.fillText(st.shortTag, st.x, tagY + 29);
    };

    // Helper: smooth Junior Astronaut sprite with leg/arm swing, walk bob & soft shadow
    const drawAstronaut = (tSec: number) => {
      const moving =
        Math.abs(player.vx) > 2 || Math.abs(player.vy) > 2 || player.targetX !== null;
      const stride = Math.sin(player.walkDist * 0.22);
      const bob = moving ? Math.abs(Math.sin(player.walkDist * 0.22)) * -3.5 : Math.sin(tSec * 2.5) * 0.8;
      const px = player.x;
      const py = player.y + bob;

      // Soft ground shadow
      const shGrad = ctx.createRadialGradient(player.x, player.y + 18, 2, player.x, player.y + 18, 16);
      shGrad.addColorStop(0, 'rgba(2, 6, 23, 0.55)');
      shGrad.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = shGrad;
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + 18, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(player.scaleX, player.scaleY);

      // PLSS Life Support Backpack
      drawSmoothRect(-11, -12, 22, 18, 5, '#cbd5e1', '#334155', 1.5);

      // Swinging boots
      const leftFootY = 8 + (moving ? stride * 3.5 : 0);
      const rightFootY = 8 - (moving ? stride * 3.5 : 0);
      drawSmoothRect(-9, leftFootY, 8, 8, 3, '#334155', '#0f172a', 1.2);
      drawSmoothRect(1, rightFootY, 8, 8, 3, '#334155', '#0f172a', 1.2);

      // Swinging arms
      const armSwing = moving ? stride * 3 : 0;
      drawSmoothRect(-14, -7 - armSwing, 5, 13, 2.5, '#e2e8f0', '#334155', 1.2);
      drawSmoothRect(9, -7 + armSwing, 5, 13, 2.5, '#e2e8f0', '#334155', 1.2);

      // Pressurized White Suit Torso with NASA Orange Commander Stripe
      const suitGrad = ctx.createLinearGradient(-10, -8, 10, 10);
      suitGrad.addColorStop(0, '#ffffff');
      suitGrad.addColorStop(1, '#cbd5e1');
      drawSmoothRect(-10, -8, 20, 18, 5, suitGrad, '#1e293b', 1.5);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(-9.5, -2.5, 19, 3.8);

      // Rounded Helmet
      const helmGrad = ctx.createRadialGradient(-4, -22, 2, 0, -17, 15);
      helmGrad.addColorStop(0, '#ffffff');
      helmGrad.addColorStop(1, '#cbd5e1');
      drawSmoothRect(-13, -28, 26, 22, 10, helmGrad, '#1e293b', 1.6);

      // Gold Reflective Curved Visor
      let visorX = -9;
      if (player.facing === 'left') visorX = -11;
      if (player.facing === 'right') visorX = -7;
      const visorGrad = ctx.createLinearGradient(visorX, -24, visorX + 18, -11);
      visorGrad.addColorStop(0, '#fbbf24');
      visorGrad.addColorStop(0.55, '#d97706');
      visorGrad.addColorStop(1, '#78350f');
      drawSmoothRect(visorX, -24, 18, 13, 5, visorGrad, '#78350f', 1.4);

      // Specular visor shine
      ctx.fillStyle = 'rgba(254, 243, 199, 0.85)';
      ctx.beginPath();
      ctx.ellipse(visorX + 5, -20.5, 3, 1.8, -0.35, 0, Math.PI * 2);
      ctx.fill();

      // Helmet antenna with smooth glowing telemetry beacon
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(6, -35, 2.5, 7);
      const beaconOn = Math.sin(tSec * 7) > 0;
      ctx.fillStyle = beaconOn ? '#38bdf8' : '#0284c7';
      ctx.beginPath();
      ctx.arc(7.2, -36.5, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastTime = now;
      const tSec = now / 1000;

      const {
        siteId: curSiteId,
        gameMode: curMode,
        sol: curSol,
        power: curPower,
        shielding: curShielding,
      } = propsRef.current;
      const site = MISSION_SITES[curSiteId];
      const isMars = curSiteId === 'mars_jezero';

      // 1. Update simulation when in 'playing'
      if (curMode === 'playing') {
        let moveX = 0;
        let moveY = 0;
        if (keysPressed.has('w') || keysPressed.has('arrowup')) moveY -= 1;
        if (keysPressed.has('s') || keysPressed.has('arrowdown')) moveY += 1;
        if (keysPressed.has('a') || keysPressed.has('arrowleft')) moveX -= 1;
        if (keysPressed.has('d') || keysPressed.has('arrowright')) moveX += 1;

        if (moveX !== 0 || moveY !== 0) {
          player.targetX = null;
          player.targetY = null;
          const len = Math.hypot(moveX, moveY);
          moveX /= len;
          moveY /= len;
        } else if (player.targetX !== null && player.targetY !== null) {
          const dx = player.targetX - player.x;
          const dy = player.targetY - player.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 6) {
            moveX = dx / dist;
            moveY = dy / dist;
          } else {
            player.targetX = null;
            player.targetY = null;
          }
        }

        const stepDist = player.speed * dt;
        player.vx = moveX * player.speed;
        player.vy = moveY * player.speed;
        player.x = Math.max(55, Math.min(WORLD_W - 55, player.x + moveX * stepDist));
        player.y = Math.max(135, Math.min(WORLD_H - 35, player.y + moveY * stepDist));

        if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
          player.walkDist += stepDist;
          player.footprintAccum += stepDist;
          if (player.footprintAccum >= 22) {
            player.footprintAccum = 0;
            player.footprintSide *= -1;
            footprints.push({
              x: player.x + player.footprintSide * 4,
              y: player.y + 16,
              alpha: 0.42,
              side: player.footprintSide,
            });
            if (footprints.length > 26) footprints.shift();
          }

          player.stepCooldown -= dt;
          if (player.stepCooldown <= 0) {
            soundFX.playStep();
            player.stepCooldown = 0.28;
          }
          if (Math.abs(moveX) > Math.abs(moveY)) {
            player.facing = moveX < 0 ? 'left' : 'right';
          } else {
            player.facing = moveY < 0 ? 'up' : 'down';
          }
        }

        // Check proximity to any of the 5 stations
        let foundNear: StationId | null = null;
        let bestDist = 92;
        for (const st of OUTPOST_STATIONS) {
          const d = Math.hypot(player.x - st.x, player.y - (st.y + 32));
          if (d < bestDist) {
            bestDist = d;
            foundNear = st.id;
          }
        }

        if (foundNear !== currentNearStation) {
          currentNearStation = foundNear;
          propsRef.current.onNearStationChange(foundNear);
        }

        if (interactJustPressed && currentNearStation) {
          soundFX.playInteract();
          propsRef.current.onTriggerStationModal(currentNearStation);
        }
        interactJustPressed = false;
      }

      // Fade footprints smoothly
      for (let i = footprints.length - 1; i >= 0; i--) {
        footprints[i].alpha -= dt * 0.08;
        if (footprints[i].alpha <= 0) footprints.splice(i, 1);
      }

      // Smooth subtle camera pan following astronaut x (max ±34 world px so all 5 stations stay visible)
      const targetCamX = Math.max(-34, Math.min(34, (WORLD_W / 2 - player.x) * 0.08));
      camX += (targetCamX - camX) * Math.min(1, dt * 5);

      const scale = Math.min(viewW / WORLD_W, viewH / WORLD_H);
      const baseOffsetX = (viewW - WORLD_W * scale) / 2;
      const baseOffsetY = (viewH - WORLD_H * scale) / 2;

      transformState.scale = scale;
      transformState.baseOffsetX = baseOffsetX;
      transformState.baseOffsetY = baseOffsetY;
      transformState.camX = camX;

      const horizonScreenY = Math.max(84, 115 * scale + baseOffsetY);
      const panPx = camX * scale;

      // 2. Render Full-Screen Smooth World
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewW, viewH);

      // 2a. Screen-space Sky + Celestial Bodies + 3 Parallax Mountain Layers
      drawSky(horizonScreenY, isMars, curSol, tSec, panPx);
      drawParallaxMountains(horizonScreenY, isMars, panPx);

      // 2b. Full-Viewport Smooth Gradient Regolith Floor (no grid lines, no letterboxing)
      const groundGrad = ctx.createLinearGradient(0, horizonScreenY, 0, viewH);
      if (isMars) {
        groundGrad.addColorStop(0, '#9a3e10');
        groundGrad.addColorStop(0.42, '#b85016');
        groundGrad.addColorStop(1, '#6e270d');
      } else {
        groundGrad.addColorStop(0, '#475569');
        groundGrad.addColorStop(0.42, '#64748b');
        groundGrad.addColorStop(1, '#334155');
      }
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizonScreenY - 1, viewW, viewH - horizonScreenY + 2);

      // Soft horizon atmospheric rim glow
      const rimGrad = ctx.createLinearGradient(0, horizonScreenY - 6, 0, horizonScreenY + 34);
      rimGrad.addColorStop(
        0,
        isMars ? 'rgba(253, 186, 116, 0.25)' : 'rgba(148, 163, 184, 0.18)'
      );
      rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rimGrad;
      ctx.fillRect(0, horizonScreenY - 6, viewW, 40);

      // 2c. World-Space Playable Area & Extended Ground Details
      ctx.save();
      ctx.translate(baseOffsetX + camX * scale, baseOffsetY);
      ctx.scale(scale, scale);

      // Subtle regolith slope bands (soft natural terrain undulation, no tile grid)
      ctx.fillStyle = isMars ? 'rgba(124, 45, 18, 0.14)' : 'rgba(15, 23, 42, 0.12)';
      ctx.beginPath();
      ctx.ellipse(260, 260, 420, 75, -0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(720, 420, 460, 88, 0.05, 0, Math.PI * 2);
      ctx.fill();

      // Smooth Craters with inner radial shadow & sunlit rim highlight
      for (const c of craters) {
        const crGrad = ctx.createRadialGradient(
          c.x - c.rx * 0.2,
          c.y - c.ry * 0.25,
          c.rx * 0.1,
          c.x,
          c.y,
          c.rx
        );
        if (isMars) {
          crGrad.addColorStop(0, '#5c1f09');
          crGrad.addColorStop(0.75, '#7c2d12');
          crGrad.addColorStop(1, '#b45309');
        } else {
          crGrad.addColorStop(0, '#172033');
          crGrad.addColorStop(0.75, '#273449');
          crGrad.addColorStop(1, '#475569');
        }
        ctx.fillStyle = crGrad;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isMars ? 'rgba(253, 186, 116, 0.32)' : 'rgba(203, 213, 225, 0.26)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0.15, Math.PI - 0.15);
        ctx.stroke();
      }

      // Scattered smooth rocks with soft drop shadow
      for (const rk of rocks) {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.25)';
        ctx.beginPath();
        ctx.ellipse(rk.x + 2, rk.y + 2, rk.r * 1.15, rk.r * 0.65, rk.tilt, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isMars ? '#7c2d12' : '#475569';
        ctx.beginPath();
        ctx.ellipse(rk.x, rk.y, rk.r, rk.r * 0.68, rk.tilt, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fading astronaut boot footprints
      for (const fp of footprints) {
        ctx.fillStyle = isMars
          ? `rgba(69, 26, 3, ${fp.alpha.toFixed(2)})`
          : `rgba(15, 23, 42, ${fp.alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(fp.x, fp.y, 4, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Paved Glowing Pressurized Walkways / Power Conduit Paths connecting Central Bunk to 4 Perimeter Stations
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.lineWidth = 22;
      ctx.beginPath();
      OUTPOST_STATIONS.forEach((st) => {
        if (st.id !== 'hab_bunk') {
          ctx.moveTo(475, 325);
          ctx.lineTo(st.x, st.y + 25);
        }
      });
      ctx.stroke();

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 15;
      ctx.stroke();

      // Animated energy pulse lines along conduits
      ctx.strokeStyle = isMars ? '#fb923c' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = isMars ? '#fb923c' : '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -tSec * 30;
      ctx.beginPath();
      OUTPOST_STATIONS.forEach((st) => {
        if (st.id !== 'hab_bunk') {
          ctx.moveTo(475, 325);
          ctx.lineTo(st.x, st.y + 25);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Click target beacon if active
      if (player.targetX !== null && player.targetY !== null) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          player.targetX,
          player.targetY,
          8 + Math.sin(tSec * 10) * 3,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }

      // Y-Sort stations and player so astronaut can walk behind or in front of 2.5D modules!
      const renderables: Array<{ y: number; draw: () => void }> = [];
      for (const st of OUTPOST_STATIONS) {
        renderables.push({
          y: st.y + st.height / 2,
          draw: () => drawStation25D(st, tSec, currentNearStation === st.id),
        });
      }
      renderables.push({
        y: player.y + 16,
        draw: () => drawAstronaut(tSec),
      });

      renderables.sort((a, b) => a.y - b.y);
      for (const r of renderables) {
        r.draw();
      }

      // Update & draw pooled space weather / solar wind particles
      // Note: default idle dots NEVER draw on the ground (p.y >= 115) so no star-like dots appear on the floor!
      const curEventId = propsRef.current.activeEventId;
      const speedMult =
        curEventId === 'mars_global_dust_storm'
          ? 4.2
          : curEventId === 'lunar_electrostatic_dust'
          ? 2.6
          : 1;

      for (const p of particles) {
        p.x += p.vx * dt * speedMult;
        p.y += p.vy * dt * speedMult;
        if (p.x > WORLD_W) p.x = 0;
        if (p.y > WORLD_H) p.y = 115;

        const isDefaultIdleDot =
          curEventId !== 'mars_global_dust_storm' &&
          curEventId !== 'lunar_electrostatic_dust' &&
          curShielding >= 40;
        if (isDefaultIdleDot && p.y >= 115) continue;

        ctx.fillStyle =
          curEventId === 'mars_global_dust_storm'
            ? `rgba(234, 88, 12, ${Math.min(0.7, p.alpha * 1.6).toFixed(2)})`
            : curEventId === 'lunar_electrostatic_dust'
            ? `rgba(250, 204, 21, ${Math.min(0.75, p.alpha * 1.6).toFixed(2)})`
            : curShielding < 40
            ? `rgba(244, 63, 94, ${p.alpha.toFixed(2)})`
            : isMars
            ? `rgba(251, 146, 60, ${p.alpha.toFixed(2)})`
            : `rgba(148, 163, 184, ${p.alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Event-Specific Real-Time 2.5D Visual Animations on the Outpost Canvas
      if (curEventId) {
        ctx.save();
        if (curEventId === 'hab_oxygen_leakage') {
          const leakX = 475;
          const leakY = 318;
          for (let i = 0; i < 8; i++) {
            const prog = (tSec * 2.4 + i * 0.125) % 1;
            const jetX = leakX + Math.sin(tSec * 12 + i) * 18 * prog + 24 * prog;
            const jetY = leakY - 38 * prog;
            const radius = 4 + prog * 14;
            ctx.fillStyle = `rgba(186, 230, 253, ${(1 - prog) * 0.75})`;
            ctx.beginPath();
            ctx.arc(jetX, jetY, radius, 0, Math.PI * 2);
            ctx.fill();
          }
          if (Math.sin(tSec * 14) > 0) {
            drawSmoothRect(leakX - 44, leakY - 56, 88, 18, 5, '#ef4444');
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('O2 SEAL LEAK!', leakX, leakY - 43);
          }
        } else if (curEventId === 'lunar_electrostatic_dust') {
          ctx.strokeStyle = Math.sin(tSec * 20) > 0 ? '#38bdf8' : '#facc15';
          ctx.lineWidth = 2;
          for (let a = 0; a < 4; a++) {
            const sx = 170 + a * 26;
            const sy = 175 + ((a * 17) % 30);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.sin(tSec * 30 + a) * 14, sy - 16);
            ctx.lineTo(sx + Math.cos(tSec * 25 + a) * 18, sy - 30);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
          ctx.beginPath();
          ctx.ellipse(210, 210, 82 + Math.sin(tSec * 6) * 8, 38, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (curEventId === 'lunar_micrometeoroid_shower') {
          for (let m = 0; m < 6; m++) {
            const p = (tSec * 1.9 + m * 0.17) % 1;
            const mx = 140 + m * 135 - p * 90;
            const my = 20 + p * 390;
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(mx + 22, my - 34);
            ctx.stroke();
            if (p > 0.82) {
              ctx.fillStyle = '#f97316';
              ctx.beginPath();
              ctx.arc(mx, my, 7, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (curEventId === 'mars_global_dust_storm') {
          ctx.strokeStyle = 'rgba(253, 186, 116, 0.5)';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          for (let w = 0; w < 9; w++) {
            const wx = ((tSec * 420 + w * 130) % (WORLD_W + 120)) - 60;
            const wy = 150 + w * 42;
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx + 68, wy + 6);
            ctx.stroke();
          }
        } else if (curEventId === 'mars_co2_frost_vortex') {
          const vx = 580 + Math.sin(tSec * 1.8) * 95;
          const vy = 320 + Math.cos(tSec * 1.4) * 35;
          for (let r = 0; r < 6; r++) {
            ctx.strokeStyle = `rgba(125, 211, 252, ${0.75 - r * 0.1})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(
              vx + Math.sin(tSec * 10 + r) * 6,
              vy - r * 11,
              10 + r * 6,
              5 + r * 2,
              0,
              0,
              Math.PI * 2
            );
            ctx.stroke();
          }
          ctx.strokeStyle = '#bae6fd';
          ctx.lineWidth = 3;
          drawSmoothRect(740 - 58, 195 - 43, 116, 86, 14, 'rgba(186, 230, 253, 0.08)', '#bae6fd', 2.5);
        } else if (curEventId === 'donki_x2_flare' || curEventId === 'donki_gcr_spike') {
          ctx.strokeStyle = `rgba(192, 132, 252, ${0.45 + 0.3 * Math.sin(tSec * 8)})`;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(475, 310, 140 + Math.sin(tSec * 5) * 8, Math.PI, 0);
          ctx.stroke();
        } else {
          ctx.strokeStyle =
            curEventId === 'artemis_shadow_freeze'
              ? 'rgba(56, 189, 248, 0.65)'
              : 'rgba(16, 185, 129, 0.65)';
          ctx.lineWidth = 3;
          const pad = Math.sin(tSec * 6) * 6;
          drawSmoothRect(
            475 - 70 - pad,
            300 - 52 - pad,
            140 + pad * 2,
            104 + pad * 2,
            16,
            'rgba(0,0,0,0)',
            ctx.strokeStyle,
            3
          );
        }
        ctx.restore();
      }

      // Prompt bubble above astronaut when near a station
      if (currentNearStation && curMode === 'playing') {
        const stAction = STATION_ACTIONS[currentNearStation];
        const promptLabel = `Press [E] or Click: Inspect ${stAction.title}`;
        ctx.font = 'bold 11px "Outfit", sans-serif';
        const measuredW = ctx.measureText(promptLabel).width;
        const bubbleW = Math.max(260, Math.ceil(measuredW + 28));
        const bubbleH = 26;
        const bx = Math.max(12, Math.min(WORLD_W - bubbleW - 12, player.x - bubbleW / 2));
        const by = Math.max(120, player.y - 62);
        drawSmoothRect(bx, by, bubbleW, bubbleH, 9, '#f59e0b', '#0f172a', 2);
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText(promptLabel, bx + bubbleW / 2, by + 17);
      }

      ctx.restore();

      // 2d. Screen-Space Atmospheric Overlays (Dust Haze, Solar/Earth Light Flare, Vignette, Critical Alert Pulse)
      if (curEventId === 'mars_global_dust_storm') {
        ctx.fillStyle = `rgba(194, 65, 12, ${(0.2 + 0.07 * Math.sin(tSec * 4)).toFixed(2)})`;
        ctx.fillRect(0, 0, viewW, viewH);
      } else if (curEventId === 'donki_x2_flare' || curEventId === 'donki_gcr_spike') {
        const auroraAlpha = 0.22 + 0.12 * Math.sin(tSec * 7);
        ctx.fillStyle = `rgba(244, 63, 94, ${auroraAlpha.toFixed(2)})`;
        ctx.fillRect(0, 0, viewW, horizonScreenY);
      }

      // Gentle sun / Earth light flare
      const flareX = viewW * 0.8 + panPx * 0.08;
      const flareY = Math.max(44, horizonScreenY * 0.42);
      const flare = ctx.createRadialGradient(flareX, flareY, 8, flareX, flareY, Math.max(viewW, viewH) * 0.42);
      flare.addColorStop(
        0,
        isMars ? 'rgba(253, 186, 116, 0.14)' : 'rgba(56, 189, 248, 0.1)'
      );
      flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = flare;
      ctx.fillRect(0, 0, viewW, viewH);

      // Subtle cinematic edge vignette
      const vig = ctx.createRadialGradient(
        viewW / 2,
        viewH / 2,
        Math.min(viewW, viewH) * 0.34,
        viewW / 2,
        viewH / 2,
        Math.max(viewW, viewH) * 0.78
      );
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, 'rgba(2, 6, 23, 0.42)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, viewW, viewH);

      // Pulsing red danger vignette when shielding or power is critical (< 25%)
      if (curMode === 'playing' && (curShielding < 25 || curPower < 25)) {
        const dangerAlpha = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(tSec * 6));
        const warnVig = ctx.createRadialGradient(
          viewW / 2,
          viewH / 2,
          Math.min(viewW, viewH) * 0.3,
          viewW / 2,
          viewH / 2,
          Math.max(viewW, viewH) * 0.72
        );
        warnVig.addColorStop(0, 'rgba(244, 63, 94, 0)');
        warnVig.addColorStop(1, `rgba(244, 63, 94, ${dangerAlpha.toFixed(2)})`);
        ctx.fillStyle = warnVig;
        ctx.fillRect(0, 0, viewW, viewH);
      }

      // Smooth 60fps loop at display refresh rate
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      canvas.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={960}
      height={560}
      data-testid="outpost-canvas"
      className="block w-full h-full select-none cursor-pointer"
    />
  );
};
