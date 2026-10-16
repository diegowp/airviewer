import React, { useMemo, useState } from 'react';
import { Plus, Minus, Search, CheckCircle2, AlertCircle } from 'lucide-react';

interface DatDiffViewerProps {
  originalText: string;
  editedText: string;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  originalLineNo?: number;
  editedLineNo?: number;
  text: string;
}

/**
 * Computes a line-by-line diff between original and edited text using LCS.
 */
function computeLineDiff(original: string, edited: string): DiffLine[] {
  const origLines = original.split(/\r?\n/);
  const editLines = edited.split(/\r?\n/);

  const n = origLines.length;
  const m = editLines.length;

  // Build DP table for LCS
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1) as unknown as number[]);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (origLines[i].trim() === editLines[j].trim()) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to build diff lines
  const result: DiffLine[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1].trim() === editLines[j - 1].trim()) {
      result.unshift({
        type: 'unchanged',
        originalLineNo: i,
        editedLineNo: j,
        text: origLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        editedLineNo: j,
        text: editLines[j - 1],
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({
        type: 'removed',
        originalLineNo: i,
        text: origLines[i - 1],
      });
      i--;
    }
  }

  return result;
}

export const DatDiffViewer: React.FC<DatDiffViewerProps> = ({ originalText, editedText }) => {
  const [onlyChanges, setOnlyChanges] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');

  const diffLines = useMemo(() => {
    return computeLineDiff(originalText, editedText);
  }, [originalText, editedText]);

  const { addedCount, removedCount, unchangedCount } = useMemo(() => {
    let add = 0;
    let rem = 0;
    let unc = 0;
    for (const line of diffLines) {
      if (line.type === 'added') add++;
      else if (line.type === 'removed') rem++;
      else unc++;
    }
    return { addedCount: add, removedCount: rem, unchangedCount: unc };
  }, [diffLines]);

  const filteredLines = useMemo(() => {
    return diffLines.filter((l) => {
      if (onlyChanges && l.type === 'unchanged') return false;
      if (filterQuery.trim()) {
        return l.text.toLowerCase().includes(filterQuery.toLowerCase());
      }
      return true;
    });
  }, [diffLines, onlyChanges, filterQuery]);

  return (
    <div className="dat-diff-viewer">
      <div className="diff-header-bar">
        <div className="diff-stats">
          {addedCount === 0 && removedCount === 0 ? (
            <span className="diff-badge neutral">
              <CheckCircle2 size={13} /> Nenhuma alteração detectada
            </span>
          ) : (
            <>
              <span className="diff-badge added">
                <Plus size={13} /> +{addedCount} linhas adicionadas
              </span>
              <span className="diff-badge removed">
                <Minus size={13} /> -{removedCount} linhas removidas
              </span>
              <span className="diff-badge count">
                {unchangedCount} linhas mantidas
              </span>
            </>
          )}
        </div>

        <div className="diff-filter-tools">
          <div className="diff-search-box">
            <Search size={13} />
            <input
              type="text"
              placeholder="Filtrar por propriedade..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="native-input"
            />
          </div>

          <label className="native-toggle-label">
            <input
              type="checkbox"
              checked={onlyChanges}
              onChange={(e) => setOnlyChanges(e.target.checked)}
            />
            <span>Apenas alterações</span>
          </label>
        </div>
      </div>

      <div className="diff-code-scroll">
        <table className="diff-table mono">
          <tbody>
            {filteredLines.map((line, idx) => {
              const rowClass =
                line.type === 'added'
                  ? 'diff-row added'
                  : line.type === 'removed'
                  ? 'diff-row removed'
                  : 'diff-row unchanged';

              return (
                <tr key={idx} className={rowClass}>
                  <td className="diff-line-no orig">
                    {line.originalLineNo ?? ''}
                  </td>
                  <td className="diff-line-no edit">
                    {line.editedLineNo ?? ''}
                  </td>
                  <td className="diff-marker">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </td>
                  <td className="diff-content">
                    <code>{line.text}</code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
