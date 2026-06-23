import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { Trash2, Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, X } from 'lucide-react';

export interface TextOverlay {
    id: string;
    x: number;            // percent of container
    y: number;            // percent of container
    width: number;        // percent of container
    fontSize: number;     // px
    text: string;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    color: string;
    backgroundColor: string; // '' or 'transparent' means none
    align: 'left' | 'center' | 'right';
}

export interface ImageOverlay {
    id: string;
    x: number;            // percent
    y: number;            // percent
    width: number;        // percent
    dataUrl: string;      // base64 data URL
}

export interface SlideExtras {
    textOverlays: TextOverlay[];
    imageOverlays: ImageOverlay[];
}

export const EMPTY_SLIDE_EXTRAS: SlideExtras = { textOverlays: [], imageOverlays: [] };

export const FONT_FAMILIES = [
    'Inter',
    'Arial',
    'Roboto',
    'Georgia',
    'Times New Roman',
    'Courier New',
    'Verdana',
    'Tahoma',
    'Comic Sans MS',
    'Trebuchet MS',
    'Impact',
];

export const DEFAULT_TEXT_OVERLAY: Omit<TextOverlay, 'id'> = {
    x: 20,
    y: 40,
    width: 30,
    fontSize: 28,
    text: 'Double-click to edit',
    fontFamily: 'Inter',
    bold: false,
    italic: false,
    underline: false,
    color: '#0f172a',
    backgroundColor: '',
    align: 'left',
};

export const DEFAULT_IMAGE_OVERLAY: Omit<ImageOverlay, 'id' | 'dataUrl'> = {
    x: 25,
    y: 25,
    width: 25,
};

interface SlideExtrasOverlayProps {
    containerRef: RefObject<HTMLDivElement | null>;
    isEditing: boolean;
    extras: SlideExtras;
    onUpdateText: (id: string, patch: Partial<TextOverlay>) => void;
    onUpdateImage: (id: string, patch: Partial<ImageOverlay>) => void;
    onDeleteText: (id: string) => void;
    onDeleteImage: (id: string) => void;
}

