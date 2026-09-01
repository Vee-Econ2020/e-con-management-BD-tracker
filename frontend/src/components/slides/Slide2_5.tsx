import { useEffect, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Text, Line, OrbitControls, useCursor, Billboard } from '@react-three/drei';
import * as THREE from 'three';

// --- Data Interfaces ---
interface PieChartData {
    week: number;
    target: number;
    deficit: number;
    po: number;
    pipeline: number;
    total: number;
    achievement_pct: number;
}

interface Slide2Data {
    current_week: number;
    previous_week: number;
    base_target: number;
    stretch_target: number;
    prev_week_base: PieChartData;
    current_week_base: PieChartData;
    current_week_stretch: PieChartData;
    error?: string;
}

// --- 3D Pie Slice Component ---
function PieSlice({
    startAngle,
    endAngle,
    color,
    innerRadius = 0, // 0 for solid Pie Chart
    outerRadius = 3.5,
    height = 0.5,
    label,
    value,
    percentage,
    index
}: {
    startAngle: number;
    endAngle: number;
    color: string;
    innerRadius?: number;
    outerRadius?: number;
    height?: number;
    label: string;
    value: number;
    percentage: number;
    index: number;
}) {
    const [hovered, setHover] = useState(false);
    useCursor(hovered);

    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        shape.absarc(0, 0, outerRadius, startAngle, endAngle, false);

        if (innerRadius > 0) {
            const hole = new THREE.Path();
            hole.absarc(0, 0, innerRadius, endAngle, startAngle, true);
            shape.holes.push(hole);
        } else {
            shape.lineTo(0, 0);
        }

        return new THREE.ExtrudeGeometry(shape, {
            depth: height,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.05,
            bevelSegments: 12,
            curveSegments: 64
        });
    }, [startAngle, endAngle, innerRadius, outerRadius, height]);

    const midAngle = (startAngle + endAngle) / 2;
    const anchorRadius = innerRadius > 0 ? (innerRadius + outerRadius) / 2 : outerRadius * 0.65;

    const anchorX = Math.cos(midAngle) * anchorRadius;
    const anchorY = Math.sin(midAngle) * anchorRadius;

    // --- LINE DIRECTION LOGIC ---
    const isDeficit = index === 0;

    // Lengths - Reduced Deficit length to 2.0 to avoid overlap
    const lineLength = isDeficit ? 2.0 : 3.0;

    const startZ = isDeficit ? 0 : height;
    const endZ = isDeficit ? -lineLength : (height + lineLength);

    const showLabel = percentage > 0.1;

    return (
        <group>
            <mesh
                geometry={geometry}
                onPointerOver={() => setHover(true)}
                onPointerOut={() => setHover(false)}
                position={[0, 0, hovered ? 0.2 : 0]}
            >
                <meshPhongMaterial
                    color={color}
                    specular="#666666"
                    shininess={60}
                />
            </mesh>

            {showLabel && (
                <group>
                    <Line
                        points={[[anchorX, anchorY, startZ], [anchorX, anchorY, endZ]]}
                        color={color}
                        lineWidth={2}
                        opacity={0.8}
                        transparent
                    />

                    <Billboard position={[anchorX, anchorY, endZ + (isDeficit ? -0.8 : 0.8)]}>
                        <group>
                            <Text
                                position={[0, 0.45, 0]}
                                fontSize={0.4}
                                fontWeight={800}
                                color="#1f2937"
                                anchorX="center"
                                anchorY="bottom"
                                outlineWidth={0.02}
                                outlineColor="#ffffff"
                            >
                                {label}
                            </Text>

                            <Text
                                position={[0, 0, 0]}
                                fontSize={0.35}
                                fontWeight={600}
                                color="#4b5563"
                                anchorX="center"
                                anchorY="middle"
                            >
                                {`$${(value / 1e6).toFixed(1)}M`}
                            </Text>

                            <Text
                                position={[0, -0.45, 0]}
                                fontSize={0.5}
                                fontWeight={900}
                                color={color}
                                anchorX="center"
                                anchorY="top"
                                outlineWidth={0.025}
                                outlineColor="#ffffff"
                            >
                                {`${percentage.toFixed(0)}%`}
                            </Text>
                        </group>
                    </Billboard>
                </group>
            )}
        </group>
    );
}

// --- 3D Scene Wrapper ---
function IsometricPieChart({
    data,
    labels,
    colors
}: {
    data: number[];
    labels: string[];
    colors: string[];
}) {
    const total = data.reduce((a, b) => a + b, 0);
    let currentAngle = -Math.PI / 1.5;

    return (
        <group rotation={[-Math.PI / 3, 0, 0]}>
            {data.map((value, idx) => {
                if (value <= 0) return null;
                const percentage = (value / total) * 100;
                const angleSpan = (value / total) * Math.PI * 2;
                const startAngle = currentAngle;
                const endAngle = currentAngle + angleSpan;
                currentAngle += angleSpan;

                return (
                    <PieSlice
                        key={idx}
                        index={idx}
                        startAngle={startAngle}
                        endAngle={endAngle}
                        color={colors[idx]}
                        label={labels[idx]}
                        value={value}
                        percentage={percentage}
                    />
                );
            })}
        </group>
    );
}

