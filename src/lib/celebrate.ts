/**
 * Task-completion celebration: a confetti burst + a short "well done" chime.
 *
 * Deliberately dependency-free — the confetti is drawn on a throwaway <canvas>
 * and the chime is synthesised with the Web Audio API, so there is no npm
 * package to install and no audio file to host.
 *
 * Both respect the user's preferences: motion honours `prefers-reduced-motion`,
 * and sound is remembered per-browser via localStorage (see `isSoundOn`).
 */

const SOUND_KEY = "wz.celebrate.sound";

export function isSoundOn() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SOUND_KEY) !== "off";
}

export function setSoundOn(on: boolean) {
  window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * A warm three-note arpeggio (C6-E6-G6) on triangle waves — reads as
 * "nice work" rather than a system alert. Each note gets its own gain
 * envelope so it swells and fades instead of clicking.
 */
export function playCheer() {
  if (!isSoundOn()) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    [1046.5, 1318.5, 1568.0].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = now + i * 0.1;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, at);

      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.22, at + 0.02); // quick swell
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.45); // gentle tail

      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.5);
    });

    // Release the audio device once the last note has rung out.
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    // Audio is a nicety — never let it break completing a task.
  }
}

type Piece = {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rot: number; vr: number;
};

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#a855f7"];

/**
 * Fires confetti from the centre-bottom of the viewport. Draws to a fixed,
 * pointer-events:none canvas that removes itself when the animation ends.
 */
export function fireConfetti(count = 90) {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;

  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.cssText =
    `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(dpr, dpr);

  const pieces: Piece[] = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2; // upward fan
    const speed = 9 + Math.random() * 9;
    return {
      x: w / 2 + (Math.random() - 0.5) * 140,
      y: h * 0.72,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    };
  });

  const GRAVITY = 0.32;
  const DRAG = 0.99;
  let frame = 0;

  function tick() {
    frame += 1;
    ctx!.clearRect(0, 0, w, h);
    let alive = false;

    for (const p of pieces) {
      p.vy += GRAVITY;
      p.vx *= DRAG;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y < h + 40) alive = true;

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.globalAlpha = Math.max(0, 1 - frame / 130); // fade out together
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx!.restore();
    }

    if (alive && frame < 130) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(tick);
}

/** Confetti + chime together — call when a task is marked done. */
export function celebrate() {
  fireConfetti();
  playCheer();
}
