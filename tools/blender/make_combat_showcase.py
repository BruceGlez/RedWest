"""Combines all 5 combat props side by side in Blender,
saves tools/blender/combat_showcase.blend for Desktop Blender, and renders tools/blender/combat_showcase.png.

Usage:
    blender -b --factory-startup --python tools/blender/make_combat_showcase.py
"""
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector, Euler

ROOT = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = ROOT / "public" / "models"
BLENDER_DIR = ROOT / "tools" / "blender"

D = math.radians

def setup_combat_showcase():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not bpy.data.collections:
        col = bpy.data.collections.new("Scene Collection")
        bpy.context.scene.collection.children.link(col)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'

    # Models to import and side-by-side placements (X, Y, Z, yaw_deg)
    # Order: Fence, Cactus, Crate, Barrel, Wagon Wheel
    items = [
        {"name": "fence", "glb": MODELS_DIR / "fence.glb", "pos": (-6.4, 0.0, 0.0), "rot": 10},
        {"name": "cactus", "glb": MODELS_DIR / "cactus.glb", "pos": (-2.6, 0.0, 0.0), "rot": -15},
        {"name": "crate", "glb": MODELS_DIR / "crate.glb", "pos": (0.7, 0.0, 0.0), "rot": 18},
        {"name": "barrel", "glb": MODELS_DIR / "barrel.glb", "pos": (3.8, 0.0, 0.0), "rot": -12},
        {"name": "wagon_wheel", "glb": MODELS_DIR / "wagon_wheel.glb", "pos": (6.8, 0.0, 0.0), "rot": 20},
    ]

    for item in items:
        existing_objs = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(item["glb"]))
        new_objs = [o for o in scene.objects if o not in existing_objs]

        roots = [o for o in new_objs if o.parent is None]
        pos = Vector(item["pos"])
        rot_z = D(item["rot"])

        if len(roots) == 1:
            root = roots[0]
            root.location = pos
            root.rotation_euler.z += rot_z
        else:
            empty = bpy.data.objects.new(f"{item['name']}_group", None)
            scene.collection.objects.link(empty)
            empty.location = pos
            empty.rotation_euler.z = rot_z
            for o in roots:
                o.parent = empty

    # Studio Ground Cyclorama (seamless curved floor + backdrop)
    bm_floor = bmesh.new()
    v1 = bm_floor.verts.new((-16, -6, 0))
    v2 = bm_floor.verts.new((16, -6, 0))
    v3 = bm_floor.verts.new((16, 5, 0))
    v4 = bm_floor.verts.new((-16, 5, 0))
    bm_floor.faces.new((v1, v2, v3, v4))

    # Curved backdrop sweep up
    sweep_steps = 8
    prev_v = [v4, v3]
    for s in range(1, sweep_steps + 1):
        t = s / sweep_steps
        y = 5.0 + t * 5.0
        z = (t ** 1.8) * 8.0
        vl = bm_floor.verts.new((-16, y, z))
        vr = bm_floor.verts.new((16, y, z))
        bm_floor.faces.new((prev_v[0], prev_v[1], vr, vl))
        prev_v = [vl, vr]

    floor_mesh = bpy.data.meshes.new("Studio_Backdrop")
    bm_floor.to_mesh(floor_mesh)
    bm_floor.free()
    floor_obj = bpy.data.objects.new("Studio_Backdrop", floor_mesh)
    scene.collection.objects.link(floor_obj)

    m_floor = bpy.data.materials.new("Studio_Ground")
    if hasattr(m_floor, "use_nodes") and not m_floor.use_nodes:
        m_floor.use_nodes = True
    bsdf = next(n for n in m_floor.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.91, 0.88, 0.84, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.95
    floor_obj.data.materials.append(m_floor)

    # Studio Lighting
    # 1. Main Sun / Key Light
    key_data = bpy.data.lights.new("Studio_Key", 'SUN')
    key_data.energy = 3.6
    key_data.color = (1.0, 0.96, 0.90)
    key_obj = bpy.data.objects.new("Studio_Key", key_data)
    key_obj.location = Vector((8, -10, 14))
    key_obj.rotation_euler = Euler((D(42), D(12), D(-35)), 'XYZ')
    scene.collection.objects.link(key_obj)

    # 2. Cool Fill Light
    fill_data = bpy.data.lights.new("Studio_Fill", 'SUN')
    fill_data.energy = 1.3
    fill_data.color = (0.85, 0.90, 1.0)
    fill_obj = bpy.data.objects.new("Studio_Fill", fill_data)
    fill_obj.location = Vector((-10, -8, 8))
    fill_obj.rotation_euler = Euler((D(50), D(-18), D(45)), 'XYZ')
    scene.collection.objects.link(fill_obj)

    # 3. Soft Rim Light
    rim_data = bpy.data.lights.new("Studio_Rim", 'SUN')
    rim_data.energy = 1.0
    rim_data.color = (1.0, 0.95, 0.85)
    rim_obj = bpy.data.objects.new("Studio_Rim", rim_data)
    rim_obj.location = Vector((0, 10, 6))
    rim_obj.rotation_euler = Euler((D(-40), 0, D(180)), 'XYZ')
    scene.collection.objects.link(rim_obj)

    # Camera setup (framing all 5 props)
    cam_data = bpy.data.cameras.new("Showcase_Camera")
    cam_data.lens = 40
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0
    cam_obj = bpy.data.objects.new("Showcase_Camera", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Position camera pulled back to comfortably frame the entire width and height
    cam_obj.location = Vector((0.0, -20.5, 4.2))
    target = Vector((0.0, 0.0, 2.2))
    dir_vec = target - cam_obj.location
    rot_quat = dir_vec.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

    # Render settings
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    # Save .blend
    blend_path = str(BLENDER_DIR / "combat_showcase.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"Saved showcase .blend: {blend_path}")

    # Render PNG
    png_path = str(BLENDER_DIR / "combat_showcase.png")
    scene.render.filepath = png_path
    bpy.ops.render.render(write_still=True)
    print(f"Rendered showcase image: {png_path}")

if __name__ == "__main__":
    setup_combat_showcase()
