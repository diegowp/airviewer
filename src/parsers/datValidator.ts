import { AircraftDatData } from '../types/ysflight';

export interface ValidationError {
  field: string;
  category:
    | 'identity'
    | 'propulsion'
    | 'weight'
    | 'aero'
    | 'geometry'
    | 'weapons'
    | 'operations';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface ValidationSummary {
  mtowTon: number;
  emptyWeightFraction: number;
  fuelWeightFraction: number;
  payloadWeightFraction: number;
  thrustToWeightRatio?: number;
  powerToWeightHpTon?: number;
  wingLoadingKgM2: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  summary: ValidationSummary;
}

function parseSpeedToKt(str?: string): number | null {
  if (!str) return null;
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  const lower = str.toLowerCase();
  if (lower.includes('mach')) {
    return num * 661.47; // standard sea-level sound speed in knots
  }
  if (lower.includes('km/h') || lower.includes('kmh')) {
    return num * 0.539957;
  }
  if (lower.includes('m/s') || lower.includes('mps')) {
    return num * 1.94384;
  }
  return num; // default knots
}

/**
 * Validates an AircraftDatData specification against physical laws, aeronautical limits and YSFlight conventions.
 */
export function validateAircraftDat(data: AircraftDatData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const info: ValidationError[] = [];

  // --- 1. Identificação ---
  if (!data.identify || data.identify.trim() === '') {
    errors.push({
      field: 'identify',
      category: 'identity',
      severity: 'error',
      message: 'O campo IDENTIFY (nome da aeronave) não pode estar vazio.',
    });
  }

  if (data.strength <= 0) {
    errors.push({
      field: 'strength',
      category: 'identity',
      severity: 'error',
      message: 'A integridade estrutural (STRENGTH) deve ser no mínimo 1.',
    });
  } else if (data.strength > 100) {
    warnings.push({
      field: 'strength',
      category: 'identity',
      severity: 'warning',
      message: `Integridade STRENGTH de ${data.strength} é excepcionalmente alta (típico para caças é 10–25, bombardeiros 30–50).`,
    });
  }

  if (data.radarCrossSection <= 0) {
    warnings.push({
      field: 'radarCrossSection',
      category: 'identity',
      severity: 'warning',
      message: 'A seção de eco radar (RADARCRS) deve ser maior que 0 m².',
    });
  }

  // --- 2. Pesos & Balanceamento ---
  if (data.weightCleanTon <= 0.05) {
    errors.push({
      field: 'weightCleanTon',
      category: 'weight',
      severity: 'error',
      message: 'Peso limpo (WEIGHCLN) deve ser superior a 0.05t (50 kg).',
    });
  }
  if (data.weightFuelTon < 0) {
    errors.push({
      field: 'weightFuelTon',
      category: 'weight',
      severity: 'error',
      message: 'Capacidade de combustível (WEIGFUEL) não pode ser negativa.',
    });
  }
  if (data.weightPayloadTon < 0) {
    errors.push({
      field: 'weightPayloadTon',
      category: 'weight',
      severity: 'error',
      message: 'Capacidade de carga (WEIGLOAD) não pode ser negativa.',
    });
  }
  if (data.initialFuelPercent < 0 || data.initialFuelPercent > 100) {
    warnings.push({
      field: 'initialFuelPercent',
      category: 'weight',
      severity: 'warning',
      message: 'Combustível inicial (INITFUEL) deve estar entre 0% e 100%.',
    });
  }

  const mtowTon = data.weightCleanTon + data.weightFuelTon + data.weightPayloadTon;
  const emptyFrac = mtowTon > 0 ? (data.weightCleanTon / mtowTon) * 100 : 0;
  const fuelFrac = mtowTon > 0 ? (data.weightFuelTon / mtowTon) * 100 : 0;
  const loadFrac = mtowTon > 0 ? (data.weightPayloadTon / mtowTon) * 100 : 0;

  if (data.weightFuelTon + data.weightPayloadTon > data.weightCleanTon * 3.5) {
    warnings.push({
      field: 'weightPayloadTon',
      category: 'weight',
      severity: 'warning',
      message: `Carga útil somada (${(data.weightFuelTon + data.weightPayloadTon).toFixed(1)}t) excede 3.5x o peso vazio (${data.weightCleanTon.toFixed(1)}t), incomum para aeronaves convencionais.`,
    });
  }

  // --- 3. Propulsão & Razão Empuxo/Peso ---
  let twRatio: number | undefined;
  let pwRatio: number | undefined;

  if (data.propulsionType === 'jet') {
    const maxThrust = (data.hasAfterburner && (data.thrustAfterburnerKg ?? 0) > 0)
      ? data.thrustAfterburnerKg!
      : (data.thrustMilitaryKg ?? 0);

    if (maxThrust <= 0) {
      errors.push({
        field: 'thrustMilitaryKg',
        category: 'propulsion',
        severity: 'error',
        message: 'Para aeronaves a jato, o empuxo (THRMILIT) deve ser superior a 0 kg.',
      });
    } else if (mtowTon > 0) {
      twRatio = maxThrust / (mtowTon * 1000.0);
      if (twRatio > 1.8) {
        warnings.push({
          field: 'thrustMilitaryKg',
          category: 'propulsion',
          severity: 'warning',
          message: `Razão Empuxo/Peso excepcional (T/W = ${twRatio.toFixed(2)}). Apenas caças de alta performance com pós-combustor operam próximo de 1.0–1.4.`,
        });
      } else if (twRatio < 0.15) {
        warnings.push({
          field: 'thrustMilitaryKg',
          category: 'propulsion',
          severity: 'warning',
          message: `Razão Empuxo/Peso muito baixa (T/W = ${twRatio.toFixed(2)}). A aeronave pode ter dificuldade na decolagem e subida.`,
        });
      }
    }

    if (data.hasAfterburner && (data.thrustAfterburnerKg ?? 0) < (data.thrustMilitaryKg ?? 0)) {
      warnings.push({
        field: 'thrustAfterburnerKg',
        category: 'propulsion',
        severity: 'warning',
        message: 'O empuxo com pós-combustor (THRAFTBN) deve ser maior ou igual ao empuxo militar (THRMILIT).',
      });
    }
  } else {
    // Propeller
    const hp = data.propellerPowerHp ?? 0;
    const eff = data.propellerEfficiency ?? 0.75;
    if (hp <= 0) {
      errors.push({
        field: 'propellerPowerHp',
        category: 'propulsion',
        severity: 'error',
        message: 'Para aeronaves turboélice/pistão, a potência (PROPELLR) deve ser maior que 0 hp.',
      });
    } else if (mtowTon > 0) {
      pwRatio = hp / mtowTon;
    }
    if (eff < 0.2 || eff > 0.98) {
      warnings.push({
        field: 'propellerEfficiency',
        category: 'propulsion',
        severity: 'warning',
        message: `Eficiência da hélice (PROPEFCY = ${eff}) fora da faixa típica aeronáutica (0.50 a 0.88).`,
      });
    }
  }

  // --- 4. Aerodinâmica ---
  if (data.wingAreaM2 <= 0.5) {
    errors.push({
      field: 'wingAreaM2',
      category: 'aero',
      severity: 'error',
      message: 'Área de asa (WINGAREA) deve ser superior a 0.5 m².',
    });
  }

  const wingLoading = data.wingAreaM2 > 0 ? (mtowTon * 1000.0) / data.wingAreaM2 : 0;

  if (data.critAoaPosDeg <= 0) {
    errors.push({
      field: 'critAoaPosDeg',
      category: 'aero',
      severity: 'error',
      message: 'O ângulo de ataque crítico positivo (CRITAOAP) deve ser positivo (> 0°).',
    });
  }
  if (data.critAoaNegDeg >= 0) {
    errors.push({
      field: 'critAoaNegDeg',
      category: 'aero',
      severity: 'error',
      message: 'O ângulo de ataque crítico negativo (CRITAOAM) deve ser negativo (< 0°).',
    });
  }
  if (data.critAoaPosDeg <= data.critAoaNegDeg) {
    errors.push({
      field: 'critAoaPosDeg',
      category: 'aero',
      severity: 'error',
      message: 'O AOA positivo crítico deve ser maior que o AOA negativo.',
    });
  }

  // Checagem de ordem das velocidades
  const vLand = parseSpeedToKt(data.refLandingSpeed);
  const vMane1 = parseSpeedToKt(data.maneSpeed1);
  const vMane2 = parseSpeedToKt(data.maneSpeed2);
  const vCrus = parseSpeedToKt(data.refCruisingSpeed);
  const vMax = parseSpeedToKt(data.maxSpeed);

  if (vMane1 && vMane2 && vMane1 > vMane2) {
    warnings.push({
      field: 'maneSpeed1',
      category: 'aero',
      severity: 'warning',
      message: `Velocidade mínima manobrável (MANESPD1: ${data.maneSpeed1}) é maior que velocidade plena (MANESPD2: ${data.maneSpeed2}).`,
    });
  }
  if (vCrus && vMax && vCrus > vMax) {
    warnings.push({
      field: 'refCruisingSpeed',
      category: 'operations',
      severity: 'warning',
      message: `Velocidade de cruzeiro (REFVCRUS: ${data.refCruisingSpeed}) excede a velocidade máxima (MAXSPEED: ${data.maxSpeed}).`,
    });
  }
  if (vLand && vCrus && vLand > vCrus) {
    warnings.push({
      field: 'refLandingSpeed',
      category: 'operations',
      severity: 'warning',
      message: `Velocidade de pouso (REFVLAND: ${data.refLandingSpeed}) é superior à de cruzeiro (REFVCRUS: ${data.refCruisingSpeed}).`,
    });
  }

  // --- 5. Geometria Espacial 3D ---
  if (data.outsideRadiusM <= 0.5) {
    errors.push({
      field: 'outsideRadiusM',
      category: 'geometry',
      severity: 'error',
      message: 'O raio da esfera de colisão (HTRADIUS) deve ser no mínimo 0.5m.',
    });
  }

  if (!data.points3D.cockpit) {
    warnings.push({
      field: 'points3D.cockpit',
      category: 'geometry',
      severity: 'warning',
      message: 'Ponto do cockpit (COCKPITP) não definido. A visão do piloto ficará na origem (0,0,0).',
    });
  }

  const lg = data.points3D.leftGear;
  const rg = data.points3D.rightGear;
  if (lg && rg) {
    if (lg.x >= 0 || rg.x <= 0) {
      warnings.push({
        field: 'points3D.leftGear',
        category: 'geometry',
        severity: 'warning',
        message: 'Trem esquerdo (LEFTGEAR) deve ter coordenada X negativa e direito (RIGHGEAR) positiva.',
      });
    }
    const symDiff = Math.abs(Math.abs(lg.x) - rg.x);
    if (symDiff > 0.4) {
      warnings.push({
        field: 'points3D.leftGear',
        category: 'geometry',
        severity: 'warning',
        message: `Trens principais assimétricos no eixo X (|Esq|=${Math.abs(lg.x).toFixed(2)}m vs Dir=${rg.x.toFixed(2)}m).`,
      });
    }
    const heightDiff = Math.abs(lg.y - rg.y);
    if (heightDiff > 0.15) {
      warnings.push({
        field: 'points3D.leftGear',
        category: 'geometry',
        severity: 'warning',
        message: `Diferença de altura entre trens principais no solo (${heightDiff.toFixed(2)}m) pode provocar inclinação.`,
      });
    }
  }

  // Recomendações e Informações úteis
  info.push({
    field: 'summary',
    category: 'weight',
    severity: 'info',
    message: `MTOW: ${mtowTon.toFixed(2)}t | Carga alar: ${wingLoading.toFixed(1)} kg/m²${twRatio ? ` | T/W: ${twRatio.toFixed(2)}` : ''}${pwRatio ? ` | P/W: ${pwRatio.toFixed(1)} hp/t` : ''}`,
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
    summary: {
      mtowTon,
      emptyWeightFraction: emptyFrac,
      fuelWeightFraction: fuelFrac,
      payloadWeightFraction: loadFrac,
      thrustToWeightRatio: twRatio,
      powerToWeightHpTon: pwRatio,
      wingLoadingKgM2: wingLoading,
    },
  };
}
