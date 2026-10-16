import { AircraftDatData, Vec3 } from '../types/ysflight';

function fmtCoord(val?: number): string {
  if (val === undefined || isNaN(val)) return '0.00m';
  return `${val.toFixed(2)}m`;
}

function fmtAngle(val?: number): string {
  if (val === undefined || isNaN(val)) return '0.0deg';
  return `${val.toFixed(1)}deg`;
}

function fmtVec3(v?: Vec3): string {
  if (!v) return '0.00m  0.00m  0.00m';
  return `${fmtCoord(v.x)}  ${fmtCoord(v.y)}  ${fmtCoord(v.z)}`;
}

/**
 * Serializes an AircraftDatData object into standard, clean, readable YSFlight .dat text.
 */
export function serializeDatText(data: AircraftDatData): string {
  const lines: string[] = [];

  const add = (cmd: string, val: string, comment?: string) => {
    const base = `${cmd.padEnd(8)} ${val}`;
    if (comment) {
      lines.push(`${base.padEnd(36)} #${comment}`);
    } else {
      lines.push(base);
    }
  };

  const addRem = (text: string) => {
    lines.push(`REM ${text}`);
  };

  const addBlank = () => {
    lines.push('');
  };

  // Header
  addRem('========================================================================');
  addRem(`YSFlight Aircraft Definition File: ${data.identify}`);
  addRem('Exported by AirViewer — Advanced YSFlight Aircraft Inspector & Editor');
  addRem('========================================================================');
  addBlank();

  // 1. Identificação & Classificação
  addRem('--- IDENTIFICAÇÃO & CLASSIFICAÇÃO ---');
  add('IDENTIFY', `"${data.identify}"`, 'Nome exibido no simulador');
  add('CATEGORY', data.category || 'NORMAL', 'Categoria de missão');
  if (data.airClass && data.airClass !== 'AIRPLANE') {
    add('AIRCLASS', data.airClass, 'Tipo de aeronave');
  }
  add('STRENGTH', String(Math.round(data.strength || 1)), 'Pontos de integridade estrutural');
  add('RADARCRS', (data.radarCrossSection ?? 1.0).toFixed(3), 'Seção transversal radar (RCS m^2)');
  addBlank();

  // 2. Propulsão & Motores
  addRem('--- PROPULSÃO & MOTORES ---');
  if (data.propulsionType === 'propeller') {
    const hpStr = data.propellerPowerRaw || `${Math.round(data.propellerPowerHp || 750)}hp`;
    add('PROPELLR', hpStr, 'Potência do motor da hélice');
    add('PROPEFCY', (data.propellerEfficiency ?? 0.75).toFixed(2), 'Eficiência aerodinâmica da hélice (0..1)');
    add('PROPVMIN', `${Math.round(data.propellerVMinMs || 15)}m/s`, 'Velocidade mínima para T=P/V');
  } else {
    const milThrust = data.thrustMilitaryRaw || `${Math.round(data.thrustMilitaryKg || 5000)}kg`;
    add('THRMILIT', milThrust, 'Empuxo máximo a potência militar seca');
    add('AFTBURNR', data.hasAfterburner ? 'TRUE' : 'FALSE', 'Possui pós-combustor (Afterburner)');
    if (data.hasAfterburner) {
      const abThrust = data.thrustAfterburnerRaw || `${Math.round(data.thrustAfterburnerKg || 8000)}kg`;
      add('THRAFTBN', abThrust, 'Empuxo máximo com pós-combustor');
    }
    if ((data.thrustReverserEfficiency ?? 0) > 0) {
      add('THRSTREV', data.thrustReverserEfficiency!.toFixed(2), 'Eficiência do reversor de empuxo');
    }
  }

  add('FUELMILI', `${(data.fuelConsumptionKgSec || 0.5).toFixed(2)}kg`, 'Consumo de combustível militar (kg/s)');
  if (data.hasAfterburner && (data.fuelConsumptionAfterburnerKgSec ?? 0) > 0) {
    add('FUELABRN', `${data.fuelConsumptionAfterburnerKgSec!.toFixed(2)}kg`, 'Consumo com pós-combustor (kg/s)');
  }

  if (data.hasThrustVectoring) {
    add('TRSTVCTR', 'TRUE', 'Capacidade de empuxo vetorado');
    if (data.thrustDir0) add('TRSTDIR0', fmtVec3(data.thrustDir0), 'Direção do vetor 0');
    if (data.thrustDir1) add('TRSTDIR1', fmtVec3(data.thrustDir1), 'Direção do vetor 1');
    add('PSTMPTCH', fmtAngle(data.postStallPitchDeg || 38), 'Arfagem em manobra pós-estol');
    add('PSTMYAW_', fmtAngle(data.postStallYawDeg || 38), 'Guinada em manobra pós-estol');
    add('PSTMROLL', fmtAngle(data.postStallRollDeg || 90), 'Rolamento em manobra pós-estol');
  }
  addBlank();

  // 3. Pesos & Balanceamento
  addRem('--- PESOS & BALANCEAMENTO ---');
  add('WEIGHCLN', `${data.weightCleanTon.toFixed(2)}t`, 'Peso vazio / limpo operacional');
  add('WEIGFUEL', `${data.weightFuelTon.toFixed(2)}t`, 'Capacidade máxima de combustível');
  add('WEIGLOAD', `${data.weightPayloadTon.toFixed(2)}t`, 'Capacidade máxima de carga paga / armas');
  add('INITFUEL', `${Math.round(data.initialFuelPercent || 100)}%`, 'Percentual de combustível inicial');
  add('INITLOAD', `${(data.initialPayloadTon || 0).toFixed(2)}t`, 'Carga útil pré-carregada');
  addBlank();

  // 4. Aerodinâmica, Estol & Estabilidade
  addRem('--- AERODINÂMICA & ESTABILIDADE ---');
  add('WINGAREA', `${data.wingAreaM2.toFixed(1)}m^2`, 'Área alar efetiva');
  add('CRITAOAP', fmtAngle(data.critAoaPosDeg), 'Ângulo de ataque crítico positivo (Estol)');
  add('CRITAOAM', fmtAngle(data.critAoaNegDeg), 'Ângulo de ataque crítico negativo');
  add('CRITSPED', data.critSpeed || '0.8MACH', 'Velocidade crítica de compressibilidade');
  add('MAXSPEED', data.maxSpeed || '0.9MACH', 'Velocidade máxima permitida (VNE)');
  add('MANESPD1', data.maneSpeed1 || '80kt', 'Velocidade mínima de controle de superfícies');
  add('MANESPD2', data.maneSpeed2 || '130kt', 'Velocidade de controle pleno');

  add('CLBYFLAP', data.clByFlap.toFixed(2), 'Efeito dos flaps na sustentação (Delta Cl)');
  add('CDBYFLAP', data.cdByFlap.toFixed(2), 'Efeito dos flaps no arrasto (Delta Cd)');
  add('CDBYGEAR', data.cdByGear.toFixed(2), 'Arrasto induzido pelo trem de pouso estendido');
  add('CDSPOILR', data.cdBySpoiler.toFixed(2), 'Arrasto induzido pelos freios aerodinâmicos');

  add('HASSPOIL', data.hasSpoiler ? 'TRUE' : 'FALSE', 'Possui spoiler / freio aerodinâmico');
  add('RETRGEAR', data.hasRetractableGear ? 'TRUE' : 'FALSE', 'Possui trem de pouso retrátil');
  add('VARGEOMW', data.hasVariableGeometryWing ? 'TRUE' : 'FALSE', 'Possui asa de geometria variável');
  if (data.hasVariableGeometryWing) {
    add('CLVARGEO', data.clVarGeom.toFixed(2), 'Efeito da geometria variável no Cl');
    add('CDVARGEO', data.cdVarGeom.toFixed(2), 'Efeito da geometria variável no Cd');
    if (data.vgwSpeed1) add('VGWSPED1', data.vgwSpeed1, 'Velocidade de transição VGW 1');
    if (data.vgwSpeed2) add('VGWSPED2', data.vgwSpeed2, 'Velocidade de transição VGW 2');
  }

  add('CPITMANE', data.pitchManeuverability.toFixed(1), 'Constante de autoridade de arfagem');
  add('CPITSTAB', data.pitchStability.toFixed(1), 'Constante de estabilidade estática longitudinal');
  add('CYAWMANE', data.yawManeuverability.toFixed(1), 'Constante de autoridade de guinada');
  add('CYAWSTAB', data.yawStability.toFixed(1), 'Constante de estabilidade direcional');
  add('CROLLMAN', data.rollManeuverability.toFixed(1), 'Constante de taxa de rolamento');

  add('MXIPTAOA', fmtAngle(data.maxInputAoaDeg), 'Limite de comando de ângulo de ataque');
  add('MXIPTSSA', fmtAngle(data.maxInputSsaDeg), 'Limite de comando de derrapagem lateral (SSA)');
  add('MXIPTROL', fmtAngle(data.maxInputRollDeg), 'Limite de taxa de comando de rolamento');
  addBlank();

  // 5. Pontos Espaciais 3D & Cockpit
  addRem('--- COORDENADAS 3D, COCKPIT & TRENS DE POUSO ---');
  add('HTRADIUS', fmtCoord(data.outsideRadiusM), 'Raio da esfera envolvente de impacto');
  if (data.points3D.cockpit) {
    add('COCKPITP', fmtVec3(data.points3D.cockpit), 'Posição dos olhos do piloto (X Y Z)');
  }
  if (data.points3D.wheelGear) {
    add('WHELGEAR', fmtVec3(data.points3D.wheelGear), 'Posição da bequilha dianteira/nariz');
  }
  if (data.points3D.leftGear) {
    add('LEFTGEAR', fmtVec3(data.points3D.leftGear), 'Posição do trem principal esquerdo');
  }
  if (data.points3D.rightGear) {
    add('RIGHGEAR', fmtVec3(data.points3D.rightGear), 'Posição do trem principal direito');
  }
  if (data.points3D.arrester) {
    add('ARRESTER', fmtVec3(data.points3D.arrester), 'Posição do gancho naval de parada');
  }
  if (data.points3D.smokeGen) {
    add('SMOKEGEN', fmtVec3(data.points3D.smokeGen), 'Posição do bocal de fumaça');
    if ((data.points3D.smokeOilKg ?? 0) > 0) {
      add('SMOKEOIL', `${data.points3D.smokeOilKg!.toFixed(1)}kg`, 'Capacidade de óleo para fumaça');
    }
  }
  if (data.points3D.vapor0) {
    add('VAPORPO0', fmtVec3(data.points3D.vapor0), 'Vórtice de condensação asa direita');
  }
  if (data.points3D.vapor1) {
    add('VAPORPO1', fmtVec3(data.points3D.vapor1), 'Vórtice de condensação asa esquerda');
  }
  if (data.points3D.flarePos) {
    add('FLAREPOS', fmtVec3(data.points3D.flarePos), 'Posição do lançador de flares');
  }

  // Câmeras extras
  for (const cam of data.extraCameras) {
    const posStr = `${fmtCoord(cam.pos.x)}  ${fmtCoord(cam.pos.y)}  ${fmtCoord(cam.pos.z)}`;
    const attStr = `${fmtAngle(cam.att.h)}  ${fmtAngle(cam.att.p)}  ${fmtAngle(cam.att.b)}`;
    lines.push(`EXCAMERA "${cam.name}" ${posStr} ${attStr} ${cam.mode}`);
  }

  // Torretas
  for (const t of data.turrets) {
    if (t.pos) {
      lines.push(`TURRETPO ${t.index} ${fmtVec3(t.pos)} 0deg 0deg 0deg`);
    }
    if (t.pitchLimits) {
      lines.push(`TURRETPT ${t.index} ${fmtAngle(t.pitchLimits.min)} ${fmtAngle(t.pitchLimits.max)} ${fmtAngle(t.pitchLimits.neutral)}`);
    }
    if (t.hdgLimits) {
      lines.push(`TURRETHD ${t.index} ${fmtAngle(t.hdgLimits.min)} ${fmtAngle(t.hdgLimits.max)} ${fmtAngle(t.hdgLimits.neutral)}`);
    }
    if (t.ammo !== undefined) lines.push(`TURRETAM ${t.index} ${t.ammo}`);
    if (t.intervalSec !== undefined) lines.push(`TURRETIV ${t.index} ${t.intervalSec}sec`);
    if (t.nodeName) lines.push(`TURRETNM ${t.index} ${t.nodeName}`);
    if (t.antiAir !== undefined) lines.push(`TURRETAR ${t.index} ${t.antiAir}`);
    if (t.controlledBy) lines.push(`TURRETCT ${t.index} ${t.controlledBy}`);
  }
  addBlank();

  // 6. Armamento, Aviônica & Gatilhos
  addRem('--- ARMAMENTO, SISTEMAS DE FOGO & GATILHOS ---');
  if (data.points3D.machineGun) {
    add('MACHNGUN', fmtVec3(data.points3D.machineGun), 'Posição do canhão / metralhadora 1');
  }
  if (data.points3D.machineGun2) {
    add('MACHNGN2', fmtVec3(data.points3D.machineGun2), 'Posição da metralhadora 2');
  }
  add('INITIGUN', String(data.initGunRounds), 'Munição inicial do canhão');
  add('GUNPOWER', String(data.gunPower), 'Dano por projétil');
  add('GUNINTVL', data.gunIntervalSec.toFixed(3), 'Intervalo entre disparos (s)');
  add('GUNSIGHT', data.hasGunSight ? 'TRUE' : 'FALSE', 'Exibir retículo de mira HUD');

  if (data.maxAam > 0 || data.initAam > 0) {
    add('INITIAAM', String(data.initAam), 'Mísseis ar-ar iniciais');
    add('MAXNMAAM', String(data.maxAam), 'Capacidade máxima de mísseis ar-ar');
  }
  if (data.maxAgm > 0 || data.initAgm > 0) {
    add('INITIAGM', String(data.initAgm), 'Mísseis ar-terra iniciais');
    add('MAXNMAGM', String(data.maxAgm), 'Capacidade máxima de mísseis ar-terra');
  }
  if (data.maxBomb > 0 || data.initBomb > 0) {
    add('INITBOMB', String(data.initBomb), 'Bombas convencionais iniciais');
    add('MAXNBOMB', String(data.maxBomb), 'Capacidade máxima de bombas');
  }
  if (data.maxBomb250 > 0 || data.initBomb250 > 0) {
    add('INITB250', String(data.initBomb250), 'Bombas pesadas (250kg) iniciais');
    add('MAXNB250', String(data.maxBomb250), 'Capacidade máxima de bombas 250kg');
  }
  if (data.maxRockets > 0 || data.initRockets > 0) {
    add('INITRCKT', String(data.initRockets), 'Foguetes não-guiados iniciais');
    add('MAXNMRKT', String(data.maxRockets), 'Capacidade máxima de foguetes');
    add('RKTVISIB', data.isRocketsVisible ? 'TRUE' : 'FALSE', 'Pods de foguetes visíveis externamente');
  }
  if (data.maxFlares > 0) {
    add('MAXNMFLR', String(data.maxFlares), 'Contramedidas / Flares disponíveis');
  }

  if (data.limitByHardpoints) {
    add('LMTBYHDP', 'TRUE', 'Limitar armamento pela capacidade dos hardpoints');
  }
  for (const hw of data.hardpointWeapons) {
    lines.push(`LOADWEPN ${hw.weapon} ${hw.count}`);
  }

  if (data.triggers.trigger1) add('TRIGGER1', data.triggers.trigger1, 'Gatilho 1');
  if (data.triggers.trigger2) add('TRIGGER2', data.triggers.trigger2, 'Gatilho 2');
  if (data.triggers.trigger3) add('TRIGGER3', data.triggers.trigger3, 'Gatilho 3');
  if (data.triggers.trigger4) add('TRIGGER4', data.triggers.trigger4, 'Gatilho 4');

  if (data.weaponCycleOrder.length > 0) {
    lines.push(`WEAPONCH ${data.weaponCycleOrder.join(' ')}`);
  }
  addBlank();

  // 7. Operações de Voo & Referências
  addRem('--- REFERÊNCIAS OPERACIONAIS DE VOO & POUSO ---');
  add('REFVCRUS', data.refCruisingSpeed || '140kt', 'Velocidade de cruzeiro de referência');
  add('REFACRUS', data.refCruisingAlt || '8000ft', 'Altitude de cruzeiro de referência');
  add('REFTCRUS', data.refCruisingThrottle.toFixed(2), 'Potência recomendada em cruzeiro');
  add('REFVLAND', data.refLandingSpeed || '85kt', 'Velocidade de aproximação e toque');
  add('REFAOALD', fmtAngle(data.refLandingAoaDeg), 'Atitude / AOA no toque na pista');
  add('REFTHRLD', data.refLandingThrottle.toFixed(2), 'Potência recomendada na rampa de planeio');
  add('REFLNRWY', `${Math.round(data.refRunwayM)}m`, 'Comprimento mínimo de pista requerido');

  if (data.autoCalc) {
    lines.push('AUTOCALC');
  }
  if (data.hasInstrumentPanel) {
    lines.push('INSTPANL');
  }

  return lines.join('\n');
}
