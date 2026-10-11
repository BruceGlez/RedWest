# Pete Area 1, Section 1: build notes

Built live in Blender through the Blender MCP by `tools/blender/make_pete_section1.py` from `tools/blender/pete_area1_layout.json`.
Source scene: `tools/blender/pete_area1.blend` (scene `PeteArea1`). Review renders: `art/pete-area1/section1_review/`. Raw numbers: `art/pete-area1/section1_review/section1_report.json`.

## World scale

The game's marshal is 6 units tall; the art is modelled at 1 unit = 1 m for a 1.9 m figure. Everything exported for the game is multiplied by `WORLD_SCALE = 3` in `make_pete_section1.py`:
chunk vertices, dynamic node transforms, the kit files (a root node with scale 3), `pete_section1_markers.json`, and `pete_section1_collision.json` (grid cell 3 units, boxes in units).
The `.blend` and the review renders stay at 1:1. Triangle counts and sizes are unchanged. See `docs/design/pete-section1-gameplay.md`, section 1.

## Rebuild

In Blender (any session with the Blender MCP), run:

```
exec(compile(open(r"<repo>/tools/blender/make_pete_section1.py", encoding="utf-8").read(), "make_pete_section1.py", "exec"), globals())
run_s1_6()                     # whole section: relief, road, dressing, foliage, light, vertex AO, far ring
build_dtab(); export_chunks(); export_kits(); export_markers_json()      # or run_s1_7() for audit + export + renders
```

Steps are cumulative and re-runnable: S1-1 relief, S1-2 road and paths, S1-3 Trailhead and Shack Row, S1-4 Sluice Field and Headframe, S1-5 Tailings Wash, Stash and Flume Bridge, S1-6 foliage, light, AO, far ring, S1-7 audit and export.
Coordinates: game x = Blender X, game z = -Blender Y, 1 unit = 1 m. Everything walkable is at height 0.

## Files in `public/models/pete-area1/` (new; the older files in that folder are untouched)

| File | What |
|---|---|
| `chunk_section1_a.glb` to `_d.glb` | Static scenery merged into one mesh per chunk (world origin, about 105 m each with 20 m overlap) plus the dynamic nodes below |
| `chunk_section1_far_ring.glb` | Distant mesa ring, smoke columns, far ground (1,313 triangles) |
| `kit_crate`, `kit_pot`, `kit_campfire`, `kit_lantern`, `kit_barrel`, `kit_fence_break`, `kit_door`, `kit_shed_doors`, `kit_lever_gate`, `kit_ladder`, `kit_clue_manifest`, `kit_clue_ledger`, `kit_clue_key` (`.glb`) | Reusable pieces with the named nodes the game animates |
| `pete_section1_markers.json` | 85 markers: hiding places (`hide`), interactables (`breakable`, `loot`, `door`, `lever`, `climb`, `lore`, `vantage`, `campfire`, `hazard`), `encounter`, `spawn`, `crossover`, `slot`, `landmark`, `note`; game x and z in metres, radius, note |

Named nodes (checked in the exported files): `crate_body`, `lid` (pivot at back edge), `pot_whole`, `pot_shards`, `campfire_stones`, `campfire_logs`, `fire_glow`, `fire_flame`, `lantern`, `lantern_frame`, `glow`,
`barrel_whole`, `barrel_broken`, `fence_whole`, `fence_broken`, `door` and `door_l`/`door_r` (pivots at the hinges), `gate_leaf`, `gate_posts`, `lever_base`, `lever_arm`, `ladder`, `clue_manifest`, `clue_ledger`, `clue_key`.
The hidden variants (`pot_shards`, `barrel_broken`, `fence_broken`) are exported visible; the game hides and swaps them. Blender's `.001` name suffixes are stripped, and every lantern group is a node named `lantern`.
Layout-driven crates, pots and campfires (`a1-*` in the layout) are NOT in the chunks: the game places them from the layout with the kit files. Decorative copies are baked in.

## Per-chunk budget (art brief: under 45,000 triangles, 4 materials, 40 draw calls per chunk)

