import React from 'react';
import { AircraftDatData } from '../../types/ysflight';
import { ValidationResult } from '../../parsers/datValidator';

interface AeroCurvesPreviewProps {
  data: AircraftDatData;
  validation: ValidationResult;
}

export const AeroCurvesPreview: React.FC<AeroCurvesPreviewProps> = ({
  data,
  validation,
}) => {
  const { summary } = validation;

  // Generate points for the Cl x Alpha polar curve
  // Linear region: Cl = Cl0 + a * alpha
  // Beyond critical AOA: stall drop
  const posAoa = Math.max(5, data.critAoaPosDeg || 16);
  const negAoa = Math.min(-5, data.critAoaNegDeg || -12);
  const maxCl = 1.35 + (data.clByFlap || 0);

  const curvePoints: Array<{ aoa: number; cl: number }> = [];
  const minAngle = negAoa - 6;
  const maxAngle = posAoa + 6;

  for (let a = minAngle; a <= maxAngle; a += 0.5) {
    let cl = 0;
    if (a >= negAoa && a <= posAoa) {
      // Linear region
      cl = 0.2 + (a / posAoa) * (maxCl - 0.2);
    } else if (a > posAoa) {
      // Post-stall drop positive
      const over = a - posAoa;
      cl = maxCl * Math.exp(-over * 0.22);
    } else {
      // Post-stall drop negative
      const under = negAoa - a;
      cl = -0.8 * Math.exp(-under * 0.22);
    }
    curvePoints.push({ aoa: a, cl });
  }

  // SVG Mapping (W=440, H=220)
  const svgW = 440;
  const svgH = 200;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 30;

  const mapX = (aoa: number) =>
    padL + ((aoa - minAngle) / (maxAngle - minAngle)) * (svgW - padL - padR);
  const mapY = (cl: number) =>
    svgH - padB - ((cl - -1.2) / (maxCl + 0.5 - -1.2)) * (svgH - padT - padB);

  const pathD = curvePoints.reduce((acc, pt, i) => {
    const x = mapX(pt.aoa);
    const y = mapY(pt.cl);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const zeroX = mapX(0);
  const zeroY = mapY(0);

  return (
    <div className="aero-curves-container">
      {/* 1. Curva Polar Cl x Alpha */}
      <div className="curve-card">
        <div className="curve-header">
          <strong>Curva Polar de Sustentação (CL × α)</strong>
          <span className="mono">
            Estol: {negAoa.toFixed(1)}° / +{posAoa.toFixed(1)}° | CL máx: {maxCl.toFixed(2)}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="aero-svg"
          preserveAspectRatio="none"
        >
          {/* Eixos */}
          <line
            x1={padL}
            y1={zeroY}
            x2={svgW - padR}
            y2={zeroY}
            stroke="#334155"
            strokeWidth="1"
          />
          <line
            x1={zeroX}
            y1={padT}
            x2={zeroX}
            y2={svgH - padB}
            stroke="#334155"
            strokeWidth="1"
          />

          {/* Grid lines */}
          <line
            x1={mapX(posAoa)}
            y1={padT}
            x2={mapX(posAoa)}
            y2={svgH - padB}
            stroke="#f59e0b"
            strokeDasharray="4,4"
            strokeWidth="1"
          />
          <line
            x1={mapX(negAoa)}
            y1={padT}
            x2={mapX(negAoa)}
            y2={svgH - padB}
            stroke="#f59e0b"
            strokeDasharray="4,4"
            strokeWidth="1"
          />

          {/* Curva de sustentação */}
          <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.5" />

          {/* Ponto crítico positivo */}
          <circle
            cx={mapX(posAoa)}
            cy={mapY(maxCl)}
            r="4.5"
            fill="#38bdf8"
            stroke="#0ea5e9"
            strokeWidth="2"
          />
          <text
            x={mapX(posAoa) + 5}
            y={mapY(maxCl) - 6}
            fill="#38bdf8"
            fontSize="10"
            fontFamily="monospace"
          >
            +{posAoa}°
          </text>

          {/* Rótulos dos eixos */}
          <text
            x={svgW - padR - 35}
            y={zeroY - 6}
            fill="#94a3b8"
            fontSize="10"
            fontFamily="sans-serif"
          >
            AOA (α)
          </text>
          <text
            x={zeroX + 6}
            y={padT + 12}
            fill="#94a3b8"
            fontSize="10"
            fontFamily="sans-serif"
          >
            Cl
          </text>
        </svg>
      </div>

      {/* 2. Distribuição de Pesos & Razão de Performance */}
      <div className="weight-perf-card">
        <div className="curve-header">
          <strong>Envoltória de Massa (MTOW: {summary.mtowTon.toFixed(2)}t)</strong>
          <span className="mono">
            {summary.thrustToWeightRatio
              ? `T/W: ${summary.thrustToWeightRatio.toFixed(2)}`
              : summary.powerToWeightHpTon
              ? `P/W: ${summary.powerToWeightHpTon.toFixed(1)} hp/t`
              : ''}
          </span>
        </div>

        {/* Barra segmentada de pesos */}
        <div className="weight-breakdown-bar">
          <div
            className="weight-seg clean"
            style={{ width: `${summary.emptyWeightFraction}%` }}
            title={`Vazio (Limpo): ${data.weightCleanTon.toFixed(2)}t (${summary.emptyWeightFraction.toFixed(0)}%)`}
          >
            <span>Vazio {summary.emptyWeightFraction.toFixed(0)}%</span>
          </div>
          <div
            className="weight-seg fuel"
            style={{ width: `${summary.fuelWeightFraction}%` }}
            title={`Combustível: ${data.weightFuelTon.toFixed(2)}t (${summary.fuelWeightFraction.toFixed(0)}%)`}
          >
            <span>Comb {summary.fuelWeightFraction.toFixed(0)}%</span>
          </div>
          <div
            className="weight-seg load"
            style={{ width: `${summary.payloadWeightFraction}%` }}
            title={`Carga/Armas: ${data.weightPayloadTon.toFixed(2)}t (${summary.payloadWeightFraction.toFixed(0)}%)`}
          >
            <span>Carga {summary.payloadWeightFraction.toFixed(0)}%</span>
          </div>
        </div>

        <div className="weight-stats-grid">
          <div>
            <small>Carga Alar (Wing Loading)</small>
            <strong className="mono">{summary.wingLoadingKgM2.toFixed(1)} kg/m²</strong>
          </div>
          <div>
            <small>Área de Asa Efetiva</small>
            <strong className="mono">{data.wingAreaM2.toFixed(1)} m²</strong>
          </div>
          <div>
            <small>Resistência Estrutural</small>
            <strong className="mono">{data.strength} HP</strong>
          </div>
          <div>
            <small>Assinatura Radar (RCS)</small>
            <strong className="mono">{(data.radarCrossSection ?? 1).toFixed(3)} m²</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
