"""Procedural stylized 3D asset generator for Red West environment & mine props.

Creates game-ready low-poly 3D assets in Blender, saving both:
  1. Desktop Blender files: tools/blender/<name>.blend (openable in Desktop Blender)
  2. Game-ready GLB models: public/models/<name>.glb

Usage:
    blender -b --factory-startup --python tools/blender/make_env_props.py -- [all|house|tree|rock|chest|mushroom]
"""
import sys
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector, Euler, Matrix

D = math.radians
ROOT = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = ROOT / "public" / "models"
BLENDER_DIR = ROOT / "tools" / "blender"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
BLENDER_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Scene utilities
# ---------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Ensure a collection exists
    if not bpy.data.collections:
        col = bpy.data.collections.new("Scene Collection")
        bpy.context.scene.collection.children.link(col)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0


def add_studio_setup(target_height=2.0, distance=6.0):
    # Camera
    cam_data = bpy.data.cameras.new("StudioCamera")
    cam_data.lens = 50
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0
    cam_obj = bpy.data.objects.new("StudioCamera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    cam_obj.location = Vector((distance * 0.7, -distance, target_height + distance * 0.4))
    direction = Vector((0, 0, target_height * 0.5)) - cam_obj.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

    # Key light
    key_data = bpy.data.lights.new("KeyLight", 'SUN')
    key_data.energy = 3.5
    key_data.color = (1.0, 0.95, 0.88)
    key_obj = bpy.data.objects.new("KeyLight", key_data)
    key_obj.location = Vector((5, -5, 8))
    key_obj.rotation_euler = Euler((D(45), D(15), D(-30)), 'XYZ')
    bpy.context.scene.collection.objects.link(key_obj)

    # Fill light
    fill_data = bpy.data.lights.new("FillLight", 'SUN')
    fill_data.energy = 1.2
    fill_data.color = (0.85, 0.9, 1.0)
    fill_obj = bpy.data.objects.new("FillLight", fill_data)
    fill_obj.location = Vector((-5, -4, 4))
    fill_obj.rotation_euler = Euler((D(55), D(-20), D(45)), 'XYZ')
    bpy.context.scene.collection.objects.link(fill_obj)


def get_material(name, base_rgb, roughness=0.8, metallic=0.0, emission_rgb=None, emission_strength=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*base_rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission_rgb and emission_strength > 0:
        bsdf.inputs["Emission Color"].default_value = (*emission_rgb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def create_mesh_object(name, bm, material=None):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    return obj


def save_and_export(name):
    blend_path = str(BLENDER_DIR / f"{name}.blend")
    glb_path = str(MODELS_DIR / f"{name}.glb")

    # Select all mesh objects
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.select_set(True)

    # Export GLB (+Y up, apply modifiers)
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
        export_image_format='AUTO'
    )

    # Save .blend for user desktop Blender
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"Saved: {blend_path}")
    print(f"Exported: {glb_path}")


# ---------------------------------------------------------------------------
# 1. House (Western frontier clapboard house / store)
# ---------------------------------------------------------------------------

def build_house():
    reset_scene()
    add_studio_setup(target_height=3.5, distance=14.0)

    # Materials
    m_wood = get_material("Wood_Siding", (0.38, 0.26, 0.16), roughness=0.85)
    m_trim = get_material("Wood_Trim", (0.24, 0.16, 0.10), roughness=0.8)
    m_roof = get_material("Roof_Shingles", (0.28, 0.19, 0.15), roughness=0.9)
    m_deck = get_material("Porch_Planks", (0.45, 0.32, 0.20), roughness=0.85)
    m_stone = get_material("Stone_Chimney", (0.42, 0.38, 0.34), roughness=0.95)
    m_window = get_material("Glass_Lit", (0.95, 0.82, 0.55), roughness=0.3, emission_rgb=(0.95, 0.82, 0.55), emission_strength=1.5)
    m_door = get_material("Door_Dark", (0.20, 0.12, 0.08), roughness=0.75)

    # Main Body & Porch
    bm = bmesh.new()

    # Stone Foundation: 5.8w x 5.8d x 0.4h
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((5.8, 5.8, 0.4, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0, 0, 0.2)), verts=bm.verts[-8:])

    # Porch Deck Extension in front (-Y in Blender): 6.2w x 2.2d x 0.35h at Y=-3.9
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((6.2, 2.2, 0.35, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0, -3.9, 0.175)), verts=bm.verts[-8:])

    # Front Steps: 2.4w x 0.8d x 0.18h at Y=-5.3
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((2.4, 0.8, 0.18, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0, -5.3, 0.09)), verts=bm.verts[-8:])

    obj_deck = create_mesh_object("House_Deck", bm, m_deck)

    # Walls Body
    bm = bmesh.new()
    # Main living box: 5.4w x 5.2d x 4.2h, sitting on foundation at Z=0.4
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((5.4, 5.2, 4.2, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0, 0, 2.5)), verts=bm.verts[-8:])

    # False Front Facade at front (-Y): 5.8w x 0.3d x 2.2h above the roof line (Z=4.6 to 6.8)
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((5.8, 0.3, 2.2, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0, -2.6, 5.7)), verts=bm.verts[-8:])

    # Decorative Stepped Top Cornice
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((3.6, 0.4, 0.6, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0, -2.6, 7.1)), verts=bm.verts[-8:])
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((1.6, 0.45, 0.4, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0, -2.6, 7.6)), verts=bm.verts[-8:])

    # Horizontal clapboard siding lines (embossed planks across the front)
    for plank_z in [1.2, 1.8, 2.4, 3.0, 3.6, 4.2, 4.8, 5.4, 6.0, 6.6]:
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((5.7, 0.08, 0.08, 1.0)))
        bmesh.ops.translate(bm, vec=Vector((0, -2.68, plank_z)), verts=bm.verts[-8:])

    obj_walls = create_mesh_object("House_Walls", bm, m_wood)

    # Pitched Roof behind facade
    bm = bmesh.new()
    roof_len = 5.6
    roof_w = 6.2
    v1 = bm.verts.new((-roof_w/2, 0, 4.5))
    v2 = bm.verts.new((roof_w/2, 0, 4.5))
    v3 = bm.verts.new((0, 0, 6.4))
    face = bm.faces.new((v1, v2, v3))
    bmesh.ops.extrude_face_region(bm, geom=[face])
    for v in bm.verts:
        if v not in [v1, v2, v3]:
            v.co.y += roof_len
    bmesh.ops.translate(bm, vec=Vector((0, -2.4, 0)), verts=bm.verts)

    # Porch Roof / Awning: 6.2w x 2.4d x 0.25h sloping from Z=3.6 to Z=3.1
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((6.2, 2.4, 0.25, 1.0)))
    bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(D(-10), 3, 'X'), verts=bm.verts[-8:])
    bmesh.ops.translate(bm, vec=Vector((0, -3.8, 3.25)), verts=bm.verts[-8:])

    obj_roof = create_mesh_object("House_Roof", bm, m_roof)

    # Trims, Posts, Porch Railings, Frames, Sign Board
    bm = bmesh.new()
    # 3 Porch Support Posts: 0.22w x 0.22d x 3.0h at X = -2.7, 0, +2.7, Y = -4.8
    for px in [-2.7, 0.0, 2.7]:
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((0.22, 0.22, 3.0, 1.0)))
        bmesh.ops.translate(bm, vec=Vector((px, -4.8, 1.85)), verts=bm.verts[-8:])

    # Porch top beam
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((5.8, 0.25, 0.3, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0, -4.8, 3.2)), verts=bm.verts[-8:])

    # Corner post trims on main walls (4 corners)
    for cx in [-2.75, 2.75]:
        for cy in [-2.6, 2.6]:
            bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((0.3, 0.3, 4.4, 1.0)))
            bmesh.ops.translate(bm, vec=Vector((cx, cy, 2.6)), verts=bm.verts[-8:])

    # Saloon / Store Sign Board on False Front: 4.2w x 0.15d x 1.1h at Z=5.8
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((4.2, 0.15, 1.1, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0.0, -2.85, 5.8)), verts=bm.verts[-8:])
    # Sign decorative raised border frame
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((4.35, 0.18, 0.12, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0.0, -2.86, 6.35)), verts=bm.verts[-8:])
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((4.35, 0.18, 0.12, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0.0, -2.86, 5.25)), verts=bm.verts[-8:])

    # Door Frame at X=0.8, Y=-2.62: 1.4w x 0.15d x 2.5h
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((1.4, 0.15, 2.5, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0.8, -2.62, 1.65)), verts=bm.verts[-8:])

    # Window 1 (Lower Porch Window) Frame at X=-1.5, Y=-2.62: 1.3w x 0.15d x 1.7h, Z=2.1
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((1.3, 0.15, 1.7, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((-1.5, -2.62, 2.1)), verts=bm.verts[-8:])

    # Window 2 (Upper Floor Window) Frame at X=0.0, Y=-2.62: 1.3w x 0.15d x 1.6h, Z=4.2
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((1.3, 0.15, 1.6, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0.0, -2.62, 4.2)), verts=bm.verts[-8:])

    obj_trim = create_mesh_object("House_Trims", bm, m_trim)

    # Door Panel & Windows Glass
    bm = bmesh.new()
    # Door panel recessed
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((1.1, 0.1, 2.3, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0.8, -2.65, 1.55)), verts=bm.verts[-8:])
    obj_door = create_mesh_object("House_Door", bm, m_door)

    bm = bmesh.new()
    # Window panes with warm lantern glow
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((1.0, 0.08, 1.4, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((-1.5, -2.65, 2.1)), verts=bm.verts[-8:])
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((1.0, 0.08, 1.3, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0.0, -2.65, 4.2)), verts=bm.verts[-8:])
    # Sign insert panel (gold/cream letter block)
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((3.8, 0.16, 0.8, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((0.0, -2.86, 5.8)), verts=bm.verts[-8:])
    obj_window = create_mesh_object("House_Windows", bm, m_window)

    # Stone Chimney on Right (+X) wall
    bm = bmesh.new()
    # Base stack: 1.2w x 1.2d x 5.2h at X=2.85, Y=0.5
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((1.2, 1.2, 5.2, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((2.85, 0.5, 3.0)), verts=bm.verts[-8:])
    # Upper chimney stack extending above roof: 0.9w x 0.9d x 2.4h at Z=6.6
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((0.9, 0.9, 2.4, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((2.85, 0.5, 6.6)), verts=bm.verts[-8:])
    # Chimney pot cap
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((1.1, 1.1, 0.25, 1.0)))
    bmesh.ops.translate(bm, vec=Vector((2.85, 0.5, 7.85)), verts=bm.verts[-8:])
    obj_chimney = create_mesh_object("House_Chimney", bm, m_stone)

    save_and_export("house")


# ---------------------------------------------------------------------------
# 2. Tree (Stylized Western desert pine / juniper)
# ---------------------------------------------------------------------------

def build_tree():
    reset_scene()
    add_studio_setup(target_height=3.0, distance=10.0)

    m_bark = get_material("Bark_Dark", (0.28, 0.18, 0.10), roughness=0.9)
    m_foliage_dark = get_material("Pine_Foliage_Dark", (0.18, 0.32, 0.16), roughness=0.85)
    m_foliage_light = get_material("Pine_Foliage_Light", (0.26, 0.44, 0.22), roughness=0.8)

    # Trunk: 8-sided cylinder tapering from base to top
    bm = bmesh.new()
    trunk_res = 8
    # Bottom flare: r=0.45 at Z=0.0
    # Mid: r=0.32 at Z=1.8
    # Upper: r=0.18 at Z=4.2
    # Tip: r=0.06 at Z=5.8
    ring_z = [0.0, 0.4, 1.6, 3.0, 4.5, 5.8]
    ring_r = [0.48, 0.38, 0.30, 0.22, 0.15, 0.05]
    prev_verts = []
    for i, (z, r) in enumerate(zip(ring_z, ring_r)):
        curr_verts = []
        for s in range(trunk_res):
            ang = (s / trunk_res) * 2 * math.pi
            # slight twist and wobble for stylized character
            wobble = 1.0 + 0.12 * math.sin(s * 3 + i)
            x = math.cos(ang) * r * wobble
            y = math.sin(ang) * r * wobble + (0.08 * i if i > 2 else 0.0)
            curr_verts.append(bm.verts.new((x, y, z)))
        if prev_verts:
            for s in range(trunk_res):
                s_next = (s + 1) % trunk_res
                bm.faces.new((prev_verts[s], prev_verts[s_next], curr_verts[s_next], curr_verts[s]))
        else:
            # close bottom face
            bm.faces.new(curr_verts)
        prev_verts = curr_verts
    # close top
    bm.faces.new(prev_verts)

    # 3 root flares extending outward at base
    for a in [0.0, 2.1, 4.2]:
        root_dir = Vector((math.cos(a), math.sin(a), 0))
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((0.24, 0.5, 0.25, 1.0)))
        bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(a, 3, 'Z'), verts=bm.verts[-8:])
        bmesh.ops.translate(bm, vec=root_dir * 0.42 + Vector((0, 0, 0.1)), verts=bm.verts[-8:])

    # 2 small cut-off branch stubs
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((0.15, 0.4, 0.15, 1.0)))
    bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(D(45), 3, 'X'), verts=bm.verts[-8:])
    bmesh.ops.translate(bm, vec=Vector((0.25, -0.15, 1.4)), verts=bm.verts[-8:])

    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((0.14, 0.35, 0.14, 1.0)))
    bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(D(-50), 3, 'Y'), verts=bm.verts[-8:])
    bmesh.ops.translate(bm, vec=Vector((-0.22, 0.1, 2.2)), verts=bm.verts[-8:])

    obj_trunk = create_mesh_object("Tree_Trunk", bm, m_bark)

    # Stepped Stylized Foliage Tiers (4 tiers)
    bm = bmesh.new()
    # Tier 1 (Lowest): 7-sided conical canopy, r=1.5, Z=2.2 to 3.8
    # Tier 2: 7-sided, r=1.25, Z=3.2 to 4.6
    # Tier 3: 6-sided, r=0.95, Z=4.2 to 5.4
    # Tier 4 (Top): 5-sided, r=0.6, Z=5.0 to 6.2
    tiers = [
        (2.0, 1.7, 1.5, 7, 0.1),
        (3.1, 1.5, 1.25, 7, 0.4),
        (4.1, 1.3, 0.95, 6, 0.7),
        (4.9, 1.3, 0.65, 5, 0.2),
    ]

    for z_base, h, rad, segs, rot_offset in tiers:
        verts_bot = []
        verts_mid = []
        # Underside rim
        for s in range(segs):
            ang = (s / segs) * 2 * math.pi + rot_offset
            # alternate vertex radius for chunky tuft look
            r_alt = rad * (1.15 if s % 2 == 0 else 0.88)
            x = math.cos(ang) * r_alt
            y = math.sin(ang) * r_alt
            verts_bot.append(bm.verts.new((x, y, z_base)))
            # slight bevel edge
            verts_mid.append(bm.verts.new((x * 0.9, y * 0.9, z_base + h * 0.45)))

        apex = bm.verts.new((0, 0, z_base + h))
        bot_center = bm.verts.new((0, 0, z_base - 0.2))

        # Bottom faces
        for s in range(segs):
            s_next = (s + 1) % segs
            bm.faces.new((bot_center, verts_bot[s], verts_bot[s_next]))
            bm.faces.new((verts_bot[s], verts_mid[s], verts_mid[s_next], verts_bot[s_next]))
            bm.faces.new((verts_mid[s], apex, verts_mid[s_next]))

    obj_foliage = create_mesh_object("Tree_Foliage", bm, m_foliage_light)

    save_and_export("tree")


