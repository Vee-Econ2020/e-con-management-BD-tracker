import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export interface GifPosition {
    x: number;
    y: number;
    width: number;
}

interface GifOverlayProps {
    containerRef: RefObject<HTMLDivElement | null>;
    isEditing: boolean;
    gifEnabled: boolean;
    gifUrl?: string;
    gifPosition?: GifPosition;
    onGifUrlChange?: (gifUrl: string) => void;
    onGifPositionChange?: (gifPosition: GifPosition) => void;
}

type OverlayInteraction =
    | { mode: 'move'; offsetX: number; offsetY: number }
    | { mode: 'resize'; startWidth: number; startClientX: number };

export const DEFAULT_GIF_URL = 'https://share.google/LmEClpDJOaUUFkFoW';
export const DEFAULT_GIF_POSITION: GifPosition = { x: 68, y: 14, width: 22 };

const clampPercent = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getHeightPercent = (widthPercent: number, bounds: DOMRect, aspectRatio: number) => {
    if (!Number.isFinite(aspectRatio) || aspectRatio <= 0 || bounds.height <= 0) {
        return widthPercent;
    }

    const widthPx = (widthPercent / 100) * bounds.width;
    const heightPx = widthPx / aspectRatio;
    return (heightPx / bounds.height) * 100;
};

