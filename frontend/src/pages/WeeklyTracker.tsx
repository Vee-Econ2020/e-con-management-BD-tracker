import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, Loader2, Plus, Play, Eye, EyeOff, Pencil, Trash2, X, PartyPopper, Image as ImageIcon, Type } from 'lucide-react';
import { ConfettiSideCannons } from '../components/ConfettiSideCannons';
import { ImageUploadSlide } from '../components/slides/ImageUploadSlide';
import { DEFAULT_GIF_POSITION, DEFAULT_GIF_URL, GifOverlay, type GifPosition } from '../components/slides/GifOverlay';
import {
    SlideExtrasOverlay,
    EMPTY_SLIDE_EXTRAS,
    DEFAULT_TEXT_OVERLAY,
    DEFAULT_IMAGE_OVERLAY,
    type SlideExtras,
    type TextOverlay,
    type ImageOverlay,
} from '../components/slides/SlideExtrasOverlay';
import Slide2 from '../components/slides/Slide2';
import Slide2_5 from '../components/slides/Slide2_5';
import Slide3 from '../components/slides/Slide3';
import Slide4 from '../components/slides/Slide4';
import Slide5 from '../components/slides/Slide5';
import Slide6 from '../components/slides/Slide6';
import Slide6_2 from '../components/slides/Slide6_2';
import Slide6_3 from '../components/slides/Slide6_3';
import Slide6_4 from '../components/slides/Slide6_4';
import Slide7 from '../components/slides/Slide7';
import Slide8 from '../components/slides/Slide8';
import Slide9 from '../components/slides/Slide9';
import Slide10 from '../components/slides/Slide10';
import Slide11 from '../components/slides/Slide11';
import Slide12 from '../components/slides/Slide12';
import Slide13 from '../components/slides/Slide13';
import Slide14 from '../components/slides/Slide14';
import Slide15 from '../components/slides/Slide15';
import Slide16 from '../components/slides/Slide16';
import Slide17 from '../components/slides/Slide17';
import Slide18 from '../components/slides/Slide18';
import Slide19 from '../components/slides/Slide19';
import Slide20 from '../components/slides/Slide20';
import Slide21 from '../components/slides/Slide21';
import Slide22 from '../components/slides/Slide22';
import Slide23 from '../components/slides/Slide23';
import Slide24 from '../components/slides/Slide24';
import Slide25 from '../components/slides/Slide25';
import Slide26 from '../components/slides/Slide26';
import Slide27 from '../components/slides/Slide27';
import Slide28 from '../components/slides/Slide28';
import Slide9_2_2 from '../components/slides/Slide9_2_2';
import Slide12_2_2 from '../components/slides/Slide12_2_2';
import Slide15_2_2 from '../components/slides/Slide15_2_2';
import Slide18_2_2 from '../components/slides/Slide18_2_2';
import Slide21_2_2 from '../components/slides/Slide21_2_2';
import Slide24_2_2 from '../components/slides/Slide24_2_2';
import Slide27_2_2 from '../components/slides/Slide27_2_2';
import {
    Slide9_1, Slide9_2, Slide9_1_1, Slide9_2_1,
    Slide12_1, Slide12_2, Slide12_1_1, Slide12_2_1,
    Slide15_1, Slide15_2, Slide15_1_1, Slide15_2_1,
    Slide18_1, Slide18_2, Slide18_1_1, Slide18_2_1,
    Slide21_1, Slide21_2, Slide21_1_1, Slide21_2_1,
    Slide24_1, Slide24_2, Slide24_1_1, Slide24_2_1,
    Slide27_1, Slide27_2, Slide27_1_1, Slide27_2_1
} from '../components/slides/RegionActivitySlides';
import {
    Slide9_2_3, Slide12_2_3, Slide15_2_3, Slide18_2_3,
    Slide21_2_3, Slide24_2_3, Slide27_2_3,
    Slide9_2_4, Slide12_2_4, Slide15_2_4, Slide18_2_4,
    Slide21_2_4, Slide24_2_4, Slide27_2_4
} from '../components/slides/RegionGMSlides';
import ServicesChartSlide from '../components/slides/ServicesChartSlide';
import ServicesBacklogSlide from '../components/slides/ServicesBacklogSlide';
import { WhaleAccountSlide } from '../components/slides/WhaleAccountSlide';
import ServicesQ1SnapshotSlide from '../components/slides/ServicesQ1SnapshotSlide';

// --- Configuration ---
// Components that accept isEditing prop
const SLIDE_REGISTRY: { [key: string]: React.ComponentType<any> } = {
    2: Slide2,
    2.5: Slide2_5,
    3: Slide3,
    4: Slide4,
    5: Slide5,
    6: Slide6,
    6.2: Slide6_2,
    6.3: Slide6_3,
    6.4: Slide6_4,
    7: Slide7,
    8: Slide8,
    9: Slide9,
    10: Slide10,
    11: Slide11,
    12: Slide12,
    13: Slide13,
    14: Slide14,
    15: Slide15,
    16: Slide16,
    17: Slide17,
    18: Slide18,
    19: Slide19,
    20: Slide20,
    21: Slide21,
    22: Slide22,
    23: Slide23,
    24: Slide24,
    25: Slide25,
    26: Slide26,
    27: Slide27,
    28: Slide28,
    '6.1': Slide28,
    '9.5': Slide28,
    '12.5': Slide28,
    '15.5': Slide28,
    '18.5': Slide28,
    '21.5': Slide28,
    '24.5': Slide28,
    '27.5': Slide28,
    '9.1': Slide9_1, '9.1.1': Slide9_1_1, '9.2': Slide9_2, '9.2.1': Slide9_2_1,
    '12.1': Slide12_1, '12.1.1': Slide12_1_1, '12.2': Slide12_2, '12.2.1': Slide12_2_1,
    '15.1': Slide15_1, '15.1.1': Slide15_1_1, '15.2': Slide15_2, '15.2.1': Slide15_2_1,
    '18.1': Slide18_1, '18.1.1': Slide18_1_1, '18.2': Slide18_2, '18.2.1': Slide18_2_1,
    '21.1': Slide21_1, '21.1.1': Slide21_1_1, '21.2': Slide21_2, '21.2.1': Slide21_2_1,
    '24.1': Slide24_1, '24.1.1': Slide24_1_1, '24.2': Slide24_2, '24.2.1': Slide24_2_1,
    '27.1': Slide27_1, '27.1.1': Slide27_1_1, '27.2': Slide27_2, '27.2.1': Slide27_2_1,
    '9.2.2': Slide9_2_2,
    '12.2.2': Slide12_2_2,
    '15.2.2': Slide15_2_2,
    '18.2.2': Slide18_2_2,
    '21.2.2': Slide21_2_2,
    '24.2.2': Slide24_2_2,
    '27.2.2': Slide27_2_2,
    '9.2.3': Slide9_2_3,
    '12.2.3': Slide12_2_3,
    '15.2.3': Slide15_2_3,
    '18.2.3': Slide18_2_3,
    '21.2.3': Slide21_2_3,
    '24.2.3': Slide24_2_3,
    '27.2.3': Slide27_2_3,
    '9.2.4': Slide9_2_4,
    '12.2.4': Slide12_2_4,
    '15.2.4': Slide15_2_4,
    '18.2.4': Slide18_2_4,
    '21.2.4': Slide21_2_4,
    '24.2.4': Slide24_2_4,
    '27.2.4': Slide27_2_4,
    '9.2.5': (props: any) => <WhaleAccountSlide {...props} region="USA West" />,
    '12.2.5': (props: any) => <WhaleAccountSlide {...props} region="Europe" />,
    '15.2.5': (props: any) => <WhaleAccountSlide {...props} region="USA East" />,
    '18.2.5': (props: any) => <WhaleAccountSlide {...props} region="Asean" />,
    '21.2.5': (props: any) => <WhaleAccountSlide {...props} region="Japan" />,
    '24.2.5': (props: any) => <WhaleAccountSlide {...props} region="Korea" />,
    '27.2.5': (props: any) => <WhaleAccountSlide {...props} region="Legacy" />,

    // ── Services-only chart mirrors ───────────────────────────────────────
    // Each parent chart slide (cumulative/trend/pipeline) has a sibling here
    // that fetches /api/admin/slides/services/{slideNo} and renders the same
    // shared chart with `hideTargets` enabled.
    '3_services':  (props: any) => <ServicesChartSlide slideNo={3}  chartKind="cumulative" regionLabel="Overall" {...props} />,
    '3_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="Overall" quarter={props.quarter} />,
    '4_services':  (props: any) => <ServicesChartSlide slideNo={4}  chartKind="trend"      regionLabel="Overall" {...props} />,
    '5_services':  (props: any) => <ServicesChartSlide slideNo={5}  chartKind="pipeline"   regionLabel="Overall" {...props} />,
    '7_services':  (props: any) => <ServicesChartSlide slideNo={7}  chartKind="cumulative" regionLabel="US West" {...props} />,
    '7_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="US West" quarter={props.quarter} />,
    '8_services':  (props: any) => <ServicesChartSlide slideNo={8}  chartKind="trend"      regionLabel="US West" {...props} />,
    '9_services':  (props: any) => <ServicesChartSlide slideNo={9}  chartKind="pipeline"   regionLabel="US West" {...props} />,
    '10_services': (props: any) => <ServicesChartSlide slideNo={10} chartKind="cumulative" regionLabel="Europe"  {...props} />,
    '10_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="Europe" quarter={props.quarter} />,
    '11_services': (props: any) => <ServicesChartSlide slideNo={11} chartKind="trend"      regionLabel="Europe"  {...props} />,
    '12_services': (props: any) => <ServicesChartSlide slideNo={12} chartKind="pipeline"   regionLabel="Europe"  {...props} />,
    '13_services': (props: any) => <ServicesChartSlide slideNo={13} chartKind="cumulative" regionLabel="US East" {...props} />,
    '13_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="US East" quarter={props.quarter} />,
    '14_services': (props: any) => <ServicesChartSlide slideNo={14} chartKind="trend"      regionLabel="US East" {...props} />,
    '15_services': (props: any) => <ServicesChartSlide slideNo={15} chartKind="pipeline"   regionLabel="US East" {...props} />,
    '16_services': (props: any) => <ServicesChartSlide slideNo={16} chartKind="cumulative" regionLabel="ASEAN"   {...props} />,
    '16_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="Asean" quarter={props.quarter} />,
    '17_services': (props: any) => <ServicesChartSlide slideNo={17} chartKind="trend"      regionLabel="ASEAN"   {...props} />,
    '18_services': (props: any) => <ServicesChartSlide slideNo={18} chartKind="pipeline"   regionLabel="ASEAN"   {...props} />,
    '19_services': (props: any) => <ServicesChartSlide slideNo={19} chartKind="cumulative" regionLabel="Japan"   {...props} />,
    '19_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="Japan" quarter={props.quarter} />,
    '20_services': (props: any) => <ServicesChartSlide slideNo={20} chartKind="trend"      regionLabel="Japan"   {...props} />,
    '21_services': (props: any) => <ServicesChartSlide slideNo={21} chartKind="pipeline"   regionLabel="Japan"   {...props} />,
    '22_services': (props: any) => <ServicesChartSlide slideNo={22} chartKind="cumulative" regionLabel="KANZ"    {...props} />,
    '22_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="KANZ" quarter={props.quarter} />,
    '23_services': (props: any) => <ServicesChartSlide slideNo={23} chartKind="trend"      regionLabel="KANZ"    {...props} />,
    '24_services': (props: any) => <ServicesChartSlide slideNo={24} chartKind="pipeline"   regionLabel="KANZ"    {...props} />,
    '25_services': (props: any) => <ServicesChartSlide slideNo={25} chartKind="cumulative" regionLabel="Legacy"  {...props} />,
    '25_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="Legacy" quarter={props.quarter} />,
    '26_services': (props: any) => <ServicesChartSlide slideNo={26} chartKind="trend"      regionLabel="Legacy"  {...props} />,
    '27_services': (props: any) => <ServicesChartSlide slideNo={27} chartKind="pipeline"   regionLabel="Legacy"  {...props} />,

    // Services-only Order Backlog mirrors
    '6.2_services':    () => <ServicesBacklogSlide region="Overall" />,
    '9.2.2_services':  () => <ServicesBacklogSlide region="US West" />,
    '12.2.2_services': () => <ServicesBacklogSlide region="Europe" />,
    '15.2.2_services': () => <ServicesBacklogSlide region="US East" />,
    '18.2.2_services': () => <ServicesBacklogSlide region="Asean" />,
    '21.2.2_services': () => <ServicesBacklogSlide region="Japan" />,
    '24.2.2_services': () => <ServicesBacklogSlide region="KANZ" />,
    '27.2.2_services': () => <ServicesBacklogSlide region="Legacy" />,
};

