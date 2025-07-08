import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";

const PARTICLE_COUNT = 15000;
const STAR_COUNT = 6000;
const TRANSITION_DURATION = 2000;
const Y_OFFSET = 10;

const createSphere = (i: number, count: number): THREE.Vector3 => {
  const t = i / count;
  const phi = Math.acos(2 * t - 1);
  const theta = 2 * Math.PI * (i / count) * Math.sqrt(count);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta) * 30 + 40,
    Math.sin(phi) * Math.sin(theta) * 30 + Y_OFFSET,
    Math.cos(phi) * 30,
  );
};

const createSpiral = (i: number, count: number): THREE.Vector3 => {
  const t = i / count;
  const numArms = 3;
  const armIndex = i % numArms;
  const angleOffset = ((2 * Math.PI) / numArms) * armIndex;
  const angle = t ** 0.7 * 15 + angleOffset;
  const radius = t * 40;
  const height = Math.sin(t * Math.PI * 2) * 5;
  return new THREE.Vector3(
    Math.cos(angle) * radius + 40,
    Math.sin(angle) * radius + Y_OFFSET,
    height,
  );
};

const createGrid = (i: number, count: number): THREE.Vector3 => {
  const sideLength = Math.ceil(Math.cbrt(count));
  const spacing = 60 / sideLength;
  const halfGrid = ((sideLength - 1) * spacing) / 2;
  const iz = Math.floor(i / (sideLength * sideLength));
  const iy = Math.floor((i % (sideLength * sideLength)) / sideLength);
  const ix = i % sideLength;
  if (
    ix === Math.floor(sideLength / 2) &&
    iy === Math.floor(sideLength / 2) &&
    iz === Math.floor(sideLength / 2) &&
    sideLength % 2 !== 0
  ) {
    return new THREE.Vector3(
      spacing * 0.1 + 40,
      spacing * 0.1 + Y_OFFSET,
      spacing * 0.1,
    );
  }
  return new THREE.Vector3(
    ix * spacing - halfGrid + 40,
    iy * spacing - halfGrid + Y_OFFSET,
    iz * spacing - halfGrid,
  );
};

const createPyramid = (i: number, count: number): THREE.Vector3 => {
  const baseSize = 45;
  const height = 50;
  const faces = 4;
  const pointsPerFace = Math.floor(count / faces);
  const face = Math.floor(i / pointsPerFace);
  const idxInFace = i % pointsPerFace;
  const t = idxInFace / pointsPerFace;

  const pyramidYOffset = -10;

  const apex = new THREE.Vector3(40, height + pyramidYOffset, 0);
  const base = [
    new THREE.Vector3(40 - baseSize / 2, pyramidYOffset, -baseSize / 2),
    new THREE.Vector3(40 + baseSize / 2, pyramidYOffset, -baseSize / 2),
    new THREE.Vector3(40 + baseSize / 2, pyramidYOffset, baseSize / 2),
    new THREE.Vector3(40 - baseSize / 2, pyramidYOffset, baseSize / 2),
  ];

  const v0 = apex;
  const v1 = base[face];
  const v2 = base[(face + 1) % 4];

  let a = Math.random();
  let b = Math.random();
  if (a + b > 1) {
    a = 1 - a;
    b = 1 - b;
  }

  const c = 1 - a - b;

  const x = a * v0.x + b * v1.x + c * v2.x;
  const y = a * v0.y + b * v1.y + c * v2.y;
  const z = a * v0.z + b * v1.z + c * v2.z;

  return new THREE.Vector3(x, y, z);
};

const createTorus = (i: number, count: number): THREE.Vector3 => {
  const R = 30;
  const r = 10;
  const angle1 = Math.random() * Math.PI * 2;
  const angle2 = Math.random() * Math.PI * 2;
  return new THREE.Vector3(
    (R + r * Math.cos(angle2)) * Math.cos(angle1) + 40,
    (R + r * Math.cos(angle2)) * Math.sin(angle1) + Y_OFFSET,
    r * Math.sin(angle2),
  );
};

const PATTERNS = [
  createSphere,
  createSpiral,
  createPyramid,
  createGrid,
  createTorus,
];

