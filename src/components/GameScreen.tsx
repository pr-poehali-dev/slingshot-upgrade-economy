import { useState, useRef, useEffect, useCallback } from "react";

// Ball colors with magic themes
const BALL_COLORS = [
  { id: "fire", color: "#FF4500", glow: "#FF6B35", label: "🔥" },
  { id: "ice", color: "#00B4D8", glow: "#4CC9F0", label: "💧" },
  { id: "arcane", color: "#9B5DE5", glow: "#C77DFF", label: "⚡" },
  { id: "nature", color: "#2DC653", glow: "#5CE877", label: "🌿" },
  { id: "gold", color: "#D4AF37", glow: "#FFD700", label: "✨" },
];

const BALL_RADIUS = 22;
const COLS = 9;
const ROWS_VISIBLE = 7;

type Ball = {
  id: number;
  colorIdx: number;
  row: number;
  col: number;
  alive: boolean;
};

type FlyingBall = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colorIdx: number;
};

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  colorIdx: number;
  size: number;
};

let ballIdCounter = 0;
let particleIdCounter = 0;

function createGrid(rows: number): Ball[] {
  const balls: Ball[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      if (Math.random() < 0.85) {
        balls.push({
          id: ballIdCounter++,
          colorIdx: Math.floor(Math.random() * BALL_COLORS.length),
          row: r,
          col: c,
          alive: true,
        });
      }
    }
  }
  return balls;
}

function getBallCenter(row: number, col: number, fieldW: number) {
  const totalW = COLS * (BALL_RADIUS * 2 + 4) - 4;
  const startX = (fieldW - totalW) / 2;
  const offset = row % 2 === 1 ? BALL_RADIUS + 2 : 0;
  const x = startX + offset + col * (BALL_RADIUS * 2 + 4) + BALL_RADIUS;
  const y = 60 + row * (BALL_RADIUS * 2 + 2) + BALL_RADIUS;
  return { x, y };
}

function getNeighbors(row: number, col: number, maxCols: number) {
  const neighbors = [];
  const isOdd = row % 2 === 1;
  const dirs = isOdd
    ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
    : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
  for (const [dr, dc] of dirs) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nc >= 0 && nc < maxCols) {
      neighbors.push({ row: nr, col: nc });
    }
  }
  return neighbors;
}

type GameScreenProps = {
  onBack: () => void;
  levelName: string;
  levelNum: number;
};

