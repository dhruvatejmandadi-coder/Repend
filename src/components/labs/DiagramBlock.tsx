import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type DiagramNode = {
  id: string;
  text: string;
  x?: number;
  y?: number;
  color?: string;
};

type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
};

export type DiagramData = {
  diagram_type: "flowchart" | "system_map" | "process" | "cycle" | "hierarchy" | "comparison";
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  title?: string;
  caption?: string;
};

type Props = {
  data: DiagramData;
};

// Layout engine — auto-positions nodes if no coordinates given
function autoLayout(nodes: DiagramNode[], edges: DiagramEdge[], type: string): DiagramNode[] {
  if (nodes.every(n => typeof n.x === "number" && typeof n.y === "number")) {
    return nodes;
  }

  const positioned = [...nodes];
  const width = 600;

  if (type === "cycle") {
    const cx = width / 2;
    const cy = 200;
    const r = Math.min(160, 50 * nodes.length);
    positioned.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      n.x = cx + r * Math.cos(angle);
      n.y = cy + r * Math.sin(angle);
    });
    return positioned;
  }

  if (type === "hierarchy") {
    // Find roots (nodes not targeted by edges)
    const targets = new Set(edges.map(e => e.to));
    const roots = positioned.filter(n => !targets.has(n.id));
    if (roots.length === 0 && positioned.length > 0) roots.push(positioned[0]);

    const levels: Map<string, number> = new Map();
    const queue = roots.map(r => r.id);
    roots.forEach(r => levels.set(r.id, 0));

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const lvl = levels.get(curr) || 0;
      for (const e of edges) {
        if (e.from === curr && !levels.has(e.to)) {
          levels.set(e.to, lvl + 1);
          queue.push(e.to);
        }
      }
    }
    positioned.forEach(n => { if (!levels.has(n.id)) levels.set(n.id, 0); });

    const byLevel: Record<number, DiagramNode[]> = {};
    positioned.forEach(n => {
      const l = levels.get(n.id) || 0;
      if (!byLevel[l]) byLevel[l] = [];
      byLevel[l].push(n);
    });

    Object.entries(byLevel).forEach(([lvlStr, ns]) => {
      const lvl = Number(lvlStr);
      const spacing = width / (ns.length + 1);
      ns.forEach((n, i) => {
        n.x = spacing * (i + 1);
        n.y = 60 + lvl * 120;
      });
    });
    return positioned;
  }

  // Default: top-to-bottom flow
  const spacing = width / (positioned.length + 1);
  positioned.forEach((n, i) => {
    if (positioned.length <= 4) {
      n.x = width / 2;
      n.y = 60 + i * 110;
    } else {
      const cols = Math.ceil(Math.sqrt(positioned.length));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const colSpacing = width / (cols + 1);
      n.x = colSpacing * (col + 1);
      n.y = 60 + row * 120;
    }
  });
  return positioned;
}

const NODE_COLORS: Record<string, string> = {
  flowchart: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
  system_map: "bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300",
  process: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  cycle: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
  hierarchy: "bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300",
  comparison: "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300",
};

const DIAGRAM_LABELS: Record<string, string> = {
  flowchart: "Flowchart",
  system_map: "System Map",
  process: "Process",
  cycle: "Cycle",
  hierarchy: "Hierarchy",
  comparison: "Comparison",
};