const COLOR_PALETTES = [
  [
    new THREE.Color(0x0077ff),
    new THREE.Color(0x00aaff),
    new THREE.Color(0x44ccff),
    new THREE.Color(0x0055cc),
  ],
  [
    new THREE.Color(0x8800cc),
    new THREE.Color(0xcc00ff),
    new THREE.Color(0x660099),
    new THREE.Color(0xaa33ff),
  ],
  [
    new THREE.Color(0x00cc66),
    new THREE.Color(0x33ff99),
    new THREE.Color(0x99ff66),
    new THREE.Color(0x008844),
  ],
  [
    new THREE.Color(0xff9900),
    new THREE.Color(0xffcc33),
    new THREE.Color(0xff6600),
    new THREE.Color(0xffaa55),
  ],
  [
    new THREE.Color(0xff3399),
    new THREE.Color(0xff66aa),
    new THREE.Color(0xff0066),
    new THREE.Color(0xcc0055),
  ],
];

const Stars: React.FC = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  const [positions, colors, starInfo] = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const starInfo = new Float32Array(STAR_COUNT);
    const color = new THREE.Color();
    const starRadius = 700;
    for (let i = 0; i < STAR_COUNT; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      positions.set(
        [
          starRadius * Math.sin(phi) * Math.cos(theta),
          starRadius * Math.sin(phi) * Math.sin(theta),
          starRadius * Math.cos(phi),
        ],
        i * 3,
      );
      const rand = Math.random();
      if (rand < 0.7) {
        color.setHSL(0, 0, Math.random() * 0.2 + 0.7);
      } else if (rand < 0.9) {
        color.setHSL(0.6, 0.7, Math.random() * 0.2 + 0.6);
      } else {
        color.setHSL(0.1, 0.7, Math.random() * 0.2 + 0.6);
      }
      colors.set([color.r, color.g, color.b], i * 3);
      starInfo[i] = Math.random();
    }
    return [positions, colors, starInfo];
  }, []);

  useFrame(({ clock }) => {
    materialRef.current.uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <points renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-starInfo" args={[starInfo, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{ time: { value: 0 }, pointSize: { value: 1.7 } }}
        vertexShader={`attribute float starInfo; varying vec3 vColor; varying float vStarInfo; uniform float pointSize; void main() { vColor = color; vStarInfo = starInfo; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = pointSize * (150.0 / -mvPosition.z); }`}
        fragmentShader={`uniform float time; varying vec3 vColor; varying float vStarInfo; void main() { vec2 uv = gl_PointCoord - vec2(0.5); float dist = length(uv); if (dist > 0.5) discard; float speed = vStarInfo * 2.0 + 0.5; float offset = vStarInfo * 3.14 * 2.0; float twinkle = sin(time * speed + offset) * 0.2 + 0.8; float alpha = pow(1.0 - dist * 2.0, 1.5); gl_FragColor = vec4(vColor, alpha * twinkle * 0.8); }`}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
      />
    </points>
  );
};

interface ParticlesProps {
  targetPattern: number;
  worldMouse: THREE.Vector3;
  onTransitionComplete: () => void;
}

