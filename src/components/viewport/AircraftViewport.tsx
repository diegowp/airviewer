import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  AircraftDatData,
  CameraPreset,
  DnmModelData,
  DnmNode,
  FlightControlState,
  SrfMeshData,
  Vec3,
} from '../../types/ysflight';
import {
  buildSrfGeometries,
  evaluateDnmNodeTransform,
  ysVecToThree,
} from '../../math/ysTransform';

export interface RenderSettings {
  showVisualDnm: boolean;
  showCollisionSrf: boolean;
  wireframe: boolean;
  flatShading: boolean;
  xrayMode: boolean;
  showDatMarkers: boolean;
  showBoundingSphere: boolean;
  showGrid: boolean;
  /** Optional orphaned PCK mesh name to preview solo */
  previewOrphanPck: string | null;
}

interface ProjectedMarker {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  x: number;
  y: number;
  visible: boolean;
}

interface AircraftViewportProps {
  dnmData: DnmModelData | null;
  collData: SrfMeshData | null;
  datData: AircraftDatData | null;
  controls: FlightControlState;
  onUpdateControls: React.Dispatch<React.SetStateAction<FlightControlState>>;
  renderSettings: RenderSettings;
  hiddenNodes: Set<string>;
  selectedNodeName: string | null;
  onSelectNode: (name: string | null) => void;
  cameraPreset: CameraPreset;
  cameraResetTrigger: number;
}

interface NodeRuntimeObjects {
  node: DnmNode;
  group: THREE.Group;
  opaqueMesh?: THREE.Mesh;
  transparentMesh?: THREE.Mesh;
  opaqueMat?: THREE.MeshStandardMaterial;
  transparentMat?: THREE.MeshPhysicalMaterial;
}

