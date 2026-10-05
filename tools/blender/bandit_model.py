"""Generate the 3D Bandit enemy model for Red West directly in Blender.

    blender -b --factory-startup --python tools/blender/bandit_model.py -- [output_glb]

Matches the 2D concept art in art/characters/bandit.jpg:
- Chunky, toy-like vinyl figure proportions (Brawl Stars style)
- Wide-brim dark cowboy hat with pinched crown and hat band
- Stylized face with dark determined eyebrows, cartoon eyes, and side ears
- Red bandana covering lower face with front triangular drape
- Rust-red / orange-brown open duster coat with lapels and cuff rolls
- Off-white / cream shirt, brown belt with gold buckle and hip holster
- Blue denim jeans and sturdy brown cowboy boots
- Rigged to the standard 24-bone Red West humanoid armature
- Carries all 6 standard game animations (idle, run, runShoot, dead, draw, walkShoot)
- Single skinned mesh with 1024x1024 color texture atlas
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT_GLB = argv[0] if argv else "tools/.meshy-cache/bandit-raw.glb"
os.makedirs(os.path.dirname(os.path.abspath(OUT_GLB)), exist_ok=True)

# -----------------------------------------------------------------------------
# 1. Clean scene and import reference armature & animations from marshal.glb
# -----------------------------------------------------------------------------
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.meshes):
    bpy.data.meshes.remove(m, do_unlink=True)
for mat in list(bpy.data.materials):
    bpy.data.materials.remove(mat, do_unlink=True)

ref_path = "public/models/marshal.glb"
bpy.ops.import_scene.gltf(filepath=ref_path)

arm_obj = bpy.data.objects.get("Armature")
if not arm_obj:
    raise RuntimeError("Could not find Armature in marshal.glb")

# Remove the reference mesh 'char1' but keep Armature and actions
mesh_to_remove = [o for o in bpy.data.objects if o.type == "MESH"]
for m in mesh_to_remove:
    bpy.data.objects.remove(m, do_unlink=True)

actions = list(bpy.data.actions)
print(f"Loaded {len(actions)} animations: {[a.name for a in actions]}")

# -----------------------------------------------------------------------------
# 2. Color Palette & Atlas Texture Generation
# -----------------------------------------------------------------------------
PALETTE = {
    'HAT_DARK':    (0.13, 0.12, 0.14, 1.0), # #211f24 dark charcoal hat
    'HAT_BAND':    (0.07, 0.07, 0.08, 1.0), # #121214 black hat band
    'HAT_EDGE':    (0.18, 0.17, 0.20, 1.0), # #2e2b33 brim highlight
    'SKIN':        (0.89, 0.66, 0.51, 1.0), # #e3a882 warm vinyl skin
    'SKIN_SHD':    (0.79, 0.55, 0.41, 1.0), # #ca8c69 ear/shadow skin
    'EYE_WHITE':   (0.97, 0.97, 0.97, 1.0), # #f7f7f7
    'EYE_PUPIL':   (0.09, 0.09, 0.10, 1.0), # #17171a
    'EYE_GLINT':   (1.00, 1.00, 1.00, 1.0), # white specular catchlight
    'HAIR_BROW':   (0.14, 0.10, 0.07, 1.0), # #241a12 dark brown hair/brows
    'BANDANA':     (0.82, 0.18, 0.14, 1.0), # #d12e24 bold red
    'BANDANA_SHD': (0.64, 0.12, 0.09, 1.0), # #a31f17 shaded folds
    'BANDANA_TOP': (0.88, 0.22, 0.17, 1.0), # #e0382b bright top edge
    'COAT_RUST':   (0.72, 0.27, 0.17, 1.0), # #b8452b rust orange-red coat
    'COAT_DARK':   (0.55, 0.19, 0.11, 1.0), # #8c301c dark lapels/cuffs
    'COAT_INNER':  (0.40, 0.14, 0.08, 1.0), # #662414 inside coat
    'SHIRT_CREAM': (0.92, 0.88, 0.83, 1.0), # #ebd1 off-white cream shirt
    'SHIRT_SEAM':  (0.80, 0.75, 0.70, 1.0), # #ccc0b3 placket seam
    'BELT_BROWN':  (0.36, 0.19, 0.09, 1.0), # #5c3017 leather belt
    'BUCKLE_GOLD': (0.82, 0.64, 0.18, 1.0), # #d1a32e gold buckle
    'HOLSTER':     (0.46, 0.26, 0.13, 1.0), # #754221 holster
    'GUN_METAL':   (0.24, 0.25, 0.27, 1.0), # #3d4045 gun cylinder
    'JEANS_BLUE':  (0.25, 0.42, 0.58, 1.0), # #406b94 denim blue jeans
    'JEANS_DUST':  (0.35, 0.47, 0.56, 1.0), # #59788f denim hem fade
    'BOOTS_BROWN': (0.41, 0.25, 0.14, 1.0), # #694024 cowboy boots
    'BOOTS_SOLE':  (0.22, 0.13, 0.07, 1.0), # #382112 dark sole
}

TEX_SIZE = 1024
image = bpy.data.images.new("Bandit_BaseColor", width=TEX_SIZE, height=TEX_SIZE, alpha=True)

PALETTE_UV = {}
cols, rows = 5, 5
cell_w = 1.0 / cols
cell_h = 1.0 / rows

pixels = [0.0] * (TEX_SIZE * TEX_SIZE * 4)
for idx, (name, col) in enumerate(PALETTE.items()):
    c = idx % cols
    r = idx // cols
    u_min, u_max = c * cell_w, (c + 1) * cell_w
    v_min, v_max = r * cell_h, (r + 1) * cell_h
    PALETTE_UV[name] = ((u_min + u_max) * 0.5, (v_min + v_max) * 0.5)

    px_x_min = int(u_min * TEX_SIZE)
    px_x_max = int(u_max * TEX_SIZE)
    px_y_min = int(v_min * TEX_SIZE)
    px_y_max = int(v_max * TEX_SIZE)

    for py in range(px_y_min, px_y_max):
        for px in range(px_x_min, px_x_max):
            offset = (py * TEX_SIZE + px) * 4
            pixels[offset:offset+4] = col

image.pixels.foreach_set(pixels)
image.update()

mat = bpy.data.materials.new("Bandit_Material")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes.get("Principled BSDF")
tex_node = nodes.new("ShaderNodeTexImage")
tex_node.image = image
links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.85
bsdf.inputs["Metallic"].default_value = 0.0

# -----------------------------------------------------------------------------
# 3. Procedural Mesh Construction (Bandit Character)
# -----------------------------------------------------------------------------
main_mesh = bpy.data.meshes.new("Bandit_Mesh")
bandit_obj = bpy.data.objects.new("Bandit", main_mesh)
bpy.context.scene.collection.objects.link(bandit_obj)

bm = bmesh.new()
uv_layer = bm.loops.layers.uv.new("UVMap")

def assign_uv(faces, palette_key):
    u, v = PALETTE_UV[palette_key]
    for f in faces:
        for loop in f.loops:
            loop[uv_layer].uv = (u, v)

def transform_verts(verts, matrix):
    for v in verts:
        v.co = matrix @ v.co

# --- A. BOOTS & FEET (Z: 0 to 20) ---
for side, sign in [('left', 1), ('right', -1)]:
    x = sign * 18.0
    # Sole: rounded front, distinct heel
    res = bmesh.ops.create_cube(bm, size=1.0)
    s_verts = res['verts']
    mat_sole = Matrix.Translation(Vector((x, -3.5, 2.0))) @ Matrix.Diagonal(Vector((14.5, 24.0, 4.0, 1.0)))
    transform_verts(s_verts, mat_sole)
    assign_uv([f for f in bm.faces if any(v in s_verts for v in f.verts)], 'BOOTS_SOLE')

    # Boot body: rounded leather boot with cowboy toe
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=8.2, radius2=9.0, depth=18.0)
    b_verts = res['verts']
    transform_verts(b_verts, Matrix.Translation(Vector((x, -3.0, 12.0))))
    for v in b_verts:
        if v.co.y < -5.0 and v.co.z < 12.0:
            v.co.y -= 4.0 # tapered cowboy toe
            v.co.z *= 0.82
    assign_uv([f for f in bm.faces if any(v in b_verts for v in f.verts)], 'BOOTS_BROWN')

# --- B. LEGS (JEANS) (Z: 18 to 60) ---
for side, sign in [('left', 1), ('right', -1)]:
    x = sign * 18.0
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=9.0, radius2=10.6, depth=40.0)
    l_verts = res['verts']
    transform_verts(l_verts, Matrix.Translation(Vector((x, -1.5, 38.0))))
    assign_uv([f for f in bm.faces if any(v in l_verts for v in f.verts)], 'JEANS_BLUE')

# --- C. HIPS & PELVIS (Z: 52 to 73) ---
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=18.0, radius2=16.0, depth=21.0)
h_verts = res['verts']
mat_hips = Matrix.Translation(Vector((0.0, -1.5, 61.0))) @ Matrix.Diagonal(Vector((1.32, 1.05, 1.0, 1.0)))
transform_verts(h_verts, mat_hips)
assign_uv([f for f in bm.faces if any(v in h_verts for v in f.verts)], 'JEANS_BLUE')

# --- D. BELT & BUCKLE (Z: 68 to 74) ---
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=18.6, radius2=18.0, depth=6.0)
belt_verts = res['verts']
mat_belt = Matrix.Translation(Vector((0.0, -1.8, 71.0))) @ Matrix.Diagonal(Vector((1.30, 1.04, 1.0, 1.0)))
transform_verts(belt_verts, mat_belt)
assign_uv([f for f in bm.faces if any(v in belt_verts for v in f.verts)], 'BELT_BROWN')

# Big gold buckle
res = bmesh.ops.create_cube(bm, size=1.0)
b_verts = res['verts']
mat_buckle = Matrix.Translation(Vector((0.0, -20.2, 71.0))) @ Matrix.Diagonal(Vector((8.5, 2.5, 5.2, 1.0)))
transform_verts(b_verts, mat_buckle)
assign_uv([f for f in bm.faces if any(v in b_verts for v in f.verts)], 'BUCKLE_GOLD')

# Holster on Right hip (X = -19, Y = -3, Z = 59)
res = bmesh.ops.create_cube(bm, size=1.0)
holster_verts = res['verts']
mat_holster = Matrix.Translation(Vector((-19.5, -3.0, 59.0))) @ Euler((0.15, 0.12, 0.18)).to_matrix().to_4x4() @ Matrix.Diagonal(Vector((5.5, 9.0, 18.0, 1.0)))
transform_verts(holster_verts, mat_holster)
assign_uv([f for f in bm.faces if any(v in holster_verts for v in f.verts)], 'HOLSTER')

# Gun handle in holster
res = bmesh.ops.create_cube(bm, size=1.0)
gun_verts = res['verts']
mat_gun = Matrix.Translation(Vector((-19.5, -6.8, 69.0))) @ Euler((0.35, 0.15, 0.0)).to_matrix().to_4x4() @ Matrix.Diagonal(Vector((3.5, 5.8, 7.5, 1.0)))
transform_verts(gun_verts, mat_gun)
assign_uv([f for f in bm.faces if any(v in gun_verts for v in f.verts)], 'GUN_METAL')

# --- E. TORSO (CREAM SHIRT) (Z: 72 to 106) ---
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=16.5, radius2=20.5, depth=32.0)
torso_verts = res['verts']
mat_torso = Matrix.Translation(Vector((0.0, -3.0, 88.0))) @ Matrix.Diagonal(Vector((1.24, 0.96, 1.0, 1.0)))
transform_verts(torso_verts, mat_torso)
assign_uv([f for f in bm.faces if any(v in torso_verts for v in f.verts)], 'SHIRT_CREAM')

# Vertical shirt seam / placket
res = bmesh.ops.create_cube(bm, size=1.0)
placket_verts = res['verts']
mat_placket = Matrix.Translation(Vector((0.0, -18.2, 85.0))) @ Matrix.Diagonal(Vector((3.0, 1.2, 22.0, 1.0)))
transform_verts(placket_verts, mat_placket)
assign_uv([f for f in bm.faces if any(v in placket_verts for v in f.verts)], 'SHIRT_SEAM')

# --- F. DUSTER COAT (COAT BODY, SKIRT & LAPELS) ---
# 1. Lower coat skirt (Z: 44 to 76) draping around back and sides
res = bmesh.ops.create_cone(bm, cap_ends=False, segments=28, radius1=23.0, radius2=19.2, depth=32.0)
skirt_verts = res['verts']
transform_verts(skirt_verts, Matrix.Translation(Vector((0.0, 0.0, 58.0))))
for f in [f for f in bm.faces if any(v in skirt_verts for v in f.verts)]:
    if f.calc_center_bounds().y < -5.5:
        bmesh.ops.delete(bm, geom=[f], context='FACES_ONLY')
assign_uv([f for f in bm.faces if any(v in skirt_verts for v in f.verts)], 'COAT_RUST')

# 2. Upper coat (Z: 74 to 106)
res = bmesh.ops.create_cone(bm, cap_ends=False, segments=28, radius1=20.2, radius2=23.8, depth=32.0)
coat_u_verts = res['verts']
transform_verts(coat_u_verts, Matrix.Translation(Vector((0.0, -1.0, 90.0))) @ Matrix.Diagonal(Vector((1.30, 1.08, 1.0, 1.0))))
for f in [f for f in bm.faces if any(v in coat_u_verts for v in f.verts)]:
    c = f.calc_center_bounds()
    if c.y < -8.5 and abs(c.x) < 11.0:
        bmesh.ops.delete(bm, geom=[f], context='FACES_ONLY')
assign_uv([f for f in bm.faces if any(v in coat_u_verts for v in f.verts)], 'COAT_RUST')

# 3. Wide notched coat lapels (Z: 85 to 107)
for side, sign in [('left', 1), ('right', -1)]:
    res = bmesh.ops.create_cube(bm, size=1.0)
    lapel_verts = res['verts']
    rot = Euler((math.radians(16), math.radians(sign * -16), math.radians(sign * 12)))
    mat_lapel = Matrix.Translation(Vector((sign * 12.0, -13.0, 96.5))) @ rot.to_matrix().to_4x4() @ Matrix.Diagonal(Vector((7.0, 3.0, 20.0, 1.0)))
    transform_verts(lapel_verts, mat_lapel)
    assign_uv([f for f in bm.faces if any(v in lapel_verts for v in f.verts)], 'COAT_DARK')

# --- G. ARMS & SLEEVES (T-POSE) ---
for side, sign in [('left', 1), ('right', -1)]:
    # Shoulder cap (rounded sphere connecting into chest seamlessly)
    res = bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=14, radius=8.8)
    scap_verts = res['verts']
    transform_verts(scap_verts, Matrix.Translation(Vector((sign * 23.5, -3.5, 99.5))))
    assign_uv([f for f in bm.faces if any(v in scap_verts for v in f.verts)], 'COAT_RUST')

    # Upper arm sleeve (X: sign*24 to sign*48)
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=7.6, radius2=6.9, depth=22.0)
    u_arm = res['verts']
    mat_uarm = Matrix.Translation(Vector((sign * 36.0, -3.5, 98.0))) @ Euler((0, math.radians(sign * 90), 0)).to_matrix().to_4x4()
    transform_verts(u_arm, mat_uarm)
    assign_uv([f for f in bm.faces if any(v in u_arm for v in f.verts)], 'COAT_RUST')

    # Forearm sleeve (X: sign*46 to sign*65)
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=6.9, radius2=6.2, depth=18.0)
    f_arm = res['verts']
    mat_farm = Matrix.Translation(Vector((sign * 55.0, -3.5, 97.0))) @ Euler((0, math.radians(sign * 90), 0)).to_matrix().to_4x4()
    transform_verts(f_arm, mat_farm)
    assign_uv([f for f in bm.faces if any(v in f_arm for v in f.verts)], 'COAT_RUST')

    # Rolled-up cuff ring (X: sign*62 to sign*67)
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=7.5, radius2=7.5, depth=5.5)
    cuff_verts = res['verts']
    mat_cuff = Matrix.Translation(Vector((sign * 64.0, -3.5, 96.5))) @ Euler((0, math.radians(sign * 90), 0)).to_matrix().to_4x4()
    transform_verts(cuff_verts, mat_cuff)
    assign_uv([f for f in bm.faces if any(v in cuff_verts for v in f.verts)], 'COAT_DARK')

    # Vinyl Hand with thumb and molded fingers (X: sign*66 to sign*78)
    res = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=5.5)
    palm_verts = res['verts']
    mat_palm = Matrix.Translation(Vector((sign * 70.0, -3.5, 96.0))) @ Matrix.Diagonal(Vector((1.2, 0.85, 0.75, 1.0)))
    transform_verts(palm_verts, mat_palm)
    # Fingers extension
    res = bmesh.ops.create_cube(bm, size=1.0)
    fingers_v = res['verts']
    mat_fing = Matrix.Translation(Vector((sign * 75.0, -3.5, 96.0))) @ Matrix.Diagonal(Vector((5.5, 6.5, 4.5, 1.0)))
    transform_verts(fingers_v, mat_fing)
    # Thumb
    res = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=3.0)
    thumb_verts = res['verts']
    mat_thumb = Matrix.Translation(Vector((sign * 68.5, -8.0, 96.0))) @ Matrix.Diagonal(Vector((1.1, 1.4, 0.9, 1.0)))
    transform_verts(thumb_verts, mat_thumb)
    assign_uv([f for f in bm.faces if any(v in palm_verts or v in fingers_v or v in thumb_verts for v in f.verts)], 'SKIN')

# --- H. NECK & HEAD & FACE (Z: 104 to 142) ---
# Neck column
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=22, radius1=9.5, radius2=9.5, depth=14.0)
neck_verts = res['verts']
transform_verts(neck_verts, Matrix.Translation(Vector((0.0, -4.5, 110.0))))
assign_uv([f for f in bm.faces if any(v in neck_verts for v in f.verts)], 'SKIN')

# Head vinyl sphere
res = bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=20, radius=18.5)
head_verts = res['verts']
mat_head = Matrix.Translation(Vector((0.0, -6.5, 127.5))) @ Matrix.Diagonal(Vector((1.12, 1.06, 1.02, 1.0)))
transform_verts(head_verts, mat_head)
assign_uv([f for f in bm.faces if any(v in head_verts for v in f.verts)], 'SKIN')

# Side ears (X = ±21, Y = -5, Z = 127)
for side, sign in [('left', 1), ('right', -1)]:
    res = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=5.2)
    ear_verts = res['verts']
    mat_ear = Matrix.Translation(Vector((sign * 21.5, -5.0, 127.5))) @ Matrix.Diagonal(Vector((0.55, 1.0, 1.25, 1.0)))
    transform_verts(ear_verts, mat_ear)
    assign_uv([f for f in bm.faces if any(v in ear_verts for v in f.verts)], 'SKIN')

# Determined / angry slanted eyebrows (X = ±8.5, Y = -25.5, Z = 135)
for side, sign in [('left', 1), ('right', -1)]:
    res = bmesh.ops.create_cube(bm, size=1.0)
    brow_verts = res['verts']
    rot = Euler((math.radians(6), math.radians(sign * 24), math.radians(sign * 20)))
    mat_brow = Matrix.Translation(Vector((sign * 8.5, -25.5, 134.8))) @ rot.to_matrix().to_4x4() @ Matrix.Diagonal(Vector((9.5, 3.0, 4.0, 1.0)))
    transform_verts(brow_verts, mat_brow)
    assign_uv([f for f in bm.faces if any(v in brow_verts for v in f.verts)], 'HAIR_BROW')

# Expressive cartoon eyes: White eye dome + Black pupil cylinder + White highlight sphere
for side, sign in [('left', 1), ('right', -1)]:
    # White sclera (rounded pill/cylinder)
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=18, radius1=3.5, radius2=3.5, depth=2.0)
    eye_w = res['verts']
    mat_eyew = Matrix.Translation(Vector((sign * 8.0, -25.2, 127.0))) @ Euler((math.radians(90), 0, 0)).to_matrix().to_4x4() @ Matrix.Diagonal(Vector((1.0, 1.3, 1.0, 1.0)))
    transform_verts(eye_w, mat_eyew)
    assign_uv([f for f in bm.faces if any(v in eye_w for v in f.verts)], 'EYE_WHITE')

    # Large dark pupil
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=2.4, radius2=2.4, depth=1.6)
    eye_p = res['verts']
    mat_eyep = Matrix.Translation(Vector((sign * 8.0, -26.2, 127.0))) @ Euler((math.radians(90), 0, 0)).to_matrix().to_4x4() @ Matrix.Diagonal(Vector((1.0, 1.25, 1.0, 1.0)))
    transform_verts(eye_p, mat_eyep)
    assign_uv([f for f in bm.faces if any(v in eye_p for v in f.verts)], 'EYE_PUPIL')

    # White specular glint
    res = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.9)
    eye_g = res['verts']
    mat_eyeg = Matrix.Translation(Vector((sign * 7.2, -27.1, 128.5)))
    transform_verts(eye_g, mat_eyeg)
    assign_uv([f for f in bm.faces if any(v in eye_g for v in f.verts)], 'EYE_GLINT')

# Hair at sides and back under hat
res = bmesh.ops.create_cube(bm, size=1.0)
hair_verts = res['verts']
mat_hair = Matrix.Translation(Vector((0.0, 6.0, 133.0))) @ Matrix.Diagonal(Vector((23.5, 17.5, 16.0, 1.0)))
transform_verts(hair_verts, mat_hair)
assign_uv([f for f in bm.faces if any(v in hair_verts for v in f.verts)], 'HAIR_BROW')

# --- I. RED BANDANA (Z: 104 to 125) ---
# 1. Bandana wrapping around cheeks and nose (covers mouth completely)
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=20.5, radius2=22.0, depth=18.0)
band_wrap = res['verts']
transform_verts(band_wrap, Matrix.Translation(Vector((0.0, -7.5, 117.5))))
for v in band_wrap:
    if v.co.y < -7.5:
        v.co.y *= 1.26
    if v.co.z > 121.0 and v.co.y < -15.0:
        v.co.y -= 3.8 # bridge of nose crease
assign_uv([f for f in bm.faces if any(v in band_wrap for v in f.verts)], 'BANDANA')

# 2. Large triangular front fold / bib draping down to chest (Z: 92 to 110)
res = bmesh.ops.create_cube(bm, size=1.0)
bib_verts = res['verts']
mat_bib = Matrix.Translation(Vector((0.0, -21.0, 102.5))) @ Euler((math.radians(24), 0, 0)).to_matrix().to_4x4() @ Matrix.Diagonal(Vector((19.5, 4.0, 16.5, 1.0)))
transform_verts(bib_verts, mat_bib)
for v in bib_verts:
    if v.co.z < 103.0:
        factor = max(0.06, (v.co.z - 92.0) / 11.0)
        v.co.x *= factor # sharp triangular point
assign_uv([f for f in bm.faces if any(v in bib_verts for v in f.verts)], 'BANDANA')

# --- J. COWBOY HAT (Z: 138 to 175) ---
# 1. Wide curved brim (radius 43, curved up at sides, dipped front/back)
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=43.5, radius2=42.0, depth=3.5)
brim_verts = res['verts']
transform_verts(brim_verts, Matrix.Translation(Vector((0.0, -6.5, 140.5))))
for v in brim_verts:
    dx = abs(v.co.x)
    dy = v.co.y - (-6.5)
    # Upward curl at sides
    v.co.z += 0.015 * (dx ** 2)
    # Downward dip at front
    if dy < -16.0:
        v.co.z -= 2.8
assign_uv([f for f in bm.faces if any(v in brim_verts for v in f.verts)], 'HAT_DARK')

# 2. Black Hat Band
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=21.5, radius2=20.5, depth=4.8)
band_verts = res['verts']
transform_verts(band_verts, Matrix.Translation(Vector((0.0, -6.0, 144.5))))
assign_uv([f for f in bm.faces if any(v in band_verts for v in f.verts)], 'HAT_BAND')

# 3. Pinched & creased Crown (Z: 144 to 175)
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=21.0, radius2=17.0, depth=29.0)
crown_verts = res['verts']
transform_verts(crown_verts, Matrix.Translation(Vector((0.0, -6.0, 159.0))))
for v in crown_verts:
    dy = v.co.y - (-6.0)
    dx = v.co.x
    # Creased top crown
    if v.co.z > 163.0:
        indent = max(0.0, 6.5 - 0.32 * (dx ** 2))
        v.co.z -= indent
    # Side pinch
    if v.co.z > 149.0 and abs(dy) < 11.0:
        v.co.x *= 0.85
assign_uv([f for f in bm.faces if any(v in crown_verts for v in f.verts)], 'HAT_DARK')

# -----------------------------------------------------------------------------
# 4. Finalize BMesh, Normals, and Material
# -----------------------------------------------------------------------------
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(main_mesh)
bm.free()

bandit_obj.data.materials.append(mat)
bandit_obj.location = (0, 0, 0)
bandit_obj.scale = (1, 1, 1)

for poly in main_mesh.polygons:
    poly.use_smooth = True

print(f"Constructed Bandit mesh: {len(main_mesh.vertices)} vertices, {len(main_mesh.polygons)} polygons")

# -----------------------------------------------------------------------------
# 5. Robust Analytical Distance-Based Skinning
# -----------------------------------------------------------------------------
bone_names = [b.name for b in arm_obj.data.bones]
vgs = {b_name: bandit_obj.vertex_groups.new(name=b_name) for b_name in bone_names}

def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

for v in main_mesh.vertices:
    x, y, z = v.co.x, v.co.y, v.co.z
    weights = {}

    # 1. Head & Hat (Z >= 114)
    if z >= 122.0:
        weights['Head'] = 1.0
    elif z >= 106.0 and abs(x) < 22.0:
        h_factor = smooth((z - 106.0) / 16.0)
        n_factor = 1.0 - h_factor
        weights['Head'] = h_factor
        weights['neck'] = n_factor

    # 2. Left Arm (X > 18, Z between 80 and 112)
    elif x > 18.0 and z >= 80.0:
        if x <= 28.0:
            s_factor = 1.0 - smooth((x - 18.0) / 10.0)
            a_factor = 1.0 - s_factor
            weights['LeftShoulder'] = s_factor
            weights['LeftArm'] = a_factor
        elif x <= 48.0:
            a_factor = 1.0 - smooth((x - 28.0) / 20.0)
            fa_factor = 1.0 - a_factor
            weights['LeftArm'] = a_factor
            weights['LeftForeArm'] = fa_factor
        elif x <= 64.0:
            fa_factor = 1.0 - smooth((x - 48.0) / 16.0)
            h_factor = 1.0 - fa_factor
            weights['LeftForeArm'] = fa_factor
            weights['LeftHand'] = h_factor
        else:
            weights['LeftHand'] = 1.0

    # 3. Right Arm (X < -18, Z between 80 and 112)
    elif x < -18.0 and z >= 80.0:
        rx = -x
        if rx <= 28.0:
            s_factor = 1.0 - smooth((rx - 18.0) / 10.0)
            a_factor = 1.0 - s_factor
            weights['RightShoulder'] = s_factor
            weights['RightArm'] = a_factor
        elif rx <= 48.0:
            a_factor = 1.0 - smooth((rx - 28.0) / 20.0)
            fa_factor = 1.0 - a_factor
            weights['RightArm'] = a_factor
            weights['RightForeArm'] = fa_factor
        elif rx <= 64.0:
            fa_factor = 1.0 - smooth((rx - 48.0) / 16.0)
            h_factor = 1.0 - fa_factor
            weights['RightForeArm'] = fa_factor
            weights['RightHand'] = h_factor
        else:
            weights['RightHand'] = 1.0

    # 4. Legs & Boots (Z < 56)
    elif z < 56.0:
        side = 'Left' if x >= 0 else 'Right'
        if z >= 34.0:
            hip_factor = smooth((z - 34.0) / 22.0)
            up_factor = 1.0 - hip_factor
            weights['Hips'] = hip_factor
            weights[f'{side}UpLeg'] = up_factor
        elif z >= 18.0:
            up_factor = smooth((z - 18.0) / 16.0)
            leg_factor = 1.0 - up_factor
            weights[f'{side}UpLeg'] = up_factor
            weights[f'{side}Leg'] = leg_factor
        elif z >= 8.0:
            leg_factor = smooth((z - 8.0) / 10.0)
            foot_factor = 1.0 - leg_factor
            weights[f'{side}Leg'] = leg_factor
            weights[f'{side}Foot'] = foot_factor
        else:
            if y < -10.0:
                weights[f'{side}ToeBase'] = 0.8
                weights[f'{side}Foot'] = 0.2
            else:
                weights[f'{side}Foot'] = 1.0

    # 5. Torso & Coat (56 <= Z < 106)
    else:
        if z < 68.0:
            weights['Hips'] = 1.0
        elif z < 80.0:
            f = smooth((z - 68.0) / 12.0)
            weights['Hips'] = 1.0 - f
            weights['Spine02'] = f
        elif z < 92.0:
            f = smooth((z - 80.0) / 12.0)
            weights['Spine02'] = 1.0 - f
            weights['Spine01'] = f
        elif z < 102.0:
            f = smooth((z - 92.0) / 10.0)
            weights['Spine01'] = 1.0 - f
            weights['Spine'] = f
        else:
            f = smooth((z - 102.0) / 4.0)
            weights['Spine'] = 1.0 - f
            weights['neck'] = f

    top = sorted(weights.items(), key=lambda kv: -kv[1])[:4]
    total_w = sum(w for _, w in top) or 1.0
    for name, w in top:
        if w / total_w > 0.005:
            vgs[name].add([v.index], w / total_w, 'REPLACE')

arm_mod = bandit_obj.modifiers.new("Armature", "ARMATURE")
arm_mod.object = arm_obj
bandit_obj.parent = arm_obj

print("Applied smooth analytical skinning weights.")

# -----------------------------------------------------------------------------
# 6. Check polycount
# -----------------------------------------------------------------------------
tri_count = sum(len(p.vertices) - 2 for p in main_mesh.polygons)
print(f"Total triangle count: {tri_count}")

# -----------------------------------------------------------------------------
# 7. Push all Actions to NLA Tracks for glTF Multi-Animation Export
# -----------------------------------------------------------------------------
if not arm_obj.animation_data:
    arm_obj.animation_data_create()

for action in actions:
    track = arm_obj.animation_data.nla_tracks.new()
    track.name = action.name
    track.strips.new(action.name, int(action.frame_range[0]), action)

# -----------------------------------------------------------------------------
# 8. Export glTF Binary (.glb)
# -----------------------------------------------------------------------------
for o in bpy.context.selected_objects:
    o.select_set(False)
bandit_obj.select_set(True)
arm_obj.select_set(True)
bpy.context.view_layer.objects.active = arm_obj

print(f"Exporting to {OUT_GLB}...")
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format='GLB',
    use_selection=True,
    export_apply=False,
    export_animations=True,
    export_nla_strips=True,
    export_def_bones=True,
    export_materials='EXPORT',
    export_image_format='JPEG',
    export_jpeg_quality=90
)

print(f"Export complete: {OUT_GLB}")
