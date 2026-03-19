import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const BALL_COLORS = [
  { id: "fire",   color: "#FF4500", glow: "#FF6B35", label: "🔥" },
  { id: "ice",    color: "#00B4D8", glow: "#4CC9F0", label: "💧" },
  { id: "arcane", color: "#9B5DE5", glow: "#C77DFF", label: "⚡" },
  { id: "nature", color: "#2DC653", glow: "#5CE877", label: "🌿" },
  { id: "gold",   color: "#D4AF37", glow: "#FFD700", label: "✨" },
];

const BALL_RADIUS = 18;
const COLS        = 9;
const TOTAL_ROWS  = 20;   // total rows in grid (only top portion visible)
const VISIBLE_ROWS = 10;  // rows that fit in viewport
const BALL_SPEED  = 13;
const STEP_X      = BALL_RADIUS * 2 + 3;
const STEP_Y      = BALL_RADIUS * 2 + 2;
const GRID_TOP    = 52;   // px from top of field

// ─── Types ────────────────────────────────────────────────────────────────────
type BallMod = "mine" | "armored" | "acid";

type Ball = {
  id: number; colorIdx: number;
  row: number; col: number;
  alive: boolean;
  modifier?: BallMod;
  armorHits?: number;
  shrunken?: boolean;
};

type FlyingBall = {
  x: number; y: number; vx: number; vy: number;
  colorIdx: number;
  ghost?: boolean;   // ghost bubble bonus
};

type Particle = {
  id: number; x: number; y: number;
  vx: number; vy: number; life: number;
  colorIdx: number; size: number; gold?: boolean;
};

type ActiveModifier =
  | { type: "fog" }
  | { type: "mirrored_walls" }
  | { type: "mines" }
  | { type: "accelerator" }
  | { type: "armored" }
  | { type: "vortex" }
  | { type: "side_gravity"; dir: "left" | "right" }
  | { type: "jammer" }
  | { type: "doppelganger" }
  | { type: "acid" };

// Bonus types (active on player)
type BonusType =
  | "clarity"        // reveal fog + show next 3
  | "slow_motion"    // slow ball speed
  | "precision"      // longer aim line
  | "twinshot"       // shoot 2 balls
  | "rev_gravity"    // floating balls fly up (chain)
  | "ghost"          // ball passes through, seeks same color
  | "catalyst"       // destroy all of current color
  | "swap"           // choose new ball color
  | "shield"         // block one negative event
  | "treasure"       // coins from groups
  | "bomb"           // explode 3x3 area
  | "lightning"      // destroy entire column
  | "freeze";        // freeze vortex/accelerator for 15s

type ActiveBonus = { type: BonusType; until?: number; };

let ballId = 2000;
let partId = 0;

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function getBallCenter(row: number, col: number, fieldW: number, descent = 0) {
  const totalW = COLS * STEP_X - 3;
  const startX = (fieldW - totalW) / 2;
  const hexOff = row % 2 === 1 ? BALL_RADIUS + 1.5 : 0;
  return {
    x: startX + hexOff + col * STEP_X + BALL_RADIUS,
    y: GRID_TOP + (row + descent) * STEP_Y + BALL_RADIUS,
  };
}

function getNeighbors(row: number, col: number) {
  const isOdd = row % 2 === 1;
  const dirs  = isOdd
    ? [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]]
    : [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];
  return dirs.map(([dr,dc]) => ({ row: row+dr, col: col+dc }))
             .filter(n => n.row >= 0 && n.col >= 0 && n.col < COLS);
}

function bfsConnected(sr: number, sc: number, colorIdx: number, balls: Ball[]) {
  const map = new Map(balls.filter(b=>b.alive).map(b=>[`${b.row}-${b.col}`,b]));
  const vis = new Set<string>(); const q = [{row:sr,col:sc}]; const group:Ball[]=[];
  while (q.length) {
    const {row,col} = q.shift()!; const key=`${row}-${col}`;
    if (vis.has(key)) continue; vis.add(key);
    const b = map.get(key);
    if (!b||!b.alive||b.colorIdx!==colorIdx) continue;
    group.push(b);
    for (const n of getNeighbors(row,col)) if (!vis.has(`${n.row}-${n.col}`)) q.push(n);
  }
  return group;
}

function findFloating(balls: Ball[]) {
  const map = new Map(balls.filter(b=>b.alive).map(b=>[`${b.row}-${b.col}`,b]));
  const anchored = new Set<string>();
  const q = balls.filter(b=>b.alive&&b.row===0).map(b=>({row:b.row,col:b.col}));
  for (const i of q) anchored.add(`${i.row}-${i.col}`);
  while (q.length) {
    const {row,col} = q.shift()!;
    for (const n of getNeighbors(row,col)) {
      const k=`${n.row}-${n.col}`;
      if (!anchored.has(k)&&map.has(k)) { anchored.add(k); q.push(n); }
    }
  }
  return balls.filter(b=>b.alive&&!anchored.has(`${b.row}-${b.col}`));
}

function createGrid(rows: number, mods: ActiveModifier[]): Ball[] {
  const hasMines   = mods.some(m=>m.type==="mines");
  const hasArmored = mods.some(m=>m.type==="armored");
  const hasAcid    = mods.some(m=>m.type==="acid");
  const balls: Ball[] = [];
  for (let r=0; r<rows; r++) for (let c=0; c<COLS; c++) {
    if (Math.random() < 0.9) {
      const b: Ball = { id:ballId++, colorIdx:Math.floor(Math.random()*BALL_COLORS.length), row:r, col:c, alive:true };
      const rng = Math.random();
      if      (hasMines   && rng<0.09)  b.modifier = "mine";
      else if (hasArmored && rng<0.17)  { b.modifier="armored"; b.armorHits=2; }
      else if (hasAcid    && rng<0.11)  b.modifier = "acid";
      balls.push(b);
    }
  }
  return balls;
}

function pickModifiers(): ActiveModifier[] {
  const all: ActiveModifier[] = [
    {type:"fog"},{type:"mirrored_walls"},{type:"mines"},{type:"accelerator"},
    {type:"armored"},{type:"vortex"},{type:"side_gravity",dir:Math.random()<.5?"left":"right"},
    {type:"jammer"},{type:"doppelganger"},{type:"acid"},
  ];
  return all.sort(()=>Math.random()-.5).slice(0, 2+Math.floor(Math.random()*2));
}

