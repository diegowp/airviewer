import * as THREE from 'three';
import {
  Att3,
  DnmNode,
  FlightControlState,
  SrfMeshData,
  Vec3,
} from '../types/ysflight';

const YS_ANGLE_TO_RAD = Math.PI / 32768.0;

export function ysIntToRad(val: number): number {
  return val * YS_ANGLE_TO_RAD;
}

/**
 * Emulates YSFlight's YsMatrix4x4 (row-major 4x4 in YSFlight Left-Handed space)
 * and converts it to a Three.js Matrix4 in Right-Handed space via S * M_ys * S
 * where S = diag(-1, 1, 1, 1).
 */
export class YsMatrix4 {
  // Row-major 16 floats: m[row * 4 + col]
  public m: Float64Array;

  constructor() {
    this.m = new Float64Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  loadIdentity(): this {
    this.m.set([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    return this;
  }

  translate(x: number, y: number, z: number): this {
    const d = this.m;
    // Post-multiply by translation matrix: col 3 += col0*x + col1*y + col2*z
    d[3] += d[0] * x + d[1] * y + d[2] * z;
    d[7] += d[4] * x + d[5] * y + d[6] * z;
    d[11] += d[8] * x + d[9] * y + d[10] * z;
    d[15] += d[12] * x + d[13] * y + d[14] * z;
    return this;
  }

  /**
   * Matches YsMatrix4x4::RotateXZ(a) in ysgeometry.h
   */
  rotateXZ(a: number): this {
    const s = Math.sin(a);
    const c = Math.cos(a);
    const d = this.m;
    for (let r = 0; r < 16; r += 4) {
      const m1 = d[r + 0];
      const m2 = d[r + 2];
      d[r + 0] = c * m1 + s * m2;
      d[r + 2] = -s * m1 + c * m2;
    }
    return this;
  }

  /**
   * Matches YsMatrix4x4::RotateYZ(a) in ysgeometry.h
   */
  rotateYZ(a: number): this {
    const s = Math.sin(a);
    const c = Math.cos(a);
    const d = this.m;
    for (let r = 0; r < 16; r += 4) {
      const m1 = d[r + 1];
      const m2 = d[r + 2];
      d[r + 1] = c * m1 + s * m2;
      d[r + 2] = -s * m1 + c * m2;
    }
    return this;
  }

  /**
   * Matches YsMatrix4x4::RotateZY(a) = RotateYZ(-a) in ysgeometry.h
   */
  rotateZY(a: number): this {
    return this.rotateYZ(-a);
  }

  /**
   * Matches YsMatrix4x4::RotateXY(a) in ysgeometry.h
   */
  rotateXY(a: number): this {
    const s = Math.sin(a);
    const c = Math.cos(a);
    const d = this.m;
    for (let r = 0; r < 16; r += 4) {
      const m1 = d[r + 0];
      const m2 = d[r + 1];
      d[r + 0] = c * m1 + s * m2;
      d[r + 1] = -s * m1 + c * m2;
    }
    return this;
  }

  /**
   * Converts this YSFlight Left-Handed matrix into a Three.js Right-Handed Matrix4
   * under the coordinate mapping (x, y, z)_ys -> (-x, y, z)_three.
   * Conjugating by S = diag(-1, 1, 1, 1) negates entries where (row == 0) XOR (col == 0).
   */
  toThreeMatrix4(target = new THREE.Matrix4()): THREE.Matrix4 {
    const d = this.m;
    target.set(
       d[0], -d[1], -d[2], -d[3],
      -d[4],  d[5],  d[6],  d[7],
      -d[8],  d[9],  d[10], d[11],
      -d[12], d[13], d[14], d[15]
    );
    return target;
  }
}

/**
 * Converts a YSFlight Vec3 (x=Right, y=Up, z=Forward) to Three.js Vector3 (-x, y, z).
 */
export function ysVecToThree(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(-v.x, v.y, v.z);
}

/**
 * Computes the forward and up vectors for a YsAtt3 (in radians), matching YsAtt3::GetForwardVector / GetUpVector
 * so state interpolation between two STA states works identically to YsShellDnmContainer::SetClassStateRecursive.
 */
function getAttVectors(hRad: number, pRad: number, bRad: number): { ev: Vec3; uv: Vec3 } {
  const mat = new YsMatrix4();
  mat.rotateXZ(hRad).rotateZY(pRad).rotateXY(bRad);
  const d = mat.m;
  // Forward vector is mat * (0, 0, 1), Up vector is mat * (0, 1, 0)
  return {
    ev: { x: d[2], y: d[6], z: d[10] },
    uv: { x: d[1], y: d[5], z: d[9] },
  };
}

function setTwoVectors(evIn: Vec3, uvIn: Vec3): { hRad: number; pRad: number; bRad: number } {
  const evLen = Math.hypot(evIn.x, evIn.y, evIn.z) || 1;
  const ev = { x: evIn.x / evLen, y: evIn.y / evLen, z: evIn.z / evLen };

  const uvLen = Math.hypot(uvIn.x, uvIn.y, uvIn.z) || 1;
  const uv = { x: uvIn.x / uvLen, y: uvIn.y / uvLen, z: uvIn.z / uvLen };

  const pRad = Math.asin(Math.max(-1, Math.min(1, ev.y)));
  const hRad = (Math.abs(ev.x) > 1e-8 || Math.abs(ev.z) > 1e-8) ? Math.atan2(-ev.x, ev.z) : 0;

  // Inverse rotate uv by -p and -h to recover bank angle b
  const mInv = new YsMatrix4();
  mInv.rotateZY(-pRad).rotateXZ(-hRad);
  const d = mInv.m;
  const ux = d[0] * uv.x + d[1] * uv.y + d[2] * uv.z;
  const uy = d[4] * uv.x + d[5] * uv.y + d[6] * uv.z;
  const bRad = Math.atan2(-ux, uy);

  return { hRad, pRad, bRad };
}

function interpolateNodeStates(
  node: DnmNode,
  stIdx0: number,
  stIdx1: number,
  param: number
): { relPos: Vec3; relAttRad: { h: number; p: number; b: number }; show: boolean } {
  const t = Math.max(0, Math.min(1, param));
  const s0 = node.states[stIdx0];
  const s1 = node.states[stIdx1];

  if (!s0 && !s1) {
    return {
      relPos: { x: 0, y: 0, z: 0 },
      relAttRad: { h: 0, p: 0, b: 0 },
      show: true,
    };
  }
  if (!s1 || stIdx0 === stIdx1 || t <= 0) {
    const s = s0 || s1;
    return {
      relPos: { ...s.pos },
      relAttRad: {
        h: ysIntToRad(s.att.h),
        p: ysIntToRad(s.att.p),
        b: ysIntToRad(s.att.b),
      },
      show: s.visible !== 0,
    };
  }
  if (!s0 || t >= 1) {
    return {
      relPos: { ...s1.pos },
      relAttRad: {
        h: ysIntToRad(s1.att.h),
        p: ysIntToRad(s1.att.p),
        b: ysIntToRad(s1.att.b),
      },
      show: s1.visible !== 0,
    };
  }

  const relPos: Vec3 = {
    x: s0.pos.x * (1 - t) + s1.pos.x * t,
    y: s0.pos.y * (1 - t) + s1.pos.y * t,
    z: s0.pos.z * (1 - t) + s1.pos.z * t,
  };

  const v0 = getAttVectors(ysIntToRad(s0.att.h), ysIntToRad(s0.att.p), ysIntToRad(s0.att.b));
  const v1 = getAttVectors(ysIntToRad(s1.att.h), ysIntToRad(s1.att.p), ysIntToRad(s1.att.b));

  const evLerp: Vec3 = {
    x: v0.ev.x * (1 - t) + v1.ev.x * t,
    y: v0.ev.y * (1 - t) + v1.ev.y * t,
    z: v0.ev.z * (1 - t) + v1.ev.z * t,
  };
  const uvLerp: Vec3 = {
    x: v0.uv.x * (1 - t) + v1.uv.x * t,
    y: v0.uv.y * (1 - t) + v1.uv.y * t,
    z: v0.uv.z * (1 - t) + v1.uv.z * t,
  };
  const { hRad, pRad, bRad } = setTwoVectors(evLerp, uvLerp);

  const show0 = s0.visible !== 0;
  const show1 = s1.visible !== 0;
  let show = true;
  if (show0 && !show1 && t > 0.99) {
    show = false;
  } else if (!show0 && show1 && t < 0.01) {
    show = false;
  } else if (!show0 && !show1) {
    show = false;
  }

  return {
    relPos,
    relAttRad: { h: hRad, p: pRad, b: bRad },
    show,
  };
}

/**
 * Evaluates a DnmNode's local transformation matrix and visibility flag for the current FlightControlState
 * and accumulated propeller rotor angle (in radians), matching FsAirplaneProperty::SetupVisual
 * and YsShellDnmContainer::DnmState::CacheTransformation.
 */
export function evaluateDnmNodeTransform(
  node: DnmNode,
  controls: FlightControlState,
  rotorAngleRad: number,
  outMatrix = new THREE.Matrix4()
): { visible: boolean; matrix: THREE.Matrix4 } {
  // Step 1: Default state is STA 0 (as set by FsExistence::ResetDnmState -> SetStateOfAllPart(0))
  let stateEval = interpolateNodeStates(node, 0, 0, 0);

  const cla = node.cla;

  switch (cla) {
    case 0: {
      // Landing gear or static part: if NST >= 2, interpolates STA 0 (retracted) <-> STA 1 (extended)
      if (node.states.length >= 2) {
        const g = controls.gear;
        let param = 0;
        if (g < 0.2) {
          param = 0;
        } else if (g < 0.8) {
          param = (g - 0.2) / 0.6;
        } else {
          param = 1.0;
        }
        stateEval = interpolateNodeStates(node, 0, 1, param);
      }
      break;
    }
    case 1: {
      // Variable geometry wing OR Propeller blade/blur visibility toggle (e.g. EMB-111)
      const isPropellerPart =
        node.fileName.toLowerCase().includes('prop') ||
        node.fileName.toLowerCase().includes('blade') ||
        (node.states.length >= 2 && node.states[0].visible !== node.states[1].visible);

      if (isPropellerPart && node.states.length >= 2) {
        // High-speed / running: state 0; stopped / low: state 1
        const isFast = controls.engineRunning && controls.throttle > 0.3;
        stateEval = interpolateNodeStates(node, isFast ? 0 : 1, isFast ? 0 : 1, 0);
      } else if (node.states.length >= 2) {
        stateEval = interpolateNodeStates(node, 0, 1, controls.vgw);
      }
      break;
    }
    case 2: {
      // Afterburner flame (Reheat)
      const abOn = controls.engineRunning && (controls.afterburner || controls.throttle > 0.95);
      if (node.states.length >= 2) {
        stateEval = interpolateNodeStates(node, 0, 1, abOn ? 1 : 0);
      }
      stateEval.show = abOn;
      break;
    }
    case 3: {
      // Spinner / Rotor pivot (CLA 3): starts from STA 0, then SetClassHeading overrides relAtt.h
      stateEval = interpolateNodeStates(node, 0, 0, 0);
      stateEval.relAttRad.h = rotorAngleRad;
      break;
    }
    case 4: {
      // Spoiler / Airbrake
      if (node.states.length >= 2) {
        stateEval = interpolateNodeStates(node, 0, 1, controls.spoiler);
      }
      break;
    }
    case 5: {
      // Flaps
      if (node.states.length >= 2) {
        stateEval = interpolateNodeStates(node, 0, 1, controls.flap);
      }
      break;
    }
    case 6: {
      // Elevator (Pitch)
      if (controls.elevator >= 0) {
        stateEval = interpolateNodeStates(node, 0, 1, controls.elevator);
      } else {
        stateEval = interpolateNodeStates(node, 0, 2, -controls.elevator);
      }
      break;
    }
    case 7: {
      // Ailerons (Roll)
      if (controls.aileron >= 0) {
        stateEval = interpolateNodeStates(node, 0, 1, controls.aileron);
      } else {
        stateEval = interpolateNodeStates(node, 0, 2, -controls.aileron);
      }
      break;
    }
    case 8:
    case 31: {
      // Rudder / Nosewheel steering (Yaw)
      if (controls.rudder >= 0) {
        stateEval = interpolateNodeStates(node, 0, 1, controls.rudder);
      } else {
        stateEval = interpolateNodeStates(node, 0, 2, -controls.rudder);
      }
      break;
    }
    case 9: {
      // Bomb Bay Doors / Cabin Doors / Cargo Ramp
      if (node.states.length >= 2) {
        stateEval = interpolateNodeStates(node, 0, 1, controls.bombBay);
      }
      break;
    }
    case 10: {
      // Sliding Doors / Landing Lights / Thrust Vectoring (Helicopters S-70, UH-1H, Super Lynx)
      if (node.states.length >= 2) {
        stateEval = interpolateNodeStates(node, 0, 1, controls.doorsAndLights);
      }
      break;
    }
    case 11: {
      // Drag Chute / Brake Chute (Mirage, F-5)
      if (node.states.length >= 2) {
        stateEval = interpolateNodeStates(node, 0, 1, controls.brakeChuteAndHook);
      }
      if (controls.brakeChuteAndHook < 0.1 && node.states.length >= 2 && node.states[0].visible === 0) {
        stateEval.show = false;
      }
      break;
    }
    case 14: {
      // Inner Landing Gear Doors (temporary open: 0..0.2 opens, 0.2..0.8 open, 0.8..1.0 closes)
      if (node.states.length >= 2) {
        const g = controls.gear;
        let doorParam = 0;
        if (g < 0.2) {
          doorParam = g / 0.2;
        } else if (g < 0.8) {
          doorParam = 1.0;
        } else {
          doorParam = (1.0 - g) / 0.2;
        }
        stateEval = interpolateNodeStates(node, 0, 1, doorParam);
      }
      break;
    }
    case 15: {
      // Gear Room / Secondary Bay (e.g., ERJ-145, R-99)
      if (node.states.length >= 2) {
        const bayParam = Math.max(0, Math.min(1, controls.gear / 0.6));
        stateEval = interpolateNodeStates(node, 0, 1, bayParam);
      }
      break;
    }
    case 16: {
      // Tailhook (Arresting hook for carrier landings, e.g. AF-1 Falcão)
      if (node.states.length >= 2) {
        stateEval = interpolateNodeStates(node, 0, 1, controls.brakeChuteAndHook);
      }
      break;
    }
    case 17: {
      // Fast Outer Gear Doors (opens 0..0.2, stays open)
      if (node.states.length >= 2) {
        const fastParam = Math.max(0, Math.min(1, controls.gear / 0.2));
        stateEval = interpolateNodeStates(node, 0, 1, fastParam);
      }
      break;
    }
    case 18: {
      // Slow / Static Propeller Blades
      const effectiveThr = controls.engineRunning ? controls.throttle : 0;
      stateEval.show = effectiveThr <= 0.6;
      break;
    }
    case 20: {
      // Fast Propeller Blurred Disc
      const effectiveThr = controls.engineRunning ? controls.throttle : 0;
      stateEval.show = effectiveThr > 0.3;
      break;
    }
    default:
      break;
  }

  // Step 2: Build transformation matrix matching DnmState::CacheTransformation(node)
  const ym = new YsMatrix4();
  ym.loadIdentity();
  ym.translate(node.pos.pos.x, node.pos.pos.y, node.pos.pos.z);

  ym.rotateXZ(ysIntToRad(node.pos.att.h));
  ym.rotateZY(ysIntToRad(node.pos.att.p));
  ym.rotateXY(ysIntToRad(node.pos.att.b));

  ym.translate(stateEval.relPos.x, stateEval.relPos.y, stateEval.relPos.z);

  ym.rotateXZ(stateEval.relAttRad.h);
  ym.rotateZY(stateEval.relAttRad.p);
  ym.rotateXY(stateEval.relAttRad.b);

  ym.translate(-node.cnt.x, -node.cnt.y, -node.cnt.z);

  ym.toThreeMatrix4(outMatrix);

  return {
    visible: stateEval.show,
    matrix: outMatrix,
  };
}

export interface BuiltSrfGeometries {
  opaqueGeometry: THREE.BufferGeometry | null;
  transparentGeometry: THREE.BufferGeometry | null;
  /** Average alpha opacity (0..1) for transparent polygons */
  transparentOpacity: number;
}

/**
 * Builds Three.js BufferGeometries (opaque and transparent ZA subsets) from SrfMeshData.
 * Handles vertex 'R' smooth normal averaging, explicit face normals, vertex colors,
 * and Left-Handed to Right-Handed coordinate conversion.
 */
export function buildSrfGeometries(
  mesh: SrfMeshData,
  forceFlatShading = false
): BuiltSrfGeometries {
  if (mesh.polygons.length === 0 || mesh.vertices.length === 0) {
    return {
      opaqueGeometry: null,
      transparentGeometry: null,
      transparentOpacity: 0.45,
    };
  }

  // 1. Compute valid face normals in YSFlight coordinates
  const faceNormals: Vec3[] = mesh.polygons.map((poly) => {
    const nLen = Math.hypot(poly.normal.x, poly.normal.y, poly.normal.z);
    if (nLen > 1e-5) {
      return {
        x: poly.normal.x / nLen,
        y: poly.normal.y / nLen,
        z: poly.normal.z / nLen,
      };
    }
    // Fallback: compute geometric normal from first 3 vertices
    const v0 = mesh.vertices[poly.vertexIndices[0]];
    const v1 = mesh.vertices[poly.vertexIndices[1]];
    const v2 = mesh.vertices[poly.vertexIndices[2]];
    if (!v0 || !v1 || !v2) return { x: 0, y: 1, z: 0 };

    const ux = v1.x - v0.x, uy = v1.y - v0.y, uz = v1.z - v0.z;
    const vx = v2.x - v0.x, vy = v2.y - v0.y, vz = v2.z - v0.z;
    // In Left-Handed YSFlight polygon winding, normal is (v1 - v0) x (v2 - v0) or reversed
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    return { x: nx / len, y: ny / len, z: nz / len };
  });

  // 2. Accumulate smooth vertex normals for vertices marked with 'R'
  const smoothNormals: Vec3[] = mesh.vertices.map(() => ({ x: 0, y: 0, z: 0 }));
  for (let pIdx = 0; pIdx < mesh.polygons.length; pIdx++) {
    const poly = mesh.polygons[pIdx];
    const fn = faceNormals[pIdx];
    for (const vIdx of poly.vertexIndices) {
      if (vIdx >= 0 && vIdx < smoothNormals.length) {
        smoothNormals[vIdx].x += fn.x;
        smoothNormals[vIdx].y += fn.y;
        smoothNormals[vIdx].z += fn.z;
      }
    }
  }
  for (const sn of smoothNormals) {
    const len = Math.hypot(sn.x, sn.y, sn.z);
    if (len > 1e-6) {
      sn.x /= len;
      sn.y /= len;
      sn.z /= len;
    } else {
      sn.y = 1;
    }
  }

  // 3. Separate triangles into opaque and transparent buffers
  const opaquePos: number[] = [];
  const opaqueNorm: number[] = [];
  const opaqueCol: number[] = [];

  const transPos: number[] = [];
  const transNorm: number[] = [];
  const transCol: number[] = [];
  let transAlphaSum = 0;
  let transPolyCount = 0;

  for (let pIdx = 0; pIdx < mesh.polygons.length; pIdx++) {
    const poly = mesh.polygons[pIdx];
    const vIndices = poly.vertexIndices;
    if (vIndices.length < 3) continue;

    const isTrans = poly.zaAlpha !== undefined && poly.zaAlpha > 0;
    const posArr = isTrans ? transPos : opaquePos;
    const normArr = isTrans ? transNorm : opaqueNorm;
    const colArr = isTrans ? transCol : opaqueCol;

    if (isTrans && poly.zaAlpha !== undefined) {
      // In YSFlight ZA, values like 140-150 represent semi-transparent glass/propeller disc (~0.42 opacity)
      transAlphaSum += Math.max(0.15, Math.min(0.95, 1.0 - poly.zaAlpha / 255.0));
      transPolyCount++;
    }

    // Convert sRGB 0..255 to linear/normalized 0..1
    const r = poly.color[0] / 255.0;
    const g = poly.color[1] / 255.0;
    const b = poly.color[2] / 255.0;
    const fn = faceNormals[pIdx];

    // Fan triangulation from vIndices[0]
    // Because we reflect X -> -X, we reverse triangle winding (0, k+1, k) to preserve outward front faces
    const i0 = vIndices[0];
    for (let k = 1; k + 1 < vIndices.length; k++) {
      const i1 = vIndices[k];
      const i2 = vIndices[k + 1];
      const tri = [i0, i2, i1];

      for (const vi of tri) {
        const v = mesh.vertices[vi];
        if (!v) continue;
        // Reflect X -> -X for Right-Handed Three.js space
        posArr.push(-v.x, v.y, v.z);

        const useSmooth = !forceFlatShading && v.round;
        const n = useSmooth ? smoothNormals[vi] : fn;
        normArr.push(-n.x, n.y, n.z);

        colArr.push(r, g, b);
      }
    }
  }

  const makeBufferGeo = (pos: number[], norm: number[], col: number[]): THREE.BufferGeometry | null => {
    if (pos.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
  };

  return {
    opaqueGeometry: makeBufferGeo(opaquePos, opaqueNorm, opaqueCol),
    transparentGeometry: makeBufferGeo(transPos, transNorm, transCol),
    transparentOpacity: transPolyCount > 0 ? transAlphaSum / transPolyCount : 0.45,
  };
}

/**
 * Human-readable metadata for YSFlight CLA animation channel IDs
 */
export function getClaChannelInfo(
  cla: number,
  nst: number
): { label: string; category: 'static' | 'control' | 'gear' | 'prop' } {
  if (cla === 0) {
    if (nst >= 2) {
      return { label: 'CLA 0 • Trem de Pouso Principal', category: 'gear' };
    }
    return { label: 'CLA 0 • Estrutura Estática / Fuselagem', category: 'static' };
  }
  switch (cla) {
    case 1:
      return { label: 'CLA 1 • Asa de Geom. Variável / Hélice', category: 'control' };
    case 2:
      return { label: 'CLA 2 • Pós-Combustor (Afterburner)', category: 'prop' };
    case 3:
      return { label: 'CLA 3 • Eixo Rotativo da Hélice / Rotor', category: 'prop' };
    case 4:
      return { label: 'CLA 4 • Spoiler / Freio Aerodinâmico', category: 'control' };
    case 5:
      return { label: 'CLA 5 • Flaps de Sustentação', category: 'control' };
    case 6:
      return { label: 'CLA 6 • Profundor (Elevator - Arfagem)', category: 'control' };
    case 7:
      return { label: 'CLA 7 • Aileron (Rolamento)', category: 'control' };
    case 8:
      return { label: 'CLA 8 • Leme de Direção (Rudder - Guinada)', category: 'control' };
    case 9:
      return { label: 'CLA 9 • Baia de Bombas / Portas de Carga', category: 'control' };
    case 10:
      return { label: 'CLA 10 • Portas Deslizantes / Faróis / Vetor', category: 'control' };
    case 11:
      return { label: 'CLA 11 • Paraquedas de Frenagem (Drag Chute)', category: 'control' };
    case 14:
      return { label: 'CLA 14 • Portas Internas do Trem (Ciclo 0..1)', category: 'gear' };
    case 15:
      return { label: 'CLA 15 • Compartimento do Trem (Gear Bay)', category: 'gear' };
    case 16:
      return { label: 'CLA 16 • Gancho de Parada (Tailhook Naval)', category: 'control' };
    case 17:
      return { label: 'CLA 17 • Portas Rápidas do Trem (0..0.2)', category: 'gear' };
    case 18:
      return { label: 'CLA 18 • Hélice Baixa Rotação (Pás Sólidas)', category: 'prop' };
    case 20:
      return { label: 'CLA 20 • Hélice Alta Rotação (Disco Blur)', category: 'prop' };
    case 31:
      return { label: 'CLA 31 • Bequilha Direcional (Steering)', category: 'control' };
    default:
      return { label: `CLA ${cla} • Canal Dinâmico`, category: 'control' };
  }
}
