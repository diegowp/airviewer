import {
  AircraftDatData,
  Att3,
  DatPropertyEntry,
  ExCameraEntry,
  HardpointWeaponEntry,
  TurretEntry,
  Vec3,
} from '../types/ysflight';

export function parseCoordToken(token: string): number {
  if (!token) return 0;
  const num = parseFloat(token);
  if (isNaN(num)) return 0;
  const lower = token.toLowerCase();
  if (lower.endsWith('ft')) return num * 0.3048;
  if (lower.endsWith('in')) return num * 0.0254;
  return num; // default meters
}

export function parseAngleToken(token: string): number {
  if (!token) return 0;
  const num = parseFloat(token);
  return isNaN(num) ? 0 : num;
}

export function parseWeightTonToken(token: string): number {
  if (!token) return 0;
  const num = parseFloat(token);
  if (isNaN(num)) return 0;
  const lower = token.toLowerCase();
  if (lower.endsWith('kg')) return num / 1000.0;
  if (lower.endsWith('lb') || lower.endsWith('lbs')) return num * 0.000453592;
  return num; // default tons
}

export function parseVec3Tokens(args: string[]): Vec3 | undefined {
  if (args.length < 3) return undefined;
  return {
    x: parseCoordToken(args[0]),
    y: parseCoordToken(args[1]),
    z: parseCoordToken(args[2]),
  };
}

export function parseAtt3Tokens(args: string[]): Att3 | undefined {
  if (args.length < 3) return undefined;
  return {
    h: parseAngleToken(args[0]),
    p: parseAngleToken(args[1]),
    b: parseAngleToken(args[2]),
  };
}

/**
 * Parses a YSFlight aircraft .dat specification file into a fully-typed AircraftDatData structure.
 */
