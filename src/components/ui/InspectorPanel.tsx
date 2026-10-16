import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Code2,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Search,
  Sparkles,
  Sliders,
  Wrench,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  AircraftDatData,
  DnmModelData,
  DnmNode,
  SrfMeshData,
} from '../../types/ysflight';
import { getClaChannelInfo } from '../../math/ysTransform';
import { RenderSettings } from '../viewport/AircraftViewport';

interface InspectorPanelProps {
  dnmData: DnmModelData | null;
  collData: SrfMeshData | null;
  datData: AircraftDatData | null;
  rawFiles: {
    lst: string;
    dat: string;
    dnmHeader: string;
  };
  renderSettings: RenderSettings;
  onUpdateRenderSettings: React.Dispatch<React.SetStateAction<RenderSettings>>;
  hiddenNodes: Set<string>;
  onToggleNodeVisibility: (nodeName: string) => void;
  onShowAllNodes: () => void;
  onIsolateNode: (nodeName: string) => void;
  selectedNodeName: string | null;
  onSelectNode: (nodeName: string | null) => void;
  onOpenDatEditor?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  dnmData,
  collData,
  datData,
  rawFiles,
  renderSettings,
  onUpdateRenderSettings,
  hiddenNodes,
  onToggleNodeVisibility,
  onShowAllNodes,
  onIsolateNode,
  selectedNodeName,
  onSelectNode,
  onOpenDatEditor,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [activeRawTab, setActiveRawTab] = useState<'dat' | 'lst' | 'dnm'>('dat');

  // Compute total vertices and polygons in active SRF nodes
  const modelStats = useMemo(() => {
    if (!dnmData) return { activeVertices: 0, activeFaces: 0 };
    let activeVertices = 0;
    let activeFaces = 0;
    for (const n of dnmData.nodes) {
      const m = dnmData.pckMeshes[n.fileName] || dnmData.pckMeshes[n.fileName.toLowerCase()];
      if (m) {
        activeVertices += m.vertices.length;
        activeFaces += m.polygons.length;
      }
    }
    return { activeVertices, activeFaces };
  }, [dnmData]);