| Chunk | Range | Static triangles | Dynamic-node triangles | Triangles in file | Mesh nodes (draw calls) | Materials | Size |
|---|---|---|---|---|---|---|---|
| a | -35 to 105 m | 36019 | 884 | 36903 | 16 | 2 | 1.70 MB |
| b | 85 to 210 m | 40147 | 2062 | 42209 | 32 | 2 | 1.89 MB |
| c | 190 to 315 m | 34926 | 1212 | 36138 | 16 | 2 | 1.68 MB |
| d | 295 to 447 m | 36609 | 734 | 37343 | 14 | 2 | 1.74 MB |

Materials: `M_rock` (vertex colours) and `M_cloth_glow` (emissive, for fire and lanterns). Two chunks overlapping in the worst case on a phone: about 78,000 triangles and 48 draw calls (budget 90,000 and 130).
Total for Section 1: 7.22 MB including the kits (see the open points on size).

Export details: no textures; vertex colour is `COLOR_0` stored as normalised bytes; chunk files carry no `NORMAL`, so three.js shades them flat (the faceted look). Kit files keep normals (pots and barrels are smooth).

## Section 1 numbers (doc quality bar)

Placed props 487 (target 450 to 650), foliage and scatter clusters 384 (250 to 400), hiding places 14 (H01 to H14), interactables 34 (24 or more), 3 lanes with 14 crossovers,
cliff kit variants 24 (nearest repeat 66.8 m), terraces at 4, 9 and 16 m plus a rim, a gully 6.4 m deep, 2 mesas, landmarks: headframe, flume aqueduct, bridge.

## Acceptance checklist (art brief section 9 and the doc quality bar)

- Walking surface flat: road ribbon top 0.036 m, boardwalk 0.05 m, bridge deck top 0.05 m (limit 0.05). Flat decals sit at up to 0.07 m; the pebble scatter reaches 0.203 m (stones, not walking surface).
- Edges closed: west plug min height 8.7 m, east plug 10.8 m, north rim 24.0 m, south edge 4.7 m, all with a skirt to the far ground; nothing opens to a void.
- South walls near the road: first terrace at most 6.4 m (the old fixed camera needed 3 to 7 m; the approved chase camera does not need it).
- Layout items (campfire, crates, pots, guard anchors, start, encounters) sit at their exact layout coordinates.
- Centre line plus 8 m free of standing props: NOT fully met. 16 objects are inside: the Trailhead camp seats and crate stack (safe start), lamp posts at the bridge ends (6.3 m), stones and a waterwheel in the gully below the deck, the ledge under the bridge, and one false positive (a tarp roof whose origin is on the centre line; its mesh is 14 m off).
  The gate posts stand at 4.6 m on purpose (a landmark at the safe start). The Claims fight circle (26 m radius) is clear of props.
- Palette: no pure black or white (darkest vertex colour 0.0043 linear, lightest 0.855).
- No text in textures (there are no textures), no humans, no animals (the toy is a plain wooden pull-toy), no skulls or blood, no real brands (the Company emblem is the original rail-and-rising-sun).
- Named nodes present in the kit files (list above).
- 5 road surface looks (dirt, gravel, mud, cobble, planks), 3 terrace heights, nothing repeats within 40 m.

## Differences from the doc and open points

- The valley is 85 m wide on average (doc: 130 m). Approved: the chase camera makes the wide valley readable, but the dressing sits 30 to 55 m off the road.
- Not built: the hoodoo landmark, the far water tower, the optional rim notch H15. The gully has no water or foliage.
- The Stash path leaves at about 368 m (layout JSON), not 313 m (doc).
- Fog is not rendered in Blender (an EEVEE world volume turned the scene black); the game's fog values are stored on the scene as `rw_fog_*`.
- Size: 4 chunks plus kits are 7.22 MB. The brief's 12 MB is for the whole area, about three times this length. The game has no Draco or Meshopt decoder; adding one (or running the files through `gltf-transform meshopt`) would cut sizes several times over.
- Hero pieces (the trailhead gate, the headframe, shacks) are baked static into the chunks; only the nodes listed above are animated.
- `tools/blender/make_pete_area1.py` and the older `chunk_trailhead.glb`, `prop_*.glb` and `clue_manifest.glb` belong to the earlier session and were left alone.
