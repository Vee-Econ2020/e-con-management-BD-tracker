import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, Loader2, Plus, Play, Eye, EyeOff, Pencil, Trash2, PartyPopper, Image as ImageIcon, Type, Folder, FolderOpen, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Building2, ExternalLink, Layers } from 'lucide-react';
import { ConfettiSideCannons } from '../components/ConfettiSideCannons';
import { useWeek } from '../context/WeekContext';
import { useAuth } from '../context/AuthContext';
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
import Slide29 from '../components/slides/Slide29';
import Slide30 from '../components/slides/Slide30';
import Slide9_2_2 from '../components/slides/Slide9_2_2';
import Slide12_2_2 from '../components/slides/Slide12_2_2';
import Slide15_2_2 from '../components/slides/Slide15_2_2';
import Slide18_2_2 from '../components/slides/Slide18_2_2';
import Slide21_2_2 from '../components/slides/Slide21_2_2';
import Slide24_2_2 from '../components/slides/Slide24_2_2';
import Slide27_2_2 from '../components/slides/Slide27_2_2';
import Slide30_2_2 from '../components/slides/Slide30_2_2';
import {
    Slide9_1, Slide9_2, Slide9_1_1, Slide9_2_1,
    Slide12_1, Slide12_2, Slide12_1_1, Slide12_2_1,
    Slide15_1, Slide15_2, Slide15_1_1, Slide15_2_1,
    Slide18_1, Slide18_1_1,
    Slide21_1, Slide21_1_1,
    Slide24_1, Slide24_1_1,
    Slide27_1, Slide27_2, Slide27_1_1, Slide27_2_1,
    Slide30_1, Slide30_1_1, Slide30_2, Slide30_2_1, Slide30_3, Slide30_3_1
} from '../components/slides/RegionActivitySlides';
import {
    Slide9_2_3, Slide12_2_3, Slide15_2_3, Slide18_2_3,
    Slide21_2_3, Slide24_2_3, Slide27_2_3, Slide30_2_3,
    Slide9_2_3_cy, Slide12_2_3_cy, Slide15_2_3_cy, Slide18_2_3_cy,
    Slide21_2_3_cy, Slide24_2_3_cy, Slide27_2_3_cy, Slide30_2_3_cy,
    Slide9_2_4, Slide12_2_4, Slide15_2_4, Slide18_2_4,
    Slide21_2_4, Slide24_2_4, Slide27_2_4, Slide30_2_4
} from '../components/slides/RegionGMSlides';
import ServicesChartSlide from '../components/slides/ServicesChartSlide';
import ServicesBacklogSlide from '../components/slides/ServicesBacklogSlide';
import { WhaleAccountSlide } from '../components/slides/WhaleAccountSlide';
import ServicesQ1SnapshotSlide from '../components/slides/ServicesQ1SnapshotSlide';
import InvoiceChartSlide from '../components/slides/InvoiceChartSlide';
import { AiChatbot } from '../components/AiChatbot';

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
    29: Slide29,
    30: Slide30,
    '9.1': Slide9_1, '9.1.1': Slide9_1_1, '9.2': Slide9_2, '9.2.1': Slide9_2_1,
    '12.1': Slide12_1, '12.1.1': Slide12_1_1, '12.2': Slide12_2, '12.2.1': Slide12_2_1,
    '15.1': Slide15_1, '15.1.1': Slide15_1_1, '15.2': Slide15_2, '15.2.1': Slide15_2_1,
    '18.1': Slide18_1, '18.1.1': Slide18_1_1,
    '21.1': Slide21_1, '21.1.1': Slide21_1_1,
    '24.1': Slide24_1, '24.1.1': Slide24_1_1,
    '27.1': Slide27_1, '27.1.1': Slide27_1_1, '27.2': Slide27_2, '27.2.1': Slide27_2_1,
    '30.1': Slide30_1, '30.1.1': Slide30_1_1,
    '30.2': Slide30_2, '30.2.1': Slide30_2_1,
    '30.3': Slide30_3, '30.3.1': Slide30_3_1,
    '9.2.2': Slide9_2_2,
    '12.2.2': Slide12_2_2,
    '15.2.2': Slide15_2_2,
    '18.2.2': Slide18_2_2,
    '21.2.2': Slide21_2_2,
    '24.2.2': Slide24_2_2,
    '27.2.2': Slide27_2_2,
    '30.2.2': Slide30_2_2,
    '9.2.3': Slide9_2_3,
    '12.2.3': Slide12_2_3,
    '15.2.3': Slide15_2_3,
    '18.2.3': Slide18_2_3,
    '21.2.3': Slide21_2_3,
    '24.2.3': Slide24_2_3,
    '27.2.3': Slide27_2_3,
    '30.2.3': Slide30_2_3,
    '9.2.3_cy': Slide9_2_3_cy,
    '12.2.3_cy': Slide12_2_3_cy,
    '15.2.3_cy': Slide15_2_3_cy,
    '18.2.3_cy': Slide18_2_3_cy,
    '21.2.3_cy': Slide21_2_3_cy,
    '24.2.3_cy': Slide24_2_3_cy,
    '27.2.3_cy': Slide27_2_3_cy,
    '30.2.3_cy': Slide30_2_3_cy,
    '9.2.4': Slide9_2_4,
    '12.2.4': Slide12_2_4,
    '15.2.4': Slide15_2_4,
    '18.2.4': Slide18_2_4,
    '21.2.4': Slide21_2_4,
    '24.2.4': Slide24_2_4,
    '27.2.4': Slide27_2_4,
    '30.2.4': Slide30_2_4,
    '9.2.5': (props: any) => <WhaleAccountSlide {...props} region="USA West" />,
    '12.2.5': (props: any) => <WhaleAccountSlide {...props} region="Europe" />,
    '15.2.5': (props: any) => <WhaleAccountSlide {...props} region="USA East" />,
    '18.2.5': (props: any) => <WhaleAccountSlide {...props} region="Asean" />,
    '21.2.5': (props: any) => <WhaleAccountSlide {...props} region="Japan" />,
    '24.2.5': (props: any) => <WhaleAccountSlide {...props} region="Korea" />,
    '27.2.5': (props: any) => <WhaleAccountSlide {...props} region="Legacy" />,
    '30.2.5': (props: any) => <WhaleAccountSlide {...props} region="ROW" />,

    // ── Services-only chart mirrors ───────────────────────────────────────
    // Each parent chart slide (cumulative/trend/pipeline) has a sibling here
    // that fetches /api/admin/slides/services/{slideNo} and renders the same
    // shared chart with `hideTargets` enabled.
    '3_services':  (props: any) => <ServicesChartSlide slideNo={3}  chartKind="cumulative" regionLabel="Overall" {...props} />,
    '3_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="Overall" quarter={props.quarter} {...props} />,
    '4_services':  (props: any) => <ServicesChartSlide slideNo={4}  chartKind="trend"      regionLabel="Overall" {...props} />,
    '5_services':  (props: any) => <ServicesChartSlide slideNo={5}  chartKind="pipeline"   regionLabel="Overall" {...props} />,
    '7_services':  (props: any) => <ServicesChartSlide slideNo={7}  chartKind="cumulative" regionLabel="US West" {...props} />,
    '7_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="US West" quarter={props.quarter} {...props} />,
    '8_services':  (props: any) => <ServicesChartSlide slideNo={8}  chartKind="trend"      regionLabel="US West" {...props} />,
    '9_services':  (props: any) => <ServicesChartSlide slideNo={9}  chartKind="pipeline"   regionLabel="US West" {...props} />,
    '10_services': (props: any) => <ServicesChartSlide slideNo={10} chartKind="cumulative" regionLabel="Europe"  {...props} />,
    '10_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="Europe" quarter={props.quarter} {...props} />,
    '11_services': (props: any) => <ServicesChartSlide slideNo={11} chartKind="trend"      regionLabel="Europe"  {...props} />,
    '12_services': (props: any) => <ServicesChartSlide slideNo={12} chartKind="pipeline"   regionLabel="Europe"  {...props} />,
    '13_services': (props: any) => <ServicesChartSlide slideNo={13} chartKind="cumulative" regionLabel="US East" {...props} />,
    '13_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="US East" quarter={props.quarter} {...props} />,
    '14_services': (props: any) => <ServicesChartSlide slideNo={14} chartKind="trend"      regionLabel="US East" {...props} />,
    '15_services': (props: any) => <ServicesChartSlide slideNo={15} chartKind="pipeline"   regionLabel="US East" {...props} />,
    '16_services': (props: any) => <ServicesChartSlide slideNo={16} chartKind="cumulative" regionLabel="ASEAN"   {...props} />,
    '16_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="Asean" quarter={props.quarter} {...props} />,
    '17_services': (props: any) => <ServicesChartSlide slideNo={17} chartKind="trend"      regionLabel="ASEAN"   {...props} />,
    '18_services': (props: any) => <ServicesChartSlide slideNo={18} chartKind="pipeline"   regionLabel="ASEAN"   {...props} />,
    '19_services': (props: any) => <ServicesChartSlide slideNo={19} chartKind="cumulative" regionLabel="Japan"   {...props} />,
    '19_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="Japan" quarter={props.quarter} {...props} />,
    '20_services': (props: any) => <ServicesChartSlide slideNo={20} chartKind="trend"      regionLabel="Japan"   {...props} />,
    '21_services': (props: any) => <ServicesChartSlide slideNo={21} chartKind="pipeline"   regionLabel="Japan"   {...props} />,
    '22_services': (props: any) => <ServicesChartSlide slideNo={22} chartKind="cumulative" regionLabel="KANZ"    {...props} />,
    '22_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="KANZ" quarter={props.quarter} {...props} />,
    '23_services': (props: any) => <ServicesChartSlide slideNo={23} chartKind="trend"      regionLabel="KANZ"    {...props} />,
    '24_services': (props: any) => <ServicesChartSlide slideNo={24} chartKind="pipeline"   regionLabel="KANZ"    {...props} />,
    '25_services': (props: any) => <ServicesChartSlide slideNo={25} chartKind="cumulative" regionLabel="Legacy"  {...props} />,
    '25_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="Legacy" quarter={props.quarter} {...props} />,
    '26_services': (props: any) => <ServicesChartSlide slideNo={26} chartKind="trend"      regionLabel="Legacy"  {...props} />,
    '27_services': (props: any) => <ServicesChartSlide slideNo={27} chartKind="pipeline"   regionLabel="Legacy"  {...props} />,
    '28_services':  (props: any) => <ServicesChartSlide slideNo={28} chartKind="cumulative" regionLabel="ROW"     {...props} />,
    '28_services_q1': (props: any) => <ServicesQ1SnapshotSlide region="ROW" quarter={props.quarter} {...props} />,
    '29_services':  (props: any) => <ServicesChartSlide slideNo={29} chartKind="trend"      regionLabel="ROW"     {...props} />,
    '30_services':  (props: any) => <ServicesChartSlide slideNo={30} chartKind="pipeline"   regionLabel="ROW"     {...props} />,

    // Services-only Order Backlog mirrors
    '6.2_services':    (props: any) => <ServicesBacklogSlide region="Overall" {...props} />,
    '9.2.2_services':  (props: any) => <ServicesBacklogSlide region="US West" {...props} />,
    '12.2.2_services': (props: any) => <ServicesBacklogSlide region="Europe" {...props} />,
    '15.2.2_services': (props: any) => <ServicesBacklogSlide region="US East" {...props} />,
    '18.2.2_services': (props: any) => <ServicesBacklogSlide region="Asean" {...props} />,
    '21.2.2_services': (props: any) => <ServicesBacklogSlide region="Japan" {...props} />,
    '24.2.2_services': (props: any) => <ServicesBacklogSlide region="KANZ" {...props} />,
    '27.2.2_services': (props: any) => <ServicesBacklogSlide region="Legacy" {...props} />,
    '30.2.2_services': (props: any) => <ServicesBacklogSlide region="ROW" {...props} />,

    // Invoicing Data slides (8-Week Trend)
    '3_invoice':  (props: any) => <InvoiceChartSlide regionLabel="Overall"  region="Overall"  {...props} />,
    '7_invoice':  (props: any) => <InvoiceChartSlide regionLabel="US West" region="US West"  {...props} />,
    '10_invoice': (props: any) => <InvoiceChartSlide regionLabel="Europe"   region="Europe"   {...props} />,
    '13_invoice': (props: any) => <InvoiceChartSlide regionLabel="US East" region="US East"  {...props} />,
    '16_invoice': (props: any) => <InvoiceChartSlide regionLabel="Asean"    region="Asean"    {...props} />,
    '19_invoice': (props: any) => <InvoiceChartSlide regionLabel="Japan"    region="Japan"    {...props} />,
    '22_invoice': (props: any) => <InvoiceChartSlide regionLabel="KANZ"     region="KANZ"     {...props} />,
    '25_invoice': (props: any) => <InvoiceChartSlide regionLabel="Legacy"   region="Legacy"   {...props} />,
    '28_invoice': (props: any) => <InvoiceChartSlide regionLabel="ROW"       region="ROW"       {...props} />,
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
    fy?: string;
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
    fy?: string;
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
    fy,
}: StandardSlideFrameProps) {
    const frameRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={frameRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            {fy && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '12px',
                        right: '16px',
                        zIndex: 40,
                        backgroundColor: '#1d4ed8',
                        color: '#ffffff',
                        padding: '4px 14px',
                        borderRadius: '9999px',
                        fontSize: '0.85rem',
                        fontWeight: '800',
                        letterSpacing: '0.05em',
                        boxShadow: '0 2px 8px rgba(29, 78, 216, 0.4)',
                        border: '1.5px solid rgba(255, 255, 255, 0.5)',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backdropFilter: 'blur(4px)'
                    }}
                >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#60a5fa', boxShadow: '0 0 4px #60a5fa' }} />
                    <span>{fy}</span>
                </div>
            )}
            <SlideComponent isEditing={isEditing} onNextSlide={onNextSlide} onPreviousSlide={onPreviousSlide} quarter={quarter} fy={fy} />
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
        await new Promise<void>(resolve => {
            if (document.hidden) {
                setTimeout(resolve, 16);
            } else {
                requestAnimationFrame(() => resolve());
            }
        });
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

