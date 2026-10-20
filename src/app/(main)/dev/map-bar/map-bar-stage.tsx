"use client";

/**
 * The map progress bar drawn with the history course's map parts at frame
 * time `t`. Parts render at the history course's size (MAP_GAME_SCALE) inside
 * a layer scaled by `layout.unit`, so their own sizes and offsets stay as they
 * are; positions come from the engine in frame px.
 */

import {
  ANCIENT_ASSETS,
  AncientMapAsset,
  CharacterMarker,
  MapRoomAsset,
  MapSelectionRing,
  PathTick,
  SweepRing,
  actMapMeta,
  effectSrc,
  mapIconSrc,
  mapOutlineSrc,
} from "@/components/map/map-parts";
import type { MapBarTimeline } from "@/lib/map-bar/engine";
import { CHARACTER_MARKER_SIZE } from "@/lib/sts2-map-geometry";
import type { MapBarFrame, MapBarInput, MapBarNodeArt } from "@/lib/map-bar/types";

export function actIdOf(input: MapBarInput) {
  return `ACT.${(input.act ?? "overgrowth").toUpperCase()}`;
}

export function characterMarkerSrc(input: MapBarInput) {
  const character = input.character === undefined ? "silent" : input.character;
  if (!character) return null;
  return {
    src: `/images/sts2/characters/character_icon_${character}.webp`,
    outline: `/images/sts2/characters/character_icon_${character}_outline.webp`,
  };
}

function ancientAsset(key: string) {
  return ANCIENT_ASSETS[key] ?? ANCIENT_ASSETS.neow;
}

/** Every image a timeline can show, so they are loaded before the first frame (CSS masks included). */
export function mapBarImageUrls(timeline: MapBarTimeline): string[] {
  const actId = actIdOf(timeline.input);
  const urls = new Set<string>([effectSrc("map_dot"), effectSrc("map_circle_4")]);
  const add = (art: MapBarNodeArt) => {
    if (art.kind === "ancient") {
      const asset = ancientAsset(art.key);
      urls.add(asset.node);
      urls.add(asset.outline);
    } else {
      urls.add(mapIconSrc(actId, art.icon));
      urls.add(mapOutlineSrc(art.outline));
    }
  };
  for (const node of timeline.frameAt(0).nodes) add(node.art);
  for (const node of timeline.frameAt(timeline.duration).nodes) add(node.art);
  const marker = characterMarkerSrc(timeline.input);
  if (marker) {
    urls.add(marker.src);
    urls.add(marker.outline);
  }
  return [...urls];
}

export function MapBarStage({ timeline, frame }: { timeline: MapBarTimeline; frame: MapBarFrame }) {
  const { layout, input } = timeline;
  const unit = layout.unit;
  const actId = actIdOf(input);
  const meta = actMapMeta(actId);
  const marker = characterMarkerSrc(input);
  return (
    <div
      className="absolute left-0 top-0"
      style={{ width: layout.width / unit, height: layout.height / unit, transform: `scale(${unit})`, transformOrigin: "0 0" }}
    >
      {input.background === "paper" && <div className="absolute inset-0" style={{ background: meta.bgColor }} />}

      {layout.edges.map((ticks, edge) =>
        ticks.map((tick, index) => (
          <PathTick
            key={`${edge}-${index}`}
            left={tick.x / unit}
            top={tick.y / unit}
            rotation={tick.rotation}
            revealed={index < frame.traveledTicks[edge]}
            traveledColor={meta.traveledColor}
            untraveledColor={meta.untraveledColor}
          />
        )),
      )}

      {frame.nodes.map((node) => {
        const place = layout.nodes[node.index];
        const size = { width: place.size / unit, height: place.size / unit };
        return (
          <div
            key={node.index}
            className="absolute"
            data-map-bar-node={node.index}
            data-node-state={node.state}
            style={{ left: place.x / unit - size.width / 2, top: place.y / unit - size.height / 2, width: size.width, height: size.height }}
          >
            <div className="absolute inset-0" style={{ transform: `scale(${node.scale})`, transformOrigin: "center center" }}>
              {node.art.kind === "ancient" ? (
                <AncientMapAsset
                  actId={actId}
                  size={size}
                  src={ancientAsset(node.art.key).node}
                  outlineSrc={ancientAsset(node.art.key).outline}
                  alt="ancient"
                />
              ) : (
                <>
                  {/* MapRoomAsset's own ring, drawn here so the reveal pulse leaves it alone. */}
                  <MapSelectionRing state={node.state} inset="-18%" suppress={node.sweep !== null} />
                  <div className="absolute inset-0" style={node.pulse !== 1 ? { transform: `scale(${node.pulse})` } : undefined}>
                    <MapRoomAsset
                      actId={actId}
                      state={node.state}
                      size={size}
                      iconName={node.art.icon}
                      outlineName={node.art.outline}
                      alt={node.art.icon}
                      suppressRing
                    />
                  </div>
                </>
              )}
            </div>
            {node.sweep !== null && node.sweep > 0 && <SweepRing pct={node.sweep} />}
          </div>
        );
      })}

      {marker && frame.marker && (
        <CharacterMarker
          left={frame.marker.x / unit}
          top={frame.marker.y / unit}
          size={CHARACTER_MARKER_SIZE}
          scale={frame.marker.scale}
          opacity={frame.marker.opacity}
          onDestination
          src={marker.src}
          outlineSrc={marker.outline}
        />
      )}
    </div>
  );
}
