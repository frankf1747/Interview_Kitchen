import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoaderIcon, PuzzleIcon, SparklesIcon, TrashIcon } from './Icons';
import { MindMapData, MindMapEdge, MindMapNode } from '../types';

interface MindMapViewProps {
  mindMap: MindMapData;
  hasExperiences: boolean;
  isGenerating: boolean;
  onChange: (mindMap: MindMapData) => void;
  onRegenerate: () => void;
}

const NODE_WIDTH = 236;
const NODE_HEIGHT = 102;
const COLUMN_PADDING = 56;
const COLUMN_GAP = 360;
const ROW_GAP = 142;
const EXPERIENCE_COLUMN_X = COLUMN_PADDING + NODE_WIDTH + COLUMN_GAP;

type DragState = {
  nodeId: string;
  offsetX: number;
  offsetY: number;
};

type ReconnectState = {
  edgeId: string;
  end: 'source' | 'target';
  pointerX: number;
  pointerY: number;
};

type ViewportState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type PanState = {
  startX: number;
  startY: number;
  originOffsetX: number;
  originOffsetY: number;
};

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.8;
const DEFAULT_VIEWPORT: ViewportState = {
  scale: 0.9,
  offsetX: 72,
  offsetY: 40,
};

function clampZoom(value: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

function nodeTone(type: MindMapNode['type']) {
  return type === 'skill'
    ? {
        shell: 'border-brand-300 bg-brand-50 text-brand-900',
        chip: 'bg-brand-500/10 text-brand-700 border-brand-200',
      }
    : {
        shell: 'border-accent-300 bg-accent-50/85 text-accent-900',
        chip: 'bg-accent-500/10 text-accent-700 border-accent-200',
      };
}

function edgePath(source: MindMapNode, target: MindMapNode) {
  const startX = source.position.x + NODE_WIDTH;
  const startY = source.position.y + NODE_HEIGHT / 2;
  const endX = target.position.x;
  const endY = target.position.y + NODE_HEIGHT / 2;
  const delta = Math.max(80, Math.abs(endX - startX) * 0.35);
  return `M ${startX} ${startY} C ${startX + delta} ${startY}, ${endX - delta} ${endY}, ${endX} ${endY}`;
}

function edgeLabelPosition(source: MindMapNode, target: MindMapNode) {
  return {
    x: Math.round((source.position.x + NODE_WIDTH + target.position.x) / 2),
    y: Math.round((source.position.y + target.position.y) / 2 + NODE_HEIGHT / 2 - 8),
  };
}

function average(values: number[]) {
  if (values.length === 0) return Number.POSITIVE_INFINITY;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export const MindMapView: React.FC<MindMapViewProps> = ({
  mindMap,
  hasExperiences,
  isGenerating,
  onChange,
  onRegenerate,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [reconnectState, setReconnectState] = useState<ReconnectState | null>(null);
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT);
  const [panState, setPanState] = useState<PanState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const nodeMap = useMemo(() => new Map(mindMap.nodes.map((node) => [node.id, node])), [mindMap.nodes]);
  const skillNodes = useMemo(() => mindMap.nodes.filter((node) => node.type === 'skill'), [mindMap.nodes]);
  const experienceNodes = useMemo(() => mindMap.nodes.filter((node) => node.type === 'experience'), [mindMap.nodes]);
  const canvasHeight = useMemo(
    () => Math.max(560, Math.max(skillNodes.length, experienceNodes.length) * ROW_GAP + 140),
    [experienceNodes.length, skillNodes.length]
  );
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;
  const selectedEdge = selectedEdgeId ? mindMap.edges.find((edge) => edge.id === selectedEdgeId) || null : null;

  const autoLayoutNodes = useMemo(() => {
    const skillOrder = [...skillNodes];
    const skillIndex = new Map(skillOrder.map((node, index) => [node.id, index]));
    const orderedExperiences = [...experienceNodes].sort((a, b) => {
      const aSources = mindMap.edges.filter((edge) => edge.target === a.id).map((edge) => skillIndex.get(edge.source)).filter((value): value is number => value !== undefined);
      const bSources = mindMap.edges.filter((edge) => edge.target === b.id).map((edge) => skillIndex.get(edge.source)).filter((value): value is number => value !== undefined);
      return average(aSources) - average(bSources);
    });

    return [
      ...skillOrder.map((node, index) => ({
        ...node,
        position: { x: COLUMN_PADDING, y: 48 + index * ROW_GAP },
      })),
      ...orderedExperiences.map((node, index) => ({
        ...node,
        position: { x: EXPERIENCE_COLUMN_X, y: 48 + index * ROW_GAP },
      })),
    ];
  }, [experienceNodes, mindMap.edited, mindMap.edges, mindMap.nodes, skillNodes]);

  const organizedNodes = useMemo(
    () => (mindMap.edited ? mindMap.nodes : autoLayoutNodes),
    [autoLayoutNodes, mindMap.edited, mindMap.nodes]
  );

  const displayNodeMap = useMemo(() => new Map(organizedNodes.map((node) => [node.id, node])), [organizedNodes]);
  const sceneSignature = useMemo(
    () =>
      `${mindMap.edited ? 'edited' : 'auto'}::${organizedNodes
        .map((node) => `${node.id}:${node.position.x}:${node.position.y}`)
        .join('|')}::${mindMap.edges.map((edge) => `${edge.id}:${edge.source}:${edge.target}`).join('|')}`,
    [mindMap.edges, mindMap.edited, organizedNodes]
  );
  const sceneWidth = useMemo(() => {
    if (organizedNodes.length === 0) return 980;
    const maxX = Math.max(...organizedNodes.map((node) => node.position.x + NODE_WIDTH));
    return Math.max(980, maxX + 180);
  }, [organizedNodes]);
  const sceneHeight = useMemo(() => {
    if (organizedNodes.length === 0) return canvasHeight;
    const maxY = Math.max(...organizedNodes.map((node) => node.position.y + NODE_HEIGHT));
    return Math.max(canvasHeight, maxY + 180);
  }, [canvasHeight, organizedNodes]);

  const fitToView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasWidth = canvas.clientWidth;
    const canvasInnerHeight = canvas.clientHeight;
    const nextScale = clampZoom(Math.min(canvasWidth / sceneWidth, canvasInnerHeight / sceneHeight, 1));
    setViewport({
      scale: nextScale,
      offsetX: Math.max(24, (canvasWidth - sceneWidth * nextScale) / 2),
      offsetY: Math.max(24, (canvasInnerHeight - sceneHeight * nextScale) / 2),
    });
  }, [sceneHeight, sceneWidth]);

  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId && !selectedEdgeId) return new Set<string>();
    const ids = new Set<string>();

    if (selectedNodeId) {
      ids.add(selectedNodeId);
      mindMap.edges.forEach((edge) => {
        if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
          ids.add(edge.source);
          ids.add(edge.target);
        }
      });
    }

    if (selectedEdgeId) {
      const edge = mindMap.edges.find((item) => item.id === selectedEdgeId);
      if (edge) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    }

    return ids;
  }, [mindMap.edges, selectedEdgeId, selectedNodeId]);

  const connectedEdgeIds = useMemo(() => {
    if (!selectedNodeId && !selectedEdgeId) return new Set<string>();
    const ids = new Set<string>();

    if (selectedNodeId) {
      mindMap.edges.forEach((edge) => {
        if (edge.source === selectedNodeId || edge.target === selectedNodeId) {
          ids.add(edge.id);
        }
      });
    }

    if (selectedEdgeId) {
      ids.add(selectedEdgeId);
    }

    return ids;
  }, [mindMap.edges, selectedEdgeId, selectedNodeId]);

  useEffect(() => {
    if (!selectedNodeId || nodeMap.has(selectedNodeId)) return;
    setSelectedNodeId(null);
  }, [nodeMap, selectedNodeId]);

  useEffect(() => {
    if (!selectedEdgeId || mindMap.edges.some((edge) => edge.id === selectedEdgeId)) return;
    setSelectedEdgeId(null);
  }, [mindMap.edges, selectedEdgeId]);

  useEffect(() => {
    if (mindMap.nodes.length === 0 || mindMap.edited) return;

    const frame = window.requestAnimationFrame(() => {
      fitToView();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [fitToView, mindMap.edited, mindMap.nodes.length, sceneSignature]);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const bounds = canvas.getBoundingClientRect();
      const nextX = (event.clientX - bounds.left - viewport.offsetX) / viewport.scale - dragState.offsetX;
      const nextY = (event.clientY - bounds.top - viewport.offsetY) / viewport.scale - dragState.offsetY;

      onChange({
        ...mindMap,
        nodes: mindMap.nodes.map((node) =>
          node.id === dragState.nodeId
            ? {
                ...node,
                position: {
                  x: Math.max(12, Math.min(sceneWidth - NODE_WIDTH - 12, nextX)),
                  y: Math.max(12, Math.min(sceneHeight - NODE_HEIGHT - 12, nextY)),
                },
              }
            : node
        ),
        edited: true,
      });
    };

    const handlePointerUp = () => setDragState(null);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, mindMap, onChange, sceneHeight, sceneWidth, viewport.offsetX, viewport.offsetY, viewport.scale]);

  useEffect(() => {
    if (!reconnectState) return;

    const handlePointerMove = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      setReconnectState((current) =>
        current
          ? {
              ...current,
              pointerX: (event.clientX - bounds.left - viewport.offsetX) / viewport.scale,
              pointerY: (event.clientY - bounds.top - viewport.offsetY) / viewport.scale,
            }
          : current
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setReconnectState(null);
        return;
      }

      const bounds = canvas.getBoundingClientRect();
      const dropX = (event.clientX - bounds.left - viewport.offsetX) / viewport.scale;
      const dropY = (event.clientY - bounds.top - viewport.offsetY) / viewport.scale;
      const activeEdge = mindMap.edges.find((edge) => edge.id === reconnectState.edgeId);
      if (!activeEdge) {
        setReconnectState(null);
        return;
      }

      const validTarget = organizedNodes.find((node) => {
        const isInside =
          dropX >= node.position.x &&
          dropX <= node.position.x + NODE_WIDTH &&
          dropY >= node.position.y &&
          dropY <= node.position.y + NODE_HEIGHT;

        if (!isInside) return false;
        if (reconnectState.end === 'source') return node.type === 'skill' && node.id !== activeEdge.target;
        return node.type === 'experience' && node.id !== activeEdge.source;
      });

      if (validTarget) {
        const nextEdges = mindMap.edges.map((edge) => {
          if (edge.id !== reconnectState.edgeId) return edge;
          return reconnectState.end === 'source'
            ? { ...edge, source: validTarget.id }
            : { ...edge, target: validTarget.id };
        });

        const hasDuplicate = nextEdges.some(
          (edge, index) =>
            nextEdges.findIndex(
              (candidate) => candidate.source === edge.source && candidate.target === edge.target
            ) !== index
        );

        if (!hasDuplicate) {
          onChange({
            ...mindMap,
            edges: nextEdges,
            edited: true,
          });
        }
      }

      setReconnectState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [mindMap, onChange, organizedNodes, reconnectState, viewport.offsetX, viewport.offsetY, viewport.scale]);

  useEffect(() => {
    if (!panState) return;

    const handlePointerMove = (event: PointerEvent) => {
      setViewport((current) => ({
        ...current,
        offsetX: panState.originOffsetX + (event.clientX - panState.startX),
        offsetY: panState.originOffsetY + (event.clientY - panState.startY),
      }));
    };

    const handlePointerUp = () => setPanState(null);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [panState]);

  const updateNode = (field: 'label' | 'note', value: string) => {
    if (!selectedNode) return;
    onChange({
      ...mindMap,
      nodes: mindMap.nodes.map((node) => (node.id === selectedNode.id ? { ...node, [field]: value } : node)),
      edited: true,
    });
  };

  const updateEdgeLabel = (value: string) => {
    if (!selectedEdge) return;
    onChange({
      ...mindMap,
      edges: mindMap.edges.map((edge) => (edge.id === selectedEdge.id ? { ...edge, label: value } : edge)),
      edited: true,
    });
  };

  const deleteSelectedEdge = () => {
    if (!selectedEdge) return;
    onChange({
      ...mindMap,
      edges: mindMap.edges.filter((edge) => edge.id !== selectedEdge.id),
      edited: true,
    });
    setSelectedEdgeId(null);
  };

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleNativeCanvasWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;

    setViewport((current) => {
      const zoomFactor = Math.exp(-event.deltaY * 0.00045);
      const nextScale = clampZoom(current.scale * zoomFactor);
      const sceneX = (pointerX - current.offsetX) / current.scale;
      const sceneY = (pointerY - current.offsetY) / current.scale;

      return {
        scale: nextScale,
        offsetX: pointerX - sceneX * nextScale,
        offsetY: pointerY - sceneY * nextScale,
      };
    });
  }, []);

  const zoomBy = (multiplier: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = canvas.clientWidth / 2;
    const centerY = canvas.clientHeight / 2;

    setViewport((current) => {
      const nextScale = clampZoom(current.scale * multiplier);
      const sceneX = (centerX - current.offsetX) / current.scale;
      const sceneY = (centerY - current.offsetY) / current.scale;
      return {
        scale: nextScale,
        offsetX: centerX - sceneX * nextScale,
        offsetY: centerY - sceneY * nextScale,
      };
    });
  };

  const handleFit = () => {
    if (!mindMap.edited) {
      fitToView();
      return;
    }

    onChange({
      ...mindMap,
      nodes: autoLayoutNodes,
      edited: false,
    });

    window.requestAnimationFrame(() => {
      fitToView();
    });
  };

  const renderedEdges = mindMap.edges
    .map((edge) => {
      const source = displayNodeMap.get(edge.source);
      const target = displayNodeMap.get(edge.target);
      if (!source || !target) return null;
      return { edge, source, target };
    })
    .filter(Boolean) as { edge: MindMapEdge; source: MindMapNode; target: MindMapNode }[];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleNativeCanvasWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleNativeCanvasWheel);
    };
  }, [handleNativeCanvasWheel]);

  return (
    <div className="kitchen-card overflow-hidden mb-6">
      <div className="recipe-stripe"></div>
      <div className="p-5 bg-card flex flex-col gap-4 border-b border-cream-200/80 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-brand-100 to-brand-50 rounded-xl flex items-center justify-center text-brand-600 shrink-0">
            <PuzzleIcon className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-wood-800">Mind Map</h2>
            <p className="text-wood-400 text-sm">
              See how the JD&apos;s key skills connect to your experience, then tweak the graph to match your interview story.
            </p>
          </div>
        </div>

        <button
          onClick={onRegenerate}
          disabled={!hasExperiences || isGenerating}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent-500 to-accent-400 hover:from-accent-600 hover:to-accent-500 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed shrink-0 kitchen-btn shadow-md shadow-accent-500/20"
        >
          {isGenerating ? <LoaderIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
          {isGenerating ? 'Refreshing map...' : mindMap.nodes.length > 0 ? 'Regenerate Map' : 'Generate Map'}
        </button>
      </div>

      {!hasExperiences ? (
        <div className="p-8 bg-cream-50/50 text-center">
          <div className="text-3xl mb-3">🧭</div>
          <h3 className="text-[15px] font-semibold text-wood-700 mb-1">Add or extract experiences first</h3>
          <p className="text-wood-400 text-sm max-w-md mx-auto">
            The map is built from your JD plus the experiences we pulled from your resume, so it will appear once those roles are available.
          </p>
        </div>
      ) : mindMap.nodes.length === 0 ? (
        <div className="p-8 bg-cream-50/50 text-center">
          <div className="text-3xl mb-3">🕸️</div>
          <h3 className="text-[15px] font-semibold text-wood-700 mb-1">Your skill map is getting set up</h3>
          <p className="text-wood-400 text-sm max-w-md mx-auto mb-4">
            Click <strong>Generate Map</strong> to build a graph from the JD and your extracted experiences.
          </p>
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-gradient-to-r from-accent-500 to-accent-400 hover:from-accent-600 hover:to-accent-500 text-white text-sm font-semibold rounded-xl transition-all kitchen-btn shadow-md shadow-accent-500/20 inline-flex items-center gap-2 disabled:opacity-60"
          >
            {isGenerating ? <LoaderIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
            {isGenerating ? 'Generating...' : 'Generate Map'}
          </button>
        </div>
      ) : (
        <div className="bg-card relative">
          {isGenerating ? (
            <div className="absolute inset-0 flex items-center justify-center bg-card/70 backdrop-blur-sm z-20">
              <div className="flex flex-col items-center gap-3">
                <LoaderIcon className="w-8 h-8 text-accent-500 animate-gentle-pulse" />
                <p className="text-sm font-medium text-wood-600">Refreshing map...</p>
              </div>
            </div>
          ) : null}

          <div className="border-b border-cream-200/80 bg-gradient-to-r from-cream-50 to-accent-50/50 p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="rounded-2xl border border-cream-200 bg-card/80 p-4">
                <h3 className="text-sm font-semibold text-wood-800">How it works now</h3>
                <p className="mt-2 text-sm leading-relaxed text-wood-500">
                  Drag nodes to reorganize your story, click a node or connection to highlight it, and drag the small endpoint handles
                  on a selected connection to reconnect that line. Use your mouse wheel to zoom and drag empty canvas space to move around.
                </p>
              </section>

              <section className="rounded-2xl border border-cream-200 bg-card/80 p-4">
                <h3 className="text-sm font-semibold text-wood-800">Editor</h3>
                <p className="mt-1 text-xs leading-relaxed text-wood-400">
                  Nodes: {mindMap.nodes.length} | Connections: {mindMap.edges.length}
                </p>

                {selectedNode ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
                    <div>
                      <label className="block text-[11px] font-semibold text-wood-400 uppercase tracking-wider mb-1.5">Node Label</label>
                      <input
                        value={selectedNode.label}
                        onChange={(event) => updateNode('label', event.target.value)}
                        className="w-full bg-cream-50/60 text-wood-800 px-3.5 py-2.5 border border-cream-300 rounded-xl outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-wood-400 uppercase tracking-wider mb-1.5">Prep Note</label>
                      <textarea
                        rows={3}
                        value={selectedNode.note || ''}
                        onChange={(event) => updateNode('note', event.target.value)}
                        className="w-full bg-cream-50/60 text-wood-800 px-3.5 py-2.5 border border-cream-300 rounded-xl outline-none text-sm resize-y"
                        placeholder="Add your own talking points, examples, or reminders here..."
                      />
                    </div>
                  </div>
                ) : selectedEdge ? (
                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-wood-400 uppercase tracking-wider mb-1.5">Connection Label</label>
                      <input
                        value={selectedEdge.label || ''}
                        onChange={(event) => updateEdgeLabel(event.target.value)}
                        className="w-full bg-cream-50/60 text-wood-800 px-3.5 py-2.5 border border-cream-300 rounded-xl outline-none text-sm"
                        placeholder="Example: Python backend, stakeholder comms, experimentation..."
                      />
                    </div>
                    <button
                      onClick={deleteSelectedEdge}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Remove Connection
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-cream-300 bg-cream-50/60 px-4 py-4 text-sm text-wood-400">
                    Select a node or connection in the graph below to edit it.
                  </div>
                )}

                {!mindMap.edited ? (
                  <p className="mt-3 text-[11px] text-wood-400">
                    Auto-layout is organizing the map by strongest connection patterns. Drag any node to switch into manual layout.
                  </p>
                ) : null}
                <p className="mt-3 text-[11px] text-wood-400">
                  The editor updates the currently selected node or connection. Select a node to rename it or edit its prep note; select
                  a connection to rename or remove it.
                </p>
              </section>
            </div>
          </div>

          <div className="relative border-t border-cream-200/70">
            <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
              <div className="rounded-xl border border-cream-200 bg-card/90 px-3 py-1.5 text-xs font-semibold text-wood-500 shadow-sm">
                {Math.round(viewport.scale * 100)}%
              </div>
              <button
                onClick={() => zoomBy(1.12)}
                className="rounded-xl border border-cream-200 bg-card/90 px-3 py-2 text-sm font-semibold text-wood-700 shadow-sm hover:bg-cream-50"
                title="Zoom in"
              >
                +
              </button>
              <button
                onClick={() => zoomBy(0.9)}
                className="rounded-xl border border-cream-200 bg-card/90 px-3 py-2 text-sm font-semibold text-wood-700 shadow-sm hover:bg-cream-50"
                title="Zoom out"
              >
                -
              </button>
              <button
                onClick={handleFit}
                className="rounded-xl border border-cream-200 bg-card/90 px-3 py-2 text-xs font-semibold text-wood-700 shadow-sm hover:bg-cream-50"
                title="Fit board"
              >
                Fit
              </button>
            </div>

            <div
              ref={canvasRef}
              className={`relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(248,217,184,0.18),_transparent_40%),linear-gradient(180deg,_rgba(255,252,248,0.92),_rgba(255,247,240,0.96))] ${
                panState ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              style={{ width: '100%', height: canvasHeight, overscrollBehavior: 'contain', touchAction: 'none' }}
              onWheel={handleCanvasWheel}
              onClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
              }}
              onPointerDown={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest('[data-node-card="true"], [data-edge-hit="true"], [data-edge-handle="true"], button, input, textarea, select')) {
                  return;
                }
                setPanState({
                  startX: event.clientX,
                  startY: event.clientY,
                  originOffsetX: viewport.offsetX,
                  originOffsetY: viewport.offsetY,
                });
              }}
            >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: sceneWidth,
                height: sceneHeight,
                transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
              }}
            >
            <div className="pointer-events-none absolute left-0 top-0 h-12 text-[11px] font-semibold uppercase tracking-[0.2em] text-wood-300">
              <span
                className="absolute top-2 -translate-x-1/2 whitespace-nowrap"
                style={{ left: COLUMN_PADDING + NODE_WIDTH / 2 }}
              >
                JD Skills
              </span>
              <span
                className="absolute top-2 -translate-x-1/2 whitespace-nowrap"
                style={{ left: EXPERIENCE_COLUMN_X + NODE_WIDTH / 2 }}
              >
                Relevant Experience
              </span>
            </div>
            <svg
              className="absolute left-0 top-0"
              width={sceneWidth}
              height={sceneHeight}
              viewBox={`0 0 ${sceneWidth} ${sceneHeight}`}
              style={{ overflow: 'visible', zIndex: 1 }}
            >
              {renderedEdges.map(({ edge, source, target }) => {
                const path = edgePath(source, target);
                const labelPos = edgeLabelPosition(source, target);
                const isHighlighted = connectedEdgeIds.size === 0 || connectedEdgeIds.has(edge.id);
                const isSelected = selectedEdgeId === edge.id;
                const showLabel = isSelected || (selectedNodeId !== null && connectedEdgeIds.has(edge.id));
                const sourceAnchor = {
                  x: source.position.x + NODE_WIDTH,
                  y: source.position.y + NODE_HEIGHT / 2,
                };
                const targetAnchor = {
                  x: target.position.x,
                  y: target.position.y + NODE_HEIGHT / 2,
                };

                return (
                  <g key={edge.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={18}
                      className="cursor-pointer"
                      data-edge-hit="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke={isSelected ? '#af440e' : isHighlighted ? '#d45a0e' : '#dccdbd'}
                      strokeWidth={isSelected ? 3.5 : isHighlighted ? 2.2 : 1.15}
                      opacity={isHighlighted ? 1 : 0.35}
                    />
                    {edge.label && showLabel ? (
                      <>
                        <rect
                          x={labelPos.x - 42}
                          y={labelPos.y - 12}
                          width={84}
                          height={24}
                          rx={12}
                          fill="rgba(255, 253, 249, 0.95)"
                        />
                        <text
                          x={labelPos.x}
                          y={labelPos.y + 4}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="600"
                          fill="#6e5042"
                        >
                          {edge.label}
                        </text>
                      </>
                    ) : null}
                    {isSelected ? (
                      <>
                        <circle
                          cx={sourceAnchor.x}
                          cy={sourceAnchor.y}
                          r={7}
                          fill="#7a9634"
                          stroke="#fffdf9"
                          strokeWidth={3}
                          className="cursor-grab"
                          data-edge-handle="true"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setReconnectState({
                              edgeId: edge.id,
                              end: 'source',
                              pointerX: sourceAnchor.x,
                              pointerY: sourceAnchor.y,
                            });
                          }}
                        />
                        <circle
                          cx={targetAnchor.x}
                          cy={targetAnchor.y}
                          r={7}
                          fill="#f07318"
                          stroke="#fffdf9"
                          strokeWidth={3}
                          className="cursor-grab"
                          data-edge-handle="true"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setReconnectState({
                              edgeId: edge.id,
                              end: 'target',
                              pointerX: targetAnchor.x,
                              pointerY: targetAnchor.y,
                            });
                          }}
                        />
                      </>
                    ) : null}
                  </g>
                );
              })}
              {reconnectState ? (() => {
                const activeEdge = renderedEdges.find(({ edge }) => edge.id === reconnectState.edgeId);
                if (!activeEdge) return null;
                const fixedPoint = reconnectState.end === 'source'
                  ? {
                      x: activeEdge.target.position.x,
                      y: activeEdge.target.position.y + NODE_HEIGHT / 2,
                    }
                  : {
                      x: activeEdge.source.position.x + NODE_WIDTH,
                      y: activeEdge.source.position.y + NODE_HEIGHT / 2,
                    };
                const start = reconnectState.end === 'source'
                  ? { x: reconnectState.pointerX, y: reconnectState.pointerY }
                  : fixedPoint;
                const end = reconnectState.end === 'source'
                  ? fixedPoint
                  : { x: reconnectState.pointerX, y: reconnectState.pointerY };
                const delta = Math.max(80, Math.abs(end.x - start.x) * 0.35);
                const previewPath = `M ${start.x} ${start.y} C ${start.x + delta} ${start.y}, ${end.x - delta} ${end.y}, ${end.x} ${end.y}`;
                return (
                  <path
                    d={previewPath}
                    fill="none"
                    stroke="#af440e"
                    strokeWidth={2.5}
                    strokeDasharray="7 5"
                    opacity={0.9}
                  />
                );
              })() : null}
            </svg>

            {organizedNodes.map((node) => {
              const tone = nodeTone(node.type);
              const highlighted = connectedNodeIds.size === 0 || connectedNodeIds.has(node.id);
              const selected = selectedNodeId === node.id;

              return (
                <div
                  key={node.id}
                  data-node-card="true"
                  className={`absolute select-none rounded-2xl border px-4 py-3 shadow-sm transition-all duration-200 ${
                    tone.shell
                  } ${highlighted ? 'opacity-100 shadow-lg' : 'opacity-45'} ${selected ? 'ring-2 ring-wood-300' : ''}`}
                  style={{
                    width: NODE_WIDTH,
                    minHeight: NODE_HEIGHT,
                    left: node.position.x,
                    top: node.position.y,
                    zIndex: selected ? 15 : highlighted ? 10 : 5,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                  }}
                  onPointerDown={(event) => {
                    if (reconnectState) return;
                    const bounds = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                    setDragState({
                      nodeId: node.id,
                      offsetX: event.clientX - bounds.left,
                      offsetY: event.clientY - bounds.top,
                    });
                  }}
                >
                  <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${tone.chip}`}>
                    {node.type}
                  </div>
                  <div className="mt-2 text-[13px] font-semibold leading-snug">{node.label}</div>
                  {node.note ? <div className="mt-1.5 text-[11px] leading-relaxed text-wood-500 line-clamp-2">{node.note}</div> : null}
                </div>
              );
            })}
          </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};
