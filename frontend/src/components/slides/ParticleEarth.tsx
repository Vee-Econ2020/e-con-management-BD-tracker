import React, { useEffect, useRef } from 'react';

interface CityDef {
    name: string;
    label: string;
    lat: number;
    lon: number;
    isOrigin?: boolean;
    labelOffsetX?: number;
    labelOffsetY?: number;
    bow: number;
}

// Navy Blue styling
const NAVY_BLUE = '#1e3a8a';
const NAVY_BLUE_RGBA = 'rgba(30, 58, 138, 0.90)';
const BEACON_PULSE_COLOR = 'rgba(59, 130, 246, '; // + alpha + ')'
const ENERGY_BEAD_COLOR = '#93c5fd';

const ORIGIN_INDIA: CityDef = {
    name: 'India',
    label: 'India',
    lat: 13.0827,
    lon: 80.2707, // Chennai
    isOrigin: true,
    labelOffsetX: -14,
    labelOffsetY: 16,
    bow: 0,
};

const DESTINATIONS: CityDef[] = [
    {
        name: 'USA West',
        label: 'USA West',
        lat: 37.3382,
        lon: -121.8863, // California
        labelOffsetX: -22,
        labelOffsetY: -12,
        bow: 45,
    },
    {
        name: 'USA East',
        label: 'USA East',
        lat: 40.7128,
        lon: -74.0060, // New York
        labelOffsetX: -16,
        labelOffsetY: -12,
        bow: 65,
    },
    {
        name: 'Europe',
        label: 'Europe',
        lat: 50.1109,
        lon: 8.6821, // Frankfurt / Europe
        labelOffsetX: 10,
        labelOffsetY: -10,
        bow: 85,
    },
    {
        name: 'Korea',
        label: 'Korea',
        lat: 37.5665,
        lon: 126.9780, // Seoul
        labelOffsetX: -8,
        labelOffsetY: 14,
        bow: 35,
    },
    {
        name: 'Japan',
        label: 'Japan',
        lat: 35.6762,
        lon: 139.6503, // Tokyo
        labelOffsetX: 10,
        labelOffsetY: 2,
        bow: 26,
    },
];

interface ParticleEarthProps {
    showConnections?: boolean;
}