# ---------------------------------------------------------------------------
# 3. Rock (Chiseled desert boulder cluster)
# ---------------------------------------------------------------------------

def build_rock():
    reset_scene()
    add_studio_setup(target_height=1.2, distance=6.0)

    m_rock_main = get_material("Rock_Sandstone", (0.58, 0.42, 0.28), roughness=0.92)
    m_rock_shade = get_material("Rock_Crevice", (0.42, 0.29, 0.18), roughness=0.95)

    bm = bmesh.new()

    # Main boulder: create an icosphere and chisel/deform vertices for sharp planar facets
    ico1 = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.3)
    main_verts = ico1['verts']
    # Scale non-uniformly to give boulder weight: 2.2w x 1.8d x 1.5h
    for v in main_verts:
        v.co.x *= 1.15
        v.co.y *= 0.95
        v.co.z *= 0.8
        # Flatten bottom below Z=0
        if v.co.z < -0.3:
            v.co.z = -0.3
        # Chisel top plane
        if v.co.z > 0.6:
            v.co.z = 0.65 + 0.15 * math.sin(v.co.x * 2)

    bmesh.ops.translate(bm, vec=Vector((0, 0, 0.85)), verts=main_verts)

    # Secondary boulder leaning on left (-X, +Y)
    ico2 = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.85)
    sec_verts = ico2['verts']
    for v in sec_verts:
        v.co.x *= 0.9
        v.co.y *= 1.1
        v.co.z *= 0.75
        if v.co.z < -0.2:
            v.co.z = -0.2
    bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(D(20), 3, 'Y'), verts=sec_verts)
    bmesh.ops.translate(bm, vec=Vector((-1.35, 0.35, 0.55)), verts=sec_verts)

    # 3 small accent chips
    chip_configs = [
        (Vector((1.1, -0.8, 0.2)), 0.35, D(35)),
        (Vector((-0.8, -1.0, 0.18)), 0.28, D(-25)),
        (Vector((1.3, 0.6, 0.16)), 0.24, D(15)),
    ]
    for pos, rad, rot in chip_configs:
        ico = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rad)
        c_verts = ico['verts']
        for v in c_verts:
            if v.co.z < -rad * 0.4:
                v.co.z = -rad * 0.4
        bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(rot, 3, 'Z'), verts=c_verts)
        bmesh.ops.translate(bm, vec=pos, verts=c_verts)

    obj_rock = create_mesh_object("Desert_Rock", bm, m_rock_main)

    save_and_export("rock")


