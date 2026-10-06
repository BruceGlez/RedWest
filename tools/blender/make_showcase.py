"""Combines all 5 environment and mine props side by side in Blender,
saves tools/blender/showcase.blend for Desktop Blender, and renders tools/blender/showcase.png.

Usage:
    blender -b --factory-startup --python tools/blender/make_showcase.py
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

def setup_showcase():
    # Factory reset
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not bpy.data.collections:
        col = bpy.data.collections.new("Scene Collection")
        bpy.context.scene.collection.children.link(col)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'

    # Models to import and their side-by-side placements (X, Y, Z, yaw_deg)
    # Arrange from left to right: House, Tree, Rock, Chest, Mushroom
    items = [
        {"name": "house", "glb": MODELS_DIR / "house.glb", "pos": (-7.5, 0.0, 0.0), "rot": 10},
        {"name": "tree", "glb": MODELS_DIR / "tree.glb", "pos": (-1.8, 0.0, 0.0), "rot": -15},
        {"name": "rock", "glb": MODELS_DIR / "rock.glb", "pos": (2.2, 0.0, 0.0), "rot": 25},
        {"name": "mine_chest", "glb": MODELS_DIR / "mine_chest.glb", "pos": (5.8, 0.0, 0.0), "rot": -10},
        {"name": "mine_mushroom", "glb": MODELS_DIR / "mine_mushroom.glb", "pos": (9.2, 0.0, 0.0), "rot": 15},
    ]

    for item in items:
        # Record existing objects before import
        existing_objs = set(scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(item["glb"]))
        new_objs = [o for o in scene.objects if o not in existing_objs]

        # Find root object(s) or shift all new objects together
        # If there is a root parent, move it; otherwise group them
        roots = [o for o in new_objs if o.parent is None]
        pos = Vector(item["pos"])
        rot_z = D(item["rot"])

        if len(roots) == 1:
            root = roots[0]
            root.location = pos
            root.rotation_euler.z += rot_z
        else:
            # Create an empty parent for the asset
            empty = bpy.data.objects.new(f"{item['name']}_group", None)
            scene.collection.objects.link(empty)
            empty.location = pos
            empty.rotation_euler.z = rot_z
            for o in roots:
                o.parent = empty

    # Studio Ground Cyclorama (seamless curved floor + backdrop)
    bm_floor = bmesh.new()
    # Floor plane: 36 wide, 16 deep from Y=-8 to Y=+8
    v1 = bm_floor.verts.new((-18, -8, 0))
    v2 = bm_floor.verts.new((18, -8, 0))
    v3 = bm_floor.verts.new((18, 6, 0))
    v4 = bm_floor.verts.new((-18, 6, 0))
    bm_floor.faces.new((v1, v2, v3, v4))

    # Curved backdrop sweep up at the back (from Y=6, Z=0 to Y=12, Z=10)
    sweep_steps = 8
    prev_v = [v4, v3]
    for s in range(1, sweep_steps + 1):
        t = s / sweep_steps
        y = 6.0 + t * 6.0
        z = (t ** 1.8) * 10.0
        vl = bm_floor.verts.new((-18, y, z))
        vr = bm_floor.verts.new((18, y, z))
        bm_floor.faces.new((prev_v[0], prev_v[1], vr, vl))
        prev_v = [vl, vr]

    floor_mesh = bpy.data.meshes.new("Studio_Backdrop")
    bm_floor.to_mesh(floor_mesh)
    bm_floor.free()
    floor_obj = bpy.data.objects.new("Studio_Backdrop", floor_mesh)
    scene.collection.objects.link(floor_obj)

    # Floor material: warm clean neutral studio beige
    m_floor = bpy.data.materials.new("Studio_Ground")
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
    key_obj.location = Vector((8, -12, 14))
    key_obj.rotation_euler = Euler((D(48), D(18), D(-28)), 'XYZ')
    scene.collection.objects.link(key_obj)

    # 2. Fill Light
    fill_data = bpy.data.lights.new("Studio_Fill", 'SUN')
    fill_data.energy = 1.4
    fill_data.color = (0.86, 0.92, 1.0)
    fill_obj = bpy.data.objects.new("Studio_Fill", fill_data)
    fill_obj.location = Vector((-10, -10, 8))
    fill_obj.rotation_euler = Euler((D(52), D(-22), D(35)), 'XYZ')
    scene.collection.objects.link(fill_obj)

    # 3. Rim / Back Light
    rim_data = bpy.data.lights.new("Studio_Rim", 'SUN')
    rim_data.energy = 1.8
    rim_data.color = (1.0, 0.98, 0.92)
    rim_obj = bpy.data.objects.new("Studio_Rim", rim_data)
    rim_obj.location = Vector((0, 10, 12))
    rim_obj.rotation_euler = Euler((D(-45), D(0), D(180)), 'XYZ')
    scene.collection.objects.link(rim_obj)

    # Wide Showcase Camera framing all 5 props
    cam_data = bpy.data.cameras.new("Showcase_Camera")
    cam_data.lens = 32
    cam_data.clip_start = 0.1
    cam_data.clip_end = 200.0
    cam_obj = bpy.data.objects.new("Showcase_Camera", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    cam_pos = Vector((1.0, -29.0, 8.5))
    target_pos = Vector((1.0, 0.0, 3.2))
    cam_obj.location = cam_pos
    direction = target_pos - cam_pos
    cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    # Render settings: 1920x1080
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'

    blend_file = str(BLENDER_DIR / "showcase.blend")
    render_file = str(BLENDER_DIR / "showcase.png")

    bpy.ops.wm.save_as_mainfile(filepath=blend_file)
    print(f"Saved Blender showcase file: {blend_file}")

    scene.render.filepath = render_file
    bpy.ops.render.render(write_still=True)
    print(f"Rendered showcase image: {render_file}")

if __name__ == "__main__":
    setup_showcase()