const EXPORT_SLIDE_WIDTH = 1920;
const EXPORT_SLIDE_HEIGHT = 1080;
const EXPORT_CAPTURE_SCALE = 1;
const DEFAULT_CUSTOM_GIF_URL = DEFAULT_GIF_URL;
const DEFAULT_CUSTOM_GIF_POSITION = DEFAULT_GIF_POSITION;

const sanitizeFileNamePart = (value: string) => {
    const cleaned = value
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 90);

    return cleaned || 'slide';
};

type SlideId = number | string;

interface StandardSlideGifData {
    enabled: boolean;
    url: string;
    position: GifPosition;
}

interface CustomSlideData {
    id: string;
    parentId: SlideId;
    title?: string;
    gifEnabled?: boolean;
    gifUrl?: string;
    gifPosition?: GifPosition;
    created_at?: string;
}

interface SlideItem {
    id: SlideId;
    isCustom: boolean;
    data?: CustomSlideData;
}

interface ExportProgress {
    current: number;
    total: number;
    title: string;
}

interface FetchTracker {
    getPendingCount: () => number;
    restore: () => void;
}

interface StandardSlideFrameProps {
    SlideComponent: React.ComponentType<any>;
    isEditing: boolean;
    gifEnabled: boolean;
    gifUrl: string;
    gifPosition: GifPosition;
    onGifUrlChange: (gifUrl: string) => void;
    onGifPositionChange: (gifPosition: GifPosition) => void;
    extras: SlideExtras;
    onUpdateText: (id: string, patch: Partial<TextOverlay>) => void;
    onUpdateImage: (id: string, patch: Partial<ImageOverlay>) => void;
    onDeleteText: (id: string) => void;
    onDeleteImage: (id: string) => void;
    onNextSlide?: () => void;
    onPreviousSlide?: () => void;
    quarter?: string;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function StandardSlideFrame({
    SlideComponent,
    isEditing,
    gifEnabled,
    gifUrl,
    gifPosition,
    onGifUrlChange,
    onGifPositionChange,
    extras,
    onUpdateText,
    onUpdateImage,
    onDeleteText,
    onDeleteImage,
    onNextSlide,
    onPreviousSlide,
    quarter,
}: StandardSlideFrameProps) {
    const frameRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={frameRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <SlideComponent isEditing={isEditing} onNextSlide={onNextSlide} onPreviousSlide={onPreviousSlide} quarter={quarter} />
            <GifOverlay
                containerRef={frameRef}
                isEditing={isEditing}
                gifEnabled={gifEnabled}
                gifUrl={gifUrl}
                gifPosition={gifPosition}
                onGifUrlChange={onGifUrlChange}
                onGifPositionChange={onGifPositionChange}
            />
            <SlideExtrasOverlay
                containerRef={frameRef}
                isEditing={isEditing}
                extras={extras}
                onUpdateText={onUpdateText}
                onUpdateImage={onUpdateImage}
                onDeleteText={onDeleteText}
                onDeleteImage={onDeleteImage}
            />
        </div>
    );
}

const waitForAnimationFrames = async (count = 2) => {
    for (let index = 0; index < count; index += 1) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
};

const waitForImages = async (container: HTMLElement) => {
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(images.map(image => {
        if (image.complete) {
            return Promise.resolve();
        }

        return new Promise<void>(resolve => {
            const finish = () => {
                image.removeEventListener('load', finish);
                image.removeEventListener('error', finish);
                resolve();
            };

            image.addEventListener('load', finish);
            image.addEventListener('error', finish);
        });
    }));
};

const installFetchTracker = (): FetchTracker => {
    const originalFetch = window.fetch.bind(window) as typeof window.fetch;
    let pendingCount = 0;

    const trackedFetch: typeof window.fetch = async (...args) => {
        pendingCount += 1;

        try {
            return await originalFetch(...args);
        } finally {
            pendingCount = Math.max(0, pendingCount - 1);
        }
    };

    window.fetch = trackedFetch;

    return {
        getPendingCount: () => pendingCount,
        restore: () => {
            window.fetch = originalFetch;
        },
    };
};

const waitForNetworkIdle = async (fetchTracker: FetchTracker, idleMs = 600, timeoutMs = 30000) => {
    const start = Date.now();
    let idleStart: number | null = null;

    while (Date.now() - start < timeoutMs) {
        if (fetchTracker.getPendingCount() === 0) {
            idleStart ??= Date.now();
            if (Date.now() - idleStart >= idleMs) {
                return;
            }
        } else {
            idleStart = null;
        }

        await wait(100);
    }
};

const waitForDomQuiet = async (container: HTMLElement, quietMs = 1200, timeoutMs = 10000) => {
    await new Promise<void>(resolve => {
        let quietTimer: ReturnType<typeof setTimeout> | undefined;
        let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

        const finish = () => {
            observer.disconnect();
            if (quietTimer) clearTimeout(quietTimer);
            if (timeoutTimer) clearTimeout(timeoutTimer);
            resolve();
        };

        const armQuietTimer = () => {
            if (quietTimer) clearTimeout(quietTimer);
            quietTimer = setTimeout(finish, quietMs);
        };

        const observer = new MutationObserver(() => {
            armQuietTimer();
        });

        observer.observe(container, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
        });

        armQuietTimer();
        timeoutTimer = setTimeout(finish, timeoutMs);
    });
};

const waitForPlotlyCharts = async (container: HTMLElement, timeoutMs = 12000) => {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const charts = Array.from(container.querySelectorAll('.js-plotly-plot')) as Array<HTMLElement & {
            _fullData?: unknown[];
            _fullLayout?: unknown;
        }>;

        if (charts.length === 0) {
            return;
        }

        const ready = charts.every(chart => {
            const rect = chart.getBoundingClientRect();
            const fullData = chart._fullData;
            const plotSurface = chart.querySelector('.main-svg, .svg-container, .gl-container');

            return rect.width > 0
                && rect.height > 0
                && Array.isArray(fullData)
                && fullData.length > 0
                && !!plotSurface;
        });

        if (ready) {
            await waitForDomQuiet(container, 1200, 5000);
            return;
        }

        await wait(150);
    }
};

const waitForCanvasPaint = async (container: HTMLElement, timeoutMs = 8000) => {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const canvases = Array.from(container.querySelectorAll('canvas')) as HTMLCanvasElement[];

        if (canvases.length === 0) {
            return;
        }

        const ready = canvases.every(canvas => {
            const rect = canvas.getBoundingClientRect();
            return canvas.width > 0 && canvas.height > 0 && rect.width > 0 && rect.height > 0;
        });

        if (ready) {
            await wait(1200);
            await waitForAnimationFrames(4);
            return;
        }

        await wait(120);
    }
};

const waitForSlideReadiness = async (container: HTMLElement, fetchTracker: FetchTracker) => {
    const start = Date.now();

    while (Date.now() - start < 30000) {
        await waitForImages(container);
        await waitForNetworkIdle(fetchTracker);

        const text = container.innerText.toLowerCase();
        const isLoading = text.includes('loading');
        const hasSkeleton = container.querySelector('.animate-pulse, .animate-spin');

        if (!isLoading && !hasSkeleton && fetchTracker.getPendingCount() === 0) {
            break;
        }

        await wait(200);
    }

    window.dispatchEvent(new Event('resize'));
    await waitForAnimationFrames(3);
    await waitForCanvasPaint(container);
    await waitForPlotlyCharts(container);
    await waitForDomQuiet(container, 1200, 6000);
    await waitForImages(container);
    await wait(350);
};

