import { AircraftCatalogEntry } from '../types/ysflight';
import catalogData from './aircraftCatalog.json';

export const AIRCRAFT_CATALOG: AircraftCatalogEntry[] = catalogData as AircraftCatalogEntry[];

/**
 * Case-insensitive lookup for a mesh filename in a dictionary of loaded meshes
 */
export function lookupMeshCaseInsensitive<T>(dict: Record<string, T>, targetName: string): T | undefined {
  if (!targetName) return undefined;
  if (dict[targetName]) return dict[targetName];
  const targetLower = targetName.toLowerCase();
  for (const key of Object.keys(dict)) {
    if (key.toLowerCase() === targetLower) {
      return dict[key];
    }
  }
  return undefined;
}

/**
 * Finds the actual filename on disk (with correct case) for a referenced SRF in a catalog entry
 */
export function resolveDiskSrfFilename(entry: AircraftCatalogEntry, requestedSrf: string): string | null {
  const reqLower = requestedSrf.toLowerCase();
  const match = entry.srfFiles.find((f) => f.toLowerCase() === reqLower);
  return match || null;
}
