import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  AircraftDatData,
  CameraPreset,
  DnmModelData,
  FlightControlState,
  SrfMeshData,
} from './types/ysflight';
import { parseDnmText } from './parsers/dnmParser';
import { parseSrfText } from './parsers/srfParser';
import { parseDatText } from './parsers/datParser';
import { TopBar } from './components/ui/TopBar';
import { FlightControlsPanel } from './components/ui/FlightControlsPanel';
import { InspectorPanel } from './components/ui/InspectorPanel';
import { AircraftViewport, RenderSettings } from './components/viewport/AircraftViewport';
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

  // Carrega os arquivos originais da aeronave T-25 Universal na inicialização
  useEffect(() => {
    let cancelled = false;
    async function loadDefaultModel() {
      try {
        setLoading(true);
        setError(null);

        const [dnmRes, collRes, datRes, lstRes] = await Promise.all([
          fetch('/models/t-25/t25universal.dnm'),
          fetch('/models/t-25/t25universal_coll.srf'),
          fetch('/models/t-25/t25universal.dat'),
          fetch('/models/t-25/t25universal.lst'),
        ]);

        if (!dnmRes.ok) {
          throw new Error(`Falha ao carregar t25universal.dnm (${dnmRes.status})`);
        }

        const [dnmText, collText, datText, lstText] = await Promise.all([
          dnmRes.text(),
          collRes.ok ? collRes.text() : Promise.resolve(''),
          datRes.ok ? datRes.text() : Promise.resolve(''),
          lstRes.ok ? lstRes.text() : Promise.resolve(''),
        ]);

        if (cancelled) return;

        const parsedDnm = parseDnmText(dnmText);
        const parsedColl = collText
          ? parseSrfText(collText, 't25universal_coll.srf')
          : null;
        const parsedDat = datText ? parseDatText(datText) : null;

        // Extrai a seção final do .dnm onde os 25 nós SRF e canais CLA estão declarados
        const dnmLines = dnmText.split(/\r?\n/);
        const srfSectionStart = dnmLines.findIndex((l) => l.trim().startsWith('SRF '));
        const dnmHeaderSample =
          srfSectionStart >= 0
            ? dnmLines.slice(srfSectionStart, srfSectionStart + 300).join('\n')
            : dnmLines.slice(0, 200).join('\n');

        setDnmData(parsedDnm);
        setCollData(parsedColl);
        setDatData(parsedDat);
        setRawFiles({
          lst: lstText,
          dat: datText,
          dnmHeader: dnmHeaderSample,
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Erro desconhecido ao carregar modelo 3D'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDefaultModel();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleNodeVisibility = useCallback((nodeName: string) => {
    setHiddenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeName)) {
        next.delete(nodeName);
      } else {
        next.add(nodeName);
      }
      return next;
    });
  }, []);

  const handleShowAllNodes = useCallback(() => {
    setHiddenNodes(new Set());
  }, []);

  const handleIsolateNode = useCallback(
    (nodeName: string) => {
      if (!dnmData) return;
      setHiddenNodes((prev) => {
        // Se já estava isolado apenas nele, mostra todos novamente
        if (prev.size === dnmData.nodes.length - 1 && !prev.has(nodeName)) {
          return new Set();
        }
        const next = new Set<string>();
        for (const n of dnmData.nodes) {
          if (n.name !== nodeName) {
            next.add(n.name);
          }
        }
        return next;
      });
      setSelectedNodeName(nodeName);
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

  const handleLoadCustomFiles = useCallback(async (files: FileList) => {
    try {
      setLoading(true);
      setError(null);

      let newDnm: DnmModelData | null = null;
      let newColl: SrfMeshData | null = null;
      let newDat: AircraftDatData | null = null;

      for (const file of Array.from(files)) {
        const lower = file.name.toLowerCase();
        const text = await file.text();

        if (lower.endsWith('.dnm')) {
          newDnm = parseDnmText(text);
        } else if (lower.endsWith('.srf')) {
          const mesh = parseSrfText(text, file.name);
          if (!newDnm && files.length === 1) {
            newDnm = {
              version: 1,
              pckMeshes: { [file.name]: mesh },
              pckOrder: [file.name],
              nodes: [
                {
                  name: 'ROOT_SRF',
                  fileName: file.name,
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
          } else {
            newColl = mesh;
          }
        } else if (lower.endsWith('.dat')) {
          newDat = parseDatText(text);
        }
      }

      if (newDnm) {
        setDnmData(newDnm);
        setSelectedNodeName(null);
        setHiddenNodes(new Set());
        setRenderSettings((prev) => ({ ...prev, previewOrphanPck: null }));
      }
      if (newColl) setCollData(newColl);
      if (newDat) setDatData(newDat);
      setCameraResetTrigger((c) => c + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao processar arquivo customizado'
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
      const pck = dnmData.pckMeshes[node.fileName];
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

  return (
    <div className="app-shell">
      <TopBar
        dat={datData}
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        onResetCamera={handleResetCamera}
        onLoadCustomFiles={handleLoadCustomFiles}
        totalPolygons={totalPolygons}
        totalVertices={totalVertices}
        activeNodeCount={activeNodeCount}
      />

      <main className="workspace-grid">
        <FlightControlsPanel controls={controls} onChange={setControls} />

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
        />
      </main>
    </div>
  );
};

export default App;