export function GifOverlay({
    containerRef,
    isEditing,
    gifEnabled,
    gifUrl = DEFAULT_GIF_URL,
    gifPosition = DEFAULT_GIF_POSITION,
    onGifUrlChange,
    onGifPositionChange,
}: GifOverlayProps) {
    const [localGifUrl, setLocalGifUrl] = useState(gifUrl || DEFAULT_GIF_URL);
    const [localGifPosition, setLocalGifPosition] = useState<GifPosition>(gifPosition || DEFAULT_GIF_POSITION);
    const [gifAspectRatio, setGifAspectRatio] = useState(1);
    const [gifLoadError, setGifLoadError] = useState(false);
    const latestGifPositionRef = useRef<GifPosition>(gifPosition || DEFAULT_GIF_POSITION);
    const interactionRef = useRef<OverlayInteraction | null>(null);

    useEffect(() => {
        const nextUrl = gifUrl || DEFAULT_GIF_URL;
        setLocalGifUrl(nextUrl);
    }, [gifUrl]);

    useEffect(() => {
        const nextPosition = gifPosition || DEFAULT_GIF_POSITION;
        setLocalGifPosition(nextPosition);
        latestGifPositionRef.current = nextPosition;
    }, [gifPosition]);

    useEffect(() => {
        latestGifPositionRef.current = localGifPosition;
    }, [localGifPosition]);

    useEffect(() => {
        if (!isEditing || !gifEnabled) {
            interactionRef.current = null;
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            const interaction = interactionRef.current;
            const bounds = containerRef.current?.getBoundingClientRect();
            if (!interaction || !bounds) {
                return;
            }

            if (interaction.mode === 'move') {
                const widthPercent = latestGifPositionRef.current.width;
                const heightPercent = getHeightPercent(widthPercent, bounds, gifAspectRatio);
                const maxX = Math.max(0, 100 - widthPercent);
                const maxY = Math.max(0, 100 - heightPercent);

                const nextPosition = {
                    ...latestGifPositionRef.current,
                    x: clampPercent(((event.clientX - bounds.left - interaction.offsetX) / bounds.width) * 100, 0, maxX),
                    y: clampPercent(((event.clientY - bounds.top - interaction.offsetY) / bounds.height) * 100, 0, maxY),
                };

                latestGifPositionRef.current = nextPosition;
                setLocalGifPosition(nextPosition);
                return;
            }

            const deltaWidth = ((event.clientX - interaction.startClientX) / bounds.width) * 100;
            const widthScale = bounds.width / (Math.max(gifAspectRatio, 0.1) * Math.max(bounds.height, 1));
            const maxWidthByHeight = widthScale > 0
                ? (100 - latestGifPositionRef.current.y) / widthScale
                : 90;
            const maxWidth = Math.min(90, 100 - latestGifPositionRef.current.x, maxWidthByHeight);
            const nextWidth = clampPercent(interaction.startWidth + deltaWidth, 8, Math.max(8, maxWidth));

            const nextPosition = {
                ...latestGifPositionRef.current,
                width: nextWidth,
            };

            latestGifPositionRef.current = nextPosition;
            setLocalGifPosition(nextPosition);
        };

        const handlePointerUp = () => {
            if (!interactionRef.current) {
                return;
            }

            interactionRef.current = null;
            onGifPositionChange?.(latestGifPositionRef.current);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [containerRef, gifAspectRatio, gifEnabled, isEditing, onGifPositionChange]);

    const handleGifPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!isEditing || !gifEnabled) {
            return;
        }

        const targetBounds = event.currentTarget.getBoundingClientRect();
        interactionRef.current = {
            mode: 'move',
            offsetX: event.clientX - targetBounds.left,
            offsetY: event.clientY - targetBounds.top,
        };
        event.preventDefault();
    };

    const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!isEditing || !gifEnabled) {
            return;
        }

        interactionRef.current = {
            mode: 'resize',
            startWidth: latestGifPositionRef.current.width,
            startClientX: event.clientX,
        };
        event.preventDefault();
        event.stopPropagation();
    };

    const persistGifUrl = () => {
        const nextUrl = localGifUrl.trim() || DEFAULT_GIF_URL;
        setLocalGifUrl(nextUrl);
        if (nextUrl !== gifUrl) {
            onGifUrlChange?.(nextUrl);
        }
    };

    if (!gifEnabled) {
        return null;
    }

    return (
        <>
            <div
                onPointerDown={handleGifPointerDown}
                style={{
                    position: 'absolute',
                    left: `${localGifPosition.x}%`,
                    top: `${localGifPosition.y}%`,
                    width: `${localGifPosition.width}%`,
                    minWidth: '96px',
                    cursor: isEditing ? 'grab' : 'default',
                    zIndex: 16,
                    borderRadius: '18px',
                    overflow: 'visible',
                    border: isEditing ? '2px dashed rgba(37, 99, 235, 0.65)' : 'none',
                    boxShadow: isEditing ? '0 16px 32px rgba(15, 23, 42, 0.18)' : 'none',
                    background: 'transparent',
                    userSelect: 'none',
                    touchAction: 'none',
                    pointerEvents: isEditing ? 'auto' : 'none',
                }}
            >
                <img
                    src={localGifUrl}
                    alt="Slide GIF"
                    style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        borderRadius: '18px',
                        pointerEvents: 'none',
                    }}
                    onLoad={(event) => {
                        setGifLoadError(false);
                        const target = event.currentTarget;
                        if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                            setGifAspectRatio(target.naturalWidth / target.naturalHeight);
                        }
                    }}
                    onError={() => setGifLoadError(true)}
                />

                {isEditing && (
                    <>
                        <div style={{
                            position: 'absolute',
                            left: '0.5rem',
                            top: '0.5rem',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '999px',
                            background: 'rgba(15, 23, 42, 0.78)',
                            color: 'white',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                        }}>
                            Drag or resize GIF
                        </div>
                        <div
                            onPointerDown={handleResizePointerDown}
                            style={{
                                position: 'absolute',
                                right: '-10px',
                                bottom: '-10px',
                                width: '22px',
                                height: '22px',
                                borderRadius: '999px',
                                background: '#2563eb',
                                border: '2px solid #ffffff',
                                boxShadow: '0 8px 16px rgba(37, 99, 235, 0.35)',
                                cursor: 'nwse-resize',
                            }}
                        />
                    </>
                )}
            </div>

            {isEditing && (
                <div style={{
                    position: 'absolute',
                    left: '1.5rem',
                    bottom: '1.5rem',
                    width: 'min(430px, calc(100% - 10rem))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    padding: '0.9rem 1rem',
                    background: 'rgba(255, 255, 255, 0.94)',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    borderRadius: '16px',
                    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.14)',
                    zIndex: 18,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                            GIF overlay
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                            Width {localGifPosition.width.toFixed(0)}%
                        </span>
                    </div>
                    <input
                        value={localGifUrl}
                        onChange={(event) => setLocalGifUrl(event.target.value)}
                        onBlur={persistGifUrl}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                persistGifUrl();
                                event.currentTarget.blur();
                            }
                        }}
                        placeholder="Paste a direct GIF URL"
                        style={{
                            width: '100%',
                            border: '1px solid #cbd5e1',
                            borderRadius: '12px',
                            padding: '0.7rem 0.9rem',
                            fontSize: '0.92rem',
                            color: '#0f172a',
                            outline: 'none',
                        }}
                    />
                    <div style={{ fontSize: '0.78rem', color: gifLoadError ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                        {gifLoadError
                            ? 'This URL did not load as an image. Use a direct GIF file URL if the shared link does not render.'
                            : 'The GIF position and size are saved and reused in edit mode, slideshow mode, and PDF export.'}
                    </div>
                </div>
            )}
        </>
    );
}