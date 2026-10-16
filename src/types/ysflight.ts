export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Att3 {
  /** Heading in YSFlight integer units (65536 = 360 deg) */
  h: number;
  /** Pitch in YSFlight integer units (65536 = 360 deg) */
  p: number;
  /** Bank in YSFlight integer units (65536 = 360 deg) */
  b: number;
}

export interface SrfVertex {
  x: number;
  y: number;
  z: number;
  /** Smooth shading flag ('R' in .srf) */
  round: boolean;
}

export interface SrfPolygon {
  index: number;
  color: [number, number, number]; // RGB 0..255
  center: Vec3;
  normal: Vec3;
  vertexIndices: number[];
  /** Transparency from ZA command (0 = opaque, 255 = fully transparent). Undefined means opaque (0). */
  zaAlpha?: number;
  /** Light sprite flag from ZL command */
  brightLight?: boolean;
  /** Unshaded / self-illuminated flag from B command inside face */
  unshaded?: boolean;
}

export interface SrfMeshData {
  name: string;
  vertices: SrfVertex[];
  polygons: SrfPolygon[];
  boundingBox: {
    min: Vec3;
    max: Vec3;
  };
}

export interface DnmStateTransform {
  pos: Vec3;
  att: Att3;
  /** 1 = visible, 0 = hidden */
  visible: number;
}

export interface DnmNode {
  /** Node identifier string from SRF "id" */
  name: string;
  /** Referenced PCK / SRF filename from FIL */
  fileName: string;
  /** Animation channel ID from CLA */
  cla: number;
  /** Number of states from NST */
  nst: number;
  /** Array of animation states from STA */
  states: DnmStateTransform[];
  /** Base position and attitude in parent from POS */
  pos: DnmStateTransform;
  /** Local rotation center / pivot from CNT */
  cnt: Vec3;
  /** Relation type (usually DEP) */
  rel: string;
  /** Child node names from CLD */
  childrenNames: string[];
}

export interface DnmModelData {
  version: number;
  /** All embedded PCK meshes keyed by filename */
  pckMeshes: Record<string, SrfMeshData>;
  /** Ordered list of all PCK mesh names */
  pckOrder: string[];
  /** Scene graph nodes defined at the bottom of the DNM */
  nodes: DnmNode[];
  /** Root node names (nodes that are not children of any other node) */
  rootNodeNames: string[];
  /** PCK meshes that are never referenced by any SRF node */
  unreferencedPcks: string[];
}

export interface DatPropertyEntry {
  key: string;
  rawValue: string;
  comment?: string;
  line: number;
}

export interface AircraftDatData {
  identify: string;
  category: string;
  enginePower: string;
  hasAfterburner: boolean;
  weightCleanTon: number;
  weightFuelTon: number;
  weightPayloadTon: number;
  fuelConsumptionKgSec: number;
  wingAreaM2: number;
  critSpeed: string;
  maxSpeed: string;
  critAoaPosDeg: number;
  critAoaNegDeg: number;
  maxInputAoaDeg: number;
  maxInputSsaDeg: number;
  maxInputRollDeg: number;
  maneSpeed1: string;
  maneSpeed2: string;
  refCruisingSpeed: string;
  refCruisingAlt: string;
  refLandingSpeed: string;
  refLandingAoaDeg: number;
  refRunwayM: number;
  outsideRadiusM: number;
  hasSpoiler: boolean;
  hasRetractableGear: boolean;
  hasVariableGeometryWing: boolean;
  strength: number;
  radarCrossSection: number;
  points3D: {
    cockpit?: Vec3;
    leftGear?: Vec3;
    rightGear?: Vec3;
    wheelGear?: Vec3;
    arrester?: Vec3;
    machineGun?: Vec3;
    smokeGen?: Vec3;
    vapor0?: Vec3;
    vapor1?: Vec3;
  };
  rawEntries: DatPropertyEntry[];
}

export interface FlightControlState {
  /** Aileron input: -1 (left roll) to +1 (right roll) */
  aileron: number;
  /** Elevator input: -1 (pitch down / nose down) to +1 (pitch up / pull back) */
  elevator: number;
  /** Rudder input: -1 (yaw left) to +1 (yaw right) */
  rudder: number;
  /** Landing gear extension: 0 (retracted / STA 0) to 1 (extended / STA 1) */
  gear: number;
  /** Engine throttle: 0 to 1 */
  throttle: number;
  /** Engine running master switch */
  engineRunning: boolean;
  /** Variable Geometry Wing / Flap / Brake auxiliary channels (0 to 1) */
  vgw: number;
  flap: number;
  spoiler: number;
  /** Auto-demo pre-flight check animation active */
  autoDemo: boolean;
  /** Target gear state for smooth toggle animation (0 or 1) */
  gearTarget: number;
}

export type CameraPreset = 'hangar' | 'cockpit' | 'front' | 'side' | 'top' | 'tail';