function computeAimLine(sx:number,sy:number,angle:number,fieldW:number,precision:boolean) {
  const pts: {x:number;y:number}[] = [];
  let x=sx, y=sy, vx=Math.cos(angle)*10; const vy=Math.sin(angle)*10; let steps=0;
  const maxSteps = precision ? 200 : 100;
  while (y>GRID_TOP && steps<maxSteps) {
    pts.push({x,y}); x+=vx; y+=vy;
    if (x-BALL_RADIUS<0)      { x=BALL_RADIUS;      vx=Math.abs(vx); }
    if (x+BALL_RADIUS>fieldW) { x=fieldW-BALL_RADIUS; vx=-Math.abs(vx); }
    steps++;
  }
  return pts;
}

// ─── Modifier labels ──────────────────────────────────────────────────────────
const MOD_LABELS: Record<string, string> = {
  fog:"🌫️", mirrored_walls:"🪞", mines:"💣", accelerator:"⚡",
  armored:"🛡️", vortex:"🌀", side_gravity:"↔️", jammer:"📡", doppelganger:"👥", acid:"🧪",
};
const MOD_NAMES: Record<string, string> = {
  fog:"Туман", mirrored_walls:"Зеркала", mines:"Мины", accelerator:"Ускоритель",
  armored:"Броня", vortex:"Вихрь", side_gravity:"Гравитация", jammer:"Глушитель",
  doppelganger:"Двойник", acid:"Кислота",
};

const BONUS_LABELS: Record<BonusType, string> = {
  clarity:"🔮", slow_motion:"⏳", precision:"🎯", twinshot:"👯",
  rev_gravity:"🔄", ghost:"👻", catalyst:"💥", swap:"🔁",
  shield:"🛡", treasure:"💰", bomb:"💣", lightning:"⚡", freeze:"❄️",
};
const BONUS_NAMES: Record<BonusType, string> = {
  clarity:"Ясность", slow_motion:"Замедление", precision:"Прицел", twinshot:"Близнецы",
  rev_gravity:"Антигравитация", ghost:"Призрак", catalyst:"Катализатор", swap:"Обмен",
  shield:"Защита", treasure:"Сокровище", bomb:"Бомба", lightning:"Молния", freeze:"Заморозка",
};

// ─── Component ────────────────────────────────────────────────────────────────
type GameScreenProps = { onBack:()=>void; levelName:string; levelNum:number; };