# ---------------------------------------------------------------------------
# 4. Mine Chest (Wooden treasure chest with articulated curved lid)
# ---------------------------------------------------------------------------

def build_chest():
    reset_scene()
    add_studio_setup(target_height=1.0, distance=5.0)

    m_wood = get_material("Chest_Oak", (0.34, 0.22, 0.12), roughness=0.85)
    m_metal = get_material("Chest_Hardware", (0.75, 0.60, 0.24), roughness=0.45, metallic=0.75)
    m_iron = get_material("Chest_Iron", (0.22, 0.22, 0.24), roughness=0.6, metallic=0.85)
    m_glow = get_material("Chest_Glow", (1.0, 0.85, 0.35), roughness=0.2, emission_rgb=(1.0, 0.85, 0.35), emission_strength=2.0)

    # CHEST BASE
    bm_base = bmesh.new()

    # Main wooden base box: 2.2w x 1.4d x 0.9h, centered at Z=0.45
    bmesh.ops.create_cube(bm_base, size=1.0, matrix=Matrix.Diagonal((2.2, 1.4, 0.9, 1.0)))
    bmesh.ops.translate(bm_base, vec=Vector((0, 0, 0.45)), verts=bm_base.verts[-8:])

    # Base rim feet: 4 corner wooden skid blocks
    for fx in [-0.95, 0.95]:
        for fy in [-0.55, 0.55]:
            bmesh.ops.create_cube(bm_base, size=1.0, matrix=Matrix.Diagonal((0.35, 0.35, 0.12, 1.0)))
            bmesh.ops.translate(bm_base, vec=Vector((fx, fy, 0.06)), verts=bm_base.verts[-8:])

    obj_base = create_mesh_object("Chest_Base", bm_base, m_wood)

    # CHEST BASE HARDWARE (Metal straps, corner plates, hasp)
    bm_hard = bmesh.new()
    # Bottom encircling metal band
    bmesh.ops.create_cube(bm_hard, size=1.0, matrix=Matrix.Diagonal((2.26, 1.46, 0.12, 1.0)))
    bmesh.ops.translate(bm_hard, vec=Vector((0, 0, 0.18)), verts=bm_hard.verts[-8:])

    # Upper rim metal band (where lid meets base)
    bmesh.ops.create_cube(bm_hard, size=1.0, matrix=Matrix.Diagonal((2.26, 1.46, 0.10, 1.0)))
    bmesh.ops.translate(bm_hard, vec=Vector((0, 0, 0.85)), verts=bm_hard.verts[-8:])

    # 2 Vertical strapping bands running up the base: at X = -0.65 and X = +0.65
    for sx in [-0.65, 0.65]:
        bmesh.ops.create_cube(bm_hard, size=1.0, matrix=Matrix.Diagonal((0.18, 1.46, 0.88, 1.0)))
        bmesh.ops.translate(bm_hard, vec=Vector((sx, 0, 0.46)), verts=bm_hard.verts[-8:])

    # Front lock escutcheon plate at Y = -0.72, Z = 0.65: 0.35w x 0.06d x 0.35h
    bmesh.ops.create_cube(bm_hard, size=1.0, matrix=Matrix.Diagonal((0.35, 0.06, 0.35, 1.0)))
    bmesh.ops.translate(bm_hard, vec=Vector((0, -0.72, 0.65)), verts=bm_hard.verts[-8:])

    # Side drop handles: at X = -1.13 and X = +1.13, Y = 0, Z = 0.55
    for hx in [-1.13, 1.13]:
        bmesh.ops.create_cube(bm_hard, size=1.0, matrix=Matrix.Diagonal((0.08, 0.36, 0.12, 1.0)))
        bmesh.ops.translate(bm_hard, vec=Vector((hx, 0, 0.55)), verts=bm_hard.verts[-8:])

    obj_base_hardware = create_mesh_object("Chest_Base_Hardware", bm_hard, m_metal)
    obj_base_hardware.parent = obj_base

    # CHEST LID (Curved barrel top, hinged at rear top: Y = +0.7, Z = 0.9)
    # Pivot point is placed at the hinge so rotating around X opens the chest!
    bm_lid = bmesh.new()

    # Curved barrel geometry: 8 radial segments across the arch
    arch_segs = 8
    arch_rad = 0.72
    lid_w = 2.24
    prev_v = []
    for s in range(arch_segs + 1):
        ang = (s / arch_segs) * math.pi
        # Arch sits centered above Y=0, spanning from Y=-0.72 to Y=+0.72
        y = -math.cos(ang) * arch_rad
        z = math.sin(ang) * 0.42
        v_left = bm_lid.verts.new((-lid_w/2, y, z))
        v_right = bm_lid.verts.new((lid_w/2, y, z))
        if prev_v:
            bm_lid.faces.new((prev_v[0], prev_v[1], v_right, v_left))
        prev_v = [v_left, v_right]

    # Close left and right end cap faces
    left_cap_verts = [v for v in bm_lid.verts if v.co.x < 0]
    right_cap_verts = [v for v in bm_lid.verts if v.co.x > 0]
    # sort by Y
    left_cap_verts.sort(key=lambda v: v.co.y)
    right_cap_verts.sort(key=lambda v: v.co.y)
    # bottom rim closing face
    bm_lid.faces.new([left_cap_verts[0], right_cap_verts[0], right_cap_verts[-1], left_cap_verts[-1]])

    obj_lid = create_mesh_object("Chest_Lid", bm_lid, m_wood)
    # Position lid on top of base
    obj_lid.location = Vector((0, 0, 0.9))
    obj_lid.parent = obj_base

    # LID METAL BANDS & LATCH
    bm_lid_metal = bmesh.new()
    # 2 arched straps on the lid matching base straps at X = -0.65, +0.65
    for sx in [-0.65, 0.65]:
        prev_strap = []
        for s in range(arch_segs + 1):
            ang = (s / arch_segs) * math.pi
            y = -math.cos(ang) * (arch_rad + 0.02)
            z = math.sin(ang) * (0.42 + 0.02)
            v1 = bm_lid_metal.verts.new((sx - 0.09, y, z))
            v2 = bm_lid_metal.verts.new((sx + 0.09, y, z))
            if prev_strap:
                bm_lid_metal.faces.new((prev_strap[0], prev_strap[1], v2, v1))
            prev_strap = [v1, v2]

    # Front overlapping latch hasp at Y = -0.73, Z = -0.05
    bmesh.ops.create_cube(bm_lid_metal, size=1.0, matrix=Matrix.Diagonal((0.24, 0.08, 0.32, 1.0)))
    bmesh.ops.translate(bm_lid_metal, vec=Vector((0, -0.73, 0.0)), verts=bm_lid_metal.verts[-8:])

    obj_lid_metal = create_mesh_object("Chest_Lid_Hardware", bm_lid_metal, m_metal)
    obj_lid_metal.location = Vector((0, 0, 0.0))  # relative to obj_lid
    obj_lid_metal.parent = obj_lid

    # Small gold interior glow indicator
    bm_glow = bmesh.new()
    bmesh.ops.create_icosphere(bm_glow, subdivisions=1, radius=0.22)
    bmesh.ops.translate(bm_glow, vec=Vector((0, 0, 0.7)), verts=bm_glow.verts[-12:])
    obj_glow = create_mesh_object("Chest_Treasure_Glow", bm_glow, m_glow)
    obj_glow.parent = obj_base

    save_and_export("mine_chest")


