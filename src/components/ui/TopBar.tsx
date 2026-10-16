import React, { useRef } from 'react';
import {
  Plane,
  Camera,
  RotateCcw,
  Upload,
  Box,
  Compass,
  Eye,
  ArrowUp,
  ArrowRight,
  Sliders,
} from 'lucide-react';
import { AircraftCatalogEntry, AircraftDatData, CameraPreset } from '../../types/ysflight';

interface TopBarProps {
  catalog: AircraftCatalogEntry[];
  selectedAircraftId: string;
  onSelectAircraft: (id: string) => void;
  dat: AircraftDatData | null;
  cameraPreset: CameraPreset;
  onSelectPreset: (preset: CameraPreset) => void;
  onResetCamera: () => void;
  onLoadCustomFiles: (files: FileList) => void;
  onOpenDatEditor?: () => void;
  totalPolygons: number;
  totalVertices: number;
  activeNodeCount: number;
}

const CAMERA_PRESETS: Array<{ id: CameraPreset; label: string; icon: React.ReactNode }> = [
  { id: 'hangar', label: 'Hangar 3/4', icon: <Box size={13} /> },
  { id: 'cockpit', label: 'Cockpit (PILOT)', icon: <Eye size={13} /> },
  { id: 'front', label: 'Frontal', icon: <Compass size={13} /> },
  { id: 'side', label: 'Lateral', icon: <ArrowRight size={13} /> },
  { id: 'top', label: 'Superior', icon: <ArrowUp size={13} /> },
  { id: 'tail', label: 'Cauda', icon: <Camera size={13} /> },
];

export const TopBar: React.FC<TopBarProps> = ({
  catalog,
  selectedAircraftId,
  onSelectAircraft,
  dat,
  cameraPreset,
  onSelectPreset,
  onResetCamera,
  onLoadCustomFiles,
  onOpenDatEditor,
  totalPolygons,
  totalVertices,
  activeNodeCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = Array.from(new Set(catalog.map((a) => a.category)));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onLoadCustomFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="brand-logo">
          <Plane size={18} />
        </div>
        <div className="brand-titles">
          <div className="brand-name-row">
            <span className="brand-app">AIRVIEWER</span>
            <span className="brand-divider">/</span>
            <div className="aircraft-picker-wrap">
              <select
                id="aircraft-picker"
                className="native-select aircraft-select"
                value={selectedAircraftId}
                onChange={(e) => onSelectAircraft(e.target.value)}
                aria-label="Selecionar Aeronave da Frota YSFAB"
              >
                {categories.map((cat) => (
                  <optgroup key={cat} label={`── ${cat} ──`}>
                    {catalog
                      .filter((a) => a.category === cat)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} • {a.force}
                        </option>
                      ))}
                  </optgroup>
                ))}
                {selectedAircraftId === 'custom' && (
                  <option value="custom">Arquivo Personalizado (Importado)</option>
                )}
              </select>
            </div>
          </div>
          <div className="aircraft-submeta">
            <span className="meta-pill submeta-engine">YSFlight DNM</span>
            <span className="meta-pill">{activeNodeCount} nós</span>
            <span className="meta-pill">{totalPolygons.toLocaleString('pt-BR')} faces</span>
            <span className="meta-pill submeta-verts">{totalVertices.toLocaleString('pt-BR')} vértices</span>
            {dat?.category && <span className="meta-pill category-badge">{dat.category}</span>}
          </div>
        </div>
      </div>

      <div className="topbar-cameras" role="group" aria-label="Câmeras predefinidas">
        <span className="camera-group-label">
          <Camera size={13} />
          <span className="cam-label-text">Câmera:</span>
        </span>
        {CAMERA_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`cam-btn ${cameraPreset === preset.id ? 'active' : ''}`}
            onClick={() => onSelectPreset(preset.id)}
            title={`Alternar câmera para ${preset.label}`}
          >
            {preset.icon}
            <span className="cam-btn-text">{preset.label}</span>
          </button>
        ))}
        <button
          type="button"
          className="cam-btn cam-reset-btn"
          onClick={onResetCamera}
          title="Recolocar câmera no enquadramento atual"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      <div className="topbar-actions">
        {onOpenDatEditor && (
          <button
            type="button"
            className="secondary-btn action-edit-dat"
            onClick={onOpenDatEditor}
            title="Abrir editor completo de especificações técnicas, física e aerodinâmica (.dat)"
            disabled={!dat}
          >
            <Sliders size={14} />
            <span className="btn-label-long">Editar Ficha Técnica (.dat)</span>
            <span className="btn-label-short">Editar .DAT</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".dnm,.srf,.dat,.lst"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Carregar arquivos .dnm, .srf ou .dat do computador"
        >
          <Upload size={14} />
          <span className="btn-label-long">Importar DNM / SRF</span>
          <span className="btn-label-short">Importar</span>
        </button>
      </div>
    </header>
  );
};
