import { useState, useEffect } from "react";
import Icon from "@/components/ui/icon";

const HERO_IMAGE = "https://cdn.poehali.dev/projects/75b4526e-aa6b-4abe-93b6-626aa7a72949/files/46d29280-e116-48bc-9990-4938452da2f5.jpg";
const AMULET_IMAGE = "https://cdn.poehali.dev/projects/75b4526e-aa6b-4abe-93b6-626aa7a72949/files/dee5a8e9-a7fa-4016-a829-fe2cd5203573.jpg";

type Page = "home" | "levels" | "workshop" | "amulets" | "profile" | "shop" | "achievements";

const navItems: { id: Page; label: string; emoji: string }[] = [
  { id: "home", label: "Главная", emoji: "🏠" },
  { id: "levels", label: "Уровни", emoji: "⚔️" },
  { id: "workshop", label: "Мастерская", emoji: "🔨" },
  { id: "amulets", label: "Амулеты", emoji: "💎" },
  { id: "profile", label: "Профиль", emoji: "👤" },
  { id: "shop", label: "Магазин", emoji: "🛍️" },
  { id: "achievements", label: "Достижения", emoji: "🏆" },
];

function MagicParticle({ x, y, delay }: { x: number; y: number; delay: number }) {
  const symbols = ["✦", "✧", "◈", "⬡", "᛫"];
  const sym = symbols[Math.floor(Math.random() * symbols.length)];
  return (
    <div
      className="absolute pointer-events-none select-none opacity-20"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        color: Math.random() > 0.5 ? "#D4AF37" : "#9B5DE5",
        animation: `float-particle ${4 + Math.random() * 4}s ease-in-out ${delay}s infinite`,
        fontSize: `${8 + Math.random() * 8}px`,
      }}
    >
      {sym}
    </div>
  );
}

