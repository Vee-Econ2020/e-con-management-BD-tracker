
import { useEffect, useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { DEFAULT_GIF_POSITION, DEFAULT_GIF_URL, GifOverlay, type GifPosition } from './GifOverlay';
import { SlideExtrasOverlay, EMPTY_SLIDE_EXTRAS, type SlideExtras, type TextOverlay, type ImageOverlay } from './SlideExtrasOverlay';

interface ImageUploadSlideProps {
    title: string;
    slideId: string;
    isEditing: boolean;
    gifEnabled?: boolean;
    gifUrl?: string;
    gifPosition?: GifPosition;
    onGifUrlChange?: (gifUrl: string) => void;
    onGifPositionChange?: (gifPosition: GifPosition) => void;
    extras?: SlideExtras;
    onUpdateText?: (id: string, patch: Partial<TextOverlay>) => void;
    onUpdateImage?: (id: string, patch: Partial<ImageOverlay>) => void;
    onDeleteText?: (id: string) => void;
    onDeleteImage?: (id: string) => void;
}

export function ImageUploadSlide({
    title,
    slideId,
    isEditing,
    gifEnabled = false,
    gifUrl = DEFAULT_GIF_URL,
    gifPosition = DEFAULT_GIF_POSITION,
    onGifUrlChange,
    onGifPositionChange,
    extras = EMPTY_SLIDE_EXTRAS,
    onUpdateText,
    onUpdateImage,
    onDeleteText,
    onDeleteImage,
}: ImageUploadSlideProps) {
    const [currentWeek, setCurrentWeek] = useState<number | null>(null);
    const [imageKey, setImageKey] = useState(Date.now());
    const [hasImage, setHasImage] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch('/api/week/current')
            .then(res => res.json())
            .then(d => setCurrentWeek(d.week))
            .catch(err => console.error("Failed to fetch current week:", err));
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !currentWeek) return;

        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);

        const formData = new FormData();
        formData.append('slide_id', slideId);
        formData.append('week', currentWeek.toString());
        formData.append('file', file);

        try {
            const res = await fetch('/api/admin/slides/upload-image', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                // Force image refresh
                setImageKey(Date.now());
                setHasImage(true);
            } else {
                console.error("Upload failed");
                alert("Upload failed");
            }
        } catch (err) {
            console.error(err);
            alert("Error uploading image");
        } finally {
            setUploading(false);
        }
    };

    const imageUrl = currentWeek ? `/api/admin/slides/image/${slideId}/${currentWeek}?t=${imageKey}` : '';

    const containerStyle = (isEditing || !hasImage) ? {
        padding: '0 3vw 3vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flex: 1
    } : {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: 0
    };

    const dropAreaStyle = (isEditing || !hasImage) ? {
        width: '100%',
        height: '100%',
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative' as const,
        overflow: 'hidden',
        padding: '2rem'
    } : {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative' as const,
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: (isEditing || !hasImage) ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Inter', system-ui, sans-serif",
            overflow: 'hidden',
        }}>
            {/* Header - Only hide if viewing a completed uploaded slide */}
            {(!hasImage || isEditing) && (
                <div style={{
                    padding: '1.5vh 3vw',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                }}>
                    <h1 style={{
                        margin: 0,
                        fontSize: 'clamp(1.5rem, 4vh, 2.5rem)',
                        fontWeight: 900,
                        color: '#0f172a',
                        letterSpacing: '-0.02em',
                    }}>
                        {title}
                    </h1>

                    <div style={{ display: 'flex', gap: '1vw' }}>
                        <div style={{
                            background: '#1e40af',
                            color: 'white',
                            padding: '0.5vh 1.5vw',
                            borderRadius: '99px',
                            fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                            fontWeight: 800,
                            boxShadow: '0 4px 12px rgba(30, 64, 175, 0.2)',
                        }}>
                            WEEK {currentWeek}
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div style={containerStyle}>
                <div ref={dropAreaRef} style={dropAreaStyle}>
                    {/* Image */}
                    {currentWeek && (
                        <img
                            src={imageUrl}
                            alt="Slide Content"
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: (isEditing || !hasImage) ? 'contain' : 'contain',
                                display: hasImage ? 'block' : 'none',
                                borderRadius: (isEditing || !hasImage) ? '8px' : '0px',
                                boxShadow: (isEditing || !hasImage) ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                            }}
                            onLoad={() => setHasImage(true)}
                            onError={() => setHasImage(false)}
                        />
                    )}

                    <GifOverlay
                        containerRef={dropAreaRef}
                        isEditing={isEditing}
                        gifEnabled={gifEnabled}
                        gifUrl={gifUrl}
                        gifPosition={gifPosition}
                        onGifUrlChange={onGifUrlChange}
                        onGifPositionChange={onGifPositionChange}
                    />

                    <SlideExtrasOverlay
                        containerRef={dropAreaRef}
                        isEditing={isEditing}
                        extras={extras}
                        onUpdateText={(id, patch) => onUpdateText?.(id, patch)}
                        onUpdateImage={(id, patch) => onUpdateImage?.(id, patch)}
                        onDeleteText={(id) => onDeleteText?.(id)}
                        onDeleteImage={(id) => onDeleteImage?.(id)}
                    />

                    {/* Placeholder / Empty State */}
                    {!hasImage && !uploading && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1rem',
                            color: '#cbd5e1'
                        }}>
                            <ImageIcon size={64} strokeWidth={1} />
                            <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>
                                {isEditing ? "No image uploaded yet" : "No image available for this week"}
                            </p>
                        </div>
                    )}

                    {/* Upload Spinner */}
                    {uploading && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1rem',
                            color: '#3b82f6'
                        }}>
                            <Loader2 size={48} className="animate-spin" />
                            <p style={{ fontWeight: 600 }}>Uploading image...</p>
                        </div>
                    )}

                    {/* Upload Button (Overlay when Editing) */}
                    {isEditing && (
                        <div style={{
                            position: 'absolute',
                            bottom: '2rem',
                            right: '2rem',
                            display: 'flex',
                            gap: '1rem',
                            zIndex: 10
                        }}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.8rem 1.5rem',
                                    background: '#1e40af',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '99px',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(30, 64, 175, 0.3)',
                                    transition: 'transform 0.2s',
                                }}
                                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <Upload size={20} />
                                {hasImage ? "Replace Image" : "Upload Image"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
