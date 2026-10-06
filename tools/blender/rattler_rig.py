"""Build, rig and animate the Red West rattlesnake without any outside model.

    blender -b --factory-startup --python tools/blender/rattler_rig.py -- <out.glb> [<out.blend>]

Made from art/characters/rattler.jpg: a raised head, a cream belly, brown diamonds on a gold back and a
rattle. Everything is built from code, so it runs again without the Blender MCP. Then:
    node tools/optimize-model.mjs <out.glb> public/models/rattler.glb

Blender 5.x. The snake faces -Y in Blender (+Z in the game), tail toward +Y. The rig is `root` plus
`seg01`..`seg12` head to tail in a straight line (README.md). Bones point along +Y with no roll, so a
bone's rotation about Z is a side-to-side sway and about X is a nod (+ lowers the head forward).
"""
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else None
BLEND = argv[1] if len(argv) > 1 else None

D, S, TAU = math.radians, math.sin, 2 * math.pi
NSEG, SEG_LEN, Y0, BONE_Z = 12, 0.3, -0.9, 0.30

# --------------------------------------------------------------- clean up
if bpy.app.background:
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
else:  # a live Blender session: only remove an earlier run of this script
    for o in list(bpy.data.objects):
        if o.name.startswith("Rattler"):
            bpy.data.objects.remove(o, do_unlink=True)

# --------------------------------------------------------------- materials
def material(name, rgb, rough=0.65):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    n = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    n.inputs["Base Color"].default_value = (*rgb, 1)
    n.inputs["Roughness"].default_value = rough
    return m


MATS = [
    material("Rattler_Gold", (0.62, 0.40, 0.04)),
    material("Rattler_Cream", (0.80, 0.66, 0.38)),
    material("Rattler_Brown", (0.20, 0.07, 0.015)),
    material("Rattler_Rattle", (0.50, 0.26, 0.06)),
    material("Rattler_Eye", (0.01, 0.01, 0.01), 0.2),
    material("Rattler_Shine", (0.9, 0.9, 0.9), 0.3),
]
GOLD, CREAM, BROWN, RATTLE, EYE, SHINE = range(6)

# --------------------------------------------------------------- body: rings along a centre line
CTRL = [(0, -0.78, 1.00), (0, -0.70, 0.86), (0, -0.52, 0.64), (0, -0.28, 0.44), (0, 0.0, 0.34),
        (0.12, 0.5, 0.28), (0, 1.0, 0.28), (-0.12, 1.5, 0.29), (0, 2.0, 0.32), (0, 2.35, 0.45), (0, 2.5, 0.62)]
RADIUS = [(-0.8, 0.20), (-0.5, 0.21), (0.0, 0.30), (0.6, 0.36), (1.2, 0.33), (1.8, 0.22), (2.3, 0.12), (2.5, 0.08)]
RINGS, M = 72, 24


def catmull(p0, p1, p2, p3, t):
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)


def centre(u):
    pts = [Vector(p) for p in CTRL]
    f = u * (len(pts) - 1)
    i = min(int(f), len(pts) - 2)
    a, b, c, d = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
    return catmull(a, b, c, d, f - i)


def radius(y):
    for (y0, r0), (y1, r1) in zip(RADIUS, RADIUS[1:]):
        if y <= y1:
            return r0 + (r1 - r0) * max(0.0, (y - y0) / (y1 - y0))
    return RADIUS[-1][1]


bm = bmesh.new()
centres = [centre(i / (RINGS - 1)) for i in range(RINGS)]
rings = []
for i, c in enumerate(centres):
    tan = (centres[min(i + 1, RINGS - 1)] - centres[max(i - 1, 0)]).normalized()
    side = tan.cross(Vector((0, 0, 1))).normalized()
    up = side.cross(tan)
    r = radius(c.y)
    rings.append([bm.verts.new(c + side * r * math.cos(TAU * k / M) + up * r * 0.88 * math.sin(TAU * k / M)) for k in range(M)])