type Interaction =
    | { kind: 'text'; id: string; mode: 'move'; offsetX: number; offsetY: number }
    | { kind: 'text'; id: string; mode: 'resize'; startWidth: number; startFontSize: number; startClientX: number; startClientY: number }
    | { kind: 'image'; id: string; mode: 'move'; offsetX: number; offsetY: number; aspect: number }
    | { kind: 'image'; id: string; mode: 'resize'; startWidth: number; startClientX: number; aspect: number };

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function SlideExtrasOverlay({
    containerRef,
    isEditing,
    extras,
    onUpdateText,
    onUpdateImage,
    onDeleteText,
    onDeleteImage,
}: SlideExtrasOverlayProps) {
    const [selected, setSelected] = useState<{ kind: 'text' | 'image'; id: string } | null>(null);
    const [editingText, setEditingText] = useState<string | null>(null);
    const interactionRef = useRef<Interaction | null>(null);
    const latestExtrasRef = useRef<SlideExtras>(extras);
    const imageAspectsRef = useRef<Record<string, number>>({});

    useEffect(() => {
        latestExtrasRef.current = extras;
    }, [extras]);

    // Clear selection / text editing when leaving edit mode
    useEffect(() => {
        if (!isEditing) {
            setSelected(null);
            setEditingText(null);
            interactionRef.current = null;
        }
    }, [isEditing]);

    useEffect(() => {
        if (!isEditing) return;

        const onMove = (event: PointerEvent) => {
            const interaction = interactionRef.current;
            const bounds = containerRef.current?.getBoundingClientRect();
            if (!interaction || !bounds) return;

            if (interaction.kind === 'text') {
                const current = latestExtrasRef.current.textOverlays.find(t => t.id === interaction.id);
                if (!current) return;

                if (interaction.mode === 'move') {
                    const nextX = clamp(((event.clientX - bounds.left - interaction.offsetX) / bounds.width) * 100, 0, Math.max(0, 100 - current.width));
                    const nextY = clamp(((event.clientY - bounds.top - interaction.offsetY) / bounds.height) * 100, 0, 98);
                    onUpdateText(interaction.id, { x: nextX, y: nextY });
                } else {
                    const deltaX = event.clientX - interaction.startClientX;
                    const deltaY = event.clientY - interaction.startClientY;
                    const delta = Math.max(deltaX, deltaY); // scale by larger of the two
                    const widthFactor = 1 + (deltaX / Math.max(bounds.width * (interaction.startWidth / 100), 1));
                    const fontFactor = 1 + (delta / Math.max(interaction.startFontSize * 4, 40));
                    const nextWidth = clamp(interaction.startWidth * widthFactor, 6, Math.min(95, 100 - current.x));
                    const nextFontSize = clamp(interaction.startFontSize * fontFactor, 8, 200);
                    onUpdateText(interaction.id, { width: nextWidth, fontSize: nextFontSize });
                }
                return;
            }

            // image
            const current = latestExtrasRef.current.imageOverlays.find(i => i.id === interaction.id);
            if (!current) return;

            if (interaction.mode === 'move') {
                const aspect = interaction.aspect || 1;
                const heightPct = (current.width / 100 * bounds.width / aspect) / bounds.height * 100;
                const nextX = clamp(((event.clientX - bounds.left - interaction.offsetX) / bounds.width) * 100, 0, Math.max(0, 100 - current.width));
                const nextY = clamp(((event.clientY - bounds.top - interaction.offsetY) / bounds.height) * 100, 0, Math.max(0, 100 - heightPct));
                onUpdateImage(interaction.id, { x: nextX, y: nextY });
            } else {
                const deltaWidthPct = ((event.clientX - interaction.startClientX) / bounds.width) * 100;
                const aspect = interaction.aspect || 1;
                const widthScale = bounds.width / (Math.max(aspect, 0.1) * Math.max(bounds.height, 1));
                const maxByHeight = widthScale > 0 ? (100 - current.y) / widthScale : 95;
                const maxWidth = Math.min(95, 100 - current.x, maxByHeight);
                const nextWidth = clamp(interaction.startWidth + deltaWidthPct, 5, Math.max(5, maxWidth));
                onUpdateImage(interaction.id, { width: nextWidth });
            }
        };

        const onUp = () => {
            interactionRef.current = null;
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [containerRef, isEditing, onUpdateText, onUpdateImage]);

    const selectedText = selected?.kind === 'text' ? extras.textOverlays.find(t => t.id === selected.id) ?? null : null;

    return (
        <>
            {/* Image overlays */}
            {extras.imageOverlays.map((img) => {
                const isSel = isEditing && selected?.kind === 'image' && selected.id === img.id;
                return (
                    <div
                        key={img.id}
                        onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
                            if (!isEditing) return;
                            setSelected({ kind: 'image', id: img.id });
                            const target = e.currentTarget.getBoundingClientRect();
                            interactionRef.current = {
                                kind: 'image',
                                id: img.id,
                                mode: 'move',
                                offsetX: e.clientX - target.left,
                                offsetY: e.clientY - target.top,
                                aspect: imageAspectsRef.current[img.id] || 1,
                            };
                            e.preventDefault();
                        }}
                        style={{
                            position: 'absolute',
                            left: `${img.x}%`,
                            top: `${img.y}%`,
                            width: `${img.width}%`,
                            cursor: isEditing ? 'grab' : 'default',
                            zIndex: 15,
                            border: isEditing ? (isSel ? '2px solid #2563eb' : '2px dashed rgba(37, 99, 235, 0.5)') : 'none',
                            borderRadius: '12px',
                            boxShadow: isSel ? '0 12px 24px rgba(37, 99, 235, 0.25)' : 'none',
                            userSelect: 'none',
                            touchAction: 'none',
                            pointerEvents: isEditing ? 'auto' : 'none',
                            background: 'transparent',
                        }}
                    >
                        <img
                            src={img.dataUrl}
                            alt="overlay"
                            draggable={false}
                            onLoad={(e) => {
                                const t = e.currentTarget;
                                if (t.naturalWidth > 0 && t.naturalHeight > 0) {
                                    imageAspectsRef.current[img.id] = t.naturalWidth / t.naturalHeight;
                                }
                            }}
                            style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '10px', pointerEvents: 'none' }}
                        />
                        {isSel && (
                            <>
                                <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => onDeleteImage(img.id)}
                                    style={{
                                        position: 'absolute', top: '-12px', right: '-12px',
                                        width: '26px', height: '26px', borderRadius: '999px',
                                        background: '#dc2626', color: 'white', border: '2px solid #fff',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)', zIndex: 18,
                                    }}
                                    title="Delete image"
                                >
                                    <Trash2 size={12} />
                                </button>
                                <div
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        interactionRef.current = {
                                            kind: 'image', id: img.id, mode: 'resize',
                                            startWidth: img.width, startClientX: e.clientX,
                                            aspect: imageAspectsRef.current[img.id] || 1,
                                        };
                                    }}
                                    style={{
                                        position: 'absolute', right: '-10px', bottom: '-10px',
                                        width: '20px', height: '20px', borderRadius: '999px',
                                        background: '#2563eb', border: '2px solid #fff', cursor: 'nwse-resize',
                                        boxShadow: '0 6px 12px rgba(37,99,235,0.35)', zIndex: 18,
                                    }}
                                />
                            </>
                        )}
                    </div>
                );
            })}

            {/* Text overlays */}
            {extras.textOverlays.map((txt) => {
                const isSel = isEditing && selected?.kind === 'text' && selected.id === txt.id;
                const isTextEditing = editingText === txt.id;
                return (
                    <div
                        key={txt.id}
                        onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
                            if (!isEditing || isTextEditing) return;
                            setSelected({ kind: 'text', id: txt.id });
                            const target = e.currentTarget.getBoundingClientRect();
                            interactionRef.current = {
                                kind: 'text', id: txt.id, mode: 'move',
                                offsetX: e.clientX - target.left,
                                offsetY: e.clientY - target.top,
                            };
                            e.preventDefault();
                        }}
                        onDoubleClick={() => {
                            if (isEditing) {
                                setSelected({ kind: 'text', id: txt.id });
                                setEditingText(txt.id);
                            }
                        }}
                        style={{
                            position: 'absolute',
                            left: `${txt.x}%`,
                            top: `${txt.y}%`,
                            width: `${txt.width}%`,
                            cursor: isEditing ? (isTextEditing ? 'text' : 'grab') : 'default',
                            zIndex: 16,
                            padding: '0.25rem 0.45rem',
                            border: isEditing ? (isSel ? '2px solid #2563eb' : '2px dashed rgba(37, 99, 235, 0.5)') : 'none',
                            borderRadius: '8px',
                            boxShadow: isSel ? '0 10px 20px rgba(37, 99, 235, 0.2)' : 'none',
                            background: txt.backgroundColor || 'transparent',
                            color: txt.color,
                            fontFamily: `${txt.fontFamily}, sans-serif`,
                            fontSize: `${txt.fontSize}px`,
                            fontWeight: txt.bold ? 800 : 500,
                            fontStyle: txt.italic ? 'italic' : 'normal',
                            textDecoration: txt.underline ? 'underline' : 'none',
                            textAlign: txt.align,
                            lineHeight: 1.25,
                            userSelect: isTextEditing ? 'text' : 'none',
                            touchAction: 'none',
                            pointerEvents: isEditing ? 'auto' : 'none',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {isTextEditing ? (
                            <textarea
                                autoFocus
                                value={txt.text}
                                onChange={(e) => onUpdateText(txt.id, { text: e.target.value })}
                                onBlur={() => setEditingText(null)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        (e.currentTarget as HTMLTextAreaElement).blur();
                                    }
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                style={{
                                    width: '100%', minHeight: '1.5em', resize: 'none',
                                    border: 'none', outline: 'none', background: 'transparent',
                                    color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit',
                                    fontWeight: 'inherit', fontStyle: 'inherit', textDecoration: 'inherit',
                                    textAlign: 'inherit', lineHeight: 'inherit', padding: 0,
                                }}
                            />
                        ) : (
                            txt.text || ' '
                        )}

                        {isSel && !isTextEditing && (
                            <>
                                <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => onDeleteText(txt.id)}
                                    style={{
                                        position: 'absolute', top: '-12px', right: '-12px',
                                        width: '24px', height: '24px', borderRadius: '999px',
                                        background: '#dc2626', color: 'white', border: '2px solid #fff',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)', zIndex: 18,
                                    }}
                                    title="Delete text"
                                >
                                    <Trash2 size={11} />
                                </button>
                                <div
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        interactionRef.current = {
                                            kind: 'text', id: txt.id, mode: 'resize',
                                            startWidth: txt.width, startFontSize: txt.fontSize,
                                            startClientX: e.clientX, startClientY: e.clientY,
                                        };
                                    }}
                                    style={{
                                        position: 'absolute', right: '-10px', bottom: '-10px',
                                        width: '20px', height: '20px', borderRadius: '999px',
                                        background: '#2563eb', border: '2px solid #fff', cursor: 'nwse-resize',
                                        boxShadow: '0 6px 12px rgba(37,99,235,0.35)', zIndex: 18,
                                    }}
                                />
                            </>
                        )}
                    </div>
                );
            })}

            {/* Text styling toolbar for selected text */}
            {isEditing && selectedText && (
                <div
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        left: '1rem',
                        bottom: '1rem',
                        right: '1rem',
                        maxWidth: '760px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        alignItems: 'center',
                        padding: '0.7rem 0.9rem',
                        background: 'rgba(255, 255, 255, 0.96)',
                        border: '1px solid rgba(148, 163, 184, 0.4)',
                        borderRadius: '14px',
                        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
                        zIndex: 20,
                    }}
                >
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginRight: '0.25rem' }}>Text</span>

                    <select
                        value={selectedText.fontFamily}
                        onChange={(e) => onUpdateText(selectedText.id, { fontFamily: e.target.value })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: `${selectedText.fontFamily}, sans-serif` }}
                    >
                        {FONT_FAMILIES.map(f => (
                            <option key={f} value={f} style={{ fontFamily: `${f}, sans-serif` }}>{f}</option>
                        ))}
                    </select>

                    <input
                        type="number"
                        min={8}
                        max={200}
                        value={Math.round(selectedText.fontSize)}
                        onChange={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v)) onUpdateText(selectedText.id, { fontSize: clamp(v, 8, 200) });
                        }}
                        style={{ width: '60px', padding: '0.35rem 0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        title="Font size (px)"
                    />

                    <button
                        onClick={() => onUpdateText(selectedText.id, { bold: !selectedText.bold })}
                        style={toolbarBtnStyle(selectedText.bold)}
                        title="Bold"
                    >
                        <Bold size={14} />
                    </button>
                    <button
                        onClick={() => onUpdateText(selectedText.id, { italic: !selectedText.italic })}
                        style={toolbarBtnStyle(selectedText.italic)}
                        title="Italic"
                    >
                        <Italic size={14} />
                    </button>
                    <button
                        onClick={() => onUpdateText(selectedText.id, { underline: !selectedText.underline })}
                        style={toolbarBtnStyle(selectedText.underline)}
                        title="Underline"
                    >
                        <UnderlineIcon size={14} />
                    </button>

                    <button
                        onClick={() => onUpdateText(selectedText.id, { align: 'left' })}
                        style={toolbarBtnStyle(selectedText.align === 'left')}
                        title="Align left"
                    >
                        <AlignLeft size={14} />
                    </button>
                    <button
                        onClick={() => onUpdateText(selectedText.id, { align: 'center' })}
                        style={toolbarBtnStyle(selectedText.align === 'center')}
                        title="Align center"
                    >
                        <AlignCenter size={14} />
                    </button>
                    <button
                        onClick={() => onUpdateText(selectedText.id, { align: 'right' })}
                        style={toolbarBtnStyle(selectedText.align === 'right')}
                        title="Align right"
                    >
                        <AlignRight size={14} />
                    </button>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                        Color
                        <input
                            type="color"
                            value={selectedText.color}
                            onChange={(e) => onUpdateText(selectedText.id, { color: e.target.value })}
                            style={{ width: '32px', height: '28px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', padding: 0, cursor: 'pointer' }}
                        />
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                        BG
                        <input
                            type="color"
                            value={selectedText.backgroundColor || '#ffffff'}
                            onChange={(e) => onUpdateText(selectedText.id, { backgroundColor: e.target.value })}
                            style={{ width: '32px', height: '28px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', padding: 0, cursor: 'pointer' }}
                        />
                        {selectedText.backgroundColor && (
                            <button
                                onClick={() => onUpdateText(selectedText.id, { backgroundColor: '' })}
                                style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                title="Remove background"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </label>

                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                        Drag to move · corner to resize · double-click to edit text
                    </span>
                </div>
            )}
        </>
    );
}

const toolbarBtnStyle = (active: boolean): React.CSSProperties => ({
    width: '32px',
    height: '28px',
    border: `1px solid ${active ? '#2563eb' : '#cbd5e1'}`,
    borderRadius: '8px',
    background: active ? '#dbeafe' : 'white',
    color: active ? '#1d4ed8' : '#334155',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
});
