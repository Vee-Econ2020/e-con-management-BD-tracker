
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ParticleEarth = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // --- Configuration ---
        const CONFIG = {
            particleCount: 13000,
            particleSize: 0.1,
            globeRadius: 7,
            cycleDuration: 10,
            baseColor: new THREE.Color('#4b5563'),
            rotationSpeed: 0.15,
            rotationOffset: 5,
            mapUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg'
        };

        // --- Scene Setup ---
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;

        const scene = new THREE.Scene();
        // scene.fog = new THREE.FogExp2(0xffffff, 0.02); // White fog if needed, but maybe clear is better

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        camera.position.x = 0;
        camera.position.z = 18;   // Zoom out slightly to ensure full sphere visibility vertically
        camera.position.y = 0;
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mountRef.current.appendChild(renderer.domElement);

        // --- Logic ---
        const mapCanvas = document.createElement('canvas');
        const mapCtx = mapCanvas.getContext('2d', { willReadFrequently: true });
        let particles: THREE.Points;

        const isLand = (lat: number, lon: number, imgData: ImageData | null) => {
            if (imgData) {
                const x = (lon + 180) / 360;
                const y = (90 - lat) / 180;
                const pixelX = Math.floor(x * imgData.width);
                const pixelY = Math.floor(y * imgData.height);
                const index = (pixelY * imgData.width + pixelX) * 4;
                return imgData.data[index] < 50; // Dark red channel = Land in specular map
            }
            // Fallback
            if (lat > 15 && lat < 75 && lon > -165 && lon < -50) return true;
            if (lat > -55 && lat < 12 && lon > -85 && lon < -32) return true;
            if (lat > 35 && lat < 70 && lon > -10 && lon < 45) return true;
            if (lat > -35 && lat < 36 && lon > -18 && lon < 52) return true;
            if (lat > 5 && lat < 75 && lon > 45 && lon < 180) return true;
            if (lat > -40 && lat < -10 && lon > 110 && lon < 155) return true;
            return false;
        };

        const initParticles = (imgData: ImageData | null) => {
            const geometry = new THREE.BufferGeometry();
            const positions: number[] = [];
            const basePositions: number[] = [];
            const colors: number[] = [];
            const randomOffsets: number[] = [];

            let particlesFound = 0;
            let attempts = 0;
            const maxAttempts = CONFIG.particleCount * 40;

            while (particlesFound < CONFIG.particleCount && attempts < maxAttempts) {
                attempts++;
                const phi = Math.acos(-1 + (2 * Math.random()));
                const theta = Math.sqrt(CONFIG.particleCount * Math.PI) * phi;
                const lat = 90 - (phi * 180 / Math.PI);
                let lon = (theta * 180 / Math.PI) % 360;
                if (lon > 180) lon -= 360;

                if (isLand(lat, lon, imgData)) {
                    const r = CONFIG.globeRadius;
                    const y = r * Math.cos(phi);
                    const x = r * Math.sin(phi) * Math.sin(theta);
                    const z = r * Math.sin(phi) * Math.cos(theta);

                    basePositions.push(x, y, z);
                    positions.push(x, y, z);

                    randomOffsets.push(
                        (Math.random() - 0.5) * 30,
                        (Math.random() - 0.5) * 30,
                        (Math.random() - 0.5) * 30
                    );

                    // Color: Consistent Grey
                    const c = CONFIG.baseColor;
                    colors.push(c.r, c.g, c.b);

                    particlesFound++;
                }
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: CONFIG.particleSize,
                vertexColors: true,
                transparent: true,
                opacity: 0,
                blending: THREE.NormalBlending, // Additive might be too bright on white BG
                depthWrite: false
            });

            particles = new THREE.Points(geometry, material);
            particles.userData = { basePositions, randomOffsets };
            scene.add(particles);
        };

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            mapCanvas.width = img.width;
            mapCanvas.height = img.height;
            mapCtx?.drawImage(img, 0, 0);
            const imgData = mapCtx?.getImageData(0, 0, img.width, img.height) || null;
            initParticles(imgData);
        };
        img.onerror = () => initParticles(null);
        img.src = CONFIG.mapUrl;

        let frameId = 0;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            if (!particles) return;

            const time = Date.now() * 0.001;
            const cycle = time % CONFIG.cycleDuration;
            const progress = cycle / CONFIG.cycleDuration;
            const pPercent = progress * 100;

            const positionsAttribute = particles.geometry.attributes.position;
            const currentPositions = positionsAttribute.array as Float32Array;
            const bases = particles.userData.basePositions;
            const offsets = particles.userData.randomOffsets;

            particles.rotation.y = CONFIG.rotationOffset + (time * CONFIG.rotationSpeed);

            if (pPercent < 20) {
                const fadeProgress = pPercent / 20;
                (particles.material as THREE.PointsMaterial).opacity = fadeProgress;
                const ease = 1 - Math.pow(1 - fadeProgress, 3);
                for (let i = 0; i < positionsAttribute.count; i++) {
                    const i3 = i * 3;
                    currentPositions[i3] = bases[i3] + offsets[i3] * (1 - ease);
                    currentPositions[i3 + 1] = bases[i3 + 1] + offsets[i3 + 1] * (1 - ease);
                    currentPositions[i3 + 2] = bases[i3 + 2] + offsets[i3 + 2] * (1 - ease);
                }
            } else if (pPercent < 80) {
                (particles.material as THREE.PointsMaterial).opacity = 1;
                for (let i = 0; i < positionsAttribute.count; i++) {
                    const i3 = i * 3;
                    currentPositions[i3] = bases[i3];
                    currentPositions[i3 + 1] = bases[i3 + 1];
                    currentPositions[i3 + 2] = bases[i3 + 2];
                }
            } else {
                const explodeProgress = (pPercent - 80) / 20;
                (particles.material as THREE.PointsMaterial).opacity = 1 - explodeProgress;
                const ease = Math.pow(explodeProgress, 3);
                for (let i = 0; i < positionsAttribute.count; i++) {
                    const i3 = i * 3;
                    currentPositions[i3] = bases[i3] + offsets[i3] * ease;
                    currentPositions[i3 + 1] = bases[i3 + 1] + offsets[i3 + 1] * ease;
                    currentPositions[i3 + 2] = bases[i3 + 2] + offsets[i3 + 2] * ease;
                }
            }
            positionsAttribute.needsUpdate = true;
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!mountRef.current) return;
            const w = mountRef.current.clientWidth;
            const h = mountRef.current.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(frameId);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            renderer.dispose();
            // Clean up THREE resources if needed
        };
    }, []);

    return <div ref={mountRef} style={{ width: '100%', height: '300px' }} />;
};

export default ParticleEarth;