tube_verts = {v for ring in rings for v in ring}
for i in range(RINGS - 1):
    y = centres[i].y
    phase = (y - 0.15) % 0.55
    for k in range(M):
        f = bm.faces.new((rings[i][k], rings[i][(k + 1) % M], rings[i + 1][(k + 1) % M], rings[i + 1][k]))
        a = TAU * (k + 0.5) / M
        mat = GOLD
        if S(a) < -0.45:
            mat = CREAM
        elif -0.3 < y < 2.15 and S(a) > 0.2 and phase < 0.36:
            tri = 1 - abs(2 * phase / 0.36 - 1)
            if abs(math.cos(a)) < 0.20 + 0.75 * tri:
                mat = BROWN
        f.material_index = mat

# head, eyes, rattle: separate bmesh islands joined into the same mesh
head_verts = set()


def blob(centre_, scale, mat, segs=24, rings_=14):
    geo = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings_, radius=1.0)["verts"]
    bmesh.ops.scale(bm, vec=Vector(scale), verts=geo)
    bmesh.ops.translate(bm, vec=Vector(centre_), verts=geo)
    faces = {f for v in geo for f in v.link_faces}
    for f in faces:
        f.material_index = mat
    return geo, faces


HEAD_C = Vector((0, -0.88, 1.06))
geo, faces = blob(HEAD_C, (0.31, 0.40, 0.24), GOLD)
head_verts.update(geo)
for f in faces:
    c = f.calc_center_median()
    if c.z < HEAD_C.z - 0.03:
        f.material_index = CREAM                               # chin and throat
    elif c.z > HEAD_C.z + 0.10 and abs(c.x) < 0.09 and c.y < HEAD_C.y + 0.1:
        f.material_index = BROWN                               # the marking on the crown
for sx in (-1, 1):
    g, _ = blob((sx * 0.245, -1.02, 1.15), (0.095, 0.095, 0.105), EYE, 16, 10)
    head_verts.update(g)
    g, _ = blob((sx * 0.27, -1.085, 1.19), (0.032, 0.028, 0.028), SHINE, 10, 6)
    head_verts.update(g)

tip, tail = centres[-1], (centres[-1] - centres[-3]).normalized()
rattle_verts = set()
for k, r in enumerate((0.085, 0.105, 0.115, 0.105, 0.075)):
    g, _ = blob(tip + tail * (0.10 + 0.13 * k), (r, r, r * 0.75), RATTLE, 16, 10)
    rattle_verts.update(g)

bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("Rattler_Mesh")
bm.to_mesh(me)
for m in MATS:
    me.materials.append(m)
for p in me.polygons:
    p.use_smooth = True
head_idx = {v.index for v in head_verts}
bm.free()
mesh = bpy.data.objects.new("Rattler_Mesh", me)
bpy.context.scene.collection.objects.link(mesh)
# stand on the ground: lowest point at Z = 0
lowest = min(v.co.z for v in me.vertices)
me.transform(Matrix.Translation((0, 0, -lowest)))
BZ = BONE_Z - lowest

