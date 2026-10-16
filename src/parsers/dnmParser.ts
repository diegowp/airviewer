import { DnmModelData, DnmNode, DnmStateTransform, SrfMeshData } from '../types/ysflight';
import { parseSrfLines } from './srfParser';

function parseTransformArgs(parts: string[]): DnmStateTransform {
  // Format: POS/STA <x> <y> <z> <h> <p> <b> [visible]
  const x = parseFloat(parts[1]) || 0;
  const y = parseFloat(parts[2]) || 0;
  const z = parseFloat(parts[3]) || 0;
  const h = parseInt(parts[4], 10) || 0;
  const p = parseInt(parts[5], 10) || 0;
  const b = parseInt(parts[6], 10) || 0;
  const visible = parts.length >= 8 ? parseInt(parts[7], 10) : 1;

  return {
    pos: { x, y, z },
    att: { h, p, b },
    visible: isNaN(visible) ? 1 : visible,
  };
}

/**
 * Parses a YSFlight .dnm (DynaModel) file including all embedded PCK .srf meshes
 * and the hierarchical SRF scene graph nodes + CLA animation states.
 */
export function parseDnmText(text: string): DnmModelData {
  const lines = text.split(/\r?\n/);
  let version = 1;
  const pckMeshes: Record<string, SrfMeshData> = {};
  const pckOrder: string[] = [];
  const nodes: DnmNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('REM')) {
      i++;
      continue;
    }

    const parts = raw.split(/\s+/);
    const cmd = parts[0].toUpperCase();

    if (cmd === 'DNMVER' && parts.length >= 2) {
      version = parseInt(parts[1], 10) || 1;
      i++;
    } else if (cmd === 'PCK' && parts.length >= 3) {
      const pckName = parts[1];
      const lineCount = parseInt(parts[2], 10) || 0;
      const slice = lines.slice(i + 1, i + 1 + lineCount);
      const meshData = parseSrfLines(slice, pckName);
      pckMeshes[pckName] = meshData;
      if (!pckOrder.includes(pckName)) {
        pckOrder.push(pckName);
      }
      i += 1 + lineCount;
    } else if (cmd === 'SRF' || cmd === 'SRFNAM') {
      // Extract node name inside quotes or second token
      const match = raw.match(/^(?:SRF|SRFNAM)\s+"?([^"]+)"?/i);
      const nodeName = match ? match[1].trim() : parts[1] || `node_${nodes.length}`;

      const node: DnmNode = {
        name: nodeName,
        fileName: '',
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
      };

      i++;
      while (i < lines.length) {
        const nRaw = lines[i].trim();
        if (!nRaw) {
          i++;
          continue;
        }
        const nParts = nRaw.split(/\s+/);
        const nCmd = nParts[0].toUpperCase();

        if (nCmd === 'END') {
          i++;
          break;
        } else if (nCmd === 'FIL' && nParts.length >= 2) {
          node.fileName = nParts[1];
        } else if (nCmd === 'CLA' && nParts.length >= 2) {
          node.cla = parseInt(nParts[1], 10) || 0;
        } else if (nCmd === 'NST' && nParts.length >= 2) {
          node.nst = parseInt(nParts[1], 10) || 0;
        } else if (nCmd === 'STA' && nParts.length >= 7) {
          node.states.push(parseTransformArgs(nParts));
        } else if (nCmd === 'POS' && nParts.length >= 7) {
          node.pos = parseTransformArgs(nParts);
        } else if (nCmd === 'CNT' && nParts.length >= 4) {
          node.cnt = {
            x: parseFloat(nParts[1]) || 0,
            y: parseFloat(nParts[2]) || 0,
            z: parseFloat(nParts[3]) || 0,
          };
        } else if (nCmd === 'REL' && nParts.length >= 2) {
          node.rel = nParts[1];
        } else if (nCmd === 'CLD') {
          const cldMatch = nRaw.match(/^CLD\s+"?([^"]+)"?/i);
          if (cldMatch) {
            node.childrenNames.push(cldMatch[1].trim());
          }
        }
        i++;
      }

      nodes.push(node);
    } else {
      i++;
    }
  }

  // Determine root nodes (any node that is not listed in another node's childrenNames)
  const childSet = new Set<string>();
  for (const n of nodes) {
    for (const c of n.childrenNames) {
      childSet.add(c);
    }
  }
  const rootNodeNames = nodes.filter((n) => !childSet.has(n.name)).map((n) => n.name);

  // Determine unreferenced PCK blocks
  const usedFiles = new Set(nodes.map((n) => n.fileName));
  const unreferencedPcks = pckOrder.filter((p) => !usedFiles.has(p));

  return {
    version,
    pckMeshes,
    pckOrder,
    nodes,
    rootNodeNames,
    unreferencedPcks,
  };
}