export default function GameScreen({ onBack, levelName, levelNum }: GameScreenProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [fieldSize, setFieldSize] = useState({ w:360, h:560 });
  const [modifiers]  = useState<ActiveModifier[]>(()=>pickModifiers());

  // Grid state: descent = how many rows have slid into view
  const [balls, setBalls]     = useState<Ball[]>(()=>createGrid(TOTAL_ROWS, []));
  const [descent, setDescent] = useState(0);   // rows descended (integer)
  const maxDescent = TOTAL_ROWS - VISIBLE_ROWS; // stop when bottom row reached top

  const [flyingBall, setFlyingBall] = useState<FlyingBall|null>(null);
  const [twinPending, setTwinPending] = useState(false);

  const [queue, setQueue]   = useState<number[]>(()=>Array.from({length:5},()=>Math.floor(Math.random()*BALL_COLORS.length)));
  const [aimAngle, setAimAngle] = useState<number|null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  const [score,    setScore]    = useState(0);
  const [coins,    setCoins]    = useState(0);
  const [shots,    setShots]    = useState(0);
  const [hp,       setHp]       = useState(5);
  const [shielded, setShielded] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [win,      setWin]      = useState(false);
  const [showCombo, setShowCombo] = useState<string|null>(null);

  // Active bonuses
  const [activeBonuses, setActiveBonuses] = useState<ActiveBonus[]>([]);
  const [bonusInventory, setBonusInventory] = useState<BonusType[]>([]);
  const [swapChoices, setSwapChoices] = useState<number[]|null>(null);

  // Fog: reveal radius around last explosion center, on timer
  const [fogReveal, setFogReveal] = useState<{x:number;y:number;until:number}|null>(null);

  // Jammer
  const [jammerActive, setJammerActive] = useState(false);

  // Vortex / freeze
  const [frozen, setFrozen] = useState(false);

  // Intro camera: animate from top to bottom, then lock to last 7 rows
  const VISIBLE_LOCKED = 7;
  const [cameraRow, setCameraRow] = useState(0);           // which row is at top of view
  const [introPhase, setIntroPhase] = useState<"scrolling"|"done">("scrolling");
  const introRef = useRef<ReturnType<typeof setTimeout>>();

  // Refs for animation loop
  const flyingRef   = useRef<FlyingBall|null>(null);
  const ballsRef    = useRef<Ball[]>(balls);
  const descentRef  = useRef(0);
  const animRef     = useRef<number>();
  const modRef      = useRef(modifiers);
  const shieldRef   = useRef(false);
  const jammerRef   = useRef(false);
  const frozenRef   = useRef(false);
  const treasureRef = useRef(false);
  const slowRef     = useRef(false);

  useEffect(() => { ballsRef.current   = balls; },    [balls]);
  useEffect(() => { flyingRef.current  = flyingBall;},  [flyingBall]);
  useEffect(() => { descentRef.current = descent; },  [descent]);
  useEffect(() => { shieldRef.current  = shielded; }, [shielded]);
  useEffect(() => { jammerRef.current  = jammerActive; }, [jammerActive]);
  useEffect(() => { frozenRef.current  = frozen; },   [frozen]);

  const hasMod = useCallback((t:string)=>modRef.current.some(m=>m.type===t),[]);
  const hasBonus = useCallback((t:BonusType)=>activeBonuses.some(b=>b.type===t&&(!b.until||b.until>Date.now())),[activeBonuses]);

  // Track treasure/slow in refs for anim loop
  useEffect(() => { treasureRef.current = hasBonus("treasure"); }, [activeBonuses, hasBonus]);
  useEffect(() => { slowRef.current = hasBonus("slow_motion"); }, [activeBonuses, hasBonus]);

  // Field size
  useEffect(() => {
    const upd = () => { if (fieldRef.current) setFieldSize({w:fieldRef.current.clientWidth,h:fieldRef.current.clientHeight}); };
    upd(); window.addEventListener("resize",upd); return ()=>window.removeEventListener("resize",upd);
  }, []);

  // Intro camera scroll: triggered on mount and on reset
  const [introKey, setIntroKey] = useState(0);
  useEffect(() => {
    setCameraRow(0);
    setIntroPhase("scrolling");
    const targetRow = TOTAL_ROWS - VISIBLE_LOCKED;
    const stepMs = 2400 / targetRow;
    let current = 0;
    const tick = () => {
      current++;
      setCameraRow(current);
      if (current < targetRow) {
        introRef.current = setTimeout(tick, stepMs);
      } else {
        setIntroPhase("done");
      }
    };
    introRef.current = setTimeout(tick, stepMs);
    return () => { if (introRef.current) clearTimeout(introRef.current); };
  }, [introKey]);

  // FOG: toggle every 30s, active for 15s
  useEffect(() => {
    if (!hasMod("fog")) return;
    let fogOn = true;
    const cycle = () => {
      fogOn = !fogOn;
      // we control via fogReveal being null vs set; here just force reveal clear
      if (!fogOn) setFogReveal(null);
    };
    // starts ON (fog active), revealed after shot
    const t = setInterval(cycle, fogOn ? 15000 : 30000);
    return () => clearInterval(t);
  }, [hasMod]);

  // VORTEX: swap 2 random balls every 5s
  useEffect(() => {
    if (!hasMod("vortex")) return;
    const iv = setInterval(() => {
      if (frozenRef.current) return;
      setBalls(bs => {
        const alive = bs.filter(b=>b.alive);
        if (alive.length<2) return bs;
        const i1=Math.floor(Math.random()*alive.length); let i2=i1;
        while (i2===i1) i2=Math.floor(Math.random()*alive.length);
        return bs.map(b=>{
          if (b.id===alive[i1].id) return {...b,colorIdx:alive[i2].colorIdx,modifier:alive[i2].modifier};
          if (b.id===alive[i2].id) return {...b,colorIdx:alive[i1].colorIdx,modifier:alive[i1].modifier};
          return b;
        });
      });
    }, 5000);
    return ()=>clearInterval(iv);
  }, [hasMod]);

  // ACID: shrink neighbors every 3s
  useEffect(() => {
    if (!hasMod("acid")) return;
    const iv = setInterval(() => {
      setBalls(bs => {
        const acidBalls = bs.filter(b=>b.alive&&b.modifier==="acid");
        const toShrink = new Set<number>();
        for (const ab of acidBalls) for (const n of getNeighbors(ab.row,ab.col)) {
          const nb = bs.find(b=>b.alive&&b.row===n.row&&b.col===n.col&&b.modifier!=="acid");
          if (nb) toShrink.add(nb.id);
        }
        return bs.map(b=>toShrink.has(b.id)?{...b,shrunken:true}:b);
      });
    }, 3000);
    return ()=>clearInterval(iv);
  }, [hasMod]);

  // Expire active bonuses
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setActiveBonuses(prev => prev.filter(b => !b.until || b.until > now));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Particles ──
  const spawnParticles = useCallback((x:number,y:number,colorIdx:number,count=10,gold=false)=>{
    setParticles(prev=>[...prev,...Array.from({length:count},()=>{
      const a=Math.random()*Math.PI*2, s=1.5+Math.random()*3;
      return {id:partId++,x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,colorIdx,size:3+Math.random()*5,gold};
    })]);
  },[]);

  // ── Grant bonus ──
  const grantBonus = useCallback((type: BonusType) => {
    setBonusInventory(prev => [...prev, type]);
  }, []);

  // ── Drop row (called after destroying N rows worth of balls) ──
  const tryDescend = useCallback((newBalls: Ball[]) => {
    // Find the lowest row that is fully empty (no alive balls)
    const aliveRows = new Set(newBalls.filter(b=>b.alive).map(b=>b.row));
    // Count how many top rows are completely cleared
    let clearedRows = 0;
    for (let r=0; r<TOTAL_ROWS; r++) {
      if (!aliveRows.has(r)) clearedRows++;
      else break;
    }
    setDescent(prev => {
      const next = Math.min(clearedRows, maxDescent);
      return next > prev ? next : prev;
    });
  }, [maxDescent]);

  // ── Core snap + explode ──
  const snapAndExplode = useCallback((
    fb: FlyingBall, currentBalls: Ball[], currentHp: number, currentShielded: boolean
  ) => {
    const {w} = fieldSize;
    const desc = descentRef.current;
    const occupied = new Set(currentBalls.filter(b=>b.alive).map(b=>`${b.row}-${b.col}`));

    // Ghost ball: skip to same-color ball
    if (fb.ghost) {
      const target = currentBalls.find(b=>b.alive&&b.colorIdx===fb.colorIdx);
      if (target) {
        const group = bfsConnected(target.row,target.col,fb.colorIdx,currentBalls);
        const groupIds = new Set(group.map(b=>b.id));
        const updated = currentBalls.map(b=>groupIds.has(b.id)?{...b,alive:false}:b);
        for (const b of group) { const {x,y}=getBallCenter(b.row,b.col,w,desc); spawnParticles(x,y,b.colorIdx,8); }
        setScore(p=>p+group.length*10);
        tryDescend(updated);
        return {balls:updated, hp:currentHp};
      }
      return {balls:currentBalls, hp:currentHp};
    }

    // Find snap cell
    const candidates = new Set<string>();
    for (let c=0;c<COLS;c++) candidates.add(`0-${c}`);
    for (const b of currentBalls) {
      if (!b.alive) continue;
      for (const n of getNeighbors(b.row,b.col)) {
        const k=`${n.row}-${n.col}`;
        if (!occupied.has(k)&&n.row>=0) candidates.add(k);
      }
    }
    let bestRow=-1,bestCol=-1,bestDist=Infinity;
    for (const key of candidates) {
      const [r,c]=key.split("-").map(Number);
      if (occupied.has(key)) continue;
      const {x,y}=getBallCenter(r,c,w,desc);
      const d=Math.hypot(x-fb.x,y-fb.y);
      if (d<bestDist) {bestDist=d;bestRow=r;bestCol=c;}
    }
    if (bestRow<0) return {balls:currentBalls,hp:currentHp};

    // Armored: first hit strips armor
    const hitTarget = currentBalls.find(b=>b.alive&&b.row===bestRow&&b.col===bestCol);
    if (hitTarget?.modifier==="armored"&&(hitTarget.armorHits??0)>1) {
      return {balls:currentBalls.map(b=>b.id===hitTarget.id?{...b,armorHits:(b.armorHits??2)-1}:b),hp:currentHp};
    }

    const newBall: Ball = {id:ballId++,colorIdx:fb.colorIdx,row:bestRow,col:bestCol,alive:true};
    let updated = [...currentBalls,newBall];

    // Mine hit
    let newHp = currentHp;
    const mine = currentBalls.find(b=>b.alive&&b.row===bestRow&&b.col===bestCol&&b.modifier==="mine");
    if (mine && !currentShielded) {
      newHp = Math.max(0,currentHp-1);
      spawnParticles(fb.x,fb.y,0,15);
      if (newHp<=0) setGameOver(true);
    } else if (mine && currentShielded) {
      setShielded(false);
    }

    // BFS group match
    const group = bfsConnected(bestRow,bestCol,fb.colorIdx,updated);
    let comboCount = 0;
    const isTreasure = treasureRef.current;

    if (group.length>=3) {
      comboCount = group.length;
      const gids = new Set(group.map(b=>b.id));
      updated = updated.map(b=>gids.has(b.id)?{...b,alive:false}:b);
      for (const b of group) {
        const {x,y}=getBallCenter(b.row,b.col,w,desc);
        spawnParticles(x,y,b.colorIdx,8);
        if (isTreasure) spawnParticles(x,y,3,4,true); // gold particles
      }
      if (isTreasure) {
        const gained = group.length*5;
        setCoins(p=>p+gained);
        setScore(p=>p+gained*2);
      }
      // Fog reveal
      if (hasMod("fog")) {
        const {x,y}=getBallCenter(bestRow,bestCol,w,desc);
        setFogReveal({x,y,until:Date.now()+8000});
      }
      // Grant combo bonuses
      if (group.length>=12) grantBonus("bomb");
      else if (group.length>=9) grantBonus("lightning");
      else if (group.length>=6) grantBonus("freeze");
    }

    // Floating
    const floating = findFloating(updated);
    if (floating.length>0) {
      const fids = new Set(floating.map(b=>b.id));
      for (const b of floating) { const {x,y}=getBallCenter(b.row,b.col,w,desc); spawnParticles(x,y,b.colorIdx,5); }
      comboCount += floating.length;
      updated = updated.map(b=>fids.has(b.id)?{...b,alive:false}:b);
    }

    if (comboCount>=3) {
      const mult = comboCount>=10?3:comboCount>=6?2:1;
      setScore(p=>p+comboCount*10*mult);
      setShowCombo(
        comboCount>=12?"🌟 МЕГА ВЗРЫВ!":
        comboCount>=8 ?"💥 COMBO ×"+comboCount:
                       "✦ ВЗРЫВ ×"+comboCount
      );
      setTimeout(()=>setShowCombo(null),1200);
    }

    tryDescend(updated);

    // Doppelganger: add random to queue
    if (hasMod("doppelganger")) setQueue(q=>[...q,Math.floor(Math.random()*BALL_COLORS.length)]);

    // Game over check: ball row must exceed the last locked row (TOTAL_ROWS - 1)
    const alive = updated.filter(b=>b.alive);
    if (alive.length===0) setWin(true);
    for (const b of alive) {
      if (b.row >= TOTAL_ROWS) {setGameOver(true);break;}
    }

    return {balls:updated,hp:newHp};
  },[fieldSize,hasMod,spawnParticles,tryDescend,grantBonus]);

  // ── Animation loop ──
  useEffect(()=>{
    let last=0;
    const loop=(time:number)=>{
      const rawDt = Math.min((time-last)/16,3);
      last=time;
      const dt = slowRef.current ? rawDt*0.5 : rawDt;

      setFlyingBall(prev=>{
        if (!prev) return null;
        const {w} = fieldSize;
        const {colorIdx,ghost} = prev;
        let {x,y,vx,vy} = prev;
        x+=vx*dt; y+=vy*dt;

        if (!ghost) {
          const isMirrored = hasMod("mirrored_walls");
          if (x-BALL_RADIUS<0) { x=BALL_RADIUS; if(isMirrored){const d=(Math.random()-.5)*.6;vx=Math.abs(vx);vy+=d;}else vx=Math.abs(vx); }
          if (x+BALL_RADIUS>w) { x=w-BALL_RADIUS; if(isMirrored){const d=(Math.random()-.5)*.6;vx=-Math.abs(vx);vy+=d;}else vx=-Math.abs(vx); }
        }

        const cb = ballsRef.current;
        const desc = descentRef.current;
        let hitBall: Ball|null = null;
        for (const b of cb) {
          if (!b.alive) continue;
          if (ghost && b.colorIdx!==colorIdx) continue;
          const {x:bx,y:by}=getBallCenter(b.row,b.col,w,desc);
          if (Math.hypot(x-bx,y-by)<BALL_RADIUS*2+2) {hitBall=b;break;}
        }
        const hitCeiling = !ghost && y-BALL_RADIUS<GRID_TOP+BALL_RADIUS;

        if (hitBall||hitCeiling) {
          setHp(curHp=>{
            const {balls:nb,hp:nh}=snapAndExplode({x,y,vx,vy,colorIdx,ghost},cb,curHp,shieldRef.current);
            setBalls(nb);
            return nh;
          });
          setShots(s=>s+1);
          setQueue(q=>{const[,...rest]=q;return[...rest,Math.floor(Math.random()*BALL_COLORS.length)];});

          // Jammer
          if (hasMod("jammer")&&!jammerRef.current&&Math.random()<0.15) {
            setJammerActive(true); setTimeout(()=>setJammerActive(false),5000);
          }

          // Twinshot: schedule second ball
          if (twinPending) {
            setTwinPending(false);
            setTimeout(()=>{
              setFlyingBall({x:w/2,y:fieldRef.current!.clientHeight-60,vx:vx+1.5,vy,colorIdx});
            },150);
          }
          return null;
        }
        return {x,y,vx,vy,colorIdx,ghost};
      });

      // Particles
      setParticles(prev=>prev
        .map(p=>({...p,x:p.x+p.vx,y:p.y+p.vy,vy:p.vy+0.12,life:p.life-0.032}))
        .filter(p=>p.life>0));

      animRef.current=requestAnimationFrame(loop);
    };
    animRef.current=requestAnimationFrame(loop);
    return()=>{if(animRef.current)cancelAnimationFrame(animRef.current);};
  },[fieldSize,snapAndExplode,hasMod,twinPending]);

  // ── Bonus activation ──
  const activateBonus = useCallback((type: BonusType) => {
    const now = Date.now();
    setBonusInventory(prev=>{
      const idx=prev.indexOf(type); if(idx<0) return prev;
      const next=[...prev]; next.splice(idx,1); return next;
    });

    if (type==="clarity") {
      setActiveBonuses(p=>[...p,{type,until:now+10000}]);
      setFogReveal({x:fieldSize.w/2,y:fieldSize.h/2,until:now+10000});
    } else if (type==="slow_motion") {
      setActiveBonuses(p=>[...p,{type,until:now+8000}]);
    } else if (type==="precision") {
      setActiveBonuses(p=>[...p,{type,until:now+15000}]);
    } else if (type==="twinshot") {
      setTwinPending(true);
    } else if (type==="rev_gravity") {
      // Drop all floating balls upward (same as regular drop)
      setBalls(bs=>{
        const floating=findFloating(bs);
        if (!floating.length) return bs;
        const fids=new Set(floating.map(b=>b.id));
        for (const b of floating) { const {x,y}=getBallCenter(b.row,b.col,fieldSize.w,descentRef.current); spawnParticles(x,y,b.colorIdx,6); }
        setScore(p=>p+floating.length*15);
        return bs.map(b=>fids.has(b.id)?{...b,alive:false}:b);
      });
    } else if (type==="ghost") {
      // Next shot is ghost
      setQueue(q=>{if(!q.length)return q; return q;}); // keep queue, ghost applied on shoot
      setActiveBonuses(p=>[...p,{type}]);
    } else if (type==="catalyst") {
      const colorIdx=queue[0]??0;
      setBalls(bs=>{
        const toKill=bs.filter(b=>b.alive&&b.colorIdx===colorIdx);
        const kids=new Set(toKill.map(b=>b.id));
        for (const b of toKill) { const {x,y}=getBallCenter(b.row,b.col,fieldSize.w,descentRef.current); spawnParticles(x,y,b.colorIdx,8); }
        setScore(p=>p+toKill.length*20);
        const updated=bs.map(b=>kids.has(b.id)?{...b,alive:false}:b);
        tryDescend(updated); return updated;
      });
    } else if (type==="swap") {
      setSwapChoices(Array.from({length:3},()=>Math.floor(Math.random()*BALL_COLORS.length)));
    } else if (type==="shield") {
      setShielded(true); setActiveBonuses(p=>[...p,{type}]);
    } else if (type==="treasure") {
      setActiveBonuses(p=>[...p,{type,until:now+10000}]);
    } else if (type==="bomb") {
      // Explode 3x3 around lowest ball
      setBalls(bs=>{
        const alive=bs.filter(b=>b.alive);
        if (!alive.length) return bs;
        const target=alive.reduce((a,b)=>b.row>a.row?b:a);
        const toKill=bs.filter(b=>b.alive&&Math.abs(b.row-target.row)<=1&&Math.abs(b.col-target.col)<=1);
        const kids=new Set(toKill.map(b=>b.id));
        for (const b of toKill) { const {x,y}=getBallCenter(b.row,b.col,fieldSize.w,descentRef.current); spawnParticles(x,y,b.colorIdx,10); }
        setScore(p=>p+toKill.length*15);
        const updated=bs.map(b=>kids.has(b.id)?{...b,alive:false}:b);
        tryDescend(updated); return updated;
      });
    } else if (type==="lightning") {
      // Destroy entire random column
      const col=Math.floor(Math.random()*COLS);
      setBalls(bs=>{
        const toKill=bs.filter(b=>b.alive&&b.col===col);
        const kids=new Set(toKill.map(b=>b.id));
        for (const b of toKill) { const {x,y}=getBallCenter(b.row,b.col,fieldSize.w,descentRef.current); spawnParticles(x,y,b.colorIdx,8); }
        setScore(p=>p+toKill.length*15);
        const updated=bs.map(b=>kids.has(b.id)?{...b,alive:false}:b);
        tryDescend(updated); return updated;
      });
    } else if (type==="freeze") {
      setFrozen(true); setActiveBonuses(p=>[...p,{type,until:now+15000}]);
      setTimeout(()=>setFrozen(false),15000);
    }
  },[queue,fieldSize,spawnParticles,tryDescend]);

  // ── Aim & Shoot ──
  const handlePointerMove = (e: React.PointerEvent) => {
    if (flyingRef.current||gameOver||win||introPhase==="scrolling") return;
    const rect=fieldRef.current!.getBoundingClientRect();
    const cx=fieldSize.w/2, cy=fieldSize.h-60;
    setAimAngle(Math.atan2(e.clientY-rect.top-cy, e.clientX-rect.left-cx));
  };

  const handleShoot = (e: React.PointerEvent) => {
    if (flyingRef.current||gameOver||win||queue.length===0||introPhase==="scrolling") return;
    const rect=fieldRef.current!.getBoundingClientRect();
    const cx=fieldSize.w/2, cy=fieldSize.h-60;
    const my=e.clientY-rect.top;
    if (my>cy-20) return;
    const angle=Math.atan2(my-cy, e.clientX-rect.left-cx);
    const isGhost=hasBonus("ghost");
    if (isGhost) setActiveBonuses(p=>p.filter(b=>b.type!=="ghost"));
    if (twinPending) {
      setFlyingBall({x:cx,y:cy,vx:Math.cos(angle)*BALL_SPEED-1,vy:Math.sin(angle)*BALL_SPEED,colorIdx:queue[0]});
    } else {
      setFlyingBall({x:cx,y:cy,vx:Math.cos(angle)*BALL_SPEED,vy:Math.sin(angle)*BALL_SPEED,colorIdx:queue[0],ghost:isGhost});
    }
    setAimAngle(null);
  };

  const resetGame = () => {
    setBalls(createGrid(TOTAL_ROWS,[]));
    setFlyingBall(null); setScore(0); setCoins(0); setShots(0); setHp(5);
    setGameOver(false); setWin(false); setParticles([]); setDescent(0);
    setQueue(Array.from({length:5},()=>Math.floor(Math.random()*BALL_COLORS.length)));
    setActiveBonuses([]); setBonusInventory([]); setShielded(false); setFrozen(false);
    setTwinPending(false); setSwapChoices(null);
    setIntroKey(k => k + 1);
  };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const {w,h} = fieldSize;
  const currentColor = queue[0]??0;
  const aliveBalls   = balls.filter(b=>b.alive);
  const isFog        = hasMod("fog") && !jammerActive;
  const isMirrored   = hasMod("mirrored_walls");
  const isPrecision  = hasBonus("precision");

  // During intro: use cameraRow as negative offset so field scrolls top→bottom
  // After intro: use descent (gameplay offset) anchored to last VISIBLE_LOCKED rows
  const lockedStart  = TOTAL_ROWS - VISIBLE_LOCKED; // row that should be at top when locked
  const viewOffset   = introPhase === "scrolling"
    ? -cameraRow                        // scroll: show rows starting from 0 down to lockedStart
    : descent - lockedStart;            // gameplay: keep bottom 7 rows in view

  const aimPts = aimAngle!==null&&!flyingBall&&introPhase==="done"
    ? computeAimLine(w/2,h-60,aimAngle,w,isPrecision)
    : [];

  const fogActive = introPhase==="done" && isFog && !(fogReveal && fogReveal.until>Date.now()) && !(hasBonus("clarity"));
  const sideGravDir = (modifiers.find(m=>m.type==="side_gravity") as {type:"side_gravity";dir:"left"|"right"}|undefined)?.dir;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col select-none"
      style={{background:"radial-gradient(ellipse at top,#1a0d2e 0%,#0d0818 50%,#050310 100%)"}}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{background:"rgba(10,5,20,0.97)",borderBottom:"1px solid rgba(155,93,229,0.25)"}}>
        <button onClick={onBack} className="px-3 py-1 rounded-full font-cinzel text-xs"
          style={{background:"rgba(155,93,229,0.12)",border:"1px solid rgba(155,93,229,0.3)",color:"#D4AF37"}}>
          ← НАЗАД
        </button>
        <div className="text-center">
          <div className="font-cinzel text-xs font-bold text-gold-gradient">{levelName} · {levelNum}</div>
          <div className="flex gap-0.5 justify-center mt-0.5 flex-wrap">
            {modifiers.map((m,i)=>(
              <span key={i} title={MOD_NAMES[m.type]} className="text-xs rounded px-0.5"
                style={{background:"rgba(155,93,229,0.2)",color:"#C77DFF",fontSize:10}}>
                {MOD_LABELS[m.type]}{MOD_NAMES[m.type].slice(0,3)}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="font-cinzel text-sm font-bold" style={{color:"#FFD700"}}>{score}</div>
          <div className="flex gap-0.5 justify-end items-center">
            <span style={{fontSize:9,color:"rgba(212,175,55,0.6)"}}>💰{coins}</span>
            {Array.from({length:5}).map((_,i)=>(
              <span key={i} style={{fontSize:9}}>{i<hp?"❤️":"🖤"}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bonus inventory bar ── */}
      {bonusInventory.length>0&&(
        <div className="flex gap-1 px-2 py-1 flex-shrink-0 overflow-x-auto"
          style={{background:"rgba(5,3,16,0.85)",borderBottom:"1px solid rgba(155,93,229,0.15)"}}>
          {bonusInventory.map((bt,i)=>(
            <button key={i} onClick={()=>activateBonus(bt)}
              title={BONUS_NAMES[bt]}
              className="flex-shrink-0 rounded-lg flex items-center gap-1 px-2 py-1 text-xs font-cinzel"
              style={{background:"rgba(212,175,55,0.12)",border:"1px solid rgba(212,175,55,0.35)",color:"#FFD700",fontSize:11}}>
              {BONUS_LABELS[bt]}
            </button>
          ))}
        </div>
      )}

      {/* ── Swap chooser ── */}
      {swapChoices&&(
        <div className="absolute inset-0 z-[200] flex items-center justify-center"
          style={{background:"rgba(5,3,16,0.8)"}}>
          <div className="rounded-2xl p-5 text-center" style={{background:"rgba(45,27,78,0.97)",border:"1px solid rgba(212,175,55,0.4)"}}>
            <div className="font-cinzel text-sm mb-3" style={{color:"#FFD700"}}>Выбери цвет шарика</div>
            <div className="flex gap-3 justify-center">
              {swapChoices.map((ci,i)=>(
                <button key={i} onClick={()=>{setQueue(q=>{const nq=[...q];nq[0]=ci;return nq;});setSwapChoices(null);}}
                  className="w-14 h-14 rounded-full text-2xl"
                  style={{background:`radial-gradient(circle,${BALL_COLORS[ci].glow},${BALL_COLORS[ci].color})`,
                    boxShadow:`0 0 15px ${BALL_COLORS[ci].color}`}}>
                  {BALL_COLORS[ci].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Game field ── */}
      <div ref={fieldRef} className="flex-1 relative overflow-hidden cursor-crosshair"
        style={{touchAction:"none"}}
        onPointerMove={handlePointerMove} onPointerUp={handleShoot}>

        {/* Scanlines */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(155,93,229,0.02) 3px,rgba(155,93,229,0.02) 4px)",zIndex:1}}/>

        {/* Side gravity indicator */}
        {sideGravDir&&(
          <div className="absolute top-1 pointer-events-none font-cinzel"
            style={{[sideGravDir==="left"?"left":"right"]:8,color:"rgba(155,93,229,0.5)",zIndex:5,fontSize:10}}>
            {sideGravDir==="left"?"◀ ГРАВИТАЦИЯ":"ГРАВИТАЦИЯ ▶"}
          </div>
        )}

        {/* Jammer */}
        {jammerActive&&(
          <div className="absolute top-2 inset-x-0 flex justify-center pointer-events-none" style={{zIndex:20}}>
            <div className="font-cinzel text-xs px-3 py-1 rounded-full animate-pulse"
              style={{background:"rgba(255,69,0,0.18)",border:"1px solid rgba(255,69,0,0.5)",color:"#FF6B35",fontSize:10}}>
              📡 ГЛУШИТЕЛЬ АКТИВЕН
            </div>
          </div>
        )}

        {/* Active bonus indicators */}
        <div className="absolute top-1 right-2 flex flex-col gap-0.5 pointer-events-none" style={{zIndex:15}}>
          {activeBonuses.filter(b=>b.until&&b.until>Date.now()).map((b,i)=>(
            <div key={i} className="text-xs px-1.5 py-0.5 rounded font-cinzel"
              style={{background:"rgba(212,175,55,0.15)",color:"#FFD700",border:"1px solid rgba(212,175,55,0.3)",fontSize:9}}>
              {BONUS_LABELS[b.type]}{BONUS_NAMES[b.type]}
            </div>
          ))}
          {shielded&&<div className="text-xs px-1.5 py-0.5 rounded font-cinzel"
            style={{background:"rgba(0,180,216,0.15)",color:"#4CC9F0",fontSize:9}}>🛡 ЩИТ</div>}
          {twinPending&&<div className="text-xs px-1.5 py-0.5 rounded font-cinzel"
            style={{background:"rgba(45,198,83,0.15)",color:"#5CE877",fontSize:9}}>👯 БЛИЗНЕЦЫ</div>}
        </div>

        {/* Aim SVG */}
        <svg className="absolute inset-0 pointer-events-none" width={w} height={h} style={{zIndex:2}}>
          {aimPts.map((pt,i)=>{
            if (i%3!==0) return null;
            const op=(1-i/aimPts.length)*0.75;
            return <circle key={i} cx={pt.x} cy={pt.y} r={isPrecision?3.5:2.5}
              fill={BALL_COLORS[currentColor].glow} opacity={op}/>;
          })}
          {/* Ricochet marker */}
          {(()=>{
            let bounced=false;
            for (let i=5;i<aimPts.length-1;i++) {
              if (!bounced&&Math.abs((aimPts[i-1]?.x??0)-aimPts[i].x)>8) {
                bounced=true;
                return <circle key="rc" cx={aimPts[i].x} cy={aimPts[i].y} r={6}
                  fill="none" stroke={BALL_COLORS[currentColor].glow} strokeWidth={1.5} opacity={0.7}/>;
              }
            }
            return null;
          })()}
        </svg>

        {/* Intro overlay: show "Начинаем!" during scroll */}
        {introPhase==="scrolling"&&(
          <div className="absolute inset-x-0 bottom-16 flex justify-center pointer-events-none" style={{zIndex:30}}>
            <div className="font-cinzel text-sm px-4 py-2 rounded-full animate-pulse"
              style={{background:"rgba(26,13,46,0.85)",border:"1px solid rgba(212,175,55,0.4)",color:"#FFD700",letterSpacing:"0.12em"}}>
              ✦ ОБЗОР ПОЛЯ ✦
            </div>
          </div>
        )}

        {/* Grid balls */}
        {aliveBalls.map(ball=>{
          const {x,y}=getBallCenter(ball.row,ball.col,w,viewOffset);
          if (y>h+BALL_RADIUS*2||y<-BALL_RADIUS) return null;
          const c=BALL_COLORS[ball.colorIdx];
          const r=ball.shrunken?BALL_RADIUS*0.65:BALL_RADIUS;
          const isArmored=ball.modifier==="armored";
          const isMine=ball.modifier==="mine";
          const isAcid=ball.modifier==="acid";
          // Fog logic
          const showFull=!fogActive||(!!fogReveal&&Math.hypot(x-fogReveal.x,y-fogReveal.y)<BALL_RADIUS*6)||(hasBonus("clarity"));
          return (
            <div key={ball.id} className="absolute flex items-center justify-center pointer-events-none"
              style={{
                left:x-r,top:y-r,width:r*2,height:r*2,borderRadius:"50%",
                background:showFull
                  ?`radial-gradient(circle at 35% 35%,${c.glow} 0%,${c.color} 60%,rgba(0,0,0,0.3) 100%)`
                  :"radial-gradient(circle,#2a1a4a,#1a0d2e)",
                boxShadow:isAcid?`0 0 10px #00ff88,0 0 20px #00cc6640`:`0 0 7px ${c.color}70,inset 0 0 5px rgba(255,255,255,0.12)`,
                border:isArmored?"2.5px solid #C0C0C0":isMine?"2px solid #FF4500":isAcid?"2px solid #00ff88":`1.5px solid ${c.glow}45`,
                fontSize:r*0.55,zIndex:3,
                transition:"top 0.25s ease",
              }}>
              {!showFull?"?":isMine?"💣":isArmored?(ball.armorHits===2?"🛡️":"⚠️"):isAcid?"🧪":c.label}
            </div>
          );
        })}

        {/* Flying ball */}
        {flyingBall&&(()=>{
          const c=BALL_COLORS[flyingBall.colorIdx];
          return (
            <div className="absolute flex items-center justify-center pointer-events-none"
              style={{
                left:flyingBall.x-BALL_RADIUS,top:flyingBall.y-BALL_RADIUS,
                width:BALL_RADIUS*2,height:BALL_RADIUS*2,borderRadius:"50%",
                background:flyingBall.ghost
                  ?`radial-gradient(circle,rgba(255,255,255,0.3),rgba(155,93,229,0.4))`
                  :`radial-gradient(circle at 35% 35%,${c.glow} 0%,${c.color} 60%,rgba(0,0,0,0.3) 100%)`,
                boxShadow:flyingBall.ghost
                  ?`0 0 20px rgba(155,93,229,0.8),0 0 40px rgba(255,255,255,0.2)`
                  :`0 0 16px ${c.color},0 0 32px ${c.glow}60`,
                border:flyingBall.ghost?`2px solid rgba(255,255,255,0.6)`:`2px solid ${c.glow}`,
                fontSize:12,zIndex:10,opacity:flyingBall.ghost?0.7:1,
              }}>
              {flyingBall.ghost?"👻":c.label}
            </div>
          );
        })()}

        {/* Particles */}
        {particles.map(p=>{
          const c=BALL_COLORS[p.colorIdx];
          return (
            <div key={p.id} className="absolute rounded-full pointer-events-none"
              style={{
                left:p.x-p.size/2,top:p.y-p.size/2,width:p.size,height:p.size,
                background:p.gold?"#FFD700":c.glow,
                boxShadow:`0 0 ${p.size*2}px ${p.gold?"#D4AF37":c.color}`,
                opacity:p.life,zIndex:15,
              }}/>
          );
        })}

        {/* Fog overlay */}
        {fogActive&&(
          <div className="absolute inset-0 pointer-events-none" style={{
            background:fogReveal
              ?`radial-gradient(circle ${BALL_RADIUS*6}px at ${fogReveal.x}px ${fogReveal.y}px,transparent 40%,rgba(5,3,16,0.85) 100%)`
              :"rgba(5,3,16,0.85)",zIndex:6}}/>
        )}

        {/* Combo */}
        {showCombo&&(
          <div className="absolute inset-x-0 top-1/3 flex justify-center pointer-events-none" style={{zIndex:25}}>
            <div className="font-cinzel text-2xl font-bold text-gold-gradient"
              style={{textShadow:"0 0 20px rgba(212,175,55,0.8)",animation:"scale-in 0.3s ease-out"}}>
              {showCombo}
            </div>
          </div>
        )}

        {/* Ceiling glow */}
        <div className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
          style={{background:"linear-gradient(90deg,transparent,rgba(155,93,229,0.5),rgba(212,175,55,0.3),rgba(155,93,229,0.5),transparent)",zIndex:4}}/>

        {/* Game Over / Win */}
        {(gameOver||win)&&(
          <div className="absolute inset-0 flex items-center justify-center" style={{background:"rgba(10,5,20,0.9)",zIndex:50}}>
            <div className="text-center px-8 py-8 rounded-3xl"
              style={{background:"linear-gradient(135deg,rgba(45,27,78,0.97),rgba(26,13,46,0.99))",
                border:`2px solid ${win?"rgba(212,175,55,0.6)":"rgba(255,107,53,0.5)"}`}}>
              <div className="text-5xl mb-3">{win?"🏆":"💀"}</div>
              <h2 className="font-cinzel text-xl font-bold mb-2" style={{color:win?"#FFD700":"#FF6B35"}}>
                {win?"ПОБЕДА!":"ПОРАЖЕНИЕ"}
              </h2>
              <p className="font-cormorant text-sm mb-1" style={{color:"rgba(212,175,55,0.7)"}}>
                {win?"Все шары уничтожены!":hp<=0?"Мины уничтожили тебя":"Шары дошли до земли"}
              </p>
              <p className="font-cinzel text-2xl font-bold mb-1" style={{color:"#FFD700"}}>{score} очков</p>
              <p className="font-cormorant text-xs mb-4" style={{color:"rgba(155,93,229,0.5)"}}>💰 {coins} монет · {shots} выстрелов</p>
              <div className="flex gap-3 justify-center">
                <button onClick={resetGame} className="btn-arcane px-5 py-2 rounded-xl text-sm">СНОВА</button>
                <button onClick={onBack} className="px-5 py-2 rounded-xl text-sm font-cinzel"
                  style={{background:"rgba(155,93,229,0.15)",border:"1px solid rgba(155,93,229,0.4)",color:"#D4AF37"}}>ВЫЙТИ</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom launcher ── */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2"
        style={{background:"rgba(10,5,20,0.97)",borderTop:"1px solid rgba(155,93,229,0.25)"}}>
        <div className="flex items-center justify-between max-w-xs mx-auto">

          {/* Queue */}
          <div className="flex flex-col items-center gap-1">
            <div className="font-cormorant text-xs" style={{color:"rgba(155,93,229,0.5)"}}>Очередь</div>
            <div className="flex gap-1 items-end">
              {queue.slice(1,5).map((ci,i)=>(
                <div key={i} className="rounded-full flex items-center justify-center"
                  style={{
                    width:Math.max(14,26-i*4),height:Math.max(14,26-i*4),
                    background:`radial-gradient(circle,${BALL_COLORS[ci].glow},${BALL_COLORS[ci].color})`,
                    opacity:1-i*0.2,fontSize:7,
                  }}>
                  {BALL_COLORS[ci].label}
                </div>
              ))}
            </div>
          </div>

          {/* Shooter */}
          <div className="text-center">
            <div className="font-cormorant text-xs mb-1" style={{color:"rgba(212,175,55,0.55)"}}>
              {twinPending?"👯 БЛИЗНЕЦЫ":"Целься и стреляй"}
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto"
              style={{
                background:`radial-gradient(circle at 35% 35%,${BALL_COLORS[currentColor].glow} 0%,${BALL_COLORS[currentColor].color} 70%)`,
                boxShadow:`0 0 20px ${BALL_COLORS[currentColor].color},0 0 40px ${BALL_COLORS[currentColor].glow}50`,
                border:`2px solid ${BALL_COLORS[currentColor].glow}80`,
              }}>
              {BALL_COLORS[currentColor].label}
            </div>
          </div>

          {/* Stats */}
          <div className="text-center">
            <div className="font-cormorant text-xs" style={{color:"rgba(155,93,229,0.5)"}}>На поле</div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-cinzel font-bold text-sm mx-auto mt-1"
              style={{background:"rgba(155,93,229,0.15)",border:"1px solid rgba(155,93,229,0.3)",color:"#D4AF37"}}>
              {aliveBalls.length}
            </div>
            <div className="font-cormorant text-xs mt-0.5" style={{color:"rgba(155,93,229,0.4)"}}>{shots} выстр.</div>
          </div>
        </div>
      </div>
    </div>
  );
}