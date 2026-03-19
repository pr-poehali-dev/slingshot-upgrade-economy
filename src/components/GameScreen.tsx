import { useState, useRef, useEffect, useCallback } from "react";

const BALL_COLORS = [
  { id: "fire",   color: "#FF4500", glow: "#FF6B35", label: "🔥" },
  { id: "ice",    color: "#00B4D8", glow: "#4CC9F0", label: "💧" },
  { id: "arcane", color: "#9B5DE5", glow: "#C77DFF", label: "⚡" },
  { id: "nature", color: "#2DC653", glow: "#5CE877", label: "🌿" },
  { id: "gold",   color: "#D4AF37", glow: "#FFD700", label: "✨" },
];

const BALL_RADIUS = 20;
const COLS = 9;
const ROWS_VISIBLE = 9;
const BALL_SPEED = 13;
const STEP_X = BALL_RADIUS * 2 + 3;
const STEP_Y = BALL_RADIUS * 2 + 2;
const GRID_TOP = 56; // px from top of field

// Modifier types
type ModifierType = "mine" | "armored" | "acid" | "vortex_target";

type Ball = {
  id: number;
  colorIdx: number;
  row: number;
  col: number;
  alive: boolean;
  modifier?: ModifierType;
  armorHits?: number;   // armored: hits needed (2)
  acidTimer?: number;   // acid: shrink neighbors over time
  shrunken?: boolean;   // shrunken by acid
};

type FlyingBall = {
  x: number; y: number;
  vx: number; vy: number;
  colorIdx: number;
};

type Particle = {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  life: number;
  colorIdx: number;
  size: number;
};

// Active modifier state
type ActiveModifier =
  | { type: "fog" }
  | { type: "mirrored_walls" }
  | { type: "mines" }
  | { type: "accelerator"; nextTick: number }
  | { type: "armored" }
  | { type: "vortex"; nextSwap: number }
  | { type: "side_gravity"; dir: "left" | "right" }
  | { type: "jammer"; until: number }
  | { type: "doppelganger" }
  | { type: "acid" };

let ballId = 1000;
let partId = 0;

function getBallCenter(row: number, col: number, fieldW: number, rowOffset = 0) {
  const totalW = COLS * STEP_X - 3;
  const startX = (fieldW - totalW) / 2;
  const hexOffset = row % 2 === 1 ? BALL_RADIUS + 1.5 : 0;
  const x = startX + hexOffset + col * STEP_X + BALL_RADIUS;
  const y = GRID_TOP + (row + rowOffset) * STEP_Y + BALL_RADIUS;
  return { x, y };
}

function getNeighbors(row: number, col: number) {
  const isOdd = row % 2 === 1;
  const dirs = isOdd
    ? [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]]
    : [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];
  return dirs
    .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
    .filter(n => n.row >= 0 && n.col >= 0 && n.col < COLS);
}

function createGrid(rows: number, modifiers: ActiveModifier[]): Ball[] {
  const hasMines    = modifiers.some(m => m.type === "mines");
  const hasArmored  = modifiers.some(m => m.type === "armored");
  const hasAcid     = modifiers.some(m => m.type === "acid");
  const balls: Ball[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (Math.random() < 0.88) {
        const b: Ball = {
          id: ballId++,
          colorIdx: Math.floor(Math.random() * BALL_COLORS.length),
          row: r, col: c, alive: true,
        };
        const rng = Math.random();
        if (hasMines   && rng < 0.10) b.modifier = "mine";
        else if (hasArmored && rng < 0.18) { b.modifier = "armored"; b.armorHits = 2; }
        else if (hasAcid    && rng < 0.12) b.modifier = "acid";
        balls.push(b);
      }
    }
  }
  return balls;
}

function pickModifiers(): ActiveModifier[] {
  const all: ActiveModifier[] = [
    { type: "fog" },
    { type: "mirrored_walls" },
    { type: "mines" },
    { type: "accelerator", nextTick: Date.now() + 10000 },
    { type: "armored" },
    { type: "vortex", nextSwap: Date.now() + 5000 },
    { type: "side_gravity", dir: Math.random() < 0.5 ? "left" : "right" },
    { type: "jammer", until: 0 },
    { type: "doppelganger" },
    { type: "acid" },
  ];
  // Pick 2-3 random
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
}