# --------------------------------------------------------------- armature
arm_data = bpy.data.armatures.new("Rattler_Rig")
rig = bpy.data.objects.new("Rattler_Rig", arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones
b = eb.new("root"); b.head = (0, Y0, 0); b.tail = (0, Y0, 0.2); b.use_deform = False
for k in range(NSEG):
    b = eb.new(f"seg{k + 1:02d}")
    b.head = (0, Y0 + SEG_LEN * k, BZ); b.tail = (0, Y0 + SEG_LEN * (k + 1), BZ)
    b.parent = eb["root"] if k == 0 else eb[f"seg{k:02d}"]
    b.use_connect = k > 0
    b.roll = 0
bpy.ops.object.mode_set(mode="OBJECT")

# --------------------------------------------------------------- skin: the head is rigid, the body blends by Y
for k in range(NSEG):
    mesh.vertex_groups.new(name=f"seg{k + 1:02d}")
for v in me.vertices:
    if v.index in head_idx:
        mesh.vertex_groups["seg01"].add([v.index], 1.0, "REPLACE")
        continue
    u = max(0.0, min(NSEG - 1.0001, (v.co.y - Y0) / SEG_LEN))
    i = int(u); f = u - i
    mesh.vertex_groups[f"seg{i + 1:02d}"].add([v.index], 1 - f, "REPLACE")
    if f > 0:
        mesh.vertex_groups[f"seg{i + 2:02d}"].add([v.index], f, "REPLACE")
mesh.parent = rig
mod = mesh.modifiers.new("Armature", "ARMATURE"); mod.object = rig

# --------------------------------------------------------------- clips (30 fps)
sc = bpy.context.scene
sc.render.fps = 30; sc.render.fps_base = 1.0
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="POSE")
pbs = rig.pose.bones
for pb in pbs:
    pb.rotation_mode = "XYZ"
rig.animation_data_create()
segs = [f"seg{k + 1:02d}" for k in range(NSEG)]


def reset():
    for pb in pbs:
        pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0)


def key(f):
    for n in segs:
        pbs[n].keyframe_insert("rotation_euler", frame=f)


def new_action(name):
    a = bpy.data.actions.new(name); a.use_fake_user = True
    rig.animation_data.action = a


def smooth(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)


# idle: 2 s loop (frames 1..61, 61 == 1). A slow sway travelling to the tail, the head bobbing, the rattle quivering.
new_action("idle")
for f in range(1, 62, 2):
    reset(); ph = TAU * (f - 1) / 60
    for i, n in enumerate(segs):
        pbs[n].rotation_euler.z = D(3.5) * S(ph - 0.45 * i)
    pbs["seg01"].rotation_euler.x = D(-2.5) * S(ph + 1.0)
    pbs["seg02"].rotation_euler.x = D(1.5) * S(ph + 1.0)
    for i, n in enumerate(segs[-3:]):
        pbs[n].rotation_euler.z += D(7) * S(TAU * 6 * (f - 1) / 60 - i)
    key(f)

# run: 0.6 s loop (frames 1..19, 19 == 1). A side-to-side wave travelling tail-ward, in place.
new_action("run")
for f in range(1, 20):
    reset(); ph = TAU * (f - 1) / 18
    for i, n in enumerate(segs):
        pbs[n].rotation_euler.z = D(11) * S(ph - 0.85 * i)
    pbs["seg01"].rotation_euler.x = D(-3) * S(2 * ph)
    key(f)

# dead: 0.8 s, then holds. The head drops, the body goes limp and curls sideways.
new_action("dead")
for f in range(1, 25):
    reset(); t = smooth((f - 1) / 18)
    pbs["seg01"].rotation_euler.x = D(60) * t      # children inherit it, so seg02 and seg03 cancel it:
    pbs["seg02"].rotation_euler.x = D(-45) * t     # only the head and neck drop, the body stays down
    pbs["seg03"].rotation_euler.x = D(-15) * t
    for i, n in enumerate(segs):
        pbs[n].rotation_euler.z = D(16) * t * S(0.9 * i)
    key(f)
reset()
rig.animation_data.action = bpy.data.actions["idle"]
sc.frame_start, sc.frame_end = 1, 61
bpy.ops.object.mode_set(mode="OBJECT")

# --------------------------------------------------------------- export
if OUT:
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True); rig.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format="GLB", use_selection=True, export_skins=True, export_animations=True,
        export_animation_mode="ACTIONS", export_nla_strips=False, export_yup=True, export_apply=True,
        export_force_sampling=True, export_materials="EXPORT", export_image_format="AUTO")
if BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
print("rattler:", len(me.polygons), "faces, bones", len(rig.data.bones))
