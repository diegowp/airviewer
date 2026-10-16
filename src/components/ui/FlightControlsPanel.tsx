import React, { useRef, useState } from 'react';
import {
  Activity,
  Anchor,
  Compass,
  DoorOpen,
  Fan,
  Flame,
  Gauge,
  Play,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Square,
  Wind,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { FlightControlState } from '../../types/ysflight';

interface FlightControlsPanelProps {
  controls: FlightControlState;
  onChange: React.Dispatch<React.SetStateAction<FlightControlState>>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const FlightControlsPanel: React.FC<FlightControlsPanelProps> = ({
  controls,
  onChange,
  isCollapsed = false,
  onToggleCollapse,
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

  if (isCollapsed) {
    return (
      <aside className="side-panel left-panel collapsed" aria-label="Controles de Voo Recolhidos">
        <button
          type="button"
          className="panel-rail-btn"
          onClick={onToggleCollapse}
          title="Expandir Comando de Partes Móveis (CLA)"
        >
          <ChevronRight size={16} />
          <span className="rail-vertical-text">Comandos de Voo</span>
          <Sliders size={14} className="rail-icon" />
        </button>
      </aside>
    );
  }

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
        <div className="panel-header-actions">
          <button
            type="button"
            className={`demo-btn ${controls.autoDemo ? 'active' : ''}`}
            onClick={() =>
              onChange((prev) => ({ ...prev, autoDemo: !prev.autoDemo }))
            }
            title="Executar cheque automático de todas as superfícies móveis"
          >
            {controls.autoDemo ? <Square size={13} /> : <Play size={13} />}
            <span>{controls.autoDemo ? 'Parar' : 'Demo'}</span>
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              className="panel-toggle-btn"
              onClick={onToggleCollapse}
              title="Recolher painel de comandos"
              aria-label="Recolher painel de comandos"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
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
                title="Clique e arraste o manche 2D para comandar Aileron e Profundor"
              >
                <div className="stick-crosshair-h" />
                <div className="stick-crosshair-v" />
                <div
                  className="stick-handle"
                  style={{
                    left: `${((controls.aileron + 1) / 2) * 100}%`,
                    top: `${((-controls.elevator + 1) / 2) * 100}%`,
                  }}
                />
              </div>

              <div className="stick-telemetry">
                <div className="stick-axis-row">
                  <span className="axis-label">Aileron (Rolamento):</span>
                  <strong className="mono">
                    {(controls.aileron * 20).toFixed(1)}°
                  </strong>
                </div>
                <div className="stick-axis-row">
                  <span className="axis-label">Profundor (Arfagem):</span>
                  <strong className="mono">
                    {(-controls.elevator * 20).toFixed(1)}°
                  </strong>
                </div>
                <button
                  type="button"
                  className="secondary-btn center-btn"
                  onClick={centerSurfaces}
                >
                  <RotateCcw size={13} />
                  <span>Centrar Superfícies</span>
                </button>
              </div>
            </div>

            {/* Sliders manuais de ajuste fino */}
            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-aileron">
                  Aileron / Rolamento <span className="cla-pill">CLA 7</span>
                </label>
                <output htmlFor="slider-aileron" className="mono">
                  {(controls.aileron * 20).toFixed(1)}°
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
                <span>Esq (STA 2)</span>
                <span>Neutro (STA 0)</span>
                <span>Dir (STA 1)</span>
              </div>
            </div>

            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-elevator">
                  Profundor / Arfagem <span className="cla-pill">CLA 6</span>
                </label>
                <output htmlFor="slider-elevator" className="mono">
                  {(controls.elevator * 20).toFixed(1)}°
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

        {/* 2. Dispositivos Hipersustentadores & Freios Aerodinâmicos */}
        <details className="native-accordion" open>
          <summary>
            <span className="summary-title">
              <Wind size={15} /> Flaps &amp; Freios Aerodinâmicos (CLA 4, 5)
            </span>
            <span className="summary-badge mono">
              F: {Math.round(controls.flap * 100)}% | S: {Math.round(controls.spoiler * 100)}%
            </span>
          </summary>

          <div className="accordion-content">
            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-flap">
                  Flaps de Sustentação <span className="cla-pill">CLA 5</span>
                </label>
                <output htmlFor="slider-flap" className="mono">
                  {Math.round(controls.flap * 100)}% ({(controls.flap * 40).toFixed(0)}°)
                </output>
              </div>
              <input
                id="slider-flap"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={controls.flap}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    autoDemo: false,
                    flap: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="range-ticks">
                <span>Recolhido (0°)</span>
                <span>Decolagem (20°)</span>
                <span>Pouso Pleno (40°)</span>
              </div>
            </div>

            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-spoiler">
                  Freio Aerodinâmico / Spoiler <span className="cla-pill">CLA 4</span>
                </label>
                <output htmlFor="slider-spoiler" className="mono">
                  {Math.round(controls.spoiler * 100)}%
                </output>
              </div>
              <input
                id="slider-spoiler"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={controls.spoiler}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    autoDemo: false,
                    spoiler: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="range-ticks">
                <span>Fechado (STA 0)</span>
                <span>50%</span>
                <span>Aberto (STA 1)</span>
              </div>
            </div>

            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-vgw">
                  Asa de Geometria Variável (VGW) <span className="cla-pill">CLA 1</span>
                </label>
                <output htmlFor="slider-vgw" className="mono">
                  {Math.round(controls.vgw * 100)}%
                </output>
              </div>
              <input
                id="slider-vgw"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={controls.vgw}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    autoDemo: false,
                    vgw: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="range-ticks">
                <span>Envergadura Plena</span>
                <span>Enflechamento Médio</span>
                <span>Enflechamento Máximo</span>
              </div>
            </div>
          </div>
        </details>

        {/* 3. Trem de Pouso Retrátil e Portas */}
        <details className="native-accordion" open>
          <summary>
            <span className="summary-title">
              <ShieldCheck size={15} /> Trem de Pouso Retrátil (CLA 0, 14, 15)
            </span>
            <span className={`gear-pill ${gearStatusClass}`}>
              {Math.round(controls.gear * 100)}%
            </span>
          </summary>

          <div className="accordion-content">
            <div className="gear-lights-panel">
              <div className="gear-lights-cluster">
                <div className={`gear-lamp ${gearStatusClass}`}>
                  <span className="lamp-bulb" />
                  <small>NARIZ</small>
                </div>
                <div className="gear-lamps-main">
                  <div className={`gear-lamp ${gearStatusClass}`}>
                    <span className="lamp-bulb" />
                    <small>ESQ</small>
                  </div>
                  <div className={`gear-lamp ${gearStatusClass}`}>
                    <span className="lamp-bulb" />
                    <small>DIR</small>
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
                <span>0% Recolhido</span>
                <span>Portas CLA 14 (0.2..0.8)</span>
                <span>100% Baixado</span>
              </div>
            </div>
          </div>
        </details>

        {/* 4. Motor, Hélice e Pós-Combustor */}
        <details className="native-accordion" open>
          <summary>
            <span className="summary-title">
              <Fan size={15} /> Propulsão &amp; Pós-Combustor (CLA 2, 3, 18, 20)
            </span>
            <span className="summary-badge mono">
              {controls.afterburner ? 'AFTERBURNER ATIVO' : `${estimatedRpm} RPM`}
            </span>
          </summary>

          <div className="accordion-content">
            <div className="engine-switch-row">
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
                <span>Lenta (CLA 18)</span>
                <span>Transição (30–60%)</span>
                <span>Plena (CLA 20)</span>
              </div>
            </div>

            {/* Pós-Combustor Switch */}
            <div className="engine-switch-row" style={{ marginTop: '0.5rem' }}>
              <label className="native-switch-label" htmlFor="chk-ab">
                <input
                  id="chk-ab"
                  type="checkbox"
                  checked={Boolean(controls.afterburner)}
                  disabled={!controls.engineRunning}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      afterburner: e.target.checked,
                    }))
                  }
                />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Flame size={14} color="#f97316" /> Pós-Combustão / Reheat <span className="cla-pill">CLA 2</span>
                </span>
              </label>
              <span
                className={`engine-badge ${
                  controls.afterburner && controls.engineRunning ? 'running' : 'off'
                }`}
              >
                {controls.afterburner && controls.engineRunning ? 'CHAMA ATIVA' : 'STANDBY'}
              </span>
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

        {/* 5. Cargas, Portas e Sistemas Especiais */}
        <details className="native-accordion">
          <summary>
            <span className="summary-title">
              <DoorOpen size={15} /> Sistemas Especiais &amp; Portas (CLA 9, 10, 11, 16)
            </span>
            <span className="summary-badge">Armas/Portas</span>
          </summary>

          <div className="accordion-content">
            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-bomb">
                  Baia de Armamento / Rampa de Carga <span className="cla-pill">CLA 9</span>
                </label>
                <output htmlFor="slider-bomb" className="mono">
                  {Math.round((controls.bombBay ?? 0) * 100)}%
                </output>
              </div>
              <input
                id="slider-bomb"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={controls.bombBay ?? 0}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    autoDemo: false,
                    bombBay: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="range-ticks">
                <span>Fechado (STA 0)</span>
                <span>50% Aberto</span>
                <span>Aberto Pleno (STA 1)</span>
              </div>
            </div>

            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-doors">
                  Portas Deslizantes / Faróis / Vetor <span className="cla-pill">CLA 10</span>
                </label>
                <output htmlFor="slider-doors" className="mono">
                  {Math.round((controls.doorsAndLights ?? 0) * 100)}%
                </output>
              </div>
              <input
                id="slider-doors"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={controls.doorsAndLights ?? 0}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    autoDemo: false,
                    doorsAndLights: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="range-ticks">
                <span>Recolhido (STA 0)</span>
                <span>Extensão Média</span>
                <span>Extensão Máxima (STA 1)</span>
              </div>
            </div>

            <div className="control-field">
              <div className="field-header">
                <label htmlFor="slider-chute">
                  Gancho de Parada &amp; Paraquedas <span className="cla-pill">CLA 11 / 16</span>
                </label>
                <output htmlFor="slider-chute" className="mono">
                  {Math.round((controls.brakeChuteAndHook ?? 0) * 100)}%
                </output>
              </div>
              <input
                id="slider-chute"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={controls.brakeChuteAndHook ?? 0}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    autoDemo: false,
                    brakeChuteAndHook: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="range-ticks">
                <span>Recolhido (STA 0)</span>
                <span>Acionado (STA 1)</span>
              </div>
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
            hierarquia pai-filho e resolução dinâmica de malhas externas (<code>.srf</code>).
          </p>
        </div>
      </div>
    </aside>
  );
};