function bfsConnected(startRow: number, startCol: number, colorIdx: number, balls: Ball[]): Ball[] {
  const map = new Map<string, Ball>();
  for (const b of balls) if (b.alive) map.set(`${b.row}-${b.col}`, b);
  const visited = new Set<string>();
  const queue = [{ row: startRow, col: startCol }];
  const group: Ball[] = [];
  while (queue.length) {
    const { row, col } = queue.shift()!;
    const key = `${row}-${col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const ball = map.get(key);
    if (!ball || !ball.alive || ball.colorIdx !== colorIdx) continue;
    group.push(ball);
    for (const n of getNeighbors(row, col)) {
      if (!visited.has(`${n.row}-${n.col}`)) queue.push(n);
    }
  }
  return group;
}

function findFloating(balls: Ball[]): Ball[] {
  const map = new Map<string, Ball>();
  for (const b of balls) if (b.alive) map.set(`${b.row}-${b.col}`, b);
  const anchored = new Set<string>();
  const queue = balls.filter(b => b.alive && b.row === 0).map(b => ({ row: b.row, col: b.col }));
  for (const item of queue) anchored.add(`${item.row}-${item.col}`);
  while (queue.length) {
    const { row, col } = queue.shift()!;
    for (const n of getNeighbors(row, col)) {
      const key = `${n.row}-${n.col}`;
      if (!anchored.has(key) && map.has(key)) {
        anchored.add(key);
        queue.push(n);
      }
    }
  }
  return balls.filter(b => b.alive && !anchored.has(`${b.row}-${b.col}`));
}

// Compute aim line with ricochet
function computeAimLine(
  startX: number, startY: number,
  angle: number, fieldW: number,
  mirroredWalls: boolean
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  let x = startX, y = startY;
  let vx = Math.cos(angle) * 10;
  let vy = Math.sin(angle) * 10;
  let steps = 0;
  while (y > GRID_TOP && steps < 120) {
    pts.push({ x, y });
    x += vx; y += vy;
    if (x - BALL_RADIUS < 0) {
      x = BALL_RADIUS;
      if (mirroredWalls) {
        const deflect = (Math.random() - 0.5) * 0.5;
        vx = Math.abs(vx) * Math.cos(deflect) - Math.abs(vy) * Math.sin(deflect);
        vy = vy + deflect;
      } else {
        vx = Math.abs(vx);
      }
    }
    if (x + BALL_RADIUS > fieldW) {
      x = fieldW - BALL_RADIUS;
      if (mirroredWalls) {
        const deflect = (Math.random() - 0.5) * 0.5;
        vx = -Math.abs(vx) * Math.cos(deflect) + Math.abs(vy) * Math.sin(deflect);
        vy = vy + deflect;
      } else {
        vx = -Math.abs(vx);
      }
    }
    steps++;
  }
  return pts;
}

type GameScreenProps = {
  onBack: () => void;
  levelName: string;
  levelNum: number;
};

export default function GameScreen({ onBack, levelName, levelNum }: GameScreenProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [fieldSize, setFieldSize] = useState({ w: 360, h: 560 });
  const [modifiers] = useState<ActiveModifier[]>(() => pickModifiers());
  const [balls, setBalls] = useState<Ball[]>(() => createGrid(7, []));
  const [rowOffset, setRowOffset] = useState(0); // fractional descent
  const [flyingBall, setFlyingBall] = useState<FlyingBall | null>(null);
  const [queue, setQueue] = useState<number[]>(() =>
    Array.from({ length: 4 }, () => Math.floor(Math.random() * BALL_COLORS.length))
  );
  const [aimAngle, setAimAngle] = useState<number | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [hp, setHp] = useState(5);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [showCombo, setShowCombo] = useState<string | null>(null);
  const [fogReveal, setFogReveal] = useState<{ x: number; y: number } | null>(null);
  const [jammerActive, setJammerActive] = useState(false);
  const [lastShotPos, setLastShotPos] = useState<{ x: number; y: number } | null>(null);
  const [sideGravityDir] = useState<"left" | "right">(() =>
    modifiers.find(m => m.type === "side_gravity") ? (modifiers.find(m => m.type === "side_gravity") as { type: "side_gravity"; dir: "left" | "right" }).dir : "left"
  );

  const flyingRef = useRef<FlyingBall | null>(null);
  const ballsRef = useRef<Ball[]>(balls);
  const rowOffsetRef = useRef(0);
  const animRef = useRef<number>();
  const modifiersRef = useRef(modifiers);

  useEffect(() => { ballsRef.current = balls; }, [balls]);
  useEffect(() => { flyingRef.current = flyingBall; }, [flyingBall]);
  useEffect(() => { rowOffsetRef.current = rowOffset; }, [rowOffset]);

  const hasMod = useCallback((type: string) => modifiersRef.current.some(m => m.type === type), []);

  useEffect(() => {
    const update = () => {
      if (fieldRef.current) {
        setFieldSize({ w: fieldRef.current.clientWidth, h: fieldRef.current.clientHeight });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Accelerator: push row down every 10s
  useEffect(() => {
    if (!hasMod("accelerator")) return;
    const interval = setInterval(() => {
      setRowOffset(prev => {
        const next = prev + 0.5;
        if (next >= 1) {
          // Shift all balls down by 1 logical row
          setBalls(bs => bs.map(b => ({ ...b, row: b.row + 1 })));
          return next - 1;
        }
        return next;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [hasMod]);

  // Vortex: swap 2 random balls every 5s
  useEffect(() => {
    if (!hasMod("vortex")) return;
    const interval = setInterval(() => {
      setBalls(bs => {
        const alive = bs.filter(b => b.alive);
        if (alive.length < 2) return bs;
        const i1 = Math.floor(Math.random() * alive.length);
        let i2 = Math.floor(Math.random() * alive.length);
        while (i2 === i1) i2 = Math.floor(Math.random() * alive.length);
        const a = alive[i1], b2 = alive[i2];
        return bs.map(b => {
          if (b.id === a.id) return { ...b, colorIdx: b2.colorIdx, modifier: b2.modifier };
          if (b.id === b2.id) return { ...b, colorIdx: a.colorIdx, modifier: a.modifier };
          return b;
        });
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [hasMod]);

  // Acid: shrink neighbors every 3s
  useEffect(() => {
    if (!hasMod("acid")) return;
    const interval = setInterval(() => {
      setBalls(bs => {
        const acidBalls = bs.filter(b => b.alive && b.modifier === "acid");
        const toShrink = new Set<number>();
        for (const ab of acidBalls) {
          for (const n of getNeighbors(ab.row, ab.col)) {
            const neighbor = bs.find(b => b.alive && b.row === n.row && b.col === n.col && b.modifier !== "acid");
            if (neighbor) toShrink.add(neighbor.id);
          }
        }
        return bs.map(b => toShrink.has(b.id) ? { ...b, shrunken: true } : b);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [hasMod]);

  const spawnParticles = useCallback((x: number, y: number, colorIdx: number, count = 10) => {
    setParticles(prev => [
      ...prev,
      ...Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3;
        return {
          id: partId++, x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          colorIdx,
          size: 3 + Math.random() * 5,
        };
      }),
    ]);
  }, []);

  const snapAndExplode = useCallback((fb: FlyingBall, currentBalls: Ball[], currentHp: number) => {
    const { w } = fieldSize;
    const currentRowOffset = rowOffsetRef.current;
    const occupied = new Set(currentBalls.filter(b => b.alive).map(b => `${b.row}-${b.col}`));

    // Candidates: neighbors of existing + top row
    const candidates = new Set<string>();
    for (let c = 0; c < COLS; c++) candidates.add(`0-${c}`);
    for (const b of currentBalls) {
      if (!b.alive) continue;
      for (const n of getNeighbors(b.row, b.col)) {
        const key = `${n.row}-${n.col}`;
        if (!occupied.has(key) && n.row >= 0) candidates.add(key);
      }
    }

    let bestRow = -1, bestCol = -1, bestDist = Infinity;
    for (const key of candidates) {
      const [r, c] = key.split("-").map(Number);
      if (occupied.has(key)) continue;
      const { x, y } = getBallCenter(r, c, w, currentRowOffset);
      const dist = Math.hypot(x - fb.x, y - fb.y);
      if (dist < bestDist) { bestDist = dist; bestRow = r; bestCol = c; }
    }
    if (bestRow < 0) return { balls: currentBalls, hp: currentHp, boom: false };

    // Check armored: first hit removes armor
    const hitTarget = currentBalls.find(b => b.alive && b.row === bestRow && b.col === bestCol);
    if (hitTarget?.modifier === "armored" && (hitTarget.armorHits ?? 0) > 1) {
      const updated = currentBalls.map(b =>
        b.id === hitTarget.id ? { ...b, armorHits: (b.armorHits ?? 2) - 1 } : b
      );
      return { balls: updated, hp: currentHp, boom: false };
    }

    const newBall: Ball = { id: ballId++, colorIdx: fb.colorIdx, row: bestRow, col: bestCol, alive: true };
    let updated = [...currentBalls, newBall];

    // Check mine hit
    const mineBall = currentBalls.find(b => b.alive && b.row === bestRow && b.col === bestCol && b.modifier === "mine");
    let newHp = currentHp;
    if (mineBall) {
      newHp = Math.max(0, currentHp - 1);
      spawnParticles(fb.x, fb.y, 0, 15);
    }

    // BFS group
    const group = bfsConnected(bestRow, bestCol, fb.colorIdx, updated);
    let comboCount = 0;
    if (group.length >= 3) {
      comboCount = group.length;
      const groupIds = new Set(group.map(b => b.id));
      updated = updated.map(b => groupIds.has(b.id) ? { ...b, alive: false } : b);
      for (const b of group) {
        const { x, y } = getBallCenter(b.row, b.col, w, currentRowOffset);
        spawnParticles(x, y, b.colorIdx, 8);
      }

      // Fog reveal: last shot position
      if (hasMod("fog")) {
        const { x, y } = getBallCenter(bestRow, bestCol, w, currentRowOffset);
        setFogReveal({ x, y });
      }
    }

    // Side gravity for floating: fall left/right instead of straight down (visual only — just drop them)
    const floating = findFloating(updated);
    if (floating.length > 0) {
      const floatIds = new Set(floating.map(b => b.id));
      for (const b of floating) {
        const { x, y } = getBallCenter(b.row, b.col, w, currentRowOffset);
        spawnParticles(x, y, b.colorIdx, 5);
      }
      comboCount += floating.length;
      updated = updated.map(b => floatIds.has(b.id) ? { ...b, alive: false } : b);
    }

    if (comboCount >= 3) {
      setScore(prev => prev + comboCount * 10 * (comboCount >= 6 ? 2 : 1));
      setShowCombo(
        comboCount >= 10 ? "🌟 МЕГА ВЗРЫВ!" :
        comboCount >= 6  ? `💥 COMBO ×${comboCount}` :
                           `✦ ВЗРЫВ ×${comboCount}`
      );
      setTimeout(() => setShowCombo(null), 1200);
    }

    // Doppelganger: add random ball to queue
    if (hasMod("doppelganger")) {
      setQueue(q => [...q, Math.floor(Math.random() * BALL_COLORS.length)]);
    }

    return { balls: updated, hp: newHp, boom: comboCount >= 3 };
  }, [fieldSize, hasMod, spawnParticles]);

  // Animation loop
  useEffect(() => {
    let lastTime = 0;
    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 16, 3);
      lastTime = time;

      setFlyingBall(prev => {
        if (!prev) return null;
        const { w } = fieldSize;
        const { colorIdx } = prev;
        let { x, y, vx, vy } = prev;
        x += vx * dt; y += vy * dt;

        // Mirrored walls: random deflection on bounce
        const isMirrored = hasMod("mirrored_walls");
        if (x - BALL_RADIUS < 0) {
          x = BALL_RADIUS;
          if (isMirrored) {
            const d = (Math.random() - 0.5) * 0.6;
            vx = Math.abs(vx); vy += d;
          } else vx = Math.abs(vx);
        }
        if (x + BALL_RADIUS > w) {
          x = w - BALL_RADIUS;
          if (isMirrored) {
            const d = (Math.random() - 0.5) * 0.6;
            vx = -Math.abs(vx); vy += d;
          } else vx = -Math.abs(vx);
        }

        const currentBalls = ballsRef.current;
        const currentRowOffset = rowOffsetRef.current;
        let hitBall: Ball | null = null;
        for (const b of currentBalls) {
          if (!b.alive) continue;
          const { x: bx, y: by } = getBallCenter(b.row, b.col, w, currentRowOffset);
          if (Math.hypot(x - bx, y - by) < BALL_RADIUS * 2 + 2) { hitBall = b; break; }
        }

        const hitCeiling = y - BALL_RADIUS < GRID_TOP + BALL_RADIUS;

        if (hitBall || hitCeiling) {
          setHp(currentHp => {
            const { balls: newBalls, hp: newHp } = snapAndExplode({ x, y, vx, vy, colorIdx }, currentBalls, currentHp);
            setBalls(newBalls);

            const alive = newBalls.filter(b => b.alive);
            if (alive.length === 0) setWin(true);
            if (newHp <= 0) setGameOver(true);
            for (const b of alive) {
              if (b.row + currentRowOffset >= ROWS_VISIBLE) { setGameOver(true); break; }
            }
            return newHp;
          });

          setShots(s => s + 1);
          setQueue(q => {
            const [, ...rest] = q;
            return [...rest, Math.floor(Math.random() * BALL_COLORS.length)];
          });
          // Jammer activation random
          if (hasMod("jammer") && Math.random() < 0.15 && !jammerActive) {
            setJammerActive(true);
            setTimeout(() => setJammerActive(false), 5000);
          }
          return null;
        }

        return { x, y, vx, vy, colorIdx };
      });

      // Particles
      setParticles(prev =>
        prev
          .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.12, life: p.life - 0.035 }))
          .filter(p => p.life > 0)
      );

      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [fieldSize, snapAndExplode, hasMod, jammerActive]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (flyingRef.current || gameOver || win) return;
    const rect = fieldRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = fieldSize.w / 2;
    const cy = fieldSize.h - 60;
    setAimAngle(Math.atan2(my - cy, mx - cx));
  };

  const handleShoot = (e: React.PointerEvent) => {
    if (flyingRef.current || gameOver || win || queue.length === 0) return;
    const rect = fieldRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = fieldSize.w / 2;
    const cy = fieldSize.h - 60;
    const angle = Math.atan2(my - cy, mx - cx);
    // Clamp: don't shoot downward
    if (my > cy - 20) return;
    setFlyingBall({ x: cx, y: cy, vx: Math.cos(angle) * BALL_SPEED, vy: Math.sin(angle) * BALL_SPEED, colorIdx: queue[0] });
    setLastShotPos({ x: cx, y: cy });
    setAimAngle(null);
  };

  const resetGame = () => {
    setBalls(createGrid(7, []));
    setFlyingBall(null);
    setScore(0); setShots(0); setHp(5);
    setGameOver(false); setWin(false);
    setParticles([]); setRowOffset(0);
    setQueue(Array.from({ length: 4 }, () => Math.floor(Math.random() * BALL_COLORS.length)));
  };

  const { w, h } = fieldSize;
  const currentColor = queue[0] ?? 0;
  const nextColor = queue[1] ?? 0;
  const aliveBalls = balls.filter(b => b.alive);
  const isFog = hasMod("fog") && !jammerActive;
  const isMirrored = hasMod("mirrored_walls");

  // Aim line with ricochet
  const aimPts = aimAngle !== null && !flyingBall
    ? computeAimLine(w / 2, h - 60, aimAngle, w, isMirrored)
    : [];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col select-none"
      style={{ background: "radial-gradient(ellipse at top, #1a0d2e 0%, #0d0818 50%, #050310 100%)" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ background: "rgba(10,5,20,0.97)", borderBottom: "1px solid rgba(155,93,229,0.25)" }}>
        <button onClick={onBack} className="flex items-center gap-1 px-3 py-1.5 rounded-full"
          style={{ background: "rgba(155,93,229,0.12)", border: "1px solid rgba(155,93,229,0.3)", color: "#D4AF37" }}>
          <span className="font-cinzel text-xs">← НАЗАД</span>
        </button>
        <div className="text-center">
          <div className="font-cinzel text-xs font-bold text-gold-gradient">{levelName} · {levelNum}</div>
          <div className="flex gap-1 justify-center mt-0.5">
            {modifiers.map((m, i) => (
              <span key={i} className="text-xs px-1 rounded" style={{ background: "rgba(155,93,229,0.2)", color: "#C77DFF", fontSize: 9 }}>
                {m.type === "fog" ? "🌫️ТМН" : m.type === "mirrored_walls" ? "🪞ЗКЛ" : m.type === "mines" ? "💣МНЫ"
                  : m.type === "accelerator" ? "⚡УСК" : m.type === "armored" ? "🛡️БРН" : m.type === "vortex" ? "🌀ВХР"
                  : m.type === "side_gravity" ? `↔️ГРВ` : m.type === "jammer" ? "📡ГЛШ" : m.type === "doppelganger" ? "👥ДВЙ" : "🧪КСЛ"}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="font-cinzel text-sm font-bold" style={{ color: "#FFD700" }}>{score}</div>
          <div className="flex gap-0.5 justify-end">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} style={{ fontSize: 10 }}>{i < hp ? "❤️" : "🖤"}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Game field */}
      <div ref={fieldRef} className="flex-1 relative overflow-hidden cursor-crosshair"
        style={{ touchAction: "none" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handleShoot}>

        {/* Scanlines */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(155,93,229,0.025) 3px, rgba(155,93,229,0.025) 4px)",
          zIndex: 1,
        }} />

        {/* Side gravity arrow */}
        {hasMod("side_gravity") && (
          <div className="absolute top-2 pointer-events-none font-cinzel text-xs"
            style={{ [sideGravityDir === "left" ? "left" : "right"]: 8, color: "rgba(155,93,229,0.6)", zIndex: 5 }}>
            {sideGravityDir === "left" ? "◀ ГРАВИТАЦИЯ" : "ГРАВИТАЦИЯ ▶"}
          </div>
        )}

        {/* Jammer indicator */}
        {jammerActive && (
          <div className="absolute top-8 inset-x-0 flex justify-center pointer-events-none" style={{ zIndex: 20 }}>
            <div className="font-cinzel text-xs px-3 py-1 rounded-full animate-pulse"
              style={{ background: "rgba(255,69,0,0.2)", border: "1px solid rgba(255,69,0,0.5)", color: "#FF6B35" }}>
              📡 ГЛУШИТЕЛЬ АКТИВЕН
            </div>
          </div>
        )}

        {/* Aim SVG line with ricochet */}
        <svg className="absolute inset-0 pointer-events-none" width={w} height={h} style={{ zIndex: 2 }}>
          {aimPts.map((pt, i) => {
            if (i % 4 !== 0) return null;
            const opacity = (1 - i / aimPts.length) * 0.7;
            return <circle key={i} cx={pt.x} cy={pt.y} r={isMirrored ? 2.5 : 3}
              fill={BALL_COLORS[currentColor].glow}
              opacity={opacity} />;
          })}
          {/* Ricochet marker */}
          {aimPts.length > 10 && (() => {
            const ri = aimPts.findIndex((pt, i) => i > 5 && Math.abs(aimPts[i-1]?.x - pt.x) > 5 && i > 0);
            if (ri < 0) return null;
            return <circle cx={aimPts[ri].x} cy={aimPts[ri].y} r={5} fill="none"
              stroke={BALL_COLORS[currentColor].glow} strokeWidth={1.5} opacity={0.8} />;
          })()}
        </svg>

        {/* Grid balls */}
        {aliveBalls.map(ball => {
          const { x, y } = getBallCenter(ball.row, ball.col, w, rowOffset);
          const c = BALL_COLORS[ball.colorIdx];
          const isArmored = ball.modifier === "armored";
          const isMine = ball.modifier === "mine";
          const isAcid = ball.modifier === "acid";
          const r = ball.shrunken ? BALL_RADIUS * 0.65 : BALL_RADIUS;

          // Fog: hide color if far from reveal point
          let fogAlpha = 1;
          if (isFog && fogReveal) {
            const dist = Math.hypot(x - fogReveal.x, y - fogReveal.y);
            fogAlpha = dist < BALL_RADIUS * 5 ? 1 : 0.15;
          } else if (isFog && !fogReveal) {
            fogAlpha = 0.15;
          }

          if (y > h + BALL_RADIUS || y < 0) return null;

          return (
            <div key={ball.id} className="absolute flex items-center justify-center pointer-events-none"
              style={{
                left: x - r,
                top: y - r,
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                background: isFog && fogAlpha < 0.5
                  ? "radial-gradient(circle, #2a1a4a 0%, #1a0d2e 100%)"
                  : `radial-gradient(circle at 35% 35%, ${c.glow} 0%, ${c.color} 60%, rgba(0,0,0,0.3) 100%)`,
                boxShadow: isAcid
                  ? `0 0 10px #00ff88, 0 0 20px #00cc6640`
                  : `0 0 8px ${c.color}80, inset 0 0 6px rgba(255,255,255,0.15)`,
                border: isArmored
                  ? "2.5px solid #C0C0C0"
                  : isMine
                  ? "2px solid #FF4500"
                  : isAcid
                  ? "2px solid #00ff88"
                  : `1.5px solid ${c.glow}50`,
                opacity: fogAlpha,
                fontSize: r * 0.55,
                zIndex: 3,
                transition: "top 0.3s ease",
              }}>
              {isMine ? "💣" : isArmored ? (ball.armorHits === 2 ? "🛡️" : "⚠️") : isAcid ? "🧪" : (fogAlpha > 0.5 ? c.label : "?")}
            </div>
          );
        })}

        {/* Flying ball */}
        {flyingBall && (() => {
          const c = BALL_COLORS[flyingBall.colorIdx];
          return (
            <div className="absolute flex items-center justify-center pointer-events-none"
              style={{
                left: flyingBall.x - BALL_RADIUS,
                top: flyingBall.y - BALL_RADIUS,
                width: BALL_RADIUS * 2,
                height: BALL_RADIUS * 2,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${c.glow} 0%, ${c.color} 60%, rgba(0,0,0,0.3) 100%)`,
                boxShadow: `0 0 18px ${c.color}, 0 0 35px ${c.glow}70, inset 0 0 8px rgba(255,255,255,0.3)`,
                border: `2px solid ${c.glow}`,
                fontSize: 12,
                zIndex: 10,
              }}>
              {c.label}
            </div>
          );
        })()}

        {/* Particles */}
        {particles.map(p => {
          const c = BALL_COLORS[p.colorIdx];
          return (
            <div key={p.id} className="absolute rounded-full pointer-events-none"
              style={{
                left: p.x - p.size / 2, top: p.y - p.size / 2,
                width: p.size, height: p.size,
                background: c.glow,
                boxShadow: `0 0 ${p.size * 2}px ${c.color}`,
                opacity: p.life,
                zIndex: 15,
              }} />
          );
        })}

        {/* Fog overlay */}
        {isFog && (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: fogReveal
              ? `radial-gradient(circle ${BALL_RADIUS * 5}px at ${fogReveal.x}px ${fogReveal.y}px, transparent 40%, rgba(5,3,16,0.82) 100%)`
              : "rgba(5,3,16,0.82)",
            zIndex: 6,
          }} />
        )}

        {/* Combo popup */}
        {showCombo && (
          <div className="absolute inset-x-0 top-1/3 flex items-center justify-center pointer-events-none" style={{ zIndex: 25 }}>
            <div className="font-cinzel text-2xl font-bold text-gold-gradient"
              style={{ textShadow: "0 0 20px rgba(212,175,55,0.8)", animation: "scale-in 0.3s ease-out" }}>
              {showCombo}
            </div>
          </div>
        )}

        {/* Ceiling glow */}
        <div className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(155,93,229,0.5), rgba(212,175,55,0.3), rgba(155,93,229,0.5), transparent)", zIndex: 4 }} />

        {/* Game Over / Win */}
        {(gameOver || win) && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(10,5,20,0.88)", zIndex: 50 }}>
            <div className="text-center px-8 py-8 rounded-3xl"
              style={{ background: "linear-gradient(135deg, rgba(45,27,78,0.97), rgba(26,13,46,0.99))", border: `2px solid ${win ? "rgba(212,175,55,0.6)" : "rgba(255,107,53,0.5)"}` }}>
              <div className="text-5xl mb-3">{win ? "🏆" : "💀"}</div>
              <h2 className="font-cinzel text-xl font-bold mb-2" style={{ color: win ? "#FFD700" : "#FF6B35" }}>
                {win ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}
              </h2>
              <p className="font-cormorant text-sm mb-1" style={{ color: "rgba(212,175,55,0.7)" }}>
                {win ? "Все шары уничтожены!" : hp <= 0 ? "Ты подорвал слишком много мин" : "Шары дошли до земли"}
              </p>
              <p className="font-cinzel text-2xl font-bold mb-1" style={{ color: "#FFD700" }}>{score} очков</p>
              <p className="font-cormorant text-sm mb-4" style={{ color: "rgba(155,93,229,0.6)" }}>{shots} выстрелов</p>
              <div className="flex gap-3 justify-center">
                <button onClick={resetGame} className="btn-arcane px-5 py-2 rounded-xl text-sm">СНОВА</button>
                <button onClick={onBack} className="px-5 py-2 rounded-xl text-sm font-cinzel"
                  style={{ background: "rgba(155,93,229,0.15)", border: "1px solid rgba(155,93,229,0.4)", color: "#D4AF37" }}>ВЫЙТИ</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom launcher */}
      <div className="flex-shrink-0 px-4 pb-3 pt-2"
        style={{ background: "rgba(10,5,20,0.97)", borderTop: "1px solid rgba(155,93,229,0.25)" }}>
        <div className="flex items-center justify-between max-w-xs mx-auto">

          {/* Queue preview */}
          <div className="flex flex-col items-center gap-1">
            <div className="font-cormorant text-xs" style={{ color: "rgba(155,93,229,0.5)" }}>Очередь</div>
            <div className="flex gap-1">
              {queue.slice(1, 4).map((cIdx, i) => (
                <div key={i} className="rounded-full flex items-center justify-center"
                  style={{
                    width: 28 - i * 4, height: 28 - i * 4,
                    background: `radial-gradient(circle, ${BALL_COLORS[cIdx].glow} 0%, ${BALL_COLORS[cIdx].color} 70%)`,
                    opacity: 1 - i * 0.25,
                    fontSize: 8,
                  }}>
                  {BALL_COLORS[cIdx].label}
                </div>
              ))}
            </div>
          </div>

          {/* Current ball */}
          <div className="text-center">
            <div className="font-cormorant text-xs mb-1" style={{ color: "rgba(212,175,55,0.6)" }}>Целься и стреляй</div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${BALL_COLORS[currentColor].glow} 0%, ${BALL_COLORS[currentColor].color} 70%)`,
                boxShadow: `0 0 20px ${BALL_COLORS[currentColor].color}, 0 0 40px ${BALL_COLORS[currentColor].glow}50`,
                border: `2px solid ${BALL_COLORS[currentColor].glow}80`,
              }}>
              {BALL_COLORS[currentColor].label}
            </div>
          </div>

          {/* Stats */}
          <div className="text-center">
            <div className="font-cormorant text-xs" style={{ color: "rgba(155,93,229,0.5)" }}>На поле</div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-cinzel font-bold text-sm mx-auto mt-1"
              style={{ background: "rgba(155,93,229,0.15)", border: "1px solid rgba(155,93,229,0.3)", color: "#D4AF37" }}>
              {aliveBalls.length}
            </div>
            <div className="font-cormorant text-xs mt-1" style={{ color: "rgba(155,93,229,0.4)" }}>{shots} выстр.</div>
          </div>
        </div>
      </div>
    </div>
  );
}