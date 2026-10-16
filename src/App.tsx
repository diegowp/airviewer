import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  AircraftCatalogEntry,
  AircraftDatData,
  CameraPreset,
  DnmModelData,
  FlightControlState,
  SrfMeshData,
} from './types/ysflight';
import { AIRCRAFT_CATALOG, resolveDiskSrfFilename } from './data/aircraftCatalog';
import { parseDnmText } from './parsers/dnmParser';
import { parseSrfText } from './parsers/srfParser';
import { parseDatText } from './parsers/datParser';
import { TopBar } from './components/ui/TopBar';
import { FlightControlsPanel } from './components/ui/FlightControlsPanel';
import { InspectorPanel } from './components/ui/InspectorPanel';
import { AircraftViewport, RenderSettings } from './components/viewport/AircraftViewport';
import { AircraftDatEditor } from './components/editor/AircraftDatEditor';
import { AlertTriangle, Loader2 } from 'lucide-react';

const INITIAL_CONTROLS: FlightControlState = {
  aileron: 0,
  elevator: 0,
  rudder: 0,
  gear: 1, // Trem baixado inicialmente (3 Greens)
  gearTarget: 1,
  throttle: 0.25,
  engineRunning: true,
  vgw: 0,
  flap: 0,
  spoiler: 0,
  afterburner: false,
  bombBay: 0,
  doorsAndLights: 0,
  brakeChuteAndHook: 0,
  autoDemo: false,
};

const INITIAL_RENDER_SETTINGS: RenderSettings = {
  showVisualDnm: true,
  showCollisionSrf: false,
  wireframe: false,
  flatShading: false,
  xrayMode: false,
  showDatMarkers: true,
  showBoundingSphere: false,
  showGrid: true,
  previewOrphanPck: null,
};

