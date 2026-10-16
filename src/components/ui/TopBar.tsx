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
} from 'lucide-react';
import { AircraftDatData, CameraPreset } from '../../types/ysflight';

interface TopBarProps {
  dat: AircraftDatData | null;
  cameraPreset: CameraPreset;
  onSelectPreset: (preset: CameraPreset) => void;
  onResetCamera: () => void;
  onLoadCustomFiles: (files: FileList) => void;
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
  dat,
  cameraPreset,
  onSelectPreset,
  onResetCamera,
  onLoadCustomFiles,
  totalPolygons,
  totalVertices,
  activeNodeCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            <h1 className="aircraft-title">{dat?.identify || 'T-25 Universal AFA'}</h1>
          </div>
          <div className="aircraft-submeta">
            <span className="meta-pill">YSFlight DNM v2</span>
            <span className="meta-pill">{activeNodeCount} nós ativos</span>
            <span className="meta-pill">{totalPolygons.toLocaleString('pt-BR')} polígonos</span>
            <span className="meta-pill">{totalVertices.toLocaleString('pt-BR')} vértices</span>
          </div>
        </div>
      </div>

      <div className="topbar-cameras" role="group" aria-label="Câmeras predefinidas">
        <span className="camera-group-label">
          <Camera size={13} /> Câmera:
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
            <span>{preset.label}</span>
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
          <span>Importar DNM / SRF</span>
        </button>
      </div>
    </header>
  );
};