export const AircraftViewport: React.FC<AircraftViewportProps> = ({
  dnmData,
  collData,
  datData,
  controls,
  onUpdateControls,
  renderSettings,
  hiddenNodes,
  selectedNodeName,
  onSelectNode,
  cameraPreset,
  cameraResetTrigger,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [projectedMarkers, setProjectedMarkers] = useState<ProjectedMarker[]>([]);
  const [hoveredNodeName, setHoveredNodeName] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(60);

  // Refs to share latest state with the requestAnimationFrame loop without recreating the WebGL context
  const controlsRef = useRef<FlightControlState>(controls);
  controlsRef.current = controls;

  const renderSettingsRef = useRef<RenderSettings>(renderSettings);
  renderSettingsRef.current = renderSettings;

  const hiddenNodesRef = useRef<Set<string>>(hiddenNodes);
  hiddenNodesRef.current = hiddenNodes;

  const selectedNodeRef = useRef<string | null>(selectedNodeName);
  selectedNodeRef.current = selectedNodeName;

  const hoveredNodeRef = useRef<string | null>(hoveredNodeName);
  hoveredNodeRef.current = hoveredNodeName;

  const datDataRef = useRef<AircraftDatData | null>(datData);
  datDataRef.current = datData;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const nodeMapRef = useRef<Map<string, NodeRuntimeObjects>>(new Map());
  const dnmRootGroupRef = useRef<THREE.Group | null>(null);
  const collGroupRef = useRef<THREE.Group | null>(null);
  const orphanGroupRef = useRef<THREE.Group | null>(null);
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const sphereHelperRef = useRef<THREE.Mesh | null>(null);
  const gridGroupRef = useRef<THREE.Group | null>(null);

  // Initialize Three.js Scene, Camera, Renderer, Lights & OrbitControls
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080d16');
    scene.fog = new THREE.FogExp2('#080d16', 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      48,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.08,
      400
    );
    camera.position.set(11.5, 4.2, 11.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.07;
    orbit.maxDistance = 120;
    orbit.minDistance = 0.2;
    orbit.target.set(0, 0, -0.5);
    orbit.update();
    orbitRef.current = orbit;

    // Studio / Hangar Lighting Setup
    const hemiLight = new THREE.HemisphereLight('#d8ecff', '#1e293b', 1.25);
    hemiLight.position.set(0, 25, 0);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight('#ffffff', 2.0);
    dirLight1.position.set(14, 22, 16);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 1;
    dirLight1.shadow.camera.far = 60;
    const d = 14;
    dirLight1.shadow.camera.left = -d;
    dirLight1.shadow.camera.right = d;
    dirLight1.shadow.camera.top = d;
    dirLight1.shadow.camera.bottom = -d;
    dirLight1.shadow.bias = -0.0005;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight('#60a5fa', 0.85);
    dirLight2.position.set(-16, 10, -14);
    scene.add(dirLight2);

    const rimLight = new THREE.DirectionalLight('#f59e0b', 0.45);
    rimLight.position.set(0, -12, 10);
    scene.add(rimLight);

    // Hangar Floor Grid & Runway Line
    const gridGroup = new THREE.Group();
    // Ground level in T-25 coordinates: wheels touch around Y = -1.70m
    const groundY = -1.72;
    const gridHelper = new THREE.GridHelper(60, 60, '#1e3a5f', '#111c2d');
    gridHelper.position.y = groundY;
    gridGroup.add(gridHelper);

    const shadowPlaneGeo = new THREE.PlaneGeometry(60, 60);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.38 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = groundY + 0.002;
    shadowPlane.receiveShadow = true;
    gridGroup.add(shadowPlane);

    // Subtle longitudinal axis indicator (+Z Nose direction)
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, groundY + 0.01, -18),
      new THREE.Vector3(0, groundY + 0.01, 18),
    ]);
    const axisMat = new THREE.LineBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.35,
    });
    gridGroup.add(new THREE.Line(axisGeo, axisMat));

    scene.add(gridGroup);
    gridGroupRef.current = gridGroup;

    // Scene containers
    const dnmRoot = new THREE.Group();
    const collGroup = new THREE.Group();
    const orphanGroup = new THREE.Group();
    const markersGroup = new THREE.Group();

    scene.add(dnmRoot);
    scene.add(collGroup);
    scene.add(orphanGroup);
    scene.add(markersGroup);

    dnmRootGroupRef.current = dnmRoot;
    collGroupRef.current = collGroup;
    orphanGroupRef.current = orphanGroup;
    markersGroupRef.current = markersGroup;

    // Raycaster for interactive part selection & hover
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const getHitNodeName = (event: MouseEvent): string | null => {
      if (!dnmRootGroupRef.current || !dnmRootGroupRef.current.visible) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const intersects = raycaster.intersectObjects(dnmRootGroupRef.current.children, true);
      for (const hit of intersects) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData && obj.userData.dnmNodeName) {
            if (obj.visible) {
              return obj.userData.dnmNodeName as string;
            }
          }
          obj = obj.parent;
        }
      }
      return null;
    };

    const handlePointerDown = (e: MouseEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: MouseEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist < 5 && e.button === 0) {
        const hitName = getHitNodeName(e);
        onSelectNode(hitName === selectedNodeRef.current ? null : hitName);
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      const hitName = getHitNodeName(e);
      if (hitName !== hoveredNodeRef.current) {
        setHoveredNodeName(hitName);
        renderer.domElement.style.cursor = hitName ? 'pointer' : 'grab';
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // Animation loop
    let animId = 0;
    let lastTime = performance.now();
    let rotorAngle = 0;
    let frameCount = 0;
    let fpsAccum = 0;

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      frameCount++;
      fpsAccum += dt;
      if (fpsAccum >= 0.5) {
        setFps(Math.round(frameCount / fpsAccum));
        frameCount = 0;
        fpsAccum = 0;
      }

      const curControls = controlsRef.current;
      const curSettings = renderSettingsRef.current;

      // Smoothly animate landing gear towards gearTarget or autoDemo
      if (curControls.autoDemo) {
        const t = now * 0.001;
        const demoAileron = Math.sin(t * 1.6) * 0.95;
        const demoElevator = Math.cos(t * 1.1) * 0.95;
        const demoRudder = Math.sin(t * 0.85) * 0.95;
        const demoGear = Math.max(0, Math.min(1, 0.5 + 0.65 * Math.sin(t * 0.45)));
        onUpdateControls((prev) => ({
          ...prev,
          aileron: Number(demoAileron.toFixed(3)),
          elevator: Number(demoElevator.toFixed(3)),
          rudder: Number(demoRudder.toFixed(3)),
          gear: Number(demoGear.toFixed(3)),
          gearTarget: demoGear > 0.5 ? 1 : 0,
        }));
      } else if (Math.abs(curControls.gear - curControls.gearTarget) > 0.002) {
        const speed = 0.55; // full cycle in ~1.8s
        const step = Math.sign(curControls.gearTarget - curControls.gear) * speed * dt;
        const nextGear =
          Math.abs(curControls.gearTarget - curControls.gear) <= Math.abs(step)
            ? curControls.gearTarget
            : curControls.gear + step;
        onUpdateControls((prev) => ({
          ...prev,
          gear: Number(nextGear.toFixed(3)),
        }));
      }

      // Accumulate propeller rotor angle
      if (curControls.engineRunning) {
        // Idle ~8 rad/s, full power ~48 rad/s
        const omega = 8 + curControls.throttle * 42;
        rotorAngle = (rotorAngle + omega * dt) % (Math.PI * 2);
      }

      // Update each DNM node matrix and visibility
      const tempMat = new THREE.Matrix4();
      nodeMapRef.current.forEach((runtimeObj, nodeName) => {
        const evalRes = evaluateDnmNodeTransform(
          runtimeObj.node,
          curControls,
          rotorAngle,
          tempMat
        );
        const userHidden = hiddenNodesRef.current.has(nodeName);
        runtimeObj.group.visible = evalRes.visible && !userHidden;
        runtimeObj.group.matrix.copy(evalRes.matrix);
        runtimeObj.group.matrixWorldNeedsUpdate = true;

        // Highlight selected or hovered node
        const isSelected = selectedNodeRef.current === nodeName;
        const isHovered = hoveredNodeRef.current === nodeName;
        if (runtimeObj.opaqueMat) {
          runtimeObj.opaqueMat.wireframe = curSettings.wireframe;
          runtimeObj.opaqueMat.transparent = curSettings.xrayMode;
          runtimeObj.opaqueMat.opacity = curSettings.xrayMode ? 0.42 : 1.0;
          runtimeObj.opaqueMat.depthWrite = !curSettings.xrayMode;

          if (isSelected) {
            runtimeObj.opaqueMat.emissive.set('#0284c7');
            runtimeObj.opaqueMat.emissiveIntensity = 0.45;
          } else if (isHovered) {
            runtimeObj.opaqueMat.emissive.set('#38bdf8');
            runtimeObj.opaqueMat.emissiveIntensity = 0.22;
          } else {
            runtimeObj.opaqueMat.emissive.set('#000000');
            runtimeObj.opaqueMat.emissiveIntensity = 0;
          }
        }
        if (runtimeObj.transparentMat) {
          runtimeObj.transparentMat.wireframe = curSettings.wireframe;
        }
      });

      if (dnmRootGroupRef.current) {
        dnmRootGroupRef.current.visible =
          curSettings.showVisualDnm && !curSettings.previewOrphanPck;
      }
      if (collGroupRef.current) {
        collGroupRef.current.visible =
          curSettings.showCollisionSrf && !curSettings.previewOrphanPck;
      }
      if (orphanGroupRef.current) {
        orphanGroupRef.current.visible = Boolean(curSettings.previewOrphanPck);
      }
      if (gridGroupRef.current) {
        gridGroupRef.current.visible = curSettings.showGrid;
      }
      if (markersGroupRef.current) {
        markersGroupRef.current.visible = curSettings.showDatMarkers;
      }
      if (sphereHelperRef.current) {
        sphereHelperRef.current.visible = curSettings.showBoundingSphere;
      }

      orbit.update();
      renderer.render(scene, camera);

      // Update projected 2D coordinates for DAT engineering markers
      if (curSettings.showDatMarkers && datDataRef.current && container) {
        const pts = datDataRef.current.points3D;
        const rawList: Array<{
          id: string;
          label: string;
          sublabel: string;
          color: string;
          vec?: Vec3;
        }> = [
          {
            id: 'cockpit',
            label: 'COCKPITP',
            sublabel: 'Visão do Piloto (-0.50, 0.90, 0.80m)',
            color: '#38bdf8',
            vec: pts.cockpit,
          },
          {
            id: 'wheelGear',
            label: 'WHELGEAR',
            sublabel: 'Bequilha de Nariz (0.00, -1.65, 1.37m)',
            color: '#22c55e',
            vec: pts.wheelGear,
          },
          {
            id: 'leftGear',
            label: 'LEFTGEAR',
            sublabel: 'Trem Principal Esq (-2.00, -1.70, -0.20m)',
            color: '#22c55e',
            vec: pts.leftGear,
          },
          {
            id: 'rightGear',
            label: 'RIGHGEAR',
            sublabel: 'Trem Principal Dir (2.00, -1.70, -0.20m)',
            color: '#22c55e',
            vec: pts.rightGear,
          },
          {
            id: 'smokeGen',
            label: 'SMOKEGEN',
            sublabel: 'Gerador de Fumaça (1.00, -1.00, 0.00m)',
            color: '#f59e0b',
            vec: pts.smokeGen,
          },
          {
            id: 'vaporR',
            label: 'VAPORPO0 (Dir)',
            sublabel: 'Vórtice Ponta de Asa (5.44, 0.015, 0.595m)',
            color: '#a855f7',
            vec: pts.vapor0,
          },
          {
            id: 'vaporL',
            label: 'VAPORPO0 (Esq)',
            sublabel: 'Vórtice Ponta de Asa (-5.44, 0.015, 0.595m)',
            color: '#a855f7',
            vec: pts.vapor0
              ? { x: -pts.vapor0.x, y: pts.vapor0.y, z: pts.vapor0.z }
              : undefined,
          },
        ];

        const w = container.clientWidth;
        const h = container.clientHeight;
        const nextMarkers: ProjectedMarker[] = [];

        for (const item of rawList) {
          if (!item.vec) continue;
          const v3 = ysVecToThree(item.vec);
          v3.project(camera);
          const isInFront = v3.z >= -1 && v3.z <= 1;
          const sx = (v3.x * 0.5 + 0.5) * w;
          const sy = (-(v3.y * 0.5) + 0.5) * h;
          nextMarkers.push({
            id: item.id,
            label: item.label,
            sublabel: item.sublabel,
            color: item.color,
            x: sx,
            y: sy,
            visible: isInFront && sx >= 0 && sx <= w && sy >= 0 && sy <= h,
          });
        }
        setProjectedMarkers(nextMarkers);
      } else {
        setProjectedMarkers((prev) => (prev.length > 0 ? [] : prev));
      }
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      orbit.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Build DNM Scene Graph whenever dnmData or flatShading changes
  useEffect(() => {
    const dnmRoot = dnmRootGroupRef.current;
    if (!dnmRoot) return;

    // Clear previous objects
    while (dnmRoot.children.length > 0) {
      dnmRoot.remove(dnmRoot.children[0]);
    }
    nodeMapRef.current.clear();

    if (!dnmData) return;

    // Create a Group for each SRF node
    for (const node of dnmData.nodes) {
      const group = new THREE.Group();
      group.name = `SRF_${node.name}`;
      group.matrixAutoUpdate = false;
      group.userData = { dnmNodeName: node.name };

      const pckMesh = dnmData.pckMeshes[node.fileName];
      const runtimeObj: NodeRuntimeObjects = { node, group };

      if (pckMesh) {
        const built = buildSrfGeometries(pckMesh, renderSettings.flatShading);

        if (built.opaqueGeometry) {
          const opaqueMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.42,
            metalness: 0.12,
            side: THREE.DoubleSide,
            flatShading: renderSettings.flatShading,
          });
          const meshObj = new THREE.Mesh(built.opaqueGeometry, opaqueMat);
          meshObj.castShadow = true;
          meshObj.receiveShadow = true;
          meshObj.userData = { dnmNodeName: node.name };
          group.add(meshObj);
          runtimeObj.opaqueMesh = meshObj;
          runtimeObj.opaqueMat = opaqueMat;
        }

        if (built.transparentGeometry) {
          const transMat = new THREE.MeshPhysicalMaterial({
            vertexColors: true,
            transparent: true,
            opacity: built.transparentOpacity,
            roughness: 0.15,
            metalness: 0.05,
            transmission: 0.25,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const transMeshObj = new THREE.Mesh(built.transparentGeometry, transMat);
          transMeshObj.renderOrder = 10;
          transMeshObj.userData = { dnmNodeName: node.name };
          group.add(transMeshObj);
          runtimeObj.transparentMesh = transMeshObj;
          runtimeObj.transparentMat = transMat;
        }
      }

      nodeMapRef.current.set(node.name, runtimeObj);
    }

    // Wire up parent-child relationships (CLD)
    const childNamesSet = new Set<string>();
    for (const node of dnmData.nodes) {
      const parentRuntime = nodeMapRef.current.get(node.name);
      if (!parentRuntime) continue;
      for (const childName of node.childrenNames) {
        const childRuntime = nodeMapRef.current.get(childName);
        if (childRuntime && childRuntime !== parentRuntime) {
          parentRuntime.group.add(childRuntime.group);
          childNamesSet.add(childName);
        }
      }
    }

    // Attach root nodes to dnmRoot
    for (const node of dnmData.nodes) {
      if (!childNamesSet.has(node.name)) {
        const rt = nodeMapRef.current.get(node.name);
        if (rt) {
          dnmRoot.add(rt.group);
        }
      }
    }
  }, [dnmData, renderSettings.flatShading]);

  // Build Collision SRF Mesh whenever collData changes
  useEffect(() => {
    const collGroup = collGroupRef.current;
    if (!collGroup) return;

    while (collGroup.children.length > 0) {
      collGroup.remove(collGroup.children[0]);
    }

    if (!collData) return;

    const built = buildSrfGeometries(collData, true);
    if (built.opaqueGeometry) {
      const solidMat = new THREE.MeshStandardMaterial({
        color: '#f97316',
        transparent: true,
        opacity: 0.28,
        roughness: 0.6,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const wireMat = new THREE.MeshBasicMaterial({
        color: '#fb923c',
        wireframe: true,
        transparent: true,
        opacity: 0.75,
      });
      collGroup.add(new THREE.Mesh(built.opaqueGeometry, solidMat));
      collGroup.add(new THREE.Mesh(built.opaqueGeometry, wireMat));
    }
  }, [collData]);

  // Build Orphaned PCK preview mesh when selected
  useEffect(() => {
    const orphanGroup = orphanGroupRef.current;
    if (!orphanGroup) return;

    while (orphanGroup.children.length > 0) {
      orphanGroup.remove(orphanGroup.children[0]);
    }

    const pckName = renderSettings.previewOrphanPck;
    if (!pckName || !dnmData || !dnmData.pckMeshes[pckName]) return;

    const meshData = dnmData.pckMeshes[pckName];
    const built = buildSrfGeometries(meshData, renderSettings.flatShading);
    if (built.opaqueGeometry) {
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.4,
        metalness: 0.15,
        wireframe: renderSettings.wireframe,
        side: THREE.DoubleSide,
      });
      orphanGroup.add(new THREE.Mesh(built.opaqueGeometry, mat));
    }
    if (built.transparentGeometry) {
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity: built.transparentOpacity,
        wireframe: renderSettings.wireframe,
        side: THREE.DoubleSide,
      });
      orphanGroup.add(new THREE.Mesh(built.transparentGeometry, mat));
    }
  }, [renderSettings.previewOrphanPck, dnmData, renderSettings.flatShading, renderSettings.wireframe]);

  // Build 3D Markers & HTRADIUS Bounding Sphere from DAT file
  useEffect(() => {
    const markersGroup = markersGroupRef.current;
    const scene = sceneRef.current;
    if (!markersGroup || !scene) return;

    while (markersGroup.children.length > 0) {
      markersGroup.remove(markersGroup.children[0]);
    }
    if (sphereHelperRef.current) {
      scene.remove(sphereHelperRef.current);
      sphereHelperRef.current = null;
    }

    if (!datData) return;

    const addPinSphere = (pos: Vec3 | undefined, hexColor: string, radius = 0.12) => {
      if (!pos) return;
      const v = ysVecToThree(pos);
      const geo = new THREE.SphereGeometry(radius, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color: hexColor });
      const sphere = new THREE.Mesh(geo, mat);
      sphere.position.copy(v);
      markersGroup.add(sphere);

      // Ring halo around marker
      const ringGeo = new THREE.RingGeometry(radius * 1.4, radius * 1.8, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: hexColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(v);
      markersGroup.add(ring);
    };

    const pts = datData.points3D;
    addPinSphere(pts.cockpit, '#38bdf8', 0.14);
    addPinSphere(pts.wheelGear, '#22c55e', 0.13);
    addPinSphere(pts.leftGear, '#22c55e', 0.13);
    addPinSphere(pts.rightGear, '#22c55e', 0.13);
    addPinSphere(pts.smokeGen, '#f59e0b', 0.11);
    if (pts.vapor0) {
      addPinSphere(pts.vapor0, '#a855f7', 0.11);
      addPinSphere({ x: -pts.vapor0.x, y: pts.vapor0.y, z: pts.vapor0.z }, '#a855f7', 0.11);
    }

    // HTRADIUS bounding sphere
    if (datData.outsideRadiusM > 0) {
      const sphGeo = new THREE.SphereGeometry(datData.outsideRadiusM, 24, 18);
      const sphMat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        wireframe: true,
        transparent: true,
        opacity: 0.16,
      });
      const sphMesh = new THREE.Mesh(sphGeo, sphMat);
      sphMesh.visible = renderSettings.showBoundingSphere;
      scene.add(sphMesh);
      sphereHelperRef.current = sphMesh;
    }
  }, [datData]);

  // Apply Camera Presets (Hangar, Pilot Cockpit View, Front, Side, Top, Tail)
  useEffect(() => {
    const camera = cameraRef.current;
    const orbit = orbitRef.current;
    if (!camera || !orbit) return;

    switch (cameraPreset) {
      case 'cockpit': {
        // Exact pilot eye position from t25universal.dat: COCKPITP -0.50m 0.90m 0.80m
        const cp = datData?.points3D.cockpit ?? { x: -0.5, y: 0.9, z: 0.8 };
        const eye = ysVecToThree(cp);
        camera.position.set(eye.x, eye.y, eye.z);
        // Look forward toward the nose (+Z in Three.js space) and slightly down over the instrument panel
        orbit.target.set(eye.x * 0.6, eye.y - 0.18, eye.z + 3.5);
        orbit.update();
        break;
      }
      case 'front': {
        camera.position.set(0, 1.2, 14.5);
        orbit.target.set(0, 0, 0);
        orbit.update();
        break;
      }
      case 'side': {
        camera.position.set(15.5, 1.0, -1.0);
        orbit.target.set(0, 0, -1.0);
        orbit.update();
        break;
      }
      case 'top': {
        camera.position.set(0, 18.5, -1.2);
        orbit.target.set(0, 0, -1.0);
        orbit.update();
        break;
      }
      case 'tail': {
        camera.position.set(0, 2.2, -16.0);
        orbit.target.set(0, 0, 0);
        orbit.update();
        break;
      }
      case 'hangar':
      default: {
        camera.position.set(11.5, 4.2, 11.5);
        orbit.target.set(0, -0.2, -0.8);
        orbit.update();
        break;
      }
    }
  }, [cameraPreset, cameraResetTrigger, datData]);

  return (
    <div className="viewport-wrapper" ref={mountRef}>
      {/* Projected 3D Engineering Markers from .dat */}
      {renderSettings.showDatMarkers &&
        projectedMarkers.map(
          (m) =>
            m.visible && (
              <div
                key={m.id}
                className="dat-marker-label"
                style={{
                  left: `${m.x}px`,
                  top: `${m.y}px`,
                  borderColor: m.color,
                }}
              >
                <span className="dat-marker-dot" style={{ backgroundColor: m.color }} />
                <div>
                  <strong>{m.label}</strong>
                  <small>{m.sublabel}</small>
                </div>
              </div>
            )
        )}

      {/* Bottom Status / Telemetry Pill */}
      <div className="viewport-hud-pill">
        <span className="hud-badge">
          <span className="status-dot online" /> WebGL {fps} FPS
        </span>
        <span className="hud-divider">|</span>
        <span>
          <strong>Peça sob o cursor:</strong>{' '}
          {hoveredNodeName
            ? `SRF "${hoveredNodeName}" (${
                dnmData?.nodes.find((n) => n.name === hoveredNodeName)?.fileName ?? ''
              })`
            : 'Nenhuma (clique em uma peça 3D para inspecionar)'}
        </span>
        {selectedNodeName && (
          <>
            <span className="hud-divider">|</span>
            <span className="hud-selected-tag">
              Selecionado: SRF &quot;{selectedNodeName}&quot;
              <button
                type="button"
                className="hud-clear-btn"
                onClick={() => onSelectNode(null)}
                title="Limpar seleção"
              >
                ×
              </button>
            </span>
          </>
        )}
      </div>
    </div>
  );
};