const waitForNetworkIdle = async (fetchTracker: FetchTracker, idleMs = 200, timeoutMs = 15000) => {
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

        await wait(50);
    }
};

const waitForDomQuiet = async (container: HTMLElement, quietMs = 150, timeoutMs = 3000) => {
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

const waitForPlotlyCharts = async (container: HTMLElement, timeoutMs = 5000) => {
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
            await wait(100);
            return;
        }

        await wait(50);
    }
};

const waitForCanvasPaint = async (container: HTMLElement, timeoutMs = 4000) => {
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
            await wait(100);
            await waitForAnimationFrames(1);
            return;
        }

        await wait(50);
    }
};

const waitForSlideReadiness = async (container: HTMLElement, fetchTracker: FetchTracker) => {
    const start = Date.now();

    while (Date.now() - start < 15000) {
        await waitForImages(container);
        await waitForNetworkIdle(fetchTracker);

        const text = container.innerText.toLowerCase();
        const isLoading = text.includes('loading');
        const hasSkeleton = container.querySelector('.animate-pulse, .animate-spin');

        if (!isLoading && !hasSkeleton && fetchTracker.getPendingCount() === 0) {
            break;
        }

        await wait(100);
    }

    window.dispatchEvent(new Event('resize'));
    await waitForAnimationFrames(2);
    await waitForCanvasPaint(container);
    await waitForPlotlyCharts(container);
    await waitForDomQuiet(container, 150, 1500);
    await waitForImages(container);
    await wait(100);
};


// --- Components ---

