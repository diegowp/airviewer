import { AircraftDatData, DatPropertyEntry, Vec3 } from '../types/ysflight';

function parseCoordToken(token: string): number {
  if (!token) return 0;
  const num = parseFloat(token);
  if (isNaN(num)) return 0;
  const lower = token.toLowerCase();
  if (lower.endsWith('ft')) return num * 0.3048;
  if (lower.endsWith('in')) return num * 0.0254;
  return num; // default meters
}

function parseVec3Tokens(args: string[]): Vec3 | undefined {
  if (args.length < 3) return undefined;
  return {
    x: parseCoordToken(args[0]),
    y: parseCoordToken(args[1]),
    z: parseCoordToken(args[2]),
  };
}

/**
 * Parses a YSFlight aircraft .dat specification file.
 */
export function parseDatText(text: string): AircraftDatData {
  const lines = text.split(/\r?\n/);
  const rawEntries: DatPropertyEntry[] = [];

  const data: AircraftDatData = {
    identify: 'Unknown Aircraft',
    category: 'NORMAL',
    enginePower: '-',
    hasAfterburner: false,
    weightCleanTon: 0,
    weightFuelTon: 0,
    weightPayloadTon: 0,
    fuelConsumptionKgSec: 0,
    wingAreaM2: 0,
    critSpeed: '-',
    maxSpeed: '-',
    critAoaPosDeg: 15,
    critAoaNegDeg: -15,
    maxInputAoaDeg: 18,
    maxInputSsaDeg: 15,
    maxInputRollDeg: 90,
    maneSpeed1: '-',
    maneSpeed2: '-',
    refCruisingSpeed: '-',
    refCruisingAlt: '-',
    refLandingSpeed: '-',
    refLandingAoaDeg: 10,
    refRunwayM: 0,
    outsideRadiusM: 5,
    hasSpoiler: false,
    hasRetractableGear: true,
    hasVariableGeometryWing: false,
    strength: 1,
    radarCrossSection: 1,
    points3D: {},
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
      case 'IDENTIFY':
        data.identify = valStr.replace(/^"|"$/g, '');
        break;
      case 'CATEGORY':
        data.category = valStr;
        break;
      case 'AFTBURNR':
        data.hasAfterburner = valStr.toUpperCase() === 'TRUE';
        break;
      case 'PROPELLR':
      case 'THRUSTAB':
      case 'THRMILIT':
        data.enginePower = valStr;
        break;
      case 'WEIGHCLN':
        data.weightCleanTon = parseFloat(valStr) || 0;
        break;
      case 'WEIGFUEL':
        data.weightFuelTon = parseFloat(valStr) || 0;
        break;
      case 'WEIGLOAD':
        data.weightPayloadTon = parseFloat(valStr) || 0;
        break;
      case 'FUELMILI':
        data.fuelConsumptionKgSec = parseFloat(valStr) || 0;
        break;
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
        data.critAoaPosDeg = parseFloat(valStr) || 0;
        break;
      case 'CRITAOAM':
        data.critAoaNegDeg = parseFloat(valStr) || 0;
        break;
      case 'MXIPTAOA':
        data.maxInputAoaDeg = parseFloat(valStr) || 0;
        break;
      case 'MXIPTSSA':
        data.maxInputSsaDeg = parseFloat(valStr) || 0;
        break;
      case 'MXIPTROL':
        data.maxInputRollDeg = parseFloat(valStr) || 0;
        break;
      case 'MANESPD1':
        data.maneSpeed1 = valStr;
        break;
      case 'MANESPD2':
        data.maneSpeed2 = valStr;
        break;
      case 'REFVCRUS':
        data.refCruisingSpeed = valStr;
        break;
      case 'REFACRUS':
        data.refCruisingAlt = valStr;
        break;
      case 'REFVLAND':
        data.refLandingSpeed = valStr;
        break;
      case 'REFAOALD':
        data.refLandingAoaDeg = parseFloat(valStr) || 0;
        break;
      case 'REFLNRWY':
        data.refRunwayM = parseFloat(valStr) || 0;
        break;
      case 'HTRADIUS':
        data.outsideRadiusM = parseCoordToken(valStr);
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
      case 'STRENGTH':
        data.strength = parseFloat(valStr) || 1;
        break;
      case 'RADARCRS':
        data.radarCrossSection = parseFloat(valStr) || 0;
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
      case 'SMOKEGEN':
        data.points3D.smokeGen = parseVec3Tokens(args);
        break;
      case 'VAPORPO0':
        data.points3D.vapor0 = parseVec3Tokens(args);
        break;
      case 'VAPORPO1':
        data.points3D.vapor1 = parseVec3Tokens(args);
        break;
    }
  }

  return data;
}