export default function DiagramBlock({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      if (!data?.nodes?.length) {
        setFailed(true);
        return;
      }
      const laid = autoLayout([...data.nodes], data.edges || [], data.diagram_type || "flowchart");
      setNodes(laid);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [data]);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragNode(nodeId);
    setOffset({
      x: e.clientX - rect.left - (node.x || 0),
      y: e.clientY - rect.top - (node.y || 0),
    });
  }, [nodeMap]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragNode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left - offset.x;
    const y = e.clientY - rect.top - offset.y;
    setNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x, y } : n));
  }, [dragNode, offset]);

  const handleMouseUp = useCallback(() => {
    setDragNode(null);
  }, []);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent, nodeId: string) => {
    const touch = e.touches[0];
    const node = nodeMap.get(nodeId);
    if (!node || !touch) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragNode(nodeId);
    setOffset({
      x: touch.clientX - rect.left - (node.x || 0),
      y: touch.clientY - rect.top - (node.y || 0),
    });
  }, [nodeMap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragNode) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    const x = touch.clientX - rect.left - offset.x;
    const y = touch.clientY - rect.top - offset.y;
    setNodes(prev => prev.map(n => n.id === dragNode ? { ...n, x, y } : n));
  }, [dragNode, offset]);

  // Compute SVG dimensions
  const maxX = Math.max(400, ...nodes.map(n => (n.x || 0) + 80));
  const maxY = Math.max(300, ...nodes.map(n => (n.y || 0) + 50));
  const svgW = maxX + 40;
  const svgH = maxY + 40;

  const colorClass = NODE_COLORS[data.diagram_type] || NODE_COLORS.flowchart;

  if (failed) {
    // Static fallback
    return (
      <div className="space-y-3">
        {data.title && <h4 className="text-sm font-bold">{data.title}</h4>}
        <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-2">
          {data.nodes?.map(n => (
            <div key={n.id} className={`px-3 py-2 rounded-lg border text-sm ${colorClass}`}>
              {n.text}
            </div>
          ))}
          {data.edges?.length > 0 && (
            <div className="space-y-1 mt-2">
              {data.edges.map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {data.nodes.find(n => n.id === e.from)?.text || e.from} → {data.nodes.find(n => n.id === e.to)?.text || e.to}
                  {e.label ? ` (${e.label})` : ""}
                </p>
              ))}
            </div>
          )}
        </div>
        {data.caption && <p className="text-xs text-muted-foreground text-center italic">{data.caption}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {data.diagram_type && (
          <Badge variant="outline" className="text-xs capitalize">
            📐 {DIAGRAM_LABELS[data.diagram_type] || data.diagram_type}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground">Drag nodes to rearrange</span>
      </div>

      <div
        ref={containerRef}
        className="rounded-xl border border-border bg-card overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full"
          style={{ minHeight: 280, maxHeight: 500 }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" className="fill-muted-foreground/60" />
            </marker>
          </defs>

          {/* Edges */}
          {(data.edges || []).map((edge, i) => {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
            if (!fromNode || !toNode) return null;
            const x1 = (fromNode.x || 0);
            const y1 = (fromNode.y || 0);
            const x2 = (toNode.x || 0);
            const y2 = (toNode.y || 0);

            return (
              <g key={`edge-${i}`}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  className="stroke-muted-foreground/40"
                  strokeWidth={2}
                  markerEnd="url(#arrowhead)"
                />
                {edge.label && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const textLen = node.text.length;
            const boxW = Math.max(130, Math.min(240, textLen * 9 + 32));
            const boxH = 52;
            const nx = (node.x || 0) - boxW / 2;
            const ny = (node.y || 0) - boxH / 2;
            const isDragging = dragNode === node.id;

            return (
              <g
                key={node.id}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onTouchStart={(e) => handleTouchStart(e, node.id)}
                style={{ cursor: isDragging ? "grabbing" : "grab" }}
              >
                <rect
                  x={nx}
                  y={ny}
                  width={boxW}
                  height={boxH}
                  rx={10}
                  className={`${isDragging ? "fill-primary/20 stroke-primary" : "fill-primary/10 stroke-primary/40"}`}
                  strokeWidth={isDragging ? 2 : 1.5}
                />
                <text
                  x={node.x || 0}
                  y={(node.y || 0) + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-[13px] font-semibold select-none pointer-events-none"
                >
                  {node.text.length > 26 ? node.text.slice(0, 24) + "…" : node.text}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {data.caption && (
        <p className="text-xs text-muted-foreground text-center italic">{data.caption}</p>
      )}
    </div>
  );
}