const Particles: React.FC<ParticlesProps> = ({
  targetPattern,
  worldMouse,
  onTransitionComplete,
}) => {
  const pointsRef = useRef<THREE.Points>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);

  // Transition state
  const transitionRef = useRef({
    isTransitioning: false,
    startTime: 0,
    fromPos: null as Float32Array | null,
    toPos: null as Float32Array | null,
    fromCol: null as Float32Array | null,
    toCol: null as Float32Array | null,
    currentPattern: 0,
  });

  const [positions, colors, sizes, indices, particleTypes] = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const indices = new Float32Array(PARTICLE_COUNT);
    const particleTypes = new Float32Array(PARTICLE_COUNT);
    const initialPattern = PATTERNS[0];
    const initialPalette = COLOR_PALETTES[0];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      indices[i] = i;
      particleTypes[i] = Math.floor(Math.random() * 3);
      const pos = initialPattern(i, PARTICLE_COUNT);
      positions.set([pos.x, pos.y, pos.z], i * 3);
      const colorIndex = Math.floor(Math.random() * initialPalette.length);
      const baseColor = initialPalette[colorIndex];
      const variation = 0.85 + Math.random() * 0.3;
      const finalColor = baseColor.clone().multiplyScalar(variation);
      colors.set([finalColor.r, finalColor.g, finalColor.b], i * 3);
      sizes[i] = 1.0 + Math.random() * 1.5;
    }

    return [positions, colors, sizes, indices, particleTypes];
  }, []);

  // Initialize transition when target pattern changes
  useEffect(() => {
    if (targetPattern !== transitionRef.current.currentPattern) {
      // Store current positions and colors as starting point
      const currentPos = pointsRef.current.geometry.attributes.position
        .array as Float32Array;
      const currentCol = pointsRef.current.geometry.attributes.color
        .array as Float32Array;

      transitionRef.current.fromPos = new Float32Array(currentPos);
      transitionRef.current.fromCol = new Float32Array(currentCol);

      // Generate target positions and colors
      const toPos = new Float32Array(PARTICLE_COUNT * 3);
      const toCol = new Float32Array(PARTICLE_COUNT * 3);
      const patternFn = PATTERNS[targetPattern];
      const palette = COLOR_PALETTES[targetPattern];

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = patternFn(i, PARTICLE_COUNT);
        toPos.set([p.x, p.y, p.z], i * 3);
        const idx = Math.floor(Math.random() * palette.length);
        const base = palette[idx];
        const variation = 0.85 + Math.random() * 0.3;
        const final = base.clone().multiplyScalar(variation);
        toCol.set([final.r, final.g, final.b], i * 3);
      }

      transitionRef.current.toPos = toPos;
      transitionRef.current.toCol = toCol;
      transitionRef.current.isTransitioning = true;
      transitionRef.current.startTime = Date.now();
      transitionRef.current.currentPattern = targetPattern;
    }
  }, [targetPattern]);

  useFrame(({ clock }) => {
    materialRef.current.uniforms.time.value = clock.getElapsedTime();
    materialRef.current.uniforms.mousePos.value.copy(worldMouse);

    const transition = transitionRef.current;

    if (
      transition.isTransitioning &&
      transition.fromPos &&
      transition.toPos &&
      transition.fromCol &&
      transition.toCol
    ) {
      const elapsed = Date.now() - transition.startTime;
      const progress = Math.min(elapsed / TRANSITION_DURATION, 1);

      const easeProgress =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - (-2 * progress + 2) ** 3 / 2;

      const posAttr = pointsRef.current.geometry.attributes
        .position as THREE.BufferAttribute;
      const colAttr = pointsRef.current.geometry.attributes
        .color as THREE.BufferAttribute;

      // Interpolate positions and colors
      for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
        posAttr.array[i] =
          transition.fromPos[i] * (1 - easeProgress) +
          transition.toPos[i] * easeProgress;
        colAttr.array[i] =
          transition.fromCol[i] * (1 - easeProgress) +
          transition.toCol[i] * easeProgress;
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // Check if transition is complete
      if (progress >= 1) {
        transition.isTransitioning = false;
        transition.fromPos = null;
        transition.toPos = null;
        transition.fromCol = null;
        transition.toCol = null;
        onTransitionComplete();
      }
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-index" args={[indices, 1]} />
        <bufferAttribute
          attach="attributes-particleType"
          args={[particleTypes, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          time: { value: 0 },
          mousePos: { value: new THREE.Vector3(10000, 10000, 0) },
        }}
        vertexShader={`
          uniform float time; uniform vec3 mousePos; attribute float size; attribute float index; attribute float particleType; varying vec3 vColor; varying float vDistanceToMouse; varying float vType; varying float vIndex;
          float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }
          void main() {
            vColor = color; vType = particleType; vIndex = index; vec3 pos = position; float T = time * 0.5; float idx = index * 0.01;
            float noiseFactor1 = sin(idx * 30.0 + T * 15.0) * 0.4 + 0.6; vec3 offset1 = vec3( cos(T * 1.2 + idx * 5.0) * noiseFactor1, sin(T * 0.9 + idx * 6.0) * noiseFactor1, cos(T * 1.1 + idx * 7.0) * noiseFactor1 ) * 0.4;
            float noiseFactor2 = rand(vec2(idx, idx * 0.5)) * 0.5 + 0.5; float speedFactor = 0.3; vec3 offset2 = vec3( sin(T * speedFactor * 1.3 + idx * 1.1) * noiseFactor2, cos(T * speedFactor * 1.7 + idx * 1.2) * noiseFactor2, sin(T * speedFactor * 1.1 + idx * 1.3) * noiseFactor2 ) * 0.8;
            pos += offset1 + offset2;
            vec3 toMouse = mousePos - pos; float dist = length(toMouse); vDistanceToMouse = 0.0; float interactionRadius = 30.0; float falloffStart = 5.0;
            if (dist < interactionRadius) { float influence = smoothstep(interactionRadius, falloffStart, dist); vec3 repelDir = normalize(pos - mousePos); pos += repelDir * influence * 15.0; vDistanceToMouse = influence; }
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0); gl_Position = projectionMatrix * mvPosition; float perspectiveFactor = 700.0 / -mvPosition.z; gl_PointSize = size * perspectiveFactor * (1.0 + vDistanceToMouse * 0.5);
          }`}
        fragmentShader={`
          uniform float time; varying vec3 vColor; varying float vDistanceToMouse; varying float vType; varying float vIndex;
          vec3 rgb2hsl( vec3 c ){ vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix( vec4( c.bg, K.wz ), vec4( c.gb, K.xy ), step( c.b, c.g ) ); vec4 q = mix( vec4( p.xyw, c.r ), vec4( c.r, p.yzx ), step( p.x, c.r ) ); float d = q.x - min( q.w, q.y ); float e = 1.0e-10; return vec3( abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
          vec3 hsl2rgb( vec3 c ){ vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix( K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y ); }
          void main() {
            vec2 uv = gl_PointCoord * 2.0 - 1.0; float dist = length(uv); if (dist > 1.0) { discard; } float alpha = 0.0; vec3 baseColor = vColor;
            vec3 hsl = rgb2hsl(baseColor); float hueShift = sin(time * 0.05 + vIndex * 0.001) * 0.02; hsl.x = fract(hsl.x + hueShift); baseColor = hsl2rgb(hsl); vec3 finalColor = baseColor;
            if (vType < 0.5) { float core = smoothstep(0.2, 0.15, dist) * 0.9; float glow = pow(max(0.0, 1.0 - dist), 3.0) * 0.5; alpha = core + glow; }
            else if (vType < 1.5) { float ringWidth = 0.1; float ringCenter = 0.65; float ringShape = exp(-pow(dist - ringCenter, 2.0) / (2.0 * ringWidth * ringWidth)); alpha = smoothstep(0.1, 0.5, ringShape) * 0.8; alpha += smoothstep(0.3, 0.0, dist) * 0.1; }
            else { float pulse = sin(dist * 5.0 - time * 2.0 + vIndex * 0.1) * 0.1 + 0.9; alpha = pow(max(0.0, 1.0 - dist), 2.5) * pulse * 0.9; }
            finalColor = mix(finalColor, finalColor * 1.3 + 0.1, vDistanceToMouse * 1.0); alpha *= 0.9; alpha = clamp(alpha, 0.0, 1.0); gl_FragColor = vec4(finalColor * alpha, alpha);
          }`}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
      />
    </points>
  );
};

interface SceneProps {
  targetPattern: number;
  worldMouse: THREE.Vector3;
  onTransitionComplete: () => void;
}

const Scene: React.FC<SceneProps> = ({
  targetPattern,
  worldMouse,
  onTransitionComplete,
}) => {
  const { mouse } = useThree();
  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    [],
  );

  useFrame(({ camera, clock, raycaster }) => {
    const time = clock.getElapsedTime();
    const cameraRadius = 120;
    const angleX = time * 0.08;
    const angleY = time * 0.06;

    camera.position.x = Math.cos(angleX) * cameraRadius + 20;
    camera.position.z = Math.sin(angleX) * cameraRadius;
    camera.position.y = Math.sin(angleY) * 35 + 5;
    camera.lookAt(40, 0, 0);

    raycaster.setFromCamera(mouse, camera);
    const intersectPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
      worldMouse.lerp(intersectPoint, 0.1);
    }
  });

  return (
    <>
      <Stars />
      <Particles
        targetPattern={targetPattern}
        worldMouse={worldMouse}
        onTransitionComplete={onTransitionComplete}
      />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.3}
          intensity={0.85}
          levels={9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
};

