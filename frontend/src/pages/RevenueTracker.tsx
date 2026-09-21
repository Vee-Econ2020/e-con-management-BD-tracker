import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import {
    Play,
    Download,
    Eye,
    EyeOff,
    PartyPopper,
    Image as ImageIcon,
    Type,
    Plus,
    Pencil,
    ChevronLeft,
    ChevronRight,
    X,
    ArrowLeft,
    Loader2,
} from 'lucide-react';
import { ConfettiSideCannons } from '../components/ConfettiSideCannons';
import { useWeek } from '../context/WeekContext';
import { useAuth } from '../context/AuthContext';
import RevenueSlide1 from '../components/slides/RevenueSlide1';

// Slide Registry for Revenue Tracker
const REVENUE_SLIDE_REGISTRY: { [key: string]: React.ComponentType<any> } = {
    '1': RevenueSlide1,
};

// Base slides list - starting with Slide 1
const BASE_SLIDES: (string | number)[] = [1];

// Slide titles mapping
const SLIDE_TITLES: Record<string, string> = {
    '1': 'Revenue Tracker Overview',
};

// Helper for slide region
const getSlideRegion = (slideId: string | number): string => {
    const idStr = String(slideId);
    if (idStr === '1') return 'Overall';
    return 'Overall';
};

// Prepped structure for bulk hide categories - ready to scale when more slides are added
export interface BulkSlideCategory {
    id: string;
    name: string;
    slideIds: (string | number)[];
}

export const PREPPED_BULK_CATEGORIES: BulkSlideCategory[] = [
    {
        id: 'overview',
        name: 'Executive Overview',
        slideIds: [1],
    },
];

interface SlideItem {
    id: string | number;
    title: string;
    region: string;
}

const EXPORT_SLIDE_WIDTH = 1920;
const EXPORT_SLIDE_HEIGHT = 1080;