// --- Components ---

const LazySlideWrapper = ({ children, slideNum }: { children: React.ReactNode, slideNum: number | string }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    if (isLoaded) {
        return <>{children}</>;
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

// ... (Rest of components: StatusCard is fine to keep inside or reusing)
interface StatusCardProps {
    title: string;
    status?: 'pending' | 'completed';
    filled?: number;
    total?: number;
    onView?: () => void;
    onViewWhale?: () => void;
    missingNames?: string[];
    whaleAccounts?: string[];
}

const StatusCard = ({ title, filled = 0, total = 0, onView, onViewWhale, missingNames = [], whaleAccounts = [] }: StatusCardProps) => {
    const missing = Math.max(0, total - filled);
    const canView = total > 0 && !!onView;

    return (
        <div style={{
            backgroundColor: '#d1d5db',
            borderRadius: '16px',
            padding: '1rem',
            minHeight: '100px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            gap: '0.6rem'
        }}>
            <div>
                <span style={{
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    color: '#1f2937'
                }}>
                    {title}
                </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f766e' }}>{filled}/{total} filled</div>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700 }}>{missing} missing</div>
            </div>
            {missingNames.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: '#7c2d12', fontWeight: 600, lineHeight: 1.35 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.15rem' }}>
                        Missing items
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                        {missingNames.map(n => (
                            <li key={n} style={{ marginBottom: '0.1rem' }}>{n}</li>
                        ))}
                    </ul>
                </div>
            )}
            {title !== 'Overall' && title !== 'Financial Team' && whaleAccounts.length < 2 && (
                <div style={{ fontSize: '0.75rem', color: '#7c2d12', fontWeight: 600, lineHeight: 1.35, marginTop: '0.2rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.15rem' }}>
                        Whale accounts missing
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                        {whaleAccounts.length === 1 ? (
                            <li style={{ marginBottom: '0.1rem' }}>1 more account to add (Added: {whaleAccounts[0]})</li>
                        ) : (
                            <li style={{ marginBottom: '0.1rem' }}>2 accounts to add</li>
                        )}
                    </ul>
                </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                {canView && (
                    <button
                        onClick={onView}
                        style={{
                            backgroundColor: '#5D9CEC',
                            color: 'white',
                            border: 'none',
                            padding: '0.35rem 0.8rem',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(93,156,236,0.35)'
                        }}
                        title={`View pending input slides for ${title}`}
                    >
                        View
                    </button>
                )}
                {onViewWhale && (
                    <button
                        onClick={onViewWhale}
                        style={{
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            padding: '0.35rem 0.8rem',
                            borderRadius: '9999px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(16,185,129,0.35)'
                        }}
                        title={`View Whale accounts for ${title}`}
                    >
                        Whales
                    </button>
                )}
            </div>
        </div>
    );
};

export default function WeeklyTracker() {
    const navigate = useNavigate();
    const [currentWeek, setCurrentWeek] = useState(1);
    const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const slideshowRef = useRef<HTMLDivElement>(null);

    // Track which slide is being edited
    const [editingSlide, setEditingSlide] = useState<number | string | null>(null);
    const [editedTitle, setEditedTitle] = useState(""); // For custom slide title editing
    // Track hidden slides
    const [hiddenSlides, setHiddenSlides] = useState<Set<string>>(new Set());

    // Confetti slides
    const [confettiSlides, setConfettiSlides] = useState<Set<string>>(new Set());
    const [standardSlideGifs, setStandardSlideGifs] = useState<Record<string, StandardSlideGifData>>({});

    // Slide extras (text + image overlays) keyed by slideId string
    const [slideExtras, setSlideExtras] = useState<Record<string, SlideExtras>>({});

    // Custom slides state
    const [customSlides, setCustomSlides] = useState<CustomSlideData[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
    const [exportSlide, setExportSlide] = useState<SlideItem | null>(null);
    const [exportingImageSlideId, setExportingImageSlideId] = useState<SlideId | null>(null);
    const exportContainerRef = useRef<HTMLDivElement>(null);

    // Selected fiscal quarter (Q1-Q4) per Services snapshot slide preview.
    const [servicesQuarterBySlide, setServicesQuarterBySlide] = useState<Record<string, string>>({});
    const getServicesQuarter = (slideId: SlideId) => servicesQuarterBySlide[String(slideId)] ?? 'Q2';
    const setServicesQuarter = (slideId: SlideId, quarter: string) =>
        setServicesQuarterBySlide(prev => ({ ...prev, [String(slideId)]: quarter }));

    // Base slides configuration
    const BASE_SLIDES = [
        2, 2.5,
        3, '3_services', '3_services_q1', 4, '4_services', 5, '5_services',
        6, '6.1', 6.2, '6.2_services', 6.3, 6.4,
        13, '13_services', '13_services_q1', 14, '14_services', 15, '15_services',
        15.1, '15.1.1', 15.2, '15.2.1', '15.5',
        '15.2.2', '15.2.2_services', '15.2.3', '15.2.4', '15.2.5',
        7, '7_services', '7_services_q1', 8, '8_services', 9, '9_services',
        9.1, '9.1.1', 9.2, '9.2.1', '9.5',
        '9.2.2', '9.2.2_services', '9.2.3', '9.2.4', '9.2.5',
        10, '10_services', '10_services_q1', 11, '11_services', 12, '12_services',
        12.1, '12.1.1', 12.2, '12.2.1', '12.5',
        '12.2.2', '12.2.2_services', '12.2.3', '12.2.4', '12.2.5',
        16, '16_services', '16_services_q1', 17, '17_services', 18, '18_services',
        18.1, '18.1.1', 18.2, '18.2.1', '18.5',
        '18.2.2', '18.2.2_services', '18.2.3', '18.2.4', '18.2.5',
        19, '19_services', '19_services_q1', 20, '20_services',
        21, '21_services',
        21.1, '21.1.1', 21.2, '21.2.1', '21.5',
        '21.2.2', '21.2.2_services', '21.2.3', '21.2.4', '21.2.5',
        22, '22_services', '22_services_q1', 23, '23_services',
        24, '24_services',
        24.1, '24.1.1', 24.2, '24.2.1', '24.5',
        '24.2.2', '24.2.2_services', '24.2.3', '24.2.4', '24.2.5',
        25, '25_services', '25_services_q1', 26, '26_services',
        27, '27_services',
        27.1, '27.1.1', 27.2, '27.2.1', '27.5',
        '27.2.2', '27.2.2_services', '27.2.3', '27.2.4', '27.2.5',
        28
    ];

    // Helper to determine region
    const getSlideRegion = (slideId: string | number) => {
        const idStr = String(slideId);
        const mainId = parseInt(idStr.split('.')[0]); // Get integer part

        if (mainId <= 6) return 'Overall';
        if (mainId <= 9) return 'US West';
        if (mainId <= 12) return 'Europe + Israel';
        if (mainId <= 15) return 'US East';
        if (mainId <= 18) return 'ASEAN';
        if (mainId <= 21) return 'Japan';
        if (mainId <= 24) return 'KANZ';
        if (mainId <= 27) return 'Management';
        if (mainId === 28) return 'Power BI';
        return 'Other';
    };

    // Helper to get descriptive slide titles
    const getSlideTitle = (slideId: string | number): string => {
        const idStr = String(slideId);

        // Services mirrors: defer to the parent slide's title and prefix it.
        if (idStr.endsWith('_services_q1')) {
            const parentId = idStr.slice(0, -'_services_q1'.length);
            return `Services ${getServicesQuarter(slideId)} Snapshot — ${getSlideTitle(parentId)}`;
        }

        if (idStr.endsWith('_services')) {
            const parentId = idStr.slice(0, -'_services'.length);
            return `Services — ${getSlideTitle(parentId)}`;
        }

        const titles: Record<string, string> = {
            '2': 'FY2026 First Summary',
            '2.5': 'Pie Chart',
            '3': 'Cumulative Performance vs Targets',
            '4': '8-Week Historical Trend',
            '5': 'Actual vs Weighted Pipeline',
            '6': 'Performance Progress',
            '6.2': 'Order Backlog',
            '6.2.1': 'Whale account',
            '6.3': 'Gross Margin',
            '6.4': 'Gross Margin Summary - Region',
            '7': 'Cumulative Performance vs Targets',
            '8': '8-Week Historical Trend',
            '9': 'Actual vs Weighted Pipeline',
            '9.2.2': 'Order Backlog',
            '9.2.3': 'Gross Margin - Manufacturing',
            '9.2.4': 'Gross Margin - Services',
            '10': 'Cumulative Performance vs Targets',
            '11': '8-Week Historical Trend',
            '12': 'Actual vs Weighted Pipeline',
            '12.2.2': 'Order Backlog',
            '12.2.3': 'Gross Margin - Manufacturing',
            '12.2.4': 'Gross Margin - Services',
            '13': 'Cumulative Performance vs Targets',
            '14': '8-Week Historical Trend',
            '15': 'Actual vs Weighted Pipeline',
            '15.2.2': 'Order Backlog',
            '15.2.3': 'Gross Margin - Manufacturing',
            '15.2.4': 'Gross Margin - Services',
            '16': 'Cumulative Performance vs Targets',
            '17': '8-Week Historical Trend',
            '18': 'Actual vs Weighted Pipeline',
            '18.2.2': 'Order Backlog',
            '18.2.3': 'Gross Margin - Manufacturing',
            '18.2.4': 'Gross Margin - Services',
            '19': 'Cumulative Performance vs Targets',
            '20': '8-Week Historical Trend',
            '21': 'Actual vs Weighted Pipeline',
            '21.2.2': 'Order Backlog',
            '21.2.3': 'Gross Margin - Manufacturing',
            '21.2.4': 'Gross Margin - Services',
            '22': 'Cumulative Performance vs Targets',
            '23': '8-Week Historical Trend',
            '24': 'Actual vs Weighted Pipeline',
            '24.2.2': 'Order Backlog',
            '24.2.3': 'Gross Margin - Manufacturing',
            '24.2.4': 'Gross Margin - Services',
            '25': 'Cumulative Performance vs Targets',
            '26': '8-Week Historical Trend',
            '27': 'Actual vs Weighted Pipeline',
            '27.2.2': 'Order Backlog',
            '27.2.3': 'Gross Margin - Manufacturing',
            '27.2.4': 'Gross Margin - Services',
            '6.1': 'Payment Terms - Chart ARU (Power BI)',
            '9.5': 'Payment Terms - Chart ARU (Power BI)',
            '12.5': 'Payment Terms - Chart ARU (Power BI)',
            '15.5': 'Payment Terms - Chart ARU (Power BI)',
            '18.5': 'Payment Terms - Chart ARU (Power BI)',
            '21.5': 'Payment Terms - Chart ARU (Power BI)',
            '24.5': 'Payment Terms - Chart ARU (Power BI)',
            '27.5': 'Payment Terms - Chart ARU (Power BI)',
            '28': 'Payment Terms - Chart ARU (Power BI)',
        };

        // For nested pipeline slides like 9.1, 9.2, etc. (Activity lists)
        // Explicit dict entries take priority; suffix checks are ordered
        // most-specific first so e.g. "15.2.1" doesn't match ".1".
        if (titles[idStr]) return titles[idStr];
        if (idStr.includes('.')) {
            if (idStr.endsWith('.2.5')) return 'Whale accounts';
            if (idStr.endsWith('.1.1')) return 'Account Management - Action Points';
            if (idStr.endsWith('.2.1')) return 'New Business - Action Points';
            if (idStr.endsWith('.1')) return 'Account Management Summary';
            if (idStr.endsWith('.2')) return 'New Business Summary';
        }

        return 'Activity & Details';
    };

    // Merge base slides with custom slides
    const displaySlides = useMemo<SlideItem[]>(() => {
        const result: SlideItem[] = [];
        BASE_SLIDES.forEach(sId => {
            // Add standard slide
            result.push({ id: sId, isCustom: false });

            // Add any custom slides attached to this parent
            customSlides
                .filter(c => String(c.parentId) === String(sId))
                .forEach(c => {
                    result.push({ id: c.id, isCustom: true, data: c });
                });
        });
        return result;
    }, [customSlides]);

    const getDisplaySlideTitle = (slideItem: SlideItem) => {
        if (slideItem.isCustom) {
            return slideItem.data?.title || 'Custom Image';
        }

        return `Slide ${slideItem.id} - ${getSlideRegion(slideItem.id)} - ${getSlideTitle(slideItem.id)}`;
    };

    const getStandardSlideGif = (slideId: SlideId): StandardSlideGifData => {
        return standardSlideGifs[String(slideId)] || {
            enabled: false,
            url: DEFAULT_GIF_URL,
            position: DEFAULT_GIF_POSITION,
        };
    };

    const renderSlideContent = (slideItem: SlideItem, isEditing: boolean) => {
        if (slideItem.isCustom) {
            return (
                <ImageUploadSlide
                    title={slideItem.data?.title || 'Custom Image'}
                    slideId={String(slideItem.id)}
                    isEditing={isEditing}
                    gifEnabled={slideItem.data?.gifEnabled ?? false}
                    gifUrl={slideItem.data?.gifUrl || DEFAULT_CUSTOM_GIF_URL}
                    gifPosition={slideItem.data?.gifPosition || DEFAULT_CUSTOM_GIF_POSITION}
                    onGifUrlChange={(gifUrl) => updateCustomSlideGifUrl(String(slideItem.id), gifUrl)}
                    onGifPositionChange={(gifPosition) => updateCustomSlideGifPosition(String(slideItem.id), gifPosition)}
                    extras={getSlideExtras(slideItem.id)}
                    onUpdateText={(id, patch) => updateTextOverlay(slideItem.id, id, patch)}
                    onUpdateImage={(id, patch) => updateImageOverlay(slideItem.id, id, patch)}
                    onDeleteText={(id) => deleteTextOverlay(slideItem.id, id)}
                    onDeleteImage={(id) => deleteImageOverlay(slideItem.id, id)}
                />
            );
        }

        const SlideComponent = SLIDE_REGISTRY[slideItem.id];
        if (!SlideComponent) {
            return (
                <div style={{ height: '100%', width: '100%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#991b1b', fontWeight: '600' }}>
                    Slide not found
                </div>
            );
        }

        const gifState = getStandardSlideGif(slideItem.id);
        const navigationProps = ['6.1', '9.5', '12.5', '15.5', '18.5', '21.5', '24.5', '27.5', '28'].includes(String(slideItem.id))
            ? {
                onNextSlide: handleNextSlide,
                onPreviousSlide: handlePreviousSlide,
            }
            : {};

        return (
            <StandardSlideFrame
                SlideComponent={SlideComponent}
                isEditing={isEditing}
                gifEnabled={gifState.enabled}
                gifUrl={gifState.url}
                gifPosition={gifState.position}
                onGifUrlChange={(gifUrl) => updateStandardSlideGifUrl(slideItem.id, gifUrl)}
                onGifPositionChange={(gifPosition) => updateStandardSlideGifPosition(slideItem.id, gifPosition)}
                extras={getSlideExtras(slideItem.id)}
                onUpdateText={(id, patch) => updateTextOverlay(slideItem.id, id, patch)}
                onUpdateImage={(id, patch) => updateImageOverlay(slideItem.id, id, patch)}
                onDeleteText={(id) => deleteTextOverlay(slideItem.id, id)}
                onDeleteImage={(id) => deleteImageOverlay(slideItem.id, id)}
                quarter={getServicesQuarter(slideItem.id)}
                {...navigationProps}
            />
        );
    };

    // Actions for custom slides
    const addCustomSlide = async (parentId: string | number) => {
        try {
            const res = await fetch('/api/admin/custom-slides', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parentId,
                    type: 'image',
                    gifEnabled: false,
                    gifUrl: DEFAULT_CUSTOM_GIF_URL,
                    gifPosition: DEFAULT_CUSTOM_GIF_POSITION
                })
            });
            if (res.ok) {
                const data = await res.json();
                setCustomSlides(prev => [...prev, data.slide]);
                showToast("Custom slide added");
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to add slide");
        }
    };

    const deleteCustomSlide = async (slideId: string) => {
        if (!confirm("Are you sure you want to delete this custom slide?")) return;
        try {
            const res = await fetch(`/api/admin/custom-slides/${slideId}`, { method: 'DELETE' });
            if (res.ok) {
                setCustomSlides(prev => prev.filter(s => s.id !== slideId));
                showToast("Custom slide deleted");
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to delete slide");
        }
    };

    const updateCustomSlideTitle = async (slideId: string, newTitle: string) => {
        try {
            await fetch(`/api/admin/custom-slides/${slideId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle })
            });
            // Update local state
            setCustomSlides(prev => prev.map(s => s.id === slideId ? { ...s, title: newTitle } : s));
            showToast("Title updated");
        } catch (err) {
            console.error(err);
            showToast("Failed to update title");
        }
    };

    const toggleCustomSlideGif = async (slideId: string) => {
        const currentSlide = customSlides.find(s => s.id === slideId);
        const nextEnabled = !(currentSlide?.gifEnabled ?? false);

        setCustomSlides(prev => prev.map(slide => (
            slide.id === slideId
                ? { ...slide, gifEnabled: nextEnabled, gifUrl: slide.gifUrl || DEFAULT_CUSTOM_GIF_URL, gifPosition: slide.gifPosition || DEFAULT_CUSTOM_GIF_POSITION }
                : slide
        )));

        try {
            await fetch(`/api/admin/custom-slides/${slideId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gifEnabled: nextEnabled,
                    gifUrl: currentSlide?.gifUrl || DEFAULT_CUSTOM_GIF_URL,
                    gifPosition: currentSlide?.gifPosition || DEFAULT_CUSTOM_GIF_POSITION
                })
            });
            showToast(nextEnabled ? 'GIF enabled for custom slide' : 'GIF disabled for custom slide');
        } catch (err) {
            console.error(err);
            showToast('Failed to update GIF toggle');
        }
    };

    const updateCustomSlideGifUrl = async (slideId: string, gifUrl: string) => {
        const normalizedUrl = gifUrl.trim() || DEFAULT_CUSTOM_GIF_URL;

        setCustomSlides(prev => prev.map(slide => (
            slide.id === slideId ? { ...slide, gifUrl: normalizedUrl } : slide
        )));

        try {
            await fetch(`/api/admin/custom-slides/${slideId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gifUrl: normalizedUrl })
            });
        } catch (err) {
            console.error(err);
            showToast('Failed to save GIF URL');
        }
    };

    const updateCustomSlideGifPosition = async (slideId: string, gifPosition: GifPosition) => {
        setCustomSlides(prev => prev.map(slide => (
            slide.id === slideId ? { ...slide, gifPosition } : slide
        )));

        try {
            await fetch(`/api/admin/custom-slides/${slideId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gifPosition })
            });
        } catch (err) {
            console.error(err);
            showToast('Failed to save GIF position');
        }
    };

    const toggleStandardSlideGif = async (slideId: SlideId) => {
        const slideKey = String(slideId);
        const currentState = getStandardSlideGif(slideId);
        const nextState: StandardSlideGifData = {
            ...currentState,
            enabled: !currentState.enabled,
        };

        setStandardSlideGifs(prev => ({
            ...prev,
            [slideKey]: nextState,
        }));

        try {
            await fetch(`/api/admin/slide-gifs/${encodeURIComponent(slideKey)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: nextState.enabled,
                    url: nextState.url,
                    position: nextState.position,
                })
            });
            showToast(nextState.enabled ? `GIF enabled for Slide ${slideId}` : `GIF disabled for Slide ${slideId}`);
        } catch (err) {
            console.error(err);
            showToast('Failed to update GIF toggle');
        }
    };

    const updateStandardSlideGifUrl = async (slideId: SlideId, gifUrl: string) => {
        const slideKey = String(slideId);
        const currentState = getStandardSlideGif(slideId);
        const normalizedUrl = gifUrl.trim() || DEFAULT_GIF_URL;

        setStandardSlideGifs(prev => ({
            ...prev,
            [slideKey]: {
                ...currentState,
                url: normalizedUrl,
            }
        }));

        try {
            await fetch(`/api/admin/slide-gifs/${encodeURIComponent(slideKey)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: normalizedUrl })
            });
        } catch (err) {
            console.error(err);
            showToast('Failed to save GIF URL');
        }
    };

    const updateStandardSlideGifPosition = async (slideId: SlideId, gifPosition: GifPosition) => {
        const slideKey = String(slideId);
        const currentState = getStandardSlideGif(slideId);

        setStandardSlideGifs(prev => ({
            ...prev,
            [slideKey]: {
                ...currentState,
                position: gifPosition,
            }
        }));

        try {
            await fetch(`/api/admin/slide-gifs/${encodeURIComponent(slideKey)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position: gifPosition })
            });
        } catch (err) {
            console.error(err);
            showToast('Failed to save GIF position');
        }
    };

    // --- Slide Extras (text + image overlays) ---
    const getSlideExtras = useCallback((slideId: SlideId): SlideExtras => {
        return slideExtras[String(slideId)] || EMPTY_SLIDE_EXTRAS;
    }, [slideExtras]);

    const persistSlideExtras = async (slideKey: string, extras: SlideExtras) => {
        try {
            await fetch(`/api/admin/slide-extras/${encodeURIComponent(slideKey)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(extras),
            });
        } catch (err) {
            console.error('Failed to save slide extras', err);
            showToast('Failed to save overlay change');
        }
    };

    const genOverlayId = () => `ov_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const addTextOverlay = (slideId: SlideId) => {
        const slideKey = String(slideId);
        const current = slideExtras[slideKey] || EMPTY_SLIDE_EXTRAS;
        const newOverlay: TextOverlay = {
            ...DEFAULT_TEXT_OVERLAY,
            id: genOverlayId(),
        };
        const next: SlideExtras = {
            textOverlays: [...current.textOverlays, newOverlay],
            imageOverlays: [...current.imageOverlays],
        };
        setSlideExtras(prev => ({ ...prev, [slideKey]: next }));
        persistSlideExtras(slideKey, next);
        showToast('Text overlay added');
    };

    const addImageOverlay = (slideId: SlideId, dataUrl: string) => {
        const slideKey = String(slideId);
        const current = slideExtras[slideKey] || EMPTY_SLIDE_EXTRAS;
        const newOverlay: ImageOverlay = {
            ...DEFAULT_IMAGE_OVERLAY,
            id: genOverlayId(),
            dataUrl,
        };
        const next: SlideExtras = {
            textOverlays: [...current.textOverlays],
            imageOverlays: [...current.imageOverlays, newOverlay],
        };
        setSlideExtras(prev => ({ ...prev, [slideKey]: next }));
        persistSlideExtras(slideKey, next);
        showToast('Image overlay added');
    };

    const updateTextOverlay = (slideId: SlideId, id: string, patch: Partial<TextOverlay>) => {
        const slideKey = String(slideId);
        const current = slideExtras[slideKey] || EMPTY_SLIDE_EXTRAS;
        const next: SlideExtras = {
            textOverlays: current.textOverlays.map(t => t.id === id ? { ...t, ...patch } : t),
            imageOverlays: current.imageOverlays,
        };
        setSlideExtras(prev => ({ ...prev, [slideKey]: next }));
        persistSlideExtras(slideKey, next);
    };

    const updateImageOverlay = (slideId: SlideId, id: string, patch: Partial<ImageOverlay>) => {
        const slideKey = String(slideId);
        const current = slideExtras[slideKey] || EMPTY_SLIDE_EXTRAS;
        const next: SlideExtras = {
            textOverlays: current.textOverlays,
            imageOverlays: current.imageOverlays.map(i => i.id === id ? { ...i, ...patch } : i),
        };
        setSlideExtras(prev => ({ ...prev, [slideKey]: next }));
        persistSlideExtras(slideKey, next);
    };

    const deleteTextOverlay = (slideId: SlideId, id: string) => {
        const slideKey = String(slideId);
        const current = slideExtras[slideKey] || EMPTY_SLIDE_EXTRAS;
        const next: SlideExtras = {
            textOverlays: current.textOverlays.filter(t => t.id !== id),
            imageOverlays: current.imageOverlays,
        };
        setSlideExtras(prev => ({ ...prev, [slideKey]: next }));
        persistSlideExtras(slideKey, next);
    };

    const deleteImageOverlay = (slideId: SlideId, id: string) => {
        const slideKey = String(slideId);
        const current = slideExtras[slideKey] || EMPTY_SLIDE_EXTRAS;
        const next: SlideExtras = {
            textOverlays: current.textOverlays,
            imageOverlays: current.imageOverlays.filter(i => i.id !== id),
        };
        setSlideExtras(prev => ({ ...prev, [slideKey]: next }));
        persistSlideExtras(slideKey, next);
    };

    // Hidden file input ref for image overlay upload
    const overlayImageUploadSlideRef = useRef<SlideId | null>(null);
    const overlayImageInputRef = useRef<HTMLInputElement>(null);

    const handleAddImageOverlayClick = (slideId: SlideId) => {
        overlayImageUploadSlideRef.current = slideId;
        overlayImageInputRef.current?.click();
    };

    const handleOverlayImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const slideId = overlayImageUploadSlideRef.current;
        e.target.value = '';
        if (!file || slideId == null) return;

        // Size limit ~2MB to avoid bloating the DB document
        if (file.size > 2 * 1024 * 1024) {
            showToast('Image too large (max 2MB for overlays)');
            return;
        }

        try {
            const dataUrl: string = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
            if (!dataUrl.startsWith('data:image/')) {
                showToast('Selected file is not an image');
                return;
            }
            addImageOverlay(slideId, dataUrl);
        } catch (err) {
            console.error(err);
            showToast('Failed to read image');
        }
    };

    const handleEditToggle = (slideId: number | string, currentTitle?: string) => {
        if (editingSlide === slideId) {
            // Saving/Closing
            // Simple heuristic or pass flag
            // Actually, we can check displaySlides or just rely on editedTitle state usage
            // But we need to identify if it WAS a custom slide to save title.
            // We can check if editedTitle is not empty/different? 
            // Better: Check if found in customSlides.
            const customSlide = customSlides.find(s => s.id === slideId);
            if (customSlide && editedTitle !== customSlide.title) {
                updateCustomSlideTitle(String(slideId), editedTitle);
            }
            setEditingSlide(null);
            setEditedTitle("");
        } else {
            // Opening
            setEditingSlide(slideId);
            if (currentTitle) setEditedTitle(currentTitle);
        }
    };

    useEffect(() => {
        // Fetch custom slides on mount
        fetch('/api/admin/custom-slides')
            .then(res => res.json())
            .then(data => {
                if (data.slides) {
                    setCustomSlides(data.slides.map((slide: CustomSlideData) => ({
                        ...slide,
                        gifEnabled: slide.gifEnabled ?? false,
                        gifUrl: slide.gifUrl || DEFAULT_CUSTOM_GIF_URL,
                        gifPosition: slide.gifPosition || DEFAULT_CUSTOM_GIF_POSITION
                    })));
                }
            })
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        fetch('/api/week/current')
            .then(res => res.json())
            .then(data => setCurrentWeek(data.week))
            .catch(() => setCurrentWeek(1));

        // Fetch hidden slides
        fetch('/api/admin/hidden-slides')
            .then(res => res.json())
            .then(data => {
                if (data.hidden_slides) {
                    setHiddenSlides(new Set(data.hidden_slides.map(String)));
                }
            })
            .catch(err => console.error("Failed to fetch hidden slides", err));

        // Fetch confetti slides
        fetch('/api/admin/confetti-slides')
            .then(res => res.json())
            .then(data => {
                if (data.confetti_slides) {
                    setConfettiSlides(new Set(data.confetti_slides.map(String)));
                }
            })
            .catch(err => console.error("Failed to fetch confetti slides", err));

        fetch('/api/admin/slide-gifs')
            .then(res => res.json())
            .then(data => {
                if (data.slides) {
                    const normalizedEntries = Object.entries(data.slides).map(([slideId, settings]) => {
                        const typedSettings = settings as Partial<StandardSlideGifData> & { position?: Partial<GifPosition> };
                        return [slideId, {
                            enabled: Boolean(typedSettings.enabled),
                            url: typedSettings.url || DEFAULT_GIF_URL,
                            position: typedSettings.position
                                ? {
                                    x: Number(typedSettings.position.x ?? DEFAULT_GIF_POSITION.x),
                                    y: Number(typedSettings.position.y ?? DEFAULT_GIF_POSITION.y),
                                    width: Number(typedSettings.position.width ?? DEFAULT_GIF_POSITION.width),
                                }
                                : DEFAULT_GIF_POSITION,
                        } satisfies StandardSlideGifData];
                    });

                    setStandardSlideGifs(Object.fromEntries(normalizedEntries));
                }
            })
            .catch(err => console.error('Failed to fetch slide GIFs', err));

        fetch('/api/admin/slide-extras')
            .then(res => res.json())
            .then(data => {
                if (data.slides) {
                    const normalized: Record<string, SlideExtras> = {};
                    Object.entries(data.slides).forEach(([slideId, value]) => {
                        const v = value as Partial<SlideExtras>;
                        normalized[slideId] = {
                            textOverlays: Array.isArray(v.textOverlays) ? v.textOverlays as TextOverlay[] : [],
                            imageOverlays: Array.isArray(v.imageOverlays) ? v.imageOverlays as ImageOverlay[] : [],
                        };
                    });
                    setSlideExtras(normalized);
                }
            })
            .catch(err => console.error('Failed to fetch slide extras', err));
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                setIsSlideshowOpen(false);
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleNextSlide = useCallback(() => {
        setActiveSlideIndex(currentIndex => {
            let nextIndex = currentIndex + 1;
            while (nextIndex < displaySlides.length && hiddenSlides.has(String(displaySlides[nextIndex].id))) {
                nextIndex++;
            }

            if (nextIndex < displaySlides.length) {
                return nextIndex;
            }

            showToast('No other visible slide after this');
            return currentIndex;
        });
    }, [displaySlides, hiddenSlides]);

    const handlePreviousSlide = useCallback(() => {
        setActiveSlideIndex(currentIndex => {
            let prevIndex = currentIndex - 1;
            while (prevIndex >= 0 && hiddenSlides.has(String(displaySlides[prevIndex].id))) {
                prevIndex--;
            }

            if (prevIndex >= 0) {
                return prevIndex;
            }

            showToast('No other visible slide before this');
            return currentIndex;
        });
    }, [displaySlides, hiddenSlides]);

    useEffect(() => {
        if (!isSlideshowOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') {
                handleNextSlide();
            } else if (e.key === 'ArrowLeft') {
                handlePreviousSlide();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSlideshowOpen, handleNextSlide, handlePreviousSlide]);

    const handleStartSlideshow = (fromIndex?: number) => {
        setIsSlideshowOpen(true);
        let startIndex: number;
        if (typeof fromIndex === 'number' && fromIndex >= 0 && fromIndex < displaySlides.length) {
            // Start from requested index; if hidden, advance to next visible slide
            startIndex = fromIndex;
            while (startIndex < displaySlides.length && hiddenSlides.has(String(displaySlides[startIndex].id))) {
                startIndex++;
            }
            if (startIndex >= displaySlides.length) startIndex = fromIndex;
        } else {
            // Find first visible slide
            startIndex = 0;
            while (startIndex < displaySlides.length && hiddenSlides.has(String(displaySlides[startIndex].id))) {
                startIndex++;
            }
            if (startIndex >= displaySlides.length) startIndex = 0;
        }
        setActiveSlideIndex(startIndex);

        setTimeout(() => {
            if (slideshowRef.current) {
                slideshowRef.current.requestFullscreen().catch(err => {
                    console.error("Error attempting to enable fullscreen:", err);
                });
            }
        }, 100);
    };

    const captureExportSlidePng = async (fetchTracker: FetchTracker) => {
        await waitForAnimationFrames(3);
        await wait(150);

        const exportNode = exportContainerRef.current;
        if (!exportNode) {
            throw new Error('Export canvas is not ready');
        }

        await waitForSlideReadiness(exportNode, fetchTracker);

        const canvas = await html2canvas(exportNode, {
            backgroundColor: '#ffffff',
            scale: EXPORT_CAPTURE_SCALE,
            useCORS: true,
            logging: false,
            width: EXPORT_SLIDE_WIDTH,
            height: EXPORT_SLIDE_HEIGHT,
            windowWidth: EXPORT_SLIDE_WIDTH,
            windowHeight: EXPORT_SLIDE_HEIGHT,
        });

        return canvas.toDataURL('image/png', 1.0);
    };

    const handleExportSlideImage = async (slideItem: SlideItem) => {
        if (isExporting || exportingImageSlideId !== null) {
            return;
        }

        const fetchTracker = installFetchTracker();
        const slideId = slideItem.id;
        setExportingImageSlideId(slideId);
        setExportSlide(slideItem);

        try {
            const imageData = await captureExportSlidePng(fetchTracker);
            const safeDate = new Date().toISOString().slice(0, 10);
            const safeSlide = sanitizeFileNamePart(String(slideId));
            const safeTitle = sanitizeFileNamePart(getDisplaySlideTitle(slideItem));
            const link = document.createElement('a');
            link.href = imageData;
            link.download = `weekly-tracker-slide-${safeSlide}-${safeTitle}-${safeDate}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Slide image exported');
        } catch (error) {
            console.error('Failed to export slide image', error);
            const message = error instanceof Error ? error.message : 'Unknown export error';
            showToast(`Image export failed: ${message}`);
        } finally {
            fetchTracker.restore();
            setExportingImageSlideId(null);
            setExportSlide(null);
        }
    };

    const handleExportPdf = async () => {
        if (isExporting || exportingImageSlideId !== null) {
            return;
        }

        if (displaySlides.length === 0) {
            showToast('No slides available to export');
            return;
        }

        const exportSlides = displaySlides.filter(s => !hiddenSlides.has(String(s.id)));
        if (exportSlides.length === 0) {
            showToast('All slides are hidden — nothing to export');
            return;
        }

        const fetchTracker = installFetchTracker();
        setIsExporting(true);

        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [EXPORT_SLIDE_WIDTH, EXPORT_SLIDE_HEIGHT],
            compress: true,
        });

        try {
            for (let index = 0; index < exportSlides.length; index += 1) {
                const slideItem = exportSlides[index];
                const title = getDisplaySlideTitle(slideItem);
                setExportProgress({ current: index + 1, total: exportSlides.length, title });
                setExportSlide(slideItem);
                const imageData = await captureExportSlidePng(fetchTracker);
                if (index > 0) {
                    pdf.addPage([EXPORT_SLIDE_WIDTH, EXPORT_SLIDE_HEIGHT], 'landscape');
                }
                pdf.addImage(imageData, 'PNG', 0, 0, EXPORT_SLIDE_WIDTH, EXPORT_SLIDE_HEIGHT, undefined, 'FAST');
            }

            const safeDate = new Date().toISOString().slice(0, 10);
            pdf.save(`weekly-tracker-week-${currentWeek}-${safeDate}.pdf`);
            showToast('Weekly Tracker PDF exported');
        } catch (error) {
            console.error('Failed to export Weekly Tracker PDF', error);
            const message = error instanceof Error ? error.message : 'Unknown export error';
            showToast(`Export failed: ${message}`);
        } finally {
            fetchTracker.restore();
            setExportSlide(null);
            setExportProgress(null);
            setIsExporting(false);
        }
    };

    const toggleVisibility = async (slideNum: number | string) => {
        const sNumStr = String(slideNum);
        const newSet = new Set(hiddenSlides);
        let action = 'hide';

        if (newSet.has(sNumStr)) {
            newSet.delete(sNumStr);
            action = 'show';
        } else {
            newSet.add(sNumStr);
        }
        setHiddenSlides(newSet);

        try {
            await fetch('/api/admin/hidden-slides/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slide_id: slideNum })
            });
            showToast(action === 'hide' ? `Slide ${slideNum} hidden` : `Slide ${slideNum} visible`);
        } catch (err) {
            console.error(err);
            // Revert on error? 
            showToast("Failed to update visibility");
        }
    };

    const toggleConfetti = async (slideNum: number | string) => {
        const sNumStr = String(slideNum);
        const newSet = new Set(confettiSlides);
        let action = 'enable';

        if (newSet.has(sNumStr)) {
            newSet.delete(sNumStr);
            action = 'disable';
        } else {
            newSet.add(sNumStr);
        }
        setConfettiSlides(newSet);

        try {
            await fetch('/api/admin/confetti-slides/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slide_id: slideNum })
            });
            showToast(action === 'enable' ? `Confetti enabled for Slide ${slideNum}` : `Confetti disabled for Slide ${slideNum}`);
        } catch (err) {
            console.error(err);
            showToast("Failed to update confetti");
        }
    };



    // Region -> slideId mapping for pending inputs
    const REGION_SLIDES: Record<string, string[]> = {
        'Overall': [],
        'USA West': ['us_west_acc_mgmt', 'us_west_acc_mgmt_actions', 'us_west_new_biz', 'us_west_new_biz_actions'],
        'Europe': ['europe_acc_mgmt', 'europe_acc_mgmt_actions', 'europe_new_biz', 'europe_new_biz_actions'],
        'USA East': ['us_east_acc_mgmt', 'us_east_acc_mgmt_actions', 'us_east_new_biz', 'us_east_new_biz_actions'],
        'Asean': ['asean_acc_mgmt', 'asean_acc_mgmt_actions', 'asean_new_biz', 'asean_new_biz_actions'],
        'Japan': ['japan_acc_mgmt', 'japan_acc_mgmt_actions', 'japan_new_biz', 'japan_new_biz_actions'],
        'Korea': ['kanz_acc_mgmt', 'kanz_acc_mgmt_actions', 'kanz_new_biz', 'kanz_new_biz_actions'],
        'Legacy': ['mgmt_acc_mgmt', 'mgmt_acc_mgmt_actions', 'mgmt_new_biz', 'mgmt_new_biz_actions'],
        'Financial Team': []
    };

    // Region -> actual slide preview IDs to highlight when user clicks "View"
    const REGION_SLIDE_IDS: Record<string, string[]> = {
        'Overall': [],
        'USA West': ['9.1', '9.1.1', '9.2', '9.2.1', '9.2.5'],
        'Europe': ['12.1', '12.1.1', '12.2', '12.2.1', '12.2.5'],
        'USA East': ['15.1', '15.1.1', '15.2', '15.2.1', '15.2.5'],
        'Asean': ['18.1', '18.1.1', '18.2', '18.2.1', '18.2.5'],
        'Japan': ['21.1', '21.1.1', '21.2', '21.2.1', '21.2.5'],
        'Korea': ['24.1', '24.1.1', '24.2', '24.2.1', '24.2.5'],
        'Legacy': ['27.1', '27.1.1', '27.2', '27.2.1', '27.2.5'],
        'Financial Team': []
    };

    const [highlightedSlides, setHighlightedSlides] = useState<Set<string>>(new Set());

    const handleViewRegion = (region: string) => {
        const ids = REGION_SLIDE_IDS[region] || [];
        if (ids.length === 0) return;
        setHighlightedSlides(new Set(ids));
        // Scroll to the first highlighted slide
        setTimeout(() => {
            const first = document.getElementById(`slide-preview-${ids[0]}`);
            if (first) {
                first.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 50);
        // Auto-clear highlight after a few seconds
        window.setTimeout(() => {
            setHighlightedSlides(new Set());
        }, 5000);
    };

    const handleViewWhale = (region: string) => {
        const ids = REGION_SLIDE_IDS[region] || [];
        const whaleId = ids[ids.length - 1];
        if (!whaleId) return;
        setHighlightedSlides(new Set([whaleId]));
        setTimeout(() => {
            const el = document.getElementById(`slide-preview-${whaleId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
        window.setTimeout(() => setHighlightedSlides(new Set()), 5000);
    };

    const [regionCounts, setRegionCounts] = useState<Record<string, { filled: number; total: number; missing: string[]; whaleNames: string[] }>>({});
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
        window.addEventListener('tracker_refresh_checklist', handleRefresh);
        return () => window.removeEventListener('tracker_refresh_checklist', handleRefresh);
    }, []);

    // Human readable name for a slide input key
    const getSlideInputName = (sid: string): string => {
        if (sid.includes('_whale_account_')) {
            const num = sid.split('_whale_account_')[1];
            return `Whale Account ${num}`;
        }
        if (sid.endsWith('_acc_mgmt_actions')) return 'Account Management - Action Points';
        if (sid.endsWith('_acc_mgmt')) return 'Account Management Summary';
        if (sid.endsWith('_new_biz_actions')) return 'New Business - Action Points';
        if (sid.endsWith('_new_biz')) return 'New Business Summary';
        return sid;
    };

    useEffect(() => {
        // compute pending counts for each region by fetching slide inputs for current week
        if (!currentWeek) return;

        const regions = Object.keys(REGION_SLIDES);

        const fetchForRegion = async (region: string) => {
            const slideIds = REGION_SLIDES[region] || [];
            const missing: string[] = [];

            await Promise.all(slideIds.map(async (sid) => {
                try {
                    const res = await fetch(`/api/admin/slide-inputs/${encodeURIComponent(sid)}`);
                    if (!res.ok) {
                        missing.push(sid);
                        return;
                    }
                    const entries = await res.json();
                    // Slide is "filled" only if at least one entry for the current week
                    // has actual non-empty freeform_text content.
                    const hasCurrent = Array.isArray(entries) && entries.some((e: any) => {
                        if (Number(e.week_recorded) !== Number(currentWeek)) return false;
                        const text = typeof e.freeform_text === 'string' ? e.freeform_text.trim() : '';
                        return text.length > 0;
                    });
                    if (!hasCurrent) missing.push(sid);
                } catch (err) {
                    console.error('Failed to fetch slide inputs for', sid, err);
                    missing.push(sid);
                }
            }));
            
            let whaleNames: string[] = [];
            // Whale Accounts missing items (2 required)
            if (region !== 'Overall' && region !== 'Financial Team') {
                try {
                    const wRes = await fetch(`/api/admin/whale-accounts/stats/${encodeURIComponent(region)}/${currentWeek}`);
                    if (wRes.ok) {
                        const data = await wRes.json();
                        whaleNames = data.names || [];
                    }
                } catch (e) {
                    console.error("Failed to fetch whale account stats", e);
                }
            }
            
            const expectedTotal = slideIds.length + (region !== 'Overall' && region !== 'Financial Team' ? 2 : 0);
            const whaleMissingCount = Math.max(0, 2 - whaleNames.length);

            // Preserve ordering as defined in REGION_SLIDES
            const orderedMissing = slideIds.filter(s => missing.includes(s)).map(getSlideInputName);
            
            return { region, filled: expectedTotal - orderedMissing.length - whaleMissingCount, total: expectedTotal, missing: orderedMissing, whaleNames };
        };

        (async () => {
            const results = await Promise.all(regions.map(r => fetchForRegion(r)));
            const map: Record<string, { filled: number; total: number; missing: string[]; whaleNames: string[] }> = {};
            results.forEach(r => {
                if (!r) return;
                map[r.region] = { filled: r.filled, total: r.total, missing: r.missing, whaleNames: r.whaleNames };
            });
            setRegionCounts(map);
        })();

    }, [currentWeek, refreshTrigger]);

    return (
        <div className="app-container" style={{ position: 'relative', minHeight: '150vh', padding: '2rem' }}>
            {/* Hidden file input for image overlay uploads */}
            <input
                ref={overlayImageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleOverlayImageFile}
            />
            {/* Header / Home Button */}
            <button
                onClick={() => navigate('/')}
                style={{
                    position: 'absolute',
                    top: '2rem',
                    left: '2rem',
                    padding: '0.6rem 2.5rem',
                    backgroundColor: '#888888',
                    color: 'white',
                    border: '3px solid #555555',
                    borderRadius: '9999px',
                    fontWeight: '900',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    zIndex: 10
                }}
            >
                Home
            </button>

            {/* Main Title */}
            <div style={{ marginTop: '5rem', marginLeft: '1rem' }}>
                <h1 style={{ fontSize: '3.5rem', fontWeight: '800', color: '#4a4a55', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                    Weekly Tracker
                </h1>
                <h2 style={{ fontSize: '2rem', fontWeight: '700', color: '#9ca3af', marginBottom: '0.5rem' }}>
                    Pending user input check list
                </h2>
                <div style={{ fontSize: '1.2rem', color: '#9ca3af', fontWeight: '600', marginBottom: '3rem' }}>
                    Current week : week {currentWeek}
                </div>
            </div>

            {/* Pending Input Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '5rem', maxWidth: '1200px' }}>
                {['Overall','USA West','Europe','USA East','Asean','Japan','Korea','Legacy','Financial Team'].map(name => {
                    const stats = regionCounts[name] || { filled: 0, total: REGION_SLIDES[name]?.length || 0, missing: [] as string[], whaleNames: [] as string[] };
                    const hasWhales = name !== 'Overall' && name !== 'Financial Team';
                    return <StatusCard key={name} title={name} filled={stats.filled} total={stats.total} missingNames={stats.missing} whaleAccounts={stats.whaleNames} onView={() => handleViewRegion(name)} onViewWhale={hasWhales ? () => handleViewWhale(name) : undefined} />;
                })}
            </div>

            {/* PPT Section */}
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: '700', color: '#9ca3af', marginBottom: '1rem', marginLeft: '1rem' }}>
                    PPT Section
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '1rem', marginLeft: '1rem', marginBottom: '1rem' }}>
                    <button
                        onClick={() => handleStartSlideshow()}
                        style={{
                            backgroundColor: '#5D9CEC',
                            color: 'white',
                            border: 'none',
                            padding: '0.8rem 2rem',
                            borderRadius: '9999px',
                            fontWeight: '700',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 6px rgba(93, 156, 236, 0.4)'
                        }}
                    >
                        <Play size={20} fill="currentColor" />
                        Start SlideShow
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ color: '#0f766e', fontSize: '1rem', fontWeight: '800', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                            Export
                        </div>
                        <button
                            onClick={handleExportPdf}
                            disabled={isExporting || exportingImageSlideId !== null}
                            style={{
                                backgroundColor: isExporting || exportingImageSlideId !== null ? '#94a3b8' : '#0f766e',
                                color: 'white',
                                border: 'none',
                                padding: '0.8rem 2rem',
                                borderRadius: '9999px',
                                fontWeight: '700',
                                fontSize: '1rem',
                                cursor: isExporting || exportingImageSlideId !== null ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: isExporting || exportingImageSlideId !== null ? 'none' : '0 4px 6px rgba(15, 118, 110, 0.35)'
                            }}
                        >
                            {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                            {isExporting ? 'Exporting PDF...' : 'Export PDF'}
                        </button>
                        <div style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: '600', minHeight: '1.5rem' }}>
                            {exportProgress
                                ? `Exporting ${exportProgress.current}/${exportProgress.total}: ${exportProgress.title}`
                                : 'Export all slides as one PDF in 16:9 presentation format'}
                        </div>
                    </div>
                </div>

                {/* Jump to Region */}
                <div style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
                    <div style={{ color: '#4a4a55', fontSize: '1rem', fontWeight: '800', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                        Jump to:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {(() => {
                            const jumpRegions: { name: string; firstSlideId: string | null }[] = [
                                { name: 'Overall', firstSlideId: '3' },
                                { name: 'USA West', firstSlideId: '7' },
                                { name: 'Europe', firstSlideId: '10' },
                                { name: 'USA East', firstSlideId: '13' },
                                { name: 'Asean', firstSlideId: '16' },
                                { name: 'Japan', firstSlideId: '19' },
                                { name: 'Korea', firstSlideId: '22' },
                                { name: 'Legacy', firstSlideId: '25' },
                            ];
                            return jumpRegions.map(({ name, firstSlideId }) => {
                                let idx = -1;
                                if (firstSlideId === null) {
                                    idx = 0;
                                } else {
                                    idx = displaySlides.findIndex(s => String(s.id) === firstSlideId);
                                }
                                const disabled = idx < 0;
                                return (
                                    <button
                                        key={name}
                                        onClick={() => handleStartSlideshow(idx)}
                                        disabled={disabled}
                                        style={{
                                            backgroundColor: disabled ? '#e5e7eb' : '#8b5cf6',
                                            color: disabled ? '#9ca3af' : 'white',
                                            border: 'none',
                                            padding: '0.55rem 1.2rem',
                                            borderRadius: '9999px',
                                            fontWeight: '700',
                                            fontSize: '0.95rem',
                                            cursor: disabled ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            boxShadow: disabled ? 'none' : '0 3px 5px rgba(139, 92, 246, 0.35)',
                                            transition: 'all 0.2s'
                                        }}
                                        title={disabled ? `${name} slides not available` : `Start slideshow from ${name}`}
                                    >
                                        <Play size={14} fill="currentColor" /> {name}
                                    </button>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>

            {/* Slides List */}
            <div style={{ maxWidth: '1000px', marginLeft: '1rem', position: 'relative' }}>
                {/* Timeline Line */}
                <div style={{ position: 'absolute', left: '-1rem', top: '0', bottom: '0', width: '6px', backgroundColor: '#5D9CEC', borderRadius: '4px' }}></div>

                {displaySlides.map((slideItem, slideIndex) => {
                    const slideId = slideItem.id;
                    const isCustom = slideItem.isCustom;

                    let isEditable = false;
                    let title = `Slide ${slideId}`;
                    const customSlideData = slideItem.data;

                    if (isCustom) {
                        isEditable = true;
                        title = customSlideData?.title || "Custom Image";
                    } else {
                        isEditable = true;
                    }

                    const isCurrentlyEditing = editingSlide === slideId;
                    const isHidden = hiddenSlides.has(String(slideId));
                    const hasGif = isCustom
                        ? (customSlideData?.gifEnabled ?? false)
                        : getStandardSlideGif(slideId).enabled;
                    const isHighlighted = highlightedSlides.has(String(slideId));

                    return (
                        <div
                            key={String(slideId)}
                            id={`slide-preview-${slideId}`}
                            style={{
                                paddingLeft: '2rem',
                                borderRadius: '16px',
                                transition: 'box-shadow 0.4s ease, background-color 0.4s ease',
                                boxShadow: isHighlighted ? '0 0 0 4px #f59e0b, 0 10px 24px rgba(245,158,11,0.35)' : 'none',
                                backgroundColor: isHighlighted ? 'rgba(254, 243, 199, 0.55)' : 'transparent',
                                marginBottom: isHighlighted ? '1rem' : 0
                            }}
                        >
                            {/* Slide Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0 1rem' }}>
                                <div style={{ flex: 1 }}>
                                    {isCustom && isCurrentlyEditing ? (
                                        <input
                                            value={editedTitle}
                                            onChange={(e) => setEditedTitle(e.target.value)}
                                            style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'inherit', border: 'none', borderBottom: '2px solid #5D9CEC', outline: 'none', width: '100%', color: '#4a4a55' }}
                                            placeholder="Enter Slide Title"
                                        />
                                    ) : (
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: isHidden ? '#9ca3af' : '#4a4a55', textDecoration: isHidden ? 'line-through' : 'none' }}>
                                            {isCustom ? title : `Slide ${slideId} - ${getSlideRegion(slideId)} - ${getSlideTitle(slideId)}`} {isHidden && <span style={{ fontSize: '0.8rem', color: '#ef4444', textDecoration: 'none', marginLeft: '0.5rem' }}>(Hidden)</span>}
                                        </h3>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    {/* Quarter selector (Services snapshot slides only) */}
                                    {String(slideId).endsWith('_services_q1') && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '20px', padding: '0.15rem' }}>
                                            {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
                                                const isSelected = getServicesQuarter(slideId) === q;
                                                return (
                                                    <button
                                                        key={q}
                                                        onClick={() => setServicesQuarter(slideId, q)}
                                                        style={{
                                                            backgroundColor: isSelected ? '#5D9CEC' : 'transparent',
                                                            border: 'none',
                                                            padding: '0.25rem 0.7rem',
                                                            borderRadius: '16px',
                                                            color: isSelected ? 'white' : '#374151',
                                                            fontWeight: 700,
                                                            fontSize: '0.8rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                        }}
                                                        title={`Show ${q} data`}
                                                    >
                                                        {q}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* Start Slideshow From Here */}
                                    <button
                                        onClick={() => handleStartSlideshow(slideIndex)}
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

                                    <button
                                        onClick={() => handleExportSlideImage(slideItem)}
                                        disabled={isExporting || exportingImageSlideId !== null}
                                        style={{
                                            backgroundColor: exportingImageSlideId === slideId ? '#94a3b8' : '#0f766e',
                                            border: 'none',
                                            padding: '0.3rem 0.8rem',
                                            borderRadius: '20px',
                                            color: 'white',
                                            fontWeight: '700',
                                            fontSize: '0.8rem',
                                            cursor: isExporting || exportingImageSlideId !== null ? 'wait' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            transition: 'all 0.2s',
                                            boxShadow: exportingImageSlideId === slideId ? 'none' : '0 2px 4px rgba(15, 118, 110, 0.35)'
                                        }}
                                        title="Export this slide as a full-resolution PNG"
                                    >
                                        {exportingImageSlideId === slideId ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                        {exportingImageSlideId === slideId ? 'Exporting...' : 'Export as Image'}
                                    </button>

                                    {/* Visibility Toggle */}
                                    <button
                                        onClick={() => toggleVisibility(slideId)}
                                        style={{
                                            backgroundColor: '#f3f4f6',
                                            border: '1px solid #d1d5db',
                                            padding: '0.3rem 0.6rem',
                                            borderRadius: '20px',
                                            color: isHidden ? '#6b7280' : '#374151',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                        title={isHidden ? "Show in presentation" : "Hide from presentation"}
                                    >
                                        {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>

                                    {/* Confetti Toggle */}
                                    <button
                                        onClick={() => toggleConfetti(slideId)}
                                        style={{
                                            backgroundColor: confettiSlides.has(String(slideId)) ? '#fef3c7' : '#f3f4f6',
                                            border: `1px solid ${confettiSlides.has(String(slideId)) ? '#f59e0b' : '#d1d5db'}`,
                                            padding: '0.3rem 0.6rem',
                                            borderRadius: '20px',
                                            color: confettiSlides.has(String(slideId)) ? '#d97706' : '#6b7280',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                        title={confettiSlides.has(String(slideId)) ? "Disable confetti" : "Enable confetti"}
                                    >
                                        <PartyPopper size={16} />
                                    </button>

                                    <button
                                        onClick={() => isCustom ? toggleCustomSlideGif(String(slideId)) : toggleStandardSlideGif(slideId)}
                                        style={{
                                            backgroundColor: hasGif ? '#dbeafe' : '#f3f4f6',
                                            border: `1px solid ${hasGif ? '#3b82f6' : '#d1d5db'}`,
                                            padding: '0.3rem 0.6rem',
                                            borderRadius: '20px',
                                            color: hasGif ? '#1d4ed8' : '#6b7280',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                        title={hasGif ? 'Disable GIF overlay' : 'Enable GIF overlay'}
                                    >
                                        <ImageIcon size={16} />
                                    </button>

                                    {/* Add Text Overlay */}
                                    <button
                                        onClick={() => addTextOverlay(slideId)}
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
                                        title="Add text overlay"
                                    >
                                        <Type size={14} /> Text
                                    </button>

                                    {/* Add Image Overlay */}
                                    <button
                                        onClick={() => handleAddImageOverlayClick(slideId)}
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
                                        title="Add image overlay from your computer"
                                    >
                                        <Plus size={14} /> Image
                                    </button>

                                    {isCustom && (
                                        <button
                                            onClick={() => deleteCustomSlide(String(slideId))}
                                            style={{
                                                backgroundColor: '#fee2e2',
                                                border: 'none',
                                                padding: '0.3rem 0.6rem',
                                                borderRadius: '20px',
                                                color: '#dc2626',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                            title="Delete Custom Slide"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}

                                    {/* Standard Edit/Del Buttons */}
                                    {isEditable ? (
                                        <button
                                            onClick={() => handleEditToggle(slideId, isCustom ? title : undefined)}
                                            style={{
                                                backgroundColor: isCurrentlyEditing ? '#10b981' : '#93c5fd',
                                                border: 'none',
                                                padding: '0.3rem 1rem',
                                                borderRadius: '20px',
                                                fontWeight: '700',
                                                color: isCurrentlyEditing ? '#fff' : '#1e3a8a',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {isCurrentlyEditing ? (
                                                <><X size={14} /> Done</>
                                            ) : (
                                                <><Pencil size={14} /> Edit</>
                                            )}
                                        </button>
                                    ) : (
                                        !isCustom && (
                                            <>
                                                <button disabled style={{ backgroundColor: '#93c5fd', border: 'none', padding: '0.3rem 1rem', borderRadius: '20px', fontWeight: '700', color: '#1e3a8a', cursor: 'not-allowed', opacity: 0.8 }}>
                                                    Edit
                                                </button>
                                                <button disabled style={{ backgroundColor: '#fca5a5', border: 'none', padding: '0.3rem 1rem', borderRadius: '20px', fontWeight: '700', color: '#7f1d1d', cursor: 'not-allowed', opacity: 0.8 }}>
                                                    Del
                                                </button>
                                            </>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Slide Content (Lazy/Standard) */}
                            <div style={{ marginBottom: '1rem' }}>
                                {(isCustom || SLIDE_REGISTRY[slideId]) ? (
                                    <LazySlideWrapper slideNum={slideId}>
                                        {renderSlideContent(slideItem, isCurrentlyEditing)}
                                    </LazySlideWrapper>
                                ) : (
                                    <div style={{ height: '300px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#991b1b', fontWeight: '600' }}>
                                        Slide not found
                                    </div>
                                )}
                            </div>

                            {/* Add Button Row */}
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem' }}>
                                <button
                                    onClick={() => addCustomSlide(isCustom ? customSlideData?.parentId ?? slideId : slideId)}
                                    style={{
                                        width: '40px', height: '40px',
                                        borderRadius: '50%', backgroundColor: '#e2e8f0',
                                        border: '1px solid #cbd5e1',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.color = '#2563eb'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; }}
                                    title="Add Image Slide Here"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Slideshow Modal / Overlay */}
            {isSlideshowOpen && (
                <div
                    ref={slideshowRef}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: '#f3f4f6',
                        zIndex: 9999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                    }}
                >
                    {toastMessage && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', padding: '1rem 2rem', borderRadius: '12px', fontWeight: '700', fontSize: '1.5rem', zIndex: 10001, pointerEvents: 'none' }}>
                            {toastMessage}
                        </div>
                    )}

                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '1rem' }}>
                        {(() => {
                            const slideItem = displaySlides[activeSlideIndex];
                            if (!slideItem) return null;

                            const hasConfetti = confettiSlides.has(String(slideItem.id));

                            return (slideItem.isCustom || SLIDE_REGISTRY[slideItem.id]) ? (
                                <div style={{ width: '100%', height: '100%', maxWidth: '100%' }}>
                                    {hasConfetti && <ConfettiSideCannons key={`confetti-${slideItem.id}-${activeSlideIndex}`} />}
                                    {renderSlideContent(slideItem, false)}
                                </div>
                            ) : (
                                <h1 style={{ fontSize: '5rem', color: '#4a4a55', fontWeight: '800' }}>
                                    Slide {slideItem.id} (Not Found)
                                </h1>
                            );
                        })()}
                    </div>
                </div>
            )}

            {(isExporting || exportingImageSlideId !== null) && exportSlide && (
                <div style={{ position: 'fixed', left: '-10000px', top: 0, width: `${EXPORT_SLIDE_WIDTH}px`, height: `${EXPORT_SLIDE_HEIGHT}px`, pointerEvents: 'none', overflow: 'hidden', backgroundColor: '#ffffff', zIndex: -1 }}>
                    <div
                        ref={exportContainerRef}
                        style={{ width: `${EXPORT_SLIDE_WIDTH}px`, height: `${EXPORT_SLIDE_HEIGHT}px`, backgroundColor: '#ffffff', overflow: 'hidden' }}
                    >
                        {renderSlideContent(exportSlide, false)}
                    </div>
                </div>
            )}

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