const CosmicWeb: React.FC = () => {
  const [isNameVisible, setIsNameVisible] = useState<boolean>(true);
  const [currentPattern, setCurrentPattern] = useState(0);
  const [targetPattern, setTargetPattern] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const worldMouse = useRef(new THREE.Vector3(10000, 10000, 0)).current;

  const changePattern = () => {
    if (isTransitioning) return;

    const nextPattern = (currentPattern + 1) % PATTERNS.length;
    setTargetPattern(nextPattern);
    setIsNameVisible(true);
    setIsTransitioning(true);

    setTimeout(() => setIsNameVisible(false), 2500);
  };

  const handleTransitionComplete = () => {
    setCurrentPattern(targetPattern);
    setIsTransitioning(false);
  };

  useEffect(() => {
    const interval = setInterval(changePattern, 5000);
    return () => clearInterval(interval);
  }, [currentPattern, isTransitioning]);

  return (
    <div className="fixed h-full w-full overflow-hidden bg-black">
      <Canvas
        camera={{ fov: 65, position: [0, 0, 100], near: 0.1, far: 1500 }}
        dpr={window.devicePixelRatio}
      >
        <Scene
          targetPattern={targetPattern}
          worldMouse={worldMouse}
          onTransitionComplete={handleTransitionComplete}
        />
      </Canvas>
    </div>
  );
};

export default CosmicWeb;
