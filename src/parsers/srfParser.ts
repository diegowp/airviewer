import { SrfMeshData, SrfPolygon, SrfVertex, Vec3 } from '../types/ysflight';

/**
 * Parses a YSFlight .srf mesh from an array of lines (or full text string).
 * Supports both short syntax (V, F, C, N, B, E) and verbose syntax (VER, FAC, COL, NOR, BRI, END),
 * as well as post-polygon attributes like ZA (polygon alpha/transparency) and ZL (light sprite).
 */
export function parseSrfLines(lines: string[], name = 'mesh.srf'): SrfMeshData {
  const vertices: SrfVertex[] = [];
  const polygons: SrfPolygon[] = [];

  let inPolygon = false;
  let currentColor: [number, number, number] = [200, 200, 200];
  let currentCenter: Vec3 = { x: 0, y: 0, z: 0 };
  let currentNormal: Vec3 = { x: 0, y: 1, z: 0 };
  let currentVtIndices: number[] = [];
  let currentUnshaded = false;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('REM')) continue;

    const parts = raw.split(/\s+/);
    const cmd = parts[0].toUpperCase();

    if (!inPolygon) {
      if (cmd === 'SURF') {
        continue;
      } else if (cmd === 'V' || cmd === 'VER') {
        if (parts.length >= 4) {
          const x = parseFloat(parts[1]) || 0;
          const y = parseFloat(parts[2]) || 0;
          const z = parseFloat(parts[3]) || 0;
          const round = parts.length >= 5 && (parts[4].toUpperCase() === 'R');
          vertices.push({ x, y, z, round });

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }
      } else if (cmd === 'F' || cmd === 'FAC') {
        inPolygon = true;
        currentColor = [200, 200, 200];
        currentCenter = { x: 0, y: 0, z: 0 };
        currentNormal = { x: 0, y: 0, z: 0 };
        currentVtIndices = [];
        currentUnshaded = false;
      } else if (cmd === 'ZA') {
        // ZA <polyIdx> <alpha0_255> <polyIdx> <alpha0_255> ...
        for (let k = 1; k + 1 < parts.length; k += 2) {
          const polyIdx = parseInt(parts[k], 10);
          const alphaVal = parseInt(parts[k + 1], 10);
          if (!isNaN(polyIdx) && !isNaN(alphaVal) && polygons[polyIdx]) {
            polygons[polyIdx].zaAlpha = alphaVal;
          }
        }
      } else if (cmd === 'ZL') {
        for (let k = 1; k < parts.length; k++) {
          const polyIdx = parseInt(parts[k], 10);
          if (!isNaN(polyIdx) && polygons[polyIdx]) {
            polygons[polyIdx].brightLight = true;
          }
        }
      } else if (cmd === 'E' || cmd === 'END') {
        // End of SURF block
        continue;
      }
    } else {
      // Inside F ... E or FAC ... END
      if (cmd === 'C' || cmd === 'COL') {
        if (parts.length >= 4) {
          currentColor = [
            parseInt(parts[1], 10) || 0,
            parseInt(parts[2], 10) || 0,
            parseInt(parts[3], 10) || 0,
          ];
        } else if (parts.length === 2) {
          // Exact 15-bit RGB conversion matching YsColor::Set15BitRGB
          const c15 = parseInt(parts[1], 10) || 0;
          const g = Math.round((((c15 >> 10) & 31) * 255) / 31);
          const r = Math.round((((c15 >> 5) & 31) * 255) / 31);
          const b = Math.round(((c15 & 31) * 255) / 31);
          currentColor = [r, g, b];
        }
      } else if (cmd === 'N' || cmd === 'NOR') {
        if (parts.length >= 7) {
          currentCenter = {
            x: parseFloat(parts[1]) || 0,
            y: parseFloat(parts[2]) || 0,
            z: parseFloat(parts[3]) || 0,
          };
          currentNormal = {
            x: parseFloat(parts[4]) || 0,
            y: parseFloat(parts[5]) || 0,
            z: parseFloat(parts[6]) || 0,
          };
        } else if (parts.length >= 4) {
          currentNormal = {
            x: parseFloat(parts[1]) || 0,
            y: parseFloat(parts[2]) || 0,
            z: parseFloat(parts[3]) || 0,
          };
        }
      } else if (cmd === 'V' || cmd === 'VER') {
        for (let k = 1; k < parts.length; k++) {
          const vIdx = parseInt(parts[k], 10);
          if (!isNaN(vIdx)) {
            currentVtIndices.push(vIdx);
          }
        }
      } else if (cmd === 'B' || cmd === 'BRI') {
        currentUnshaded = true;
      } else if (cmd === 'E' || cmd === 'END') {
        inPolygon = false;
        // Note: We still push the polygon even if empty so polygon indices match ZA face indices,
        // or only if vertexIndices >= 3. Wait: in YsShellExtReader, AddPolygon is only called on 'V' if vertices >= 3!
        // Let's check: in t25universal.dnm, fuselagem.srf has no empty faces; null.srf has 1 empty face and no ZA.
        if (currentVtIndices.length >= 3) {
          polygons.push({
            index: polygons.length,
            color: currentColor,
            center: currentCenter,
            normal: currentNormal,
            vertexIndices: currentVtIndices,
            unshaded: currentUnshaded,
          });
        }
      }
    }
  }

  if (minX === Infinity) {
    minX = minY = minZ = 0;
    maxX = maxY = maxZ = 0;
  }

  return {
    name,
    vertices,
    polygons,
    boundingBox: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    },
  };
}

export function parseSrfText(text: string, name = 'mesh.srf'): SrfMeshData {
  const lines = text.split(/\r?\n/);
  return parseSrfLines(lines, name);
}