function MagicBackground() {
  const particles = Array.from({ length: 25 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: Math.random() * 5,
    id: i,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 20% 20%, rgba(123,47,190,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(212,175,55,0.08) 0%, transparent 50%)" }} />
      {particles.map((p) => <MagicParticle key={p.id} x={p.x} y={p.y} delay={p.delay} />)}
    </div>
  );
}

function Header({ gold, gems, level }: { gold: number; gems: number; level: number }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50" style={{ background: "rgba(10,5,20,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(155,93,229,0.2)" }}>
      <div className="flex items-center justify-between px-4 py-2 max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full animate-glow flex items-center justify-center text-base" style={{ background: "linear-gradient(135deg, #7B2FBE, #9B5DE5)" }}>✦</div>
          <h1 className="font-cinzel text-sm font-bold text-gold-gradient">ARCANE BURST</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-cinzel" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)" }}>
            <span>⚡</span><span className="text-yellow-300">{gold.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-cinzel" style={{ background: "rgba(155,93,229,0.1)", border: "1px solid rgba(155,93,229,0.3)" }}>
            <span>💎</span><span style={{ color: "#9B5DE5" }}>{gems}</span>
          </div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-cinzel font-bold" style={{ background: "linear-gradient(135deg, #D4AF37, #8B6914)", color: "#1a0d2e" }}>{level}</div>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ active, onNav }: { active: Page; onNav: (p: Page) => void }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: "rgba(10,5,20,0.96)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(155,93,229,0.2)" }}>
      <div className="flex justify-around max-w-md mx-auto">
        {navItems.map((item) => (
          <button key={item.id} onClick={() => onNav(item.id)} className={`nav-item ${active === item.id ? "active" : ""}`}>
            <span className="text-lg">{item.emoji}</span>
            <span className="text-[9px]">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function HomePage({ onNav }: { onNav: (p: Page) => void }) {
  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden animate-fade-in-up" style={{ minHeight: 220 }}>
        <img src={HERO_IMAGE} alt="Arcane Burst" className="w-full h-56 object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,5,20,0.96) 0%, rgba(10,5,20,0.4) 50%, transparent 100%)" }} />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="font-cinzel text-2xl font-bold text-gold-gradient mb-1">Arcane Burst</h2>
          <p className="font-cormorant text-sm" style={{ color: "rgba(212,175,55,0.7)" }}>Магический шутер с шарами судьбы</p>
          <button className="btn-gold mt-3 px-6 py-2 rounded-full text-sm" onClick={() => onNav("levels")}>ИГРАТЬ</button>
        </div>
      </div>

      <div className="magic-card rounded-2xl p-4 animate-fade-in-up stagger-1 opacity-0-init">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-sm font-bold" style={{ color: "#D4AF37" }}>⚡ Ежедневные квесты</h3>
          <span className="text-xs font-cormorant" style={{ color: "rgba(155,93,229,0.8)" }}>22:14:33</span>
        </div>
        {[
          { name: "Пройди 3 уровня", reward: "300 ⚡", progress: 66, done: false },
          { name: "Уничтожь 50 шаров", reward: "1 💎", progress: 100, done: true },
          { name: "Используй 5 амулетов", reward: "150 ⚡", progress: 40, done: false },
        ].map((q, i) => (
          <div key={i} className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="font-cormorant text-sm" style={{ color: q.done ? "rgba(212,175,55,0.4)" : "rgba(220,200,255,0.9)", textDecoration: q.done ? "line-through" : "none" }}>
                {q.done ? "✓ " : ""}{q.name}
              </span>
              <span className="text-xs font-cinzel" style={{ color: "#D4AF37" }}>{q.reward}</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(155,93,229,0.15)" }}>
              <div className="h-full rounded-full progress-arcane" style={{ width: `${q.progress}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="magic-card rounded-2xl p-4 animate-fade-in-up stagger-2 opacity-0-init" style={{ border: "1px solid rgba(212,175,55,0.4)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cinzel text-sm font-bold" style={{ color: "#FFD700" }}>👑 Боевой Пропуск</h3>
          <span className="text-xs font-cinzel px-2 py-0.5 rounded-full" style={{ background: "rgba(212,175,55,0.2)", color: "#FFD700" }}>Сезон III</span>
        </div>
        <p className="font-cormorant text-xs mb-2" style={{ color: "rgba(212,175,55,0.6)" }}>Уровень пропуска: 24 / 100</p>
        <div className="w-full h-3 rounded-full" style={{ background: "rgba(26,13,46,0.8)", border: "1px solid rgba(212,175,55,0.2)" }}>
          <div className="h-full rounded-full progress-arcane" style={{ width: "24%" }} />
        </div>
        <div className="flex justify-around mt-3 mb-3">
          {[{ e: "🗡️", lv: 25 }, { e: "🌟", lv: 50 }, { e: "👑", lv: 100 }].map((r, i) => (
            <div key={i} className="text-center">
              <div className="text-xl">{r.e}</div>
              <div className="text-[9px] font-cinzel" style={{ color: "rgba(212,175,55,0.5)" }}>Lv.{r.lv}</div>
            </div>
          ))}
        </div>
        <button className="btn-arcane w-full py-2 rounded-xl text-xs">ПОЛУЧИТЬ ПРОПУСК — 490 💎</button>
      </div>

      <div className="rounded-2xl p-4 animate-fade-in-up stagger-3 opacity-0-init relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(255,107,53,0.12), rgba(26,13,46,0.9))", border: "1px solid rgba(255,107,53,0.3)" }}>
        <div className="absolute top-2 right-2 text-3xl opacity-20">🔥</div>
        <h3 className="font-cinzel text-sm font-bold mb-1" style={{ color: "#FF6B35" }}>🔥 Сезонное событие</h3>
        <p className="font-cormorant text-sm" style={{ color: "rgba(255,160,100,0.8)" }}>«Пламя Дракона» — осталось 7 дней</p>
        <p className="font-cormorant text-xs mt-0.5 mb-3" style={{ color: "rgba(255,160,100,0.5)" }}>Собери 500 огненных осколков для легендарного скина</p>
        <button className="px-4 py-1.5 rounded-full text-xs font-cinzel" style={{ background: "rgba(255,107,53,0.15)", border: "1px solid rgba(255,107,53,0.4)", color: "#FF6B35" }}>УЧАСТВОВАТЬ</button>
      </div>
    </div>
  );
}

function LevelsPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const worlds = [
    { name: "Мистический лес", levels: 10, cleared: 7, color: "#2ecc71", icon: "🌿" },
    { name: "Руины Древних", levels: 10, cleared: 3, color: "#9B5DE5", icon: "🏛️" },
    { name: "Огненные горы", levels: 10, cleared: 0, color: "#FF6B35", icon: "🌋", locked: true },
  ];
  return (
    <div className="space-y-4">
      <div className="animate-fade-in-up">
        <h2 className="font-cinzel text-xl font-bold text-gold-gradient mb-1">Карта Миров</h2>
        <p className="font-cormorant text-sm" style={{ color: "rgba(212,175,55,0.5)" }}>Исследуй магические земли</p>
      </div>
      {worlds.map((world, wi) => (
        <div key={wi} className={`magic-card rounded-2xl p-4 animate-fade-in-up stagger-${wi + 1} opacity-0-init ${world.locked ? "opacity-50" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{world.icon}</span>
              <div>
                <h3 className="font-cinzel text-sm font-bold" style={{ color: world.locked ? "rgba(150,130,180,0.5)" : "#D4AF37" }}>{world.name}</h3>
                <p className="font-cormorant text-xs" style={{ color: "rgba(155,93,229,0.6)" }}>{world.cleared}/{world.levels} пройдено</p>
              </div>
            </div>
            {world.locked ? <span className="text-2xl">🔒</span> : (
              <div className="text-xs font-cinzel px-2 py-1 rounded-full" style={{ background: "rgba(46,204,113,0.1)", color: "#2ecc71", border: "1px solid rgba(46,204,113,0.3)" }}>
                {Math.round((world.cleared / world.levels) * 100)}%
              </div>
            )}
          </div>
          <div className="w-full h-1.5 rounded-full mb-3" style={{ background: "rgba(155,93,229,0.15)" }}>
            <div className="h-full rounded-full" style={{ width: `${(world.cleared / world.levels) * 100}%`, background: world.color }} />
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: world.levels }, (_, i) => {
              const done = i < world.cleared;
              const current = i === world.cleared && !world.locked;
              return (
                <button key={i} disabled={world.locked || i > world.cleared}
                  onClick={() => setSelected(wi * 10 + i)}
                  className="aspect-square rounded-lg flex items-center justify-center text-xs font-cinzel font-bold transition-all"
                  style={{
                    background: done ? `${world.color}22` : "rgba(26,13,46,0.6)",
                    border: `1px solid ${done ? world.color : current ? "rgba(212,175,55,0.5)" : "rgba(155,93,229,0.15)"}`,
                    color: done ? world.color : current ? "#FFD700" : "rgba(150,130,180,0.3)",
                    transform: selected === wi * 10 + i ? "scale(1.1)" : "scale(1)",
                  }}
                >{done ? "★" : current ? "▶" : i + 1}</button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkshopPage() {
  const [upgrades, setUpgrades] = useState({ speed: 3, ricochet: 2, bonus: 1, power: 4 });
  const maxLevel = 10;
  const items = [
    { key: "speed" as const, icon: "💨", name: "Скорость полёта", desc: "Шарики летят быстрее и точнее", cost: 250 },
    { key: "ricochet" as const, icon: "🔄", name: "Дальность рикошета", desc: "Больше отскоков от стен", cost: 400 },
    { key: "bonus" as const, icon: "✨", name: "Бонусные шары", desc: "Шанс дополнительных шаров", cost: 600 },
    { key: "power" as const, icon: "⚡", name: "Сила удара", desc: "Больше урона каждому шарику", cost: 350 },
  ];
  return (
    <div className="space-y-4">
      <div className="animate-fade-in-up">
        <h2 className="font-cinzel text-xl font-bold text-gold-gradient mb-1">Мастерская</h2>
        <p className="font-cormorant text-sm" style={{ color: "rgba(212,175,55,0.5)" }}>Усиль рогатку силой древних рун</p>
      </div>
      <div className="magic-card rounded-2xl p-4 animate-fade-in-up stagger-1 opacity-0-init flex items-center gap-4">
        <div className="w-20 h-20 rounded-xl flex items-center justify-center text-4xl" style={{ background: "linear-gradient(135deg, rgba(123,47,190,0.3), rgba(26,13,46,0.8))", border: "1px solid rgba(212,175,55,0.4)" }}>🏹</div>
        <div>
          <h3 className="font-cinzel text-base font-bold" style={{ color: "#FFD700" }}>Рунная Рогатка</h3>
          <p className="font-cormorant text-sm" style={{ color: "rgba(212,175,55,0.5)" }}>Легендарное оружие Архимага</p>
          <div className="flex gap-1 mt-1">{["🔥", "💧", "⚡", "🌿"].map((e, i) => <span key={i}>{e}</span>)}</div>
        </div>
      </div>
      {items.map((item, i) => {
        const level = upgrades[item.key];
        return (
          <div key={item.key} className={`magic-card rounded-2xl p-4 animate-fade-in-up stagger-${i + 2} opacity-0-init`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <h4 className="font-cinzel text-xs font-bold" style={{ color: "#D4AF37" }}>{item.name}</h4>
                  <p className="font-cormorant text-xs" style={{ color: "rgba(155,93,229,0.6)" }}>{item.desc}</p>
                </div>
              </div>
              <span className="font-cinzel text-sm font-bold" style={{ color: "#FFD700" }}>Ур. {level}</span>
            </div>
            <div className="flex gap-1 mb-3">
              {Array.from({ length: maxLevel }, (_, j) => (
                <div key={j} className="h-1.5 flex-1 rounded-full" style={{ background: j < level ? "linear-gradient(90deg, #9B5DE5, #FFD700)" : "rgba(155,93,229,0.15)" }} />
              ))}
            </div>
            <button
              className="btn-arcane w-full py-1.5 rounded-xl text-xs"
              disabled={level >= maxLevel}
              onClick={() => setUpgrades(prev => ({ ...prev, [item.key]: Math.min(maxLevel, prev[item.key] + 1) }))}
            >
              УЛУЧШИТЬ — {item.cost} ⚡
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AmuletsPage() {
  const [equipped, setEquipped] = useState<number[]>([0, 2]);
  const amulets = [
    { name: "Амулет Замедления", effect: "+15% к длительности замедления", rarity: "Редкий", icon: "🌀", color: "#00B4D8" },
    { name: "Кольцо Хаоса", effect: "Случайный бонус каждый раунд", rarity: "Эпический", icon: "💜", color: "#9B5DE5" },
    { name: "Фамильяр Огня", effect: "+20% к огненным шарам", rarity: "Обычный", icon: "🔥", color: "#FF6B35" },
    { name: "Печать Дракона", effect: "Цепные реакции +30%", rarity: "Легендарный", icon: "🐉", color: "#D4AF37" },
    { name: "Слеза Феникса", effect: "Воскрешение раз в бой", rarity: "Легендарный", icon: "🌟", color: "#FFD700" },
    { name: "Тень Ворона", effect: "+25% к рикошетам", rarity: "Редкий", icon: "🪶", color: "#8B8B8B" },
  ];
  const rarityColor: Record<string, string> = { "Обычный": "rgba(150,150,150,0.7)", "Редкий": "#00B4D8", "Эпический": "#9B5DE5", "Легендарный": "#D4AF37" };
  const toggle = (idx: number) => {
    if (equipped.includes(idx)) setEquipped(equipped.filter(e => e !== idx));
    else if (equipped.length < 3) setEquipped([...equipped, idx]);
  };
  return (
    <div className="space-y-4">
      <div className="animate-fade-in-up">
        <h2 className="font-cinzel text-xl font-bold text-gold-gradient mb-1">Амулеты</h2>
        <p className="font-cormorant text-sm" style={{ color: "rgba(212,175,55,0.5)" }}>Экипируй до 3 амулетов перед боем</p>
      </div>
      <div className="magic-card rounded-2xl p-4 animate-fade-in-up stagger-1 opacity-0-init">
        <h3 className="font-cinzel text-xs font-bold mb-3" style={{ color: "#D4AF37" }}>⚔️ ЭКИПИРОВАНО ({equipped.length}/3)</h3>
        <div className="flex gap-3 mb-3">
          {[0, 1, 2].map(i => {
            const a = equipped[i] !== undefined ? amulets[equipped[i]] : null;
            return (
              <div key={i} className="flex-1 aspect-square rounded-xl flex flex-col items-center justify-center p-2 transition-all"
                style={{ background: a ? `${a.color}18` : "rgba(26,13,46,0.5)", border: `2px dashed ${a ? a.color : "rgba(155,93,229,0.2)"}` }}>
                {a ? (<><span className="text-2xl">{a.icon}</span><span className="font-cinzel text-[8px] mt-1 text-center" style={{ color: a.color }}>{a.name}</span></>) : <span className="text-xl opacity-20">+</span>}
              </div>
            );
          })}
        </div>
        <img src={AMULET_IMAGE} alt="" className="w-full h-20 object-cover rounded-xl opacity-30" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {amulets.map((a, i) => {
          const isEquipped = equipped.includes(i);
          return (
            <div key={i} className={`magic-card rounded-xl p-3 animate-fade-in-up stagger-${(i % 3) + 2} opacity-0-init`}
              style={{ border: `1px solid ${isEquipped ? a.color : "rgba(155,93,229,0.2)"}`, boxShadow: isEquipped ? `0 0 15px ${a.color}25` : "none" }}>
              <div className="flex items-start justify-between mb-1">
                <span className="text-2xl">{a.icon}</span>
                <span className="text-[9px] font-cinzel px-1.5 py-0.5 rounded-full" style={{ background: `${rarityColor[a.rarity]}18`, color: rarityColor[a.rarity], border: `1px solid ${rarityColor[a.rarity]}40` }}>{a.rarity}</span>
              </div>
              <h4 className="font-cinzel text-xs font-bold mb-0.5" style={{ color: "#D4AF37" }}>{a.name}</h4>
              <p className="font-cormorant text-xs mb-2" style={{ color: "rgba(200,180,255,0.7)" }}>{a.effect}</p>
              <button onClick={() => toggle(i)} className="w-full py-1 rounded-lg text-[10px] font-cinzel transition-all"
                style={{ background: isEquipped ? `${a.color}18` : "rgba(155,93,229,0.1)", border: `1px solid ${isEquipped ? a.color : "rgba(155,93,229,0.3)"}`, color: isEquipped ? a.color : "rgba(212,175,55,0.7)" }}>
                {isEquipped ? "✓ СНЯТЬ" : "НАДЕТЬ"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePage() {
  const stats = [
    { label: "Уровней пройдено", value: "127", icon: "⚔️" },
    { label: "Шаров уничтожено", value: "15,240", icon: "💥" },
    { label: "Лучшая серия", value: "47", icon: "🔥" },
    { label: "Дней в игре", value: "34", icon: "📅" },
  ];
  return (
    <div className="space-y-4">
      <div className="magic-card rounded-2xl p-6 animate-fade-in-up text-center" style={{ border: "1px solid rgba(212,175,55,0.3)" }}>
        <div className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-4xl animate-glow" style={{ background: "linear-gradient(135deg, #7B2FBE, #D4AF37)" }}>🧙</div>
        <h2 className="font-cinzel text-lg font-bold text-gold-gradient">Архимаг Велион</h2>
        <p className="font-cormorant text-sm mt-1" style={{ color: "rgba(155,93,229,0.7)" }}>Хранитель Рунных Камней</p>
        <div className="flex justify-center gap-2 mt-2">{["🏆", "⚔️", "🌟"].map((b, i) => <span key={i} className="text-lg">{b}</span>)}</div>
        <div className="mt-4">
          <div className="flex justify-between text-xs font-cinzel mb-1" style={{ color: "rgba(212,175,55,0.6)" }}>
            <span>Уровень 42</span><span>7,430 / 10,000 XP</span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: "rgba(26,13,46,0.8)", border: "1px solid rgba(212,175,55,0.2)" }}>
            <div className="h-full rounded-full progress-arcane" style={{ width: "74%" }} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <div key={i} className={`magic-card rounded-xl p-3 text-center animate-fade-in-up stagger-${i + 1} opacity-0-init`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="font-cinzel text-lg font-bold" style={{ color: "#FFD700" }}>{s.value}</div>
            <div className="font-cormorant text-xs" style={{ color: "rgba(155,93,229,0.6)" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="magic-card rounded-2xl p-4 animate-fade-in-up stagger-5 opacity-0-init">
        <h3 className="font-cinzel text-sm font-bold mb-3" style={{ color: "#D4AF37" }}>📚 Коллекция карточек</h3>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["🔮", "💫", "🌙", "⚡", "🌊", "🔥"].map((c, i) => (
            <div key={i} className="flex-shrink-0 w-14 h-20 rounded-xl flex flex-col items-center justify-center gap-1 text-2xl"
              style={{ background: "linear-gradient(135deg, rgba(123,47,190,0.3), rgba(26,13,46,0.8))", border: "1px solid rgba(155,93,229,0.3)" }}>
              {c}
              <div className="text-[8px] font-cinzel" style={{ color: "rgba(212,175,55,0.5)" }}>★★★</div>
            </div>
          ))}
        </div>
        <p className="font-cormorant text-xs mt-2" style={{ color: "rgba(155,93,229,0.5)" }}>6 / 24 карточки собрано</p>
      </div>
    </div>
  );
}

function ShopPage() {
  const items = [
    { name: "Мешок кристаллов", desc: "80 💎 — самый популярный", price: "149 ₽", icon: "💎", hot: true },
    { name: "Стартовый набор", desc: "500 ⚡ + 10 💎 + амулет", price: "99 ₽", icon: "🎁", hot: false },
    { name: "Боевой пропуск III", desc: "100 уровней наград", price: "490 💎", icon: "👑", hot: true },
    { name: "Скин «Дракон»", desc: "Легендарный облик рогатки", price: "200 💎", icon: "🐉", hot: false },
    { name: "Буст опыта ×2", desc: "На 24 часа", price: "50 💎", icon: "⚡", hot: false },
    { name: "Сундук удачи", desc: "Случайный легендарный предмет", price: "100 💎", icon: "📦", hot: false },
  ];
  return (
    <div className="space-y-4">
      <div className="animate-fade-in-up">
        <h2 className="font-cinzel text-xl font-bold text-gold-gradient mb-1">Магазин</h2>
        <p className="font-cormorant text-sm" style={{ color: "rgba(212,175,55,0.5)" }}>Могущество за один клик</p>
      </div>
      <div className="magic-card rounded-2xl p-4 animate-fade-in-up stagger-1 opacity-0-init">
        <h3 className="font-cinzel text-xs font-bold mb-3" style={{ color: "#D4AF37" }}>💎 ПОПОЛНИТЬ КРИСТАЛЛЫ</h3>
        <div className="grid grid-cols-3 gap-2">
          {[{ gems: 30, price: "59 ₽" }, { gems: 80, price: "149 ₽", popular: true }, { gems: 180, price: "299 ₽" }].map((p, i) => (
            <button key={i} className="rounded-xl p-2 text-center transition-all relative"
              style={{ background: p.popular ? "rgba(212,175,55,0.15)" : "rgba(26,13,46,0.6)", border: `1px solid ${p.popular ? "rgba(212,175,55,0.5)" : "rgba(155,93,229,0.2)"}` }}>
              {p.popular && <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-cinzel px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: "#D4AF37", color: "#1a0d2e" }}>ХИТ</div>}
              <div className="text-xl mb-0.5">💎</div>
              <div className="font-cinzel text-sm font-bold" style={{ color: "#FFD700" }}>{p.gems}</div>
              <div className="font-cormorant text-xs" style={{ color: "rgba(212,175,55,0.6)" }}>{p.price}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div key={i} className={`magic-card rounded-xl p-3 animate-fade-in-up stagger-${(i % 3) + 2} opacity-0-init relative`}>
            {item.hot && <div className="absolute top-2 right-2 text-[8px] font-cinzel px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,107,53,0.2)", color: "#FF6B35", border: "1px solid rgba(255,107,53,0.4)" }}>🔥 ХИТТ</div>}
            <div className="text-2xl mb-1">{item.icon}</div>
            <h4 className="font-cinzel text-xs font-bold" style={{ color: "#D4AF37" }}>{item.name}</h4>
            <p className="font-cormorant text-xs mt-0.5 mb-2" style={{ color: "rgba(200,180,255,0.6)" }}>{item.desc}</p>
            <button className="btn-arcane w-full py-1.5 rounded-lg text-xs">{item.price}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AchievementsPage() {
  const achievements = [
    { name: "Первая кровь", desc: "Пройди первый уровень", icon: "⚔️", done: true, reward: "50 ⚡", progress: 1, total: 1 },
    { name: "Снайпер", desc: "10 идеальных выстрелов подряд", icon: "🎯", done: true, reward: "200 ⚡", progress: 10, total: 10 },
    { name: "Коллекционер", desc: "Собери 10 карточек", icon: "📚", done: false, reward: "1 💎", progress: 6, total: 10 },
    { name: "Алхимик", desc: "Улучши все характеристики до 5", icon: "⚗️", done: false, reward: "5 💎", progress: 2, total: 4 },
    { name: "Бессмертный", desc: "Пройди уровень без потерь", icon: "🛡️", done: true, reward: "300 ⚡", progress: 1, total: 1 },
    { name: "Легенда", desc: "Достигни 50-го уровня профиля", icon: "👑", done: false, reward: "Скин", progress: 42, total: 50 },
    { name: "Стихии", desc: "Используй все 4 стихии", icon: "🌊", done: true, reward: "100 ⚡", progress: 4, total: 4 },
    { name: "Охотник за рунами", desc: "Собери 50 рунических фрагментов", icon: "🔮", done: false, reward: "Амулет", progress: 23, total: 50 },
  ];
  const done = achievements.filter(a => a.done).length;
  return (
    <div className="space-y-4">
      <div className="animate-fade-in-up">
        <h2 className="font-cinzel text-xl font-bold text-gold-gradient mb-1">Достижения</h2>
        <p className="font-cormorant text-sm" style={{ color: "rgba(212,175,55,0.5)" }}>{done} / {achievements.length} получено</p>
      </div>
      <div className="magic-card rounded-2xl p-4 animate-fade-in-up stagger-1 opacity-0-init">
        <div className="w-full h-2 rounded-full" style={{ background: "rgba(26,13,46,0.8)", border: "1px solid rgba(212,175,55,0.2)" }}>
          <div className="h-full rounded-full progress-arcane" style={{ width: `${(done / achievements.length) * 100}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-xs font-cinzel" style={{ color: "rgba(212,175,55,0.5)" }}>
          <span>Общий прогресс</span><span>{Math.round((done / achievements.length) * 100)}%</span>
        </div>
      </div>
      <div className="space-y-2">
        {achievements.map((a, i) => (
          <div key={i} className={`magic-card rounded-xl p-3 animate-fade-in-up stagger-${(i % 3) + 1} opacity-0-init flex items-center gap-3 ${a.done ? "" : "opacity-70"}`}
            style={{ border: a.done ? "1px solid rgba(212,175,55,0.4)" : "1px solid rgba(155,93,229,0.2)" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: a.done ? "rgba(212,175,55,0.15)" : "rgba(26,13,46,0.6)", border: a.done ? "1px solid rgba(212,175,55,0.3)" : "1px solid rgba(155,93,229,0.2)" }}>
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-cinzel text-xs font-bold" style={{ color: a.done ? "#FFD700" : "rgba(200,180,255,0.6)" }}>{a.name}</h4>
                <span className="text-xs font-cinzel ml-2 flex-shrink-0" style={{ color: a.done ? "#D4AF37" : "rgba(155,93,229,0.4)" }}>{a.reward}</span>
              </div>
              <p className="font-cormorant text-xs" style={{ color: "rgba(155,93,229,0.5)" }}>{a.desc}</p>
              {!a.done && (
                <div className="w-full h-1 rounded-full mt-1" style={{ background: "rgba(155,93,229,0.2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(a.progress / a.total) * 100}%`, background: "linear-gradient(90deg, #9B5DE5, #D4AF37)" }} />
                </div>
              )}
            </div>
            {a.done && <span className="text-green-400 text-sm flex-shrink-0">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [page]);

  const renderPage = () => {
    switch (page) {
      case "home": return <HomePage onNav={setPage} />;
      case "levels": return <LevelsPage />;
      case "workshop": return <WorkshopPage />;
      case "amulets": return <AmuletsPage />;
      case "profile": return <ProfilePage />;
      case "shop": return <ShopPage />;
      case "achievements": return <AchievementsPage />;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at top, #1a0d2e 0%, #0d0818 50%, #050310 100%)" }}>
      <MagicBackground />
      <Header gold={12500} gems={340} level={42} />
      <main className="relative z-10 pt-16 pb-24 px-4 max-w-md mx-auto">{renderPage()}</main>
      <BottomNav active={page} onNav={setPage} />
    </div>
  );
}