export default function GameScreen({ onBack, levelName, levelNum }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [fieldSize, setFieldSize] = useState({ w: 360, h: 500 });
  const [balls, setBalls] = useState<Ball[]>(() => createGrid(4));
  const [flyingBall, setFlyingBall] = useState<FlyingBall | null>(null);
  const [nextColor, setNextColor] = useState(() => Math.floor(Math.random() * BALL_COLORS.length));
  const [currentColor, setCurrentColor] = useState(() => Math.floor(Math.random() * BALL_COLORS.length));
  const [aimAngle, setAimAngle] = useState<number | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [shots, setShots] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [showCombo, setShowCombo] = useState(false);
  const animRef = useRef<number>();
  const flyingRef = useRef<FlyingBall | null>(null);
  const ballsRef = useRef<Ball[]>(balls);

  useEffect(() => { ballsRef.current = balls; }, [balls]);
  useEffect(() => { flyingRef.current = flyingBall; }, [flyingBall]);

  useEffect(() => {
    const updateSize = () => {
      if (fieldRef.current) {
        const w = fieldRef.current.clientWidth;
        const h = fieldRef.current.clientHeight;
        setFieldSize({ w, h });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const spawnParticles = useCallback((x: number, y: number, colorIdx: number, count = 10) => {
    const newParticles: Particle[] = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      return {
        id: particleIdCounter++,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        colorIdx,
        size: 3 + Math.random() * 5,
      };
    });
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // BFS flood-fill to find connected same-color group
  const findConnected = useCallback((startRow: number, startCol: number, colorIdx: number, currentBalls: Ball[]) => {
    const ballMap = new Map<string, Ball>();
    for (const b of currentBalls) {
      if (b.alive) ballMap.set(`${b.row}-${b.col}`, b);
    }
    const visited = new Set<string>();
    const queue = [{ row: startRow, col: startCol }];
    const group: Ball[] = [];
    while (queue.length > 0) {
      const { row, col } = queue.shift()!;
      const key = `${row}-${col}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const ball = ballMap.get(key);
      if (!ball || !ball.alive || ball.colorIdx !== colorIdx) continue;
      group.push(ball);
      for (const n of getNeighbors(row, col, COLS)) {
        if (!visited.has(`${n.row}-${n.col}`)) queue.push(n);
      }
    }
    return group;
  }, []);

  // Find floating (disconnected from top) balls
  const findFloating = useCallback((currentBalls: Ball[]) => {
    const ballMap = new Map<string, Ball>();
    for (const b of currentBalls) {
      if (b.alive) ballMap.set(`${b.row}-${b.col}`, b);
    }
    const anchored = new Set<string>();
    const queue = currentBalls.filter(b => b.alive && b.row === 0).map(b => ({ row: b.row, col: b.col }));
    for (const item of queue) anchored.add(`${item.row}-${item.col}`);
    while (queue.length > 0) {
      const { row, col } = queue.shift()!;
      for (const n of getNeighbors(row, col, COLS)) {
        const key = `${n.row}-${n.col}`;
        if (!anchored.has(key) && ballMap.has(key)) {
          anchored.add(key);
          queue.push(n);
        }
      }
    }
    return currentBalls.filter(b => b.alive && !anchored.has(`${b.row}-${b.col}`));
  }, []);

  const snapAndExplode = useCallback((fb: FlyingBall, currentBalls: Ball[]) => {
    const { w } = fieldSize;
    const occupiedSet = new Set(currentBalls.filter(b => b.alive).map(b => `${b.row}-${b.col}`));

    // Collect candidate cells: neighbors of existing balls + top row
    const candidates = new Set<string>();
    for (let c = 0; c < COLS; c++) candidates.add(`0-${c}`);
    for (const b of currentBalls) {
      if (!b.alive) continue;
      for (const n of getNeighbors(b.row, b.col, COLS)) {
        const key = `${n.row}-${n.col}`;
        if (!occupiedSet.has(key) && n.row >= 0) candidates.add(key);
      }
    }

    let bestRow = -1, bestCol = -1, bestDist = Infinity;
    for (const key of candidates) {
      const [r, c] = key.split("-").map(Number);
      if (occupiedSet.has(key)) continue;
      const { x, y } = getBallCenter(r, c, w);
      const dist = Math.hypot(x - fb.x, y - fb.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestRow = r;
        bestCol = c;
      }
    }
    if (bestRow < 0) return currentBalls;

    const newBall: Ball = { id: ballIdCounter++, colorIdx: fb.colorIdx, row: bestRow, col: bestCol, alive: true };
    const updated = [...currentBalls, newBall];

    // Find connected group
    const group = findConnected(bestRow, bestCol, fb.colorIdx, updated);
    let exploded = updated;
    let comboCount = 0;

    if (group.length >= 3) {
      comboCount = group.length;
      const groupIds = new Set(group.map(b => b.id));
      exploded = updated.map(b => groupIds.has(b.id) ? { ...b, alive: false } : b);

      // Spawn particles for each popped ball
      for (const b of group) {
        const { x, y } = getBallCenter(b.row, b.col, w);
        spawnParticles(x, y, b.colorIdx, 8);
      }
    }

    // Find and drop floating balls
    const floating = findFloating(exploded);
    if (floating.length > 0) {
      const floatIds = new Set(floating.map(b => b.id));
      for (const b of floating) {
        const { x, y } = getBallCenter(b.row, b.col, w);
        spawnParticles(x, y, b.colorIdx, 5);
      }
      comboCount += floating.length;
      exploded = exploded.map(b => floatIds.has(b.id) ? { ...b, alive: false } : b);
    }

    if (comboCount > 0) {
      setScore(prev => prev + comboCount * 10);
      setCombo(comboCount);
      setShowCombo(true);
      setTimeout(() => setShowCombo(false), 1200);
    }

    const aliveBalls = exploded.filter(b => b.alive);
    if (aliveBalls.length === 0) {
      setWin(true);
    }

    // Check game over — any ball too low
    for (const b of aliveBalls) {
      if (b.row >= ROWS_VISIBLE) {
        setGameOver(true);
        break;
      }
    }

    return exploded;
  }, [fieldSize, findConnected, findFloating, spawnParticles]);

  // Animation loop
  useEffect(() => {
    let lastTime = 0;
    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 16, 3);
      lastTime = time;

      setFlyingBall(prev => {
        if (!prev) return null;
        const { w, h } = fieldSize;
        const { colorIdx } = prev;
        let { x, y, vx, vy } = prev;
        x += vx * dt;
        y += vy * dt;

        // Wall bounce
        if (x - BALL_RADIUS < 0) { x = BALL_RADIUS; vx = Math.abs(vx); }
        if (x + BALL_RADIUS > w) { x = w - BALL_RADIUS; vx = -Math.abs(vx); }

        // Hit ceiling
        if (y - BALL_RADIUS < 40) {
          y = 40 + BALL_RADIUS;
          vy = Math.abs(vy);
        }

        // Hit grid ball
        const currentBalls = ballsRef.current;
        let hitBall: Ball | null = null;
        for (const b of currentBalls) {
          if (!b.alive) continue;
          const { x: bx, y: by } = getBallCenter(b.row, b.col, w);
          if (Math.hypot(x - bx, y - by) < BALL_RADIUS * 2 + 2) {
            hitBall = b;
            break;
          }
        }

        // Hit ceiling (top area where row 0 balls sit)
        const hitCeiling = y - BALL_RADIUS < 60 + BALL_RADIUS;

        if (hitBall || hitCeiling) {
          const newBalls = snapAndExplode({ x, y, vx, vy, colorIdx }, currentBalls);
          setBalls(newBalls);
          setShots(s => s + 1);
          setCurrentColor(nextColor);
          setNextColor(Math.floor(Math.random() * BALL_COLORS.length));
          return null;
        }

        return { x, y, vx, vy, colorIdx };
      });

      // Update particles
      setParticles(prev =>
        prev
          .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.15, life: p.life - 0.04 }))
          .filter(p => p.life > 0)
      );

      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [fieldSize, snapAndExplode, nextColor]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (flyingRef.current) return;
    const rect = fieldRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = fieldSize.w / 2;
    const cy = fieldSize.h - 60;
    const angle = Math.atan2(my - cy, mx - cx);
    setAimAngle(angle);
  };

  const handleShoot = (e: React.PointerEvent) => {
    if (flyingRef.current || gameOver || win) return;
    const rect = fieldRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = fieldSize.w / 2;
    const cy = fieldSize.h - 60;
    const angle = Math.atan2(my - cy, mx - cx);
    const speed = 14;
    setFlyingBall({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      colorIdx: currentColor,
    });
    setAimAngle(null);
  };

  const resetGame = () => {
    setBalls(createGrid(4));
    setFlyingBall(null);
    setScore(0);
    setCombo(0);
    setShots(0);
    setGameOver(false);
    setWin(false);
    setParticles([]);
    setCurrentColor(Math.floor(Math.random() * BALL_COLORS.length));
    setNextColor(Math.floor(Math.random() * BALL_COLORS.length));
  };

  const aliveBalls = balls.filter(b => b.alive);
  const { w, h } = fieldSize;

  // Aim line points
  const aimLinePoints: { x: number; y: number }[] = [];
  if (aimAngle !== null && !flyingBall) {
    const cx = w / 2;
    const cy = h - 60;
    let x = cx, y = cy, vx = Math.cos(aimAngle) * 12;
    const vy = Math.sin(aimAngle) * 12;
    let steps = 0;
    while (y > 40 && steps < 60) {
      aimLinePoints.push({ x, y });
      x += vx; y += vy;
      if (x - BALL_RADIUS < 0) { x = BALL_RADIUS; vx = Math.abs(vx); }
      if (x + BALL_RADIUS > w) { x = w - BALL_RADIUS; vx = -Math.abs(vx); }
      steps++;
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "radial-gradient(ellipse at top, #1a0d2e 0%, #0d0818 50%, #050310 100%)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ background: "rgba(10,5,20,0.95)", borderBottom: "1px solid rgba(155,93,229,0.25)" }}>
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
          style={{ background: "rgba(155,93,229,0.12)", border: "1px solid rgba(155,93,229,0.3)", color: "#D4AF37" }}>
          <span className="text-sm">←</span>
          <span className="font-cinzel text-xs">НАЗАД</span>
        </button>
        <div className="text-center">
          <div className="font-cinzel text-xs font-bold text-gold-gradient">{levelName}</div>
          <div className="font-cormorant text-xs" style={{ color: "rgba(155,93,229,0.7)" }}>Уровень {levelNum}</div>
        </div>
        <div className="text-right">
          <div className="font-cinzel text-sm font-bold" style={{ color: "#FFD700" }}>{score}</div>
          <div className="font-cormorant text-xs" style={{ color: "rgba(155,93,229,0.5)" }}>{shots} выстр.</div>
        </div>
      </div>

      {/* Game field */}
      <div
        ref={fieldRef}
        className="flex-1 relative overflow-hidden cursor-crosshair select-none"
        onPointerMove={handlePointerMove}
        onClick={handleShoot}
        style={{ touchAction: "none" }}
      >
        {/* Scanlines overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(155,93,229,0.03) 3px, rgba(155,93,229,0.03) 4px)",
          zIndex: 1,
        }} />

        {/* Aim dotted line */}
        <svg className="absolute inset-0 pointer-events-none" width={w} height={h} style={{ zIndex: 2 }}>
          {aimLinePoints.length > 1 && aimLinePoints.map((pt, i) => {
            if (i % 3 !== 0) return null;
            return (
              <circle key={i} cx={pt.x} cy={pt.y} r={3}
                fill={`rgba(${BALL_COLORS[currentColor].glow}, 0.5)`}
                style={{ opacity: 1 - i / aimLinePoints.length }}
              />
            );
          })}
        </svg>

        {/* Grid balls */}
        {aliveBalls.map(ball => {
          const { x, y } = getBallCenter(ball.row, ball.col, w);
          const c = BALL_COLORS[ball.colorIdx];
          return (
            <div key={ball.id}
              className="absolute flex items-center justify-center font-bold transition-none"
              style={{
                left: x - BALL_RADIUS,
                top: y - BALL_RADIUS,
                width: BALL_RADIUS * 2,
                height: BALL_RADIUS * 2,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${c.glow} 0%, ${c.color} 60%, rgba(0,0,0,0.3) 100%)`,
                boxShadow: `0 0 8px ${c.color}80, inset 0 0 6px rgba(255,255,255,0.2)`,
                border: `1.5px solid ${c.glow}60`,
                fontSize: 12,
                zIndex: 3,
              }}
            >
              {c.label}
            </div>
          );
        })}

        {/* Flying ball */}
        {flyingBall && (() => {
          const c = BALL_COLORS[flyingBall.colorIdx];
          return (
            <div className="absolute flex items-center justify-center font-bold pointer-events-none"
              style={{
                left: flyingBall.x - BALL_RADIUS,
                top: flyingBall.y - BALL_RADIUS,
                width: BALL_RADIUS * 2,
                height: BALL_RADIUS * 2,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${c.glow} 0%, ${c.color} 60%, rgba(0,0,0,0.3) 100%)`,
                boxShadow: `0 0 16px ${c.color}, 0 0 30px ${c.glow}80, inset 0 0 6px rgba(255,255,255,0.3)`,
                border: `1.5px solid ${c.glow}`,
                fontSize: 12,
                zIndex: 10,
              }}
            >
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
                left: p.x - p.size / 2,
                top: p.y - p.size / 2,
                width: p.size,
                height: p.size,
                background: c.glow,
                boxShadow: `0 0 ${p.size * 2}px ${c.color}`,
                opacity: p.life,
                zIndex: 15,
              }}
            />
          );
        })}

        {/* Combo popup */}
        {showCombo && combo >= 3 && (
          <div className="absolute inset-x-0 top-1/3 flex items-center justify-center pointer-events-none" style={{ zIndex: 20 }}>
            <div className="font-cinzel text-2xl font-bold animate-scale-in text-gold-gradient" style={{
              textShadow: "0 0 20px rgba(212,175,55,0.8)",
              animation: "scale-in 0.3s ease-out",
            }}>
              {combo >= 10 ? "🌟 МЕГА ВЗРЫВ!" : combo >= 6 ? "💥 COMBO ×" + combo : "✦ ВЗРЫВ ×" + combo}
            </div>
          </div>
        )}

        {/* Game Over / Win overlay */}
        {(gameOver || win) && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(10,5,20,0.85)", zIndex: 50 }}>
            <div className="text-center px-8 py-8 rounded-3xl" style={{ background: "linear-gradient(135deg, rgba(45,27,78,0.95), rgba(26,13,46,0.98))", border: `2px solid ${win ? "rgba(212,175,55,0.6)" : "rgba(255,107,53,0.5)"}` }}>
              <div className="text-5xl mb-3">{win ? "🏆" : "💀"}</div>
              <h2 className="font-cinzel text-xl font-bold mb-2" style={{ color: win ? "#FFD700" : "#FF6B35" }}>
                {win ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}
              </h2>
              <p className="font-cormorant text-sm mb-1" style={{ color: "rgba(212,175,55,0.7)" }}>
                {win ? "Все шары уничтожены!" : "Шары добрались до земли"}
              </p>
              <p className="font-cinzel text-2xl font-bold mb-4" style={{ color: "#FFD700" }}>{score} очков</p>
              <div className="flex gap-3 justify-center">
                <button onClick={resetGame} className="btn-arcane px-5 py-2 rounded-xl text-sm">СНОВА</button>
                <button onClick={onBack} className="px-5 py-2 rounded-xl text-sm font-cinzel" style={{ background: "rgba(155,93,229,0.15)", border: "1px solid rgba(155,93,229,0.4)", color: "#D4AF37" }}>ВЫЙТИ</button>
              </div>
            </div>
          </div>
        )}

        {/* Top ceiling glow */}
        <div className="absolute top-0 left-0 right-0 h-1 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(155,93,229,0.5), rgba(212,175,55,0.3), rgba(155,93,229,0.5), transparent)", zIndex: 4 }} />
      </div>

      {/* Bottom launcher */}
      <div className="flex-shrink-0 px-6 pb-4 pt-3" style={{ background: "rgba(10,5,20,0.95)", borderTop: "1px solid rgba(155,93,229,0.25)" }}>
        <div className="flex items-center justify-between max-w-xs mx-auto">
          {/* Next ball preview */}
          <div className="text-center">
            <div className="font-cormorant text-xs mb-1" style={{ color: "rgba(155,93,229,0.5)" }}>Следующий</div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${BALL_COLORS[nextColor].glow} 0%, ${BALL_COLORS[nextColor].color} 70%)`,
                boxShadow: `0 0 10px ${BALL_COLORS[nextColor].color}60`,
                border: `1.5px solid ${BALL_COLORS[nextColor].glow}50`,
              }}>
              {BALL_COLORS[nextColor].label}
            </div>
          </div>

          {/* Current ball (launcher) */}
          <div className="text-center">
            <div className="font-cormorant text-xs mb-1" style={{ color: "rgba(212,175,55,0.6)" }}>Нажми для выстрела</div>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl cursor-pointer transition-all hover:scale-110"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${BALL_COLORS[currentColor].glow} 0%, ${BALL_COLORS[currentColor].color} 70%)`,
                boxShadow: `0 0 20px ${BALL_COLORS[currentColor].color}, 0 0 40px ${BALL_COLORS[currentColor].glow}50`,
                border: `2px solid ${BALL_COLORS[currentColor].glow}80`,
              }}
            >
              {BALL_COLORS[currentColor].label}
            </div>
            <div className="font-cinzel text-xs mt-1" style={{ color: "rgba(212,175,55,0.5)" }}>↑ Целься</div>
          </div>

          {/* Active balls count */}
          <div className="text-center">
            <div className="font-cormorant text-xs mb-1" style={{ color: "rgba(155,93,229,0.5)" }}>На поле</div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-cinzel font-bold text-sm"
              style={{ background: "rgba(155,93,229,0.15)", border: "1px solid rgba(155,93,229,0.3)", color: "#D4AF37" }}>
              {aliveBalls.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}