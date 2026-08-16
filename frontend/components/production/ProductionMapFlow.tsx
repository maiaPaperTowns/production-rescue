"use client";

import { useMemo } from "react";
import ReactFlow, { Background, Handle, Position, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { Film, User, MapPin, Camera } from "lucide-react";
import type { Scene } from "@/types";
import { cn } from "@/lib/utils";

const COLUMN_X = { scene: 40, actor: 400, location: 680, equipment: 960 };
const ROW_HEIGHT = 84;

function MapNode({ data }: { data: { label: string; sublabel?: string; kind: "scene" | "actor" | "location" | "equipment"; affected?: boolean } }) {
  const iconMap = { scene: Film, actor: User, location: MapPin, equipment: Camera };
  const Icon = iconMap[data.kind];
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 min-w-44 backdrop-blur-xl transition-all",
        data.affected
          ? "border-status-blocked/60 bg-status-blocked/10 shadow-[0_0_24px_-8px_var(--status-blocked)]"
          : "border-border bg-card/90"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !border-0 !size-1.5" />
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full p-1.5 shrink-0", data.affected ? "bg-status-blocked/20" : "bg-gradient-brand")}>
          <Icon className={cn("size-3", data.affected ? "text-status-blocked" : "text-white")} strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight truncate">{data.label}</p>
          {data.sublabel && <p className="text-[10px] text-muted-foreground truncate">{data.sublabel}</p>}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !border-0 !size-1.5" />
    </div>
  );
}

const nodeTypes = { mapNode: MapNode };

export function ProductionMapFlow({ scenes, affectedSceneIds }: { scenes: Scene[]; affectedSceneIds: Set<number> }) {
  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: Edge[] = [];
    const actorRow = new Map<number, number>();
    const locationRow = new Map<number, number>();
    const equipmentRow = new Map<number, number>();

    scenes.forEach((scene, i) => {
      const affected = affectedSceneIds.has(scene.id);
      nodeList.push({
        id: `scene-${scene.id}`,
        type: "mapNode",
        position: { x: COLUMN_X.scene, y: i * ROW_HEIGHT },
        data: { label: `Scene ${scene.scene_number}`, sublabel: scene.title, kind: "scene", affected },
      });

      for (const actor of scene.cast) {
        const key = `actor-${actor.id}`;
        if (!actorRow.has(actor.id)) actorRow.set(actor.id, actorRow.size);
        if (!nodeList.some((n) => n.id === key)) {
          nodeList.push({
            id: key,
            type: "mapNode",
            position: { x: COLUMN_X.actor, y: (actorRow.get(actor.id) ?? 0) * ROW_HEIGHT },
            data: { label: actor.name, sublabel: actor.role, kind: "actor", affected: false },
          });
        }
        edgeList.push({
          id: `e-${scene.id}-${key}`,
          source: `scene-${scene.id}`,
          target: key,
          animated: affected,
          style: { stroke: affected ? "var(--status-blocked)" : "var(--border)", strokeWidth: affected ? 2 : 1 },
        });
      }

      const locKey = `location-${scene.location.id}`;
      if (!locationRow.has(scene.location.id)) locationRow.set(scene.location.id, locationRow.size);
      if (!nodeList.some((n) => n.id === locKey)) {
        nodeList.push({
          id: locKey,
          type: "mapNode",
          position: { x: COLUMN_X.location, y: (locationRow.get(scene.location.id) ?? 0) * ROW_HEIGHT },
          data: { label: scene.location.name, sublabel: scene.location.location_type, kind: "location", affected: false },
        });
      }
      edgeList.push({
        id: `e-${scene.id}-${locKey}`,
        source: `scene-${scene.id}`,
        target: locKey,
        animated: affected,
        style: { stroke: affected ? "var(--status-blocked)" : "var(--border)", strokeWidth: affected ? 2 : 1 },
      });

      for (const item of scene.equipment) {
        const key = `equipment-${item.id}`;
        if (!equipmentRow.has(item.id)) equipmentRow.set(item.id, equipmentRow.size);
        if (!nodeList.some((n) => n.id === key)) {
          nodeList.push({
            id: key,
            type: "mapNode",
            position: { x: COLUMN_X.equipment, y: (equipmentRow.get(item.id) ?? 0) * ROW_HEIGHT },
            data: { label: item.name, sublabel: item.category, kind: "equipment", affected: false },
          });
        }
        edgeList.push({
          id: `e-${scene.id}-${key}`,
          source: `scene-${scene.id}`,
          target: key,
          animated: affected,
          style: { stroke: affected ? "var(--status-blocked)" : "var(--border)", strokeWidth: affected ? 2 : 1 },
        });
      }
    });

    return { nodes: nodeList, edges: edgeList };
  }, [scenes, affectedSceneIds]);

  return (
    <div className="h-[600px] rounded-xl border border-border overflow-hidden bg-card/40">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background color="var(--border)" gap={20} />
      </ReactFlow>
    </div>
  );
}