export const App: React.FC = () => {
  const [selectedAircraftId, setSelectedAircraftId] = useState<string>('t-25-universal');
  const [dnmData, setDnmData] = useState<DnmModelData | null>(null);
  const [collData, setCollData] = useState<SrfMeshData | null>(null);
  const [datData, setDatData] = useState<AircraftDatData | null>(null);
  const [rawFiles, setRawFiles] = useState<{
    lst: string;
    dat: string;
    dnmHeader: string;
  }>({
    lst: '',
    dat: '',
    dnmHeader: '',
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [controls, setControls] = useState<FlightControlState>(INITIAL_CONTROLS);
  const [renderSettings, setRenderSettings] = useState<RenderSettings>(
    INITIAL_RENDER_SETTINGS
  );
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('hangar');
  const [cameraResetTrigger, setCameraResetTrigger] = useState<number>(0);

  const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [isDatEditorOpen, setIsDatEditorOpen] = useState<boolean>(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState<boolean>(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState<boolean>(false);

  const handleApplyDat = useCallback((updatedDat: AircraftDatData, updatedText: string) => {
    setDatData(updatedDat);
    setRawFiles((prev) => ({ ...prev, dat: updatedText }));
  }, []);

  // Função central para carregar uma aeronave do catálogo com suporte a múltiplos SRFs externos
  const loadCatalogAircraft = useCallback(async (entry: AircraftCatalogEntry) => {
    try {
      setLoading(true);
      setError(null);

      // 1. Carrega o arquivo principal .dnm
      const dnmRes = await fetch(`${entry.baseDir}/${entry.dnmFile}`);
      if (!dnmRes.ok) {
        throw new Error(`Falha ao carregar ${entry.dnmFile} (${dnmRes.status})`);
      }
      const dnmText = await dnmRes.text();

      // 2. Carrega o arquivo .dat de especificações técnicas
      let datText = '';
      let parsedDat: AircraftDatData | null = null;
      try {
        const datRes = await fetch(`${entry.baseDir}/${entry.datFile}`);
        if (datRes.ok) {
          datText = await datRes.text();
          parsedDat = parseDatText(datText);
        }
      } catch (err) {
        console.warn(`Aviso ao carregar .dat:`, err);
      }

      // 3. Carrega a malha de colisão (SRF) se existir
      let parsedColl: SrfMeshData | null = null;
      if (entry.collFile) {
        try {
          const collRes = await fetch(`${entry.baseDir}/${entry.collFile}`);
          if (collRes.ok) {
            const collText = await collRes.text();
            parsedColl = parseSrfText(collText, entry.collFile);
          }
        } catch (err) {
          console.warn(`Aviso ao carregar malha de colisão:`, err);
        }
      }

      // 4. Pré-parse do DNM para identificar todas as peças externas necessárias (.srf)
      const preliminaryDnm = parseDnmText(dnmText);
      const externalMeshes: Record<string, SrfMeshData> = {};

      if (preliminaryDnm.externalSrfNames && preliminaryDnm.externalSrfNames.length > 0) {
        await Promise.all(
          preliminaryDnm.externalSrfNames.map(async (requestedSrf) => {
            const diskFileName =
              resolveDiskSrfFilename(entry, requestedSrf) || requestedSrf;
            try {
              const srfRes = await fetch(`${entry.baseDir}/${diskFileName}`);
              if (srfRes.ok) {
                const srfText = await srfRes.text();
                const mesh = parseSrfText(srfText, diskFileName);
                externalMeshes[requestedSrf] = mesh;
                externalMeshes[requestedSrf.toLowerCase()] = mesh;
                externalMeshes[diskFileName] = mesh;
                externalMeshes[diskFileName.toLowerCase()] = mesh;
              }
            } catch (srfErr) {
              console.warn(
                `Não foi possível carregar a peça externa ${diskFileName}:`,
                srfErr
              );
            }
          })
        );
      }

      // 5. Parse final do DNM integrando as malhas externas resolvidas
      const finalDnm = parseDnmText(dnmText, externalMeshes);

      // Amostra do cabeçalho de nós para o modal de inspeção bruta
      const dnmLines = dnmText.split(/\r?\n/);
      const srfSectionStart = dnmLines.findIndex(
        (l) => l.trim().startsWith('SRF ') || l.trim().startsWith('SRFNAM ')
      );
      const dnmHeaderSample =
        srfSectionStart >= 0
          ? dnmLines.slice(srfSectionStart, srfSectionStart + 300).join('\n')
          : dnmLines.slice(0, 200).join('\n');

      setDnmData(finalDnm);
      setCollData(parsedColl);
      setDatData(parsedDat);
      setRawFiles({
        lst: '',
        dat: datText,
        dnmHeader: dnmHeaderSample,
      });
      setSelectedNodeName(null);
      setHiddenNodes(new Set());
      setRenderSettings((prev) => ({ ...prev, previewOrphanPck: null }));
      setCameraResetTrigger((c) => c + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro desconhecido ao carregar modelo da aeronave'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega a aeronave inicial (T-25 Universal)
  useEffect(() => {
    const defaultEntry =
      AIRCRAFT_CATALOG.find((a) => a.id === selectedAircraftId) ||
      AIRCRAFT_CATALOG[0];
    if (defaultEntry) {
      loadCatalogAircraft(defaultEntry);
    }
  }, []);

  const handleSelectAircraft = useCallback(
    (aircraftId: string) => {
      setSelectedAircraftId(aircraftId);
      const entry = AIRCRAFT_CATALOG.find((a) => a.id === aircraftId);
      if (entry) {
        loadCatalogAircraft(entry);
      }
    },
    [loadCatalogAircraft]
  );

  const handleToggleNodeVisibility = useCallback((nodeUidOrName: string) => {
    setHiddenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeUidOrName)) {
        next.delete(nodeUidOrName);
      } else {
        next.add(nodeUidOrName);
      }
      return next;
    });
  }, []);

  const handleShowAllNodes = useCallback(() => {
    setHiddenNodes(new Set());
  }, []);

  const handleIsolateNode = useCallback(
    (nodeUidOrName: string) => {
      if (!dnmData) return;
      setHiddenNodes((prev) => {
        if (prev.size === dnmData.nodes.length - 1 && !prev.has(nodeUidOrName)) {
          return new Set();
        }
        const next = new Set<string>();
        for (const n of dnmData.nodes) {
          if (n.uid !== nodeUidOrName && n.name !== nodeUidOrName) {
            next.add(n.uid);
          }
        }
        return next;
      });
      setSelectedNodeName(nodeUidOrName);
    },
    [dnmData]
  );

  const handleSelectPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setCameraResetTrigger((c) => c + 1);
  }, []);

  const handleResetCamera = useCallback(() => {
    setCameraResetTrigger((c) => c + 1);
  }, []);

  // Suporte a carregamento de múltiplos arquivos customizados do usuário (DNM + múltiplos SRFs + DAT)
  const handleLoadCustomFiles = useCallback(async (files: FileList) => {
    try {
      setLoading(true);
      setError(null);

      const fileArr = Array.from(files);
      const srfMeshes: Record<string, SrfMeshData> = {};
      let dnmFile: File | null = null;
      let datFile: File | null = null;
      let collMesh: SrfMeshData | null = null;

      // 1. Processa todos os arquivos .srf primeiro
      for (const f of fileArr) {
        const lower = f.name.toLowerCase();
        if (lower.endsWith('.srf')) {
          const text = await f.text();
          const mesh = parseSrfText(text, f.name);
          srfMeshes[f.name] = mesh;
          srfMeshes[lower] = mesh;
          if (lower.includes('coll')) {
            collMesh = mesh;
          }
        } else if (lower.endsWith('.dnm')) {
          dnmFile = f;
        } else if (lower.endsWith('.dat')) {
          datFile = f;
        }
      }

      let newDnm: DnmModelData | null = null;
      let dnmHeaderText = '';

      if (dnmFile) {
        const dnmText = await dnmFile.text();
        newDnm = parseDnmText(dnmText, srfMeshes);

        const dnmLines = dnmText.split(/\r?\n/);
        const srfSectionStart = dnmLines.findIndex(
          (l) => l.trim().startsWith('SRF ') || l.trim().startsWith('SRFNAM ')
        );
        dnmHeaderText =
          srfSectionStart >= 0
            ? dnmLines.slice(srfSectionStart, srfSectionStart + 300).join('\n')
            : dnmLines.slice(0, 200).join('\n');
      } else if (Object.keys(srfMeshes).length === 1) {
        // Arquivo SRF avulso sem DNM
        const [srfName, mesh] = Object.entries(srfMeshes)[0];
        newDnm = {
          version: 1,
          pckMeshes: { [srfName]: mesh, [srfName.toLowerCase()]: mesh },
          pckOrder: [srfName],
          externalSrfNames: [],
          nodes: [
            {
              uid: 'node_0',
              name: 'ROOT_SRF',
              fileName: srfName,
              meshSource: 'external',
              cla: 0,
              nst: 0,
              states: [],
              pos: {
                pos: { x: 0, y: 0, z: 0 },
                att: { h: 0, p: 0, b: 0 },
                visible: 1,
              },
              cnt: { x: 0, y: 0, z: 0 },
              rel: 'DEP',
              childrenNames: [],
            },
          ],
          rootNodeNames: ['ROOT_SRF'],
          unreferencedPcks: [],
        };
      }

      let newDat: AircraftDatData | null = null;
      let datText = '';
      if (datFile) {
        datText = await datFile.text();
        newDat = parseDatText(datText);
      }

      if (newDnm) {
        setDnmData(newDnm);
        setSelectedAircraftId('custom');
        setSelectedNodeName(null);
        setHiddenNodes(new Set());
        setRenderSettings((prev) => ({ ...prev, previewOrphanPck: null }));
        setRawFiles({
          lst: '',
          dat: datText,
          dnmHeader: dnmHeaderText,
        });
      }
      if (collMesh) setCollData(collMesh);
      if (newDat) setDatData(newDat);
      setCameraResetTrigger((c) => c + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao processar arquivos customizados'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const { totalPolygons, totalVertices, activeNodeCount } = useMemo(() => {
    if (!dnmData) return { totalPolygons: 0, totalVertices: 0, activeNodeCount: 0 };
    let polys = 0;
    let verts = 0;
    for (const node of dnmData.nodes) {
      const pck =
        dnmData.pckMeshes[node.fileName] ||
        dnmData.pckMeshes[node.fileName.toLowerCase()];
      if (pck) {
        polys += pck.polygons.length;
        verts += pck.vertices.length;
      }
    }
    return {
      totalPolygons: polys,
      totalVertices: verts,
      activeNodeCount: dnmData.nodes.length,
    };
  }, [dnmData]);

  const currentCatalogEntry = useMemo(
    () => AIRCRAFT_CATALOG.find((a) => a.id === selectedAircraftId),
    [selectedAircraftId]
  );

  return (
    <div className="app-shell">
      <TopBar
        catalog={AIRCRAFT_CATALOG}
        selectedAircraftId={selectedAircraftId}
        onSelectAircraft={handleSelectAircraft}
        dat={datData}
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        onResetCamera={handleResetCamera}
        onLoadCustomFiles={handleLoadCustomFiles}
        onOpenDatEditor={() => setIsDatEditorOpen(true)}
        totalPolygons={totalPolygons}
        totalVertices={totalVertices}
        activeNodeCount={activeNodeCount}
      />

      <main
        className={`workspace-grid ${leftPanelCollapsed ? 'left-collapsed' : ''} ${
          rightPanelCollapsed ? 'right-collapsed' : ''
        }`}
      >
        <FlightControlsPanel
          controls={controls}
          onChange={setControls}
          isCollapsed={leftPanelCollapsed}
          onToggleCollapse={() => setLeftPanelCollapsed((c) => !c)}
        />

        <div className="center-stage">
          {loading && (
            <div className="viewport-overlay">
              <Loader2 className="spin-icon" size={28} />
              <span>Carregando e compilando malhas DNM/SRF da aeronave...</span>
            </div>
          )}

          {error && (
            <div className="viewport-overlay error">
              <AlertTriangle size={28} />
              <span>{error}</span>
            </div>
          )}

          <AircraftViewport
            dnmData={dnmData}
            collData={collData}
            datData={datData}
            controls={controls}
            onUpdateControls={setControls}
            renderSettings={renderSettings}
            hiddenNodes={hiddenNodes}
            selectedNodeName={selectedNodeName}
            onSelectNode={setSelectedNodeName}
            cameraPreset={cameraPreset}
            cameraResetTrigger={cameraResetTrigger}
          />
        </div>

        <InspectorPanel
          dnmData={dnmData}
          collData={collData}
          datData={datData}
          rawFiles={rawFiles}
          renderSettings={renderSettings}
          onUpdateRenderSettings={setRenderSettings}
          hiddenNodes={hiddenNodes}
          onToggleNodeVisibility={handleToggleNodeVisibility}
          onShowAllNodes={handleShowAllNodes}
          onIsolateNode={handleIsolateNode}
          selectedNodeName={selectedNodeName}
          onSelectNode={setSelectedNodeName}
          onOpenDatEditor={() => setIsDatEditorOpen(true)}
          isCollapsed={rightPanelCollapsed}
          onToggleCollapse={() => setRightPanelCollapsed((c) => !c)}
        />
      </main>

      <AircraftDatEditor
        isOpen={isDatEditorOpen}
        onClose={() => setIsDatEditorOpen(false)}
        originalDatText={rawFiles.dat}
        datData={datData}
        aircraftName={currentCatalogEntry?.name || datData?.identify || 'Aeronave'}
        datFilename={currentCatalogEntry?.datFile || `${datData?.identify || 'aircraft'}.dat`}
        onApplyToModel={handleApplyDat}
      />
    </div>
  );
};

export default App;