export default function Slide2_5({ fy = "FY2027" }: { fy?: string }) {
    const [data, setData] = useState<Slide2Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSlideData();
    }, [fy]);

    const fetchSlideData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/slides/slide2?fy=${fy}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
        } catch (err) {
            console.error('Failed to fetch slide 2 data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex bg-white h-full items-center justify-center">Loading 3D Visuals...</div>;
    if (error || !data) return <div className="flex bg-red-50 h-full items-center justify-center text-red-700">{error}</div>;

    // Labels/colors for deficit vs surplus per chart
    const baseLabels = ['Deficit', 'PO', 'Pipeline'];
    const baseColors = ['#9ca3af', '#1d4ed8', '#d97706'];
    const surplusLabels = ['Surplus', 'PO', 'Pipeline'];
    const surplusColors = ['#16a34a', '#1d4ed8', '#d97706'];

    return (
        <div style={{ width: '100%', height: '100%', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            {/* Title */}
            <div style={{ textAlign: 'center', padding: '1.5rem', marginBottom: '1rem' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#1f2937', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>{fy} - Target Achievement Breakdown
                </h1>
            </div>

            {/* Charts Row */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '3rem' }}>

                {/* Chart 1 */}
                {/* FLEX COLUMN LAYOUT: Text flows below Canvas naturally */}
                <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1 }}>
                        <Canvas gl={{ preserveDrawingBuffer: true, antialias: true }} orthographic camera={{ zoom: 35, position: [0, 0, 100] }}>
                            <ambientLight intensity={1.8} />
                            <directionalLight position={[-10, 20, 10]} intensity={2.5} />
                            <pointLight position={[10, 10, 10]} intensity={1.5} />

                            <IsometricPieChart
                                data={[Math.abs(data.prev_week_base.deficit), data.prev_week_base.po, data.prev_week_base.pipeline]}
                                labels={data.prev_week_base.deficit < 0 ? surplusLabels : baseLabels}
                                colors={data.prev_week_base.deficit < 0 ? surplusColors : baseColors}
                            />
                            <OrbitControls enableZoom={false} enablePan={false} />
                        </Canvas>
                    </div>
                    {/* Natural data label block (no absolute positioning) */}
                    <div style={{ width: '100%', textAlign: 'center', marginBottom: '1rem' }}>
                        <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#4b5563', marginBottom: '0.2rem' }}>
                            Week {data.previous_week} Base
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111827' }}>
                            ${(data.prev_week_base.target / 1e6).toFixed(1)} M
                        </div>
                    </div>
                </div>

                {/* Chart 2 */}
                <div style={{ flex: 1.2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1 }}>
                        <Canvas gl={{ preserveDrawingBuffer: true, antialias: true }} orthographic camera={{ zoom: 45, position: [0, 0, 100] }}>
                            <ambientLight intensity={1.8} />
                            <directionalLight position={[-10, 20, 10]} intensity={2.5} />
                            <pointLight position={[10, 10, 10]} intensity={1.5} />

                            <IsometricPieChart
                                data={[Math.abs(data.current_week_base.deficit), data.current_week_base.po, data.current_week_base.pipeline]}
                                labels={data.current_week_base.deficit < 0 ? surplusLabels : baseLabels}
                                colors={data.current_week_base.deficit < 0 ? surplusColors : baseColors}
                            />
                            <OrbitControls enableZoom={false} enablePan={false} />
                        </Canvas>
                    </div>
                    <div style={{ width: '100%', textAlign: 'center', marginBottom: '1rem' }}>
                        <div style={{ fontWeight: '700', fontSize: '1.4rem', color: '#4b5563', marginBottom: '0.2rem' }}>
                            Week {data.current_week} Base Target
                        </div>
                        <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#111827' }}>
                            ${(data.base_target / 1e6).toFixed(1)} M
                        </div>
                    </div>
                </div>

                {/* Chart 3 */}
                <div style={{ flex: 1.2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1 }}>
                        <Canvas gl={{ preserveDrawingBuffer: true, antialias: true }} orthographic camera={{ zoom: 45, position: [0, 0, 100] }}>
                            <ambientLight intensity={1.8} />
                            <directionalLight position={[-10, 20, 10]} intensity={2.5} />
                            <pointLight position={[10, 10, 10]} intensity={1.5} />

                            <IsometricPieChart
                                data={[Math.abs(data.current_week_stretch.deficit), data.current_week_stretch.po, data.current_week_stretch.pipeline]}
                                labels={data.current_week_stretch.deficit < 0 ? surplusLabels : baseLabels}
                                colors={data.current_week_stretch.deficit < 0 ? surplusColors : baseColors}
                            />
                            <OrbitControls enableZoom={false} enablePan={false} />
                        </Canvas>
                    </div>
                    <div style={{ width: '100%', textAlign: 'center', marginBottom: '1rem' }}>
                        <div style={{ fontWeight: '700', fontSize: '1.4rem', color: '#4b5563', marginBottom: '0.2rem' }}>
                            Week {data.current_week} Stretch Target
                        </div>
                        <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#111827' }}>
                            ${(data.stretch_target / 1e6).toFixed(1)} M
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
