import { useEffect, useRef } from 'react';

// ─── Perlin-style 2D noise ─────────────────────────────────
class Noise {
    private p: Uint8Array;
    constructor(seed = 77) {
        const b = new Uint8Array(256);
        for (let i = 0; i < 256; i++) b[i] = i;
        let s = seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807) % 2147483647;
            const j = s % (i + 1);
            [b[i], b[j]] = [b[j], b[i]];
        }
        this.p = new Uint8Array(512);
        for (let i = 0; i < 512; i++) this.p[i] = b[i & 255];
    }
    private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
    private lerp(a: number, b: number, t: number) { return a + t * (b - a); }
    private grad(h: number, x: number, y: number) {
        const v = h & 3;
        return ((v & 1) ? -x : x) + ((v & 2) ? -y : y);
    }
    get(x: number, y: number): number {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x), yf = y - Math.floor(y);
        const u = this.fade(xf), v = this.fade(yf);
        const aa = this.p[this.p[X] + Y], ab = this.p[this.p[X] + Y + 1];
        const ba = this.p[this.p[X + 1] + Y], bb = this.p[this.p[X + 1] + Y + 1];
        return this.lerp(
            this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u),
            this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u), v);
    }
    /** Layered noise for richer organic patterns */
    fbm(x: number, y: number, oct = 3): number {
        let v = 0, a = 1, f = 1, m = 0;
        for (let i = 0; i < oct; i++) { v += this.get(x * f, y * f) * a; m += a; a *= 0.5; f *= 2; }
        return v / m;
    }
}

// ─── Color gradient: Blue → Emerald ─────────────────────────
function dotColor(xRatio: number, alpha: number): string {
    // Blue #3b82f6 → Emerald #10b981
    const r = Math.round(59 + (16 - 59) * xRatio);
    const g = Math.round(130 + (185 - 130) * xRatio);
    const b = Math.round(246 + (129 - 246) * xRatio);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Component ──────────────────────────────────────────────
export default function ParticleNoiseBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef(0);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const noise = new Noise(77);

        // ── Tunables ────────────────────────────
        const SPACING = 50;     // Very wide spacing (Sparse)
        const NOISE_ZOOM = 0.0015; // Extremely zoomed in -> Giant waves
        const WAVE_SPEED_X = 0.2;  // Slow, majestic flow
        const WAVE_SPEED_Y = 0.1;  // Vertical drift
        const INFLATE = 6.0;    // Massive distinct dots
        const BASE_RADIUS = 0.5; // Almost invisible base
        const THRESHOLD = 0.3;  // High threshold = Mostly empty space

        // Grid positions (static)
        interface Pt { x: number; y: number }
        let pts: Pt[] = [];
        let W = 0, H = 0;

        const rebuild = () => {
            W = cvs.parentElement?.clientWidth || 960;
            H = cvs.parentElement?.clientHeight || 540;
            cvs.width = W;
            cvs.height = H;
            pts = [];
            for (let gx = 0; gx < W + SPACING; gx += SPACING)
                for (let gy = 0; gy < H + SPACING; gy += SPACING)
                    pts.push({ x: gx, y: gy });
        };
        rebuild();

        let t = 0;

        const render = () => {
            ctx.clearRect(0, 0, W, H);

            // The core trick: we SCROLL the noise field across the grid over time.
            // This makes the wave bands visually travel across the screen.
            const offsetX = t * WAVE_SPEED_X;
            const offsetY = t * WAVE_SPEED_Y;

            for (const p of pts) {
                // Sample noise at grid position + scrolling offset
                const nx = (p.x * NOISE_ZOOM) + offsetX;
                const ny = (p.y * NOISE_ZOOM) + offsetY;
                const n = noise.fbm(nx, ny, 3);   // value in roughly [-1, 1]

                // Wave band visibility: only show if noise is in certain ranges
                // Using sin of noise gives smooth periodic bands
                const wave = Math.sin(n * Math.PI * 3.5);
                const absWave = Math.abs(wave);

                if (absWave < THRESHOLD) continue; // hide → creates empty band gaps

                // Dot size: inflates in wave centres, tiny at edges
                const radius = BASE_RADIUS + absWave * INFLATE;

                // Opacity: brighter in wave centres, fades at edges
                const alpha = Math.min(0.7, absWave * 0.85);

                // Color by horizontal position
                const col = dotColor(p.x / W, alpha);

                ctx.beginPath();
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = col;
                ctx.fill();
            }

            t += 0.016; // ~60fps frame step
            frameRef.current = requestAnimationFrame(render);
        };

        render();

        const onResize = () => rebuild();
        window.addEventListener('resize', onResize);
        return () => {
            cancelAnimationFrame(frameRef.current);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
            }}
        />
    );
}
