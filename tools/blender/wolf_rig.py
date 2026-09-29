"""Rig and animate the Red West wolf without the Blender MCP.

    blender -b --factory-startup --python tools/blender/wolf_rig.py -- <raw.glb> <out.glb> [<out.blend>]

<raw.glb> is the un-rigged Meshy wolf (Meshy_AI_Stoic_Wolf_Pup_0929160849_texture.glb). This is the same
work that was done by hand through the MCP on 2026-09-29 (see README.md): clean the mesh, build the
quadruped armature with the bone names in README.md, bind and fix the weights, key the clips idle, run and
dead at 30 fps, and export a glTF Binary. Then run `node tools/optimize-model.mjs <out.glb> public/models/wolf.glb`.

Blender 5.x. The wolf faces -Y in Blender (+Z in the game); the left legs are on +X. Bone pitch is a rotation
about the bone's local Z, which the armature builds to be world X: + swings a leg back, lowers the head and
raises the tail.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    raise SystemExit("usage: blender -b --factory-startup --python wolf_rig.py -- raw.glb out.glb [out.blend]")
RAW, OUT = argv[0], argv[1]
BLEND = argv[2] if len(argv) > 2 else None

D, S, TAU = math.radians, math.sin, 2 * math.pi
TRIS = 8000

# ------------------------------------------------------------------ 1. mesh
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=RAW)
mesh = next(o for o in bpy.data.objects if o.type == "MESH")
mesh.name = "Mesh_0"
me = mesh.data

# Meshy's export is split open at every UV seam: weld it into one closed mesh first (decimating the split
# mesh leaves gaps, and Blender's automatic weights then fail on every vertex).
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(me); bm.free()
# origin between the feet: centred in X and Y, lowest point at Z = 0
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
me.transform(Matrix.Translation(-Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))))
mesh.location = (0, 0, 0)
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
mod = mesh.modifiers.new("Decimate", "DECIMATE")
mod.decimate_type = "COLLAPSE"
mod.ratio = TRIS / len(me.polygons)
mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=mod.name)
me = mesh.data

# ------------------------------------------------------------------ 2. armature
arm_data = bpy.data.armatures.new("WolfRig")
rig = bpy.data.objects.new("WolfRig", arm_data)
bpy.context.scene.collection.objects.link(rig)
for o in bpy.context.selected_objects:
    o.select_set(False)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones


def bone(name, head, tail, parent=None, connect=False, deform=True):
    b = eb.new(name); b.head = Vector(head); b.tail = Vector(tail)
    if parent:
        b.parent = eb[parent]; b.use_connect = connect
    b.use_deform = deform


# (x, y, z); left = +X
bone("root", (0, 0.10, 0.00), (0, 0.10, 0.20), deform=False)
bone("spine01", (0, 0.50, 0.62), (0, 0.28, 0.62), "root")
bone("spine02", (0, 0.28, 0.62), (0, 0.05, 0.62), "spine01", True)
bone("spine03", (0, 0.05, 0.62), (0, -0.20, 0.66), "spine02", True)
bone("neck", (0, -0.20, 0.66), (0, -0.40, 0.90), "spine03", True)
bone("head", (0, -0.40, 0.90), (0, -0.92, 0.85), "neck", True)
bone("tail01", (0, 0.55, 0.72), (0, 0.70, 0.82), "spine01")
bone("tail02", (0, 0.70, 0.82), (0, 0.83, 0.98), "tail01", True)
bone("tail03", (0, 0.83, 0.98), (0, 0.96, 1.12), "tail02", True)
for s, x in (("l", 0.27), ("r", -0.27)):
    bone(f"f{s}_upper", (x, -0.36, 0.58), (x, -0.36, 0.32), "spine03")
    bone(f"f{s}_lower", (x, -0.36, 0.32), (x, -0.38, 0.09), f"f{s}_upper", True)
    bone(f"f{s}_foot", (x, -0.38, 0.09), (x, -0.50, 0.03), f"f{s}_lower", True)
    bone(f"b{s}_upper", (x, 0.40, 0.62), (x, 0.48, 0.34), "spine01")
    bone(f"b{s}_lower", (x, 0.48, 0.34), (x, 0.53, 0.14), f"b{s}_upper", True)
    bone(f"b{s}_foot", (x, 0.53, 0.14), (x, 0.32, 0.03), f"b{s}_lower", True)
for b in eb:
    b.align_roll(Vector((1, 0, 0)))          # local Z = world X: bends happen in the side plane
bpy.ops.object.mode_set(mode="OBJECT")

# ------------------------------------------------------------------ 3. bind and fix the weights
for o in bpy.context.selected_objects:
    o.select_set(False)
mesh.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

vgs = mesh.vertex_groups
idx = {g.name: g.index for g in vgs}
nm = {g.index: g.name for g in vgs}


def smooth(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)


for v in mesh.data.vertices:
    w = {nm[g.group]: g.weight for g in v.groups if g.weight > 0}
    x, y, z = v.co
    # a leg never carries weight from the far side of the body
    for n in list(w):
        if len(n) > 3 and n[2] == "_" and n[0] in "fb" and n[1] in "lr":
            if (n[1] == "l" and x < -0.03) or (n[1] == "r" and x > 0.03):
                dst = "spine03" if n[0] == "f" else "spine01"
                w[dst] = w.get(dst, 0) + w.pop(n)
    # skull and snout follow head, the collar blends into neck, shoulders and chest follow spine03
    total = sum(w.pop(k, 0) for k in ("head", "neck", "spine03"))
    if total > 0:
        h = smooth((-0.30 - y) / 0.15) * smooth((z - 0.5) / 0.2)
        n = (1 - h) * (1 - smooth((y + 0.25) / 0.20))
        if z < 0.5:
            n = 0
        s = max(0.0, 1 - h - n)
        for k, f in (("head", h), ("neck", n), ("spine03", s)):
            if f > 0:
                w[k] = w.get(k, 0) + total * f
    top = sorted(w.items(), key=lambda kv: -kv[1])[:4]      # glTF and the game use 4 bones per vertex
    tot = sum(a for _, a in top) or 1.0
    for g in vgs:
        g.remove([v.index])
    for k, a in top:
        if a / tot > 0.005:
            vgs[idx[k]].add([v.index], a / tot, "REPLACE")

# ------------------------------------------------------------------ 4. clips
sc = bpy.context.scene
sc.render.fps = 30; sc.render.fps_base = 1.0
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="POSE")
pbs = rig.pose.bones
for pb in pbs:
    pb.rotation_mode = "QUATERNION" if pb.name == "root" else "XYZ"
if rig.animation_data is None:
    rig.animation_data_create()
root = pbs["root"]
rest = root.bone.matrix_local.copy()
dg = bpy.context.evaluated_depsgraph_get()


def reset():
    for pb in pbs:
        pb.location = (0, 0, 0); pb.rotation_euler = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0)


def pitch(n, deg): pbs[n].rotation_euler.z = D(deg)
def sway(n, deg): pbs[n].rotation_euler.x = D(deg)


def key_all(f):
    for pb in pbs:
        if pb.name == "root":
            pb.keyframe_insert("location", frame=f); pb.keyframe_insert("rotation_quaternion", frame=f)
        else:
            pb.keyframe_insert("rotation_euler", frame=f)


def new_action(name):
    a = bpy.data.actions.new(name); a.use_fake_user = True
    rig.animation_data.action = a
    return a


def lowest():
    dg.update(); ev = mesh.evaluated_get(dg); m = ev.to_mesh()
    z = min(v.co.z for v in m.vertices); ev.to_mesh_clear(); return z


def key_root(f, matrix):
    root.matrix = matrix; root.keyframe_insert("location", frame=f)


# ---- idle: 2 s loop, frames 1..61 (61 == 1). Breathing, a nod, the tail swaying with a delay.
a = new_action("idle")
for f in range(1, 62, 2):
    reset(); ph = TAU * (f - 1) / 60
    pitch("spine02", 1.2 * S(ph)); pitch("spine03", 1.5 * S(ph - 0.3)); pitch("spine01", 0.6 * S(ph))
    pitch("neck", 1.5 * S(ph - 0.6)); pitch("head", 2.0 * S(ph - 0.9))
    for i, t in enumerate(("tail01", "tail02", "tail03")):
        sway(t, 9 * S(ph - 0.7 * i)); pitch(t, 2.5 * S(ph - 0.7 * i - 1.0))
    key_all(f)

# ---- run: a four-beat gallop, 16 frames (0.53 s), frames 1..17 (17 == 1), in place.
# One key pose per phase of the stride: 0 gather, 1 rear push, 2 extended flight, 3 first front contact,
# 4 second front contact, 5 rear legs swing forward, 6 rear contact, 7 loading. (upper, lower, foot) degrees.
FRONT = [(30, 70, 20), (0, 85, 10), (-42, -8, -8), (-36, -4, -4), (-14, 8, 0), (6, 16, 4), (20, 28, 10), (28, 48, 16)]
HIND = [(-50, 65, -22), (12, 0, 12), (48, -30, 28), (40, -20, 25), (10, 25, 0), (-35, 60, -20), (-45, 55, -20), (-50, 62, -22)]
SPINE = [10, 3, -6, -3, 3, 7, 9, 10]       # + arched and short, - stretched long
LAG = {"fr": 0.0, "fl": 0.14, "bl": 0.0, "br": 0.05}   # paws land one after another (fraction of the cycle)


def cr(K, t):                                # periodic Catmull-Rom through 8 evenly spaced keys
    x = (t % 1.0) * 8; i = int(math.floor(x)); u = x - i
    p0, p1, p2, p3 = K[(i - 1) % 8], K[i % 8], K[(i + 1) % 8], K[(i + 2) % 8]
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)


a = new_action("run")
for f in range(1, 18):
    reset(); t = (f - 1) / 16
    for leg, table in (("fr", FRONT), ("fl", FRONT), ("bl", HIND), ("br", HIND)):
        for i, part in enumerate(("upper", "lower", "foot")):
            pitch(f"{leg}_{part}", cr([k[i] for k in table], t - LAG[leg]))
    fx = cr(SPINE, t)
    pitch("spine01", -0.6 * fx); pitch("spine02", fx); pitch("spine03", fx)   # arch: hips up, shoulders down
    pitch("neck", 3 - 0.6 * fx); pitch("head", 4 - 0.6 * fx)                  # the head stays steady
    for i, tn in enumerate(("tail01", "tail02", "tail03")):
        pitch(tn, 8 * S(TAU * t - 1.0 - 0.5 * i)); sway(tn, 4 * S(TAU * t - 1.0 - 0.5 * i + 1.2))
    key_all(f)
# Vertical only (no travel): a hop while airborne, the lowest paw held on the floor while planted.
lifts = {}
for f in range(1, 17):
    sc.frame_set(f); t = (f - 1) / 16
    air = smooth((t - 0.10) / 0.07) * (1 - smooth((t - 0.34) / 0.07)); z = lowest()
    lifts[f] = max((1 - air) * (-z) + air * 0.15, -z)
lifts[17] = lifts[1]
for f, lift in lifts.items():
    sc.frame_set(f); key_root(f, Matrix.Translation((0, 0, lift)) @ rest)

# ---- dead: falls on its left side and holds the last frame (frames 1..36)
a = new_action("dead")
pivot = Vector((0, 0.10, 0))
#      frame: (roll, f_up, f_low, f_foot, b_up, b_low, b_foot, spine, neck, head, tail)
DEAD = {1: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), 7: (20, 10, 30, 10, -5, 15, 0, 3, 5, 8, -5),
        13: (60, 0, 20, 15, 15, -10, 10, 5, 15, 25, -15), 19: (94, -25, -10, -10, 25, -15, 20, 0, 18, 30, -25),
        26: (90, -20, -5, -8, 20, -10, 15, 0, 15, 25, -20), 36: (90, -20, -5, -8, 20, -10, 15, 0, 15, 25, -20)}
for f, (roll, fu, fl_, ff, bu, bl, bf, sp, nk, hd, tl) in DEAD.items():
    reset()
    for s, o in (("l", 0), ("r", 4)):
        pitch(f"f{s}_upper", fu + o * (fu != 0)); pitch(f"f{s}_lower", fl_); pitch(f"f{s}_foot", ff)
        pitch(f"b{s}_upper", bu - o * (bu != 0)); pitch(f"b{s}_lower", bl); pitch(f"b{s}_foot", bf)
    for n in ("spine01", "spine02", "spine03"):
        pitch(n, sp)
    pitch("neck", nk); pitch("head", hd)
    for tn in ("tail01", "tail02", "tail03"):
        pitch(tn, tl)
    th = D(roll)
    root.matrix = (Matrix.Translation((0, 0, 0.46 * S(th))) @ Matrix.Translation(pivot)
                   @ Matrix.Rotation(th, 4, "Y") @ Matrix.Translation(-pivot) @ rest)
    bpy.context.view_layer.update()
    key_all(f)
# keep the body above the floor: at the key frames, then on every frame that still dips below it
for f in (7, 13, 19, 26, 36):
    sc.frame_set(f); need = -lowest()
    if need > 0.002:
        key_root(f, Matrix.Translation((0, 0, need)) @ root.matrix)
for f in range(2, 36):
    sc.frame_set(f); z = lowest()
    if z < -0.002:
        key_root(f, Matrix.Translation((0, 0, -z)) @ root.matrix)

# ---- move every clip to start at frame 0, so the game's clips start at time 0 and loop at their length
RANGES = {"idle": (0, 60), "run": (0, 16), "dead": (0, 35)}
for act in bpy.data.actions:
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for kp in fc.keyframe_points:
                        kp.co.x -= 1; kp.handle_left.x -= 1; kp.handle_right.x -= 1
                    fc.update()
    act.use_frame_range = True
    act.frame_start, act.frame_end = RANGES[act.name]
    act.use_cyclic = act.name != "dead"

# ------------------------------------------------------------------ 5. leave it at rest, save, export
reset()
rig.animation_data.action = bpy.data.actions["idle"]
sc.frame_start, sc.frame_end = 0, 60
sc.frame_set(0)
bpy.ops.object.mode_set(mode="OBJECT")
if BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
for o in bpy.context.selected_objects:
    o.select_set(False)
mesh.select_set(True); rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", use_selection=True, export_skins=True, export_animations=True,
    export_animation_mode="ACTIONS", export_nla_strips=False, export_yup=True, export_apply=True,
    export_force_sampling=True, export_materials="EXPORT", export_image_format="AUTO")
print("wolf_rig: wrote", OUT)