const LazySlideWrapper = ({ children, slideNum }: { children: React.ReactNode, slideNum: number | string }) => {
    const isExportServer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('export_server') === 'true';
    const [isLoaded, setIsLoaded] = useState(isExportServer);

    if (isLoaded || isExportServer) {
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
interface MissingSlideItem {
    key: string;
    name: string;
    slideId: string;
}

interface StatusCardProps {
    title: string;
    status?: 'pending' | 'completed';
    filled?: number;
    total?: number;
    missingItems?: MissingSlideItem[];
    whaleAccounts?: string[];
    whaleSlideId?: string;
    firstSlideId?: string;
    onNavigateSlide?: (slideId?: string) => void;
}

const StatusCard = ({ 
    title, 
    filled = 0, 
    total = 0, 
    missingItems = [], 
    whaleAccounts = [],
    whaleSlideId,
    firstSlideId,
    onNavigateSlide 
}: StatusCardProps) => {
    const isComplete = total > 0 && filled === total;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [hoveredWhale, setHoveredWhale] = useState<boolean>(false);
    const [hoveredHeader, setHoveredHeader] = useState<boolean>(false);

    return (
        <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: isComplete ? '1.5px solid #6ee7b7' : '1px solid #cbd5e1',
            boxShadow: isComplete 
                ? '0 4px 20px -2px rgba(16, 185, 129, 0.12)' 
                : '0 4px 16px -2px rgba(15, 23, 42, 0.05)',
            gap: '0.8rem',
            transition: 'all 0.2s ease-in-out',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Header: Title & Completion Badge */}
            <div>
                <div 
                    onClick={() => firstSlideId && onNavigateSlide?.(firstSlideId)}
                    onMouseEnter={() => setHoveredHeader(true)}
                    onMouseLeave={() => setHoveredHeader(false)}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        marginBottom: '0.4rem',
                        cursor: firstSlideId ? 'pointer' : 'default',
                        padding: '0.2rem 0.3rem',
                        borderRadius: '6px',
                        backgroundColor: hoveredHeader && firstSlideId ? '#f1f5f9' : 'transparent',
                        transition: 'background-color 0.15s ease'
                    }}
                    title={firstSlideId ? `Click to view ${title} slides` : undefined}
                >
                    <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {title}
                        {firstSlideId && (
                            <ExternalLink size={12} style={{ opacity: hoveredHeader ? 0.9 : 0.4, color: hoveredHeader ? '#2563eb' : '#64748b', transition: 'all 0.15s ease' }} />
                        )}
                    </span>
                    {isComplete ? (
                        <span style={{
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            border: '1px solid #a7f3d0'
                        }}>
                            <CheckCircle2 size={12} /> Complete
                        </span>
                    ) : filled > 0 ? (
                        <span style={{
                            backgroundColor: '#fef3c7',
                            color: '#b45309',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            border: '1px solid #fde68a'
                        }}>
                            {filled}/{total} Filled
                        </span>
                    ) : (
                        <span style={{
                            backgroundColor: '#ffe4e6',
                            color: '#be123c',
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            border: '1px solid #fecdd3'
                        }}>
                            0/{total} Filled
                        </span>
                    )}
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', backgroundColor: '#f1f5f9', height: '6px', borderRadius: '9999px', overflow: 'hidden', marginTop: '0.5rem' }}>
                    <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: isComplete ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                        borderRadius: '9999px',
                        transition: 'width 0.4s ease'
                    }} />
                </div>
            </div>

            {/* Missing Slide Items Section */}
            {missingItems.length > 0 && (
                <div style={{
                    backgroundColor: '#fff1f2',
                    borderRadius: '12px',
                    padding: '0.65rem 0.8rem',
                    border: '1px solid #fecdd3'
                }}>
                    <div style={{
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        color: '#e11d48',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '0.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <AlertCircle size={13} /> Missing items ({missingItems.length})
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#be123c', textTransform: 'none', opacity: 0.85 }}>
                            Click to view slide
                        </span>
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', color: '#334155', fontSize: '0.78rem', fontWeight: 600 }}>
                        {missingItems.map((item, idx) => (
                            <li 
                                key={item.key}
                                onClick={() => item.slideId && onNavigateSlide?.(item.slideId)}
                                onMouseEnter={() => setHoveredIndex(idx)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                style={{
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: '6px',
                                    marginBottom: '0.2rem',
                                    cursor: 'pointer',
                                    backgroundColor: hoveredIndex === idx ? '#ffe4e6' : 'transparent',
                                    color: hoveredIndex === idx ? '#be123c' : '#334155',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    transition: 'all 0.15s ease',
                                    transform: hoveredIndex === idx ? 'translateX(2px)' : 'none'
                                }}
                                title={`Click to navigate to slide: ${item.name}`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                                    <span style={{ 
                                        width: '6px', 
                                        height: '6px', 
                                        borderRadius: '50%', 
                                        backgroundColor: hoveredIndex === idx ? '#e11d48' : '#f43f5e',
                                        flexShrink: 0 
                                    }} />
                                    <span style={{ 
                                        overflow: 'hidden', 
                                        textOverflow: 'ellipsis', 
                                        whiteSpace: 'nowrap',
                                        fontWeight: hoveredIndex === idx ? 700 : 600,
                                        textDecoration: hoveredIndex === idx ? 'underline' : 'none'
                                    }}>
                                        {item.name}
                                    </span>
                                </div>
                                <ExternalLink 
                                    size={12} 
                                    style={{ 
                                        flexShrink: 0, 
                                        color: hoveredIndex === idx ? '#be123c' : '#94a3b8',
                                        opacity: hoveredIndex === idx ? 1 : 0.6,
                                        transform: hoveredIndex === idx ? 'scale(1.15)' : 'scale(1)',
                                        transition: 'all 0.15s ease'
                                    }} 
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Missing Whale Accounts Section */}
            {title !== 'Overall' && title !== 'Financial Team' && whaleAccounts.length < 2 && (
                <div style={{
                    backgroundColor: '#fff7ed',
                    borderRadius: '12px',
                    padding: '0.65rem 0.8rem',
                    border: '1px solid #fed7aa'
                }}>
                    <div style={{
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        color: '#c2410c',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: '0.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Building2 size={13} /> Whale accounts missing
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#c2410c', textTransform: 'none', opacity: 0.85 }}>
                            Click to view slide
                        </span>
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', color: '#431407', fontSize: '0.78rem', fontWeight: 600 }}>
                        <li
                            onClick={() => whaleSlideId && onNavigateSlide?.(whaleSlideId)}
                            onMouseEnter={() => setHoveredWhale(true)}
                            onMouseLeave={() => setHoveredWhale(false)}
                            style={{
                                padding: '0.35rem 0.5rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                backgroundColor: hoveredWhale ? '#ffedd5' : 'transparent',
                                color: hoveredWhale ? '#c2410c' : '#431407',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                                transition: 'all 0.15s ease',
                                transform: hoveredWhale ? 'translateX(2px)' : 'none'
                            }}
                            title="Click to navigate to Whale Accounts slide"
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                                <span style={{ 
                                    width: '6px', 
                                    height: '6px', 
                                    borderRadius: '50%', 
                                    backgroundColor: hoveredWhale ? '#ea580c' : '#f97316',
                                    flexShrink: 0 
                                }} />
                                <span style={{ 
                                    fontWeight: hoveredWhale ? 700 : 600,
                                    textDecoration: hoveredWhale ? 'underline' : 'none'
                                }}>
                                    {whaleAccounts.length === 1 ? (
                                        `1 more account to add (Added: ${whaleAccounts[0]})`
                                    ) : (
                                        '2 accounts to add'
                                    )}
                                </span>
                            </div>
                            <ExternalLink 
                                size={12} 
                                style={{ 
                                    flexShrink: 0, 
                                    color: hoveredWhale ? '#c2410c' : '#94a3b8',
                                    opacity: hoveredWhale ? 1 : 0.6,
                                    transform: hoveredWhale ? 'scale(1.15)' : 'scale(1)',
                                    transition: 'all 0.15s ease'
                                }} 
                            />
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default function WeeklyTracker() {
    const navigate = useNavigate();
    const { selectedWeek: currentWeek, availableWeeks, setSelectedWeek } = useWeek();
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin';
    const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);
    const [activeSlideIndex, setActiveSlideIndex] = useState(0);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const slideshowRef = useRef<HTMLDivElement>(null);
    const [selectedFY, setSelectedFY] = useState(() => {
        if (typeof window !== 'undefined') {
            const urlFy = new URLSearchParams(window.location.search).get('fy');
            if (urlFy) return urlFy;
        }
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1-indexed (Jan=1, Apr=4)
        const fyNum = month >= 4 ? year + 1 : year;
        return `FY${fyNum}`;
    });

    // Track which slide is being edited
    const [editingSlide, setEditingSlide] = useState<number | string | null>(null);
    const [editedTitle, setEditedTitle] = useState(""); // For custom slide title editing
    // Track hidden slides
    const [hiddenSlides, setHiddenSlides] = useState<Set<string>>(new Set());
    const [isBulkHideExpanded, setIsBulkHideExpanded] = useState(false);

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
    const [selectedExportRegions, setSelectedExportRegions] = useState<Set<string>>(new Set());

    // Selected fiscal quarter (Q1-Q4) per Services snapshot slide preview.
    const [servicesQuarterBySlide, setServicesQuarterBySlide] = useState<Record<string, string>>({});
    const getServicesQuarter = (slideId: SlideId) => servicesQuarterBySlide[String(slideId)] ?? 'Q2';
    const setServicesQuarter = (slideId: SlideId, quarter: string) =>
        setServicesQuarterBySlide(prev => ({ ...prev, [String(slideId)]: quarter }));

    // Base slides configuration
    // Base slides configuration
    const BASE_SLIDES = [
        2, 2.5,
        3, '3_services', '3_services_q1', 4, '4_services', 5, '5_services',
        6, 6.2, '6.2_services', '3_invoice', 6.3, 6.4,
        13, '13_services', '13_services_q1', 14, '14_services', 15, '15_services',
        15.1, '15.1.1', 15.2, '15.2.1',
        '15.2.2', '15.2.2_services', '13_invoice', '15.2.3', '15.2.3_cy', '15.2.4', '15.2.5',
        7, '7_services', '7_services_q1', 8, '8_services', 9, '9_services',
        9.1, '9.1.1', 9.2, '9.2.1',
        '9.2.2', '9.2.2_services', '7_invoice', '9.2.3', '9.2.3_cy', '9.2.4', '9.2.5',
        10, '10_services', '10_services_q1', 11, '11_services', 12, '12_services',
        12.1, '12.1.1', 12.2, '12.2.1',
        '12.2.2', '12.2.2_services', '10_invoice', '12.2.3', '12.2.3_cy', '12.2.4', '12.2.5',
        28, '28_services', '28_services_q1', 29, '29_services', 30, '30_services',
        30.1, '30.1.1', 30.2, '30.2.1', 30.3, '30.3.1',
        '30.2.2', '30.2.2_services', '28_invoice', '30.2.3', '30.2.3_cy', '30.2.4', '30.2.5',
        16, '16_services', '16_services_q1', 17, '17_services', 18, '18_services',
        18.1, '18.1.1',
        '18.2.2', '18.2.2_services', '16_invoice', '18.2.3', '18.2.3_cy', '18.2.4', '18.2.5',
        19, '19_services', '19_services_q1', 20, '20_services', 21, '21_services',
        21.1, '21.1.1',
        '21.2.2', '21.2.2_services', '19_invoice', '21.2.3', '21.2.3_cy', '21.2.4', '21.2.5',
        22, '22_services', '22_services_q1', 23, '23_services', 24, '24_services',
        24.1, '24.1.1',
        '24.2.2', '24.2.2_services', '22_invoice', '24.2.3', '24.2.3_cy', '24.2.4', '24.2.5',
        25, '25_services', '25_services_q1', 26, '26_services',
        27, '27_services',
        27.1, '27.1.1', 27.2, '27.2.1',
        '27.2.2', '27.2.2_services', '25_invoice', '27.2.3', '27.2.3_cy', '27.2.4', '27.2.5'
    ];

    // Helper to determine region
    const getSlideRegion = (slideId: string | number, parentId?: string | number) => {
        let idStr = String(slideId);
        let mainId = parseInt(idStr.split('.')[0]); // Get integer part

        if (isNaN(mainId) && parentId !== undefined) {
            idStr = String(parentId);
            mainId = parseInt(idStr.split('.')[0]);
        }

        if (mainId <= 6) return 'Overall';
        if (mainId <= 9) return 'USA West';
        if (mainId <= 12) return 'Europe';
        if (mainId <= 15) return 'USA East';
        if (mainId <= 18) return 'Asean';
        if (mainId <= 21) return 'Japan';
        if (mainId <= 24) return 'Korea';
        if (mainId <= 27) return 'Legacy';
        if (mainId <= 30) return 'ROW';
        return 'Other';
    };

    // Helper to get descriptive slide titles
    const getSlideTitle = (slideId: string | number): string => {
        const idStr = String(slideId);

        // Invoice slides title
        if (idStr.endsWith('_invoice')) {
            const parentId = idStr.slice(0, -'_invoice'.length);
            return `Invoiced Amount — ${getSlideRegion(parentId)}`;
        }

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
            '9.2.3_cy': 'Gross Margin - Services (Current Year)',
            '9.2.4': 'Gross Margin - Services (Service from Start)',
            '10': 'Cumulative Performance vs Targets',
            '11': '8-Week Historical Trend',
            '12': 'Actual vs Weighted Pipeline',
            '12.2.2': 'Order Backlog',
            '12.2.3': 'Gross Margin - Manufacturing',
            '12.2.3_cy': 'Gross Margin - Services (Current Year)',
            '12.2.4': 'Gross Margin - Services (Service from Start)',
            '13': 'Cumulative Performance vs Targets',
            '14': '8-Week Historical Trend',
            '15': 'Actual vs Weighted Pipeline',
            '15.2.2': 'Order Backlog',
            '15.2.3': 'Gross Margin - Manufacturing',
            '15.2.3_cy': 'Gross Margin - Services (Current Year)',
            '15.2.4': 'Gross Margin - Services (Service from Start)',
            '16': 'Cumulative Performance vs Targets',
            '17': '8-Week Historical Trend',
            '18': 'Actual vs Weighted Pipeline',
            '18.2.2': 'Order Backlog',
            '18.2.3': 'Gross Margin - Manufacturing',
            '18.2.3_cy': 'Gross Margin - Services (Current Year)',
            '18.2.4': 'Gross Margin - Services (Service from Start)',
            '19': 'Cumulative Performance vs Targets',
            '20': '8-Week Historical Trend',
            '21': 'Actual vs Weighted Pipeline',
            '21.2.2': 'Order Backlog',
            '21.2.3': 'Gross Margin - Manufacturing',
            '21.2.3_cy': 'Gross Margin - Services (Current Year)',
            '21.2.4': 'Gross Margin - Services (Service from Start)',
            '22': 'Cumulative Performance vs Targets',
            '23': '8-Week Historical Trend',
            '24': 'Actual vs Weighted Pipeline',
            '24.2.2': 'Order Backlog',
            '24.2.3': 'Gross Margin - Manufacturing',
            '24.2.3_cy': 'Gross Margin - Services (Current Year)',
            '24.2.4': 'Gross Margin - Services (Service from Start)',
            '25': 'Cumulative Performance vs Targets',
            '26': '8-Week Historical Trend',
            '27': 'Actual vs Weighted Pipeline',
            '27.2.2': 'Order Backlog',
            '27.2.3': 'Gross Margin - Manufacturing',
            '27.2.3_cy': 'Gross Margin - Services (Current Year)',
            '27.2.4': 'Gross Margin - Services (Service from Start)',
            '28': 'Cumulative Performance vs Targets',
            '29': '8-Week Historical Trend',
            '30': 'Actual vs Weighted Pipeline',
            '30.2.2': 'Order Backlog',
            '30.2.3': 'Gross Margin - Manufacturing',
            '30.2.3_cy': 'Gross Margin - Services (Current Year)',
            '30.2.4': 'Gross Margin - Services (Service from Start)',
        };

        // For nested pipeline slides like 9.1, 9.2, etc. (Activity lists)
        // Explicit dict entries take priority; suffix checks are ordered
        // most-specific first so e.g. "15.2.1" doesn't match ".1".
        if (titles[idStr]) return titles[idStr];
        if (idStr.includes('.')) {
            if (idStr.endsWith('.2.5')) return 'Whale accounts';
            if (idStr.endsWith('.1.1')) return 'Action Points';
            if (idStr.endsWith('.2.1')) return 'New Business - Action Points';
            if (idStr.endsWith('.3.1')) return 'Action Points';
            if (idStr.endsWith('.1')) return 'Account / New Business Summary';
            if (idStr.endsWith('.2')) return 'New Business Summary';
            if (idStr.endsWith('.3')) return 'Account / New Business Summary';
        }

        return 'Activity & Details';
    };

    // Merge base slides with custom slides
    const displaySlides = useMemo<SlideItem[]>(() => {
        const result: SlideItem[] = [];
        BASE_SLIDES.forEach(sId => {
            if (!isAdmin) {
                const reg = getSlideRegion(sId);
                if (['Asean', 'Japan', 'Korea'].includes(reg)) {
                    return;
                }
            }
            // Add standard slide
            result.push({ id: sId, isCustom: false });

            // Add any custom slides attached to this parent for selected FY
            customSlides
                .filter(c => String(c.parentId) === String(sId) && (!c.fy || c.fy === selectedFY))
                .forEach(c => {
                    result.push({ id: c.id, isCustom: true, data: c });
                });
        });
        return result;
    }, [customSlides, isAdmin, selectedFY]);

    const BULK_SLIDE_CATEGORIES = useMemo(() => [
        {
            id: 'cumulative',
            name: 'Cumulative Performance Charts',
            slideIds: [
                2, 2.5, 3, '3_services', '3_services_q1',
                7, '7_services', '7_services_q1',
                10, '10_services', '10_services_q1',
                13, '13_services', '13_services_q1',
                16, '16_services', '16_services_q1',
                19, '19_services', '19_services_q1',
                22, '22_services', '22_services_q1',
                25, '25_services', '25_services_q1',
                28, '28_services', '28_services_q1'
            ]
        },
        {
            id: 'trend',
            name: '8-Week Historical Trend Charts',
            slideIds: [
                4, '4_services',
                8, '8_services',
                11, '11_services',
                14, '14_services',
                17, '17_services',
                20, '20_services',
                23, '23_services',
                26, '26_services',
                29, '29_services'
            ]
        },
        {
            id: 'pipeline',
            name: 'Actual vs Weighted Pipeline Charts',
            slideIds: [
                5, '5_services', 6,
                9, '9_services',
                12, '12_services',
                15, '15_services',
                18, '18_services',
                21, '21_services',
                24, '24_services',
                27, '27_services',
                30, '30_services'
            ]
        },
        {
            id: 'order_backlog',
            name: 'Order Backlog Charts',
            slideIds: [
                6.2, '6.2_services',
                '9.2.2', '9.2.2_services',
                '12.2.2', '12.2.2_services',
                '15.2.2', '15.2.2_services',
                '18.2.2', '18.2.2_services',
                '21.2.2', '21.2.2_services',
                '24.2.2', '24.2.2_services',
                '27.2.2', '27.2.2_services',
                '30.2.2', '30.2.2_services'
            ]
        },
        {
            id: 'invoice_trend',
            name: 'Invoiced Amount Trend Charts',
            slideIds: [
                '3_invoice', '7_invoice', '10_invoice', '13_invoice',
                '16_invoice', '19_invoice', '22_invoice', '25_invoice', '28_invoice'
            ]
        },
        {
            id: 'gross_margin',
            name: 'Gross Margin Charts & Summary',
            slideIds: [
                6.3, 6.4,
                '9.2.3', '9.2.3_cy', '9.2.4',
                '12.2.3', '12.2.3_cy', '12.2.4',
                '15.2.3', '15.2.3_cy', '15.2.4',
                '18.2.3', '18.2.3_cy', '18.2.4',
                '21.2.3', '21.2.3_cy', '21.2.4',
                '24.2.3', '24.2.3_cy', '24.2.4',
                '27.2.3', '27.2.3_cy', '27.2.4',
                '30.2.3', '30.2.3_cy', '30.2.4'
            ]
        },
        {
            id: 'activity_summary',
            name: 'Account & New Business Summaries',
            slideIds: [
                '9.1', '9.1.1', '9.2', '9.2.1',
                '12.1', '12.1.1', '12.2', '12.2.1',
                '15.1', '15.1.1', '15.2', '15.2.1',
                '18.1', '18.1.1',
                '21.1', '21.1.1',
                '24.1', '24.1.1',
                '27.1', '27.1.1', '27.2', '27.2.1',
                '30.1', '30.1.1', '30.2', '30.2.1', '30.3', '30.3.1'
            ]
        },
        {
            id: 'whales',
            name: 'Whale Account Slides',
            slideIds: [
                '9.2.5', '12.2.5', '15.2.5', '18.2.5', '21.2.5', '24.2.5', '27.2.5', '30.2.5'
            ]
        }
    ], []);

    const handleBulkVisibilityChange = async (targetIds: (string | number)[], hide: boolean) => {
        const strIds = targetIds.map(String);
        const nextHidden = new Set(hiddenSlides);
        if (hide) {
            strIds.forEach(id => nextHidden.add(id));
        } else {
            strIds.forEach(id => nextHidden.delete(id));
        }
        setHiddenSlides(nextHidden);

        try {
            await fetch('/api/admin/hidden-slides/set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slides: Array.from(nextHidden), fy: selectedFY })
            });
            showToast(hide ? `Hidden ${strIds.length} slides` : `Unhidden ${strIds.length} slides`);
        } catch (err) {
            console.error('Failed to update bulk hidden slides', err);
            showToast('Failed to update slide visibility');
        }
    };

    const handleHideAllSlides = () => {
        const allIds = displaySlides.map(s => String(s.id));
        handleBulkVisibilityChange(allIds, true);
    };

    const handleUnhideAllSlides = async () => {
        const currentlyHidden = Array.from(hiddenSlides);
        if (currentlyHidden.length === 0) {
            showToast('No slides are currently hidden');
            return;
        }
        await handleBulkVisibilityChange(currentlyHidden, false);
    };

    const REGION_CLUSTER_NAMES = useMemo(() => {
        if (isAdmin) {
            return ['USA West', 'Europe', 'ROW', 'USA East', 'Asean', 'Japan', 'Korea', 'Legacy'];
        }
        return ['USA West', 'Europe', 'ROW', 'USA East', 'Legacy'];
    }, [isAdmin]);
    const ALL_CLUSTERS = useMemo(() => ['Overall', ...REGION_CLUSTER_NAMES], [REGION_CLUSTER_NAMES]);

    const [expandedClusters, setExpandedClusters] = useState<Set<string>>(() => new Set<string>());

    const toggleCluster = (clusterName: string) => {
        setExpandedClusters(prev => {
            const next = new Set(prev);
            if (next.has(clusterName)) {
                next.delete(clusterName);
            } else {
                next.add(clusterName);
            }
            return next;
        });
    };

    const expandAllClusters = () => {
        setExpandedClusters(new Set(ALL_CLUSTERS));
    };

    const collapseAllClusters = () => {
        setExpandedClusters(new Set());
    };

    const groupedSlides = useMemo(() => {
        const groups: Record<string, { slideItem: SlideItem; slideIndex: number }[]> = {};
        ALL_CLUSTERS.forEach(c => { groups[c] = []; });

        displaySlides.forEach((slideItem, slideIndex) => {
            const reg = getSlideRegion(slideItem.id, slideItem.data?.parentId);
            if (groups[reg]) {
                groups[reg].push({ slideItem, slideIndex });
            } else {
                if (!groups['Other']) groups['Other'] = [];
                groups['Other'].push({ slideItem, slideIndex });
            }
        });
        return groups;
    }, [displaySlides, ALL_CLUSTERS]);

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
                fy={selectedFY}
            />
        );
    };

    const renderSlideGroupItems = (items: { slideItem: SlideItem; slideIndex: number }[]) => {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {items.map(({ slideItem, slideIndex }) => {
                    const slideId = slideItem.id;
                    const isCustom = slideItem.isCustom;
                    let isEditable = true;
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
                    if (!isAdmin && isHidden) {
                        return null;
                    }
                    const isHighlighted = highlightedSlides.has(String(slideId));

                    return (
                        <div
                            key={String(slideId)}
                            id={`slide-preview-${slideId}`}
                            style={{
                                paddingLeft: '1rem',
                                paddingRight: '1rem',
                                paddingTop: '1rem',
                                borderRadius: '16px',
                                transition: 'box-shadow 0.4s ease, background-color 0.4s ease',
                                boxShadow: isHighlighted ? '0 0 0 4px #f59e0b, 0 10px 24px rgba(245,158,11,0.35)' : '0 2px 8px rgba(0,0,0,0.06)',
                                backgroundColor: isHighlighted ? 'rgba(254, 243, 199, 0.55)' : '#ffffff',
                                border: '1px solid #cbd5e1'
                            }}
                        >
                            {/* Slide Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ flex: 1 }}>
                                    {isCustom && isCurrentlyEditing ? (
                                        <input
                                            value={editedTitle}
                                            onChange={(e) => setEditedTitle(e.target.value)}
                                            style={{ fontSize: '1.3rem', fontWeight: '800', fontFamily: 'inherit', border: 'none', borderBottom: '2px solid #5D9CEC', outline: 'none', width: '100%', color: '#4a4a55' }}
                                            placeholder="Enter Slide Title"
                                        />
                                    ) : (
                                        <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: (isAdmin && isHidden) ? '#9ca3af' : '#4a4a55', textDecoration: (isAdmin && isHidden) ? 'line-through' : 'none', margin: 0 }}>
                                            {isCustom ? title : `Slide ${slideId} - ${getSlideRegion(slideId)} - ${getSlideTitle(slideId)}`} {isAdmin && isHidden && <span style={{ fontSize: '0.8rem', color: '#ef4444', textDecoration: 'none', marginLeft: '0.5rem' }}>(Hidden)</span>}
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

                                    {/* Visibility Toggle (Admin Only) */}
                                    {isAdmin && (
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
                                    )}

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
                                            disabled={savingSlides.has(slideId)}
                                            style={{
                                                backgroundColor: isCurrentlyEditing ? (savingSlides.has(slideId) ? '#059669' : '#10b981') : '#93c5fd',
                                                border: 'none',
                                                padding: '0.3rem 1rem',
                                                borderRadius: '20px',
                                                fontWeight: '700',
                                                color: isCurrentlyEditing ? '#fff' : '#1e3a8a',
                                                cursor: savingSlides.has(slideId) ? 'wait' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.3rem',
                                                transition: 'all 0.2s',
                                                opacity: savingSlides.has(slideId) ? 0.85 : 1
                                            }}
                                        >
                                            {isCurrentlyEditing ? (
                                                savingSlides.has(slideId) ? (
                                                    <><Loader2 size={14} className="animate-spin" /> Saving...</>
                                                ) : (
                                                    <><CheckCircle2 size={14} /> Done</>
                                                )
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
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
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
                    gifPosition: DEFAULT_CUSTOM_GIF_POSITION,
                    fy: selectedFY
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

    const [savingSlides, setSavingSlides] = useState<Set<number | string>>(new Set());

    const handleEditToggle = async (slideId: number | string, currentTitle?: string) => {
        if (editingSlide === slideId) {
            setSavingSlides(prev => new Set(prev).add(slideId));
            
            const customSlide = customSlides.find(s => s.id === slideId);
            if (customSlide && editedTitle !== customSlide.title) {
                await updateCustomSlideTitle(String(slideId), editedTitle);
            }

            window.dispatchEvent(new CustomEvent('tracker_refresh_slides', { detail: { slideId } }));
            window.dispatchEvent(new CustomEvent('tracker_refresh_checklist'));
            
            setTimeout(() => {
                setSavingSlides(prev => {
                    const next = new Set(prev);
                    next.delete(slideId);
                    return next;
                });
                setEditingSlide(null);
                setEditedTitle("");
            }, 350);
        } else {
            setEditingSlide(slideId);
            if (currentTitle) setEditedTitle(currentTitle);
        }
    };

    useEffect(() => {
        let isCurrent = true;
        // Fetch custom slides for selected financial year
        fetch(`/api/admin/custom-slides?fy=${selectedFY}`)
            .then(res => res.json())
            .then(data => {
                if (!isCurrent) return;
                if (data.slides) {
                    setCustomSlides(data.slides.map((slide: CustomSlideData) => ({
                        ...slide,
                        gifEnabled: slide.gifEnabled ?? false,
                        gifUrl: slide.gifUrl || DEFAULT_CUSTOM_GIF_URL,
                        gifPosition: slide.gifPosition || DEFAULT_CUSTOM_GIF_POSITION
                    })));
                } else {
                    setCustomSlides([]);
                }
            })
            .catch(err => {
                if (!isCurrent) return;
                console.error(err);
            });
        return () => { isCurrent = false; };
    }, [selectedFY]);

    useEffect(() => {
        let isCurrent = true;
        // Fetch hidden slides for selected financial year
        fetch(`/api/admin/hidden-slides?fy=${selectedFY}`)
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
                console.error("Failed to fetch hidden slides", err);
            });
        return () => { isCurrent = false; };
    }, [selectedFY]);

    useEffect(() => {
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
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
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

        let exportSlides = displaySlides.filter(s => !hiddenSlides.has(String(s.id)));
        
        if (selectedExportRegions.size > 0) {
            exportSlides = exportSlides.filter(s => {
                const region = getSlideRegion(s.id);
                return selectedExportRegions.has(region);
            });
        }

        if (exportSlides.length === 0) {
            showToast('No slides in selected regions to export');
            return;
        }

        setIsExporting(true);
        let serverJobStarted = false;

        // Try server-side background PDF generation first (allows closing/switching tabs)
        try {
            showToast('Starting server-side PDF export... (You can switch tabs freely)');
            setExportProgress({ current: 0, total: exportSlides.length, title: 'Queueing server export job...' });

            const res = await fetch('/api/admin/export-pdf-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    week: currentWeek,
                    regions: selectedExportRegions.size > 0 ? Array.from(selectedExportRegions) : null,
                    frontend_url: window.location.origin,
                    fy: selectedFY
                })
            });

            if (res.ok) {
                const data = await res.json();
                const jobId = data.job_id;
                serverJobStarted = true;

                // Poll job status until complete or failed
                let finished = false;
                const pollStartedAt = Date.now();
                const pollTimeoutMs = 14 * 60 * 1000;
                let consecutiveFailures = 0;

                while (!finished && Date.now() - pollStartedAt < pollTimeoutMs) {
                    await wait(2000);

                    try {
                        const statusRes = await fetch(`/api/admin/export-pdf-status/${jobId}`);
                        if (!statusRes.ok) {
                            consecutiveFailures += 1;
                            if (consecutiveFailures >= 5) {
                                throw new Error('Unable to retrieve the server export status');
                            }
                            continue;
                        }
                        consecutiveFailures = 0;

                        const statusData = await statusRes.json();
                        const allSlidesRendered = String(statusData.message || '').startsWith('All slides rendered.');
                        setExportProgress({
                            current: typeof statusData.rendered_slides === 'number'
                                ? statusData.rendered_slides
                                : allSlidesRendered
                                    ? exportSlides.length
                                    : Math.round((statusData.progress / 100) * exportSlides.length),
                            total: typeof statusData.total_slides === 'number' && statusData.total_slides > 0
                                ? statusData.total_slides
                                : exportSlides.length,
                            title: statusData.message || 'Generating PDF on server...'
                        });

                        if (statusData.status === 'completed') {
                            finished = true;
                            // Trigger browser download
                            const link = document.createElement('a');
                            link.href = `/api/admin/export-pdf-download/${jobId}`;
                            link.download = statusData.pdf_filename || `weekly-tracker-week-${currentWeek}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            showToast('Weekly Tracker PDF downloaded!');
                            setIsExporting(false);
                            setExportProgress(null);
                            return;
                        } else if (statusData.status === 'failed') {
                            finished = true;
                            setIsExporting(false);
                            setExportProgress(null);
                            showToast(statusData.error || 'The server PDF export failed before the file could be created.');
                            return;
                        }
                    } catch (pollErr) {
                        consecutiveFailures += 1;
                        if (consecutiveFailures >= 5) {
                            throw pollErr;
                        }
                    }
                }

                setIsExporting(false);
                setExportProgress(null);
                showToast('The server export is taking longer than expected. It was not replaced with a second export.');
                return;
            }
        } catch (serverErr) {
            console.warn('Server export endpoint unavailable, using fast client export:', serverErr);
            if (serverJobStarted) {
                setIsExporting(false);
                setExportProgress(null);
                showToast('The server export status could not be reached. The export was not restarted.');
                return;
            }
        }

        // Fast Client-Side Export Fallback (Resilient to background tabs & optimized)
        showToast('Running fast client PDF export...');
        const fetchTracker = installFetchTracker();

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
                body: JSON.stringify({ slide_id: slideNum, fy: selectedFY })
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
        'ROW': [
            'apac_asean_korea_acc_mgmt', 'apac_asean_korea_acc_mgmt_actions',
            'apac_asean_korea_new_biz', 'apac_asean_korea_new_biz_actions',
            'apac_japan_acc_new_biz', 'apac_japan_acc_new_biz_actions'
        ],
        'Asean': ['asean_acc_new_biz', 'asean_acc_new_biz_actions'],
        'Japan': ['japan_acc_new_biz', 'japan_acc_new_biz_actions'],
        'Korea': ['kanz_acc_new_biz', 'kanz_acc_new_biz_actions'],
        'Legacy': ['mgmt_acc_mgmt', 'mgmt_acc_mgmt_actions', 'mgmt_new_biz', 'mgmt_new_biz_actions'],
        'Financial Team': []
    };

    // Region -> actual slide preview IDs to highlight when user clicks "View"
    const REGION_SLIDE_IDS: Record<string, string[]> = {
        'Overall': [],
        'USA West': ['9.1', '9.1.1', '9.2', '9.2.1', '9.2.5'],
        'Europe': ['12.1', '12.1.1', '12.2', '12.2.1', '12.2.5'],
        'USA East': ['15.1', '15.1.1', '15.2', '15.2.1', '15.2.5'],
        'ROW': ['30.1', '30.1.1', '30.2', '30.2.1', '30.3', '30.3.1', '30.2.5'],
        'Asean': ['18.1', '18.1.1', '18.2.5'],
        'Japan': ['21.1', '21.1.1', '21.2.5'],
        'Korea': ['24.1', '24.1.1', '24.2.5'],
        'Legacy': ['27.1', '27.1.1', '27.2', '27.2.1', '27.2.5'],
        'Financial Team': []
    };

    const [highlightedSlides, setHighlightedSlides] = useState<Set<string>>(new Set());

    const handleViewRegion = (region: string, targetSlideId?: string) => {
        const ids = REGION_SLIDE_IDS[region] || [];
        if (ids.length === 0) return;
        const slideIdToHighlight = targetSlideId || ids[0];
        setHighlightedSlides(new Set([slideIdToHighlight]));
        setExpandedClusters(prev => {
            const next = new Set(prev);
            next.add(region);
            return next;
        });
        // Scroll to the target highlighted slide
        setTimeout(() => {
            const el = document.getElementById(`slide-preview-${slideIdToHighlight}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 50);
        // Auto-clear highlight after a few seconds
        window.setTimeout(() => {
            setHighlightedSlides(new Set());
        }, 5000);
    };

    const [regionCounts, setRegionCounts] = useState<Record<string, { 
        filled: number; 
        total: number; 
        missingItems: MissingSlideItem[]; 
        whaleNames: string[];
        whaleSlideId?: string;
    }>>({});
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const handleRefresh = () => setRefreshTrigger(prev => prev + 1);
        window.addEventListener('tracker_refresh_checklist', handleRefresh);
        return () => window.removeEventListener('tracker_refresh_checklist', handleRefresh);
    }, []);

    // Human readable name for a slide input key
    const getSlideInputName = (sid: string, regionName?: string): string => {
        const prefix = regionName ? `${regionName} - ` : '';
        if (sid.includes('_whale_account_')) {
            const num = sid.split('_whale_account_')[1];
            return `${prefix}Whale Account ${num}`;
        }
        
        // Exact slide titles matching slide headers
        if (sid === 'apac_asean_korea_acc_mgmt') return 'ROW — Asean & Korea Account Summary';
        if (sid === 'apac_asean_korea_acc_mgmt_actions') return 'ROW — Asean & Korea Account Action Items';
        if (sid === 'apac_asean_korea_new_biz') return 'ROW — Asean & Korea New Business Summary';
        if (sid === 'apac_asean_korea_new_biz_actions') return 'ROW — Asean & Korea New Business Action Items';
        if (sid === 'apac_japan_acc_new_biz') return 'ROW — Japan Account / New Business Summary';
        if (sid === 'apac_japan_acc_new_biz_actions') return 'ROW — Japan Account / New Business Action Items';

        if (sid.endsWith('_acc_new_biz_actions')) return `${prefix}Account / New Business Action Items`;
        if (sid.endsWith('_acc_new_biz')) return `${prefix}Account / New Business Summary`;
        if (sid.endsWith('_acc_mgmt_actions')) return `${prefix}Account Management Action Items`;
        if (sid.endsWith('_acc_mgmt')) return `${prefix}Account Management Summary`;
        if (sid.endsWith('_new_biz_actions')) return `${prefix}New Business Action Items`;
        if (sid.endsWith('_new_biz')) return `${prefix}New Business Summary`;
        return `${prefix}${sid}`;
    };

    useEffect(() => {
        // compute pending counts for each region by fetching slide inputs for current week
        if (!currentWeek) return;

        const regions = Object.keys(REGION_SLIDES);

        const fetchForRegion = async (region: string) => {
            const slideKeys = REGION_SLIDES[region] || [];
            const slideIds = REGION_SLIDE_IDS[region] || [];
            const missingKeys: string[] = [];

            await Promise.all(slideKeys.map(async (sid) => {
                try {
                    const res = await fetch(`/api/admin/slide-inputs/${encodeURIComponent(sid)}?fy=${selectedFY}`);
                    if (!res.ok) {
                        missingKeys.push(sid);
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
                    if (!hasCurrent) missingKeys.push(sid);
                } catch (err) {
                    console.error('Failed to fetch slide inputs for', sid, err);
                    missingKeys.push(sid);
                }
            }));
            
            let whaleNames: string[] = [];
            // Whale Accounts missing items (2 required)
            if (region !== 'Overall' && region !== 'Financial Team') {
                try {
                    const wRes = await fetch(`/api/admin/whale-accounts/stats/${encodeURIComponent(region)}/${currentWeek}?fy=${selectedFY}`);
                    if (wRes.ok) {
                        const data = await wRes.json();
                        whaleNames = data.names || [];
                    }
                } catch (e) {
                    console.error("Failed to fetch whale account stats", e);
                }
            }
            
            const expectedTotal = slideKeys.length + (region !== 'Overall' && region !== 'Financial Team' ? 2 : 0);
            const whaleMissingCount = Math.max(0, 2 - whaleNames.length);

            // Preserve ordering as defined in REGION_SLIDES
            const orderedMissingItems: MissingSlideItem[] = slideKeys
                .map((key, idx) => ({
                    key,
                    name: getSlideInputName(key, region),
                    slideId: slideIds[idx] || ''
                }))
                .filter(item => missingKeys.includes(item.key));

            const whaleSlideId = slideIds.length > 0 ? slideIds[slideIds.length - 1] : undefined;
            
            return { 
                region, 
                filled: expectedTotal - orderedMissingItems.length - whaleMissingCount, 
                total: expectedTotal, 
                missingItems: orderedMissingItems, 
                whaleNames,
                whaleSlideId
            };
        };

        (async () => {
            const results = await Promise.all(regions.map(r => fetchForRegion(r)));
            const map: Record<string, { filled: number; total: number; missingItems: MissingSlideItem[]; whaleNames: string[]; whaleSlideId?: string }> = {};
            results.forEach(r => {
                if (!r) return;
                map[r.region] = { 
                    filled: r.filled, 
                    total: r.total, 
                    missingItems: r.missingItems, 
                    whaleNames: r.whaleNames,
                    whaleSlideId: r.whaleSlideId
                };
            });
            setRegionCounts(map);
        })();

    }, [currentWeek, selectedFY, refreshTrigger]);

    const isExportServer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('export_server') === 'true';

    if (isExportServer) {
        let exportSlides = displaySlides.filter(s => !hiddenSlides.has(String(s.id)));
        const startParam = new URLSearchParams(window.location.search).get('start');
        const endParam = new URLSearchParams(window.location.search).get('end');
        const regionsParam = new URLSearchParams(window.location.search).get('regions');

        if (regionsParam && regionsParam !== '' && regionsParam !== 'None') {
            const selectedRegions = new Set(regionsParam.split(','));
            exportSlides = exportSlides.filter(s => {
                const region = getSlideRegion(s.id);
                return selectedRegions.has(region);
            });
        }

        if (startParam && endParam && startParam !== '' && endParam !== '') {
            exportSlides = exportSlides.slice(Number(startParam), Number(endParam) + 1);
        }

        // Expose the total count so the export worker can capture slides one at a time.
        (window as unknown as { __WEEKLY_TRACKER_SLIDE_COUNT?: number }).__WEEKLY_TRACKER_SLIDE_COUNT = exportSlides.length;

        // Single-slide capture mode: render exactly one slide at 1920x1080.
        // The worker navigates once per slide, which keeps each page light and
        // avoids overloading the backend with 150+ simultaneous requests.
        const slideParam = new URLSearchParams(window.location.search).get('slide');
        if (slideParam !== null && slideParam !== '') {
            const slideIndex = Number(slideParam);
            const singleSlide = exportSlides[slideIndex];

            return (
                <div
                    id="export-single-slide"
                    style={{
                        width: '1920px',
                        height: '1080px',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        boxSizing: 'border-box',
                        padding: '1rem',
                        overflow: 'visible',
                        margin: 0,
                    }}
                >
                    {singleSlide ? (
                        <div style={{ width: '100%', height: '100%', maxWidth: '100%' }}>
                            {renderSlideContent(singleSlide, false)}
                        </div>
                    ) : (
                        <div data-export-empty="true" style={{ color: '#94a3b8', fontWeight: 700 }}>No slide</div>
                    )}
                    <style>{`
                        html, body { width: 1920px !important; min-height: 1080px !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; overflow-x: hidden !important; }
                        * { box-sizing: border-box; }
                    `}</style>
                </div>
            );
        }

        return (
            <div style={{ backgroundColor: '#ffffff', width: '1920px', margin: 0, padding: 0 }}>
                {exportSlides.map((slideItem) => (
                    <div
                        key={slideItem.id}
                        className="export-slide-item"
                        style={{
                            width: '1920px',
                            height: '1080px',
                            backgroundColor: '#f3f4f6',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            boxSizing: 'border-box',
                            padding: '1rem',
                            overflow: 'hidden',
                            pageBreakAfter: 'always',
                            breakAfter: 'page',
                            pageBreakInside: 'avoid',
                            breakInside: 'avoid',
                        }}
                    >
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <div style={{ width: '100%', height: '100%', maxWidth: '100%' }}>
                                {renderSlideContent(slideItem, false)}
                            </div>
                        </div>
                    </div>
                ))}
                <style>{`
                    @page {
                        size: 1920px 1080px;
                        margin: 0;
                    }
                    html, body {
                        width: 1920px !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                    * {
                        box-sizing: border-box;
                    }
                `}</style>
            </div>
        );





    }

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
                <div style={{ fontSize: '1.2rem', color: '#9ca3af', fontWeight: '600', marginBottom: '1rem' }}>
                    Current week : week {currentWeek}
                </div>
                
                {/* FY Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#4b5563' }}>
                        Financial Year:
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#e2e8f0', padding: '0.3rem', borderRadius: '10px' }}>
                        {['FY2027', 'FY2028'].map(fy => (
                            <button
                                key={fy}
                                onClick={() => setSelectedFY(fy)}
                                style={{
                                    padding: '0.5rem 1.5rem',
                                    backgroundColor: selectedFY === fy ? '#2563eb' : 'transparent',
                                    color: selectedFY === fy ? 'white' : '#475569',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '700',
                                    fontSize: '1rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: selectedFY === fy ? '0 2px 4px rgba(37,99,235,0.3)' : 'none'
                                }}
                            >
                                {fy}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Pending Input Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '5rem', maxWidth: '1200px' }}>
                {(isAdmin ? ['USA West', 'Europe', 'USA East', 'Asean', 'Japan', 'Korea', 'ROW', 'Legacy'] : ['USA West', 'Europe', 'USA East', 'ROW', 'Legacy']).map(name => {
                    const stats = regionCounts[name] || { filled: 0, total: REGION_SLIDE_IDS[name]?.length || 0, missingItems: [], whaleNames: [], whaleSlideId: undefined };
                    return (
                        <StatusCard 
                            key={name} 
                            title={name} 
                            filled={stats.filled} 
                            total={stats.total} 
                            missingItems={stats.missingItems} 
                            whaleAccounts={stats.whaleNames}
                            whaleSlideId={stats.whaleSlideId}
                            firstSlideId={REGION_SLIDE_IDS[name]?.[0]}
                            onNavigateSlide={(slideId) => handleViewRegion(name, slideId)}
                        />
                    );
                })}
            </div>

            {/* PPT Section */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: '700', color: '#9ca3af', margin: 0 }}>
                        PPT Section
                    </h2>
                    {availableWeeks.length > 0 && (
                        <select
                            value={currentWeek || ''}
                            onChange={(e) => setSelectedWeek(Number(e.target.value))}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '1.2rem',
                                borderRadius: '8px',
                                border: '2px solid #5D9CEC',
                                backgroundColor: '#f8fafc',
                                color: '#334155',
                                fontWeight: '600',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            {availableWeeks.map(w => (
                                <option key={w} value={w}>Week {w}</option>
                            ))}
                        </select>
                    )}
                    {/* FY Switcher in PPT Section header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#e2e8f0', padding: '0.25rem', borderRadius: '8px', marginLeft: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#475569', paddingLeft: '0.5rem' }}>FY:</span>
                        {['FY2027', 'FY2028'].map(fy => (
                            <button
                                key={fy}
                                onClick={() => setSelectedFY(fy)}
                                style={{
                                    padding: '0.4rem 1rem',
                                    backgroundColor: selectedFY === fy ? '#2563eb' : 'transparent',
                                    color: selectedFY === fy ? 'white' : '#475569',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: '700',
                                    fontSize: '0.95rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: selectedFY === fy ? '0 2px 4px rgba(37,99,235,0.3)' : 'none'
                                }}
                            >
                                {fy}
                            </button>
                        ))}
                    </div>
                </div>
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

                    {isAdmin && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '600px' }}>
                            <div style={{ color: '#0f766e', fontSize: '1rem', fontWeight: '800', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                                Export PDF by Region
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: '600', marginBottom: '0.25rem' }}>
                                Select regions to include (leave all unchecked to export all slides)
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.75rem', marginBottom: '0.5rem' }}>
                                {ALL_CLUSTERS.map(region => {
                                    const checked = selectedExportRegions.has(region);
                                    return (
                                        <label
                                            key={region}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                padding: '0.3rem 0.75rem',
                                                borderRadius: '9999px',
                                                border: `2px solid ${checked ? '#0f766e' : '#cbd5e1'}`,
                                                backgroundColor: checked ? '#f0fdf4' : '#f8fafc',
                                                color: checked ? '#0f766e' : '#475569',
                                                fontWeight: '700',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    setSelectedExportRegions(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(region)) {
                                                            next.delete(region);
                                                        } else {
                                                            next.add(region);
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                style={{ accentColor: '#0f766e', width: '14px', height: '14px', cursor: 'pointer' }}
                                            />
                                            {region}
                                        </label>
                                    );
                                })}
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
                                    boxShadow: isExporting || exportingImageSlideId !== null ? 'none' : '0 4px 6px rgba(15, 118, 110, 0.35)',
                                    width: 'fit-content',
                                }}
                            >
                                {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                                {isExporting ? 'Exporting PDF...' : 'Export PDF'}
                            </button>
                            <div style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: '600', minHeight: '1.5rem' }}>
                                {exportProgress
                                    ? `Exporting ${exportProgress.current}/${exportProgress.total}: ${exportProgress.title}`
                                    : selectedExportRegions.size > 0
                                        ? `Will export: ${Array.from(selectedExportRegions).join(', ')}`
                                        : 'All regions selected (full export)'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bulk Hide / Unhide Controls Panel (Admin Only) */}
            {isAdmin && (
                <div style={{
                    marginLeft: '1rem',
                    marginBottom: '2.5rem',
                    maxWidth: '1200px',
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '2px solid #cbd5e1',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
                }}>
                    <div
                        onClick={() => setIsBulkHideExpanded(prev => !prev)}
                        style={{
                            padding: '1.15rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            cursor: 'pointer',
                            backgroundColor: isBulkHideExpanded ? '#f8fafc' : '#ffffff',
                            borderBottom: isBulkHideExpanded ? '1px solid #e2e8f0' : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <EyeOff size={20} color="#475569" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    Bulk Hide / Unhide Section
                                </h3>
                                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem', color: '#64748b', fontWeight: '500' }}>
                                    Hide or unhide specific slide categories in bulk before exporting PDF or viewing presentation.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span style={{
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                color: hiddenSlides.size > 0 ? '#dc2626' : '#16a34a',
                                backgroundColor: hiddenSlides.size > 0 ? '#fee2e2' : '#dcfce7',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '12px'
                            }}>
                                {hiddenSlides.size > 0 ? `${hiddenSlides.size} slides hidden` : 'All slides visible'}
                            </span>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleHideAllSlides();
                                }}
                                style={{
                                    backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5',
                                    padding: '0.4rem 0.85rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem'
                                }}
                                title="Hide all slides in presentation"
                            >
                                <EyeOff size={14} /> Hide All
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnhideAllSlides();
                                }}
                                style={{
                                    backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac',
                                    padding: '0.4rem 0.85rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem'
                                }}
                                title="Unhide all slides in presentation"
                            >
                                <Eye size={14} /> Unhide All
                            </button>

                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.3rem',
                                color: '#475569', fontWeight: '700', fontSize: '0.82rem',
                                marginLeft: '0.35rem', padding: '0.35rem 0.65rem', borderRadius: '8px',
                                backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1'
                            }}>
                                {isBulkHideExpanded ? (
                                    <>Collapse <ChevronDown size={16} style={{ transform: 'rotate(180deg)', transition: 'transform 0.2s' }} /></>
                                ) : (
                                    <>Expand <ChevronDown size={16} style={{ transition: 'transform 0.2s' }} /></>
                                )}
                            </div>
                        </div>
                    </div>

                    {isBulkHideExpanded && (
                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ fontSize: '0.92rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Layers size={17} color="#475569" /> By Slide Topic / Category
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                gap: '1rem'
                            }}>
                                {BULK_SLIDE_CATEGORIES.map(cat => {
                                    const strIds = cat.slideIds.map(String);
                                    const hiddenCount = strIds.filter(id => hiddenSlides.has(id)).length;
                                    const isAllHidden = strIds.length > 0 && hiddenCount === strIds.length;
                                    const isNoneHidden = hiddenCount === 0;

                                    return (
                                        <div
                                            key={cat.id}
                                            style={{
                                                backgroundColor: '#f8fafc',
                                                borderRadius: '12px',
                                                border: '1px solid #cbd5e1',
                                                padding: '1rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                gap: '0.75rem'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.25rem' }}>
                                                    {cat.name}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: hiddenCount > 0 ? '#dc2626' : '#16a34a' }}>
                                                    {hiddenCount} of {strIds.length} hidden
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                <button
                                                    onClick={() => handleBulkVisibilityChange(cat.slideIds, true)}
                                                    disabled={isAllHidden}
                                                    style={{
                                                        flex: 1,
                                                        backgroundColor: isAllHidden ? '#e2e8f0' : '#fee2e2',
                                                        color: isAllHidden ? '#94a3b8' : '#b91c1c',
                                                        border: 'none',
                                                        padding: '0.35rem 0.6rem',
                                                        borderRadius: '6px',
                                                        fontWeight: '700',
                                                        fontSize: '0.78rem',
                                                        cursor: isAllHidden ? 'default' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.25rem'
                                                    }}
                                                >
                                                    <EyeOff size={13} /> Hide Group
                                                </button>
                                                <button
                                                    onClick={() => handleBulkVisibilityChange(cat.slideIds, false)}
                                                    disabled={isNoneHidden}
                                                    style={{
                                                        flex: 1,
                                                        backgroundColor: isNoneHidden ? '#e2e8f0' : '#dcfce7',
                                                        color: isNoneHidden ? '#94a3b8' : '#15803d',
                                                        border: 'none',
                                                        padding: '0.35rem 0.6rem',
                                                        borderRadius: '6px',
                                                        fontWeight: '700',
                                                        fontSize: '0.78rem',
                                                        cursor: isNoneHidden ? 'default' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.25rem'
                                                    }}
                                                >
                                                    <Eye size={13} /> Unhide Group
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Slide Clusters Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginLeft: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', maxWidth: '1200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#334155', margin: 0 }}>
                        Slide Clusters / Folders
                    </h3>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569', backgroundColor: '#e2e8f0', padding: '0.2rem 0.65rem', borderRadius: '12px' }}>
                        {displaySlides.length} Total Slides
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={expandAllClusters}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem',
                            cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        <FolderOpen size={16} color="#2563eb" /> Expand All Folders
                    </button>
                    <button
                        onClick={collapseAllClusters}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff', color: '#1e293b', fontWeight: 700, fontSize: '0.85rem',
                            cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        <Folder size={16} color="#64748b" /> Collapse All Folders
                    </button>
                </div>
            </div>

            {/* 1. OVERALL CLUSTER (Featured Top Container) */}
            {groupedSlides['Overall'] && groupedSlides['Overall'].length > 0 && (
                <div
                    id="cluster-folder-Overall"
                    style={{
                        marginLeft: '1rem',
                        marginBottom: '2.5rem',
                        maxWidth: '1200px',
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        border: '2px solid #3b82f6',
                        boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.15)',
                        overflow: 'hidden'
                    }}
                >
                    <div
                        onClick={() => toggleCluster('Overall')}
                        style={{
                            padding: '1.25rem 1.5rem',
                            backgroundColor: '#eff6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            borderBottom: expandedClusters.has('Overall') ? '1px solid #bfdbfe' : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {expandedClusters.has('Overall') ? <FolderOpen size={28} color="#2563eb" /> : <Folder size={28} color="#2563eb" />}
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#1e3a8a' }}>
                                    Overall Presentation Cluster
                                </h3>
                                <span style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>
                                    Executive Summary & Global Performance
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <span style={{
                                backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.85rem',
                                fontWeight: 700, padding: '0.25rem 0.75rem', borderRadius: '9999px'
                            }}>
                                {isAdmin ? `${groupedSlides['Overall'].length} Slides` : `${(groupedSlides['Overall'] || []).filter(s => !hiddenSlides.has(String(s.slideItem.id))).length} Slides`}
                            </span>
                            {isAdmin && (() => {
                                const overallSlideIds = (groupedSlides['Overall'] || []).map(s => String(s.slideItem.id));
                                const overallHiddenCount = overallSlideIds.filter(id => hiddenSlides.has(id)).length;
                                const isOverallAllHidden = overallSlideIds.length > 0 && overallHiddenCount === overallSlideIds.length;
                                const isOverallNoneHidden = overallHiddenCount === 0;

                                return (
                                    <>
                                        {overallHiddenCount > 0 && (
                                            <span style={{
                                                backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '0.78rem',
                                                fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '12px'
                                            }}>
                                                {overallHiddenCount === overallSlideIds.length ? 'All Hidden' : `${overallHiddenCount} hidden`}
                                            </span>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleBulkVisibilityChange(overallSlideIds, true);
                                            }}
                                            disabled={isOverallAllHidden}
                                            style={{
                                                backgroundColor: isOverallAllHidden ? '#e2e8f0' : '#fee2e2',
                                                color: isOverallAllHidden ? '#94a3b8' : '#b91c1c',
                                                border: `1px solid ${isOverallAllHidden ? '#cbd5e1' : '#fca5a5'}`,
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '20px',
                                                fontWeight: 700,
                                                fontSize: '0.78rem',
                                                cursor: isOverallAllHidden ? 'default' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                transition: 'all 0.15s'
                                            }}
                                            title="Hide all slides in Overall cluster"
                                        >
                                            <EyeOff size={13} /> Hide Overall
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleBulkVisibilityChange(overallSlideIds, false);
                                            }}
                                            disabled={isOverallNoneHidden}
                                            style={{
                                                backgroundColor: isOverallNoneHidden ? '#e2e8f0' : '#dcfce7',
                                                color: isOverallNoneHidden ? '#94a3b8' : '#15803d',
                                                border: `1px solid ${isOverallNoneHidden ? '#cbd5e1' : '#86efac'}`,
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '20px',
                                                fontWeight: 700,
                                                fontSize: '0.78rem',
                                                cursor: isOverallNoneHidden ? 'default' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                transition: 'all 0.15s'
                                            }}
                                            title="Unhide all slides in Overall cluster"
                                        >
                                            <Eye size={13} /> Unhide
                                        </button>
                                    </>
                                );
                            })()}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const firstIdx = groupedSlides['Overall'][0]?.slideIndex ?? 0;
                                    handleStartSlideshow(firstIdx);
                                }}
                                style={{
                                    backgroundColor: '#1d4ed8', color: 'white', border: 'none',
                                    padding: '0.4rem 0.9rem', borderRadius: '20px', fontWeight: 700,
                                    fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem'
                                }}
                            >
                                <Play size={12} fill="currentColor" /> Play Cluster
                            </button>
                            {expandedClusters.has('Overall') ? <ChevronDown size={22} color="#1e3a8a" /> : <ChevronRight size={22} color="#1e3a8a" />}
                        </div>
                    </div>

                    {expandedClusters.has('Overall') && (
                        <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc' }}>
                            {renderSlideGroupItems(groupedSlides['Overall'])}
                        </div>
                    )}
                </div>
            )}

            {/* 2. REGIONAL CLUSTERS (4 IN A ROW GRID) */}
            <div style={{ marginLeft: '1rem', marginBottom: '3rem', maxWidth: '1200px' }}>
                <div style={{ color: '#475569', fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                    Regional Clusters
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: '1.25rem'
                }}>
                    {REGION_CLUSTER_NAMES.map((regName) => {
                        const slides = groupedSlides[regName] || [];
                        const isExpanded = expandedClusters.has(regName);
                        const firstIdx = slides[0]?.slideIndex;
                        const slideIds = slides.map(s => String(s.slideItem.id));
                        const hiddenCount = slideIds.filter(id => hiddenSlides.has(id)).length;
                        const isAllHidden = slideIds.length > 0 && hiddenCount === slideIds.length;
                        const isNoneHidden = hiddenCount === 0;

                        return (
                            <div
                                key={regName}
                                id={`cluster-folder-${regName}`}
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '14px',
                                    border: isExpanded ? '2px solid #8b5cf6' : '1px solid #cbd5e1',
                                    boxShadow: isExpanded ? '0 10px 20px -5px rgba(139, 92, 246, 0.2)' : '0 2px 4px rgba(0,0,0,0.04)',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <div
                                    onClick={() => toggleCluster(regName)}
                                    style={{
                                        padding: '1.1rem',
                                        cursor: 'pointer',
                                        backgroundColor: isExpanded ? '#f5f3ff' : '#ffffff'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {isExpanded ? <FolderOpen size={24} color="#7c3aed" /> : <Folder size={24} color="#6b7280" />}
                                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: isExpanded ? '#5b21b6' : '#1e293b' }}>
                                                {regName}
                                            </h4>
                                        </div>
                                        {isExpanded ? <ChevronDown size={18} color="#7c3aed" /> : <ChevronRight size={18} color="#9ca3af" />}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <span style={{
                                                backgroundColor: isExpanded ? '#ddd6fe' : '#f1f5f9',
                                                color: isExpanded ? '#5b21b6' : '#475569',
                                                fontSize: '0.78rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '12px'
                                            }}>
                                                {isAdmin ? `${slides.length} Slides` : `${slides.filter(s => !hiddenSlides.has(String(s.slideItem.id))).length} Slides`}
                                            </span>
                                            {isAdmin && hiddenCount > 0 && (
                                                <span style={{
                                                    backgroundColor: '#fee2e2',
                                                    color: '#dc2626',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    padding: '0.15rem 0.45rem',
                                                    borderRadius: '10px'
                                                }}>
                                                    {hiddenCount === slides.length ? 'All Hidden' : `${hiddenCount} hidden`}
                                                </span>
                                            )}
                                        </div>
                                        {firstIdx !== undefined && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartSlideshow(firstIdx);
                                                }}
                                                style={{
                                                    backgroundColor: '#7c3aed', color: 'white', border: 'none',
                                                    padding: '0.25rem 0.65rem', borderRadius: '14px', fontWeight: 700,
                                                    fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem'
                                                }}
                                            >
                                                <Play size={10} fill="currentColor" /> Play
                                            </button>
                                        )}
                                    </div>

                                    {/* Region Cluster Visibility Controls (Admin Only) */}
                                    {isAdmin && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            marginTop: '0.65rem',
                                            paddingTop: '0.5rem',
                                            borderTop: isExpanded ? '1px solid #e9d5ff' : '1px solid #f1f5f9'
                                        }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleBulkVisibilityChange(slideIds, true);
                                                }}
                                                disabled={isAllHidden || slideIds.length === 0}
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: isAllHidden ? '#f1f5f9' : '#fee2e2',
                                                    color: isAllHidden ? '#94a3b8' : '#b91c1c',
                                                    border: `1px solid ${isAllHidden ? '#e2e8f0' : '#fca5a5'}`,
                                                    padding: '0.28rem 0.4rem',
                                                    borderRadius: '6px',
                                                    fontWeight: 700,
                                                    fontSize: '0.74rem',
                                                    cursor: (isAllHidden || slideIds.length === 0) ? 'default' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.25rem',
                                                    transition: 'all 0.15s'
                                                }}
                                                title={`Hide all ${slides.length} slides in ${regName}`}
                                            >
                                                <EyeOff size={12} /> Hide Region
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleBulkVisibilityChange(slideIds, false);
                                                }}
                                                disabled={isNoneHidden || slideIds.length === 0}
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: isNoneHidden ? '#f1f5f9' : '#dcfce7',
                                                    color: isNoneHidden ? '#94a3b8' : '#15803d',
                                                    border: `1px solid ${isNoneHidden ? '#e2e8f0' : '#86efac'}`,
                                                    padding: '0.28rem 0.4rem',
                                                    borderRadius: '6px',
                                                    fontWeight: 700,
                                                    fontSize: '0.74rem',
                                                    cursor: (isNoneHidden || slideIds.length === 0) ? 'default' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.25rem',
                                                    transition: 'all 0.15s'
                                                }}
                                                title={`Unhide all ${slides.length} slides in ${regName}`}
                                            >
                                                <Eye size={12} /> Unhide
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Expanded Slide Containers below 4-in-a-row grid */}
                {REGION_CLUSTER_NAMES.map((regName) => {
                    const slides = groupedSlides[regName] || [];
                    const isExpanded = expandedClusters.has(regName);
                    if (!isExpanded || slides.length === 0) return null;

                    const slideIds = slides.map(s => String(s.slideItem.id));
                    const hiddenCount = slideIds.filter(id => hiddenSlides.has(id)).length;
                    const isAllHidden = slideIds.length > 0 && hiddenCount === slideIds.length;
                    const isNoneHidden = hiddenCount === 0;

                    return (
                        <div
                            key={`expanded-slides-${regName}`}
                            style={{
                                marginTop: '1.5rem',
                                marginBottom: '2.5rem',
                                backgroundColor: '#fcfaff',
                                borderRadius: '16px',
                                border: '2px solid #a78bfa',
                                padding: '1.5rem',
                                boxShadow: '0 8px 20px rgba(167, 139, 250, 0.15)'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #ddd6fe', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <FolderOpen size={22} color="#7c3aed" />
                                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#5b21b6' }}>
                                        {regName} Cluster Slides ({isAdmin ? slides.length : slides.filter(s => !hiddenSlides.has(String(s.slideItem.id))).length})
                                    </h3>
                                    {isAdmin && hiddenCount > 0 && (
                                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#dc2626', backgroundColor: '#fee2e2', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                                            {hiddenCount === slides.length ? 'All slides hidden' : `${hiddenCount} of ${slides.length} hidden`}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {isAdmin && (
                                        <>
                                            <button
                                                onClick={() => handleBulkVisibilityChange(slideIds, true)}
                                                disabled={isAllHidden}
                                                style={{
                                                    backgroundColor: isAllHidden ? '#f1f5f9' : '#fee2e2',
                                                    color: isAllHidden ? '#94a3b8' : '#b91c1c',
                                                    border: `1px solid ${isAllHidden ? '#e2e8f0' : '#fca5a5'}`,
                                                    padding: '0.35rem 0.8rem',
                                                    borderRadius: '8px',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    cursor: isAllHidden ? 'default' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    transition: 'all 0.15s'
                                                }}
                                                title={`Hide all slides in ${regName} cluster`}
                                            >
                                                <EyeOff size={14} /> Hide Region Cluster
                                            </button>
                                            <button
                                                onClick={() => handleBulkVisibilityChange(slideIds, false)}
                                                disabled={isNoneHidden}
                                                style={{
                                                    backgroundColor: isNoneHidden ? '#f1f5f9' : '#dcfce7',
                                                    color: isNoneHidden ? '#94a3b8' : '#15803d',
                                                    border: `1px solid ${isNoneHidden ? '#e2e8f0' : '#86efac'}`,
                                                    padding: '0.35rem 0.8rem',
                                                    borderRadius: '8px',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    cursor: isNoneHidden ? 'default' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    transition: 'all 0.15s'
                                                }}
                                                title={`Unhide all slides in ${regName} cluster`}
                                            >
                                                <Eye size={14} /> Unhide Region Cluster
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => toggleCluster(regName)}
                                        style={{
                                            backgroundColor: '#ede9fe', border: 'none', padding: '0.35rem 0.8rem',
                                            borderRadius: '8px', color: '#6d28d9', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer'
                                        }}
                                    >
                                        Close Folder
                                    </button>
                                </div>
                            </div>
                            {renderSlideGroupItems(slides)}
                        </div>
                    );
                })}
            </div>

            {/* AI Agent Chatbot Section (Admin Preview Only) */}
            {isAdmin && <AiChatbot currentWeek={currentWeek} fy={selectedFY} />}

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
                <div style={{ position: 'fixed', left: 0, top: 0, width: `${EXPORT_SLIDE_WIDTH}px`, height: `${EXPORT_SLIDE_HEIGHT}px`, pointerEvents: 'none', overflow: 'hidden', backgroundColor: '#ffffff', zIndex: -9999, transform: 'translateX(-10000px)' }}>
                    <div
                        ref={exportContainerRef}
                        style={{ width: `${EXPORT_SLIDE_WIDTH}px`, minWidth: `${EXPORT_SLIDE_WIDTH}px`, maxWidth: `${EXPORT_SLIDE_WIDTH}px`, height: `${EXPORT_SLIDE_HEIGHT}px`, minHeight: `${EXPORT_SLIDE_HEIGHT}px`, maxHeight: `${EXPORT_SLIDE_HEIGHT}px`, backgroundColor: '#ffffff', overflow: 'hidden', position: 'relative' }}
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
