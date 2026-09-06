import React, { useState } from 'react';
import type {
  EngineScore,
  GameAnalysisReport,
  MoveClassification,
} from '../../services/stockfish-engine.js';
import { formatEngineScore, scoreToNumeric } from '../../services/stockfish-engine.js';

interface EngineAnalysisPanelProps {
  currentEvaluation: EngineScore;
  currentPly: number;
  report: GameAnalysisReport | null;
  isAnalyzing: boolean;
  progressPercent: number;
  engineVersion: string;
  selectedDepth: number;
  onDepthChange: (depth: number) => void;
  onRunAnalysis: () => void;
  onCancelAnalysis: () => void;
  onSelectPly: (ply: number) => void;
}

const CLASSIFICATION_COLORS: Record<MoveClassification, { bg: string; text: string; label: string }> = {
  brilliant: { bg: 'bg-teal-500/20 text-teal-300 border-teal-500/50', text: 'text-teal-300', label: 'Brilliant !!' },
  excellent: { bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50', text: 'text-emerald-300', label: 'Best / Great !' },
  good: { bg: 'bg-blue-500/20 text-blue-300 border-blue-500/50', text: 'text-blue-300', label: 'Good' },
  book: { bg: 'bg-amber-500/20 text-amber-300 border-amber-500/50', text: 'text-amber-300', label: 'Book' },
  inaccuracy: { bg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50', text: 'text-yellow-300', label: 'Inaccuracy ?!' },
  mistake: { bg: 'bg-orange-500/20 text-orange-300 border-orange-500/50', text: 'text-orange-300', label: 'Mistake ?' },
  blunder: { bg: 'bg-rose-500/20 text-rose-300 border-rose-500/50', text: 'text-rose-300', label: 'Blunder ??' },
  unavailable: { bg: 'bg-slate-700/30 text-slate-400 border-slate-600/50', text: 'text-slate-400', label: 'Analysis unavailable' },
};

export const EngineAnalysisPanel: React.FC<EngineAnalysisPanelProps> = ({
  currentEvaluation,
  currentPly,
  report,
  isAnalyzing,
  progressPercent,
  engineVersion,
  selectedDepth,
  onDepthChange,
  onRunAnalysis,
  onCancelAnalysis,
  onSelectPly,
}) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Find analysis for the currently displayed ply
  const activePosition = report?.positions.find((p) => p.ply === currentPly);
  const activeScore = activePosition ? activePosition.evaluation : currentEvaluation;
  const analysisFailed = Boolean(activePosition && !activePosition.evaluation);

  // Evaluation bar height: clamp numeric centipawns between -800 and +800
  const numericVal = scoreToNumeric(activeScore ?? { type: 'cp', value: 0 }, 800);
  const clampedVal = Math.max(-800, Math.min(800, numericVal));
  // 50% = 0.0 eval. +800 = 100% white, -800 = 0% white
  const whitePercent = Math.round(((clampedVal + 800) / 1600) * 100);

  const formattedScore = activeScore ? formatEngineScore(activeScore) : '—';

  let statusText = 'Equal position';
  if (analysisFailed) {
    statusText = 'Engine analysis failed for this position';
  } else if (activeScore?.type === 'mate') {
    statusText = activeScore.value > 0 ? `White mates in ${activeScore.value}` : `Black mates in ${Math.abs(activeScore.value)}`;
  } else if (activeScore && activeScore.value >= 150) {
    statusText = 'White has significant advantage';
  } else if (activeScore && activeScore.value > 40) {
    statusText = 'White is slightly better';
  } else if (activeScore && activeScore.value <= -150) {
    statusText = 'Black has significant advantage';
  } else if (activeScore && activeScore.value < -40) {
    statusText = 'Black is slightly better';
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Game Analysis</span>
          <h3 className="text-sm font-bold text-white truncate max-w-[13rem]" title={engineVersion}>
            {engineVersion}
          </h3>
        </div>

        {isAnalyzing ? (
          <button
            type="button"
            onClick={onCancelAnalysis}
            className="action-button action-secondary text-xs text-rose-300 hover:border-rose-800"
          >
            Cancel ({progressPercent}%)
          </button>
        ) : (
          <button
            type="button"
            onClick={onRunAnalysis}
            className="action-button action-primary text-xs font-bold"
          >
            {report ? 'Re-Analyze' : 'Analyze Game'}
          </button>
        )}
      </div>

      {/* Depth Selector */}
      {!isAnalyzing && (
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs">
          <span className="text-slate-400 font-semibold text-[11px]">Analysis Depth:</span>
          <div className="flex gap-1">
            {[
              { depth: 10, label: 'Quick (10)' },
              { depth: 12, label: 'Standard (12)' },
              { depth: 15, label: 'Deep (15)' },
            ].map((d) => (
              <button
                key={d.depth}
                type="button"
                onClick={() => onDepthChange(d.depth)}
                className={`rounded px-2 py-0.5 text-[10px] font-bold transition-all ${
                  selectedDepth === d.depth
                    ? 'bg-amber-400 text-slate-900 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isAnalyzing && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Analyzing moves (Depth {selectedDepth})...</span>
            <span className="font-mono font-bold text-amber-300">{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-amber-400 transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Active Position Eval Display */}
      <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 p-3">
        <div className="flex items-center gap-2.5">
          {/* Vertical Eval bar miniature */}
          <div className="eval-bar-wrapper h-10 w-4">
            <div className="eval-bar-black" style={{ height: `${100 - whitePercent}%` }} />
            <div className="eval-bar-white" style={{ height: `${whitePercent}%` }} />
          </div>
          <div>
            <span className="font-mono text-base font-black text-white">
              {formattedScore}
            </span>
            <p className="text-[10px] text-slate-400 leading-tight">
              {statusText}
            </p>
          </div>
        </div>

        {activePosition && (
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Engine Best</span>
            <p className={`font-mono text-sm font-bold ${activePosition.bestMoveSan ? 'text-emerald-400' : 'text-slate-500'}`}>
              {activePosition.bestMoveSan ?? 'N/A'}
            </p>
          </div>
        )}
      </div>

      {/* Move Evaluation & Accuracy Callout */}
      {activePosition && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Played:</span>
              <span className="font-mono text-xs font-bold text-white">{activePosition.san}</span>
            </div>
            <span
              className={`rounded border px-2 py-0.5 text-xs font-bold ${
                CLASSIFICATION_COLORS[activePosition.classification].bg
              }`}
            >
              {CLASSIFICATION_COLORS[activePosition.classification].label}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Centipawn Loss:</span>
            <span
              className={`font-mono font-bold ${
                activePosition.cpLoss === null
                  ? 'text-slate-500'
                  : activePosition.cpLoss === 0
                  ? 'text-emerald-400'
                  : activePosition.cpLoss <= 35
                  ? 'text-blue-400'
                  : activePosition.cpLoss <= 90
                  ? 'text-yellow-400'
                  : 'text-rose-400'
              }`}
            >
              {activePosition.cpLoss === null
                ? 'N/A'
                : activePosition.cpLoss === 0
                ? '0 (Optimal)'
                : `-${(activePosition.cpLoss / 100).toFixed(2)}`}
            </span>
          </div>
        </div>
      )}

      {/* Accuracy & Breakdown */}
      {report && (
        <div className="space-y-3 border-t border-slate-800 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">White Accuracy</span>
              <p className="text-xl font-black text-white">{report.whiteAccuracy}%</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Black Accuracy</span>
              <p className="text-xl font-black text-white">{report.blackAccuracy}%</p>
            </div>
          </div>

          {/* Interactive Evaluation Graph */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Evaluation Curve</span>
              <span className="text-[10px] text-slate-500">Click graph to jump</span>
            </div>
            <div
              className="mt-1.5 h-20 w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-1 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                const targetPly = Math.round(ratio * (report.positions.length - 1));
                onSelectPly(targetPly);
              }}
            >
              <svg className="h-full w-full" viewBox="0 0 200 60" preserveAspectRatio="none">
                {/* Center line (0.0 eval) */}
                <line x1="0" y1="30" x2="200" y2="30" stroke="#334155" strokeWidth="0.8" strokeDasharray="3 3" />
                {/* Curve path */}
                {report.positions.length > 1 && (
                  <path
                    d={report.positions
                      .map((p, index) => {
                        const x = (index / (report.positions.length - 1)) * 200;
                        const num = p.evaluation ? scoreToNumeric(p.evaluation, 600) : 0;
                        const clamped = Math.max(-600, Math.min(600, num));
                        const y = 30 - (clamped / 600) * 26;
                        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="1.6"
                  />
                )}
                {/* Current move marker dot */}
                {report.positions.length > 1 && (
                  <circle
                    cx={(Math.max(0, currentPly) / (report.positions.length - 1)) * 200}
                    cy={30 - (Math.max(-600, Math.min(600, scoreToNumeric(activeScore ?? { type: 'cp', value: 0 }, 600))) / 600) * 26}
                    r="4"
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* Diagnostics Toggle */}
          <div className="border-t border-slate-800/80 pt-2">
            <button
              type="button"
              onClick={() => setShowDiagnostics((d) => !d)}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200"
            >
              {showDiagnostics ? '▼ Hide Developer Diagnostics' : '▶ Show Developer Diagnostics'}
            </button>

            {showDiagnostics && activePosition?.diagnostics && (
              <div className="mt-2 space-y-1 rounded bg-slate-950 p-2.5 font-mono text-[10px] text-slate-300 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Engine:</span>
                  <span>{activePosition.diagnostics.engineVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Depth:</span>
                  <span>{activePosition.diagnostics.depth}</span>
                </div>
                {activePosition.diagnostics.nodes !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nodes:</span>
                    <span>{activePosition.diagnostics.nodes}</span>
                  </div>
                )}
                {activePosition.diagnostics.nps !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nps:</span>
                    <span>{activePosition.diagnostics.nps}</span>
                  </div>
                )}
                <div className="text-slate-500 mt-1">FEN before:</div>
                <div className="text-slate-400 break-all">{activePosition.fen}</div>
                <div className="text-slate-500 mt-1">Raw UCI:</div>
                <div className="text-slate-400 truncate">{activePosition.diagnostics.rawUci}</div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-500 italic text-center">
            Estimated accuracy based on centipawn deviation from optimal engine play.
          </p>
        </div>
      )}
    </div>
  );
};
