"""
Procedural generator for Red West Frontier Town Buildings Set (Lane: art)
Generates 5 stylized Western town buildings matching Lantern Rock specifications:
  1. saloon.glb   - Iconic 2-story Western Saloon with veranda balcony, batwing doors, false front & chimney
  2. bank.glb     - Classical stone masonry Bank with columns, pediment & side vault annex
  3. sheriff.glb  - Sheriff's Office with timber porch, hitching rail, false front & 5-point brass star
  4. jail.glb     - Heavy stone lockup fortress with corner quoins, barred windows & watchtower
  5. gunsmith.glb - Weaponsmith workshop with side forge chimney, display window & overhead rifle sign

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

def get_material(name, base_color, roughness=0.75, metallic=0.0, emission_color=(0, 0, 0, 1), emission_strength=0.0, alpha=1.0):
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
        'brick_red': get_material('BrickRed', (0.48, 0.23, 0.16, 1.0), roughness=0.88),
        'brick_dark': get_material('BrickDark', (0.36, 0.17, 0.12, 1.0), roughness=0.90),
        'stone_light': get_material('StoneLight', (0.68, 0.64, 0.58, 1.0), roughness=0.85),
        'stone_dark': get_material('StoneDark', (0.42, 0.39, 0.35, 1.0), roughness=0.92),
        'wood_siding': get_material('WoodSiding', (0.42, 0.30, 0.19, 1.0), roughness=0.82),
        'wood_dark': get_material('WoodDark', (0.26, 0.18, 0.11, 1.0), roughness=0.85),
        'wood_trim': get_material('WoodTrim', (0.20, 0.14, 0.09, 1.0), roughness=0.80),
        'wood_porch': get_material('WoodPorch', (0.46, 0.34, 0.22, 1.0), roughness=0.85),
        'roof_slate': get_material('RoofSlate', (0.22, 0.26, 0.28, 1.0), roughness=0.80),
        'iron': get_material('IronDark', (0.17, 0.18, 0.20, 1.0), roughness=0.50, metallic=0.75),
        'brass': get_material('BrassGold', (0.78, 0.62, 0.22, 1.0), roughness=0.35, metallic=0.70),
        'glass_lit': get_material('GlassLit', (1.0, 0.85, 0.48, 1.0), roughness=0.25,
                                  emission_color=(1.0, 0.85, 0.48, 1.0), emission_strength=2.2),
        'sign_bg': get_material('SignBg', (0.18, 0.12, 0.08, 1.0), roughness=0.75),
        'sign_text': get_material('SignGold', (0.92, 0.80, 0.35, 1.0), roughness=0.30, metallic=0.60),
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

# ===========================================================================
# 1. SALOON (The 2-Story Western Saloon)
# ===========================================================================
def create_saloon_mesh(palette):
    me = bpy.data.meshes.new('Saloon')
    bm = bmesh.new()

    mats = [palette['brick_red'], palette['brick_dark'], palette['stone_dark'],
            palette['wood_dark'], palette['wood_porch'], palette['wood_trim'],
            palette['glass_lit'], palette['iron'], palette['brass'], palette['roof_slate']]
    for m in mats:
        me.materials.append(m)

    M_BRICK = 0
    M_BRICK_DARK = 1
    M_STONE = 2
    M_WOOD_DARK = 3
    M_PORCH = 4
    M_TRIM = 5
    M_WINDOW = 6
    M_IRON = 7
    M_BRASS = 8
    M_ROOF = 9

    # Dimensions: 10.0w x 7.2d x 10.5h
    # Front is facing -Y

    # --- 1. Foundation & Steps ---
    add_box_mesh(bm, (0.0, 0.0, 0.20), (10.4, 7.4, 0.40), mat_index=M_STONE)
    # Front Boardwalk / Porch Deck: 10.0w x 2.4d x 0.35h at Y = -4.4
    add_box_mesh(bm, (0.0, -4.4, 0.20), (10.4, 2.4, 0.40), mat_index=M_PORCH)
    # Entrance Steps at Y = -5.8
    add_box_mesh(bm, (0.0, -5.8, 0.10), (3.6, 0.8, 0.20), mat_index=M_PORCH)

    # --- 2. Main Building Core (2 Stories) ---
    # Lower floor body: 10.0w x 6.8d x 4.4h
    add_box_mesh(bm, (0.0, 0.0, 2.50), (10.0, 6.8, 4.20), mat_index=M_BRICK)
    # Upper floor body: 10.0w x 6.8d x 4.2h
    add_box_mesh(bm, (0.0, 0.0, 6.70), (10.0, 6.8, 4.20), mat_index=M_BRICK)

    # --- 3. False Front Parapet & Decorative Cornice ---
    # Extended front facade: 10.2w x 0.4d x 2.2h at Z = 9.8, Y = -3.5
    add_box_mesh(bm, (0.0, -3.5, 9.70), (10.2, 0.4, 2.20), mat_index=M_BRICK_DARK)
    # Stepped upper pediment crown
    add_box_mesh(bm, (0.0, -3.5, 11.0), (6.4, 0.5, 0.60), mat_index=M_TRIM)
    add_box_mesh(bm, (0.0, -3.5, 11.45), (3.2, 0.55, 0.45), mat_index=M_BRASS)
    # Cornice dental trim
    add_box_mesh(bm, (0.0, -3.55, 10.7), (10.4, 0.5, 0.25), mat_index=M_TRIM)

    # --- 4. Veranda Balcony (2nd Floor Porch) ---
    # Balcony Floor: 10.0w x 2.2d x 0.25h at Z = 4.6, Y = -4.5
    add_box_mesh(bm, (0.0, -4.5, 4.55), (10.2, 2.4, 0.25), mat_index=M_WOOD_DARK)
    # 4 Porch Support Posts (extending from ground to balcony): X = -4.6, -1.6, 1.6, 4.6, Y = -5.5
    for px in [-4.6, -1.6, 1.6, 4.6]:
        add_box_mesh(bm, (px, -5.5, 2.35), (0.28, 0.28, 4.30), mat_index=M_WOOD_DARK)
        # Decorative bracket capital
        add_box_mesh(bm, (px, -5.5, 4.35), (0.42, 0.42, 0.22), mat_index=M_TRIM)

    # Balcony Railing: Front handrail + posts
    add_box_mesh(bm, (0.0, -5.6, 5.35), (10.2, 0.12, 0.12), mat_index=M_TRIM)
    # Balcony side rails
    add_box_mesh(bm, (-5.0, -4.5, 5.35), (0.12, 2.2, 0.12), mat_index=M_TRIM)
    add_box_mesh(bm, (5.0, -4.5, 5.35), (0.12, 2.2, 0.12), mat_index=M_TRIM)
    # Vertical balusters
    for bx in [-4.6, -3.2, -1.6, 0.0, 1.6, 3.2, 4.6]:
        add_box_mesh(bm, (bx, -5.6, 4.95), (0.14, 0.14, 0.70), mat_index=M_TRIM)

    # --- 5. Doors & Windows ---
    # Batwing Saloon Doors (Ground Floor Center): 2.4w x 2.6h at Y = -3.42, Z = 1.65
    add_box_mesh(bm, (0.0, -3.42, 1.65), (2.4, 0.15, 2.7), mat_index=M_WOOD_DARK)
    # Batwing louvers
    add_box_mesh(bm, (-0.65, -3.46, 1.65), (1.05, 0.08, 1.8), mat_index=M_PORCH)
    add_box_mesh(bm, (0.65, -3.46, 1.65), (1.05, 0.08, 1.8), mat_index=M_PORCH)
    # Door frame trim
    add_box_mesh(bm, (0.0, -3.45, 3.05), (2.7, 0.18, 0.20), mat_index=M_TRIM)

    # Ground floor large bay windows (flanking doors)
    for wx in [-3.2, 3.2]:
        add_box_mesh(bm, (wx, -3.42, 2.2), (2.2, 0.12, 1.8), mat_index=M_WINDOW)
        # Window frames
        add_box_mesh(bm, (wx, -3.45, 2.2), (2.35, 0.16, 0.10), mat_index=M_TRIM)
        add_box_mesh(bm, (wx, -3.45, 2.2), (0.10, 0.16, 1.9), mat_index=M_TRIM)
        add_box_mesh(bm, (wx, -3.46, 1.25), (2.4, 0.24, 0.12), mat_index=M_TRIM)

    # Upper floor windows (4 windows opening onto balcony)
    for wx in [-3.6, -1.2, 1.2, 3.6]:
        add_box_mesh(bm, (wx, -3.42, 6.8), (1.4, 0.12, 1.8), mat_index=M_WINDOW)
        add_box_mesh(bm, (wx, -3.45, 6.8), (1.55, 0.16, 0.10), mat_index=M_TRIM)
        add_box_mesh(bm, (wx, -3.46, 5.85), (1.6, 0.22, 0.12), mat_index=M_TRIM)

    # Entrance lanterns on posts
    for lx in [-1.5, 1.5]:
        add_cylinder_mesh(bm, (lx, -3.6, 2.5), radius=0.16, depth=0.35, segments=6, mat_index=M_BRASS)
        add_cylinder_mesh(bm, (lx, -3.6, 2.5), radius=0.12, depth=0.25, segments=5, mat_index=M_WINDOW)

    # --- 6. Sign Board ---
    # "SALOON" sign board: 5.8w x 0.18d x 1.2h at Z = 9.3, Y = -3.75
    add_box_mesh(bm, (0.0, -3.75, 9.3), (5.8, 0.18, 1.20), mat_index=M_WOOD_DARK)
    add_box_mesh(bm, (0.0, -3.80, 9.3), (5.5, 0.10, 0.95), mat_index=M_BRASS)

    # --- 7. Chimney ---
    add_box_mesh(bm, (-3.8, 2.2, 8.8), (1.2, 1.2, 5.2), mat_index=M_BRICK_DARK)
    add_box_mesh(bm, (-3.8, 2.2, 11.45), (1.4, 1.4, 0.25), mat_index=M_STONE)
    add_cylinder_mesh(bm, (-3.8, 2.2, 11.8), radius=0.32, depth=0.5, segments=8, mat_index=M_IRON)

    # Roof behind false front
    add_box_mesh(bm, (0.0, 0.4, 8.8), (9.8, 6.2, 0.3), mat_index=M_ROOF)

    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    return me

# ===========================================================================
# 2. BANK (Frontier Classical Stone Bank)
# ===========================================================================
def create_bank_mesh(palette):
    me = bpy.data.meshes.new('Bank')
    bm = bmesh.new()

    mats = [palette['stone_light'], palette['stone_dark'], palette['brass'],
            palette['iron'], palette['glass_lit'], palette['roof_slate'], palette['wood_trim']]
    for m in mats:
        me.materials.append(m)

    M_STONE = 0
    M_STONE_DARK = 1
    M_BRASS = 2
    M_IRON = 3
    M_WINDOW = 4
    M_ROOF = 5
    M_TRIM = 6

    # Dimensions: 7.8w x 6.8d x 8.5h

    # --- 1. Foundation & Steps ---
    add_box_mesh(bm, (0.0, 0.0, 0.20), (7.8, 6.8, 0.40), mat_index=M_STONE_DARK)
    # Broad Stone Entrance Steps: 4.8w x 1.8d x 0.25h at Y = -3.8
    add_box_mesh(bm, (0.0, -3.8, 0.12), (4.8, 1.8, 0.25), mat_index=M_STONE)
    add_box_mesh(bm, (0.0, -4.4, 0.06), (5.2, 0.8, 0.12), mat_index=M_STONE_DARK)

    # --- 2. Main Stone Structure ---
    # Solid chiseled ashlar stone block walls: 7.2w x 6.2d x 5.8h
    add_box_mesh(bm, (0.0, 0.0, 3.20), (7.2, 6.2, 5.60), mat_index=M_STONE)

    # Corner stone pilasters / quoins
    for cx in [-3.5, 3.5]:
        for cy in [-3.0, 3.0]:
            add_box_mesh(bm, (cx, cy, 3.20), (0.45, 0.45, 5.80), mat_index=M_STONE_DARK)

    # --- 3. Classical Portico (4 Columns & Pediment) ---
    # 4 Classical Columns at front (Y = -3.4): X = -2.6, -0.88, 0.88, 2.6
    for col_x in [-2.6, -0.88, 0.88, 2.6]:
        # Square plinth base
        add_box_mesh(bm, (col_x, -3.4, 0.45), (0.65, 0.65, 0.35), mat_index=M_BRASS)
        # Column shaft (octagonal fluted cylinder)
        add_cylinder_mesh(bm, (col_x, -3.4, 2.75), radius=0.25, depth=4.30, segments=8, mat_index=M_STONE)
        # Ornate capital molding
        add_box_mesh(bm, (col_x, -3.4, 4.95), (0.65, 0.65, 0.30), mat_index=M_BRASS)

    # Portico Entablature / Lintel Beam: 7.4w x 1.0d x 0.8h at Z = 5.5, Y = -3.3
    add_box_mesh(bm, (0.0, -3.3, 5.45), (7.4, 1.1, 0.70), mat_index=M_STONE)
    # Triangular Classical Pediment
    v_top = (0.0, -3.3, 7.4)
    v_left = (-3.7, -3.3, 5.8)
    v_right = (3.7, -3.3, 5.8)
    # Modeled as a wedge / beveled box
    add_box_mesh(bm, (0.0, -3.3, 6.4), (5.4, 0.8, 1.2), rot=(0, 0, 0), mat_index=M_STONE_DARK)
    add_box_mesh(bm, (0.0, -3.3, 7.0), (3.2, 0.8, 0.8), rot=(0, 0, 0), mat_index=M_STONE)
    add_box_mesh(bm, (0.0, -3.3, 7.4), (1.4, 0.8, 0.5), rot=(0, 0, 0), mat_index=M_BRASS)

    # Top Roof Parapet Balustrade
    add_box_mesh(bm, (0.0, 0.0, 6.20), (7.4, 6.4, 0.40), mat_index=M_STONE_DARK)
    add_box_mesh(bm, (0.0, 0.0, 6.55), (7.6, 6.6, 0.25), mat_index=M_STONE)

    # --- 4. Entrance & Vault Doors ---
    # Heavy Iron Double Doors: 1.8w x 2.8h at Y = -3.12, Z = 1.6
    add_box_mesh(bm, (0.0, -3.12, 1.60), (1.8, 0.16, 2.8), mat_index=M_IRON)
    # Brass door kickplates and handles
    add_box_mesh(bm, (0.0, -3.18, 0.45), (1.7, 0.08, 0.40), mat_index=M_BRASS)
    add_cylinder_mesh(bm, (-0.2, -3.22, 1.5), radius=0.04, depth=0.25, segments=6, mat_index=M_BRASS)
    add_cylinder_mesh(bm, (0.2, -3.22, 1.5), radius=0.04, depth=0.25, segments=6, mat_index=M_BRASS)

    # Windows with iron security grates
    for wx in [-1.8, 1.8]:
        add_box_mesh(bm, (wx, -3.12, 2.5), (0.9, 0.12, 1.6), mat_index=M_WINDOW)
        # Security bars
        for bar_offset in [-0.25, 0.0, 0.25]:
            add_cylinder_mesh(bm, (wx + bar_offset, -3.18, 2.5), radius=0.025, depth=1.6, segments=5, mat_index=M_IRON)

    # --- 5. Side Vault Annex (Reinforced Wing) ---
    # Vault annex: 3.2w x 4.2d x 3.6h on right side (X = 4.6, Y = 0.5)
    add_box_mesh(bm, (4.6, 0.5, 2.0), (2.8, 4.4, 3.8), mat_index=M_STONE_DARK)
    # Reinforced Iron Vault Door on Annex Front: Y = -1.65
    add_box_mesh(bm, (4.6, -1.65, 1.8), (1.6, 0.20, 2.0), mat_index=M_IRON)
    # Massive Brass Vault Combination Wheel
    add_cylinder_mesh(bm, (4.6, -1.78, 1.8), radius=0.38, depth=0.10, segments=12,
                      rot=(math.pi / 2, 0, 0), mat_index=M_BRASS)
    add_cylinder_mesh(bm, (4.6, -1.82, 1.8), radius=0.10, depth=0.12, segments=8,
                      rot=(math.pi / 2, 0, 0), mat_index=M_IRON)
    # 4 Vault spokes
    for ang in [0, math.pi / 4, math.pi / 2, 3 * math.pi / 4]:
        add_box_mesh(bm, (4.6, -1.80, 1.8), (0.80, 0.04, 0.06), rot=(0, 0, ang), mat_index=M_BRASS)

    # --- 6. Bank Sign & Lamps ---
    # "BANK" carved sign plaque: 3.4w x 0.15d x 0.8h at Z = 5.4, Y = -3.85
    add_box_mesh(bm, (0.0, -3.85, 5.45), (3.4, 0.12, 0.80), mat_index=M_STONE_DARK)
    add_box_mesh(bm, (0.0, -3.90, 5.45), (3.1, 0.08, 0.65), mat_index=M_BRASS)

    # Carriage lamps flanking portico
    for lx in [-3.2, 3.2]:
        add_cylinder_mesh(bm, (lx, -3.4, 2.4), radius=0.14, depth=0.32, segments=6, mat_index=M_BRASS)
        add_cylinder_mesh(bm, (lx, -3.4, 2.4), radius=0.10, depth=0.22, segments=5, mat_index=M_WINDOW)

    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    return me

# ===========================================================================
# 3. SHERIFF'S OFFICE (Frontier Law Office & Porch)
# ===========================================================================
def create_sheriff_mesh(palette):
    me = bpy.data.meshes.new('Sheriff')
    bm = bmesh.new()

    mats = [palette['wood_siding'], palette['wood_dark'], palette['wood_trim'],
            palette['wood_porch'], palette['stone_dark'], palette['brass'],
            palette['iron'], palette['glass_lit'], palette['roof_slate']]
    for m in mats:
        me.materials.append(m)

    M_WOOD = 0
    M_WOOD_DARK = 1
    M_TRIM = 2
    M_PORCH = 3
    M_STONE = 4
    M_BRASS = 5
    M_IRON = 6
    M_WINDOW = 7
    M_ROOF = 8

    # Dimensions: 7.2w x 6.2d x 7.6h

    # --- 1. Foundation & Porch Deck ---
    add_box_mesh(bm, (0.0, 0.0, 0.18), (7.4, 6.4, 0.36), mat_index=M_STONE)
    # Front Porch Boardwalk: 7.2w x 2.4d x 0.32h at Y = -3.9
    add_box_mesh(bm, (0.0, -3.9, 0.18), (7.4, 2.4, 0.36), mat_index=M_PORCH)
    # Porch step
    add_box_mesh(bm, (0.0, -5.3, 0.09), (3.2, 0.7, 0.18), mat_index=M_PORCH)

    # --- 2. Main Timber Walls ---
    add_box_mesh(bm, (0.0, 0.0, 2.70), (7.0, 5.8, 4.80), mat_index=M_WOOD)

    # Corner post trims
    for cx in [-3.4, 3.4]:
        for cy in [-2.8, 2.8]:
            add_box_mesh(bm, (cx, cy, 2.70), (0.32, 0.32, 4.80), mat_index=M_TRIM)

    # --- 3. False Front Parapet & Cornice ---
    # Tall false front at front (Y = -2.9): 7.2w x 0.35d x 2.2h at Z = 6.2
    add_box_mesh(bm, (0.0, -2.9, 6.20), (7.2, 0.35, 2.20), mat_index=M_WOOD_DARK)
    # Stepped pediment cap
    add_box_mesh(bm, (0.0, -2.9, 7.45), (4.8, 0.45, 0.45), mat_index=M_TRIM)
    add_box_mesh(bm, (0.0, -2.9, 7.80), (2.2, 0.50, 0.30), mat_index=M_BRASS)

    # --- 4. Porch Awning, Posts & Hitching Rail ---
    # 3 Porch Posts at Y = -4.9: X = -3.2, 0.0, 3.2
    for px in [-3.2, 0.0, 3.2]:
        add_box_mesh(bm, (px, -4.9, 1.85), (0.24, 0.24, 3.40), mat_index=M_WOOD_DARK)
    # Porch Lintel Beam
    add_box_mesh(bm, (0.0, -4.9, 3.45), (7.2, 0.28, 0.26), mat_index=M_TRIM)
    # Porch Awning Roof (sloped shingles)
    add_box_mesh(bm, (0.0, -3.9, 3.65), (7.4, 2.4, 0.22), rot=(math.radians(-8), 0, 0), mat_index=M_ROOF)

    # Hitching Rail in front of porch (Y = -5.6)
    add_cylinder_mesh(bm, (0.0, -5.6, 0.95), radius=0.06, depth=4.2, segments=6,
                      rot=(0, math.pi / 2, 0), mat_index=M_WOOD_DARK)
    add_cylinder_mesh(bm, (-1.8, -5.6, 0.48), radius=0.08, depth=0.95, segments=6, mat_index=M_WOOD_DARK)
    add_cylinder_mesh(bm, (1.8, -5.6, 0.48), radius=0.08, depth=0.95, segments=6, mat_index=M_WOOD_DARK)

    # --- 5. Door & Lockup Windows ---
    # Entrance door: 1.6w x 2.8h at Y = -2.85, Z = 1.6
    add_box_mesh(bm, (0.0, -2.85, 1.60), (1.6, 0.15, 2.80), mat_index=M_WOOD_DARK)
    # Brass doorknob
    add_cylinder_mesh(bm, (0.6, -2.95, 1.5), radius=0.04, depth=0.10, segments=6,
                      rot=(math.pi / 2, 0, 0), mat_index=M_BRASS)

    # Windows (flanking door) with iron bars
    for wx in [-2.2, 2.2]:
        add_box_mesh(bm, (wx, -2.85, 2.2), (1.2, 0.12, 1.4), mat_index=M_WINDOW)
        add_box_mesh(bm, (wx, -2.90, 1.45), (1.4, 0.22, 0.12), mat_index=M_TRIM)
        for bx in [-0.3, 0.0, 0.3]:
            add_cylinder_mesh(bm, (wx + bx, -2.92, 2.2), radius=0.022, depth=1.4, segments=5, mat_index=M_IRON)

    # Entrance lantern
    add_cylinder_mesh(bm, (-1.1, -2.95, 2.4), radius=0.13, depth=0.30, segments=6, mat_index=M_BRASS)
    add_cylinder_mesh(bm, (-1.1, -2.95, 2.4), radius=0.09, depth=0.20, segments=5, mat_index=M_WINDOW)

    # --- 6. Sheriff's 5-Point Brass Star & Sign ---
    # Large 5-Point Brass Star on Upper Facade: Z = 6.4, Y = -3.12
    # Modeled as a 5-sided extruded star boss
    add_cylinder_mesh(bm, (0.0, -3.12, 6.4), radius=0.62, depth=0.14, segments=5,
                      rot=(math.pi / 2, 0, 0), mat_index=M_BRASS)
    add_cylinder_mesh(bm, (0.0, -3.20, 6.4), radius=0.22, depth=0.08, segments=8,
                      rot=(math.pi / 2, 0, 0), mat_index=M_IRON)

    # "SHERIFF" sign board: 4.6w x 0.15d x 0.9h at Z = 4.8, Y = -3.12
    add_box_mesh(bm, (0.0, -3.12, 4.8), (4.6, 0.14, 0.85), mat_index=M_WOOD_DARK)
    add_box_mesh(bm, (0.0, -3.16, 4.8), (4.2, 0.08, 0.70), mat_index=M_BRASS)

    # Roof behind false front
    add_box_mesh(bm, (0.0, 0.2, 5.2), (6.8, 5.4, 0.25), mat_index=M_ROOF)

    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    return me

# ===========================================================================
# 4. JAIL (Heavy Stone Frontier Fortress Lockup)
# ===========================================================================
def create_jail_mesh(palette):
    me = bpy.data.meshes.new('Jail')
    bm = bmesh.new()

    mats = [palette['stone_dark'], palette['stone_light'], palette['iron'],
            palette['glass_lit'], palette['roof_slate'], palette['brass']]
    for m in mats:
        me.materials.append(m)

    M_STONE_DARK = 0
    M_STONE_LIGHT = 1
    M_IRON = 2
    M_WINDOW = 3
    M_ROOF = 4
    M_BRASS = 5

    # Dimensions: 8.2w x 7.2d x 8.0h

    # --- 1. Foundation Base ---
    add_box_mesh(bm, (0.0, 0.0, 0.22), (8.4, 7.4, 0.44), mat_index=M_STONE_DARK)
    # Heavy stone threshold step
    add_box_mesh(bm, (0.0, -3.8, 0.15), (2.8, 0.8, 0.30), mat_index=M_STONE_DARK)

    # --- 2. Main Stone Fortress Body ---
    add_box_mesh(bm, (0.0, 0.0, 2.90), (8.0, 7.0, 5.20), mat_index=M_STONE_LIGHT)

    # Heavy corner stone quoins (alternating staggered stone blocks on all 4 corners)
    for qx in [-3.9, 3.9]:
        for qy in [-3.4, 3.4]:
            add_box_mesh(bm, (qx, qy, 2.90), (0.60, 0.60, 5.20), mat_index=M_STONE_DARK)

    # Top stone parapet ledge: 8.4w x 7.4d x 0.5h at Z = 5.6
    add_box_mesh(bm, (0.0, 0.0, 5.65), (8.4, 7.4, 0.45), mat_index=M_STONE_DARK)

    # --- 3. Iron Cell Door ---
    # Heavy reinforced iron door with viewing slot: 1.8w x 2.8h at Y = -3.55, Z = 1.6
    add_box_mesh(bm, (0.0, -3.55, 1.60), (1.8, 0.20, 2.80), mat_index=M_IRON)
    # Heavy iron cross-rivet straps
    add_box_mesh(bm, (0.0, -3.62, 0.8), (1.7, 0.08, 0.18), mat_index=M_IRON)
    add_box_mesh(bm, (0.0, -3.62, 1.6), (1.7, 0.08, 0.18), mat_index=M_IRON)
    add_box_mesh(bm, (0.0, -3.62, 2.4), (1.7, 0.08, 0.18), mat_index=M_IRON)
    # Inspection peek hatch (barred slot)
    add_box_mesh(bm, (0.0, -3.65, 2.1), (0.45, 0.06, 0.25), mat_index=M_STONE_DARK)

    # Heavy stone door arch lintel
    add_box_mesh(bm, (0.0, -3.60, 3.15), (2.2, 0.30, 0.35), mat_index=M_STONE_DARK)

    # --- 4. Barred Cell Windows ---
    for wx in [-2.6, 2.6]:
        add_box_mesh(bm, (wx, -3.52, 2.8), (1.2, 0.16, 1.4), mat_index=M_WINDOW)
        # Heavy stone sill and lintel
        add_box_mesh(bm, (wx, -3.60, 2.05), (1.4, 0.30, 0.16), mat_index=M_STONE_DARK)
        add_box_mesh(bm, (wx, -3.60, 3.55), (1.4, 0.30, 0.16), mat_index=M_STONE_DARK)
        # Thick iron bars
        for bx in [-0.35, 0.0, 0.35]:
            add_cylinder_mesh(bm, (wx + bx, -3.60, 2.8), radius=0.04, depth=1.4, segments=6, mat_index=M_IRON)

    # --- 5. Side Cell Block Wing ---
    # Cell wing on left side (X = -4.8, Y = 0.5): 2.4w x 5.0d x 3.6h
    add_box_mesh(bm, (-4.8, 0.5, 2.0), (2.2, 5.0, 3.6), mat_index=M_STONE_DARK)
    # Cell wing barred window
    add_box_mesh(bm, (-5.95, 0.5, 2.4), (0.16, 1.2, 1.0), mat_index=M_WINDOW)
    for by in [0.2, 0.5, 0.8]:
        add_cylinder_mesh(bm, (-6.0, by, 2.4), radius=0.035, depth=1.0, segments=5, mat_index=M_IRON)

    # --- 6. Watchtower Observation Cupola ---
    # Square stone watchtower at right back (X = 3.0, Y = 2.4): 2.2w x 2.2d x 3.2h at Z = 7.0
    add_box_mesh(bm, (3.0, 2.4, 6.8), (2.2, 2.2, 2.8), mat_index=M_STONE_DARK)
    # Watchtower timber platform & roof
    add_box_mesh(bm, (3.0, 2.4, 8.2), (2.6, 2.6, 0.25), mat_index=M_STONE_LIGHT)
    add_box_mesh(bm, (3.0, 2.4, 9.2), (2.8, 2.8, 0.35), mat_index=M_ROOF)
    # Watchtower beacon light
    add_cylinder_mesh(bm, (3.0, 2.4, 8.6), radius=0.40, depth=0.6, segments=8, mat_index=M_WINDOW)

    # --- 7. Entrance Lantern & Sign ---
    # Entrance iron bracket lantern
    add_cylinder_mesh(bm, (1.3, -3.65, 2.5), radius=0.15, depth=0.35, segments=6, mat_index=M_IRON)
    add_cylinder_mesh(bm, (1.3, -3.65, 2.5), radius=0.10, depth=0.25, segments=5, mat_index=M_WINDOW)

    # "JAIL" iron sign plaque: 3.2w x 0.15d x 0.8h at Z = 4.4, Y = -3.65
    add_box_mesh(bm, (0.0, -3.65, 4.4), (3.2, 0.12, 0.80), mat_index=M_STONE_DARK)
    add_box_mesh(bm, (0.0, -3.70, 4.4), (2.8, 0.08, 0.65), mat_index=M_IRON)

    # Main roof
    add_box_mesh(bm, (0.0, 0.0, 6.0), (7.8, 6.8, 0.3), mat_index=M_ROOF)

    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    return me

# ===========================================================================
# 5. GUNSMITH (Weaponsmith & Forge Workshop)
# ===========================================================================
def create_gunsmith_mesh(palette):
    me = bpy.data.meshes.new('Gunsmith')
    bm = bmesh.new()

    mats = [palette['wood_dark'], palette['wood_siding'], palette['brick_dark'],
            palette['stone_dark'], palette['iron'], palette['brass'],
            palette['glass_lit'], palette['roof_slate'], palette['wood_trim']]
    for m in mats:
        me.materials.append(m)

    M_WOOD_DARK = 0
    M_WOOD = 1
    M_BRICK = 2
    M_STONE = 3
    M_IRON = 4
    M_BRASS = 5
    M_WINDOW = 6
    M_ROOF = 7
    M_TRIM = 8

    # Dimensions: 6.5w x 6.2d x 7.2h

    # --- 1. Foundation & Porch ---
    add_box_mesh(bm, (0.0, 0.0, 0.18), (6.8, 6.4, 0.36), mat_index=M_BRICK)
    # Front Porch Deck: 6.5w x 2.2d x 0.32h at Y = -3.8
    add_box_mesh(bm, (0.0, -3.8, 0.18), (6.6, 2.2, 0.36), mat_index=M_WOOD_DARK)
    add_box_mesh(bm, (0.0, -5.1, 0.09), (2.8, 0.6, 0.18), mat_index=M_WOOD_DARK)

    # --- 2. Main Timber Workshop Body ---
    add_box_mesh(bm, (0.0, 0.0, 2.60), (6.2, 5.8, 4.60), mat_index=M_WOOD)

    # Corner post trims
    for cx in [-3.0, 3.0]:
        for cy in [-2.8, 2.8]:
            add_box_mesh(bm, (cx, cy, 2.60), (0.28, 0.28, 4.60), mat_index=M_TRIM)

    # False-front top facade: 6.4w x 0.35d x 1.8h at Z = 5.6, Y = -2.9
    add_box_mesh(bm, (0.0, -2.9, 5.60), (6.4, 0.35, 1.80), mat_index=M_WOOD_DARK)
    add_box_mesh(bm, (0.0, -2.9, 6.55), (4.4, 0.45, 0.40), mat_index=M_TRIM)

    # --- 3. Prominent Side Forge Chimney ---
    # Massive brick forge chimney on right side (X = 3.4, Y = -0.5): 1.4w x 1.4d x 7.8h
    add_box_mesh(bm, (3.3, -0.5, 3.8), (1.3, 1.3, 7.2), mat_index=M_BRICK)
    add_box_mesh(bm, (3.3, -0.5, 7.5), (1.5, 1.5, 0.35), mat_index=M_STONE)
    add_cylinder_mesh(bm, (3.3, -0.5, 7.9), radius=0.35, depth=0.6, segments=8, mat_index=M_IRON)

    # --- 4. Porch Awning & Posts ---
    # 2 Porch Posts at Y = -4.7: X = -2.8, 0.8
    for px in [-2.8, 0.8]:
        add_box_mesh(bm, (px, -4.7, 1.75), (0.22, 0.22, 3.20), mat_index=M_WOOD_DARK)
    # Porch Lintel
    add_box_mesh(bm, (-1.0, -4.7, 3.25), (4.8, 0.25, 0.24), mat_index=M_TRIM)
    # Porch Shingle Awning
    add_box_mesh(bm, (-1.0, -3.8, 3.5), (5.0, 2.2, 0.20), rot=(math.radians(-10), 0, 0), mat_index=M_ROOF)

    # --- 5. Door & Display Window ---
    # Entrance door: 1.5w x 2.6h at Y = -2.85, Z = 1.5, X = -1.4
    add_box_mesh(bm, (-1.4, -2.85, 1.50), (1.5, 0.15, 2.60), mat_index=M_WOOD_DARK)

    # Display Bay Window (forge goods & rifles): 2.2w x 1.6h at Y = -2.85, Z = 2.2, X = 1.2
    add_box_mesh(bm, (1.2, -2.85, 2.2), (2.2, 0.25, 1.6), mat_index=M_WINDOW)
    add_box_mesh(bm, (1.2, -2.92, 1.35), (2.4, 0.35, 0.15), mat_index=M_TRIM)
    # Window shutters
    add_box_mesh(bm, (0.0, -2.90, 2.2), (0.28, 0.12, 1.6), mat_index=M_WOOD_DARK)
    add_box_mesh(bm, (2.4, -2.90, 2.2), (0.28, 0.12, 1.6), mat_index=M_WOOD_DARK)

    # --- 6. Over-the-Door 3D Rifle Silhouette Trade Sign ---
    # Stylized large wooden & iron rifle mounted horizontally over the entrance: Z = 6.4, Y = -3.1
    # Stock
    add_box_mesh(bm, (-1.2, -3.12, 6.4), (1.4, 0.08, 0.32), rot=(0, -0.05, 0), mat_index=M_WOOD_DARK)
    # Barrel & Receiver
    add_cylinder_mesh(bm, (0.4, -3.12, 6.42), radius=0.05, depth=2.2, segments=6,
                      rot=(0, math.pi / 2, 0), mat_index=M_IRON)
    # Trigger guard & lever
    add_box_mesh(bm, (-0.6, -3.12, 6.26), (0.28, 0.06, 0.16), mat_index=M_BRASS)

    # "GUNSMITH" sign board: 4.4w x 0.15d x 0.85h at Z = 5.2, Y = -3.1
    add_box_mesh(bm, (0.0, -3.12, 5.2), (4.4, 0.14, 0.85), mat_index=M_WOOD_DARK)
    add_box_mesh(bm, (0.0, -3.16, 5.2), (4.0, 0.08, 0.70), mat_index=M_BRASS)

    # Exterior Rifle Display Rack beside porch (X = 2.4, Y = -4.2)
    add_box_mesh(bm, (2.4, -4.2, 1.0), (0.16, 1.2, 0.16), rot=(0.12, 0, 0), mat_index=M_WOOD_DARK)
    # 2 Display rifles on the rack
    for rz in [0.8, 1.2]:
        add_cylinder_mesh(bm, (2.4, -4.2, rz), radius=0.03, depth=1.4, segments=5,
                          rot=(0.12, 0, 0), mat_index=M_IRON)

    # Main roof
    add_box_mesh(bm, (0.0, 0.2, 4.9), (6.0, 5.4, 0.25), mat_index=M_ROOF)

    bm.to_mesh(me)
    bm.free()
    me.shade_flat()
    return me

def build_and_export_all():
    buildings = [
        ('saloon', create_saloon_mesh),
        ('bank', create_bank_mesh),
        ('sheriff', create_sheriff_mesh),
        ('jail', create_jail_mesh),
        ('gunsmith', create_gunsmith_mesh),
    ]

    for name, builder in buildings:
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
