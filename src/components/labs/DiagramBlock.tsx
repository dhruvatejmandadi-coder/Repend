import { useEffect, useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const NODE_W = 150;
const NODE_H = 48;
const H_GAP = 40;
const V_GAP = 80;
const PAD = 30;
const MAX_NODES = 12;

function autoLayout(nodes: DiagramNode[], edges: DiagramEdge[], type: string): DiagramNode[] {
  // Limit node count to prevent clutter
  const limited = nodes.slice(0, MAX_NODES);
  if (limited.every((n) => typeof n.x === "number" && typeof n.y === "number")) {
    return limited;
  }

  const positioned = [...limited];

  if (type === "cycle") {
    const cx = 320;
    const cy = 220;
    const r = Math.min(180, 60 + 30 * positioned.length);
    positioned.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / positioned.length - Math.PI / 2;
      n.x = cx + r * Math.cos(angle);
      n.y = cy + r * Math.sin(angle);
    });
    return positioned;
  }

  if (type === "hierarchy") {
    const targets = new Set(edges.map((e) => e.to));
    const roots = positioned.filter((n) => !targets.has(n.id));
    if (roots.length === 0 && positioned.length > 0) roots.push(positioned[0]);

    const levels: Map<string, number> = new Map();
    const queue = roots.map((r) => r.id);
    roots.forEach((r) => levels.set(r.id, 0));

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
    positioned.forEach((n) => {
      if (!levels.has(n.id)) levels.set(n.id, 0);
    });

    const byLevel: Record<number, DiagramNode[]> = {};
    positioned.forEach((n) => {
      const l = levels.get(n.id) || 0;
      if (!byLevel[l]) byLevel[l] = [];
      byLevel[l].push(n);
    });

    Object.entries(byLevel).forEach(([lvlStr, ns]) => {
      const lvl = Number(lvlStr);
      const totalW = ns.length * NODE_W + (ns.length - 1) * H_GAP;
      const startX = PAD + (ns.length > 1 ? 0 : totalW / 2);
      ns.forEach((n, i) => {
        n.x = startX + (NODE_W / 2) + i * (NODE_W + H_GAP);
        n.y = PAD + NODE_H / 2 + lvl * (NODE_H + V_GAP);
      });
    });
    return positioned;
  }

  // comparison: side-by-side columns
  if (type === "comparison") {
    const cols = 2;
    const rows = Math.ceil(positioned.length / cols);
    positioned.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      n.x = PAD + NODE_W / 2 + col * (NODE_W + H_GAP * 2);
      n.y = PAD + NODE_H / 2 + row * (NODE_H + V_GAP);
    });
    return positioned;
  }

  // Default: top-to-bottom flow with proper spacing
  if (positioned.length <= 6) {
    const totalW = NODE_W + H_GAP * 2;
    const cx = totalW / 2 + PAD;
    positioned.forEach((n, i) => {
      n.x = cx;
      n.y = PAD + NODE_H / 2 + i * (NODE_H + V_GAP * 0.8);
    });
  } else {
    const cols = Math.ceil(Math.sqrt(positioned.length));
    positioned.forEach((n, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      n.x = PAD + NODE_W / 2 + col * (NODE_W + H_GAP);
      n.y = PAD + NODE_H / 2 + row * (NODE_H + V_GAP);
    });
  }
  return positioned;
}

const DIAGRAM_LABELS: Record<string, string> = {
  flowchart: "Flowchart",
  system_map: "System Map",
  process: "Process",
  cycle: "Cycle",
  hierarchy: "Hierarchy",
  comparison: "Comparison",
};