const ParticleEarth: React.FC<ParticleEarthProps> = ({ showConnections = true }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let isUnmounted = false;

        // Cached offscreen canvas for the dense continent point cloud
        let offscreenCanvas: HTMLCanvasElement | null = null;
        let currentWidth = 0;
        let currentHeight = 0;
        let cachedPoints: [number, number][] = [];

        // Natural geographic aspect ratio (width : height) - preserves true continent shapes
        const TARGET_ASPECT = 2.05;

        // Coordinate transformation that STRICTLY preserves aspect ratio and centers map
        const getProjection = (w: number, h: number) => {
            let mapW = w;
            let mapH = w / TARGET_ASPECT;

            if (mapH > h) {
                mapH = h;
                mapW = h * TARGET_ASPECT;
            }

            const offsetX = (w - mapW) / 2;
            const offsetY = (h - mapH) / 2;

            const padX = mapW * 0.035;
            const padY = mapH * 0.05;
            const usableW = mapW - padX * 2;
            const usableH = mapH - padY * 2;

            const toScreen = (lon: number, lat: number) => {
                const clampedLon = Math.max(-180, Math.min(180, lon));
                const clampedLat = Math.max(-55, Math.min(72, lat));

                const x = offsetX + padX + ((clampedLon + 180) / 360.0) * usableW;
                const y = offsetY + padY + ((72 - clampedLat) / 127.0) * usableH;
                return { x, y };
            };

            return { mapW, mapH, toScreen };
        };

        // Render dense continent point cloud onto an offscreen canvas
        const renderOffscreen = (pts: [number, number][], w: number, h: number, dpr: number) => {
            const off = document.createElement('canvas');
            off.width = w * dpr;
            off.height = h * dpr;
            const octx = off.getContext('2d');
            if (!octx) return null;

            octx.scale(dpr, dpr);

            const { mapW, toScreen } = getProjection(w, h);
            const dotR = Math.max(1.3, Math.min(2.2, (mapW / 700) * 1.8));

            octx.fillStyle = 'rgba(148, 163, 184, 0.85)'; // Clean slate gray
            octx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const [lon, lat] = pts[i];
                const pt = toScreen(lon, lat);
                octx.moveTo(pt.x + dotR, pt.y);
                octx.arc(pt.x, pt.y, dotR, 0, Math.PI * 2);
            }
            octx.fill();

            return off;
        };

        const updateSize = () => {
            if (!container || !canvas) return;
            const rect = container.getBoundingClientRect();
            const w = Math.floor(rect.width) || 580;
            const h = Math.floor(rect.height) || 380;

            currentWidth = w;
            currentHeight = h;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            if (cachedPoints.length > 0) {
                offscreenCanvas = renderOffscreen(cachedPoints, w, h, dpr);
            }
        };

        // Fetch pre-computed pure land points (zero ocean line artifacts)
        fetch('/continent-points.json')
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((pts: [number, number][]) => {
                if (isUnmounted) return;
                cachedPoints = pts;
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                offscreenCanvas = renderOffscreen(pts, currentWidth, currentHeight, dpr);
            })
            .catch((err) => {
                console.error('Failed to load continent-points.json:', err);
            });

        updateSize();

        const resizeObserver = new ResizeObserver(() => {
            updateSize();
        });
        resizeObserver.observe(container);

        // Bezier curve evaluation
        const getBezierPoint = (
            p0: { x: number; y: number },
            ctrl: { x: number; y: number },
            p1: { x: number; y: number },
            t: number
        ) => {
            const oneMinusT = 1 - t;
            const x = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * ctrl.x + t * t * p1.x;
            const y = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * ctrl.y + t * t * p1.y;
            return { x, y };
        };

        // Main Animation Loop
        const render = () => {
            if (isUnmounted) return;
            animationFrameId = requestAnimationFrame(render);

            const w = currentWidth;
            const h = currentHeight;
            if (w <= 0 || h <= 0) return;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);

            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, w, h);

            // 1. Draw cached dense continent point cloud
            if (!offscreenCanvas && cachedPoints.length > 0 && w > 0 && h > 0) {
                offscreenCanvas = renderOffscreen(cachedPoints, w, h, dpr);
            }

            if (offscreenCanvas) {
                ctx.drawImage(offscreenCanvas, 0, 0, w, h);
            }

            // 2. Draw Connections, Pins, Traveling Pulses & Clean Labels
            if (showConnections) {
                const time = Date.now() * 0.001;
                const { mapW, toScreen } = getProjection(w, h);
                const indiaPt = toScreen(ORIGIN_INDIA.lon, ORIGIN_INDIA.lat);

                // Scale factor based on actual rendered map width
                const scaleFactor = mapW / 650;

                // Precompute destination curves
                const curves = DESTINATIONS.map((dest) => {
                    const destPt = toScreen(dest.lon, dest.lat);
                    const mx = (indiaPt.x + destPt.x) * 0.5;
                    const apex = Math.min(indiaPt.y, destPt.y) - (dest.bow * scaleFactor);
                    const ctrlPt = { x: mx, y: apex };
                    return { dest, destPt, ctrlPt };
                });

                // A. Draw Arcs (All Navy Blue)
                curves.forEach(({ ctrlPt, destPt }) => {
                    ctx.beginPath();
                    ctx.moveTo(indiaPt.x, indiaPt.y);
                    ctx.quadraticCurveTo(ctrlPt.x, ctrlPt.y, destPt.x, destPt.y);
                    ctx.strokeStyle = NAVY_BLUE_RGBA;
                    ctx.lineWidth = Math.max(1.8, Math.min(2.8, scaleFactor * 2.2));
                    ctx.lineCap = 'round';
                    ctx.stroke();
                });

                // B. Draw Animated Traveling Pulses (Energy Beads)
                curves.forEach(({ ctrlPt, destPt }, idx) => {
                    const speed = 0.22 + idx * 0.02;

                    // Bead 1
                    const t1 = ((time * speed) + idx * 0.20) % 1.0;
                    const pos1 = getBezierPoint(indiaPt, ctrlPt, destPt, t1);

                    ctx.beginPath();
                    ctx.arc(pos1.x, pos1.y, 3.2, 0, Math.PI * 2);
                    ctx.fillStyle = ENERGY_BEAD_COLOR;
                    ctx.shadowColor = '#60a5fa';
                    ctx.shadowBlur = 6;
                    ctx.fill();
                    ctx.shadowBlur = 0; // reset

                    // Bead 2 (Trailing pulse)
                    const t2 = ((time * speed) + idx * 0.20 + 0.50) % 1.0;
                    const pos2 = getBezierPoint(indiaPt, ctrlPt, destPt, t2);

                    ctx.beginPath();
                    ctx.arc(pos2.x, pos2.y, 2.4, 0, Math.PI * 2);
                    ctx.fillStyle = '#60a5fa';
                    ctx.fill();
                });

                // C. Destination Pins, Pulsing Rings & Clean Labels
                curves.forEach(({ dest, destPt }, idx) => {
                    // Pulsing radar ring
                    const pulsePhase = (time * 2.5 + idx * 0.8) % 1.0;
                    const pulseR = 4 + pulsePhase * 12;
                    const pulseAlpha = Math.max(0, 1 - pulsePhase);

                    ctx.beginPath();
                    ctx.arc(destPt.x, destPt.y, pulseR, 0, Math.PI * 2);
                    ctx.strokeStyle = `${BEACON_PULSE_COLOR}${pulseAlpha.toFixed(2)})`;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Solid pin dot (Navy Blue)
                    ctx.beginPath();
                    ctx.arc(destPt.x, destPt.y, 4.5, 0, Math.PI * 2);
                    ctx.fillStyle = NAVY_BLUE;
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Clean Minimal Label (Strictly text, no slop boxes)
                    ctx.font = 'bold 11px Inter, Helvetica, Arial, sans-serif';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';

                    const lx = destPt.x + (dest.labelOffsetX || 8);
                    const ly = destPt.y + (dest.labelOffsetY || -10);

                    // Crisp white outline for high contrast
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(dest.label, lx - 1, ly);
                    ctx.fillText(dest.label, lx + 1, ly);
                    ctx.fillText(dest.label, lx, ly - 1);
                    ctx.fillText(dest.label, lx, ly + 1);

                    ctx.fillStyle = '#0f172a'; // Slate 900
                    ctx.fillText(dest.label, lx, ly);
                });

                // D. India Origin Pin, Pulsing Ring & Clean Label (Strictly "India")
                const originPulsePhase = (time * 2.8) % 1.0;
                const originPulseR = 5 + originPulsePhase * 16;
                const originPulseAlpha = Math.max(0, 1 - originPulsePhase);

                ctx.beginPath();
                ctx.arc(indiaPt.x, indiaPt.y, originPulseR, 0, Math.PI * 2);
                ctx.strokeStyle = `${BEACON_PULSE_COLOR}${originPulseAlpha.toFixed(2)})`;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Solid pin dot
                ctx.beginPath();
                ctx.arc(indiaPt.x, indiaPt.y, 6.0, 0, Math.PI * 2);
                ctx.fillStyle = NAVY_BLUE;
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Label: strictly "India"
                ctx.font = 'bold 13px Inter, Helvetica, Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';

                const ilx = indiaPt.x + (ORIGIN_INDIA.labelOffsetX || 0) + 14;
                const ily = indiaPt.y + (ORIGIN_INDIA.labelOffsetY || 12);

                // Subtle white outline for crisp readability
                ctx.fillStyle = '#ffffff';
                ctx.fillText(ORIGIN_INDIA.label, ilx - 1, ily);
                ctx.fillText(ORIGIN_INDIA.label, ilx + 1, ily);
                ctx.fillText(ORIGIN_INDIA.label, ilx, ily - 1);
                ctx.fillText(ORIGIN_INDIA.label, ilx, ily + 1);

                ctx.fillStyle = NAVY_BLUE;
                ctx.fillText(ORIGIN_INDIA.label, ilx, ily);
            }

            ctx.restore();
        };

        render();

        return () => {
            isUnmounted = true;
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
        };
    }, [showConnections]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                minHeight: '380px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
    );
};

export default ParticleEarth;