  const filteredNodes = useMemo(() => {
    if (!dnmData) return [];
    return dnmData.nodes.filter((n) => {
      const info = getClaChannelInfo(n.cla, n.nst);
      if (categoryFilter !== 'all' && info.category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          n.name.toLowerCase().includes(q) ||
          n.fileName.toLowerCase().includes(q) ||
          info.label.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dnmData, categoryFilter, searchQuery]);

  const selectedNode: DnmNode | undefined = useMemo(() => {
    if (!dnmData || !selectedNodeName) return undefined;
    return dnmData.nodes.find((n) => n.uid === selectedNodeName || n.name === selectedNodeName);
  }, [dnmData, selectedNodeName]);

  const selectedMesh: SrfMeshData | undefined = useMemo(() => {
    if (!dnmData || !selectedNode) return undefined;
    return dnmData.pckMeshes[selectedNode.fileName] || dnmData.pckMeshes[selectedNode.fileName.toLowerCase()];
  }, [dnmData, selectedNode]);

  const openRawModal = () => {
    dialogRef.current?.showModal();
  };

  const closeRawModal = () => {
    dialogRef.current?.close();
  };

  if (isCollapsed) {
    return (
      <aside className="side-panel right-panel collapsed" aria-label="Inspetor 3D Recolhido">
        <button
          type="button"
          className="panel-rail-btn"
          onClick={onToggleCollapse}
          title="Expandir Inspetor 3D & Engenharia"
        >
          <ChevronLeft size={16} />
          <span className="rail-vertical-text">Inspetor 3D</span>
          <Layers size={14} className="rail-icon" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="side-panel right-panel" aria-label="Inspetor de Modelo e Engenharia">
      <div className="panel-header">
        <div className="panel-title-group">
          <Layers size={18} className="accent-icon" />
          <div>
            <h2>Inspetor 3D &amp; Engenharia</h2>
            <p>
              {modelStats.activeFaces.toLocaleString('pt-BR')} faces •{' '}
              {modelStats.activeVertices.toLocaleString('pt-BR')} vértices
            </p>
          </div>
        </div>
        <div className="panel-header-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={openRawModal}
            title="Inspecionar código-fonte bruto dos arquivos (.dat, .lst, .dnm)"
          >
            <Code2 size={13} />
            <span>Arquivos</span>
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              className="panel-toggle-btn"
              onClick={onToggleCollapse}
              title="Recolher painel do inspetor"
              aria-label="Recolher painel do inspetor"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="panel-scroll-body">
        {/* 1. Camadas e Modos de Renderização */}
        <details className="native-accordion" open>
          <summary>
            <span className="summary-title">
              <Sparkles size={15} /> Camadas e Modos Visuais
            </span>
          </summary>

          <div className="accordion-content">
            <div className="checkbox-grid">
              <label className="native-check-item">
                <input
                  type="checkbox"
                  checked={renderSettings.showVisualDnm}
                  onChange={(e) =>
                    onUpdateRenderSettings((prev) => ({
                      ...prev,
                      previewOrphanPck: null,
                      showVisualDnm: e.target.checked,
                    }))
                  }
                />
                <span>Malha Visual (`.dnm`)</span>
              </label>

              <label className="native-check-item">
                <input
                  type="checkbox"
                  checked={renderSettings.showCollisionSrf}
                  onChange={(e) =>
                    onUpdateRenderSettings((prev) => ({
                      ...prev,
                      previewOrphanPck: null,
                      showCollisionSrf: e.target.checked,
                    }))
                  }
                />
                <span>
                  Colisão (`_coll.srf` • {collData?.polygons.length ?? 0} faces)
                </span>
              </label>

              <label className="native-check-item">
                <input
                  type="checkbox"
                  checked={renderSettings.wireframe}
                  onChange={(e) =>
                    onUpdateRenderSettings((prev) => ({
                      ...prev,
                      wireframe: e.target.checked,
                    }))
                  }
                />
                <span>Modo Wireframe</span>
              </label>

              <label className="native-check-item">
                <input
                  type="checkbox"
                  checked={renderSettings.xrayMode}
                  onChange={(e) =>
                    onUpdateRenderSettings((prev) => ({
                      ...prev,
                      xrayMode: e.target.checked,
                    }))
                  }
                />
                <span>Raio-X Estrutural</span>
              </label>

              <label className="native-check-item">
                <input
                  type="checkbox"
                  checked={renderSettings.flatShading}
                  onChange={(e) =>
                    onUpdateRenderSettings((prev) => ({
                      ...prev,
                      flatShading: e.target.checked,
                    }))
                  }
                />
                <span>Forçar Flat Shading (ignorar `R`)</span>
              </label>

              <label className="native-check-item">
                <input
                  type="checkbox"
                  checked={renderSettings.showDatMarkers}
                  onChange={(e) =>
                    onUpdateRenderSettings((prev) => ({
                      ...prev,
                      showDatMarkers: e.target.checked,
                    }))
                  }
                />
                <span>Marcadores 3D (`.dat`)</span>
              </label>

              <label className="native-check-item">
                <input
                  type="checkbox"
                  checked={renderSettings.showBoundingSphere}
                  onChange={(e) =>
                    onUpdateRenderSettings((prev) => ({
                      ...prev,
                      showBoundingSphere: e.target.checked,
                    }))
                  }
                />
                <span>
                  Esfera `HTRADIUS` ({datData?.outsideRadiusM ?? 6.5}m)
                </span>
              </label>

              <label className="native-check-item">
                <input
                  type="checkbox"
                  checked={renderSettings.showGrid}
                  onChange={(e) =>
                    onUpdateRenderSettings((prev) => ({
                      ...prev,
                      showGrid: e.target.checked,
                    }))
                  }
                />
                <span>Grade e Sombra do Hangar</span>
              </label>
            </div>
          </div>
        </details>

        {/* 2. Detalhes da Peça Selecionada (se houver) */}
        {selectedNode && (
          <div className="selected-node-card">
            <div className="selected-node-header">
              <div>
                <span className="selected-tag">PEÇA SELECIONADA</span>
                <h3>
                  SRF &quot;{selectedNode.name}&quot; —{' '}
                  <code>{selectedNode.fileName}</code>
                </h3>
              </div>
              <button
                type="button"
                className="hud-clear-btn"
                onClick={() => onSelectNode(null)}
              >
                ×
              </button>
            </div>
            <p className="selected-cla-desc">
              {getClaChannelInfo(selectedNode.cla, selectedNode.nst).label}
            </p>
            <div className="selected-node-metrics">
              <div>
                <small>Vértices</small>
                <strong className="mono">{selectedMesh?.vertices.length ?? 0}</strong>
              </div>
              <div>
                <small>Polígonos</small>
                <strong className="mono">{selectedMesh?.polygons.length ?? 0}</strong>
              </div>
              <div>
                <small>Estados (NST)</small>
                <strong className="mono">{selectedNode.nst}</strong>
              </div>
              <div>
                <small>Filhos (NCH)</small>
                <strong className="mono">{selectedNode.childrenNames.length}</strong>
              </div>
            </div>
            <div className="selected-node-pos mono">
              <div>
                POS: ({selectedNode.pos.pos.x.toFixed(2)},{' '}
                {selectedNode.pos.pos.y.toFixed(2)},{' '}
                {selectedNode.pos.pos.z.toFixed(2)})m | Att: [
                {selectedNode.pos.att.h}, {selectedNode.pos.att.p},{' '}
                {selectedNode.pos.att.b}]
              </div>
              {selectedNode.states.map((st, idx) => (
                <div key={idx}>
                  STA {idx}: Δ({st.pos.x.toFixed(2)}, {st.pos.y.toFixed(2)},{' '}
                  {st.pos.z.toFixed(2)}) | ΔAtt: [{st.att.h}, {st.att.p},{' '}
                  {st.att.b}] | Vis: {st.visible}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Árvore do Grafo de Cena (25 Nós SRF Ativos) */}
        <details className="native-accordion" open>
          <summary>
            <span className="summary-title">
              <Box size={15} /> Grafo de Cena DNM ({dnmData?.nodes.length ?? 0} Nós SRF)
            </span>
            {hiddenNodes.size > 0 && (
              <span className="summary-badge warn">
                {hiddenNodes.size} oculto(s)
              </span>
            )}
          </summary>

          <div className="accordion-content">
            <div className="tree-toolbar">
              <select
                className="native-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtrar categoria de peças"
              >
                <option value="all">Todas as Peças ({dnmData?.nodes.length ?? 0})</option>
                <option value="control">Superfícies &amp; Comandos (CLA 1, 4..8, 9..11, 16, 31)</option>
                <option value="gear">Trem de Pouso &amp; Portas (CLA 0, 14, 15, 17)</option>
                <option value="prop">Propulsão &amp; Pós-Combustor (CLA 2, 3, 18, 20)</option>
                <option value="static">Estrutura &amp; Fuselagem (Estáticos)</option>
              </select>

              {hiddenNodes.size > 0 && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={onShowAllNodes}
                >
                  Mostrar Tudo
                </button>
              )}
            </div>

            <div className="search-input-wrap">
              <Search size={14} className="search-icon" />
              <input
                type="search"
                className="native-search"
                placeholder="Buscar nó SRF ou arquivo .srf..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="srf-node-list">
              {filteredNodes.map((node) => {
                const isHidden = hiddenNodes.has(node.uid) || hiddenNodes.has(node.name);
                const isSelected =
                  selectedNodeName === node.uid || selectedNodeName === node.name;
                const info = getClaChannelInfo(node.cla, node.nst);
                const mesh =
                  dnmData?.pckMeshes[node.fileName] ||
                  dnmData?.pckMeshes[node.fileName.toLowerCase()];

                return (
                  <div
                    key={node.uid}
                    className={`srf-node-row ${isSelected ? 'selected' : ''} ${
                      isHidden ? 'hidden-node' : ''
                    }`}
                    onClick={() =>
                      onSelectNode(isSelected ? null : node.uid)
                    }
                  >
                    <div className="srf-node-main">
                      <span className={`cat-dot ${info.category}`} />
                      <div>
                        <div className="srf-node-title">
                          <strong>SRF &quot;{node.name}&quot;</strong>
                          {node.fileName && <code className="mono">{node.fileName}</code>}
                          {node.meshSource === 'external' && (
                            <span className="source-pill external">SRF Ext</span>
                          )}
                          {node.meshSource === 'pck' && (
                            <span className="source-pill pck">PCK</span>
                          )}
                        </div>
                        <small className="srf-node-sub">
                          {info.label} • {mesh?.polygons.length ?? 0} faces
                          {node.childrenNames.length > 0
                            ? ` • Filhos: [${node.childrenNames.join(', ')}]`
                            : ''}
                        </small>
                      </div>
                    </div>

                    <div
                      className="srf-node-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="icon-btn"
                        title="Isolar apenas esta peça (Solo)"
                        onClick={() => onIsolateNode(node.uid)}
                      >
                        Solo
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title={isHidden ? 'Mostrar peça' : 'Ocultar peça'}
                        onClick={() => onToggleNodeVisibility(node.uid)}
                      >
                        {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </details>

        {/* 4. Explorador das 21 Malhas PCK Órfãs encontradas no Estudo */}
        {dnmData && dnmData.unreferencedPcks.length > 0 && (
          <details className="native-accordion">
            <summary>
              <span className="summary-title">
                <Wrench size={15} /> Malhas PCK Órfãs no Arquivo (
                {dnmData.unreferencedPcks.length})
              </span>
            </summary>
            <div className="accordion-content">
              <p className="helper-note">
                O arquivo <code>t25universal.dnm</code> possui 46 blocos{' '}
                <code>PCK</code>, mas apenas 25 estão conectados a nós{' '}
                <code>SRF</code>. Selecione abaixo para inspecionar as 21 malhas
                não utilizadas:
              </p>
              <select
                className="native-select full-width"
                value={renderSettings.previewOrphanPck ?? ''}
                onChange={(e) =>
                  onUpdateRenderSettings((prev) => ({
                    ...prev,
                    previewOrphanPck: e.target.value || null,
                  }))
                }
              >
                <option value="">
                  — Voltar ao Modelo Completo (25 Nós SRF Ativos) —
                </option>
                {dnmData.unreferencedPcks.map((pckName) => {
                  const m = dnmData.pckMeshes[pckName];
                  return (
                    <option key={pckName} value={pckName}>
                      PCK {pckName} ({m?.polygons.length ?? 0} faces,{' '}
                      {m?.vertices.length ?? 0} vértices)
                    </option>
                  );
                })}
              </select>
            </div>
          </details>
        )}

        {/* 5. Especificações de Engenharia e Aerodinâmica (t25universal.dat) */}
        {datData && (
          <details className="native-accordion" open>
            <summary>
              <span className="summary-title">
                <FileText size={15} /> Ficha Técnica (`t25universal.dat`)
              </span>
              <span className="summary-badge">{datData.category}</span>
            </summary>

            <div className="accordion-content">
              {onOpenDatEditor && (
                <div style={{ marginBottom: '10px' }}>
                  <button
                    type="button"
                    className="secondary-btn full-width"
                    onClick={onOpenDatEditor}
                    title="Editar propriedades completas, aerodinâmica e física da aeronave"
                  >
                    <Sliders size={14} />
                    <span>Editar Propriedades (.dat)</span>
                  </button>
                </div>
              )}
              <table className="specs-table">
                <tbody>
                  <tr>
                    <th>Identificação</th>
                    <td className="mono">{datData.identify}</td>
                  </tr>
                  <tr>
                    <th>Motorização</th>
                    <td className="mono">Pistão / Hélice {datData.enginePower}</td>
                  </tr>
                  <tr>
                    <th>Peso Limpo / Combustível</th>
                    <td className="mono">
                      {datData.weightCleanTon} t / {datData.weightFuelTon} t (Máx Payload:{' '}
                      {datData.weightPayloadTon} t)
                    </td>
                  </tr>
                  <tr>
                    <th>Velocidade Crítica / Máx</th>
                    <td className="mono">
                      {datData.critSpeed} / {datData.maxSpeed}
                    </td>
                  </tr>
                  <tr>
                    <th>Vel. Manobra (Min / Plena)</th>
                    <td className="mono">
                      {datData.maneSpeed1} / {datData.maneSpeed2}
                    </td>
                  </tr>
                  <tr>
                    <th>Cruzeiro Ref.</th>
                    <td className="mono">
                      {datData.refCruisingSpeed} @ {datData.refCruisingAlt}
                    </td>
                  </tr>
                  <tr>
                    <th>Pouso Ref. / Pista</th>
                    <td className="mono">
                      {datData.refLandingSpeed} (AOA {datData.refLandingAoaDeg}°) •{' '}
                      {datData.refRunwayM} m
                    </td>
                  </tr>
                  <tr>
                    <th>AOA Crítico (+ / -)</th>
                    <td className="mono">
                      +{datData.critAoaPosDeg}° / {datData.critAoaNegDeg}°
                    </td>
                  </tr>
                  <tr>
                    <th>Área Alar / Raio Ext.</th>
                    <td className="mono">
                      {datData.wingAreaM2} m² • HTRADIUS {datData.outsideRadiusM} m
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      {/* Native HTML5 <dialog> Modal for Raw File Inspection */}
      <dialog ref={dialogRef} className="native-dialog">
        <div className="dialog-header">
          <div>
            <h3>Inspeção de Arquivos Brutos (Pasta t-25)</h3>
            <p>Visualização direta da estrutura ASCII do YSFlight</p>
          </div>
          <button type="button" className="secondary-btn" onClick={closeRawModal}>
            Fechar (ESC)
          </button>
        </div>

        <div className="dialog-tabs">
          <button
            type="button"
            className={`tab-btn ${activeRawTab === 'dat' ? 'active' : ''}`}
            onClick={() => setActiveRawTab('dat')}
          >
            t25universal.dat (Física/Dados)
          </button>
          <button
            type="button"
            className={`tab-btn ${activeRawTab === 'lst' ? 'active' : ''}`}
            onClick={() => setActiveRawTab('lst')}
          >
            t25universal.lst (Manifesto)
          </button>
          <button
            type="button"
            className={`tab-btn ${activeRawTab === 'dnm' ? 'active' : ''}`}
            onClick={() => setActiveRawTab('dnm')}
          >
            t25universal.dnm (Amostra Grafo SRF)
          </button>
        </div>

        <pre className="dialog-code-preview mono">
          {activeRawTab === 'dat'
            ? rawFiles.dat
            : activeRawTab === 'lst'
            ? rawFiles.lst
            : rawFiles.dnmHeader}
        </pre>
      </dialog>
    </aside>
  );
};