/** Truncate for display, full text available on hover */
function truncateText(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** Compute arrow endpoints that stop at node box edges */
function edgeEndpoints(
  x1: number, y1: number, x2: number, y2: number,
  w: number, h: number
): { sx: number; sy: number; ex: number; ey: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { sx: x1, sy: y1, ex: x2, ey: y2 };
  const nx = dx / dist;
  const ny = dy / dist;
  // Intersect with box
  const halfW = w / 2;
  const halfH = h / 2;
  const t1 = Math.min(halfW / Math.abs(nx || 0.001), halfH / Math.abs(ny || 0.001));
  const t2 = t1; // symmetric
  return {
    sx: x1 + nx * t1,
    sy: y1 + ny * t1,
    ex: x2 - nx * t2,
    ey: y2 - ny * t2,
  };
}

export default function DiagramBlock({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      if (!data?.nodes?.length) { setFailed(true); return; }
      const laid = autoLayout([...data.nodes], data.edges || [], data.diagram_type || "flowchart");
      setNodes(laid);
      setFailed(false);
    } catch { setFailed(true); }
  }, [data]);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragNode(nodeId);
    setOffset({ x: e.clientX - rect.left - (node.x || 0), y: e.clientY - rect.top - (node.y || 0) });
  }, [nodeMap]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragNode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setNodes((prev) => prev.map((n) => n.id === dragNode ? { ...n, x: e.clientX - rect.left - offset.x, y: e.clientY - rect.top - offset.y } : n));
  }, [dragNode, offset]);

  const handleMouseUp = useCallback(() => setDragNode(null), []);

  const handleTouchStart = useCallback((e: React.TouchEvent, nodeId: string) => {
    const touch = e.touches[0];
    const node = nodeMap.get(nodeId);
    if (!node || !touch) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragNode(nodeId);
    setOffset({ x: touch.clientX - rect.left - (node.x || 0), y: touch.clientY - rect.top - (node.y || 0) });
  }, [nodeMap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragNode) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    setNodes((prev) => prev.map((n) => n.id === dragNode ? { ...n, x: touch.clientX - rect.left - offset.x, y: touch.clientY - rect.top - offset.y } : n));
  }, [dragNode, offset]);

  // Compute SVG size from node positions
  const maxX = Math.max(400, ...nodes.map((n) => (n.x || 0) + NODE_W / 2 + PAD));
  const maxY = Math.max(300, ...nodes.map((n) => (n.y || 0) + NODE_H / 2 + PAD));

  if (failed) {
    return (
      <div className="space-y-3">
        {data.title && <h4 className="text-sm font-bold">{data.title}</h4>}
        <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-2">
          {data.nodes?.map((n) => (
            <div key={n.id} className="px-3 py-2 rounded-lg border text-sm bg-primary/10 border-primary/30 text-foreground">
              {n.text}
            </div>
          ))}
          {data.edges?.length > 0 && (
            <div className="space-y-1 mt-2">
              {data.edges.map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {data.nodes.find((n) => n.id === e.from)?.text || e.from} →{" "}
                  {data.nodes.find((n) => n.id === e.to)?.text || e.to}
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
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {data.diagram_type && (
            <Badge variant="outline" className="text-xs capitalize">
              📐 {DIAGRAM_LABELS[data.diagram_type] || data.diagram_type}
            </Badge>
          )}
          {data.title && <span className="text-sm font-medium text-foreground">{data.title}</span>}
        </div>

        <div
          ref={containerRef}
          className="rounded-xl border border-border bg-card overflow-auto cursor-grab active:cursor-grabbing"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          <svg viewBox={`0 0 ${maxX} ${maxY}`} className="w-full" style={{ minHeight: 300, maxHeight: 520 }}>
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground/50" />
              </marker>
            </defs>

            {/* Edges */}
            {(data.edges || []).map((edge, i) => {
              const fromNode = nodeMap.get(edge.from);
              const toNode = nodeMap.get(edge.to);
              if (!fromNode || !toNode) return null;
              const { sx, sy, ex, ey } = edgeEndpoints(
                fromNode.x || 0, fromNode.y || 0,
                toNode.x || 0, toNode.y || 0,
                NODE_W, NODE_H
              );

              return (
                <g key={`edge-${i}`}>
                  <line
                    x1={sx} y1={sy} x2={ex} y2={ey}
                    className="stroke-muted-foreground/35"
                    strokeWidth={1.5}
                    markerEnd="url(#arrowhead)"
                  />
                  {edge.label && (
                    <text
                      x={(sx + ex) / 2}
                      y={(sy + ey) / 2 - 6}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[9px]"
                    >
                      {truncateText(edge.label, 20)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const nx = (node.x || 0) - NODE_W / 2;
              const ny = (node.y || 0) - NODE_H / 2;
              const isDragging = dragNode === node.id;
              const displayText = truncateText(node.text, 20);

              return (
                <Tooltip key={node.id}>
                  <TooltipTrigger asChild>
                    <g
                      onMouseDown={(e) => handleMouseDown(e, node.id)}
                      onTouchStart={(e) => handleTouchStart(e, node.id)}
                      style={{ cursor: isDragging ? "grabbing" : "grab" }}
                    >
                      <rect
                        x={nx} y={ny}
                        width={NODE_W} height={NODE_H}
                        rx={10}
                        className={isDragging ? "fill-primary/20 stroke-primary" : "fill-primary/10 stroke-primary/40"}
                        strokeWidth={isDragging ? 2 : 1.2}
                      />
                      <text
                        x={node.x || 0}
                        y={(node.y || 0) + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-foreground text-[11px] font-medium select-none pointer-events-none"
                      >
                        {displayText}
                      </text>
                    </g>
                  </TooltipTrigger>
                  {node.text.length > 20 && (
                    <TooltipContent side="top" className="max-w-[240px] text-xs">
                      {node.text}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </svg>
        </div>

        {data.caption && <p className="text-xs text-muted-foreground text-center italic">{data.caption}</p>}
      </div>
    </TooltipProvider>
  );
}