export function parseDatText(text: string): AircraftDatData {
  const lines = text.split(/\r?\n/);
  const rawEntries: DatPropertyEntry[] = [];
  const extraCameras: ExCameraEntry[] = [];
  const turretMap = new Map<number, TurretEntry>();
  const hardpointWeapons: HardpointWeaponEntry[] = [];
  const weaponCycleOrder: string[] = [];

  const data: AircraftDatData = {
    // 1. Identificação & Classificação
    identify: 'Unknown Aircraft',
    category: 'NORMAL',
    airClass: 'AIRPLANE',
    strength: 1,
    radarCrossSection: 1,

    // 2. Propulsão & Motores
    propulsionType: 'propeller',
    enginePower: '-',
    hasAfterburner: false,
    thrustMilitaryKg: 0,
    thrustMilitaryRaw: '',
    thrustAfterburnerKg: 0,
    thrustAfterburnerRaw: '',
    thrustReverserEfficiency: 0,
    fuelConsumptionKgSec: 0,
    fuelConsumptionAfterburnerKgSec: 0,
    propellerPowerHp: 0,
    propellerPowerRaw: '',
    propellerEfficiency: 0.75,
    propellerVMinMs: 15,
    hasThrustVectoring: false,
    postStallPitchDeg: 35,
    postStallYawDeg: 35,
    postStallRollDeg: 90,

    // 3. Pesos & Balanceamento
    weightCleanTon: 1.0,
    weightFuelTon: 0.3,
    weightPayloadTon: 0.5,
    initialFuelPercent: 100,
    initialPayloadTon: 0,

    // 4. Aerodinâmica, Estol & Estabilidade
    wingAreaM2: 15.0,
    critSpeed: '0.8MACH',
    maxSpeed: '0.9MACH',
    critAoaPosDeg: 16,
    critAoaNegDeg: -12,
    maxInputAoaDeg: 20,
    maxInputSsaDeg: 12,
    maxInputRollDeg: 60,
    maneSpeed1: '70kt',
    maneSpeed2: '110kt',
    clByFlap: 0.25,
    cdByFlap: 0.15,
    cdByGear: 0.35,
    cdBySpoiler: 0.7,
    hasSpoiler: false,
    hasRetractableGear: true,
    hasVariableGeometryWing: false,
    clVarGeom: 0,
    cdVarGeom: 0,
    pitchManeuverability: 5.0,
    pitchStability: 8.0,
    yawManeuverability: 4.0,
    yawStability: 5.0,
    rollManeuverability: 3.0,

    // 5. Pontos Espaciais 3D & Visão
    outsideRadiusM: 6.5,
    points3D: {},
    extraCameras,
    turrets: [],

    // 6. Armamento, Aviônica & Gatilhos
    initGunRounds: 0,
    gunPower: 1,
    gunIntervalSec: 0.05,
    hasGunSight: true,
    initAam: 0,
    maxAam: 0,
    initAgm: 0,
    maxAgm: 0,
    initBomb: 0,
    maxBomb: 0,
    initBomb250: 0,
    maxBomb250: 0,
    initRockets: 0,
    maxRockets: 0,
    isRocketsVisible: false,
    maxFlares: 0,
    limitByHardpoints: false,
    hardpointWeapons,
    triggers: {},
    weaponCycleOrder,

    // 7. Operações de Voo & Referências
    refCruisingSpeed: '120kt',
    refCruisingAlt: '5000ft',
    refCruisingThrottle: 0.7,
    refLandingSpeed: '75kt',
    refLandingAoaDeg: 8,
    refLandingThrottle: 0.35,
    refRunwayM: 600,
    autoCalc: true,
    hasInstrumentPanel: false,

    rawEntries,
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('REM')) continue;

    const [beforeComment, ...commentParts] = raw.split('#');
    const clean = beforeComment.trim();
    const comment = commentParts.length > 0 ? commentParts.join('#').trim() : undefined;
    if (!clean) continue;

    const firstSpace = clean.search(/\s/);
    const key = (firstSpace === -1 ? clean : clean.slice(0, firstSpace)).toUpperCase();
    const valStr = firstSpace === -1 ? '' : clean.slice(firstSpace).trim();
    const args = valStr ? valStr.split(/\s+/) : [];

    rawEntries.push({
      key,
      rawValue: valStr,
      comment,
      line: i + 1,
    });

    switch (key) {
      // 1. Identificação & Classificação
      case 'IDENTIFY':
        data.identify = valStr.replace(/^"|"$/g, '');
        break;
      case 'CATEGORY':
        data.category = valStr;
        break;
      case 'AIRCLASS':
        data.airClass = valStr.toUpperCase() === 'HELICOPTER' ? 'HELICOPTER' : 'AIRPLANE';
        break;
      case 'STRENGTH':
        data.strength = parseFloat(valStr) || 1;
        break;
      case 'RADARCRS':
        data.radarCrossSection = parseFloat(valStr) || 0;
        break;

      // 2. Propulsão
      case 'PROPELLR':
        data.propulsionType = 'propeller';
        data.enginePower = valStr;
        data.propellerPowerRaw = valStr;
        data.propellerPowerHp = parseFloat(valStr) || 0;
        break;
      case 'THRMILIT':
        data.propulsionType = 'jet';
        data.enginePower = valStr;
        data.thrustMilitaryRaw = valStr;
        data.thrustMilitaryKg = parseWeightTonToken(valStr) * 1000.0;
        break;
      case 'THRAFTBN':
      case 'THRUSTAB':
        data.hasAfterburner = true;
        data.thrustAfterburnerRaw = valStr;
        data.thrustAfterburnerKg = parseWeightTonToken(valStr) * 1000.0;
        break;
      case 'AFTBURNR':
        data.hasAfterburner = valStr.toUpperCase() === 'TRUE';
        break;
      case 'THRSTREV':
        data.thrustReverserEfficiency = parseFloat(valStr) || 0;
        break;
      case 'FUELMILI':
        data.fuelConsumptionKgSec = parseFloat(valStr) || 0;
        break;
      case 'FUELABRN':
        data.fuelConsumptionAfterburnerKgSec = parseFloat(valStr) || 0;
        break;
      case 'PROPEFCY':
        data.propellerEfficiency = parseFloat(valStr) || 0.75;
        break;
      case 'PROPVMIN':
        data.propellerVMinMs = parseFloat(valStr) || 15;
        break;
      case 'TRSTVCTR':
        data.hasThrustVectoring = valStr.toUpperCase() === 'TRUE';
        break;
      case 'TRSTDIR0':
        data.thrustDir0 = parseVec3Tokens(args);
        break;
      case 'TRSTDIR1':
        data.thrustDir1 = parseVec3Tokens(args);
        break;
      case 'PSTMPTCH':
        data.postStallPitchDeg = parseAngleToken(valStr);
        break;
      case 'PSTMYAW_':
        data.postStallYawDeg = parseAngleToken(valStr);
        break;
      case 'PSTMROLL':
        data.postStallRollDeg = parseAngleToken(valStr);
        break;

      // 3. Pesos
      case 'WEIGHCLN':
        data.weightCleanTon = parseWeightTonToken(valStr);
        break;
      case 'WEIGFUEL':
        data.weightFuelTon = parseWeightTonToken(valStr);
        break;
      case 'WEIGLOAD':
        data.weightPayloadTon = parseWeightTonToken(valStr);
        break;
      case 'INITFUEL':
        data.initialFuelPercent = parseFloat(valStr) || 100;
        break;
      case 'INITLOAD':
        data.initialPayloadTon = parseWeightTonToken(valStr);
        break;

      // 4. Aerodinâmica
      case 'WINGAREA':
        data.wingAreaM2 = parseFloat(valStr) || 0;
        break;
      case 'CRITSPED':
        data.critSpeed = valStr;
        break;
      case 'MAXSPEED':
        data.maxSpeed = valStr;
        break;
      case 'CRITAOAP':
        data.critAoaPosDeg = parseAngleToken(valStr);
        break;
      case 'CRITAOAM':
        data.critAoaNegDeg = parseAngleToken(valStr);
        break;
      case 'MXIPTAOA':
        data.maxInputAoaDeg = parseAngleToken(valStr);
        break;
      case 'MXIPTSSA':
        data.maxInputSsaDeg = parseAngleToken(valStr);
        break;
      case 'MXIPTROL':
        data.maxInputRollDeg = parseAngleToken(valStr);
        break;
      case 'MANESPD1':
        data.maneSpeed1 = valStr;
        break;
      case 'MANESPD2':
        data.maneSpeed2 = valStr;
        break;
      case 'CLBYFLAP':
        data.clByFlap = parseFloat(valStr) || 0;
        break;
      case 'CDBYFLAP':
        data.cdByFlap = parseFloat(valStr) || 0;
        break;
      case 'CDBYGEAR':
        data.cdByGear = parseFloat(valStr) || 0;
        break;
      case 'CDSPOILR':
        data.cdBySpoiler = parseFloat(valStr) || 0;
        break;
      case 'HASSPOIL':
        data.hasSpoiler = valStr.toUpperCase() === 'TRUE';
        break;
      case 'RETRGEAR':
        data.hasRetractableGear = valStr.toUpperCase() === 'TRUE';
        break;
      case 'VARGEOMW':
        data.hasVariableGeometryWing = valStr.toUpperCase() === 'TRUE';
        break;
      case 'CLVARGEO':
        data.clVarGeom = parseFloat(valStr) || 0;
        break;
      case 'CDVARGEO':
        data.cdVarGeom = parseFloat(valStr) || 0;
        break;
      case 'VGWSPED1':
        data.vgwSpeed1 = valStr;
        break;
      case 'VGWSPED2':
        data.vgwSpeed2 = valStr;
        break;
      case 'CPITMANE':
        data.pitchManeuverability = parseFloat(valStr) || 5;
        break;
      case 'CPITSTAB':
        data.pitchStability = parseFloat(valStr) || 8;
        break;
      case 'CYAWMANE':
        data.yawManeuverability = parseFloat(valStr) || 4;
        break;
      case 'CYAWSTAB':
        data.yawStability = parseFloat(valStr) || 5;
        break;
      case 'CROLLMAN':
        data.rollManeuverability = parseFloat(valStr) || 3;
        break;

      // 5. Pontos Espaciais 3D
      case 'HTRADIUS':
        data.outsideRadiusM = parseCoordToken(valStr);
        break;
      case 'COCKPITP':
        data.points3D.cockpit = parseVec3Tokens(args);
        break;
      case 'LEFTGEAR':
        data.points3D.leftGear = parseVec3Tokens(args);
        break;
      case 'RIGHGEAR':
        data.points3D.rightGear = parseVec3Tokens(args);
        break;
      case 'WHELGEAR':
        data.points3D.wheelGear = parseVec3Tokens(args);
        break;
      case 'ARRESTER':
        data.points3D.arrester = parseVec3Tokens(args);
        break;
      case 'MACHNGUN':
        data.points3D.machineGun = parseVec3Tokens(args);
        break;
      case 'MACHNGN2':
        data.points3D.machineGun2 = parseVec3Tokens(args);
        break;
      case 'SMOKEGEN':
        data.points3D.smokeGen = parseVec3Tokens(args);
        break;
      case 'SMOKEOIL':
        data.points3D.smokeOilKg = parseFloat(valStr) || 0;
        break;
      case 'VAPORPO0':
        data.points3D.vapor0 = parseVec3Tokens(args);
        break;
      case 'VAPORPO1':
        data.points3D.vapor1 = parseVec3Tokens(args);
        break;
      case 'FLAREPOS':
        data.points3D.flarePos = parseVec3Tokens(args);
        break;
      case 'EXCAMERA': {
        const match = raw.match(/^EXCAMERA\s+"?([^"]+)"?\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s#]+)/i);
        if (match) {
          extraCameras.push({
            name: match[1],
            pos: {
              x: parseCoordToken(match[2]),
              y: parseCoordToken(match[3]),
              z: parseCoordToken(match[4]),
            },
            att: {
              h: parseAngleToken(match[5]),
              p: parseAngleToken(match[6]),
              b: parseAngleToken(match[7]),
            },
            mode: match[8].toUpperCase() === 'INSIDE' ? 'INSIDE' : 'OUTSIDE',
            comment,
          });
        }
        break;
      }
      case 'TURRETPO': {
        const idx = parseInt(args[0], 10) || 0;
        const cur = turretMap.get(idx) || { index: idx };
        cur.pos = parseVec3Tokens(args.slice(1, 4));
        turretMap.set(idx, cur);
        break;
      }
      case 'TURRETPT': {
        const idx = parseInt(args[0], 10) || 0;
        const cur = turretMap.get(idx) || { index: idx };
        cur.pitchLimits = {
          min: parseAngleToken(args[1]),
          max: parseAngleToken(args[2]),
          neutral: parseAngleToken(args[3]),
        };
        turretMap.set(idx, cur);
        break;
      }
      case 'TURRETHD': {
        const idx = parseInt(args[0], 10) || 0;
        const cur = turretMap.get(idx) || { index: idx };
        cur.hdgLimits = {
          min: parseAngleToken(args[1]),
          max: parseAngleToken(args[2]),
          neutral: parseAngleToken(args[3]),
        };
        turretMap.set(idx, cur);
        break;
      }
      case 'TURRETAM': {
        const idx = parseInt(args[0], 10) || 0;
        const cur = turretMap.get(idx) || { index: idx };
        cur.ammo = parseInt(args[1], 10) || 0;
        turretMap.set(idx, cur);
        break;
      }
      case 'TURRETIV': {
        const idx = parseInt(args[0], 10) || 0;
        const cur = turretMap.get(idx) || { index: idx };
        cur.intervalSec = parseFloat(args[1]) || 1;
        turretMap.set(idx, cur);
        break;
      }
      case 'TURRETNM': {
        const idx = parseInt(args[0], 10) || 0;
        const cur = turretMap.get(idx) || { index: idx };
        cur.nodeName = args[1];
        turretMap.set(idx, cur);
        break;
      }
      case 'TURRETAR': {
        const idx = parseInt(args[0], 10) || 0;
        const cur = turretMap.get(idx) || { index: idx };
        cur.antiAir = parseInt(args[1], 10) || 0;
        turretMap.set(idx, cur);
        break;
      }
      case 'TURRETCT': {
        const idx = parseInt(args[0], 10) || 0;
        const cur = turretMap.get(idx) || { index: idx };
        cur.controlledBy = args[1]?.toUpperCase() === 'GUNNER' ? 'GUNNER' : 'PILOT';
        turretMap.set(idx, cur);
        break;
      }

      // 6. Armamento & Gatilhos
      case 'INITIGUN':
        data.initGunRounds = parseInt(valStr, 10) || 0;
        break;
      case 'GUNPOWER':
        data.gunPower = parseFloat(valStr) || 1;
        break;
      case 'GUNINTVL':
        data.gunIntervalSec = parseFloat(valStr) || 0.05;
        break;
      case 'GUNSIGHT':
        data.hasGunSight = valStr.toUpperCase() === 'TRUE';
        break;
      case 'INITIAAM':
        data.initAam = parseInt(valStr, 10) || 0;
        break;
      case 'MAXNMAAM':
        data.maxAam = parseInt(valStr, 10) || 0;
        break;
      case 'INITIAGM':
        data.initAgm = parseInt(valStr, 10) || 0;
        break;
      case 'MAXNMAGM':
        data.maxAgm = parseInt(valStr, 10) || 0;
        break;
      case 'INITBOMB':
        data.initBomb = parseInt(valStr, 10) || 0;
        break;
      case 'MAXNBOMB':
        data.maxBomb = parseInt(valStr, 10) || 0;
        break;
      case 'INITB250':
        data.initBomb250 = parseInt(valStr, 10) || 0;
        break;
      case 'MAXNB250':
        data.maxBomb250 = parseInt(valStr, 10) || 0;
        break;
      case 'INITRCKT':
        data.initRockets = parseInt(valStr, 10) || 0;
        break;
      case 'MAXNMRKT':
        data.maxRockets = parseInt(valStr, 10) || 0;
        break;
      case 'RKTVISIB':
        data.isRocketsVisible = valStr.toUpperCase() === 'TRUE';
        break;
      case 'MAXNMFLR':
        data.maxFlares = parseInt(valStr, 10) || 0;
        break;
      case 'LMTBYHDP':
        data.limitByHardpoints = valStr.toUpperCase() === 'TRUE';
        break;
      case 'LOADWEPN': {
        if (args.length >= 2) {
          hardpointWeapons.push({
            weapon: args[0],
            count: parseInt(args[1], 10) || 1,
          });
        }
        break;
      }
      case 'TRIGGER1':
        data.triggers.trigger1 = valStr;
        break;
      case 'TRIGGER2':
        data.triggers.trigger2 = valStr;
        break;
      case 'TRIGGER3':
        data.triggers.trigger3 = valStr;
        break;
      case 'TRIGGER4':
        data.triggers.trigger4 = valStr;
        break;
      case 'WEAPONCH':
        data.weaponCycleOrder.push(...args);
        break;

      // 7. Operações de Voo
      case 'REFVCRUS':
        data.refCruisingSpeed = valStr;
        break;
      case 'REFACRUS':
        data.refCruisingAlt = valStr;
        break;
      case 'REFTCRUS':
        data.refCruisingThrottle = parseFloat(valStr) || 0.7;
        break;
      case 'REFVLAND':
        data.refLandingSpeed = valStr;
        break;
      case 'REFAOALD':
        data.refLandingAoaDeg = parseAngleToken(valStr);
        break;
      case 'REFTHRLD':
        data.refLandingThrottle = parseFloat(valStr) || 0.35;
        break;
      case 'REFLNRWY':
        data.refRunwayM = parseFloat(valStr) || 0;
        break;
      case 'AUTOCALC':
        data.autoCalc = true;
        break;
      case 'INSTPANL':
        data.hasInstrumentPanel = true;
        break;
    }
  }

  data.turrets = Array.from(turretMap.values()).sort((a, b) => a.index - b.index);

  return data;
}
