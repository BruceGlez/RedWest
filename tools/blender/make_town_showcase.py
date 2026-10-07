"""
Builds tools/blender/town_showcase.blend
Combines the Frontier Town Buildings (Saloon, Bank, Sheriff, Jail, Gunsmith),
Horse Rigs (Idle, Run, Dead), and Props into an organized studio diorama.
"""

import bpy
import math
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MODELS_DIR = os.path.join(PROJECT_ROOT, 'public', 'models')
BLEND_DIR = os.path.abspath(os.path.dirname(__file__))

def build_showcase():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Lighting
    sun_data = bpy.data.lights.new("Sun", 'SUN')
    sun_data.energy = 3.5
    sun_data.color = (1.0, 0.95, 0.88)
    sun_obj = bpy.data.objects.new("Sun", sun_data)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.location = (10, -15, 20)
    sun_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(-30))

    fill_data = bpy.data.lights.new("Fill", 'SUN')
    fill_data.energy = 1.2
    fill_data.color = (0.85, 0.90, 1.0)
    fill_obj = bpy.data.objects.new("Fill", fill_data)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-15, -10, 12)
    fill_obj.rotation_euler = (math.radians(60), math.radians(-25), math.radians(40))

    # Camera
    cam_data = bpy.data.cameras.new("StudioCamera")
    cam_data.lens = 45
    cam_obj = bpy.data.objects.new("StudioCamera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    cam_obj.location = (0.0, -22.0, 8.5)
    cam_obj.rotation_euler = (math.radians(72), 0, 0)

    # Collections
    col_bld = bpy.data.collections.new("Town_Buildings")
    col_horses = bpy.data.collections.new("Horse_Mounts")
    col_props = bpy.data.collections.new("Props")
    bpy.context.scene.collection.children.link(col_bld)
    bpy.context.scene.collection.children.link(col_horses)
    bpy.context.scene.collection.children.link(col_props)

    # 1. Town Buildings along Main Street (Y = 6.0)
    buildings = [
        ('saloon', os.path.join(MODELS_DIR, 'saloon.glb'), (-17.5, 6.0, 0.0)),
        ('jail', os.path.join(MODELS_DIR, 'jail.glb'), (-8.0, 6.0, 0.0)),
        ('sheriff', os.path.join(MODELS_DIR, 'sheriff.glb'), (0.5, 6.0, 0.0)),
        ('bank', os.path.join(MODELS_DIR, 'bank.glb'), (8.5, 6.0, 0.0)),
        ('gunsmith', os.path.join(MODELS_DIR, 'gunsmith.glb'), (16.5, 6.0, 0.0)),
    ]

    for name, glb_path, loc in buildings:
        if os.path.exists(glb_path):
            existing = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=glb_path)
            new_objs = [o for o in bpy.data.objects if o not in existing]
            root = bpy.data.objects.new(f"{name}_root", None)
            root.location = loc
            col_bld.objects.link(root)
            for o in new_objs:
                if o.parent is None:
                    o.parent = root
                for c in list(o.users_collection):
                    c.objects.unlink(o)
                col_bld.objects.link(o)

    # 2. Horse Mounts in the foreground (Y = -3.0)
    horse_glb = os.path.join(MODELS_DIR, 'horse.glb')
    if os.path.exists(horse_glb):
        horse_configs = [
            ('Idle', 'idle', (-4.2, -3.0, 0.0)),
            ('Run', 'run', (0.0, -3.0, 0.0)),
            ('Dead', 'dead', (4.2, -3.0, 0.0)),
        ]
        for h_name, act_name, loc in horse_configs:
            existing = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=horse_glb)
            imported = [o for o in bpy.data.objects if o not in existing]
            rig = next((o for o in imported if o.type == 'ARMATURE'), None)
            if rig:
                rig.name = f"Horse_{h_name}"
                rig.location = loc
                rig.rotation_euler = (0, 0, math.radians(45))
                rig.show_in_front = True
                rig.data.display_type = 'OCTAHEDRAL'
                act = bpy.data.actions.get(act_name)
                if act and rig.animation_data:
                    rig.animation_data.action = act
            for o in imported:
                for c in list(o.users_collection):
                    c.objects.unlink(o)
                col_horses.objects.link(o)

    # 3. Props along street sides
    props = [
        ('mine_cart', os.path.join(MODELS_DIR, 'mine_cart.glb'), (-12.0, 0.0, 0.0)),
        ('mine_rails', os.path.join(MODELS_DIR, 'mine_rails.glb'), (-12.0, 0.0, 0.0)),
        ('mine_arch', os.path.join(MODELS_DIR, 'mine_arch.glb'), (-22.0, 6.0, 0.0)),
        ('barrel', os.path.join(MODELS_DIR, 'barrel.glb'), (-4.5, 0.5, 0.0)),
        ('crate', os.path.join(MODELS_DIR, 'crate.glb'), (-3.0, 0.5, 0.0)),
        ('wagon_wheel', os.path.join(MODELS_DIR, 'wagon_wheel.glb'), (4.5, 0.5, 0.0)),
        ('fence', os.path.join(MODELS_DIR, 'fence.glb'), (12.0, 0.0, 0.0)),
        ('cactus', os.path.join(MODELS_DIR, 'cactus.glb'), (21.5, 4.0, 0.0)),
    ]
    for name, glb_path, loc in props:
        if os.path.exists(glb_path):
            existing = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=glb_path)
            new_objs = [o for o in bpy.data.objects if o not in existing]
            root = bpy.data.objects.new(f"{name}_prop", None)
            root.location = loc
            col_props.objects.link(root)
            for o in new_objs:
                if o.parent is None:
                    o.parent = root
                for c in list(o.users_collection):
                    c.objects.unlink(o)
                col_props.objects.link(o)

    # Set shading
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'

    out_blend = os.path.join(BLEND_DIR, 'town_showcase.blend')
    bpy.ops.wm.save_as_mainfile(filepath=out_blend)
    print(f"Saved complete town showcase to {out_blend}")

if __name__ == '__main__':
    build_showcase()