# ---------------------------------------------------------------------------
# 5. Mine Mushroom (Bioluminescent cave mushroom cluster)
# ---------------------------------------------------------------------------

def build_mushroom():
    reset_scene()
    add_studio_setup(target_height=1.2, distance=5.5)

    m_stalk = get_material("Mushroom_Stalk", (0.16, 0.34, 0.38), roughness=0.8)
    m_cap = get_material("Mushroom_Cap", (0.12, 0.78, 0.70), roughness=0.45)
    m_gills = get_material("Mushroom_Gills_Glow", (0.50, 0.95, 0.90), roughness=0.3, emission_rgb=(0.40, 0.95, 0.90), emission_strength=3.0)
    m_spots = get_material("Mushroom_Spots", (0.80, 1.0, 0.95), roughness=0.2, emission_rgb=(0.80, 1.0, 0.95), emission_strength=2.0)
    m_ground = get_material("Cave_Dirt", (0.22, 0.18, 0.16), roughness=0.95)

    # Cave ground base mound
    bm_ground = bmesh.new()
    ico = bmesh.ops.create_icosphere(bm_ground, subdivisions=1, radius=1.1)
    for v in ico['verts']:
        v.co.z *= 0.25
        if v.co.z < 0:
            v.co.z = 0
    bmesh.ops.translate(bm_ground, vec=Vector((0, 0, 0.05)), verts=ico['verts'])
    obj_ground = create_mesh_object("Mushroom_Ground", bm_ground, m_ground)

    # STALKS
    bm_stalks = bmesh.new()
    # Mushroom 1 (Main large): Center, H=1.6, curve slightly toward +X
    # Mushroom 2 (Medium): X=-0.55, Y=0.35, H=1.15, lean left
    # Mushroom 3 (Sprout 1): X=0.6, Y=-0.4, H=0.65
    # Mushroom 4 (Sprout 2): X=-0.3, Y=-0.55, H=0.45

    shroom_configs = [
        (Vector((0.0, 0.0, 0.0)), 1.45, 0.18, 0.12, D(8), D(5), 1.0),
        (Vector((-0.55, 0.35, 0.0)), 1.05, 0.14, 0.09, D(-18), D(12), 0.75),
        (Vector((0.55, -0.38, 0.0)), 0.65, 0.11, 0.07, D(22), D(-15), 0.48),
        (Vector((-0.32, -0.50, 0.0)), 0.45, 0.09, 0.06, D(-12), D(-20), 0.35),
    ]

    for root_pos, height, r_base, r_top, tilt_x, tilt_y, cap_scale in shroom_configs:
        segs = 7
        rings = 4
        prev_ring = []
        for ri in range(rings):
            t = ri / (rings - 1)
            z = t * height
            # curved stalk path
            offset_x = math.sin(t * 1.5) * (0.2 if tilt_x > 0 else -0.15)
            offset_y = (t ** 1.3) * (0.15 if tilt_y > 0 else -0.12)
            r = r_base * (1.0 - t * 0.35)
            curr_ring = []
            for s in range(segs):
                ang = (s / segs) * 2 * math.pi
                x = root_pos.x + offset_x + math.cos(ang) * r
                y = root_pos.y + offset_y + math.sin(ang) * r
                curr_ring.append(bm_stalks.verts.new((x, y, z + 0.05)))
            if prev_ring:
                for s in range(segs):
                    s_next = (s + 1) % segs
                    bm_stalks.faces.new((prev_ring[s], prev_ring[s_next], curr_ring[s_next], curr_ring[s]))
            else:
                bm_stalks.faces.new(curr_ring)
            prev_ring = curr_ring
        bm_stalks.faces.new(prev_ring)

    obj_stalks = create_mesh_object("Mushroom_Stalks", bm_stalks, m_stalk)

    # CAPS & EMISSIVE GILLS
    bm_caps = bmesh.new()
    bm_gills = bmesh.new()
    bm_spots = bmesh.new()

    for root_pos, height, r_base, r_top, tilt_x, tilt_y, cap_scale in shroom_configs:
        # Cap apex location
        cap_center = root_pos + Vector((
            math.sin(1.5) * (0.2 if tilt_x > 0 else -0.15),
            (0.15 if tilt_y > 0 else -0.12),
            height + 0.05
        ))
        cap_r = 0.65 * cap_scale
        cap_h = 0.45 * cap_scale
        cap_segs = 9

        # Underside gills ring & cap rim ring
        rim_verts_cap = []
        rim_verts_gills = []
        for s in range(cap_segs):
            ang = (s / cap_segs) * 2 * math.pi
            # scalloped rim
            rim_r = cap_r * (1.0 + 0.08 * math.sin(s * 3))
            rx = math.cos(ang) * rim_r
            ry = math.sin(ang) * rim_r
            # rim dips downward
            rz = -cap_h * 0.45
            rim_verts_cap.append(bm_caps.verts.new(cap_center + Vector((rx, ry, rz))))
            rim_verts_gills.append(bm_gills.verts.new(cap_center + Vector((rx * 0.95, ry * 0.95, rz - 0.02))))

        # Cap dome apex
        cap_apex = bm_caps.verts.new(cap_center + Vector((0, 0, cap_h * 0.55)))
        for s in range(cap_segs):
            s_next = (s + 1) % cap_segs
            bm_caps.faces.new((rim_verts_cap[s], cap_apex, rim_verts_cap[s_next]))

        # Gills center (bottom stalk attachment)
        gills_center = bm_gills.verts.new(cap_center + Vector((0, 0, -cap_h * 0.15)))
        for s in range(cap_segs):
            s_next = (s + 1) % cap_segs
            bm_gills.faces.new((gills_center, rim_verts_gills[s], rim_verts_gills[s_next]))

        # 3 glowing bioluminescent spots on the larger caps
        if cap_scale > 0.6:
            for spot_a in [0.5, 2.5, 4.5]:
                sx = math.cos(spot_a) * (cap_r * 0.5)
                sy = math.sin(spot_a) * (cap_r * 0.5)
                sz = cap_h * 0.35
                spot_center = cap_center + Vector((sx, sy, sz))
                bmesh.ops.create_icosphere(bm_spots, subdivisions=1, radius=0.08 * cap_scale)
                bmesh.ops.translate(bm_spots, vec=spot_center, verts=bm_spots.verts[-12:])

    obj_caps = create_mesh_object("Mushroom_Caps", bm_caps, m_cap)
    obj_gills = create_mesh_object("Mushroom_Gills", bm_gills, m_gills)
    obj_spots = create_mesh_object("Mushroom_Spots", bm_spots, m_spots)

    save_and_export("mine_mushroom")


# ---------------------------------------------------------------------------
# CLI Entrypoint
# ---------------------------------------------------------------------------

def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["all"]
    target = argv[0].lower() if argv else "all"

    builders = {
        "house": build_house,
        "tree": build_tree,
        "rock": build_rock,
        "chest": build_chest,
        "mushroom": build_mushroom,
    }

    if target == "all":
        print("Building ALL environment & mine assets...")
        for name, func in builders.items():
            print(f"\n--- Generating {name} ---")
            func()
    elif target in builders:
        print(f"Building {target}...")
        builders[target]()
    else:
        print(f"Unknown target '{target}'. Available: all, {', '.join(builders.keys())}")
        sys.exit(1)


if __name__ == "__main__":
    main()
