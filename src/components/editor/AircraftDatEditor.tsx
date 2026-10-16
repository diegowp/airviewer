import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  Download,
  Copy,
  RotateCcw,
  Check,
  AlertTriangle,
  Info,
  Sliders,
  Flame,
  Scale,
  Wind,
  Crosshair,
  Shield,
  Gauge,
  LineChart,
  FileCode,
  Maximize2,
} from 'lucide-react';
import {
  AircraftDatData,
  Vec3,
} from '../../types/ysflight';
import { serializeDatText } from '../../parsers/datSerializer';
import { parseDatText } from '../../parsers/datParser';
import { validateAircraftDat } from '../../parsers/datValidator';
import { AeroCurvesPreview } from './AeroCurvesPreview';
import { DatDiffViewer } from './DatDiffViewer';

interface AircraftDatEditorProps {
  isOpen: boolean;
  onClose: () => void;
  originalDatText: string;
  datData: AircraftDatData | null;
  aircraftName: string;
  datFilename: string;
  onApplyToModel: (updatedDat: AircraftDatData, updatedText: string) => void;
}

type EditorTab =
  | 'identity'
  | 'propulsion'
  | 'weights'
  | 'aero'
  | 'points'
  | 'weapons'
  | 'operations'
  | 'curves'
  | 'diff';

