import { useEffect, useRef, useState } from 'react';
import { Upload, ExternalLink, PictureInPicture2, Loader2, Image as ImageIcon } from 'lucide-react';

// ─── Config ──────────────────────────────────────────────────────────────────
// The embedded iframe with `autoAuth=true` was abandoned because browsers
// block Power BI's AAD sign-in flow inside cross-origin iframes (third-party
// cookie / SameSite / X-Frame-Options restrictions). Instead we open the
// report in a dedicated browser window/tab where sign-in runs in a
// first-party context, and display an admin-uploaded snapshot on the slide.
const POWERBI_REPORT_ID = '012d8c7d-a6ac-4165-baa9-da8d17447d41';
const POWERBI_TENANT_ID = 'ad201514-dda1-42a0-95ea-b00eb219ee90';
const POWERBI_REPORT_URL =
    `https://app.powerbi.com/groups/me/reports/${POWERBI_REPORT_ID}/ReportSection?ctid=${POWERBI_TENANT_ID}`;

const SLIDE_ID = '28';

// ─── Props ───────────────────────────────────────────────────────────────────
interface Slide28Props {
    isEditing?: boolean;
    onNextSlide?: () => void;
    onPreviousSlide?: () => void;
}

export default function Slide28({
    isEditing = false,
    onNextSlide,
    onPreviousSlide,
}: Slide28Props) {
    const [currentWeek, setCurrentWeek] = useState<number | null>(null);
    const [imageKey, setImageKey] = useState(Date.now());
    const [hasImage, setHasImage] = useState(false);
    const [checkingImage, setCheckingImage] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch('/api/week/current')
            .then((r) => r.json())
            .then((d) => setCurrentWeek(d.week))
            .catch((err) => console.error('Failed to fetch current week:', err));
    }, []);

    // Probe whether a snapshot exists for this slide/week.
    useEffect(() => {
        if (!currentWeek) return;
        let cancelled = false;
        setCheckingImage(true);
        const url = `/api/admin/slides/image/${SLIDE_ID}/${currentWeek}?t=${imageKey}`;
        fetch(url, { method: 'HEAD' })
            .then((r) => {
                if (cancelled) return;
                setHasImage(r.ok);
            })
            .catch(() => !cancelled && setHasImage(false))
            .finally(() => !cancelled && setCheckingImage(false));
        return () => {
            cancelled = true;
        };
    }, [currentWeek, imageKey]);

    const imageUrl = currentWeek
        ? `/api/admin/slides/image/${SLIDE_ID}/${currentWeek}?t=${imageKey}`
        : '';

    const openFullWindow = () => {
        window.open(POWERBI_REPORT_URL, '_blank', 'noopener,noreferrer');
    };

    const openPopout = () => {
        const w = Math.min(1400, Math.floor(window.screen.availWidth * 0.75));
        const h = Math.min(900, Math.floor(window.screen.availHeight * 0.85));
        const left = Math.floor((window.screen.availWidth - w) / 2);
        const top = Math.floor((window.screen.availHeight - h) / 2);
        window.open(
            POWERBI_REPORT_URL,
            'pbi_report_popout',
            `noopener,noreferrer,width=${w},height=${h},left=${left},top=${top}`
        );
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !currentWeek) return;
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('slide_id', SLIDE_ID);
        formData.append('week', currentWeek.toString());
        formData.append('file', file);
        try {
            const res = await fetch('/api/admin/slides/upload-image', {
                method: 'POST',
                body: formData,
            });
            if (res.ok) {
                setImageKey(Date.now());
                setHasImage(true);
            } else {
                alert('Upload failed');
            }
        } catch (err) {
            console.error(err);
            alert('Error uploading image');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#0f172a',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Report display area */}
            <div
                style={{
                    position: 'absolute',
                    inset: '16px 16px 96px 16px',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    backgroundColor: '#0b1220',
                    boxShadow: '0 24px 60px rgba(0,0,0,0.32)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {hasImage && !isEditing ? (
                    <img
                        key={imageKey}
                        src={imageUrl}
                        alt="Power BI report snapshot"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            backgroundColor: '#ffffff',
                        }}
                    />
                ) : (
                    <LauncherCard
                        checkingImage={checkingImage}
                        hasImage={hasImage}
                        isEditing={isEditing}
                        uploading={uploading}
                        imageUrl={imageUrl}
                        imageKey={imageKey}
                        onOpenFull={openFullWindow}
                        onOpenPopout={openPopout}
                        onPickFile={() => fileInputRef.current?.click()}
                    />
                )}

                {/* Floating launcher controls (always visible) */}
                <div
                    style={{
                        position: 'absolute',
                        top: '14px',
                        right: '14px',
                        display: 'flex',
                        gap: '8px',
                        zIndex: 10,
                    }}
                >
                    <FloatingButton onClick={openFullWindow} title="Open live report in a new tab">
                        <ExternalLink size={16} />
                        <span>Open Live Report</span>
                    </FloatingButton>
                    <FloatingButton onClick={openPopout} title="Open in a floating window" variant="ghost">
                        <PictureInPicture2 size={16} />
                        <span>Pop out</span>
                    </FloatingButton>
                </div>

                {/* Edit-mode upload control */}
                {isEditing && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: '14px',
                            left: '14px',
                            right: '14px',
                            display: 'flex',
                            gap: '10px',
                            zIndex: 10,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(15,23,42,0.78)',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            backdropFilter: 'blur(6px)',
                            flexWrap: 'wrap',
                        }}
                    >
                        <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                            {hasImage
                                ? 'Snapshot uploaded — replace it anytime:'
                                : 'Upload a PNG/JPEG snapshot of the current report to show on this slide.'}
                        </span>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading || !currentWeek}
                            style={primaryBtnStyle(uploading)}
                        >
                            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            <span style={{ marginLeft: 6 }}>{uploading ? 'Uploading…' : 'Upload Snapshot'}</span>
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            style={{ display: 'none' }}
                            onChange={handleUpload}
                        />
                    </div>
                )}
            </div>

            {/* Bottom nav */}
            <div
                style={{
                    position: 'absolute',
                    left: '16px',
                    right: '16px',
                    bottom: '16px',
                    height: '64px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                }}
            >
                <NavButton onClick={onPreviousSlide} disabled={!onPreviousSlide} variant="secondary">
                    Previous Slide
                </NavButton>
                <div
                    style={{
                        color: '#cbd5e1',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        textAlign: 'center',
                        flex: '1 1 auto',
                    }}
                >
                    The live report opens in a new window where Microsoft sign-in works normally.
                </div>
                <NavButton onClick={onNextSlide} disabled={!onNextSlide} variant="primary">
                    Next Slide
                </NavButton>
            </div>
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LauncherCard({
    checkingImage,
    hasImage,
    isEditing,
    uploading,
    imageUrl,
    imageKey,
    onOpenFull,
    onOpenPopout,
    onPickFile,
}: {
    checkingImage: boolean;
    hasImage: boolean;
    isEditing: boolean;
    uploading: boolean;
    imageUrl: string;
    imageKey: number;
    onOpenFull: () => void;
    onOpenPopout: () => void;
    onPickFile: () => void;
}) {
    if (isEditing && hasImage) {
        return (
            <img
                key={imageKey}
                src={imageUrl}
                alt="Power BI report snapshot preview"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    backgroundColor: '#ffffff',
                    opacity: 0.9,
                }}
            />
        );
    }

    return (
        <div
            style={{
                width: 'min(720px, 90%)',
                padding: '44px 40px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, #111c33 0%, #0b1220 100%)',
                border: '1px solid rgba(148,163,184,0.18)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '22px',
                textAlign: 'center',
                color: '#e2e8f0',
                boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
            }}
        >
            <div
                style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '18px',
                    background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 12px 30px rgba(37,99,235,0.5)',
                }}
            >
                <ExternalLink size={34} color="#ffffff" />
            </div>

            <div>
                <h2 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc' }}>
                    Payment Terms — Chart ARU
                </h2>
                <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '0.98rem', lineHeight: 1.5 }}>
                    Embedded Power BI sign-in is unreliable inside a slide. Open the live
                    report in a dedicated window where Microsoft authentication works
                    normally, or upload a snapshot below for presentation.
                </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button type="button" onClick={onOpenFull} style={primaryCtaStyle}>
                    <ExternalLink size={18} />
                    <span style={{ marginLeft: 8 }}>Open Live Report</span>
                </button>
                <button type="button" onClick={onOpenPopout} style={secondaryCtaStyle}>
                    <PictureInPicture2 size={18} />
                    <span style={{ marginLeft: 8 }}>Pop out floating window</span>
                </button>
            </div>

            {isEditing && (
                <button
                    type="button"
                    onClick={onPickFile}
                    disabled={uploading}
                    style={{
                        ...secondaryCtaStyle,
                        marginTop: '8px',
                        background: 'transparent',
                        border: '1px dashed rgba(148,163,184,0.45)',
                    }}
                >
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                    <span style={{ marginLeft: 8 }}>
                        {uploading ? 'Uploading…' : 'Upload report snapshot for presenting'}
                    </span>
                </button>
            )}

            {checkingImage && !isEditing && (
                <div style={{ color: '#64748b', fontSize: '0.82rem' }}>
                    Checking for uploaded snapshot…
                </div>
            )}
        </div>
    );
}

