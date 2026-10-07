"""
Procedural generator for Red West Mine & Cavern Props Set (Lane: art)
Generates 5 stylized Western mine props:
  1. mine_cart.glb    - Ore hopper cart with flanged wheels, timber chassis & ore chunks
  2. mine_rails.glb   - Modular straight track segment with ties, steel rails & spikes
  3. mine_arch.glb    - Heavy drift timber cavern shoring arch with wedges & braces
  4. wall_torch.glb   - Forged iron sconce wall torch with cloth wrap & emissive flame
  5. mine_lantern.glb - Miner's brass/tin oil lantern with glass chimney, cage & bail handle

Outputs:
  - public/models/<name>.glb
  - tools/blender/<name>.blend (gitignored)
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix, Euler

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUBLIC_MODELS = os.path.join(PROJECT_ROOT, 'public', 'models')
BLEND_DIR = os.path.abspath(os.path.dirname(__file__))

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.textures, bpy.data.images, bpy.data.armatures):
        for item in list(block):
            block.remove(item)

def get_or_create_material(name, base_color, roughness=0.75, metallic=0.0, emission_color=(0, 0, 0, 1), emission_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = base_color
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = emission_color
            bsdf.inputs['Emission Strength'].default_value = emission_strength
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = emission_color
        if alpha < 1.0:
            if 'Alpha' in bsdf.inputs:
                bsdf.inputs['Alpha'].default_value = alpha
            mat.blend_method = 'BLEND'
    return mat

def init_palette():
    return {
        'iron': get_or_create_material('IronDark', (0.16, 0.18, 0.21, 1.0), roughness=0.6, metallic=0.75),
        'iron_rivet': get_or_create_material('IronRivet', (0.24, 0.26, 0.28, 1.0), roughness=0.5, metallic=0.8),
        'rail_steel': get_or_create_material('RailSteel', (0.28, 0.30, 0.34, 1.0), roughness=0.45, metallic=0.85),
        'wood_dark': get_or_create_material('WoodDark', (0.28, 0.19, 0.12, 1.0), roughness=0.85),
        'wood_light': get_or_create_material('WoodLight', (0.44, 0.32, 0.20, 1.0), roughness=0.82),
        'wood_weathered': get_or_create_material('WoodWeathered', (0.36, 0.32, 0.28, 1.0), roughness=0.88),
        'rock_dark': get_or_create_material('RockDark', (0.22, 0.23, 0.25, 1.0), roughness=0.9),
        'ore_gold': get_or_create_material('OreGold', (0.85, 0.68, 0.18, 1.0), roughness=0.35, metallic=0.8),
        'ore_copper': get_or_create_material('OreCopper', (0.20, 0.58, 0.50, 1.0), roughness=0.4, metallic=0.5),
        'torch_cloth': get_or_create_material('TorchCloth', (0.52, 0.46, 0.36, 1.0), roughness=0.9),
        'charcoal': get_or_create_material('Charcoal', (0.10, 0.10, 0.11, 1.0), roughness=0.95),
        'brass': get_or_create_material('Brass', (0.75, 0.58, 0.22, 1.0), roughness=0.35, metallic=0.7),
        'glass': get_or_create_material('GlassChimney', (0.88, 0.94, 0.98, 0.45), roughness=0.15, alpha=0.45),
        'flame_core': get_or_create_material('FlameCore', (1.0, 0.90, 0.40, 1.0), roughness=0.1,
                                            emission_color=(1.0, 0.92, 0.45, 1.0), emission_strength=5.0),
        'flame_mid': get_or_create_material('FlameMid', (1.0, 0.55, 0.10, 1.0), roughness=0.2,
                                           emission_color=(1.0, 0.55, 0.10, 1.0), emission_strength=3.5),
    }

def add_box_mesh(bm, center, size, rot=None, mat_index=0):
    before = set(bm.faces)
    mat = Matrix.Translation(Vector(center))
    if rot:
        mat = mat @ Euler(rot, 'XYZ').to_matrix().to_4x4()
    mat = mat @ Matrix.Diagonal(Vector((size[0], size[1], size[2], 1.0)))
    ret = bmesh.ops.create_cube(bm, size=1.0, matrix=mat)
    for f in bm.faces:
        if f not in before:
            f.material_index = mat_index
    return ret

def add_cylinder_mesh(bm, center, radius, depth, segments=12, rot=None, mat_index=0):
    before = set(bm.faces)
    mat = Matrix.Translation(Vector(center))
    if rot:
        mat = mat @ Euler(rot, 'XYZ').to_matrix().to_4x4()
    ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                                radius1=radius, radius2=radius, depth=depth, matrix=mat)
    for f in bm.faces:
        if f not in before:
            f.material_index = mat_index
    return ret

def create_mine_cart_mesh(palette):
    me = bpy.data.meshes.new('MineCart')
    bm = bmesh.new()

    # Materials order
    mats = [palette['iron'], palette['wood_dark'], palette['rail_steel'],
            palette['iron_rivet'], palette['rock_dark'], palette['ore_gold'], palette['ore_copper']]
    for m in mats:
        me.materials.append(m)

    MAT_IRON = 0
    MAT_WOOD = 1
    MAT_STEEL = 2
    MAT_RIVET = 3
    MAT_ROCK = 4
    MAT_GOLD = 5
    MAT_COPPER = 6

    # --- 1. Chassis / Undercarriage ---
    # Longitudinal timbers (side sills)
    add_box_mesh(bm, (-0.28, 0.0, 0.28), (0.12, 1.15, 0.09), mat_index=MAT_WOOD)
    add_box_mesh(bm, (0.28, 0.0, 0.28), (0.12, 1.15, 0.09), mat_index=MAT_WOOD)
    # Crossbeams (fore and aft bumper blocks)
    add_box_mesh(bm, (0.0, -0.56, 0.28), (0.72, 0.12, 0.09), mat_index=MAT_WOOD)
    add_box_mesh(bm, (0.0, 0.56, 0.28), (0.72, 0.12, 0.09), mat_index=MAT_WOOD)

    # Center draft tongue with forged coupling loops
    add_box_mesh(bm, (0.0, 0.0, 0.26), (0.10, 1.38, 0.06), mat_index=MAT_IRON)
    # Front hitch loop
    add_box_mesh(bm, (0.0, 0.72, 0.26), (0.08, 0.08, 0.04), mat_index=MAT_IRON)
    # Rear hitch loop
    add_box_mesh(bm, (0.0, -0.72, 0.26), (0.08, 0.08, 0.04), mat_index=MAT_IRON)

    # Steel Cross-Axles
    axle_y = [-0.36, 0.36]
    for ay in axle_y:
        add_cylinder_mesh(bm, (0.0, ay, 0.19), radius=0.03, depth=0.82, segments=6,
                          rot=(0, math.pi / 2, 0), mat_index=MAT_STEEL)
        # Axle bearing pillow blocks
        add_box_mesh(bm, (-0.28, ay, 0.22), (0.10, 0.12, 0.07), mat_index=MAT_IRON)
        add_box_mesh(bm, (0.28, ay, 0.22), (0.10, 0.12, 0.07), mat_index=MAT_IRON)

    # 4 Flanged Wheels (track gauge width = 0.70m, wheels at x = +-0.35)
    for wx in [-0.35, 0.35]:
        for wy in axle_y:
            # Main wheel tread (diameter 0.36m, thickness 0.05m)
            add_cylinder_mesh(bm, (wx, wy, 0.19), radius=0.18, depth=0.05, segments=8,
                              rot=(0, math.pi / 2, 0), mat_index=MAT_STEEL)
            # Outer flange ridge (radius 0.21m, thickness 0.02m) - placed on the inner track side
            flange_x = wx - 0.028 if wx > 0 else wx + 0.028
            add_cylinder_mesh(bm, (flange_x, wy, 0.19), radius=0.21, depth=0.016, segments=8,
                              rot=(0, math.pi / 2, 0), mat_index=MAT_STEEL)
            # Wheel Hub Boss
            add_cylinder_mesh(bm, (wx, wy, 0.19), radius=0.065, depth=0.07, segments=6,
                              rot=(0, math.pi / 2, 0), mat_index=MAT_RIVET)

    # --- 2. Hopper Body (Flared Trapeze Box) ---
    # Bottom plate
    add_box_mesh(bm, (0.0, 0.0, 0.35), (0.68, 1.05, 0.05), mat_index=MAT_IRON)

    # Slanted sides: modeled with beveled plates or angled boxes
    # Left & right side plates (slanted outward)
    side_angle = 0.22  # ~12 degrees
    # Left side (X > 0)
    add_box_mesh(bm, (0.39, 0.0, 0.60), (0.04, 1.12, 0.48), rot=(0, side_angle, 0), mat_index=MAT_IRON)
    # Right side (X < 0)
    add_box_mesh(bm, (-0.39, 0.0, 0.60), (0.04, 1.12, 0.48), rot=(0, -side_angle, 0), mat_index=MAT_IRON)

    # Front & back end plates (slanted outward)
    end_angle = 0.20
    add_box_mesh(bm, (0.0, 0.58, 0.60), (0.82, 0.04, 0.48), rot=(-end_angle, 0, 0), mat_index=MAT_IRON)
    add_box_mesh(bm, (0.0, -0.58, 0.60), (0.82, 0.04, 0.48), rot=(end_angle, 0, 0), mat_index=MAT_IRON)

    # Top Rim Lip (heavy rectangular iron rim around top border)
    add_box_mesh(bm, (0.45, 0.0, 0.84), (0.05, 1.28, 0.04), mat_index=MAT_RIVET)
    add_box_mesh(bm, (-0.45, 0.0, 0.84), (0.05, 1.28, 0.04), mat_index=MAT_RIVET)
    add_box_mesh(bm, (0.0, 0.65, 0.84), (0.92, 0.05, 0.04), mat_index=MAT_RIVET)
    add_box_mesh(bm, (0.0, -0.65, 0.84), (0.92, 0.05, 0.04), mat_index=MAT_RIVET)

    # Corner bracket straps with rivets
    for cx in [-0.44, 0.44]:
        for cy in [-0.63, 0.63]:
            add_box_mesh(bm, (cx, cy, 0.60), (0.06, 0.06, 0.46), mat_index=MAT_RIVET)

    # Push Handles on front/back ends
    add_cylinder_mesh(bm, (0.0, 0.70, 0.78), radius=0.02, depth=0.48, segments=5,
                      rot=(0, math.pi / 2, 0), mat_index=MAT_IRON)
    add_cylinder_mesh(bm, (0.0, -0.70, 0.78), radius=0.02, depth=0.48, segments=5,
                      rot=(0, math.pi / 2, 0), mat_index=MAT_IRON)

    # --- 3. Ore Chunks (Ore Payload) ---
    ore_clusters = [
        ((0.0, 0.0, 0.72), (0.45, 0.55, 0.28), (0.1, 0.2, 0.05), MAT_ROCK),
        ((0.18, 0.22, 0.76), (0.24, 0.26, 0.22), (0.3, -0.2, 0.4), MAT_GOLD),
        ((-0.16, -0.25, 0.75), (0.22, 0.28, 0.20), (-0.2, 0.3, -0.1), MAT_GOLD),
        ((0.15, -0.20, 0.74), (0.22, 0.24, 0.18), (0.1, -0.4, 0.2), MAT_COPPER),
        ((-0.18, 0.24, 0.76), (0.24, 0.24, 0.20), (0.4, 0.2, -0.3), MAT_ROCK),
        ((0.0, 0.36, 0.72), (0.28, 0.22, 0.18), (-0.1, 0.1, 0.5), MAT_GOLD),
        ((0.0, -0.38, 0.71), (0.26, 0.22, 0.16), (0.2, -0.2, -0.4), MAT_COPPER),
        ((0.0, 0.0, 0.86), (0.22, 0.26, 0.18), (0.2, 0.1, 0.3), MAT_GOLD),
    ]
    for pos, sz, rot, mat_idx in ore_clusters:
        add_box_mesh(bm, pos, sz, rot=rot, mat_index=mat_idx)

    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    return me

def create_mine_rails_mesh(palette):
    me = bpy.data.meshes.new('MineRails')
    bm = bmesh.new()

    mats = [palette['wood_weathered'], palette['rail_steel'], palette['iron'], palette['iron_rivet']]
    for m in mats:
        me.materials.append(m)

    MAT_TIE = 0
    MAT_STEEL = 1
    MAT_IRON = 2
    MAT_SPIKE = 3

    # Segment length: 2.0m (-1.0 to +1.0 along Y)
    # Gauge width: 0.70m (rails at X = -0.35 and X = +0.35)

    # --- 1. Wooden Cross-Ties (4 ties spaced at 0.5m) ---
    tie_positions_y = [-0.75, -0.25, 0.25, 0.75]
    tie_rots = [0.015, -0.01, 0.02, -0.015]
    for i, ty in enumerate(tie_positions_y):
        add_box_mesh(bm, (0.0, ty, 0.045), (1.10, 0.19, 0.09), rot=(0, 0, tie_rots[i]), mat_index=MAT_TIE)

    # --- 2. Steel Rails (Narrow gauge T-profile) ---
    for rx in [-0.35, 0.35]:
        # Base flange (bottom plate)
        add_box_mesh(bm, (rx, 0.0, 0.095), (0.075, 2.0, 0.015), mat_index=MAT_STEEL)
        # Vertical web stem
        add_box_mesh(bm, (rx, 0.0, 0.135), (0.022, 2.0, 0.065), mat_index=MAT_STEEL)
        # Top head bulb (running surface)
        add_box_mesh(bm, (rx, 0.0, 0.175), (0.055, 2.0, 0.025), mat_index=MAT_STEEL)

    # --- 3. Tie Base Plates & Spikes (under each rail at each tie) ---
    for rx in [-0.35, 0.35]:
        for ty in tie_positions_y:
            # Tie plate
            add_box_mesh(bm, (rx, ty, 0.095), (0.11, 0.15, 0.012), mat_index=MAT_IRON)
            # Spikes on each side of the rail base
            add_box_mesh(bm, (rx - 0.042, ty - 0.04, 0.108), (0.02, 0.02, 0.02), mat_index=MAT_SPIKE)
            add_box_mesh(bm, (rx + 0.042, ty + 0.04, 0.108), (0.02, 0.02, 0.02), mat_index=MAT_SPIKE)

    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    return me

def create_mine_arch_mesh(palette):
    me = bpy.data.meshes.new('MineArch')
    bm = bmesh.new()

    mats = [palette['wood_dark'], palette['wood_light'], palette['wood_weathered'], palette['iron_rivet']]
    for m in mats:
        me.materials.append(m)

    MAT_TIMBER = 0
    MAT_CAP = 1
    MAT_WEDGE = 2
    MAT_PIN = 3

    # Total width ~2.4m, height 2.6m
    # Inside clearance ~1.6m width, 2.2m height

    # --- 1. Upright Timber Posts (battered inward slightly) ---
    post_tilt = 0.05  # ~3 degrees inward batter
    # Left post (X > 0)
    add_box_mesh(bm, (0.92, 0.0, 1.15), (0.22, 0.22, 2.30), rot=(0, -post_tilt, 0), mat_index=MAT_TIMBER)
    # Right post (X < 0)
    add_box_mesh(bm, (-0.92, 0.0, 1.15), (0.22, 0.22, 2.30), rot=(0, post_tilt, 0), mat_index=MAT_TIMBER)

    # Base sill mud-sills / anchor footing blocks
    add_box_mesh(bm, (0.98, 0.0, 0.06), (0.32, 0.34, 0.12), mat_index=MAT_TIMBER)
    add_box_mesh(bm, (-0.98, 0.0, 0.06), (0.32, 0.34, 0.12), mat_index=MAT_TIMBER)

    # --- 2. Horizontal Collar / Cap Beam ---
    # Sits on top of the posts at Z = 2.38
    add_box_mesh(bm, (0.0, 0.0, 2.38), (2.28, 0.24, 0.22), mat_index=MAT_CAP)

    # --- 3. Corner Knee Braces (45-degree corner gussets) ---
    brace_angle = math.pi / 4  # 45 deg
    # Left corner brace
    add_box_mesh(bm, (0.64, 0.0, 2.14), (0.14, 0.16, 0.48), rot=(0, brace_angle, 0), mat_index=MAT_TIMBER)
    # Right corner brace
    add_box_mesh(bm, (-0.64, 0.0, 2.14), (0.14, 0.16, 0.48), rot=(0, -brace_angle, 0), mat_index=MAT_TIMBER)

    # --- 4. Ceiling Wedge Chocks (driven between collar beam & rock ceiling) ---
    add_box_mesh(bm, (0.68, 0.0, 2.54), (0.22, 0.20, 0.12), rot=(0, -0.04, 0), mat_index=MAT_WEDGE)
    add_box_mesh(bm, (-0.68, 0.0, 2.54), (0.22, 0.20, 0.12), rot=(0, 0.04, 0), mat_index=MAT_WEDGE)
    add_box_mesh(bm, (0.0, 0.0, 2.53), (0.26, 0.18, 0.10), rot=(0, 0.02, 0), mat_index=MAT_WEDGE)

    # --- 5. Forged Iron Drift Pins / Bolts ---
    joint_pins = [
        (0.85, 0.13, 2.38), (0.85, -0.13, 2.38),
        (-0.85, 0.13, 2.38), (-0.85, -0.13, 2.38),
        (0.68, 0.10, 2.22), (-0.68, 0.10, 2.22),
    ]
    for px, py, pz in joint_pins:
        add_box_mesh(bm, (px, py, pz), (0.04, 0.04, 0.04), mat_index=MAT_PIN)

    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    return me

def create_wall_torch_mesh(palette):
    me = bpy.data.meshes.new('WallTorch')
    bm = bmesh.new()

    mats = [palette['iron'], palette['wood_weathered'], palette['torch_cloth'],
            palette['charcoal'], palette['flame_core'], palette['flame_mid']]
    for m in mats:
        me.materials.append(m)

    MAT_IRON = 0
    MAT_WOOD = 1
    MAT_CLOTH = 2
    MAT_CHARCOAL = 3
    MAT_CORE = 4
    MAT_MID = 5

    # Wall is at Y = -0.20. Torch projects outward towards +Y.

    # --- 1. Forged Iron Sconce Bracket ---
    # Diamond-shaped Wall Backplate
    add_box_mesh(bm, (0.0, -0.18, 0.0), (0.14, 0.02, 0.26), rot=(0, 0, 0), mat_index=MAT_IRON)
    # 4 Mounting spike studs
    add_box_mesh(bm, (0.0, -0.17, 0.09), (0.03, 0.02, 0.03), mat_index=MAT_IRON)
    add_box_mesh(bm, (0.0, -0.17, -0.09), (0.03, 0.02, 0.03), mat_index=MAT_IRON)

    # Sconce Arm extending outward and curving up
    add_box_mesh(bm, (0.0, -0.06, 0.0), (0.035, 0.24, 0.035), mat_index=MAT_IRON)
    add_box_mesh(bm, (0.0, 0.08, 0.06), (0.035, 0.035, 0.14), mat_index=MAT_IRON)
    # Lower scroll strut brace
    add_box_mesh(bm, (0.0, -0.04, -0.07), (0.025, 0.16, 0.025), rot=(0.5, 0, 0), mat_index=MAT_IRON)

    # Sconce Torch Basket Ring (8-sided ring collar holding torch)
    add_cylinder_mesh(bm, (0.0, 0.08, 0.14), radius=0.065, depth=0.06, segments=8, mat_index=MAT_IRON)

    # --- 2. Wooden Torch Pole ---
    # Angled slightly outward (~12 degrees from vertical)
    torch_angle = 0.20
    # Lower handle / stick
    add_cylinder_mesh(bm, (0.0, 0.07, 0.06), radius=0.035, depth=0.36, segments=7,
                      rot=(-torch_angle, 0, 0), mat_index=MAT_WOOD)
    # Upper stick inside cloth wrap
    add_cylinder_mesh(bm, (0.0, 0.12, 0.28), radius=0.036, depth=0.18, segments=7,
                      rot=(-torch_angle, 0, 0), mat_index=MAT_CHARCOAL)

    # --- 3. Wrapped Cloth / Burlap Bands ---
    add_cylinder_mesh(bm, (0.0, 0.115, 0.25), radius=0.052, depth=0.14, segments=8,
                      rot=(-torch_angle, 0, 0), mat_index=MAT_CLOTH)
    # Charred top rim
    add_cylinder_mesh(bm, (0.0, 0.13, 0.33), radius=0.054, depth=0.04, segments=8,
                      rot=(-torch_angle, 0, 0), mat_index=MAT_CHARCOAL)

    # --- 4. Low-Poly Stylized Emissive Flame ---
    # Flame tip center position: (0.0, 0.15, 0.44)
    # Mid flame layer (orange outer hull)
    flame_y = 0.145
    add_cylinder_mesh(bm, (0.0, flame_y, 0.40), radius=0.062, depth=0.14, segments=6,
                      rot=(-0.1, 0, 0), mat_index=MAT_MID)
    # Top licking flame tip
    add_cylinder_mesh(bm, (0.0, flame_y + 0.015, 0.49), radius=0.035, depth=0.12, segments=5,
                      rot=(0.15, 0, 0.2), mat_index=MAT_MID)

    # Inner bright yellow emissive core
    add_cylinder_mesh(bm, (0.0, flame_y, 0.39), radius=0.038, depth=0.10, segments=5,
                      rot=(-0.1, 0, 0), mat_index=MAT_CORE)

    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    return me

def create_mine_lantern_mesh(palette):
    me = bpy.data.meshes.new('MineLantern')
    bm = bmesh.new()

    mats = [palette['brass'], palette['iron'], palette['glass'],
            palette['flame_core'], palette['iron_rivet']]
    for m in mats:
        me.materials.append(m)

    MAT_BRASS = 0
    MAT_IRON = 1
    MAT_GLASS = 2
    MAT_FLAME = 3
    MAT_RIVET = 4

    # --- 1. Base Fuel Reservoir Tank ---
    # Bottom rim plate
    add_cylinder_mesh(bm, (0.0, 0.0, 0.02), radius=0.125, depth=0.04, segments=8, mat_index=MAT_BRASS)
    # Slanted font tank wall
    add_cylinder_mesh(bm, (0.0, 0.0, 0.07), radius=0.105, depth=0.07, segments=8, mat_index=MAT_BRASS)
    # Upper fuel tank shoulder
    add_cylinder_mesh(bm, (0.0, 0.0, 0.11), radius=0.075, depth=0.02, segments=8, mat_index=MAT_BRASS)
    # Brass filler cap plug
    add_cylinder_mesh(bm, (0.06, 0.04, 0.12), radius=0.022, depth=0.025, segments=5, mat_index=MAT_RIVET)
    # Burner collar
    add_cylinder_mesh(bm, (0.0, 0.0, 0.13), radius=0.052, depth=0.025, segments=6, mat_index=MAT_IRON)

    # --- 2. Glass Chimney & Flame ---
    # Glass cylinder (translucent)
    add_cylinder_mesh(bm, (0.0, 0.0, 0.23), radius=0.056, depth=0.18, segments=8, mat_index=MAT_GLASS)
    # Inner glowing flame wick
    add_cylinder_mesh(bm, (0.0, 0.0, 0.18), radius=0.016, depth=0.06, segments=4, mat_index=MAT_FLAME)

    # --- 3. Protective Wire Cage (4 vertical wire struts + mid ring) ---
    # 4 Wire corner struts around the glass
    wire_r = 0.068
    for i in range(4):
        ang = i * (math.pi / 2) + (math.pi / 4)
        wx = math.cos(ang) * wire_r
        wy = math.sin(ang) * wire_r
        add_cylinder_mesh(bm, (wx, wy, 0.23), radius=0.007, depth=0.20, segments=4, mat_index=MAT_IRON)

    # Mid wire guard ring
    add_cylinder_mesh(bm, (0.0, 0.0, 0.23), radius=0.070, depth=0.012, segments=8, mat_index=MAT_IRON)

    # --- 4. Flue Hood & Cap (Pierced Smoke Dome) ---
    # Lower chimney crown / cap seat
    add_cylinder_mesh(bm, (0.0, 0.0, 0.33), radius=0.065, depth=0.03, segments=8, mat_index=MAT_BRASS)
    # Tapered smoke flue cone
    add_cylinder_mesh(bm, (0.0, 0.0, 0.37), radius=0.052, depth=0.06, segments=7, mat_index=MAT_BRASS)
    # Heat-vent slits ring
    add_cylinder_mesh(bm, (0.0, 0.0, 0.40), radius=0.058, depth=0.02, segments=7, mat_index=MAT_IRON)
    # Top rain mushroom cap
    add_cylinder_mesh(bm, (0.0, 0.0, 0.42), radius=0.075, depth=0.025, segments=8, mat_index=MAT_BRASS)
    # Center brass finial ring
    add_cylinder_mesh(bm, (0.0, 0.0, 0.445), radius=0.025, depth=0.025, segments=5, mat_index=MAT_BRASS)

    # --- 5. Bail Swing Handle (Arched Wire) ---
    # Side pivot ear lugs
    add_box_mesh(bm, (0.082, 0.0, 0.33), (0.018, 0.025, 0.03), mat_index=MAT_IRON)
    add_box_mesh(bm, (-0.082, 0.0, 0.33), (0.018, 0.025, 0.03), mat_index=MAT_IRON)
    # Left & right handle arms
    add_box_mesh(bm, (0.09, 0.0, 0.42), (0.008, 0.012, 0.18), mat_index=MAT_IRON)
    add_box_mesh(bm, (-0.09, 0.0, 0.42), (0.008, 0.012, 0.18), mat_index=MAT_IRON)
    # Top horizontal grip bar
    add_cylinder_mesh(bm, (0.0, 0.0, 0.51), radius=0.008, depth=0.18, segments=6,
                      rot=(0, math.pi / 2, 0), mat_index=MAT_IRON)

    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    return me

def build_and_export_all():
    props = [
        ('mine_cart', create_mine_cart_mesh),
        ('mine_rails', create_mine_rails_mesh),
        ('mine_arch', create_mine_arch_mesh),
        ('wall_torch', create_wall_torch_mesh),
        ('mine_lantern', create_mine_lantern_mesh),
    ]

    for name, builder in props:
        clear_scene()
        palette = init_palette()
        mesh = builder(palette)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)

        tri_count = sum(len(p.vertices) - 2 for p in mesh.polygons)
        print(f"Generated {name}: {tri_count} triangles")

        # Save .blend file
        blend_path = os.path.join(BLEND_DIR, f"{name}.blend")
        bpy.ops.wm.save_as_mainfile(filepath=blend_path)
        print(f"Saved {blend_path}")

        # Export .glb
        glb_path = os.path.join(PUBLIC_MODELS, f"{name}.glb")
        bpy.ops.export_scene.gltf(
            filepath=glb_path,
            export_format='GLB',
            use_selection=True,
            export_apply=True,
            export_yup=True
        )
        file_sz = os.path.getsize(glb_path)
        print(f"Exported {glb_path} ({file_sz / 1024:.1f} KB, {tri_count} tris)")

if __name__ == '__main__':
    build_and_export_all()