// Lazy Slide Wrapper matching Weekly Tracker exactly:
// Does NOT mount the slide or call APIs until user clicks "Load Preview"
const LazySlideWrapper = ({ children, slideNum }: { children: React.ReactNode, slideNum: number | string }) => {
    const isExportServer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('export_server') === 'true';
    const [isLoaded, setIsLoaded] = useState(isExportServer);

    if (isLoaded || isExportServer) {
        return (
            <div style={{ height: '560px', width: '100%', position: 'relative', overflow: 'hidden' }}>
                {children}
            </div>
        );
    }

    return (
        <div style={{
            height: '300px',
            backgroundColor: '#f1f5f9',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed #cbd5e1'
        }}>
            <div style={{ marginBottom: '1rem', color: '#64748b', fontWeight: '600', fontSize: '1.2rem' }}>
                Slide {slideNum} Preview
            </div>
            <button
                onClick={() => setIsLoaded(true)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: '#ffffff',
                    color: '#3b82f6',
                    border: '1px solid #3b82f6',
                    padding: '0.6rem 1.5rem',
                    borderRadius: '9999px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                <Eye size={20} />
                Load Preview
            </button>
        </div>
    );
};

export default function RevenueTracker() {
    const navigate = useNavigate();
    const { selectedWeek } = useWeek();
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin';

    // Financial Year State (synchronized via URL param ?fy=)
    const [selectedFY, setSelectedFY] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            const urlFy = new URLSearchParams(window.location.search).get('fy');
            if (urlFy) return urlFy;
        }
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const fyNum = month >= 4 ? year + 1 : year;
        return `FY${fyNum}`;
    });

    const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const slideshowRef = useRef<HTMLDivElement>(null);

    // Export state
    const [isExportingImage, setIsExportingImage] = useState<string | number | null>(null);
    const exportContainerRef = useRef<HTMLDivElement>(null);
    const [exportSlideItem, setExportSlideItem] = useState<SlideItem | null>(null);

    // Hidden slides state (persisted per FY)
    const [hiddenSlides, setHiddenSlides] = useState<Set<string>>(new Set());

    // Confetti slides state
    const [confettiSlides, setConfettiSlides] = useState<Set<string>>(new Set());

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Update URL when FY changes
    const handleFYChange = (newFY: string) => {
        setSelectedFY(newFY);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('fy', newFY);
            window.history.replaceState({}, '', url.toString());
        }
    };

    // Fetch hidden slides per financial year
    useEffect(() => {
        let isCurrent = true;
        fetch(`/api/admin/revenue/hidden-slides?fy=${selectedFY}`)
            .then(res => res.json())
            .then(data => {
                if (!isCurrent) return;
                if (data.hidden_slides) {
                    setHiddenSlides(new Set(data.hidden_slides.map(String)));
                } else {
                    setHiddenSlides(new Set());
                }
            })
            .catch(err => {
                if (!isCurrent) return;
                console.error('Failed to fetch revenue hidden slides', err);
            });

        return () => {
            isCurrent = false;
        };
    }, [selectedFY]);

    // Fetch confetti slides
    useEffect(() => {
        fetch('/api/admin/revenue/confetti-slides')
            .then(res => res.json())
            .then(data => {
                if (data.confetti_slides) {
                    setConfettiSlides(new Set(data.confetti_slides.map(String)));
                }
            })
            .catch(err => console.error('Failed to fetch revenue confetti slides', err));
    }, []);

    // Toggle hidden slide
    const toggleHiddenSlide = async (slideId: string | number) => {
        const sIdStr = String(slideId);
        try {
            const res = await fetch('/api/admin/revenue/hidden-slides/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slide_id: sIdStr, fy: selectedFY }),
            });
            const data = await res.json();
            if (res.ok && data.current_hidden) {
                setHiddenSlides(new Set(data.current_hidden.map(String)));
                showToast(`Slide ${sIdStr} is now ${data.status}`);
            } else {
                throw new Error(data.detail || 'Failed to toggle hidden state');
            }
        } catch (err) {
            console.error('Error toggling hidden slide:', err);
            showToast('Failed to update hidden state');
        }
    };

    // Toggle confetti slide
    const toggleConfettiSlide = async (slideId: string | number) => {
        const sIdStr = String(slideId);
        try {
            const res = await fetch('/api/admin/revenue/confetti-slides/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slide_id: sIdStr }),
            });
            const data = await res.json();
            if (res.ok && data.current_confetti) {
                setConfettiSlides(new Set(data.current_confetti.map(String)));
                showToast(`Confetti ${data.status} for Slide ${sIdStr}`);
            } else {
                throw new Error(data.detail || 'Failed to toggle confetti');
            }
        } catch (err) {
            console.error('Error toggling confetti:', err);
            showToast('Failed to update confetti setting');
        }
    };

    // Export slide as image using html2canvas
    const handleExportSlideImage = async (slideItem: SlideItem) => {
        if (isExportingImage !== null) return;
        setIsExportingImage(slideItem.id);
        setExportSlideItem(slideItem);
        showToast(`Exporting Slide ${slideItem.id} as image...`);

        setTimeout(async () => {
            try {
                const node = exportContainerRef.current;
                if (!node) throw new Error('Export container not found');

                const canvas = await html2canvas(node, {
                    backgroundColor: '#ffffff',
                    scale: 1,
                    useCORS: true,
                    logging: false,
                    width: EXPORT_SLIDE_WIDTH,
                    height: EXPORT_SLIDE_HEIGHT,
                });

                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png', 1.0);
                link.download = `revenue-tracker-slide-${slideItem.id}-${selectedFY}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('Slide image downloaded successfully!');
            } catch (err) {
                console.error('Failed to export image:', err);
                showToast('Image export failed');
            } finally {
                setIsExportingImage(null);
                setExportSlideItem(null);
            }
        }, 600);
    };

    // Slides to display
    const displaySlides = useMemo<SlideItem[]>(() => {
        return BASE_SLIDES.map(sId => ({
            id: sId,
            title: SLIDE_TITLES[String(sId)] || `Slide ${sId}`,
            region: getSlideRegion(sId),
        }));
    }, []);

    // Presentation slides (exclude hidden slides for non-admins)
    const presentationSlides = useMemo(() => {
        return displaySlides.filter(s => isAdmin || !hiddenSlides.has(String(s.id)));
    }, [displaySlides, isAdmin, hiddenSlides]);

    // Slideshow keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isSlideshowOpen) return;

        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
            e.preventDefault();
            setActiveSlideIndex(prev => (prev < presentationSlides.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            setActiveSlideIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Escape') {
            setIsSlideshowOpen(false);
        } else if (e.key === 'f' || e.key === 'F') {
            if (!document.fullscreenElement) {
                slideshowRef.current?.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        }
    }, [isSlideshowOpen, presentationSlides.length]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const startPresentation = (initialSlideId?: string | number) => {
        if (initialSlideId !== undefined) {
            const idx = presentationSlides.findIndex(s => String(s.id) === String(initialSlideId));
            setActiveSlideIndex(idx !== -1 ? idx : 0);
        } else {
            setActiveSlideIndex(0);
        }
        setIsSlideshowOpen(true);
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f8fafc',
            fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
            color: '#1e293b'
        }}>
            {/* Top Navigation Bar */}
            <header style={{
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                padding: '0.85rem 2rem',
                position: 'sticky',
                top: 0,
                zIndex: 30,
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '0.45rem 0.85rem',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            color: '#475569',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                        title="Back to Home"
                    >
                        <ArrowLeft size={16} />
                        <span>Home</span>
                    </button>

                    <img
                        src="/econ-logo.png"
                        alt="e-con Systems"
                        style={{ maxHeight: '32px', width: 'auto', objectFit: 'contain' }}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                            Revenue Tracker
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                            Manufacturing & Invoicing Analytics • Week {selectedWeek || 36}
                        </span>
                    </div>
                </div>

                {/* Controls: Financial Year Toggle & Presentation Launcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    {/* FY Toggle */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '9999px',
                        padding: '3px',
                        border: '1px solid #cbd5e1'
                    }}>
                        {['FY2027', 'FY2028'].map((fyOption) => {
                            const isSelected = selectedFY === fyOption;
                            return (
                                <button
                                    key={fyOption}
                                    onClick={() => handleFYChange(fyOption)}
                                    style={{
                                        border: 'none',
                                        backgroundColor: isSelected ? '#1d4ed8' : 'transparent',
                                        color: isSelected ? '#ffffff' : '#64748b',
                                        padding: '0.35rem 1rem',
                                        borderRadius: '9999px',
                                        fontSize: '0.85rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isSelected ? '0 2px 6px rgba(29, 78, 216, 0.35)' : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {isSelected && (
                                        <span style={{
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: '#93c5fd'
                                        }} />
                                    )}
                                    {fyOption}
                                </button>
                            );
                        })}
                    </div>

                    {/* Start Presentation Button */}
                    <button
                        onClick={() => startPresentation()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '0.55rem 1.25rem',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)'
                        }}
                    >
                        <Play size={16} fill="white" />
                        <span>Start Presentation</span>
                    </button>
                </div>
            </header>

            {/* Toast Notifications */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    zIndex: 9999,
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    border: '1px solid #334155',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    {toastMessage}
                </div>
            )}

            {/* Main Content Area: Slides Grid Overview */}
            <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '2rem 1.5rem' }}>
                <div style={{
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                            Revenue Slides
                        </h2>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>
                            Manage, preview, and configure slide visibility and celebration effects for {selectedFY}.
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            padding: '0.35rem 0.85rem',
                            borderRadius: '9999px',
                            border: '1px solid #bae6fd'
                        }}>
                            {displaySlides.length} {displaySlides.length === 1 ? 'Slide' : 'Slides'} Total
                        </span>
                    </div>
                </div>

                {/* Slides List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {displaySlides.map((slideItem) => {
                        const sIdStr = String(slideItem.id);
                        const isHidden = hiddenSlides.has(sIdStr);
                        const hasConfetti = confettiSlides.has(sIdStr);
                        const SlideComponent = REVENUE_SLIDE_REGISTRY[sIdStr];

                        if (!isAdmin && isHidden) {
                            return null;
                        }

                        return (
                            <div key={sIdStr}>
                                <div
                                    id={`slide-preview-${sIdStr}`}
                                    style={{
                                        paddingLeft: '1rem',
                                        paddingRight: '1rem',
                                        paddingTop: '1rem',
                                        paddingBottom: '1rem',
                                        borderRadius: '16px',
                                        backgroundColor: '#ffffff',
                                        border: isHidden ? '1.5px dashed #fca5a5' : '1px solid #cbd5e1',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                        opacity: isHidden ? 0.75 : 1,
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {/* Slide Header: 1-to-1 match with Weekly Tracker design */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '0.75rem',
                                        flexWrap: 'wrap',
                                        gap: '0.75rem'
                                    }}>
                                        <div>
                                            <h3 style={{
                                                fontSize: '1.3rem',
                                                fontWeight: '800',
                                                color: (isAdmin && isHidden) ? '#9ca3af' : '#4a4a55',
                                                textDecoration: (isAdmin && isHidden) ? 'line-through' : 'none',
                                                margin: 0
                                            }}>
                                                Slide {sIdStr} - {slideItem.region} - {slideItem.title}
                                                {isAdmin && isHidden && (
                                                    <span style={{ fontSize: '0.8rem', color: '#ef4444', textDecoration: 'none', marginLeft: '0.5rem' }}>
                                                        (Hidden)
                                                    </span>
                                                )}
                                            </h3>
                                        </div>

                                        {/* Header Action Buttons: 1-to-1 match with media_1789719291506.png */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                                            {/* Start from here button */}
                                            <button
                                                onClick={() => startPresentation(slideItem.id)}
                                                disabled={isHidden}
                                                style={{
                                                    backgroundColor: isHidden ? '#e5e7eb' : '#5D9CEC',
                                                    border: 'none',
                                                    padding: '0.3rem 0.8rem',
                                                    borderRadius: '20px',
                                                    color: isHidden ? '#9ca3af' : 'white',
                                                    fontWeight: '700',
                                                    fontSize: '0.8rem',
                                                    cursor: isHidden ? 'not-allowed' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    transition: 'all 0.2s',
                                                    boxShadow: isHidden ? 'none' : '0 2px 4px rgba(93, 156, 236, 0.35)'
                                                }}
                                                title={isHidden ? 'Unhide slide to start from here' : 'Start slideshow from this slide'}
                                            >
                                                <Play size={12} fill="currentColor" /> Start from here
                                            </button>

                                            {/* Export as Image button */}
                                            <button
                                                onClick={() => handleExportSlideImage(slideItem)}
                                                disabled={isExportingImage !== null}
                                                style={{
                                                    backgroundColor: isExportingImage === slideItem.id ? '#94a3b8' : '#0f766e',
                                                    border: 'none',
                                                    padding: '0.3rem 0.8rem',
                                                    borderRadius: '20px',
                                                    color: 'white',
                                                    fontWeight: '700',
                                                    fontSize: '0.8rem',
                                                    cursor: isExportingImage !== null ? 'wait' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    transition: 'all 0.2s',
                                                    boxShadow: isExportingImage === slideItem.id ? 'none' : '0 2px 4px rgba(15, 118, 110, 0.35)'
                                                }}
                                                title="Export this slide as a full-resolution PNG"
                                            >
                                                {isExportingImage === slideItem.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                                {isExportingImage === slideItem.id ? 'Exporting...' : 'Export as Image'}
                                            </button>

                                            {/* Visibility Toggle button */}
                                            <button
                                                onClick={() => toggleHiddenSlide(slideItem.id)}
                                                style={{
                                                    backgroundColor: '#f3f4f6',
                                                    border: isHidden ? '1.5px solid #ef4444' : '1px solid #d1d5db',
                                                    padding: '0.3rem 0.6rem',
                                                    borderRadius: '20px',
                                                    color: isHidden ? '#dc2626' : '#374151',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                                title={isHidden ? 'Show in presentation' : 'Hide from presentation'}
                                            >
                                                {isHidden ? <EyeOff size={16} color="#dc2626" /> : <Eye size={16} />}
                                            </button>

                                            {/* Confetti Toggle button */}
                                            <button
                                                onClick={() => toggleConfettiSlide(slideItem.id)}
                                                style={{
                                                    backgroundColor: hasConfetti ? '#fef3c7' : '#f3f4f6',
                                                    border: `1px solid ${hasConfetti ? '#f59e0b' : '#d1d5db'}`,
                                                    padding: '0.3rem 0.6rem',
                                                    borderRadius: '20px',
                                                    color: hasConfetti ? '#d97706' : '#6b7280',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                                title={hasConfetti ? 'Disable confetti' : 'Enable confetti'}
                                            >
                                                <PartyPopper size={16} />
                                            </button>

                                            {/* GIF Overlay button */}
                                            <button
                                                style={{
                                                    backgroundColor: '#f3f4f6',
                                                    border: '1px solid #d1d5db',
                                                    padding: '0.3rem 0.6rem',
                                                    borderRadius: '20px',
                                                    color: '#6b7280',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="GIF overlay (coming soon)"
                                            >
                                                <ImageIcon size={16} />
                                            </button>

                                            {/* Add Text Overlay button */}
                                            <button
                                                style={{
                                                    backgroundColor: '#f3f4f6',
                                                    border: '1px solid #d1d5db',
                                                    padding: '0.3rem 0.6rem',
                                                    borderRadius: '20px',
                                                    color: '#374151',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="Text overlay (coming soon)"
                                            >
                                                <Type size={14} /> Text
                                            </button>

                                            {/* Add Image Overlay button */}
                                            <button
                                                style={{
                                                    backgroundColor: '#f3f4f6',
                                                    border: '1px solid #d1d5db',
                                                    padding: '0.3rem 0.6rem',
                                                    borderRadius: '20px',
                                                    color: '#374151',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="Image overlay (coming soon)"
                                            >
                                                <Plus size={14} /> Image
                                            </button>

                                            {/* Edit button */}
                                            <button
                                                style={{
                                                    backgroundColor: '#93c5fd',
                                                    border: 'none',
                                                    padding: '0.3rem 1rem',
                                                    borderRadius: '20px',
                                                    fontWeight: '700',
                                                    color: '#1e3a8a',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="Edit slide"
                                            >
                                                <Pencil size={14} /> Edit
                                            </button>
                                        </div>
                                    </div>

                                    {/* Slide Content: Lazy Slide Wrapper matching media_1789719291506.png */}
                                    <div style={{ marginBottom: '1rem' }}>
                                        {SlideComponent ? (
                                            <LazySlideWrapper slideNum={sIdStr}>
                                                <SlideComponent fy={selectedFY} isEditing={false} />
                                            </LazySlideWrapper>
                                        ) : (
                                            <div style={{
                                                height: '300px',
                                                backgroundColor: '#fee2e2',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#991b1b',
                                                fontWeight: '600',
                                                borderRadius: '12px'
                                            }}>
                                                Slide {sIdStr} Not Found
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Add Button Row below the slide - 1-to-1 match with media_1789719291506.png */}
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', marginBottom: '1.5rem' }}>
                                    <button
                                        onClick={() => showToast('Custom slide creation ready for future releases')}
                                        style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            backgroundColor: '#e2e8f0',
                                            border: '1px solid #cbd5e1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#64748b',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = '#dbeafe';
                                            e.currentTarget.style.borderColor = '#93c5fd';
                                            e.currentTarget.style.color = '#2563eb';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = '#e2e8f0';
                                            e.currentTarget.style.borderColor = '#cbd5e1';
                                            e.currentTarget.style.color = '#64748b';
                                        }}
                                        title="Add Image Slide Here"
                                    >
                                        <Plus size={24} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Presentation Mode Slideshow Modal */}
            {isSlideshowOpen && (
                <div
                    ref={slideshowRef}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: '#ffffff',
                        zIndex: 99999,
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100vw',
                        height: '100vh',
                        overflow: 'hidden'
                    }}
                >
                    {/* Watermark / FY Pill in Presentation Mode */}
                    <div style={{
                        position: 'absolute',
                        bottom: '16px',
                        right: '20px',
                        zIndex: 40,
                        backgroundColor: '#1d4ed8',
                        color: '#ffffff',
                        padding: '4px 14px',
                        borderRadius: '9999px',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        letterSpacing: '0.05em',
                        boxShadow: '0 2px 8px rgba(29, 78, 216, 0.4)',
                        border: '1.5px solid rgba(255, 255, 255, 0.5)',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backdropFilter: 'blur(4px)'
                    }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#60a5fa',
                            boxShadow: '0 0 4px #60a5fa'
                        }} />
                        <span>{selectedFY}</span>
                    </div>

                    {/* Slideshow Top Controls */}
                    <div style={{
                        position: 'absolute',
                        top: '16px',
                        right: '20px',
                        zIndex: 50,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <button
                            onClick={() => setIsSlideshowOpen(false)}
                            style={{
                                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                backdropFilter: 'blur(4px)'
                            }}
                            title="Exit Presentation (Esc)"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Active Slide Display Area */}
                    <div style={{
                        flex: 1,
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        {(() => {
                            const slideItem = presentationSlides[activeSlideIndex];
                            if (!slideItem) return null;

                            const sIdStr = String(slideItem.id);
                            const SlideComponent = REVENUE_SLIDE_REGISTRY[sIdStr];
                            const hasConfetti = confettiSlides.has(sIdStr);

                            return (
                                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                    {/* Confetti Cannons if active for this slide */}
                                    {hasConfetti && (
                                        <ConfettiSideCannons key={`confetti-${sIdStr}-${activeSlideIndex}`} />
                                    )}

                                    {SlideComponent ? (
                                        <SlideComponent
                                            fy={selectedFY}
                                            isEditing={false}
                                            onNextSlide={() => {
                                                if (activeSlideIndex < presentationSlides.length - 1) {
                                                    setActiveSlideIndex(prev => prev + 1);
                                                }
                                            }}
                                            onPreviousSlide={() => {
                                                if (activeSlideIndex > 0) {
                                                    setActiveSlideIndex(prev => prev - 1);
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '2rem',
                                            color: '#64748b'
                                        }}>
                                            Slide {sIdStr} Not Found
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Slideshow Bottom Navigation Controls */}
                    {presentationSlides.length > 1 && (
                        <div style={{
                            position: 'absolute',
                            bottom: '20px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 50,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            backgroundColor: 'rgba(15, 23, 42, 0.8)',
                            padding: '0.4rem 1rem',
                            borderRadius: '9999px',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}>
                            <button
                                onClick={() => setActiveSlideIndex(prev => Math.max(0, prev - 1))}
                                disabled={activeSlideIndex === 0}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: activeSlideIndex === 0 ? '#64748b' : '#ffffff',
                                    cursor: activeSlideIndex === 0 ? 'default' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px'
                                }}
                                title="Previous Slide (Left Arrow)"
                            >
                                <ChevronLeft size={22} />
                            </button>

                            <span style={{
                                color: '#ffffff',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                userSelect: 'none'
                            }}>
                                {activeSlideIndex + 1} / {presentationSlides.length}
                            </span>

                            <button
                                onClick={() => setActiveSlideIndex(prev => Math.min(presentationSlides.length - 1, prev + 1))}
                                disabled={activeSlideIndex === presentationSlides.length - 1}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: activeSlideIndex === presentationSlides.length - 1 ? '#64748b' : '#ffffff',
                                    cursor: activeSlideIndex === presentationSlides.length - 1 ? 'default' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px'
                                }}
                                title="Next Slide (Right Arrow)"
                            >
                                <ChevronRight size={22} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Hidden Offscreen Container for High-Resolution Slide Image Capture */}
            {isExportingImage !== null && exportSlideItem && (
                <div style={{
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    width: `${EXPORT_SLIDE_WIDTH}px`,
                    height: `${EXPORT_SLIDE_HEIGHT}px`,
                    pointerEvents: 'none',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                    zIndex: -9999,
                    transform: 'translateX(-10000px)'
                }}>
                    <div
                        ref={exportContainerRef}
                        style={{
                            width: `${EXPORT_SLIDE_WIDTH}px`,
                            height: `${EXPORT_SLIDE_HEIGHT}px`,
                            backgroundColor: '#ffffff',
                            overflow: 'hidden',
                            position: 'relative'
                        }}
                    >
                        {(() => {
                            const Comp = REVENUE_SLIDE_REGISTRY[String(exportSlideItem.id)];
                            return Comp ? <Comp fy={selectedFY} isEditing={false} /> : null;
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