function FloatingButton({
    children,
    onClick,
    title,
    variant = 'solid',
}: {
    children: React.ReactNode;
    onClick: () => void;
    title?: string;
    variant?: 'solid' | 'ghost';
}) {
    const base: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: '9999px',
        fontSize: '0.82rem',
        fontWeight: 700,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        transition: 'background-color 0.15s',
    };
    const solid: React.CSSProperties = {
        ...base,
        border: 'none',
        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
        color: '#ffffff',
        boxShadow: '0 8px 20px rgba(37,99,235,0.35)',
    };
    const ghost: React.CSSProperties = {
        ...base,
        border: '1px solid rgba(255,255,255,0.25)',
        background: 'rgba(15,23,42,0.75)',
        color: '#e2e8f0',
    };
    return (
        <button type="button" onClick={onClick} title={title} style={variant === 'solid' ? solid : ghost}>
            {children}
        </button>
    );
}

function NavButton({
    children,
    onClick,
    disabled,
    variant,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant: 'primary' | 'secondary';
}) {
    const base: React.CSSProperties = {
        minWidth: '180px',
        height: '64px',
        borderRadius: '9999px',
        fontSize: '1rem',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform 0.08s',
    };
    const styleVar: React.CSSProperties =
        variant === 'primary'
            ? {
                ...base,
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#ffffff',
                boxShadow: '0 12px 28px rgba(37,99,235,0.35)',
            }
            : {
                ...base,
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(15,23,42,0.9)',
                color: '#f8fafc',
                boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
            };
    return (
        <button type="button" onClick={onClick} disabled={disabled} style={styleVar}>
            {children}
        </button>
    );
}

// ─── Inline style constants ──────────────────────────────────────────────────

const primaryCtaStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 22px',
    borderRadius: '9999px',
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#ffffff',
    fontSize: '0.98rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(37,99,235,0.4)',
};

const secondaryCtaStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 22px',
    borderRadius: '9999px',
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'rgba(15,23,42,0.6)',
    color: '#e2e8f0',
    fontSize: '0.98rem',
    fontWeight: 700,
    cursor: 'pointer',
};

const primaryBtnStyle = (loading: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: '9999px',
    border: 'none',
    background: loading ? '#475569' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#ffffff',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
});
