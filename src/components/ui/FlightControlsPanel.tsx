import React, { useRef, useState } from 'react';
import {
  Activity,
  Compass,
  Fan,
  Gauge,
  Play,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Square,
} from 'lucide-react';
import { FlightControlState } from '../../types/ysflight';

interface FlightControlsPanelProps {
  controls: FlightControlState;
  onChange: React.Dispatch<React.SetStateAction<FlightControlState>>;
}

export const FlightControlsPanel: React.FC<FlightControlsPanelProps> = ({
  controls,
  onChange,
}) => {
  const stickPadRef = useRef<HTMLDivElement | null>(null);
  const [draggingStick, setDraggingStick] = useState(false);

  const updateStickFromEvent = (clientX: number, clientY: number) => {
    const pad = stickPadRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const aileron = Math.max(-1, Math.min(1, Number(nx.toFixed(2))));
    const elevator = Math.max(-1, Math.min(1, Number(ny.toFixed(2))));
    onChange((prev) => ({
      ...prev,
      autoDemo: false,
      aileron,
      elevator,
    }));
  };

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingStick(true);
    updateStickFromEvent(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingStick) return;
    updateStickFromEvent(e.clientX, e.clientY);
  };

  const handleStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDraggingStick(false);
  };

  const centerSurfaces = () => {
    onChange((prev) => ({
      ...prev,
      autoDemo: false,
      aileron: 0,
      elevator: 0,
      rudder: 0,
    }));
  };

  const toggleGear = () => {
    onChange((prev) => {
      const nextTarget = prev.gearTarget > 0.5 ? 0 : 1;
      return {
        ...prev,
        autoDemo: false,
        gearTarget: nextTarget,
      };
    });
  };

  const gearStatus =
    controls.gear >= 0.8
      ? 'BAIXADO E TRAVADO'
      : controls.gear <= 0.2
      ? 'RECOLHIDO'
      : 'EM TRÂNSITO';

  const gearStatusClass =
    controls.gear >= 0.8
      ? 'down'
      : controls.gear <= 0.2
      ? 'up'
      : 'transit';

  const estimatedRpm = controls.engineRunning
    ? Math.round(650 + controls.throttle * 2050)
    : 0;

  return (
    <aside className="side-panel left-panel" aria-label="Controles das Partes Móveis">
      <div className="panel-header">
        <div className="panel-title-group">
          <Sliders size={18} className="accent-icon" />
          <div>
            <h2>Comando de Partes Móveis</h2>
            <p>Canais de Animação DNM (CLA / STA)</p>
          </div>
        </div>
        <button
          type="button"
          className={`demo-btn ${controls.autoDemo ? 'active' : ''}`}
          onClick={() =>
            onChange((prev) => ({ ...prev, autoDemo: !prev.autoDemo }))
          }
          title="Executar cheque automático de todas as superfícies móveis"
        >
          {controls.autoDemo ? <Square size={14} /> : <Play size={14} />}
          <span>{controls.autoDemo ? 'Parar Demo' : 'Auto-Demo'}</span>
        </button>
      </div>

      <div className="panel-scroll-body">
        {/* 1. Superfícies Primárias de Voo + Manche 2D */}
        <details className="native-accordion" open>
          <summary>
            <span className="summary-title">
              <Compass size={15} /> Superfícies de Voo (CLA 6, 7, 8)
            </span>
            <span className="summary-badge">3 Eixos</span>
          </summary>

          <div className="accordion-content">
            {/* Interactive 2D Stick Pad */}
            <div className="stick-section">
              <div
                ref={stickPadRef}
                className={`stick-pad ${draggingStick ? 'dragging' : ''}`}
                onPointerDown={handleStickPointerDown}
                onPointerMove={handleStickPointerMove}
                onPointerUp={handleStickPointerUp}
                title="Arraste para mover Ailerons (X) e Profundor (Y) simultaneamente"
              >
                <div className="stick-grid-h" />
                <div className="stick-grid-v" />
                <div
                  className="stick-cursor"
                  style={{
                    left: `${(controls.aileron * 0.5 + 0.5) * 100}%`,
                    top: `${(-controls.elevator * 0.5 + 0.5) * 100}%`,
                  }}
                />
                <span className="stick-label top">PICAR / CABRAR</span>
                <span className="stick-label left">ROL. ESQ</span>
                <span className="stick-label right">ROL. DIR</span>
              </div>

              <div className="stick-readouts">
                <div className="readout-box">
                  <span className="readout-label">Aileron (CLA 7)</span>
                  <strong className="mono">
                    {Math.round(controls.aileron * 100)}%
                  </strong>
                  <small>±24.0° (SRF 8 / 9)</small>
                </div>
                <div className="readout-box">
                  <span className="readout-label">Profundor (CLA 6)</span>
                  <strong className="mono">
                    {Math.round(controls.elevator * 100)}%
                  </strong>
                  <small>±24.0° (SRF 7)</small>
                </div>
                <button
                  type="button"
                  className="secondary-btn full-width"
                  onClick={centerSurfaces}
                >
                  <RotateCcw size={13} /> Centralizar Superfícies
                </button>
              </div>
            </div>

            {/* Sliders Individuais Nativos */}
            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-aileron">
                  Ailerons (Roll) <span className="cla-pill">CLA 7</span>
                </label>
                <output htmlFor="slider-aileron" className="mono">
                  {(controls.aileron * 24).toFixed(1)}°
                </output>
              </div>
              <input
                id="slider-aileron"
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={controls.aileron}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    autoDemo: false,
                    aileron: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="range-ticks">
                <span>Esq (-100%)</span>
                <span>Neutro (STA 0)</span>
                <span>Dir (+100%)</span>
              </div>
            </div>

            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-elevator">
                  Profundor / Elevator (Pitch){' '}
                  <span className="cla-pill">CLA 6</span>
                </label>
                <output htmlFor="slider-elevator" className="mono">
                  {(controls.elevator * 24).toFixed(1)}°
                </output>
              </div>
              <input
                id="slider-elevator"
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={controls.elevator}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    autoDemo: false,
                    elevator: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="range-ticks">
                <span>Picar (STA 2)</span>
                <span>Neutro (STA 0)</span>
                <span>Cabrar (STA 1)</span>
              </div>
            </div>

            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-rudder">
                  Leme Direcional / Rudder (Yaw){' '}
                  <span className="cla-pill">CLA 8</span>
                </label>
                <output htmlFor="slider-rudder" className="mono">
                  {(controls.rudder * 24).toFixed(1)}°
                </output>
              </div>
              <input
                id="slider-rudder"
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={controls.rudder}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    autoDemo: false,
                    rudder: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="range-ticks">
                <span>Guinada Esq</span>
                <span>Neutro (STA 0)</span>
                <span>Guinada Dir</span>
              </div>
            </div>
          </div>
        </details>

        {/* 2. Trem de Pouso Retrátil e Portas */}
        <details className="native-accordion" open>
          <summary>
            <span className="summary-title">
              <ShieldCheck size={15} /> Trem de Pouso Retrátil (CLA 0)
            </span>
            <span className={`gear-pill ${gearStatusClass}`}>
              {Math.round(controls.gear * 100)}%
            </span>
          </summary>

          <div className="accordion-content">
            {/* 3 Green Landing Gear Lights Indicator */}
            <div className="gear-lights-panel">
              <div className="gear-lights-cluster">
                <div className={`gear-lamp ${gearStatusClass}`}>
                  <span className="lamp-bulb" />
                  <small>NARIZ (SRF 10)</small>
                </div>
                <div className="gear-lamps-main">
                  <div className={`gear-lamp ${gearStatusClass}`}>
                    <span className="lamp-bulb" />
                    <small>ESQ (SRF 18/21)</small>
                  </div>
                  <div className={`gear-lamp ${gearStatusClass}`}>
                    <span className="lamp-bulb" />
                    <small>DIR (SRF 19/20)</small>
                  </div>
                </div>
              </div>

              <div className="gear-lever-col">
                <span className={`gear-state-text ${gearStatusClass}`}>
                  {gearStatus}
                </span>
                <button
                  type="button"
                  className={`gear-lever-btn ${
                    controls.gearTarget > 0.5 ? 'down' : 'up'
                  }`}
                  onClick={toggleGear}
                >
                  {controls.gearTarget > 0.5
                    ? '▲ Recolher Trem (UP)'
                    : '▼ Baixar Trem (DOWN)'}
                </button>
              </div>
            </div>

            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-gear">
                  Atuador Hidráulico Manual <span className="cla-pill">NST 2</span>
                </label>
                <output htmlFor="slider-gear" className="mono">
                  {Math.round(controls.gear * 100)}%
                </output>
              </div>
              <input
                id="slider-gear"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={controls.gear}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onChange((prev) => ({
                    ...prev,
                    autoDemo: false,
                    gear: val,
                    gearTarget: val,
                  }));
                }}
              />
              <div className="range-ticks">
                <span>0% Recolhido (STA 0)</span>
                <span>Portas Visíveis &gt; 20%</span>
                <span>100% Baixado (STA 1)</span>
              </div>
            </div>
          </div>
        </details>

        {/* 3. Motor e Conjunto da Hélice */}
        <details className="native-accordion" open>
          <summary>
            <span className="summary-title">
              <Fan size={15} /> Propulsão e Hélice (750 hp)
            </span>
            <span className="summary-badge mono">{estimatedRpm} RPM</span>
          </summary>

          <div className="accordion-content">
            <div className="engine-Switch-row">
              <label className="native-switch-label" htmlFor="chk-engine">
                <input
                  id="chk-engine"
                  type="checkbox"
                  checked={controls.engineRunning}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      engineRunning: e.target.checked,
                    }))
                  }
                />
                <span>Master Motor / Ignição (CLA 3)</span>
              </label>
              <span
                className={`engine-badge ${
                  controls.engineRunning ? 'running' : 'off'
                }`}
              >
                {controls.engineRunning ? 'EM ROTAÇÃO' : 'CORTADO'}
              </span>
            </div>

            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-throttle">
                  Manete de Potência (Throttle)
                </label>
                <output htmlFor="slider-throttle" className="mono">
                  {Math.round(controls.throttle * 100)}%
                </output>
              </div>
              <input
                id="slider-throttle"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={controls.throttle}
                disabled={!controls.engineRunning}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    throttle: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="range-ticks">
                <span>Marcha Lenta (CLA 18)</span>
                <span>Transição (30–60%)</span>
                <span>Plena Potência (CLA 20)</span>
              </div>
            </div>

            <div className="meter-group">
              <div className="meter-label-row">
                <span>
                  <Gauge size={13} /> Regime de Rotação e Estágio Visual
                </span>
                <small className="mono">
                  {!controls.engineRunning
                    ? 'Pás Estáticas (CLA 18)'
                    : controls.throttle <= 0.3
                    ? 'Baixo RPM (CLA 18)'
                    : controls.throttle <= 0.6
                    ? 'Transição (CLA 18 + 20)'
                    : 'Disco Translúcido (CLA 20)'}
                </small>
              </div>
              <meter
                className="native-meter"
                min={0}
                max={2700}
                low={900}
                high={2200}
                optimum={1800}
                value={estimatedRpm}
              />
            </div>
          </div>
        </details>

        {/* Resumo do Comportamento cinemático YSFlight */}
        <div className="info-card">
          <div className="info-card-title">
            <Activity size={14} /> Cinemática Fiel ao Motor YSFlight
          </div>
          <p>
            Matrizes calculadas via <code>RotateXZ(h) · RotateZY(p) · RotateXY(b)</code>{' '}
            em unidades angulares de 16 bits (<code>65536 = 360°</code>), respeitando a
            hierarquia pai-filho (<code>SRF &quot;25&quot; → CLD &quot;2&quot;, &quot;3&quot;</code>).
          </p>
        </div>
      </div>
    </aside>
  );
};
