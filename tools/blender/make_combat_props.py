"""Procedural stylized 3D asset generator for Red West combat obstacles & props.

Creates game-ready low-poly 3D assets in Blender:
  1. Cactus: Stylized Saguaro cactus with ribbed flutes, dual curved arms, and desert flower blossoms.
  2. Crate: Western frontier cargo crate with recessed plank faces, diagonal cross-braces, and iron corner brackets.
  3. Barrel: Oak whiskey stave barrel with bulging profile, inset lids, 4 iron hoop bands, and bung stopper.
  4. Fence: Split-rail corral fence section with rough-hewn posts, mortised split rails, and rope lashings.
  5. Wagon Wheel: 19th-century frontier wooden wagon wheel with hub, 12 tapered radial spokes, wooden felloes, iron tire, and ground chock.

Saves:
  - Native Desktop Blender files: tools/blender/<name>.blend (openable in Desktop Blender)
  - Game-ready GLB models: public/models/<name>.glb

Usage:
    blender -b --factory-startup --python tools/blender/make_combat_props.py -- [all|cactus|crate|barrel|fence|wagon_wheel]
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
    if not bpy.data.collections:
        col = bpy.data.collections.new("Scene Collection")
        bpy.context.scene.collection.children.link(col)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0


def add_studio_setup(target_height=1.5, distance=5.5):
    cam_data = bpy.data.cameras.new("StudioCamera")
    cam_data.lens = 50
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0
    cam_obj = bpy.data.objects.new("StudioCamera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    cam_obj.location = Vector((distance * 0.7, -distance, target_height + distance * 0.35))
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
    if hasattr(mat, "use_nodes") and not mat.use_nodes:
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


def scale_mat(sx, sy, sz):
    return Matrix.Diagonal(Vector((sx, sy, sz, 1.0)))


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

    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
        export_image_format='AUTO'
    )

    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"Saved: {blend_path}")
    print(f"Exported: {glb_path}")


# ---------------------------------------------------------------------------
# 1. Stylized Saguaro Cactus
# ---------------------------------------------------------------------------

def build_cactus():
    reset_scene()
    add_studio_setup(target_height=3.0, distance=8.5)

    m_cactus = get_material("Cactus_Body", (0.24, 0.52, 0.22), roughness=0.75)
    m_petal = get_material("Flower_Petal", (0.86, 0.12, 0.40), roughness=0.6)
    m_stamen = get_material("Flower_Center", (1.0, 0.80, 0.18), roughness=0.5, emission_rgb=(1.0, 0.80, 0.18), emission_strength=0.8)

    bm = bmesh.new()

    # --- Trunk ---
    # Fluted cylinder with 8 ribs (16 radial vertices)
    num_ribs = 8
    radial_verts = num_ribs * 2
    height_profiles = [
        (0.00, 0.42),
        (0.40, 0.52),
        (1.40, 0.58),
        (2.60, 0.60),
        (3.80, 0.58),
        (4.70, 0.52),
        (5.10, 0.38),
        (5.35, 0.18),
    ]

    rings = []
    for z, base_r in height_profiles:
        ring = []
        for i in range(radial_verts):
            ang = 2 * math.pi * i / radial_verts
            # Alternate crest vs trough
            r = base_r * (1.10 if (i % 2 == 0) else 0.90)
            x = r * math.cos(ang)
            y = r * math.sin(ang)
            v = bm.verts.new((x, y, z))
            ring.append(v)
        rings.append(ring)

    # Trunk top apex & bottom center
    top_apex = bm.verts.new((0, 0, 5.42))
    bot_center = bm.verts.new((0, 0, 0.00))

    # Connect rings
    for r_idx in range(len(rings) - 1):
        r1 = rings[r_idx]
        r2 = rings[r_idx + 1]
        for i in range(radial_verts):
            next_i = (i + 1) % radial_verts
            bm.faces.new([r1[i], r1[next_i], r2[next_i], r2[i]])

    # Close top dome
    top_ring = rings[-1]
    for i in range(radial_verts):
        next_i = (i + 1) % radial_verts
        bm.faces.new([top_ring[i], top_ring[next_i], top_apex])

    # Close bottom base
    bot_ring = rings[0]
    for i in range(radial_verts):
        next_i = (i + 1) % radial_verts
        bm.faces.new([bot_ring[next_i], bot_ring[i], bot_center])

    # --- Helper for curved arm ---
    def build_arm(arm_points, base_r=0.28, ribs=6):
        num_v = ribs * 2
        arm_rings = []
        for p_idx, pt in enumerate(arm_points):
            t = p_idx / (len(arm_points) - 1)
            r_scale = 1.0 - 0.25 * (t ** 2) if t < 0.85 else (1.0 - t) * 3.0
            r_curr = max(0.10, base_r * r_scale)

            # Normal along trajectory
            if p_idx < len(arm_points) - 1:
                tangent = (arm_points[p_idx + 1] - pt).normalized()
            else:
                tangent = (pt - arm_points[p_idx - 1]).normalized()

            # Create perpendicular coordinate frame
            up = Vector((0, 0, 1))
            if abs(tangent.dot(up)) > 0.9:
                up = Vector((0, 1, 0))
            normal1 = tangent.cross(up).normalized()
            normal2 = tangent.cross(normal1).normalized()

            ring = []
            for i in range(num_v):
                ang = 2 * math.pi * i / num_v
                r = r_curr * (1.12 if (i % 2 == 0) else 0.88)
                offset = (normal1 * math.cos(ang) + normal2 * math.sin(ang)) * r
                v = bm.verts.new(pt + offset)
                ring.append(v)
            arm_rings.append(ring)

        # Connect arm rings
        for r_idx in range(len(arm_rings) - 1):
            r1 = arm_rings[r_idx]
            r2 = arm_rings[r_idx + 1]
            for i in range(num_v):
                next_i = (i + 1) % num_v
                bm.faces.new([r1[i], r1[next_i], r2[next_i], r2[i]])

        # Cap top tip
        tip_apex = bm.verts.new(arm_points[-1] + tangent * 0.12)
        tip_ring = arm_rings[-1]
        for i in range(num_v):
            next_i = (i + 1) % num_v
            bm.faces.new([tip_ring[i], tip_ring[next_i], tip_apex])
        return tip_apex.co

    # Right Arm: starts at Z=2.2, curves right and up
    right_pts = [
        Vector((0.45, 0.0, 2.2)),
        Vector((0.85, 0.05, 2.3)),
        Vector((1.25, 0.06, 2.6)),
        Vector((1.38, 0.04, 3.1)),
        Vector((1.35, 0.02, 3.7)),
        Vector((1.30, 0.0, 4.1)),
    ]
    right_tip = build_arm(right_pts, base_r=0.28)

    # Left Arm: starts higher at Z=2.9, curves left and up
    left_pts = [
        Vector((-0.45, -0.05, 2.9)),
        Vector((-0.80, -0.02, 3.0)),
        Vector((-1.15, 0.0, 3.3)),
        Vector((-1.22, 0.0, 3.9)),
        Vector((-1.18, 0.0, 4.6)),
    ]
    left_tip = build_arm(left_pts, base_r=0.25)

    create_mesh_object("Cactus_Body", bm, m_cactus)

    # --- Desert Blossom Flowers ---
    def build_flower(center_pos, scale=1.0):
        bm_f = bmesh.new()
        # 5-petals star
        num_petals = 5
        center_v = bm_f.verts.new((0, 0, 0.04))
        petal_outer = []
        petal_notches = []

        for p in range(num_petals):
            ang_tip = 2 * math.pi * p / num_petals
            ang_notch = ang_tip + math.pi / num_petals

            tip_v = bm_f.verts.new((
                math.cos(ang_tip) * 0.22 * scale,
                math.sin(ang_tip) * 0.22 * scale,
                0.08 * scale
            ))
            notch_v = bm_f.verts.new((
                math.cos(ang_notch) * 0.09 * scale,
                math.sin(ang_notch) * 0.09 * scale,
                0.03 * scale
            ))
            petal_outer.append(tip_v)
            petal_notches.append(notch_v)

        for p in range(num_petals):
            prev_notch = petal_notches[(p - 1) % num_petals]
            curr_tip = petal_outer[p]
            curr_notch = petal_notches[p]
            bm_f.faces.new([center_v, prev_notch, curr_tip, curr_notch])

        # Center stamen dome
        bmesh.ops.create_cone(
            bm_f,
            cap_ends=True,
            cap_tris=False,
            segments=8,
            radius1=0.08 * scale,
            radius2=0.04 * scale,
            depth=0.06 * scale,
            matrix=Matrix.Translation((0, 0, 0.04 * scale))
        )

        bmesh.ops.translate(bm_f, vec=center_pos, verts=bm_f.verts)
        return bm_f

    bm_flowers = build_flower(Vector((0, 0, 5.42)), scale=1.1)
    bm_arm_flower = build_flower(right_tip, scale=0.85)
    # Merge flower meshes
    for v in bm_arm_flower.verts:
        bm_flowers.verts.new(v.co)
    bm_arm_flower.free()

    create_mesh_object("Cactus_Flowers", bm_flowers, m_petal)

    save_and_export("cactus")


# ---------------------------------------------------------------------------
# 2. Frontier Cargo Crate
# ---------------------------------------------------------------------------

def build_crate():
    reset_scene()
    add_studio_setup(target_height=1.5, distance=5.5)

    m_wood = get_material("Crate_Wood", (0.50, 0.33, 0.18), roughness=0.85)
    m_trim = get_material("Crate_Trim", (0.35, 0.22, 0.12), roughness=0.90)
    m_iron = get_material("Crate_Iron", (0.22, 0.24, 0.26), roughness=0.45, metallic=0.75)

    # --- Core Planks & Frame ---
    bm_wood = bmesh.new()

    size = 2.4
    half = size / 2

    # Inner recessed cube
    bmesh.ops.create_cube(
        bm_wood,
        size=1.0,
        matrix=Matrix.Translation((0, 0, half)) @ scale_mat(size - 0.12, size - 0.12, size - 0.12)
    )

    # Horizontal plank grooves on faces (carved visual panels)
    # Corner posts (4 vertical posts)
    post_w = 0.26
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            px = sx * (half - post_w / 2)
            py = sy * (half - post_w / 2)
            bmesh.ops.create_cube(
                bm_wood,
                size=1.0,
                matrix=Matrix.Translation((px, py, half)) @ scale_mat(post_w, post_w, size)
            )

    # Top & Bottom frame rails along X and Y
    rail_w = 0.22
    rail_h = 0.18
    for sz in [rail_h / 2, size - rail_h / 2]:
        for sy in [-1, 1]:
            # X-rails
            bmesh.ops.create_cube(
                bm_wood,
                size=1.0,
                matrix=Matrix.Translation((0, sy * (half - rail_w / 2), sz)) @ scale_mat(size - post_w * 2, rail_w, rail_h)
            )
        for sx in [-1, 1]:
            # Y-rails
            bmesh.ops.create_cube(
                bm_wood,
                size=1.0,
                matrix=Matrix.Translation((sx * (half - rail_w / 2), 0, sz)) @ scale_mat(rail_w, size - post_w * 2, rail_h)
            )

    # Diagonal Cross Braces on 4 vertical sides
    diag_w = 0.18
    diag_th = 0.08
    diag_len = math.hypot(size - post_w * 2, size - rail_h * 2) - 0.04
    diag_angle = math.atan2(size - rail_h * 2, size - post_w * 2)

    # Front face (Y = -half + diag_th/2)
    bmesh.ops.create_cube(
        bm_wood,
        size=1.0,
        matrix=Matrix.Translation((0, -half + diag_th / 2, half)) @
               Euler((0, -diag_angle, 0), 'XYZ').to_matrix().to_4x4() @
               scale_mat(diag_len, diag_th, diag_w)
    )
    # Back face (Y = half - diag_th/2)
    bmesh.ops.create_cube(
        bm_wood,
        size=1.0,
        matrix=Matrix.Translation((0, half - diag_th / 2, half)) @
               Euler((0, diag_angle, 0), 'XYZ').to_matrix().to_4x4() @
               scale_mat(diag_len, diag_th, diag_w)
    )
    # Left face (X = -half + diag_th/2)
    bmesh.ops.create_cube(
        bm_wood,
        size=1.0,
        matrix=Matrix.Translation((-half + diag_th / 2, 0, half)) @
               Euler((diag_angle, 0, 0), 'XYZ').to_matrix().to_4x4() @
               scale_mat(diag_th, diag_len, diag_w)
    )
    # Right face (X = half - diag_th/2)
    bmesh.ops.create_cube(
        bm_wood,
        size=1.0,
        matrix=Matrix.Translation((half - diag_th / 2, 0, half)) @
               Euler((-diag_angle, 0, 0), 'XYZ').to_matrix().to_4x4() @
               scale_mat(diag_th, diag_len, diag_w)
    )

    create_mesh_object("Crate_Woodwork", bm_wood, m_wood)

    # --- Iron Corner Hardware & Rivets ---
    bm_iron = bmesh.new()
    strap_l = 0.45
    strap_th = 0.05
    strap_w = 0.18

    for sx in [-1, 1]:
        for sy in [-1, 1]:
            for sz_sign in [0, 1]:
                cz = sz_sign * size
                # 3 wings per corner: X-wing, Y-wing, Z-wing
                # Z wing
                z_dir = -1 if sz_sign else 1
                bmesh.ops.create_cube(
                    bm_iron,
                    size=1.0,
                    matrix=Matrix.Translation((sx * (half + strap_th / 2), sy * (half - strap_w / 2), cz + z_dir * strap_l / 2)) @
                           scale_mat(strap_th, strap_w, strap_l)
                )
                bmesh.ops.create_cube(
                    bm_iron,
                    size=1.0,
                    matrix=Matrix.Translation((sx * (half - strap_w / 2), sy * (half + strap_th / 2), cz + z_dir * strap_l / 2)) @
                           scale_mat(strap_w, strap_th, strap_l)
                )
                # Rivet stud
                bmesh.ops.create_cube(
                    bm_iron,
                    size=1.0,
                    matrix=Matrix.Translation((sx * (half + strap_th + 0.02), sy * (half - strap_w / 2), cz + z_dir * (strap_l * 0.7))) @
                           scale_mat(0.04, 0.06, 0.06)
                )

    create_mesh_object("Crate_Hardware", bm_iron, m_iron)

    save_and_export("crate")


# ---------------------------------------------------------------------------
# 3. Oak Whiskey Stave Barrel
# ---------------------------------------------------------------------------

def build_barrel():
    reset_scene()
    add_studio_setup(target_height=1.4, distance=5.0)

    m_wood = get_material("Barrel_Oak", (0.44, 0.28, 0.16), roughness=0.85)
    m_lid = get_material("Barrel_Lid", (0.36, 0.23, 0.13), roughness=0.88)
    m_iron = get_material("Barrel_Hoops", (0.20, 0.22, 0.24), roughness=0.45, metallic=0.8)
    m_plug = get_material("Bung_Stopper", (0.65, 0.45, 0.22), roughness=0.6)

    # 14-sided polygon barrel profile
    sides = 14
    profile = [
        (0.00, 0.64),
        (0.12, 0.68),
        (0.40, 0.77),
        (0.70, 0.84),
        (1.00, 0.88),  # Bulge equator
        (1.30, 0.84),
        (1.60, 0.77),
        (1.88, 0.68),
        (2.00, 0.64),
    ]

    bm_staves = bmesh.new()
    rings = []
    for z, r in profile:
        ring = []
        for i in range(sides):
            ang = 2 * math.pi * i / sides
            x = r * math.cos(ang)
            y = r * math.sin(ang)
            ring.append(bm_staves.verts.new((x, y, z)))
        rings.append(ring)

    # Connect rings
    for r_idx in range(len(rings) - 1):
        r1 = rings[r_idx]
        r2 = rings[r_idx + 1]
        for i in range(sides):
            next_i = (i + 1) % sides
            bm_staves.faces.new([r1[i], r1[next_i], r2[next_i], r2[i]])

    # Top & Bottom rim caps (recessed chime edge)
    top_lid_z = 1.92
    bot_lid_z = 0.08
    top_center = bm_staves.verts.new((0, 0, top_lid_z))
    bot_center = bm_staves.verts.new((0, 0, bot_lid_z))

    # Inner lid rings
    top_lid_r = 0.60
    bot_lid_r = 0.60
    top_lid_ring = [bm_staves.verts.new((top_lid_r * math.cos(2 * math.pi * i / sides), top_lid_r * math.sin(2 * math.pi * i / sides), top_lid_z)) for i in range(sides)]
    bot_lid_ring = [bm_staves.verts.new((bot_lid_r * math.cos(2 * math.pi * i / sides), bot_lid_r * math.sin(2 * math.pi * i / sides), bot_lid_z)) for i in range(sides)]

    # Connect rim to inner lid
    for i in range(sides):
        next_i = (i + 1) % sides
        bm_staves.faces.new([rings[-1][i], rings[-1][next_i], top_lid_ring[next_i], top_lid_ring[i]])
        bm_staves.faces.new([rings[0][next_i], rings[0][i], bot_lid_ring[i], bot_lid_ring[next_i]])
        # Connect to center
        bm_staves.faces.new([top_lid_ring[i], top_lid_ring[next_i], top_center])
        bm_staves.faces.new([bot_lid_ring[next_i], bot_lid_ring[i], bot_center])

    create_mesh_object("Barrel_Staves", bm_staves, m_wood)

    # --- Iron Hoops (4 bands) ---
    bm_hoops = bmesh.new()
    hoop_specs = [
        (0.14, 0.27, 0.69),  # Bottom chime
        (0.55, 0.68, 0.81),  # Bottom quarter
        (1.32, 1.45, 0.84),  # Top quarter
        (1.73, 1.86, 0.70),  # Top chime
    ]

    for z1, z2, base_r in hoop_specs:
        r = base_r + 0.035
        r_top = r
        r_bot = r
        ring1 = [bm_hoops.verts.new((r_bot * math.cos(2 * math.pi * i / sides), r_bot * math.sin(2 * math.pi * i / sides), z1)) for i in range(sides)]
        ring2 = [bm_hoops.verts.new((r_top * math.cos(2 * math.pi * i / sides), r_top * math.sin(2 * math.pi * i / sides), z2)) for i in range(sides)]
        for i in range(sides):
            next_i = (i + 1) % sides
            bm_hoops.faces.new([ring1[i], ring1[next_i], ring2[next_i], ring2[i]])

        # Rivet clasp on front (-Y)
        bmesh.ops.create_cube(
            bm_hoops,
            size=1.0,
            matrix=Matrix.Translation((0, -r - 0.02, (z1 + z2) / 2)) @ scale_mat(0.08, 0.04, z2 - z1 + 0.02)
        )

    create_mesh_object("Barrel_Hoops", bm_hoops, m_iron)

    # --- Bung Stopper ---
    bm_bung = bmesh.new()
    bung_r = 0.88 + 0.02
    bmesh.ops.create_cone(
        bm_bung,
        cap_ends=True,
        cap_tris=False,
        segments=8,
        radius1=0.08,
        radius2=0.05,
        depth=0.08,
        matrix=Matrix.Translation((0, -bung_r, 1.0)) @ Euler((D(90), 0, 0), 'XYZ').to_matrix().to_4x4()
    )
    create_mesh_object("Barrel_Bung", bm_bung, m_plug)

    save_and_export("barrel")


# ---------------------------------------------------------------------------
# 4. Split-Rail Fence Section
# ---------------------------------------------------------------------------

def build_fence():
    reset_scene()
    add_studio_setup(target_height=1.5, distance=5.8)

    m_wood = get_material("Fence_Post", (0.48, 0.35, 0.24), roughness=0.90)
    m_rail = get_material("Fence_Rail", (0.55, 0.40, 0.28), roughness=0.88)
    m_rope = get_material("Fence_Binding", (0.28, 0.22, 0.16), roughness=0.75)
    m_stone = get_material("Fence_Pebbles", (0.42, 0.40, 0.38), roughness=0.95)

    bm_wood = bmesh.new()

    # --- 2 Rough-hewn Posts ---
    post_h = 2.3
    post_r = 0.18
    post_spacing = 3.0
    for px in [-post_spacing / 2, post_spacing / 2]:
        # Hexagonal post
        bmesh.ops.create_cone(
            bm_wood,
            cap_ends=True,
            cap_tris=False,
            segments=6,
            radius1=post_r * 1.1,
            radius2=post_r * 0.9,
            depth=post_h,
            matrix=Matrix.Translation((px, 0, post_h / 2))
        )
        # Angled rustic top cut
        bmesh.ops.create_cone(
            bm_wood,
            cap_ends=True,
            cap_tris=False,
            segments=6,
            radius1=post_r * 0.9,
            radius2=0.02,
            depth=0.22,
            matrix=Matrix.Translation((px, 0, post_h + 0.11))
        )

    # --- Split Rails (Top & Bottom) ---
    rail_len = 3.8
    rail_r = 0.11

    # Top rail (Z = 1.65)
    bmesh.ops.create_cone(
        bm_wood,
        cap_ends=True,
        cap_tris=False,
        segments=6,
        radius1=rail_r * 1.05,
        radius2=rail_r * 0.90,
        depth=rail_len,
        matrix=Matrix.Translation((0, 0.08, 1.65)) @ Euler((0, D(90), 0), 'XYZ').to_matrix().to_4x4()
    )

    # Bottom rail (Z = 0.85)
    bmesh.ops.create_cone(
        bm_wood,
        cap_ends=True,
        cap_tris=False,
        segments=6,
        radius1=rail_r * 1.10,
        radius2=rail_r * 0.95,
        depth=rail_len,
        matrix=Matrix.Translation((0, -0.06, 0.85)) @ Euler((0, D(90), 0), 'XYZ').to_matrix().to_4x4()
    )

    # Diagonal rustic brace
    diag_len = math.hypot(post_spacing, 0.8)
    diag_ang = math.atan2(0.8, post_spacing)
    bmesh.ops.create_cone(
        bm_wood,
        cap_ends=True,
        cap_tris=False,
        segments=6,
        radius1=rail_r * 0.75,
        radius2=rail_r * 0.65,
        depth=diag_len,
        matrix=Matrix.Translation((0, 0.02, 1.25)) @ Euler((0, D(90) - diag_ang, 0), 'XYZ').to_matrix().to_4x4()
    )

    create_mesh_object("Fence_Timber", bm_wood, m_wood)

    # --- Rope / Iron Lashings ---
    bm_rope = bmesh.new()
    for px in [-post_spacing / 2, post_spacing / 2]:
        for rz in [0.85, 1.65]:
            # Wrapped cord ring
            bmesh.ops.create_cone(
                bm_rope,
                cap_ends=True,
                cap_tris=False,
                segments=8,
                radius1=post_r * 1.15,
                radius2=post_r * 1.15,
                depth=0.08,
                matrix=Matrix.Translation((px, 0, rz))
            )

    create_mesh_object("Fence_Lashings", bm_rope, m_rope)

    # --- Base Stones ---
    bm_stones = bmesh.new()
    for px in [-post_spacing / 2, post_spacing / 2]:
        for ang, r, sz in [(0.4, 0.28, 0.14), (2.1, 0.32, 0.16), (4.2, 0.26, 0.12)]:
            bmesh.ops.create_cube(
                bm_stones,
                size=1.0,
                matrix=Matrix.Translation((px + math.cos(ang) * r, math.sin(ang) * r, sz / 2)) @
                       Euler((0.3, ang, 0.4), 'XYZ').to_matrix().to_4x4() @
                       scale_mat(sz * 1.2, sz, sz * 0.8)
            )

    create_mesh_object("Fence_Stones", bm_stones, m_stone)

    save_and_export("fence")


# ---------------------------------------------------------------------------
# 5. Western Wagon Wheel
# ---------------------------------------------------------------------------

def build_wagon_wheel():
    reset_scene()
    add_studio_setup(target_height=1.4, distance=5.2)

    m_wood = get_material("Wheel_Oak", (0.52, 0.35, 0.20), roughness=0.80)
    m_iron = get_material("Wheel_Iron", (0.22, 0.24, 0.26), roughness=0.45, metallic=0.8)
    m_brass = get_material("Wheel_Brass", (0.80, 0.65, 0.28), roughness=0.35, metallic=0.85)
    m_chock = get_material("Wheel_Chock", (0.38, 0.25, 0.15), roughness=0.85)

    wheel_r = 1.00
    hub_z = wheel_r
    tilt_x = D(3.5)  # Slight resting tilt

    bm_wood = bmesh.new()

    # Base transformation matrix (standing upright, centered at hub_z, resting at Z=0)
    wheel_mat = Matrix.Translation((0, 0, hub_z)) @ Euler((tilt_x, 0, 0), 'XYZ').to_matrix().to_4x4()

    # --- Wooden Hub (Nave) ---
    hub_len = 0.42
    hub_r = 0.22
    bmesh.ops.create_cone(
        bm_wood,
        cap_ends=True,
        cap_tris=False,
        segments=12,
        radius1=hub_r,
        radius2=hub_r,
        depth=hub_len,
        matrix=wheel_mat @ Euler((D(90), 0, 0), 'XYZ').to_matrix().to_4x4()
    )

    # --- 12 Radial Tapered Wooden Spokes ---
    num_spokes = 12
    spoke_inner_r = 0.18
    spoke_outer_r = 0.88
    spoke_len = spoke_outer_r - spoke_inner_r

    for i in range(num_spokes):
        ang = 2 * math.pi * i / num_spokes
        mid_r = (spoke_inner_r + spoke_outer_r) / 2
        # Position spoke along radial line in X-Z plane
        pos = Vector((math.cos(ang) * mid_r, 0, math.sin(ang) * mid_r))
        spoke_rot = Euler((0, -ang + math.pi / 2, 0), 'XYZ').to_matrix().to_4x4()
        spoke_mat = wheel_mat @ Matrix.Translation(pos) @ spoke_rot

        bmesh.ops.create_cone(
            bm_wood,
            cap_ends=True,
            cap_tris=False,
            segments=6,
            radius1=0.045,
            radius2=0.032,
            depth=spoke_len,
            matrix=spoke_mat
        )

    # --- Wooden Felloes (Inner Rim) ---
    # 12-sided faceted polygon ring
    felloe_r1 = 0.86
    felloe_r2 = 0.95
    felloe_w = 0.14
    felloe_sides = 12

    ring1_front = []
    ring1_back = []
    ring2_front = []
    ring2_back = []

    for i in range(felloe_sides):
        ang = 2 * math.pi * i / felloe_sides
        ca = math.cos(ang)
        sa = math.sin(ang)
        # Inner ring
        v_in_f = bm_wood.verts.new(wheel_mat @ Vector((ca * felloe_r1, -felloe_w / 2, sa * felloe_r1)))
        v_in_b = bm_wood.verts.new(wheel_mat @ Vector((ca * felloe_r1, felloe_w / 2, sa * felloe_r1)))
        # Outer ring
        v_out_f = bm_wood.verts.new(wheel_mat @ Vector((ca * felloe_r2, -felloe_w / 2, sa * felloe_r2)))
        v_out_b = bm_wood.verts.new(wheel_mat @ Vector((ca * felloe_r2, felloe_w / 2, sa * felloe_r2)))

        ring1_front.append(v_in_f)
        ring1_back.append(v_in_b)
        ring2_front.append(v_out_f)
        ring2_back.append(v_out_b)

    for i in range(felloe_sides):
        next_i = (i + 1) % felloe_sides
        # Front face
        bm_wood.faces.new([ring1_front[i], ring2_front[i], ring2_front[next_i], ring1_front[next_i]])
        # Back face
        bm_wood.faces.new([ring2_back[i], ring1_back[i], ring1_back[next_i], ring2_back[next_i]])
        # Inner rim face
        bm_wood.faces.new([ring1_back[i], ring1_front[i], ring1_front[next_i], ring1_back[next_i]])

    create_mesh_object("Wheel_Woodwork", bm_wood, m_wood)

    # --- Iron Outer Tire & Hub Hardware ---
    bm_iron = bmesh.new()

    tire_r1 = 0.95
    tire_r2 = 1.00
    tire_w = 0.16
    tire_sides = 12

    t_in_f = []
    t_in_b = []
    t_out_f = []
    t_out_b = []

    for i in range(tire_sides):
        ang = 2 * math.pi * i / tire_sides
        ca = math.cos(ang)
        sa = math.sin(ang)
        t_in_f.append(bm_iron.verts.new(wheel_mat @ Vector((ca * tire_r1, -tire_w / 2, sa * tire_r1))))
        t_in_b.append(bm_iron.verts.new(wheel_mat @ Vector((ca * tire_r1, tire_w / 2, sa * tire_r1))))
        t_out_f.append(bm_iron.verts.new(wheel_mat @ Vector((ca * tire_r2, -tire_w / 2, sa * tire_r2))))
        t_out_b.append(bm_iron.verts.new(wheel_mat @ Vector((ca * tire_r2, tire_w / 2, sa * tire_r2))))

    for i in range(tire_sides):
        next_i = (i + 1) % tire_sides
        bm_iron.faces.new([t_in_f[i], t_out_f[i], t_out_f[next_i], t_in_f[next_i]])
        bm_iron.faces.new([t_out_b[i], t_in_b[i], t_in_b[next_i], t_out_b[next_i]])
        # Tread face
        bm_iron.faces.new([t_out_f[i], t_out_b[i], t_out_b[next_i], t_out_f[next_i]])

    # Hub iron bands (front and rear)
    for y_offset in [-hub_len / 2 + 0.04, hub_len / 2 - 0.04]:
        bmesh.ops.create_cone(
            bm_iron,
            cap_ends=True,
            cap_tris=False,
            segments=12,
            radius1=hub_r * 1.05,
            radius2=hub_r * 1.05,
            depth=0.06,
            matrix=wheel_mat @ Matrix.Translation((0, y_offset, 0)) @ Euler((D(90), 0, 0), 'XYZ').to_matrix().to_4x4()
        )

    create_mesh_object("Wheel_IronTire", bm_iron, m_iron)

    # --- Brass Axle Spindle Cap ---
    bm_brass = bmesh.new()
    bmesh.ops.create_cone(
        bm_brass,
        cap_ends=True,
        cap_tris=False,
        segments=8,
        radius1=0.08,
        radius2=0.05,
        depth=0.10,
        matrix=wheel_mat @ Matrix.Translation((0, -hub_len / 2 - 0.04, 0)) @ Euler((D(90), 0, 0), 'XYZ').to_matrix().to_4x4()
    )
    create_mesh_object("Wheel_AxleCap", bm_brass, m_brass)

    # --- Base Ground Chock (wedge propping wheel) ---
    bm_chock = bmesh.new()
    bmesh.ops.create_cube(
        bm_chock,
        size=1.0,
        matrix=Matrix.Translation((0, -0.15, 0.08)) @ Euler((D(18), 0, 0), 'XYZ').to_matrix().to_4x4() @
               scale_mat(0.26, 0.32, 0.16)
    )
    create_mesh_object("Wheel_Chock", bm_chock, m_chock)

    save_and_export("wagon_wheel")


# ---------------------------------------------------------------------------
# CLI Entrypoint
# ---------------------------------------------------------------------------

BUILDERS = {
    "cactus": build_cactus,
    "crate": build_crate,
    "barrel": build_barrel,
    "fence": build_fence,
    "wagon_wheel": build_wagon_wheel,
}

if __name__ == "__main__":
    target = "all"
    if "--" in sys.argv:
        args = sys.argv[sys.argv.index("--") + 1:]
        if args:
            target = args[0].lower()

    if target == "all":
        for name, fn in BUILDERS.items():
            print(f"\n=== Building {name} ===")
            fn()
    elif target in BUILDERS:
        print(f"\n=== Building {target} ===")
        BUILDERS[target]()
    else:
        print(f"Unknown target '{target}'. Choose from: all, {', '.join(BUILDERS.keys())}")
        sys.exit(1)