export const AircraftDatEditor: React.FC<AircraftDatEditorProps> = ({
  isOpen,
  onClose,
  originalDatText,
  datData,
  aircraftName,
  datFilename,
  onApplyToModel,
}) => {
  const [draft, setDraft] = useState<AircraftDatData | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>('identity');
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [applySuccess, setApplySuccess] = useState<boolean>(false);

  // Sync draft when modal opens or incoming datData changes
  useEffect(() => {
    if (isOpen && datData) {
      setDraft(JSON.parse(JSON.stringify(datData)));
    }
  }, [isOpen, datData]);

  const serializedText = useMemo(() => {
    if (!draft) return '';
    return serializeDatText(draft);
  }, [draft]);

  const validation = useMemo(() => {
    if (!draft) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        info: [],
        summary: {
          mtowTon: 0,
          emptyWeightFraction: 0,
          fuelWeightFraction: 0,
          payloadWeightFraction: 0,
          wingLoadingKgM2: 0,
        },
      };
    }
    return validateAircraftDat(draft);
  }, [draft]);

  if (!isOpen || !draft) return null;

  // Handlers for updating primitive fields
  const updateField = <K extends keyof AircraftDatData>(key: K, value: AircraftDatData[K]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
  };

  // Helper for updating 3D points
  type Vec3PointKey =
    | 'cockpit'
    | 'leftGear'
    | 'rightGear'
    | 'wheelGear'
    | 'smokeGen'
    | 'vapor0'
    | 'vapor1'
    | 'flarePos'
    | 'arrester'
    | 'machineGun'
    | 'machineGun2';

  const updatePoint = (pointName: Vec3PointKey, axis: 'x' | 'y' | 'z', value: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const currentPt: Vec3 = (prev.points3D[pointName] as Vec3) || { x: 0, y: 0, z: 0 };
      return {
        ...prev,
        points3D: {
          ...prev.points3D,
          [pointName]: {
            ...currentPt,
            [axis]: value,
          },
        },
      };
    });
  };

  // Helper for updating triggers
  const updateTrigger = (trigKey: 'trigger1' | 'trigger2' | 'trigger3' | 'trigger4', value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        triggers: {
          ...(prev.triggers || {}),
          [trigKey]: value,
        },
      };
    });
  };

  // Helper to symmetrize main gears (Right = -Left.x, Left.y, Left.z)
  const symmetrizeMainGears = () => {
    if (!draft.points3D.leftGear) return;
    const { x, y, z } = draft.points3D.leftGear;
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        points3D: {
          ...prev.points3D,
          rightGear: { x: -Math.abs(x), y, z },
        },
      };
    });
  };

  const handleApply = () => {
    if (!draft) return;
    onApplyToModel(draft, serializedText);
    setApplySuccess(true);
    setTimeout(() => setApplySuccess(false), 2200);
  };

  const handleDownload = () => {
    const blob = new Blob([serializedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = datFilename || `${draft.identify || 'aircraft'}.dat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(serializedText);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2000);
    } catch (e) {
      console.warn('Erro ao copiar para clipboard:', e);
    }
  };

  const handleReset = () => {
    if (!originalDatText) return;
    const parsed = parseDatText(originalDatText);
    setDraft(parsed);
  };

  return (
    <div className="dat-editor-overlay">
      <div className="dat-editor-dialog" role="dialog" aria-modal="true">
        {/* Header Bar */}
        <div className="editor-top-bar">
          <div className="editor-title-block">
            <div className="editor-title-row">
              <Sliders size={20} className="editor-icon" />
              <h2>Editor de Propriedades Aeronáuticas (.DAT)</h2>
              <span className="editor-aircraft-badge">{aircraftName}</span>
              <code className="editor-filename-code">{datFilename}</code>
            </div>
            <p className="editor-subtitle">
              Configuração física, aerodinâmica, pesos, envelope de voo e sistemas do YSFlight em tempo real.
            </p>
          </div>

          <div className="editor-header-actions">
            <button
              type="button"
              className="editor-btn primary"
              onClick={handleApply}
              title="Aplica as modificações na simulação e nos marcadores 3D"
            >
              {applySuccess ? <Check size={14} /> : <Save size={14} />}
              <span className="btn-label-long">{applySuccess ? 'Aplicado no 3D!' : 'Aplicar no Voo'}</span>
              <span className="btn-label-short">{applySuccess ? 'Aplicado!' : 'Aplicar'}</span>
            </button>

            <button
              type="button"
              className="editor-btn secondary"
              onClick={handleDownload}
              title="Baixar arquivo .dat formatado pronto para YSFlight"
            >
              <Download size={14} />
              <span className="btn-label-long">Baixar .DAT</span>
              <span className="btn-label-short">Baixar</span>
            </button>

            <button
              type="button"
              className="editor-btn secondary"
              onClick={handleCopy}
              title="Copiar texto .dat para a área de transferência"
            >
              {copiedSuccess ? <Check size={14} /> : <Copy size={14} />}
              <span className="btn-label-long">{copiedSuccess ? 'Copiado!' : 'Copiar Texto'}</span>
              <span className="btn-label-short">{copiedSuccess ? 'Copiado!' : 'Copiar'}</span>
            </button>

            <button
              type="button"
              className="editor-btn subtle"
              onClick={handleReset}
              title="Reverter todas as modificações para o arquivo original"
            >
              <RotateCcw size={14} />
              <span className="btn-label-long">Restaurar</span>
              <span className="btn-label-short">Reset</span>
            </button>

            <button
              type="button"
              className="editor-close-btn"
              onClick={onClose}
              title="Fechar editor"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Validation & Summary Banner */}
        <div className="editor-metrics-banner">
          <div className="metric-badge">
            <span className="metric-label">MTOW Estimado:</span>
            <span className="metric-val">{validation.summary.mtowTon.toFixed(2)} t</span>
          </div>

          {draft.propulsionType === 'jet' && validation.summary.thrustToWeightRatio !== undefined && (
            <div className="metric-badge">
              <span className="metric-label">Relação Empuxo/Peso (T/W):</span>
              <span className={`metric-val ${validation.summary.thrustToWeightRatio >= 0.8 ? 'good' : ''}`}>
                {validation.summary.thrustToWeightRatio.toFixed(2)}
              </span>
            </div>
          )}

          {draft.propulsionType === 'propeller' && validation.summary.powerToWeightHpTon !== undefined && (
            <div className="metric-badge">
              <span className="metric-label">Potência/Peso:</span>
              <span className="metric-val">
                {validation.summary.powerToWeightHpTon.toFixed(1)} hp/t
              </span>
            </div>
          )}

          <div className="metric-badge">
            <span className="metric-label">Carga Alar (W/S):</span>
            <span className="metric-val">{validation.summary.wingLoadingKgM2.toFixed(1)} kg/m²</span>
          </div>

          {validation.errors.length > 0 && (
            <div className="validation-pill error" title={validation.errors.map((e) => e.message).join(' | ')}>
              <AlertTriangle size={13} />
              <span>{validation.errors.length} erro(s) físico(s)</span>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="validation-pill warning" title={validation.warnings.map((w) => w.message).join(' | ')}>
              <Info size={13} />
              <span>{validation.warnings.length} aviso(s)</span>
            </div>
          )}
        </div>

        {/* Subsystems Navigation Tabs */}
        <nav className="editor-nav-tabs">
          <button
            type="button"
            className={`tab-item ${activeTab === 'identity' ? 'active' : ''}`}
            onClick={() => setActiveTab('identity')}
          >
            <Shield size={14} />
            <span>Identidade</span>
          </button>

          <button
            type="button"
            className={`tab-item ${activeTab === 'propulsion' ? 'active' : ''}`}
            onClick={() => setActiveTab('propulsion')}
          >
            <Flame size={14} />
            <span>Propulsão</span>
          </button>

          <button
            type="button"
            className={`tab-item ${activeTab === 'weights' ? 'active' : ''}`}
            onClick={() => setActiveTab('weights')}
          >
            <Scale size={14} />
            <span>Massas &amp; Carga</span>
          </button>

          <button
            type="button"
            className={`tab-item ${activeTab === 'aero' ? 'active' : ''}`}
            onClick={() => setActiveTab('aero')}
          >
            <Wind size={14} />
            <span>Aerodinâmica &amp; Estabilidade</span>
          </button>

          <button
            type="button"
            className={`tab-item ${activeTab === 'points' ? 'active' : ''}`}
            onClick={() => setActiveTab('points')}
          >
            <Crosshair size={14} />
            <span>Pontos 3D &amp; Trens</span>
          </button>

          <button
            type="button"
            className={`tab-item ${activeTab === 'weapons' ? 'active' : ''}`}
            onClick={() => setActiveTab('weapons')}
          >
            <Gauge size={14} />
            <span>Armamentos &amp; Gatilhos</span>
          </button>

          <button
            type="button"
            className={`tab-item ${activeTab === 'operations' ? 'active' : ''}`}
            onClick={() => setActiveTab('operations')}
          >
            <Maximize2 size={14} />
            <span>Operações &amp; Envelope</span>
          </button>

          <button
            type="button"
            className={`tab-item ${activeTab === 'curves' ? 'active' : ''}`}
            onClick={() => setActiveTab('curves')}
          >
            <LineChart size={14} />
            <span>Polares &amp; Gráficos</span>
          </button>

          <button
            type="button"
            className={`tab-item ${activeTab === 'diff' ? 'active' : ''}`}
            onClick={() => setActiveTab('diff')}
          >
            <FileCode size={14} />
            <span>Diff &amp; Código .DAT</span>
          </button>
        </nav>

        {/* Editor Main Content Area */}
        <div className="editor-tab-body">
          {/* TAB 1: IDENTIDADE */}
          {activeTab === 'identity' && (
            <div className="tab-pane">
              <div className="form-section-title">
                <h3>Identificação Básica e Classificação de Radar</h3>
                <p>Define nomes de exibição, categoria da aeronave no simulador e assinatura de radar.</p>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Identificador (IDENTIFY)</label>
                  <input
                    type="text"
                    value={draft.identify}
                    onChange={(e) => updateField('identify', e.target.value)}
                    className="native-input"
                  />
                  <small>Nome exibido no HUD e na seleção de aeronaves</small>
                </div>

                <div className="form-field">
                  <label>Categoria (CATEGORY)</label>
                  <select
                    value={draft.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className="native-select"
                  >
                    <option value="NORMAL">NORMAL (Aviação Geral / Treinador)</option>
                    <option value="FIGHTER">FIGHTER (Caça / Interceptador)</option>
                    <option value="ATTACKER">ATTACKER (Ataque ao Solo)</option>
                    <option value="BOMBER">BOMBER (Bombardeiro)</option>
                    <option value="CARGO">CARGO (Transporte / Carga)</option>
                    <option value="HELICOPTER">HELICOPTER (Asas Rotativas)</option>
                    <option value="TRAINER">TRAINER (Treinamento Militar)</option>
                    <option value="UTILITY">UTILITY (Utilitário)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Classe Operacional (AIRCLASS)</label>
                  <select
                    value={draft.airClass || 'AIRPLANE'}
                    onChange={(e) => updateField('airClass', e.target.value as 'AIRPLANE' | 'HELICOPTER')}
                    className="native-select"
                  >
                    <option value="AIRPLANE">AIRPLANE (Avião Convencional)</option>
                    <option value="HELICOPTER">HELICOPTER (Helicóptero)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Resistência Estrutural (STRENGTH)</label>
                  <div className="input-range-wrap">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={draft.strength}
                      onChange={(e) => updateField('strength', Number(e.target.value))}
                      className="native-input"
                    />
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={draft.strength}
                      onChange={(e) => updateField('strength', Number(e.target.value))}
                    />
                  </div>
                  <small>Pontos de dano suportados (1 = Treinador frágil, 10–25 = Caça, 40+ = Carga)</small>
                </div>

                <div className="form-field">
                  <label>Seção Reta Radar (RADARCRS m²)</label>
                  <div className="input-range-wrap">
                    <input
                      type="number"
                      min={0.01}
                      max={100}
                      step={0.5}
                      value={draft.radarCrossSection}
                      onChange={(e) => updateField('radarCrossSection', Number(e.target.value))}
                      className="native-input"
                    />
                    <input
                      type="range"
                      min={0.1}
                      max={40}
                      step={0.5}
                      value={draft.radarCrossSection}
                      onChange={(e) => updateField('radarCrossSection', Number(e.target.value))}
                    />
                  </div>
                  <small>Detectabilidade por radar (0.1m² = Stealth, 3-5m² = Caça, 20m² = Transporte)</small>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROPULSÃO */}
          {activeTab === 'propulsion' && (
            <div className="tab-pane">
              <div className="form-section-title">
                <h3>Grupo Motopropulsor &amp; Dinâmica de Empuxo</h3>
                <p>Configure motores a reação (turbojatos/turbofans), turboélices ou motores a pistão.</p>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Tipo de Propulsão</label>
                  <select
                    value={draft.propulsionType}
                    onChange={(e) => updateField('propulsionType', e.target.value as 'jet' | 'propeller')}
                    className="native-select"
                  >
                    <option value="jet">Jato / Turbojato / Turbofan</option>
                    <option value="propeller">Hélice (Pistão / Turboélice)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Texto Descritivo do Motor</label>
                  <input
                    type="text"
                    value={draft.enginePower}
                    onChange={(e) => updateField('enginePower', e.target.value)}
                    className="native-input"
                  />
                  <small>Ex: &quot;300HP&quot;, &quot;2x 5000kg&quot;, etc.</small>
                </div>
              </div>

              {draft.propulsionType === 'jet' && (
                <div className="sub-fieldset">
                  <h4>Parâmetros de Motores a Reação</h4>
                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>Empuxo Militar Seco (THRMILIT)</label>
                      <div className="input-range-wrap">
                        <input
                          type="number"
                          step={100}
                          min={100}
                          max={50000}
                          value={draft.thrustMilitaryKg || 0}
                          onChange={(e) => updateField('thrustMilitaryKg', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <small>Quilogramas-força (kgf) em seco (~{((draft.thrustMilitaryKg || 0) * 9.80665).toFixed(0)} N)</small>
                    </div>

                    <div className="form-field">
                      <label>Pós-Combustor (AFTBURNR)</label>
                      <label className="native-check-item">
                        <input
                          type="checkbox"
                          checked={draft.hasAfterburner}
                          onChange={(e) => updateField('hasAfterburner', e.target.checked)}
                        />
                        <span>Equipado com Afterburner</span>
                      </label>
                    </div>

                    {draft.hasAfterburner && (
                      <div className="form-field">
                        <label>Empuxo com Pós-Combustão (THRAFTBN)</label>
                        <input
                          type="number"
                          step={100}
                          min={draft.thrustMilitaryKg || 100}
                          max={80000}
                          value={draft.thrustAfterburnerKg || 0}
                          onChange={(e) => updateField('thrustAfterburnerKg', Number(e.target.value))}
                          className="native-input"
                        />
                        <small>kgf com pós-combustor acionado</small>
                      </div>
                    )}
                  </div>

                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>Consumo em Seco (FUELMILI kg/s)</label>
                      <input
                        type="number"
                        step={0.01}
                        min={0.01}
                        max={10.0}
                        value={draft.fuelConsumptionKgSec || 0.5}
                        onChange={(e) => updateField('fuelConsumptionKgSec', Number(e.target.value))}
                        className="native-input"
                      />
                      <small>Taxa de queima de combustível por segundo</small>
                    </div>

                    {draft.hasAfterburner && (
                      <div className="form-field">
                        <label>Consumo com Afterburner (FUELABRN kg/s)</label>
                        <input
                          type="number"
                          step={0.05}
                          min={0.05}
                          max={20.0}
                          value={draft.fuelConsumptionAfterburnerKgSec || 1.5}
                          onChange={(e) => updateField('fuelConsumptionAfterburnerKgSec', Number(e.target.value))}
                          className="native-input"
                        />
                        <small>Consumo acelerado com pós-combustor</small>
                      </div>
                    )}

                    <div className="form-field">
                      <label>Reversor de Empuxo (THRSTREV Eficiência)</label>
                      <input
                        type="number"
                        step={0.05}
                        min={0}
                        max={0.8}
                        value={draft.thrustReverserEfficiency || 0}
                        onChange={(e) => updateField('thrustReverserEfficiency', Number(e.target.value))}
                        className="native-input"
                      />
                      <small>Fração de reversão (ex: 0.30 para 30%)</small>
                    </div>
                  </div>
                </div>
              )}

              {draft.propulsionType === 'propeller' && (
                <div className="sub-fieldset">
                  <h4>Parâmetros de Hélice e Tração</h4>
                  <div className="form-grid-3">
                    <div className="form-field">
                      <label>Potência do Motor (PROPELLR HP)</label>
                      <input
                        type="number"
                        step={10}
                        min={50}
                        max={10000}
                        value={draft.propellerPowerHp || 0}
                        onChange={(e) => updateField('propellerPowerHp', Number(e.target.value))}
                        className="native-input"
                      />
                      <small>Horsepower (HP) no eixo</small>
                    </div>

                    <div className="form-field">
                      <label>Eficiência da Hélice (PROPEFCY)</label>
                      <div className="input-range-wrap">
                        <input
                          type="number"
                          step={0.01}
                          min={0.4}
                          max={0.95}
                          value={draft.propellerEfficiency || 0.75}
                          onChange={(e) => updateField('propellerEfficiency', Number(e.target.value))}
                          className="native-input"
                        />
                        <input
                          type="range"
                          step={0.01}
                          min={0.4}
                          max={0.95}
                          value={draft.propellerEfficiency || 0.75}
                          onChange={(e) => updateField('propellerEfficiency', Number(e.target.value))}
                        />
                      </div>
                      <small>Normalmente entre 0.70 e 0.85</small>
                    </div>

                    <div className="form-field">
                      <label>Velocidade Mínima de Tração (PROPVMIN m/s)</label>
                      <input
                        type="number"
                        step={1}
                        min={5}
                        max={80}
                        value={draft.propellerVMinMs || 20}
                        onChange={(e) => updateField('propellerVMinMs', Number(e.target.value))}
                        className="native-input"
                      />
                      <small>Velocidade para cálculo de empuxo estático</small>
                    </div>
                  </div>
                </div>
              )}

              {/* Thrust Vectoring & Post-Stall */}
              <div className="sub-fieldset">
                <h4>Vetorização de Empuxo &amp; Super-Manobrabilidade</h4>
                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Empuxo Vetorial (TRSTVCTR)</label>
                    <label className="native-check-item">
                      <input
                        type="checkbox"
                        checked={draft.hasThrustVectoring || false}
                        onChange={(e) => updateField('hasThrustVectoring', e.target.checked)}
                      />
                      <span>Habilitar Vetorização de Empuxo</span>
                    </label>
                  </div>

                  {draft.hasThrustVectoring && (
                    <>
                      <div className="form-field">
                        <label>Arfagem Pós-Estol (PSTMPTCH °)</label>
                        <input
                          type="number"
                          step={1}
                          min={0}
                          max={90}
                          value={draft.postStallPitchDeg || 38}
                          onChange={(e) => updateField('postStallPitchDeg', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>

                      <div className="form-field">
                        <label>Guinada Pós-Estol (PSTMYAW_ °)</label>
                        <input
                          type="number"
                          step={1}
                          min={0}
                          max={90}
                          value={draft.postStallYawDeg || 38}
                          onChange={(e) => updateField('postStallYawDeg', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                    </>
                  )}
                </div>

                {draft.hasThrustVectoring && (
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label>Rolamento Pós-Estol (PSTMROLL °)</label>
                      <input
                        type="number"
                        step={1}
                        min={0}
                        max={180}
                        value={draft.postStallRollDeg || 90}
                        onChange={(e) => updateField('postStallRollDeg', Number(e.target.value))}
                        className="native-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MASSAS & CARGA */}
          {activeTab === 'weights' && (
            <div className="tab-pane">
              <div className="form-section-title">
                <h3>Massas, Cargas e Capacidades de Combustível</h3>
                <p>Defina o peso vazio (limpo), capacidades máximas e cargas iniciais no spawn do simulador.</p>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Peso Limpo / Vazio (WEIGHCLN)</label>
                  <div className="input-range-wrap">
                    <input
                      type="number"
                      step={0.05}
                      min={0.1}
                      max={300}
                      value={draft.weightCleanTon}
                      onChange={(e) => updateField('weightCleanTon', Number(e.target.value))}
                      className="native-input"
                    />
                  </div>
                  <small>Toneladas métricas (t) - {((draft.weightCleanTon || 0) * 1000).toLocaleString('pt-BR')} kg</small>
                </div>

                <div className="form-field">
                  <label>Capacidade Máxima Combustível (WEIGFUEL)</label>
                  <div className="input-range-wrap">
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      max={150}
                      value={draft.weightFuelTon}
                      onChange={(e) => updateField('weightFuelTon', Number(e.target.value))}
                      className="native-input"
                    />
                  </div>
                  <small>Toneladas métricas de combustível interno</small>
                </div>

                <div className="form-field">
                  <label>Carga Paga Máxima (WEIGLOAD)</label>
                  <div className="input-range-wrap">
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      max={200}
                      value={draft.weightPayloadTon}
                      onChange={(e) => updateField('weightPayloadTon', Number(e.target.value))}
                      className="native-input"
                    />
                  </div>
                  <small>Armas externas, bombas, passageiros ou carga</small>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>Combustível Inicial % (INITFUEL)</label>
                  <div className="input-range-wrap">
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={100}
                      value={draft.initialFuelPercent ?? 100}
                      onChange={(e) => updateField('initialFuelPercent', Number(e.target.value))}
                      className="native-input"
                    />
                    <input
                      type="range"
                      step={1}
                      min={0}
                      max={100}
                      value={draft.initialFuelPercent ?? 100}
                      onChange={(e) => updateField('initialFuelPercent', Number(e.target.value))}
                    />
                  </div>
                  <small>
                    Percentual de abastecimento inicial ({((draft.weightFuelTon || 0) * (draft.initialFuelPercent / 100)).toFixed(2)} t)
                  </small>
                </div>

                <div className="form-field">
                  <label>Payload Inicial de Voo (INITLOAD)</label>
                  <div className="input-range-wrap">
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      max={draft.weightPayloadTon || 1}
                      value={draft.initialPayloadTon ?? 0}
                      onChange={(e) => updateField('initialPayloadTon', Number(e.target.value))}
                      className="native-input"
                    />
                    <input
                      type="range"
                      step={0.01}
                      min={0}
                      max={draft.weightPayloadTon || 1}
                      value={draft.initialPayloadTon ?? 0}
                      onChange={(e) => updateField('initialPayloadTon', Number(e.target.value))}
                    />
                  </div>
                  <small>Carga transportada inicialmente ao entrar no cenário</small>
                </div>
              </div>

              {/* Mass breakdown bar */}
              <div className="mass-breakdown-card">
                <h4>Distribuição Percentual de Peso Máximo de Decolagem (MTOW: {validation.summary.mtowTon.toFixed(2)} t)</h4>
                <div className="mass-bar-track">
                  <div
                    className="mass-bar-seg empty"
                    style={{ width: `${validation.summary.emptyWeightFraction}%` }}
                    title={`Vazio: ${draft.weightCleanTon}t`}
                  >
                    Vazio {validation.summary.emptyWeightFraction.toFixed(0)}%
                  </div>
                  <div
                    className="mass-bar-seg fuel"
                    style={{ width: `${validation.summary.fuelWeightFraction}%` }}
                    title={`Combustível: ${draft.weightFuelTon}t`}
                  >
                    Comb. {validation.summary.fuelWeightFraction.toFixed(0)}%
                  </div>
                  {draft.weightPayloadTon > 0 && (
                    <div
                      className="mass-bar-seg payload"
                      style={{ width: `${validation.summary.payloadWeightFraction}%` }}
                      title={`Payload: ${draft.weightPayloadTon}t`}
                    >
                      Carga {validation.summary.payloadWeightFraction.toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AERODINÂMICA & ESTABILIDADE */}
          {activeTab === 'aero' && (
            <div className="tab-pane">
              <div className="form-section-title">
                <h3>Aerodinâmica, Sustentação e Constantes de Estabilidade</h3>
                <p>Controle de área alar, ângulos críticos de estol, coeficientes de superfícies de controle e momento.</p>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Área Alar (WINGAREA m²)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={1}
                    max={600}
                    value={draft.wingAreaM2}
                    onChange={(e) => updateField('wingAreaM2', Number(e.target.value))}
                    className="native-input"
                  />
                  <small>Área de referência da asa (influencia sustentação e arrasto)</small>
                </div>

                <div className="form-field">
                  <label>Raio de Colisão Externo (HTRADIUS m)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={1}
                    max={100}
                    value={draft.outsideRadiusM}
                    onChange={(e) => updateField('outsideRadiusM', Number(e.target.value))}
                    className="native-input"
                  />
                  <small>Esfera de bounding box e impacto 3D no mundo virtual</small>
                </div>

                <div className="form-field">
                  <label>Velocidade Crítica (CRITSPED)</label>
                  <input
                    type="text"
                    value={draft.critSpeed}
                    onChange={(e) => updateField('critSpeed', e.target.value)}
                    className="native-input"
                  />
                  <small>Velocidade onde a transição de estol ocorre (ex: 80kt)</small>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label>AOA Crítico Positivo (CRITAOAP °)</label>
                  <div className="input-range-wrap">
                    <input
                      type="number"
                      step={0.5}
                      min={5}
                      max={45}
                      value={draft.critAoaPosDeg}
                      onChange={(e) => updateField('critAoaPosDeg', Number(e.target.value))}
                      className="native-input"
                    />
                    <input
                      type="range"
                      step={0.5}
                      min={5}
                      max={35}
                      value={draft.critAoaPosDeg}
                      onChange={(e) => updateField('critAoaPosDeg', Number(e.target.value))}
                    />
                  </div>
                  <small>Ângulo de ataque de estol superior (ex: +13° a +18°)</small>
                </div>

                <div className="form-field">
                  <label>AOA Crítico Negativo (CRITAOAM °)</label>
                  <div className="input-range-wrap">
                    <input
                      type="number"
                      step={0.5}
                      min={-45}
                      max={-1}
                      value={draft.critAoaNegDeg}
                      onChange={(e) => updateField('critAoaNegDeg', Number(e.target.value))}
                      className="native-input"
                    />
                    <input
                      type="range"
                      step={0.5}
                      min={-35}
                      max={-3}
                      value={draft.critAoaNegDeg}
                      onChange={(e) => updateField('critAoaNegDeg', Number(e.target.value))}
                    />
                  </div>
                  <small>Ângulo de ataque de estol invertido (negativo)</small>
                </div>
              </div>

              <div className="sub-fieldset">
                <h4>Incrementos de Sustentação (CL) e Arrasto (CD) das Superfícies Móveis</h4>
                <div className="form-grid-4">
                  <div className="form-field">
                    <label>ΔCL Flap (CLBYFLAP)</label>
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      max={2.5}
                      value={draft.clByFlap}
                      onChange={(e) => updateField('clByFlap', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Sustentação adicional com flaps</small>
                  </div>

                  <div className="form-field">
                    <label>ΔCD Flap (CDBYFLAP)</label>
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      max={1.0}
                      value={draft.cdByFlap}
                      onChange={(e) => updateField('cdByFlap', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Arrasto adicional com flaps</small>
                  </div>

                  <div className="form-field">
                    <label>ΔCD Trem (CDBYGEAR)</label>
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      max={1.0}
                      value={draft.cdByGear}
                      onChange={(e) => updateField('cdByGear', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Arrasto parasita dos trens baixados</small>
                  </div>

                  <div className="form-field">
                    <label>ΔCD Spoiler (CDSPOILR)</label>
                    <input
                      type="number"
                      step={0.01}
                      min={0}
                      max={2.0}
                      value={draft.cdBySpoiler}
                      onChange={(e) => updateField('cdBySpoiler', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Arrasto dos freios aerodinâmicos</small>
                  </div>
                </div>
              </div>

              <div className="sub-fieldset">
                <h4>Coeficientes de Manobrabilidade e Estabilidade Dinâmica</h4>
                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Manobrabilidade Arfagem (CPITMANE)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={50}
                      value={draft.pitchManeuverability}
                      onChange={(e) => updateField('pitchManeuverability', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Sensibilidade do profundor (elevator)</small>
                  </div>

                  <div className="form-field">
                    <label>Estabilidade Arfagem (CPITSTAB)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={50}
                      value={draft.pitchStability}
                      onChange={(e) => updateField('pitchStability', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Tendência do nariz em alinhar com o vento</small>
                  </div>

                  <div className="form-field">
                    <label>Manobrabilidade Rolamento (CROLLMAN)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={50}
                      value={draft.rollManeuverability}
                      onChange={(e) => updateField('rollManeuverability', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Taxa angular de roll (ailerons)</small>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Manobrabilidade Guinada (CYAWMANE)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={50}
                      value={draft.yawManeuverability}
                      onChange={(e) => updateField('yawManeuverability', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Autoridade do leme de direção (rudder)</small>
                  </div>

                  <div className="form-field">
                    <label>Estabilidade Guinada (CYAWSTAB)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={50}
                      value={draft.yawStability}
                      onChange={(e) => updateField('yawStability', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Estabilidade direcional</small>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PONTOS 3D & TRENS */}
          {activeTab === 'points' && (
            <div className="tab-pane">
              <div className="form-section-title">
                <h3>Pontos de Contato 3D, Cockpit e Efeitos Visuais</h3>
                <p>
                  As coordenadas (X = lateral direita/esquerda, Y = vertical altura, Z = longitudinal frente/trás) sincronizam
                  instantaneamente com os marcadores na viewport 3D.
                </p>
              </div>

              <div className="sub-fieldset">
                <div className="sub-fieldset-header">
                  <h4>Trens de Pouso (Triângulo de Contato com o Solo)</h4>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={symmetrizeMainGears}
                    title="Copia os valores do trem esquerdo invertendo X para o trem direito"
                  >
                    <span className="btn-label-long">Simetrizar Trens Principais (Right = -Left.X)</span>
                    <span className="btn-label-short">Simetrizar (Right = -Left.X)</span>
                  </button>
                </div>

                <div className="form-grid-3">
                  <div className="point-card">
                    <h5>Trem Principal Esquerdo (LEFTGEAR)</h5>
                    <div className="xyz-grid">
                      <div>
                        <label>X (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.leftGear?.x ?? 0}
                          onChange={(e) => updatePoint('leftGear', 'x', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Y (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.leftGear?.y ?? 0}
                          onChange={(e) => updatePoint('leftGear', 'y', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Z (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.leftGear?.z ?? 0}
                          onChange={(e) => updatePoint('leftGear', 'z', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="point-card">
                    <h5>Trem Principal Direito (RIGHGEAR)</h5>
                    <div className="xyz-grid">
                      <div>
                        <label>X (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.rightGear?.x ?? 0}
                          onChange={(e) => updatePoint('rightGear', 'x', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Y (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.rightGear?.y ?? 0}
                          onChange={(e) => updatePoint('rightGear', 'y', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Z (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.rightGear?.z ?? 0}
                          onChange={(e) => updatePoint('rightGear', 'z', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="point-card">
                    <h5>Bequilha ou Trem de Nariz (WHELGEAR)</h5>
                    <div className="xyz-grid">
                      <div>
                        <label>X (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.wheelGear?.x ?? 0}
                          onChange={(e) => updatePoint('wheelGear', 'x', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Y (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.wheelGear?.y ?? 0}
                          onChange={(e) => updatePoint('wheelGear', 'y', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Z (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.wheelGear?.z ?? 0}
                          onChange={(e) => updatePoint('wheelGear', 'z', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sub-fieldset">
                <h4>Cockpit e Geradores de Efeitos Visuais</h4>
                <div className="form-grid-3">
                  <div className="point-card highlight">
                    <h5>Posição do Piloto (COCKPITP)</h5>
                    <div className="xyz-grid">
                      <div>
                        <label>X (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.cockpit?.x ?? 0}
                          onChange={(e) => updatePoint('cockpit', 'x', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Y (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.cockpit?.y ?? 0}
                          onChange={(e) => updatePoint('cockpit', 'y', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Z (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.cockpit?.z ?? 0}
                          onChange={(e) => updatePoint('cockpit', 'z', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                    </div>
                    <small>Origem da câmera em 1ª pessoa no simulador</small>
                  </div>

                  <div className="point-card">
                    <h5>Gerador de Fumaça (SMOKEGEN)</h5>
                    <div className="xyz-grid">
                      <div>
                        <label>X (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.smokeGen?.x ?? 0}
                          onChange={(e) => updatePoint('smokeGen', 'x', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Y (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.smokeGen?.y ?? 0}
                          onChange={(e) => updatePoint('smokeGen', 'y', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Z (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.smokeGen?.z ?? 0}
                          onChange={(e) => updatePoint('smokeGen', 'z', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                    </div>
                    <small>Ponto de emissão da fumaça acrobática</small>
                  </div>

                  <div className="point-card">
                    <h5>Vapor de Ponta de Asa (VAPORPO0)</h5>
                    <div className="xyz-grid">
                      <div>
                        <label>X (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.vapor0?.x ?? 0}
                          onChange={(e) => updatePoint('vapor0', 'x', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Y (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.vapor0?.y ?? 0}
                          onChange={(e) => updatePoint('vapor0', 'y', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                      <div>
                        <label>Z (m)</label>
                        <input
                          type="number"
                          step={0.05}
                          value={draft.points3D.vapor0?.z ?? 0}
                          onChange={(e) => updatePoint('vapor0', 'z', Number(e.target.value))}
                          className="native-input"
                        />
                      </div>
                    </div>
                    <small>Condensação em curvas de alto G</small>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ARMAMENTOS & GATILHOS */}
          {activeTab === 'weapons' && (
            <div className="tab-pane">
              <div className="form-section-title">
                <h3>Sistemas de Armas, Canhões, Mísseis e Gatilhos de Disparo</h3>
                <p>Controle de munições, cadência de fogo, capacidade de mísseis/bombas e mapeamento de gatilhos.</p>
              </div>

              <div className="sub-fieldset">
                <h4>Armamento de Tubo (Canhão / Metralhadora)</h4>
                <div className="form-grid-4">
                  <div className="form-field">
                    <label>Munição do Canhão (INITIGUN)</label>
                    <input
                      type="number"
                      step={50}
                      min={0}
                      max={5000}
                      value={draft.initGunRounds || 0}
                      onChange={(e) => updateField('initGunRounds', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Número de projéteis (0 = sem canhão)</small>
                  </div>

                  <div className="form-field">
                    <label>Poder de Dano (GUNPOWER)</label>
                    <input
                      type="number"
                      step={1}
                      min={1}
                      max={20}
                      value={draft.gunPower || 1}
                      onChange={(e) => updateField('gunPower', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Dano por impacto (1 = 20mm, 2 = 30mm)</small>
                  </div>

                  <div className="form-field">
                    <label>Cadência (GUNINTVL s)</label>
                    <input
                      type="number"
                      step={0.01}
                      min={0.01}
                      max={0.5}
                      value={draft.gunIntervalSec || 0.05}
                      onChange={(e) => updateField('gunIntervalSec', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Intervalo entre disparos (0.05s = 1200 tpm)</small>
                  </div>

                  <div className="form-field">
                    <label>Mira Computada (GUNSIGHT)</label>
                    <label className="native-check-item">
                      <input
                        type="checkbox"
                        checked={draft.hasGunSight}
                        onChange={(e) => updateField('hasGunSight', e.target.checked)}
                      />
                      <span>HUD Lead Reticle / Gunsight</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="sub-fieldset">
                <h4>Cargas Bélicas Externas &amp; Contramedidas</h4>
                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Mísseis Ar-Ar AAM (Inicial / Máx)</label>
                    <div className="input-group-dual">
                      <input
                        type="number"
                        min={0}
                        max={draft.maxAam || 12}
                        value={draft.initAam || 0}
                        onChange={(e) => updateField('initAam', Number(e.target.value))}
                        className="native-input"
                      />
                      <span>/</span>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={draft.maxAam || 0}
                        onChange={(e) => updateField('maxAam', Number(e.target.value))}
                        className="native-input"
                      />
                    </div>
                    <small>Ex: Sidewinder, Piranha, AMRAAM</small>
                  </div>

                  <div className="form-field">
                    <label>Mísseis Ar-Solo AGM (Inicial / Máx)</label>
                    <div className="input-group-dual">
                      <input
                        type="number"
                        min={0}
                        max={draft.maxAgm || 12}
                        value={draft.initAgm || 0}
                        onChange={(e) => updateField('initAgm', Number(e.target.value))}
                        className="native-input"
                      />
                      <span>/</span>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={draft.maxAgm || 0}
                        onChange={(e) => updateField('maxAgm', Number(e.target.value))}
                        className="native-input"
                      />
                    </div>
                    <small>Ex: Maverick, Exocet, MAR-1</small>
                  </div>

                  <div className="form-field">
                    <label>Bombas Convencionais (Inicial / Máx)</label>
                    <div className="input-group-dual">
                      <input
                        type="number"
                        min={0}
                        max={draft.maxBomb || 24}
                        value={draft.initBomb || 0}
                        onChange={(e) => updateField('initBomb', Number(e.target.value))}
                        className="native-input"
                      />
                      <span>/</span>
                      <input
                        type="number"
                        min={0}
                        max={48}
                        value={draft.maxBomb || 0}
                        onChange={(e) => updateField('maxBomb', Number(e.target.value))}
                        className="native-input"
                      />
                    </div>
                    <small>Ex: Mk-82, BAFG-230, LGB</small>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Foguetes não-guiados (Inicial / Máx)</label>
                    <div className="input-group-dual">
                      <input
                        type="number"
                        min={0}
                        max={draft.maxRockets || 76}
                        value={draft.initRockets || 0}
                        onChange={(e) => updateField('initRockets', Number(e.target.value))}
                        className="native-input"
                      />
                      <span>/</span>
                      <input
                        type="number"
                        min={0}
                        max={150}
                        value={draft.maxRockets || 0}
                        onChange={(e) => updateField('maxRockets', Number(e.target.value))}
                        className="native-input"
                      />
                    </div>
                    <small>Ex: Pods SBAT 70mm, FFAR</small>
                  </div>

                  <div className="form-field">
                    <label>Flares Térmicos Máximos (MAXNMFLR)</label>
                    <input
                      type="number"
                      min={0}
                      max={240}
                      value={draft.maxFlares || 0}
                      onChange={(e) => updateField('maxFlares', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Contramedidas infravermelhas para despistar mísseis</small>
                  </div>
                </div>
              </div>

              <div className="sub-fieldset">
                <h4>Atribuição de Gatilhos (TRIGGERS)</h4>
                <div className="form-grid-4">
                  <div className="form-field">
                    <label>Gatilho 1 (TRIGGER1)</label>
                    <select
                      value={draft.triggers?.trigger1 || 'GUN'}
                      onChange={(e) => updateTrigger('trigger1', e.target.value)}
                      className="native-select"
                    >
                      <option value="GUN">GUN (Canhão / Metralhadora)</option>
                      <option value="AAM">AAM (Míssil Ar-Ar)</option>
                      <option value="AGM">AGM (Míssil Ar-Solo)</option>
                      <option value="BOMB">BOMB (Bomba)</option>
                      <option value="RKT">RKT (Foguete)</option>
                      <option value="NONE">NONE (Nenhum)</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Gatilho 2 (TRIGGER2)</label>
                    <select
                      value={draft.triggers?.trigger2 || 'AAM'}
                      onChange={(e) => updateTrigger('trigger2', e.target.value)}
                      className="native-select"
                    >
                      <option value="AAM">AAM (Míssil Ar-Ar)</option>
                      <option value="AGM">AGM (Míssil Ar-Solo)</option>
                      <option value="BOMB">BOMB (Bomba)</option>
                      <option value="RKT">RKT (Foguete)</option>
                      <option value="GUN">GUN (Canhão)</option>
                      <option value="NONE">NONE (Nenhum)</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Gatilho 3 (TRIGGER3)</label>
                    <select
                      value={draft.triggers?.trigger3 || 'AGM'}
                      onChange={(e) => updateTrigger('trigger3', e.target.value)}
                      className="native-select"
                    >
                      <option value="AGM">AGM (Míssil Ar-Solo)</option>
                      <option value="BOMB">BOMB (Bomba)</option>
                      <option value="RKT">RKT (Foguete)</option>
                      <option value="AAM">AAM (Míssil Ar-Ar)</option>
                      <option value="NONE">NONE (Nenhum)</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Gatilho 4 (TRIGGER4)</label>
                    <select
                      value={draft.triggers?.trigger4 || 'BOMB'}
                      onChange={(e) => updateTrigger('trigger4', e.target.value)}
                      className="native-select"
                    >
                      <option value="BOMB">BOMB (Bomba)</option>
                      <option value="RKT">RKT (Foguete)</option>
                      <option value="AGM">AGM (Míssil Ar-Solo)</option>
                      <option value="NONE">NONE (Nenhum)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: OPERAÇÕES & ENVELOPE */}
          {activeTab === 'operations' && (
            <div className="tab-pane">
              <div className="form-section-title">
                <h3>Envelope de Voo, Regime de Cruzeiro e Pouso</h3>
                <p>Configurações de velocidade máxima estrutural, velocidades de manobra e referências para a IA.</p>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label>Velocidade Máxima (MAXSPEED)</label>
                  <input
                    type="text"
                    value={draft.maxSpeed}
                    onChange={(e) => updateField('maxSpeed', e.target.value)}
                    className="native-input"
                  />
                  <small>VNE ou limite de Mach (ex: 170kt, 450kt, 0.9MACH)</small>
                </div>

                <div className="form-field">
                  <label>Vel. Manobra Inicial (MANESPD1)</label>
                  <input
                    type="text"
                    value={draft.maneSpeed1}
                    onChange={(e) => updateField('maneSpeed1', e.target.value)}
                    className="native-input"
                  />
                  <small>Velocidade onde a autoridade aerodinâmica começa</small>
                </div>

                <div className="form-field">
                  <label>Vel. Manobra Plena (MANESPD2)</label>
                  <input
                    type="text"
                    value={draft.maneSpeed2}
                    onChange={(e) => updateField('maneSpeed2', e.target.value)}
                    className="native-input"
                  />
                  <small>Velocidade de máxima eficiência dos comandos</small>
                </div>
              </div>

              <div className="sub-fieldset">
                <h4>Regime de Cruzeiro de Referência (REF CRUISE)</h4>
                <div className="form-grid-3">
                  <div className="form-field">
                    <label>Velocidade de Cruzeiro (REFVCRUS)</label>
                    <input
                      type="text"
                      value={draft.refCruisingSpeed}
                      onChange={(e) => updateField('refCruisingSpeed', e.target.value)}
                      className="native-input"
                    />
                    <small>Ex: 140kt, 450kt</small>
                  </div>

                  <div className="form-field">
                    <label>Altitude de Cruzeiro (REFACRUS)</label>
                    <input
                      type="text"
                      value={draft.refCruisingAlt}
                      onChange={(e) => updateField('refCruisingAlt', e.target.value)}
                      className="native-input"
                    />
                    <small>Ex: 8000ft, 35000ft</small>
                  </div>

                  <div className="form-field">
                    <label>Potência em Cruzeiro (REFTCRUS %)</label>
                    <input
                      type="number"
                      step={1}
                      min={10}
                      max={100}
                      value={draft.refCruisingThrottle || 75}
                      onChange={(e) => updateField('refCruisingThrottle', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Abertura típica de manete em regime econômico</small>
                  </div>
                </div>
              </div>

              <div className="sub-fieldset">
                <h4>Regime de Aproximação e Pouso (REF LANDING)</h4>
                <div className="form-grid-4">
                  <div className="form-field">
                    <label>Velocidade de Pouso (REFVLAND)</label>
                    <input
                      type="text"
                      value={draft.refLandingSpeed}
                      onChange={(e) => updateField('refLandingSpeed', e.target.value)}
                      className="native-input"
                    />
                    <small>Velocidade na rampa Vref (ex: 75kt, 135kt)</small>
                  </div>

                  <div className="form-field">
                    <label>AOA de Pouso (REFAOALD °)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={20}
                      value={draft.refLandingAoaDeg || 6}
                      onChange={(e) => updateField('refLandingAoaDeg', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Atitude de nariz na final</small>
                  </div>

                  <div className="form-field">
                    <label>Potência no Pouso (REFTHRLD %)</label>
                    <input
                      type="number"
                      step={1}
                      min={5}
                      max={70}
                      value={draft.refLandingThrottle || 35}
                      onChange={(e) => updateField('refLandingThrottle', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Abertura de manete na aproximação final</small>
                  </div>

                  <div className="form-field">
                    <label>Pista Mínima (REFLNRWY m)</label>
                    <input
                      type="number"
                      step={50}
                      min={200}
                      max={4000}
                      value={draft.refRunwayM || 600}
                      onChange={(e) => updateField('refRunwayM', Number(e.target.value))}
                      className="native-input"
                    />
                    <small>Comprimento mínimo de pista requerido</small>
                  </div>
                </div>
              </div>

              <div className="sub-fieldset">
                <h4>Cálculo Automático &amp; Painel de Instrumentos</h4>
                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Painel de Instrumentos 2D (INSTPANL)</label>
                    <label className="native-check-item">
                      <input
                        type="checkbox"
                        checked={draft.hasInstrumentPanel || false}
                        onChange={(e) => updateField('hasInstrumentPanel', e.target.checked)}
                      />
                      <span>Habilitar Painel de Instrumentos</span>
                    </label>
                  </div>

                  <div className="form-field">
                    <label>Autocálculo do Simulador (AUTOCALC)</label>
                    <div className="checkbox-field-wrap">
                      <label className="native-check-item">
                        <input
                          type="checkbox"
                          checked={draft.autoCalc}
                          onChange={(e) => updateField('autoCalc', e.target.checked)}
                        />
                        <span>Permitir que o YSFlight auto-calcule parâmetros ausentes</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: POLARES & GRÁFICOS */}
          {activeTab === 'curves' && (
            <div className="tab-pane">
              <div className="form-section-title">
                <h3>Análise Polar Aerodinâmica e Decomposição de Massas</h3>
                <p>
                  Gráficos vetoriais interativos gerados a partir da curva de sustentação $C_L \times \alpha$ e dados de peso do avião.
                </p>
              </div>

              <AeroCurvesPreview data={draft} validation={validation} />
            </div>
          )}

          {/* TAB 9: DIFF & CÓDIGO .DAT */}
          {activeTab === 'diff' && (
            <div className="tab-pane">
              <div className="form-section-title">
                <h3>Comparativo de Alterações (Diff) e Código ASCII Gerado</h3>
                <p>
                  Visualize exatamente o que foi adicionado, alterado ou mantido em relação ao arquivo <code>.dat</code> original.
                </p>
              </div>

              <DatDiffViewer originalText={originalDatText} editedText={serializedText} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
