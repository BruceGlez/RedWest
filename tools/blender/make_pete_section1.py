"""Pete Area 1, Section 1 (rebuild): the three-lane valley, built live in Blender (lane art).

Run inside Blender (for example through the Blender MCP):
    exec(compile(open(r"<repo>/tools/blender/make_pete_section1.py", encoding="utf-8").read(), "make_pete_section1.py", "exec"), globals())
then call  run_s1_1()  (relief and valley), and later steps as they are added.

Everything is generated from tools/blender/pete_area1_layout.json (road centre line) and the numbers in
docs/design/pete-section1-and-town-prompts.md. Axes: game x = Blender X, game z = -Blender Y, 1 unit = 1 m.
Walkable ground is at height 0. Every generated object carries the custom property rw_gen so a step can be re-run cleanly.
"""
import bpy, json, math, os, random
from mathutils import Vector, noise

try:
    HERE = os.path.dirname(os.path.abspath(__file__))
except NameError:
    HERE = r"C:\Users\bruce\vscode_projects\RedWest\RedWest\tools\blender"
if not os.path.exists(os.path.join(HERE, "pete_area1_layout.json")):
    HERE = r"C:\Users\bruce\vscode_projects\RedWest\RedWest\tools\blender"
REPO = os.path.dirname(os.path.dirname(HERE))
LAYOUT = os.path.join(HERE, "pete_area1_layout.json")
REVIEW = os.path.join(REPO, "art", "pete-area1", "section1_review")

# ---------------------------------------------------------------- palette (art brief section 1)
def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hexc(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return (_lin(r), _lin(g), _lin(b), a)

def mixc(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(4))

def shade(c, k):
    return (c[0] * k, c[1] * k, c[2] * k, c[3])

PAL = {k: hexc(v) for k, v in dict(
    cliff_dark="#88351c", cliff_base="#a84c2a", cliff_light="#c46236", cliff_rim="#d97846",
    sand_road="#b07a45", sand_ground="#e0a263", scrub="#c8a256", stone="#75716b",
    cool_dark="#5f3f4f", cool_mid="#7d5560", cool_light="#9a6f72", mud="#8f5a3e").items()}

# ---------------------------------------------------------------- small maths
def sstep(a, b, x):
    if a == b:
        return 1.0 if x >= a else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def lerp(a, b, t):
    return a + (b - a) * t

def hat(d, c, w):
    x = min(1.0, abs(d - c) / w)
    return 0.5 * (1 + math.cos(math.pi * x))

def N1(x, y=0.0, z=0.0):
    return noise.noise(Vector((x, y, z)))

# ---------------------------------------------------------------- the road centre line (Blender XY)
_L = json.load(open(LAYOUT))
PTS = [Vector((p["x"], -p["z"])) for p in _L["road"] if p["d"] <= 520]
BRANCH = {b["id"]: b for b in _L["branches"]}
STASH = [Vector((q["x"], -q["z"])) for q in BRANCH["smugglers-stash"]["line"]]
STASH_CLR = BRANCH["smugglers-stash"]["clearing"]
STASH_C = Vector((STASH_CLR["x"], -STASH_CLR["z"]))

def _cl(i):
    return PTS[max(0, min(len(PTS) - 1, i))]

def centre(d):
    n = len(PTS) - 1
    if d <= 0:
        return PTS[0] + (PTS[1] - PTS[0]).normalized() * d
    if d >= n * 10:
        return PTS[n] + (PTS[n] - PTS[n - 1]).normalized() * (d - n * 10)
    i = int(d // 10)
    t = (d - i * 10) / 10.0
    p0, p1, p2, p3 = _cl(i - 1), _cl(i), _cl(i + 1), _cl(i + 2)
    return 0.5 * ((2 * p1) + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3)

# ---------------------------------------------------------------- valley design numbers
D0, D1, DSTEP = -34.0, 446.0, 2.0          # rows run past both ends of Section 1 so the end plugs have room
SECTION_END = 420.0
CHUNKS = {"a": (-35, 105), "b": (85, 210), "c": (190, 315), "d": (295, 447)}   # about 105 m each, 20 m overlap

# crossovers: gaps in the low berms that join the lanes (centre d, opening width m, kind)
GAPS_S = [(45, 8, "plank ramp"), (150, 8, "plank ramp (I19)"), (225, 24, "open fight plaza"), (250, 6, "culvert (H09)"), (335, 8, "creek ford")]
GAPS_N = [(100, 10, "gap in berm"), (183, 22, "claims yard opening"), (235, 22, "ore-bin yard opening (I17 gate)"), (300, 8, "cart shed track"), (368, 14, "Smuggler's Stash path"),
          (72, 4, "foot path to shack 1"), (90, 4, "foot path to shack 2 (H03, I15)"), (108, 4, "foot path to shack 3"), (126, 4, "foot path to shack 4")]

GULLY_D = (376, 384, 410, 414)             # ramp in, floor from, floor to, ramp out
GULLY_DEPTH = 6.4
PLUG_W, PLUG_E = (-26, -33, 9.0), (430, 438, 11.0)

SOUTH_WALL = [(20, 11.0), (16, 9.6), (12, 9.2), (11, 6.8), (6.5, 6.2), (5, 3.7), (1.5, 3.2)]       # (offset from edge, height), outer to inner
NORTH_WALL = [(1.8, 4.3), (13, 4.7), (14.8, 9.4), (27, 9.9), (29, 16.4), (44, 17.2), (46.5, 21.5), (58, 23.0), (64, 25.0)]
INTERIOR = [(-50, "edge_s"), (-44, "floor"), (-38, "floor"), (-35, "lane_s"), (-29, "lane_s"), (-23, "lane_s"),
            (-22, "bs0"), (-21, "bs"), (-18.5, "bs"), (-17.5, "bs0"),
            (-13, "road"), (-6.5, "road"), (0, "road"), (6.5, "road"), (13, "road"),
            (15, "bn0"), (16, "bn"), (19, "bn"), (20.5, "bn0"),
            (21, "lane_n"), (28, "lane_n"), (35, "lane_n"), (40, "floor"), (44, "edge_n")]

def B_of(d):
    """Where the north floor ends (distance from the centre line)."""
    b = 38.0 + 30 * hat(d, 100, 42) + 14 * hat(d, 178, 32) + 22 * hat(d, 247, 30) + 14 * hat(d, 318, 26)
    b += 3.0 * N1(d * 0.03, 11.0)
    b = lerp(b, 25.0, sstep(338, 362, d))
    b = lerp(b, 15.0, sstep(373, 380, d))
    b = lerp(b, 27.0, sstep(414, 420, d))
    return b

def S_of(d):
    """Where the south floor ends (stays at least 40 m so the lane never squeezes)."""
    s = 46.0 + 2.0 * N1(d * 0.04, 5.0)
    s = lerp(s, 41.0, sstep(338, 366, d))
    return max(40.5, s)

def gap_factor(d, gaps, closed=()):
    f = 1.0
    for g in gaps:
        f *= sstep(g[1] / 2.0, g[1] / 2.0 + 3.0, abs(d - g[0]))
    for a, b in closed:
        f *= 1.0 - (sstep(a - 3, a, d) * (1.0 - sstep(b, b + 3, d)))
    return f

def gully_depth(d, u, S):
    gd = GULLY_D
    gm = sstep(gd[0], gd[1], d) * (1.0 - sstep(gd[2], gd[3], d))
    if gm <= 0:
        return 0.0
    um = sstep(-S - 1.0, -S + 3.0, u) * (1.0 - sstep(10.0, 13.5, u))
    return GULLY_DEPTH * gm * um

def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length

def stash_shape_dist(p):
    """Negative or zero inside the Smuggler's Stash path (11 m wide) or its 13 m clearing."""
    dp = min(seg_dist(p, STASH[k], STASH[k + 1]) for k in range(len(STASH) - 1)) - 5.5
    dc = (p - STASH_C).length - STASH_CLR["r"]
    return min(dp, dc)

# ---------------------------------------------------------------- the grid of rows and columns
def _with_mids(seq):
    """seq = [(offset, height)] from the floor edge outwards; steep risers get two mid columns so the strata can be banded."""
    out, prev = [], (0.0, 0.0)
    for e, h in seq:
        if h - prev[1] > 2.2 and e - prev[0] < 3.0:
            for t, bulge in ((1 / 3.0, 0.35), (2 / 3.0, -0.3)):
                out.append((prev[0] + (e - prev[0]) * t + bulge, prev[1] + (h - prev[1]) * t, True))
        out.append((e, h, False))
        prev = (e, h)
    return out

def make_columns():
    cols = []
    for e, h, mid in reversed(_with_mids(sorted(SOUTH_WALL))):
        cols.append(dict(k="sw", e=e, h=h, s=-50 - e, mid=mid))
    for s, kind in INTERIOR:
        cols.append(dict(k="in", s=s, kind=kind))
    for e, h, mid in _with_mids(NORTH_WALL):
        cols.append(dict(k="nw", e=e, h=h, s=44 + e, mid=mid))
    return cols

COLS = make_columns()

def build_frame():
    ds = [D0 + DSTEP * i for i in range(int(round((D1 - D0) / DSTEP)) + 1)]
    th = []
    for d in ds:
        t = (centre(d + 1.0) - centre(d - 1.0)).normalized()
        th.append(math.atan2(t.y, t.x))
    for i in range(1, len(th)):
        while th[i] - th[i - 1] > math.pi:
            th[i] -= 2 * math.pi
        while th[i] - th[i - 1] < -math.pi:
            th[i] += 2 * math.pi
    n = len(ds)
    kap = [0.0] * n
    for i in range(1, n - 1):
        kap[i] = (th[i + 1] - th[i - 1]) / (2 * DSTEP)
    sm = []
    for i in range(n):
        a, b = max(0, i - 5), min(n - 1, i + 5)
        sm.append(sum(kap[a:b + 1]) / (b - a + 1))
    return ds, th, sm

def compute_grid():
    ds, th, kap = build_frame()
    nrow, ncol = len(ds), len(COLS)
    X = [[0.0] * ncol for _ in range(nrow)]
    Y = [[0.0] * ncol for _ in range(nrow)]
    Z = [[0.0] * ncol for _ in range(nrow)]
    U = [[0.0] * ncol for _ in range(nrow)]
    SH = []   # distance to the Stash shape per vertex
    info = []
    for i, d in enumerate(ds):
        P = centre(d)
        T = Vector((math.cos(th[i]), math.sin(th[i])))
        Nv = Vector((-T.y, T.x))
        B, S = B_of(d), S_of(d)
        k = kap[i]
        capL = 0.88 / k if k > 1e-4 else 1e9
        capR = 0.88 / -k if k < -1e-4 else 1e9
        wsN = max(0.12, min(1.0, (capL - B) / 64.0))
        wsS = max(0.12, min(1.0, (capR - S) / 20.0))
        gN = max(0.02, min(1.0, (B - 1.5 - 13.0) / 27.0))
        fS = gap_factor(d, GAPS_S)
        fN = gap_factor(d, GAPS_N, closed=[(374, 416)])
        us, hs = [], []
        for j, c in enumerate(COLS):
            s = c["s"]
            if c["k"] == "sw":
                u = -S - c["e"] * wsS
                h = c["h"]
                jit_u = 0.35 if c["mid"] else (0.5 if c["e"] in (1.5, 5, 11, 12) else 2.2)
                u -= 0.0
                u += jit_u * N1(d * 0.045, j * 2.3, 1.0)
                h += (0.1 if c["mid"] else (0.35 if c["e"] in (5, 6.5, 11, 12) else 0.9)) * N1(d * 0.06, j * 1.7, 2.0)
                h *= (0.35 + 0.65 * wsS) if c["e"] > 12 else 1.0
            elif c["k"] == "nw":
                u = B + c["e"] * wsN
                h = c["h"]
                jit_u = 0.35 if c["mid"] else (0.5 if c["e"] in (1.8, 14.8, 29, 46.5) else 3.0)
                u += jit_u * N1(d * 0.04, j * 2.1, 3.0)
                h += (0.1 if c["mid"] else (0.4 if c["e"] in (13, 27, 44) else 0.9)) * N1(d * 0.055, j * 1.3, 4.0)
                if c["e"] > 40:
                    h *= (0.6 + 0.4 * wsN)
            else:
                if s <= -35:
                    u = -S + (s + 50) / 15.0 * (S - 35)
                elif s <= 13:
                    u = s
                elif s <= 40:
                    u = 13 + (s - 13) * gN
                else:
                    u = B
                h = 0.0
                kind = c["kind"]
                if kind == "bs":
                    h = 1.5 * fS
                elif kind == "bn":
                    h = 1.4 * fN
                if kind in ("bs", "bn"):
                    h *= 1.0 + 0.18 * N1(d * 0.2, j, 5.0)
            us.append(u)
            hs.append(h)
        for j in range(1, ncol):
            if us[j] < us[j - 1] + 0.05:
                us[j] = us[j - 1] + 0.05
        for j in range(ncol):
            u = us[j]
            h = hs[j]
            w = P + Nv * u
            sd = stash_shape_dist(w)
            if sd < 8:
                h *= sstep(0.0, 3.2, sd)
            h -= gully_depth(d, u, S)
            if d < PLUG_W[0]:
                h = max(h, PLUG_W[2] * sstep(PLUG_W[0], PLUG_W[1], d) + 0.6 * N1(w.x * 0.1, w.y * 0.1, 7.0) * sstep(PLUG_W[0], PLUG_W[1], d))
            if d > PLUG_E[0]:
                h = max(h, PLUG_E[2] * sstep(PLUG_E[0], PLUG_E[1], d) + 0.6 * N1(w.x * 0.1, w.y * 0.1, 8.0) * sstep(PLUG_E[0], PLUG_E[1], d))
            X[i][j], Y[i][j], Z[i][j], U[i][j] = w.x, w.y, h, u
        info.append(dict(d=d, B=B, S=S))
    return dict(ds=ds, X=X, Y=Y, Z=Z, U=U, info=info)

# ---------------------------------------------------------------- scene plumbing
def scn():
    return bpy.data.scenes["PeteArea1"]

def coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        scn().collection.children.link(c)
    return c

def clear_generated(tag=None):
    for o in list(bpy.data.objects):
        v = o.get("rw_gen")
        if v and (tag is None or v == tag):
            me = o.data if o.type == "MESH" else None
            bpy.data.objects.remove(o, do_unlink=True)
            if me is not None and me.users == 0:
                bpy.data.meshes.remove(me)

def get_material():
    m = bpy.data.materials.get("M_rock")
    if m is None:
        m = bpy.data.materials.new("M_rock")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Metallic"].default_value = 0.0
    return m

def make_obj(name, verts, faces, colors_fn, collection, tag, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    flat = []
    for p in me.polygons:
        nrm = p.normal
        cache = colors_fn(p.index, p.vertices[0], nrm, p.center)    # one colour per face: flat, painted look
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index
            flat.extend(cache if cache is not None else colors_fn(p.index, vi, nrm, me.vertices[vi].co))
    attr.data.foreach_set("color", flat)
    if not smooth:
        try:
            me.shade_flat()
        except Exception:
            for p in me.polygons:
                p.use_smooth = False
    me.materials.append(get_material())
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    ob["rw_gen"] = tag
    return ob

def tris_of(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)

# ---------------------------------------------------------------- terrain mesh
def strata(z, nz, k=0.0):
    if nz > 0.62:
        return mixc(PAL["cliff_light"], PAL["cliff_rim"], 0.25 + 0.25 * k)
    band = int(math.floor(z / 1.3)) % 4
    c = (PAL["cliff_base"], PAL["cliff_dark"], PAL["cliff_base"], PAL["cliff_light"])[band]
    return shade(c, 0.92 + 0.12 * k)

def build_terrain(G):
    ds, X, Y, Z, U = G["ds"], G["X"], G["Y"], G["Z"], G["U"]
    nrow, ncol = len(ds), len(COLS)
    V, F, META = [], [], []
    idx = lambda i, j: i * ncol + j
    for i in range(nrow):
        for j in range(ncol):
            V.append((X[i][j], Y[i][j], Z[i][j]))
    for i in range(nrow - 1):
        for j in range(ncol - 1):
            a, b, c, d_ = idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)
            if (i + j) % 2 == 0:
                F.append((a, b, c)); META.append((i, j))
                F.append((a, c, d_)); META.append((i, j))
            else:
                F.append((a, b, d_)); META.append((i, j))
                F.append((b, c, d_)); META.append((i, j))
    nmain = len(F)
    # skirt down to the far ground so no edge is ever open
    BOT = -0.45
    def vb(i, j):
        V.append((X[i][j], Y[i][j], BOT)); return len(V) - 1
    for i in range(nrow - 1):                      # south edge (outward = right)
        a0, a1 = idx(i, 0), idx(i + 1, 0)
        b0, b1 = vb(i, 0), vb(i + 1, 0)
        F.append((b0, b1, a1, a0)); META.append(("skirt", 0))
        a0, a1 = idx(i, ncol - 1), idx(i + 1, ncol - 1)   # north edge (outward = left)
        b0, b1 = vb(i, ncol - 1), vb(i + 1, ncol - 1)
        F.append((a0, a1, b1, b0)); META.append(("skirt", 0))
    for j in range(ncol - 1):
        a0, a1 = idx(0, j), idx(0, j + 1)          # west end
        b0, b1 = vb(0, j), vb(0, j + 1)
        F.append((a0, a1, b1, b0)); META.append(("skirt", 0))
        a0, a1 = idx(nrow - 1, j), idx(nrow - 1, j + 1)   # east end
        b0, b1 = vb(nrow - 1, j), vb(nrow - 1, j + 1)
        F.append((b0, b1, a1, a0)); META.append(("skirt", 0))

    kinds = [c.get("kind", c["k"]) for c in COLS]

    def colors(pi, vi, nrm, co):
        m = META[pi]
        if m[0] == "skirt":
            return shade(PAL["cliff_dark"], 0.8)
        i, j = m
        zc = (Z[i][j] + Z[i + 1][j] + Z[i][j + 1] + Z[i + 1][j + 1]) / 4.0      # the whole cell shares one band
        k = 0.5 + 0.5 * N1(co.x * 0.11, co.y * 0.11, 3.0)
        wx, wy = co.x, co.y
        sd = stash_shape_dist(Vector((wx, wy)))
        kd = kinds[j]; kd2 = kinds[min(j + 1, ncol - 1)]
        d = ds[i]
        # the gully: cool, dark, cracked mud
        gd = gully_depth(d, U[i][j], G["info"][i]["S"])
        if gd > 1.0 and nrm.z > 0.5:
            return shade(mixc(PAL["cool_mid"], PAL["cool_dark"], 0.5 + 0.4 * k), 0.8)
        if gd > 0.4:
            return shade(mixc(PAL["cool_light"], PAL["cliff_dark"], 0.45), 0.8 + 0.2 * k)
        berm = kd in ("bs", "bn", "bs0", "bn0") or kd2 in ("bs", "bn")
        if not berm and (kd in ("sw", "nw") or kd2 in ("sw", "nw") or abs(nrm.z) < 0.55):
            if sd < 1.5 and nrm.z > 0.6:
                return shade(mixc(PAL["cool_light"], PAL["sand_ground"], 0.3), 0.9 + 0.1 * k)
            return strata(zc, nrm.z, k)
        base = PAL["sand_ground"]
        if sd < 2.0:
            base = mixc(PAL["cool_light"], PAL["sand_ground"], 0.25)
        elif kd in ("road",) and kd2 in ("road",):
            base = mixc(PAL["sand_road"], PAL["sand_ground"], 0.5)
        elif kd in ("lane_n",) and kd2 in ("lane_n", "floor"):
            base = shade(mixc(mixc(PAL["stone"], PAL["scrub"], 0.4), PAL["sand_ground"], 0.55), 0.86 + 0.26 * (0.5 + 0.5 * N1(i * 0.93, j * 3.1, 6.0)))     # gravel speckle
        elif kd in ("lane_s",) and kd2 in ("lane_s", "bs0"):
            base = mixc(PAL["mud"], PAL["sand_ground"], 0.55)
            if N1(i * 0.37, j * 1.9, 9.0) > 0.2:
                base = shade(base, 0.78)                                                                     # dry-mud cracks
        elif berm:
            base = mixc(PAL["scrub"], PAL["sand_ground"], 0.3)
        return shade(base, 0.9 + 0.2 * k)

    ob = make_obj("terrain_section1", V, F, lambda pi, vi, n, co: colors(pi, vi, n, co), coll("10_terrain"), "s1_1")
    return ob, META, nmain

# ---------------------------------------------------------------- cliff kit (12 variants), mesas
def prism(V, F, cx, cy, z0, z1, r0, r1, n, rng, jit=0.14, rot=0.0, sq=(1.0, 1.0), shear=(0.0, 0.0), mid=True):
    jr = [1 + rng.uniform(-jit, jit) for _ in range(n)]
    rings = [(z0, r0, (0.0, 0.0))]
    if mid:
        rings.append(((z0 + z1) / 2.0, (r0 + r1) / 2.0 * (1 + rng.uniform(-0.1, 0.12)), (shear[0] * 0.5 + rng.uniform(-0.2, 0.2), shear[1] * 0.5 + rng.uniform(-0.2, 0.2))))
    rings.append((z1, r1, shear))
    base = len(V)
    for (z, r, sh) in rings:
        for k in range(n):
            a = rot + 2 * math.pi * k / n
            rr = r * jr[k] * (1 + rng.uniform(-0.04, 0.04))
            V.append((cx + rr * math.cos(a) * sq[0] + sh[0], cy + rr * math.sin(a) * sq[1] + sh[1], z))
    for r_ in range(len(rings) - 1):
        for k in range(n):
            k1 = (k + 1) % n
            F.append((base + r_ * n + k, base + r_ * n + k1, base + (r_ + 1) * n + k1, base + (r_ + 1) * n + k))
    top = base + (len(rings) - 1) * n
    F.append(tuple(top + k for k in range(n)))

def kit_variant(v, rng):
    V, F = [], []
    if v == 0:      # terraced stack
        w, z = rng.uniform(4.0, 4.8), 0.0
        for t in range(4):
            h = rng.uniform(1.0, 1.5)
            prism(V, F, rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), z, z + h, w * 0.84 ** t, w * 0.84 ** (t + 1) * 1.04, 8, rng, rot=t * 0.3)
            z += h
    elif v == 1:    # buttress
        prism(V, F, 0, 0, 0, 5.4, 3.4, 1.3, 7, rng, sq=(1.5, 0.9), shear=(1.2, 0.2))
        prism(V, F, -2.2, 0.8, 0, 2.6, 1.8, 0.9, 6, rng)
    elif v == 2:    # pillars
        for (cx, cy, h, r) in ((-2.6, 0, 4.6, 1.5), (0.2, 0.6, 7.0, 1.8), (2.8, -0.4, 3.6, 1.4)):
            prism(V, F, cx, cy, 0, h, r, r * 0.72, 6, rng)
    elif v == 3:    # shelf
        prism(V, F, 0, 0, 0, 1.7, 5.4, 4.8, 8, rng, sq=(1.5, 0.85))
        prism(V, F, 1.5, 0.2, 1.7, 3.3, 3.1, 2.5, 7, rng, sq=(1.3, 0.9))
        prism(V, F, -3.2, 0.5, 0, 1.0, 1.4, 1.0, 6, rng)
    elif v == 4:    # spire pair
        prism(V, F, -2.3, 0, 0, 6.8, 2.2, 0.4, 5, rng)
        prism(V, F, 2.2, 0.5, 0, 4.8, 1.9, 0.4, 5, rng)
        prism(V, F, 0, -1.6, 0, 1.6, 1.8, 1.0, 6, rng)
    elif v == 5:    # boulder pile
        for _ in range(5):
            r = rng.uniform(1.4, 2.3)
            prism(V, F, rng.uniform(-3, 3), rng.uniform(-1.8, 1.8), 0, r * rng.uniform(0.9, 1.4), r, r * 0.5, 7, rng, jit=0.2)
    elif v == 6:    # overhang
        prism(V, F, 0, 0, 0, 4.6, 2.5, 3.5, 7, rng, sq=(1.35, 1.0))
        prism(V, F, 0, 0, 4.6, 5.4, 3.5, 2.8, 7, rng, sq=(1.35, 1.0))
    elif v == 7:    # tilted strata
        prism(V, F, 0, 0, 0, 3.6, 3.0, 2.3, 6, rng, sq=(2.4, 1.0), shear=(2.0, 0.4))
        prism(V, F, -1.8, 1.4, 0, 1.8, 1.8, 1.2, 6, rng)
    elif v == 8:    # notch
        prism(V, F, -3.1, 0, 0, 5.0, 2.5, 1.7, 7, rng)
        prism(V, F, 3.1, 0.3, 0, 4.2, 2.2, 1.5, 7, rng)
        prism(V, F, 0, 0.1, 3.0, 4.0, 1.9, 1.5, 6, rng, sq=(1.9, 0.8))
    elif v == 9:    # talus slope
        prism(V, F, 0, 0, 0, 2.6, 6.0, 2.4, 9, rng, sq=(1.3, 0.85))
        for _ in range(4):
            prism(V, F, rng.uniform(-4.5, 4.5), rng.uniform(-2.5, 2.5), 0, rng.uniform(0.7, 1.3), rng.uniform(0.9, 1.4), 0.6, 6, rng, mid=False)
    elif v == 10:   # fin
        prism(V, F, 0, 0, 0, 6.4, 3.0, 2.2, 7, rng, sq=(0.55, 2.3), shear=(0.6, 0.0))
        prism(V, F, 1.8, 2.0, 0, 2.4, 1.3, 0.9, 6, rng)
    else:           # corner L
        prism(V, F, 0, 0, 0, 4.0, 2.8, 2.0, 7, rng, sq=(2.0, 0.9))
        prism(V, F, -2.4, 2.4, 0, 3.0, 2.6, 1.8, 7, rng, sq=(0.9, 1.8))
    return V, F

KIT_N = 12

def kit_colors(zmax):
    def fn(pi, vi, nrm, co):
        k = 0.5 + 0.5 * N1(co.x * 0.4, co.y * 0.4, co.z * 0.4)
        c = strata(co.z, nrm.z, k)
        ao = 0.82 + 0.18 * min(1.0, max(0.0, co.z / max(zmax, 1e-3)))
        return shade(c, ao)
    return fn

def build_kit_meshes():
    kit = []
    for v in range(KIT_N):
        rng = random.Random(1000 + v)
        V, F = kit_variant(v, rng)
        zmax = max(p[2] for p in V)
        name = "kit_cliff_%s" % "abcdefghijkl"[v]
        ob = make_obj(name, V, F, kit_colors(zmax), coll("20_cliffs"), "s1_1")
        ob.hide_render = True            # the template is hidden; the instances are what renders
        ob.hide_viewport = True
        kit.append((ob, zmax))
    return kit

def mesa_obj(name, seed, w, h, arch):
    rng = random.Random(seed)
    V, F = [], []
    sq = (1.25, 0.95)
    if not arch:
        tiers = [(0.00, 0.24, 0.62, 0.52), (0.24, 0.50, 0.55, 0.47), (0.50, 0.70, 0.46, 0.50), (0.70, 0.87, 0.40, 0.36), (0.87, 1.00, 0.39, 0.37)]
        for k, (a, b, r0, r1) in enumerate(tiers):
            prism(V, F, rng.uniform(-1.2, 1.2), rng.uniform(-1, 1), h * a, h * b, w * r0, w * r1, 10, rng, rot=k * 0.37, sq=sq, jit=0.12)
    else:
        prism(V, F, 0, 0, 0, h * 0.32, w * 0.62, w * 0.55, 10, rng, sq=(1.5, 0.8), jit=0.1)
        for sx in (-1, 1):
            prism(V, F, sx * w * 0.36, 0, h * 0.30, h * 0.64, w * 0.17, w * 0.15, 8, rng, sq=(1.0, 1.5), jit=0.08)
        prism(V, F, 0, 0, h * 0.62, h * 0.78, w * 0.34, w * 0.32, 10, rng, sq=(1.75, 0.95), jit=0.08)
        prism(V, F, rng.uniform(-1, 1), 0, h * 0.78, h, w * 0.30, w * 0.27, 9, rng, sq=(1.6, 0.9), jit=0.1)
    zmax = max(p[2] for p in V)
    def fn(pi, vi, nrm, co):
        k = 0.5 + 0.5 * N1(co.x * 0.15, co.y * 0.15, co.z * 0.15)
        if nrm.z > 0.62:
            return shade(mixc(PAL["cliff_light"], PAL["sand_ground"], 0.35 + 0.2 * k), 1.0)
        band = int(math.floor(co.z / 2.3)) % 4
        c = (PAL["cliff_base"], PAL["cliff_dark"], PAL["cliff_light"], PAL["cliff_base"])[band]
        return shade(c, (0.8 + 0.2 * min(1, co.z / (0.5 * zmax))) * (0.94 + 0.1 * k))
    return make_obj(name, V, F, fn, coll("20_cliffs"), "s1_1")

# ---------------------------------------------------------------- markers
def add_marker(name, loc, rw_type, rw_id, radius, note, size=1.2):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "SPHERE"
    e.empty_display_size = size
    e.location = loc
    e["rw_type"] = rw_type
    e["rw_id"] = rw_id
    e["rw_radius"] = float(radius)
    e["rw_note"] = note
    e["rw_gen"] = "s1_1"
    coll("70_markers").objects.link(e)
    return e

# ---------------------------------------------------------------- cameras, light, render
def vfov_camera(cam, vfov_deg=40.0):
    cam.data.sensor_fit = "VERTICAL"
    cam.data.sensor_height = 24.0
    cam.data.lens = 12.0 / math.tan(math.radians(vfov_deg / 2.0))
    cam.data.clip_start = 0.5
    cam.data.clip_end = 2500.0

def place_game_camera(cam, d, phone=False, pull=1.0):
    P = centre(d)
    up, back = (26.0, 18.5) if phone else (35.0, 25.0)
    up, back = up * pull, back * pull
    cam.location = (P.x, P.y - back, up)
    cam.rotation_euler = (math.radians(90.0) - math.atan2(up, back), 0.0, 0.0)
    cam.data.type = "PERSP"
    vfov_camera(cam)

def get_cam(name):
    ob = bpy.data.objects.get(name)
    if ob is None or ob.type != "CAMERA":
        cd = bpy.data.cameras.new(name)
        ob = bpy.data.objects.new(name, cd)
        coll("00_reference").objects.link(ob)
    return ob

def setup_light():
    sc = scn()
    if sc.world is None:
        sc.world = bpy.data.worlds.new("PeteWorld")
    w = sc.world
    w.use_nodes = True
    bg = next((n for n in w.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg:
        bg.inputs["Color"].default_value = (0.62, 0.56, 0.58, 1.0)
        bg.inputs["Strength"].default_value = 0.75
    sun = bpy.data.objects.get("GoldenHourSun")
    if sun:
        direction = Vector((0.82, 0.12, -0.56))     # late-afternoon sun from the west, shadows run east
        sun.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        sun.data.energy = 4.2
        sun.data.color = (1.0, 0.82, 0.62)
    try:
        sc.view_settings.view_transform = "Standard"
    except Exception:
        pass
    sc.render.engine = "BLENDER_EEVEE"
    try:
        sc.eevee.taa_render_samples = 24
    except Exception:
        pass

def render_to(cam, name, res, subdir=None):
    sc = scn()
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    folder = REVIEW if subdir is None else os.path.join(REVIEW, subdir)
    os.makedirs(folder, exist_ok=True)
    sc.render.filepath = os.path.join(folder, name + ".png")
    bpy.ops.render.render(write_still=True)
    return sc.render.filepath

# ---------------------------------------------------------------- step S1-1
OLD_NAMES = ("terrain_sand_base", "road_dirt_ribbon", "trailhead_clearing_disc")

def run_s1_1(render=False):
    sc = scn()
    bpy.context.window.scene = sc
    # 1. remove the stale greybox: one flat plane and the box blocks
    for o in list(bpy.data.objects):
        if o.name in OLD_NAMES or o.name.startswith("canyon_north") or o.name.startswith("canyon_south"):
            me = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if me and me.users == 0:
                bpy.data.meshes.remove(me)
    clear_generated("s1_1")
    G = compute_grid()
    terrain, META, nmain = build_terrain(G)
    ds, X, Y, Z, U = G["ds"], G["X"], G["Y"], G["Z"], G["U"]
    nrow, ncol = len(ds), len(COLS)
    col_of = {}
    for j, c in enumerate(COLS):
        col_of[(c["k"], c.get("e", c.get("s")))] = j

    # 2. far ground below the valley rim, so nothing ever looks open
    gv = [(-700, -300, -0.45), (700, -300, -0.45), (700, 800, -0.45), (-700, 800, -0.45)]
    far = make_obj("terrain_far_ground", gv, [(0, 1, 2, 3)], lambda *a: mixc(PAL["stone"], PAL["sand_ground"], 0.3), coll("10_terrain"), "s1_1")

    # 3. cliff kit instances along the terraces (12 variants, rotation, mirroring, scale 0.8 to 1.3)
    kit = build_kit_meshes()
    rng = random.Random(77)
    lines = [  # (kind, e, height limit above the foot, spacing range, inset m)
        ("nw", 1.8, 5.5, (17, 25), 1.2), ("nw", 14.8, 7.0, (18, 26), 1.2), ("nw", 29, 9.5, (20, 28), 1.5), ("nw", 46.5, 8.0, (22, 30), 1.5),
        ("sw", 1.5, 3.6, (20, 28), 1.0), ("sw", 6.5, 3.0, (22, 30), 1.0),
    ]
    placements = []
    for kind, e, hlim, (s0, s1), inset in lines:
        j = col_of[(kind, e)]
        d = D0 + rng.uniform(4, 14)
        while d < D1 - 8:
            i = int(round((d - D0) / DSTEP))
            placements.append((d, kind, j, i, hlim, inset))
            d += rng.uniform(s0, s1)
    placements.sort(key=lambda p: p[0])
    order = list(range(KIT_N))
    rng.shuffle(order)
    inst = []
    for n, (d, kind, j, i, hlim, inset) in enumerate(placements):
        if D1 - 14 < d or d < D0 + 6:
            continue
        v = order[n % KIT_N]
        tmpl, zmax = kit[v]
        s = rng.uniform(0.8, 1.3)
        s = min(s, hlim / zmax)
        sign = -1.0 if rng.random() < 0.5 else 1.0
        P = centre(d)
        # inset is toward the wall (north: +u, south: -u)
        toward = 1.0 if kind == "nw" else -1.0
        wx, wy, wz = X[i][j], Y[i][j], Z[i][j]
        tang = (centre(d + 1) - centre(d - 1)).normalized()
        nrm = Vector((-tang.y, tang.x))
        wx += nrm.x * inset * toward
        wy += nrm.y * inset * toward
        ob = bpy.data.objects.new("kit_cliff_inst_%03d" % n, tmpl.data)
        ob.location = (wx, wy, wz - 0.15)
        ob.rotation_euler = (0, 0, rng.uniform(0, math.tau))
        ob.scale = (s * sign, s, s * rng.uniform(0.95, 1.1))
        ob["rw_gen"] = "s1_1"
        ob["rw_d"] = d
        ob["rw_variant"] = v
        coll("20_cliffs").objects.link(ob)
        inst.append(ob)

    # 4. two mesas on the north side (one with a natural arch), sunk into the rim
    mesas = []
    for name, seed, d, u, w, h, arch in (("mesa_north_arch", 5, 120, 112, 34, 44, True), ("mesa_north_b", 9, 287, 104, 30, 38, False)):
        i = int(round((d - D0) / DSTEP))
        P = centre(d)
        t = (centre(d + 1) - centre(d - 1)).normalized()
        n_ = Vector((-t.y, t.x))
        pos = P + n_ * u
        jbest = min(range(ncol), key=lambda j: abs(U[i][j] - u))
        ob = mesa_obj(name, seed, w, h, arch)
        ob.location = (pos.x, pos.y, Z[i][jbest] - 3.0)
        ob.rotation_euler = (0, 0, math.atan2(t.y, t.x))
        ob["rw_d"] = d
        mesas.append(ob)

    # 5. crossover markers (where the lanes join)
    cnt = 0
    for lane, gaps in (("s", GAPS_S), ("n", GAPS_N)):
        for (dc, wd, what) in gaps:
            P = centre(dc)
            t = (centre(dc + 1) - centre(dc - 1)).normalized()
            n_ = Vector((-t.y, t.x))
            off = -19.5 if lane == "s" else 18.0
            p = P + n_ * off
            cnt += 1
            add_marker("marker_crossover_%s%02d" % (lane, cnt), (p.x, p.y, 0.3), "crossover", "X%02d" % cnt, wd / 2.0, "%s berm opening at %d m: %s" % ("south" if lane == "s" else "north", dc, what))
    add_marker("marker_section_end_plug", (centre(436).x, centre(436).y, 0.3), "note", "END", 12, "Section 1 ends at 420 m; this rock plug closes the valley until Section 2 is built (remove it then).", 2.0)
    add_marker("marker_section_start_plug", (centre(-30).x, centre(-30).y, 0.3), "note", "START", 12, "West rock plug behind the trailhead gate.", 2.0)

    # 6. light and cameras
    setup_light()
    gc, pc = get_cam("GameCamera"), get_cam("PhoneGameCamera")
    place_game_camera(gc, 60)
    place_game_camera(pc, 60, phone=True)
    # review cameras
    xs = [X[i][j] for i in range(nrow) for j in range(ncol)]
    ys = [Y[i][j] for i in range(nrow) for j in range(ncol)]
    cx, cy = (min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0
    top = get_cam("ReviewTopCamera")
    top.data.type = "ORTHO"
    top.data.ortho_scale = (max(xs) - min(xs)) * 1.04
    top.data.clip_end = 2500.0
    top.location = (cx, cy, 700)
    top.rotation_euler = (0, 0, 0)
    obl = get_cam("ReviewObliqueCamera")
    obl.data.type = "PERSP"
    obl.data.lens = 30
    obl.data.sensor_fit = "AUTO"
    obl.data.clip_end = 3000.0
    obl.location = (cx - 150, cy - 420, 330)
    look = Vector((cx + 10, cy + 20, 0)) - Vector(obl.location)
    obl.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()

    # 7. report
    chunk_tris = {}
    for ck, (a, b) in CHUNKS.items():
        t = 0
        for pi, m in enumerate(META[:nmain]):
            if a <= ds[m[0]] <= b:
                t += 1
        kt = sum(len(p.vertices) - 2 for o in inst if a <= o["rw_d"] <= b for p in o.data.polygons)
        mt = sum(tris_of(o) for o in mesas if a <= o["rw_d"] <= b)
        chunk_tris[ck] = dict(terrain=t, kit=kt, mesas=mt, total=t + kt + mt)
    stats = dict(rows=nrow, cols=ncol, terrain_tris=tris_of(terrain), kit_instances=len(inst), kit_variants=KIT_N,
                 mesas=len(mesas), crossovers=cnt, chunks=chunk_tris, bbox=(min(xs), max(xs), min(ys), max(ys)),
                 floor_width_avg=sum(i_["B"] + i_["S"] for i_ in G["info"]) / len(G["info"]))
    print(json.dumps(stats, indent=1))
    if render:
        place_game_camera(gc, 100); gc.location.y += 28      # player on the north lane: the terraces are in frame
        render_to(gc, "s1-1_game_camera_north_lane_d100", (1920, 1080))
        place_game_camera(gc, 300)
        render_to(gc, "s1-1_game_camera_road_d300", (1920, 1080))
        place_game_camera(pc, 380, phone=True)
        render_to(pc, "s1-1_phone_camera_bridge_d380", (1080, 1920))
        place_game_camera(gc, 60); place_game_camera(pc, 60, phone=True)
        render_to(top, "s1-1_top_down", (1920, 1080))
        render_to(obl, "s1-1_oblique", (1920, 1080))
    return stats

if "RUN_STEPS" in globals():
    pass

# ---------------------------------------------------------------- chase camera (proposal: a more 3D follow camera)
CHASE = dict(back=9.0, up=5.2, ahead=9.0, look_z=1.4, vfov=58.0)          # landscape
CHASE_PHONE = dict(back=11.0, up=6.5, ahead=10.0, look_z=1.4, vfov=58.0)  # portrait

def place_chase_camera(cam, d, u=0.0, phone=False, cfg=None):
    """Behind and above the marshal on the road, looking down the road ahead (the camera follows the heading)."""
    c = cfg or (CHASE_PHONE if phone else CHASE)
    P0 = centre(d)
    T = (centre(d + 1.0) - centre(d - 1.0)).normalized()
    Nv = Vector((-T.y, T.x))
    P = P0 + Nv * u
    pos = Vector((P.x - T.x * c["back"], P.y - T.y * c["back"], c["up"]))
    tgt = Vector((P.x + T.x * c["ahead"], P.y + T.y * c["ahead"], c["look_z"]))
    cam.location = pos
    cam.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
    cam.data.type = "PERSP"
    vfov_camera(cam, c["vfov"])

# ================================================================ step S1-2: the road, ground and paths
# Everything here is flat decoration on the height-0 ground: the road ribbon is 0.03 m high, decals sit at 0.05 to 0.07 m,
# the plank walkway at 0.07 m. Nothing here blocks walking.

def tang_at(d):
    return (centre(d + 1.0) - centre(d - 1.0)).normalized()

def du_w(d, u):
    t = tang_at(d)
    return centre(d) + Vector((-t.y, t.x)) * u

def world_to_du(p):
    best = None
    for k in range(-60, 940):
        d = k * 0.5
        q = (p - centre(d)).length
        if best is None or q < best[0]:
            best = (q, d)
    d = best[1]
    t = tang_at(d)
    return d, (p - centre(d)).dot(Vector((-t.y, t.x)))

def add_poly(V, F, pts, z):
    area = sum(pts[k][0] * pts[(k + 1) % len(pts)][1] - pts[(k + 1) % len(pts)][0] * pts[k][1] for k in range(len(pts)))
    if area < 0:
        pts = list(reversed(pts))
    base = len(V)
    for (x, y) in pts:
        V.append((x, y, z))
    F.append(tuple(range(base, base + len(pts))))

def strip_mesh(V, F, COL, pts, width, z_mid, z_edge, colfn, step=1.5, meander=0.0, seed=0, ncross=5):
    """A ribbon of quads along a world polyline; colfn(across 0=centre..1=edge, along index) gives each cell's colour."""
    pts = [Vector(p) for p in pts]
    pl = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        seg = (b - a).length
        n = max(1, int(seg / step))
        for k in range(1, n + 1):
            pl.append(a + (b - a) * (k / n))
    rows = []
    for i, p in enumerate(pl):
        q = pl[min(i + 1, len(pl) - 1)] - pl[max(i - 1, 0)]
        t = q.normalized() if q.length > 1e-6 else Vector((1, 0))
        n_ = Vector((-t.y, t.x))
        off = meander * N1(i * 0.35, seed * 3.1, 0.5)
        rows.append((p + n_ * off, n_))
    xs = [(-1 + 2 * k / (ncross - 1)) for k in range(ncross)]
    base = len(V)
    for (p, n_) in rows:
        for x in xs:
            w = p + n_ * (x * width / 2.0)
            z = z_edge if abs(x) > 0.99 else z_mid
            V.append((w.x, w.y, z))
    for i in range(len(rows) - 1):
        for k in range(ncross - 1):
            a = base + i * ncross + k
            F.append((a, a + ncross, a + ncross + 1, a + 1))
            COL.append(colfn(abs(xs[k] + xs[k + 1]) / 2.0, i))

def flat_obj(name, V, F, COL, collection, tag="s1_2"):
    return make_obj(name, V, F, lambda pi, *a: COL[pi], collection, tag)

RIB_U = [-13.0, -12.1, -9.5, -6.5, -4.6, -2.4, -1.7, 0.0, 1.7, 2.4, 4.6, 6.5, 9.5, 12.1, 13.0]
RIB_SEGS = [(-26.0, 374.0), (416.0, 434.0)]          # the 376 to 414 m gap is the bridge span (S1-5)
PAPER = hexc("#f4eedb")

def road_colour(d, um, i, j):
    light = mixc(PAL["sand_ground"], PAPER, 0.30)
    a = abs(um)
    mid = mixc(light, PAL["sand_ground"], 0.55)
    outer = mixc(PAL["sand_ground"], PAL["sand_road"], 0.5)
    c = mixc(light, mid, sstep(3.0, 6.0, a))
    c = mixc(c, outer, sstep(8.0, 10.5, a))
    c = mixc(c, shade(PAL["sand_road"], 0.88), sstep(11.2, 12.6, a))      # darker worn edge
    if 1.7 <= a <= 2.4:
        c = mixc(PAL["sand_road"], PAL["cliff_dark"], 0.3)                 # wheel ruts
    gravel = sstep(130, 150, d) * (1 - sstep(268, 282, d))
    mud = sstep(268, 282, d) * (1 - sstep(352, 366, d))
    wet = sstep(352, 366, d)
    sp = 0.5 + 0.5 * N1(i * 0.8, j * 2.1, 2.0)
    if gravel > 0:
        g = shade(mixc(c, mixc(PAL["stone"], PAL["scrub"], 0.35), 0.55), 0.82 + 0.3 * sp)
        c = mixc(c, g, gravel)
    if mud > 0:
        m = shade(mixc(c, PAL["mud"], 0.55), 0.85 + 0.15 * sp)
        c = mixc(c, m, mud)
    if wet > 0:
        w = shade(mixc(mixc(c, PAL["mud"], 0.6), PAL["cool_mid"], 0.3), 0.8 + 0.12 * sp)
        c = mixc(c, w, wet)
    return shade(c, 0.95 + 0.1 * sp)

def build_road_ribbon():
    V, F, COL = [], [], []
    ncol = len(RIB_U)
    for (a, b) in RIB_SEGS:
        ds = [a + 2.0 * k for k in range(int(round((b - a) / 2.0)) + 1)]
        base = len(V)
        for d in ds:
            P, t = centre(d), tang_at(d)
            n_ = Vector((-t.y, t.x))
            for j, u in enumerate(RIB_U):
                z = 0.03
                uu = u
                if j in (0, ncol - 1):
                    z = 0.0
                    sgn = 1 if u > 0 else -1
                    bite = max(0.0, N1(d * 0.12, sgn * 4.0, 1.0)) * 2.4          # crumbling edge: bites and bays
                    uu = u - sgn * (bite + 0.5 * N1(d * 0.5, sgn, 2.0))
                elif j in (1, ncol - 2):
                    uu = u + (0.4 * N1(d * 0.3, j, 3.0))
                elif 5 <= j <= 9 and j != 7:
                    z = 0.012                                                      # ruts dip
                elif j == 7:
                    z = 0.036
                w = P + n_ * uu
                V.append((w.x, w.y, z))
        for i in range(len(ds) - 1):
            for j in range(ncol - 1):
                p0 = base + i * ncol + j
                F.append((p0, p0 + ncol, p0 + ncol + 1, p0 + 1))
                COL.append(road_colour(ds[i], (RIB_U[j] + RIB_U[j + 1]) / 2.0, i, j))
    return flat_obj("road_ribbon_s1", V, F, COL, coll("30_road"))

# six shack slots for S1-3 (distance along the road, offset north) and the foot-path network that serves them
SHACK_SLOTS = [("S1", 72, 31), ("S2", 90, 31), ("S3", 108, 31), ("S4", 126, 31), ("S5", 82, 47), ("S6", 117, 47)]
WALKWAY = (62.0, 140.0, 24.0, 2.2)           # d from, d to, offset north, width

def foot_paths():
    paths = []
    camp = Vector((_L["campfires"][0]["x"], -_L["campfires"][0]["z"]))
    cd, cu = world_to_du(camp)
    paths.append(("trailhead_gate_to_fire", [du_w(2, 0.5), du_w(cd - 8, cu + 3), du_w(cd - 3, cu + 1.5), camp + Vector((-1.4, 0.8))], 1.7))
    paths.append(("trailhead_fire_to_rail", [camp + Vector((1.5, -0.6)), du_w(cd + 8, cu - 3), du_w(cd + 17, -9.5)], 1.5))
    for (sid, d, u) in SHACK_SLOTS[:4]:
        paths.append(("shack_%s_path" % sid, [du_w(d, 10.5), du_w(d + 0.4, 17.5), du_w(d - 0.3, 24.0), du_w(d, u - 5.0)], 1.6))
    for (sid, d, u) in SHACK_SLOTS[4:]:
        paths.append(("shack_%s_path" % sid, [du_w(d, WALKWAY[2] + 1.0), du_w(d + 0.8, 33), du_w(d - 0.5, 40), du_w(d, u - 5.0)], 1.5))
    paths.append(("shack_back_lane", [du_w(60, 36), du_w(80, 38.5), du_w(98, 37), du_w(118, 39), du_w(140, 36.5)], 1.8))
    paths.append(("headframe_yard_path", [du_w(240, 10.5), du_w(241, 18), du_w(238, 26), du_w(236, 38), du_w(244, 46)], 2.0))
    paths.append(("sluice_field_path", [du_w(150, -10.5), du_w(152, -19), du_w(148, -28), du_w(160, -31)], 1.6))
    paths.append(("stash_trail", [Vector(q) for q in STASH], 3.2))
    return paths

def build_paths():
    V, F, COL = [], [], []
    for name, pts, w in foot_paths():
        def cf(edge, i, w=w):
            k = 0.5 + 0.5 * N1(i * 0.6, w, 4.0)
            if edge > 0.7:
                return shade(mixc(PAL["sand_road"], PAL["sand_ground"], 0.5), 0.9)
            return shade(mixc(PAL["sand_ground"], PAPER, 0.22), 0.94 + 0.1 * k)
        strip_mesh(V, F, COL, pts, w, 0.034, 0.012, cf, step=1.4, meander=0.35, seed=len(F))
    return flat_obj("paths_s1", V, F, COL, coll("30_road"))

def build_walkway():
    rng = random.Random(21)
    d0, d1, off, wd = WALKWAY
    V, F, COL = [], [], []
    wood, dark = hexc("#6e4a2c"), hexc("#48301c")
    d = d0
    n = 0
    while d < d1:
        n += 1
        d += 0.34
        if n % 23 == 0:
            continue                                         # a missing board
        P, t = du_w(d, off), tang_at(d)
        n_ = Vector((-t.y, t.x))
        L = wd * rng.uniform(0.97, 1.03)
        bw = 0.28
        z = 0.07 + (0.015 if n % 17 == 0 else 0.0)           # a few lifted boards
        c = shade(mixc(wood, dark, rng.uniform(0.0, 0.55)), rng.uniform(0.9, 1.08))
        shift = rng.uniform(-0.05, 0.05)
        a = P + n_ * (-L / 2 + shift)
        b = P + n_ * (L / 2 + shift)
        corners = (a - t * (bw / 2), a + t * (bw / 2), b + t * (bw / 2), b - t * (bw / 2))
        base = len(V)
        for q in corners:
            V.append((q.x, q.y, z))
        for q in corners:
            V.append((q.x, q.y, 0.0))
        add = lambda f, col: (F.append(f), COL.append(col))
        add((base, base + 1, base + 2, base + 3), c)                       # top
        add((base, base + 4, base + 5, base + 1), shade(c, 0.6))           # long sides
        add((base + 2, base + 6, base + 7, base + 3), shade(c, 0.6))
    return flat_obj("walkway_planks_s1", V, F, COL, coll("30_road"))

def build_cobbles():
    V, F, COL = [], [], []
    rng = random.Random(31)
    camp = Vector((_L["campfires"][0]["x"], -_L["campfires"][0]["z"]))
    plazas = [("trailhead", camp, 7.0), ("claims", Vector((_L["places"][1]["x"], -_L["places"][1]["z"])), 9.5)]
    for name, c0, R in plazas:
        ring = [(c0.x + (R + 0.6) * math.cos(a), c0.y + (R + 0.6) * math.sin(a)) for a in [k * math.tau / 24 for k in range(24)]]
        add_poly(V, F, ring, 0.04)
        COL.append(shade(mixc(PAL["mud"], PAL["cliff_dark"], 0.4), 0.8))      # dark under-layer: the gaps read as mortar
        sp = 0.7
        q = int(R / sp) + 2
        for iy in range(-q, q + 1):
            for ix in range(-q, q + 1):
                x = c0.x + sp * (ix + 0.5 * (iy % 2)) + rng.uniform(-0.1, 0.1)
                y = c0.y + sp * 0.87 * iy + rng.uniform(-0.1, 0.1)
                rr = math.hypot(x - c0.x, y - c0.y)
                if rr > R * (1 + 0.1 * N1(x * 0.3, y * 0.3, 3.0)):
                    continue
                r = rng.uniform(0.29, 0.34)
                rot = rng.uniform(0, math.pi)
                hexp = [(x + r * math.cos(rot + k * math.pi / 3), y + r * math.sin(rot + k * math.pi / 3)) for k in range(6)]
                add_poly(V, F, hexp, 0.055 + rng.uniform(0, 0.025))
                COL.append(shade(mixc(PAL["stone"], mixc(PAL["sand_road"], PAL["scrub"], 0.3), rng.uniform(0.15, 0.7)), rng.uniform(0.85, 1.1)))
    return flat_obj("cobbles_s1", V, F, COL, coll("30_road"))

def build_decals():
    rng = random.Random(55)
    out = {}
    # wheel ruts: dark strips in short runs along the road
    V, F, COL = [], [], []
    for side in (-1, 1):
        d = -20.0
        while d < 372:
            run = rng.uniform(6, 16)
            if rng.random() < 0.8:
                pts = [du_w(d + k * 2.0, side * 2.05 + 0.15 * N1((d + k * 2.0) * 0.1, side, 1.0)) for k in range(int(run / 2.0) + 1)]
                strip_mesh(V, F, COL, pts, 0.5, 0.058, 0.052, lambda e, i: shade(mixc(PAL["sand_road"], PAL["cliff_dark"], 0.45), 0.9 + 0.1 * (i % 2)), step=1.8, ncross=3)
            d += run + rng.uniform(2, 8)
    out["decal_ruts_s1"] = (V, F, COL)
    # boot-sole footprints (soles only, no bodies)
    V, F, COL = [], [], []
    trails = [[(8, -4), (26, 4)], [(98, 9), (103, 27)], [(176, -8), (206, 4)], [(284, 7), (330, -5)], [(142, 24), (118, 27)]]
    sole = [(0.16, 0.0), (0.12, 0.065), (-0.02, 0.065), (-0.05, 0.045), (-0.05, -0.045), (-0.02, -0.065), (0.12, -0.065)]
    heel = [(-0.17, -0.048), (-0.08, -0.048), (-0.08, 0.048), (-0.17, 0.048)]
    for tr in trails:
        a, b = du_w(*tr[0]), du_w(*tr[1])
        L = (b - a).length
        hd = (b - a).normalized()
        nd = Vector((-hd.y, hd.x))
        k = 0
        while k * 0.72 < L:
            p = a + hd * (k * 0.72) + nd * (0.17 if k % 2 else -0.17) + nd * 0.2 * N1(k * 0.3, 3.3, 0.1)
            ang = math.atan2(hd.y, hd.x) + rng.uniform(-0.12, 0.12)
            ca, sa = math.cos(ang), math.sin(ang)
            for shape in (sole, heel):
                add_poly(V, F, [(p.x + x * ca - y * sa, p.y + x * sa + y * ca) for (x, y) in shape], 0.06)
                COL.append(shade(mixc(PAL["sand_road"], PAL["cliff_dark"], 0.4), 0.9))
            k += 1
    out["decal_footprints_s1"] = (V, F, COL)
    # puddle stains
    V, F, COL = [], [], []
    spots = [(45, -8), (98, -4), (150, 9), (176, -6), (205, 7), (262, -9), (282, 5), (296, -6), (310, 8), (322, -3), (338, 6), (352, -8), (366, 5),
             (88, 25), (126, 28), (300, -28), (330, -30), (240, 30), (180, 27), (60, -29), (118, 41), (200, -26)]
    for (d, u) in spots:
        c0 = du_w(d, u)
        rr = rng.uniform(0.5, 1.4)
        pts = [(c0.x + rr * (1 + 0.3 * N1(k * 1.3, d, 0.2)) * math.cos(k * math.tau / 11) * 1.4, c0.y + rr * (1 + 0.3 * N1(k * 1.3, d, 0.7)) * math.sin(k * math.tau / 11)) for k in range(11)]
        add_poly(V, F, pts, 0.057)
        COL.append(shade(mixc(mixc(PAL["cool_light"], PAL["sand_ground"], 0.35), PAL["mud"], 0.25), 0.92))
    out["decal_puddles_s1"] = (V, F, COL)
    # pebble scatter (small low prisms in clusters)
    V, F, COL = [], [], []
    for n in range(120):
        d = rng.uniform(-22, 372)
        u = rng.choice([-1, 1]) * rng.uniform(6, 13) if rng.random() < 0.7 else rng.uniform(-34, 34)
        c0 = du_w(d, u)
        for k in range(3):
            r = rng.uniform(0.07, 0.2)
            before = len(F)
            prism(V, F, c0.x + rng.uniform(-0.7, 0.7), c0.y + rng.uniform(-0.7, 0.7), 0.04, 0.04 + r * rng.uniform(0.5, 0.9), r, r * 0.6, 4, rng, jit=0.2, mid=False)
            c = shade(mixc(PAL["stone"], PAL["scrub"], rng.uniform(0.0, 0.6)), rng.uniform(0.8, 1.1))
            for _ in range(len(F) - before):
                COL.append(c)
    out["decal_pebbles_s1"] = (V, F, COL)
    # hay straw: thin sticks crossing, at the trailhead rail, shack row and sluice field
    V, F, COL = [], [], []
    bundles = [(24, -9.5), (26, -10.5), (70, 12), (86, 12.5), (104, 11), (120, 12), (150, -12), (170, 11), (196, -11), (228, 11.5)]
    for (d, u) in bundles:
        c0 = du_w(d, u)
        for k in range(9):
            ang = rng.uniform(0, math.pi)
            l = rng.uniform(0.5, 1.0)
            p = c0 + Vector((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6)))
            hd = Vector((math.cos(ang), math.sin(ang)))
            nd = Vector((-hd.y, hd.x)) * 0.025
            a, b = p - hd * l / 2, p + hd * l / 2
            add_poly(V, F, [(a.x - nd.x, a.y - nd.y), (b.x - nd.x, b.y - nd.y), (b.x + nd.x, b.y + nd.y), (a.x + nd.x, a.y + nd.y)], 0.062 + 0.002 * k)
            COL.append(shade(mixc(PAL["scrub"], PAPER, rng.uniform(0.0, 0.35)), rng.uniform(0.9, 1.1)))
    out["decal_straw_s1"] = (V, F, COL)
    objs = []
    for name, (V, F, COL) in out.items():
        objs.append(flat_obj(name, V, F, COL, coll("30_road")))
    return objs

def run_s1_2(render=False):
    run_s1_1(render=False)                         # keeps the relief current (adds the foot-path gaps in the berms)
    clear_generated("s1_2")
    objs = [build_road_ribbon(), build_paths(), build_walkway(), build_cobbles()] + build_decals()
    for (sid, d, u) in SHACK_SLOTS:
        p = du_w(d, u)
        m = add_marker("marker_slot_shack_%s" % sid, (p.x, p.y, 0.3), "slot", "SLOT_" + sid, 4.5, "Shack %s goes here (S1-3), door faces the road" % sid, 1.0)
        m["rw_gen"] = "s1_2"
    stats = {o.name: tris_of(o) for o in objs}
    stats["total_tris"] = sum(stats.values())
    print(json.dumps(stats, indent=1))
    if render:
        gc, cc = bpy.data.objects["GameCamera"], get_cam("ChaseCamera")
        for d in (45, 100, 183, 300):
            place_chase_camera(cc, d)
            render_to(cc, "s1-2_chase_d%03d" % d, (1920, 1080))
        place_game_camera(gc, 110)
        render_to(gc, "s1-2_game_camera_d110", (1920, 1080))
        render_to(bpy.data.objects["ReviewTopCamera"], "s1-2_top_down", (1920, 1080))
    return stats

# ================================================================ step S1-3: the Trailhead (0 to 60 m) and Shack Row (60 to 140 m)
# A small procedural modeller (Bld) builds each kit piece once; the scene then places linked instances of it.
# Local frame of every prop: +x along the road, +y north (away from the road), -y is the front, +z up.
from mathutils import Matrix

WOOD = hexc("#6e4a2c"); WOOD_D = hexc("#48301c"); IRON = hexc("#36383d"); BRASS = hexc("#d4a03e"); GLOW = hexc("#ffaa22")
FLAME_B = hexc("#f56218"); FLAME_T = hexc("#ffcc33"); CAC = hexc("#3e8646"); CAC_H = hexc("#549e5c")
CO_RED = hexc("#b33a2a"); CO_TEAL = hexc("#2f6f73"); FL_RED = hexc("#e63946"); FL_YEL = hexc("#ffcc00")
CREAM = mixc(PAPER, PAL["scrub"], 0.35); GREY_WOOD = mixc(WOOD, PAL["stone"], 0.45); DARK_IN = hexc("#241812")
LDIR = Vector((-0.8, -0.35))

def _l3(A, B, t):
    return (A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t)

class Bld:
    def __init__(s, seed=1):
        s.V, s.F, s.C = [], [], []
        s.r = random.Random(seed)

    def face(s, pts, col):
        b = len(s.V)
        s.V.extend([tuple(p) for p in pts])
        s.F.append(tuple(range(b, b + len(pts))))
        s.C.append(col)

    def face_out(s, pts, col, out):
        P = [Vector(p) for p in pts]
        n = (P[1] - P[0]).cross(P[2] - P[1])
        if n.dot(Vector(out)) < 0:
            pts = list(reversed(pts))
        s.face(pts, col)

    def card(s, pts, col):
        s.face(pts, col)
        s.face(list(reversed(pts)), col)

    def box(s, cx, cy, z0, w, d, h, col, rot=0.0, top=1.0, planks=0.0, shear=(0.0, 0.0), var=0.05):
        ca, sa = math.cos(rot), math.sin(rot)
        T = lambda x, y, z: (cx + x * ca - y * sa, cy + x * sa + y * ca, z)
        hw, hd = w / 2, d / 2
        bot = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]
        P0 = [T(x, y, z0) for x, y in bot]
        P1 = [T(x * top + shear[0] * h, y * top + shear[1] * h, z0 + h) for x, y in bot]
        for k in range(4):
            k1 = (k + 1) % 4
            ex, ey = bot[k1][0] - bot[k][0], bot[k1][1] - bot[k][1]
            ln = math.hypot(ex, ey)
            nx, ny = ey / ln, -ex / ln
            wx, wy = nx * ca - ny * sa, nx * sa + ny * ca
            lit = 0.72 + 0.28 * max(0.0, min(1.0, (wx * LDIR.x + wy * LDIR.y) * 0.7 + 0.5))
            segs = max(1, int(round(ln / planks))) if planks > 0 else 1
            for q in range(segs):
                t0, t1 = q / segs, (q + 1) / segs
                a0, a1 = _l3(P0[k], P0[k1], t0), _l3(P0[k], P0[k1], t1)
                b0, b1 = _l3(P1[k], P1[k1], t0), _l3(P1[k], P1[k1], t1)
                s.face((a0, a1, b1, b0), shade(col, lit * (1 + s.r.uniform(-var, var) * (1.8 if planks > 0 else 1))))
        s.face(P1, shade(col, 1.06 * (1 + s.r.uniform(-var, var))))

    def _frame(s, a, b):
        ax = (Vector(b) - Vector(a)).normalized()
        ref = Vector((0, 0, 1)) if abs(ax.z) < 0.95 else Vector((1, 0, 0))
        e1 = ax.cross(ref).normalized()
        e2 = ax.cross(e1)
        return ax, e1, e2

    def beam(s, a, b, w, d, col, caps=True):
        a, b = Vector(a), Vector(b)
        ax, e1, e2 = s._frame(a, b)
        ring = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
        A = [a + e1 * (x * w / 2) + e2 * (y * d / 2) for x, y in ring]
        B = [b + e1 * (x * w / 2) + e2 * (y * d / 2) for x, y in ring]
        for k in range(4):
            k1 = (k + 1) % 4
            nrm = (A[k1] - A[k]).cross(B[k] - A[k]).normalized()
            lit = 0.72 + 0.28 * max(0.0, min(1.0, (nrm.x * LDIR.x + nrm.y * LDIR.y) * 0.7 + 0.5))
            s.face((A[k], A[k1], B[k1], B[k]), shade(col, lit * (1 + s.r.uniform(-0.05, 0.05))))
        if caps:
            s.face(B, shade(col, 1.0))
            s.face(list(reversed(A)), shade(col, 0.8))

    def tube(s, a, b, r0, r1, n, col, caps=(True, True), sq=(1.0, 1.0), var=0.04):
        a, b = Vector(a), Vector(b)
        ax, e1, e2 = s._frame(a, b)
        A, B = [], []
        for k in range(n):
            th = math.tau * k / n
            v = e1 * (math.cos(th) * sq[0]) + e2 * (math.sin(th) * sq[1])
            A.append(a + v * r0)
            B.append(b + v * r1)
        for k in range(n):
            k1 = (k + 1) % n
            nrm = (A[k1] - A[k]).cross(B[k] - A[k]).normalized()
            lit = 0.72 + 0.28 * max(0.0, min(1.0, (nrm.x * LDIR.x + nrm.y * LDIR.y) * 0.7 + 0.5))
            s.face((A[k], A[k1], B[k1], B[k]), shade(col, lit * (1 + s.r.uniform(-var, var))))
        if caps[1]:
            s.face(B, shade(col, 1.05))
        if caps[0]:
            s.face(list(reversed(A)), shade(col, 0.8))

    def cyl(s, cx, cy, z0, r0, r1, h, n, col, rot=0.0, sq=(1.0, 1.0), caps=(False, True)):
        s.tube((cx, cy, z0), (cx, cy, z0 + h), r0, r1, n, col, caps=caps, sq=sq)

    def slab(s, p0, p1, p2, p3, thick, col, up=True, var=0.04):
        P = [Vector(p) for p in (p0, p1, p2, p3)]
        n = (P[1] - P[0]).cross(P[3] - P[0]).normalized()
        if up and n.z < 0:
            P = [P[0], P[3], P[2], P[1]]
            n = -n
        Q = [p - n * thick for p in P]
        lit = 0.72 + 0.28 * max(0.0, min(1.0, (n.x * LDIR.x + n.y * LDIR.y) * 0.7 + 0.5))
        s.face(P, shade(col, (0.78 + 0.3 * max(0.0, n.z)) * (1 + s.r.uniform(-var, var))))
        s.face(list(reversed(Q)), shade(col, 0.55))
        for k in range(4):
            k1 = (k + 1) % 4
            s.face((P[k], Q[k], Q[k1], P[k1]), shade(col, 0.7 * lit))

    def rock(s, cx, cy, z0, r, h, col, n=7, sq=(1.0, 1.0), var=0.1):
        base = len(s.V)
        rings = [(z0, r), (z0 + h * 0.55, r * 0.92), (z0 + h, r * 0.55)]
        jr = [1 + s.r.uniform(-0.2, 0.2) for _ in range(n)]
        for (z, rr) in rings:
            for k in range(n):
                a = math.tau * k / n
                s.V.append((cx + rr * jr[k] * math.cos(a) * sq[0], cy + rr * jr[k] * math.sin(a) * sq[1], z + s.r.uniform(-0.04, 0.04) * h))
        for ri in range(2):
            for k in range(n):
                k1 = (k + 1) % n
                f = (base + ri * n + k, base + ri * n + k1, base + (ri + 1) * n + k1, base + (ri + 1) * n + k)
                s.F.append(f)
                s.C.append(shade(col, (0.8 + 0.1 * ri + 0.18 * (k % 2)) * (1 + s.r.uniform(-var, var))))
        s.F.append(tuple(base + 2 * n + k for k in range(n)))
        s.C.append(shade(col, 1.05))

    def apply(s, M, start=0):
        for i in range(start, len(s.V)):
            v = M @ Vector(s.V[i])
            s.V[i] = (v.x, v.y, v.z)

    def ground(s, start=0):
        zmin = min(v[2] for v in s.V[start:])
        for i in range(start, len(s.V)):
            s.V[i] = (s.V[i][0], s.V[i][1], s.V[i][2] - zmin)

    def tris(s):
        return sum(len(f) - 2 for f in s.F)

    def finish(s, name, collection=None, smooth=False, glow=False, hide=False):
        me = bpy.data.meshes.new(name)
        me.from_pydata(s.V, [], s.F)
        me.update()
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        flat = []
        for p in me.polygons:
            c = s.C[p.index]
            for _ in p.loop_indices:
                flat.extend(c)
        attr.data.foreach_set("color", flat)
        if smooth:
            me.shade_smooth()
        else:
            try:
                me.shade_flat()
            except Exception:
                pass
        me.materials.append(get_glow_material() if glow else get_material())
        ob = bpy.data.objects.new(name, me)
        (collection or coll("50_props")).objects.link(ob)
        ob["rw_gen"] = "s1_3"
        if hide:
            ob.hide_render = True
            ob.hide_viewport = True
        return ob

def get_glow_material():
    m = bpy.data.materials.get("M_cloth_glow")
    if m is None:
        m = bpy.data.materials.new("M_cloth_glow")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    em.inputs["Strength"].default_value = 2.5
    return m

# ---------------------------------------------------------------- the kit (each builder returns a template object)
KITS = {}
KIT_TRIS = {}

def kit(name, b, **kw):
    ob = b.finish("kit_" + name, coll("50_props"), hide=True, **kw)
    KITS[name] = ob
    KIT_TRIS[name] = b.tris()
    return ob

def build_kits():
    KITS.clear(); KIT_TRIS.clear()
    r = random.Random(3)
    # --- crate (named nodes: crate_body and lid, the lid pivots at its back edge)
    b = Bld(1)
    b.box(0, 0, 0, 1.0, 1.0, 0.92, WOOD, planks=0.34)
    for z in (0.14, 0.7):
        b.box(0, 0, z, 1.04, 1.04, 0.07, IRON)
    for x in (-0.4, 0.4):
        b.box(x, 0, 0, 0.07, 1.04, 0.92, IRON)
    kit("crate_body", b)
    b = Bld(2)
    b.box(0, -0.52, 0, 1.04, 1.04, 0.09, mixc(WOOD, WOOD_D, 0.25), planks=0.35)
    b.box(0, -0.52, 0.09, 0.3, 0.3, 0.02, CO_RED)      # a made-up Company stamp, no text
    kit("crate_lid", b)
    # --- clay pot and its shards (named nodes pot_whole and pot_shards)
    b = Bld(4)
    prof = [(0.0, 0.26), (0.18, 0.40), (0.42, 0.46), (0.66, 0.38), (0.80, 0.27), (0.88, 0.31), (0.92, 0.27)]
    clay = PAL["cliff_light"]
    for i in range(len(prof) - 1):
        (z0, r0), (z1, r1) = prof[i], prof[i + 1]
        b.tube((0, 0, z0), (0, 0, z1), r0, r1, 9, mixc(clay, PAL["cliff_base"], 0.3 + 0.1 * (i % 3)), caps=(False, False))
    b.face([(0.27 * math.cos(math.tau * k / 9), 0.27 * math.sin(math.tau * k / 9), 0.92) for k in range(9)], shade(PAL["cliff_dark"], 0.5))
    kit("pot_whole", b, smooth=True)
    b = Bld(5)
    for k in range(6):
        a = math.tau * k / 6 + r.uniform(-0.3, 0.3)
        c = Vector((0.38 * math.cos(a), 0.38 * math.sin(a), 0.0))
        pts = [(c.x + 0.16 * math.cos(a + t), c.y + 0.16 * math.sin(a + t), 0.0) for t in (0.2, 2.3, 4.4)]
        b.slab(pts[0], pts[1], pts[2], pts[2], 0.03, clay) if False else b.face([(p[0], p[1], 0.06 + 0.04 * (k % 2)) for p in pts], shade(clay, 0.9 + 0.1 * (k % 2)))
        b.face([(p[0], p[1], 0.0) for p in reversed(pts)], shade(PAL["cliff_dark"], 0.7))
    kit("pot_shards", b)
    # --- barrel (whole, broken)
    b = Bld(6)
    prof = [(0.0, 0.31), (0.28, 0.37), (0.55, 0.40), (0.82, 0.37), (1.0, 0.31)]
    for i in range(4):
        b.tube((0, 0, prof[i][0]), (0, 0, prof[i + 1][0]), prof[i][1], prof[i + 1][1], 10, mixc(WOOD, WOOD_D, 0.15 * (i % 2)), caps=(False, False))
    b.face([(0.3 * math.cos(math.tau * k / 10), 0.3 * math.sin(math.tau * k / 10), 1.0) for k in range(10)], shade(WOOD_D, 1.0))
    for z, rr in ((0.2, 0.355), (0.8, 0.375)):
        b.tube((0, 0, z - 0.03), (0, 0, z + 0.03), rr + 0.01, rr + 0.01, 10, IRON, caps=(False, False))
    kit("barrel_whole", b, smooth=True)
    b = Bld(7)
    for k in range(8):
        a = math.tau * k / 8
        ca, sa = math.cos(a), math.sin(a)
        b.beam((0.18 * ca, 0.18 * sa, 0.03), (0.52 * ca, 0.52 * sa, 0.62 - 0.1 * (k % 3)), 0.17, 0.04, WOOD if k % 2 else WOOD_D)
    b.tube((0, 0, 0.02), (0, 0, 0.06), 0.4, 0.4, 10, IRON, caps=(False, False))
    kit("barrel_broken", b)
    # --- small things
    b = Bld(8)
    b.cyl(0, 0, 0, 0.05, 0.06, 0.1, 6, IRON)
    kit("tin_cup", b)
    b = Bld(9)
    b.tube((0, 0, 0.0), (0, 0, 0.16), 0.09, 0.07, 8, IRON)
    b.tube((0.07, 0, 0.1), (0.2, 0, 0.17), 0.015, 0.012, 5, IRON)
    b.tube((-0.09, 0, 0.12), (-0.15, 0, 0.06), 0.012, 0.012, 5, IRON)
    kit("coffee_pot", b)
    b = Bld(10)
    b.tube((-0.5, 0, 0.17), (0.5, 0, 0.17), 0.17, 0.17, 8, mixc(CO_TEAL, CREAM, 0.3))
    b.box(0, 0.0, 0.0, 1.0, 0.7, 0.03, mixc(CO_TEAL, CREAM, 0.1))
    b.tube((-0.2, 0, 0.34), (0.2, 0, 0.34), 0.03, 0.03, 5, WOOD_D)
    kit("bedroll", b)
    b = Bld(11)
    b.tube((-0.8, 0, 0.2), (0.8, 0, 0.2), 0.2, 0.19, 8, GREY_WOOD)
    kit("log_seat", b)
    # --- lantern: frame and glow are separate (named nodes lantern and glow)
    b = Bld(12)
    b.box(0, 0, 0, 0.3, 0.3, 0.05, BRASS)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.beam((sx * 0.12, sy * 0.12, 0.05), (sx * 0.12, sy * 0.12, 0.42), 0.03, 0.03, BRASS)
    b.box(0, 0, 0.42, 0.34, 0.34, 0.05, BRASS, top=0.5)
    b.tube((0, 0, 0.5), (0, 0, 0.62), 0.07, 0.01, 5, BRASS)
    kit("lantern_frame", b)
    b = Bld(13)
    b.box(0, 0, 0.07, 0.2, 0.2, 0.33, GLOW)
    kit("lantern_glow", b, glow=True)
    # --- campfire: stones, logs, glow disc, flame (named nodes campfire_stones, campfire_logs, fire_glow, fire_flame)
    b = Bld(14)
    for k in range(13):
        a = math.tau * k / 13
        b.rock(0.78 * math.cos(a), 0.78 * math.sin(a), 0, r.uniform(0.17, 0.24), r.uniform(0.18, 0.3), PAL["stone"], n=6)
    kit("campfire_stones", b)
    b = Bld(15)
    for k in range(4):
        a = math.tau * k / 4 + 0.4
        b.tube((0.5 * math.cos(a), 0.5 * math.sin(a), 0.1), (-0.05 * math.cos(a), -0.05 * math.sin(a), 0.32), 0.09, 0.08, 6, WOOD_D)
    kit("campfire_logs", b)
    b = Bld(16)
    b.face([(0.62 * math.cos(math.tau * k / 12), 0.62 * math.sin(math.tau * k / 12), 0.03) for k in range(12)], shade(GLOW, 0.8))
    kit("fire_glow", b, glow=True)
    b = Bld(17)
    for i, (rr, hh, c) in enumerate(((0.34, 0.55, FLAME_B), (0.24, 0.8, mixc(FLAME_B, FLAME_T, 0.5)), (0.14, 1.0, FLAME_T))):
        b.tube((0, 0, 0.18), (0.04 * i, 0.03 * i, 0.18 + hh), rr, 0.01, 6, c, caps=(False, False))
    kit("fire_flame", b, glow=True)
    # --- plants
    b = Bld(18)
    for k in range(3):
        a = k * math.pi / 3
        ca, sa = math.cos(a), math.sin(a)
        for sgn in (1, -1):
            h = r.uniform(0.55, 0.85)
            b.card([(-sgn * 0.07 * ca, -sgn * 0.07 * sa, 0), (sgn * 0.07 * ca, sgn * 0.07 * sa, 0), (sgn * 0.01 * ca + 0.05 * sa, sgn * 0.01 * sa, h), (-sgn * 0.01 * ca, -sgn * 0.01 * sa, h * 0.95)], shade(PAL["scrub"], r.uniform(0.85, 1.1)))
    kit("tuft_dry", b)
    b = Bld(19)
    for k in range(5):
        a = k * math.pi / 2.5
        h = r.uniform(0.35, 0.55)
        ca, sa = math.cos(a), math.sin(a)
        b.card([(-0.07 * ca, -0.07 * sa, 0), (0.07 * ca, 0.07 * sa, 0), (0.02 * ca, 0.02 * sa, h)], mixc(PAL["scrub"], CAC, 0.35 + 0.1 * (k % 3)))
    kit("tuft_green", b)
    for nm, col in (("red", FL_RED), ("yellow", FL_YEL)):
        b = Bld(20 if nm == "red" else 21)
        for k in range(8):
            x, y = r.uniform(-0.6, 0.6), r.uniform(-0.6, 0.6)
            h = r.uniform(0.3, 0.55)
            a = r.uniform(0, math.pi)
            ca, sa = math.cos(a), math.sin(a)
            b.card([(x - 0.03 * ca, y - 0.03 * sa, 0), (x + 0.03 * ca, y + 0.03 * sa, 0), (x, y, h)], mixc(CAC, PAL["scrub"], 0.3))
            b.cyl(x, y, h, 0.09, 0.05, 0.07, 5, col)
        for k in range(3):
            a = k * 2.1
            b.card([(-0.3 * math.cos(a), -0.3 * math.sin(a), 0), (0.3 * math.cos(a), 0.3 * math.sin(a), 0), (0, 0, 0.22)], CAC)
        kit("flowers_" + nm, b)
    for v in range(3):
        b = Bld(30 + v)
        h = (3.6, 4.6, 3.0)[v]
        b.tube((0, 0, 0), (0, 0, h), 0.34, 0.27, 8, CAC, caps=(False, False))
        b.tube((0, 0, h), (0, 0, h + 0.3), 0.27, 0.05, 8, CAC_H, caps=(False, False))
        arms = [(1.5, 1, 0.9), (2.0, -1, 0.7)][: (1, 2, 0)[v]]
        for (z, sgn, up) in arms:
            b.tube((0.2 * sgn, 0, z), (0.95 * sgn, 0, z), 0.18, 0.16, 6, CAC, caps=(False, False))
            b.tube((0.95 * sgn, 0, z), (0.95 * sgn, 0, z + up + 0.6), 0.16, 0.15, 6, CAC, caps=(False, False))
            b.tube((0.95 * sgn, 0, z + up + 0.6), (0.95 * sgn, 0, z + up + 0.85), 0.15, 0.03, 6, CAC_H, caps=(False, False))
        if v == 2:
            b.cyl(0, 0, h + 0.28, 0.14, 0.08, 0.14, 5, FL_RED)
        for k in range(8):
            a = math.tau * k / 8
            b.beam((0.3 * math.cos(a), 0.3 * math.sin(a), 0.2), (0.3 * math.cos(a), 0.3 * math.sin(a), h - 0.1), 0.025, 0.02, CAC_H)
        kit("saguaro_" + "abc"[v], b, smooth=False)
    b = Bld(34)
    b.cyl(0, 0, 0, 0.45, 0.34, 0.55, 8, CAC)
    b.cyl(0, 0, 0.5, 0.34, 0.06, 0.12, 8, CAC_H)
    b.cyl(0, 0, 0.58, 0.12, 0.08, 0.1, 5, FL_YEL)
    kit("barrel_cactus", b)
    b = Bld(35)
    for (x, y, z, s, rot) in ((0, 0, 0, 1.0, 0.2), (0.35, 0.1, 0.45, 0.8, 0.9), (-0.3, 0.05, 0.4, 0.75, -0.7)):
        b.tube((x, y, z + 0.2 * s), (x, y + 0.05, z + 0.2 * s + 0.05), 0.4 * s, 0.38 * s, 7, CAC, sq=(1.0, 0.18))
    b.cyl(0.35, 0.1, 0.9, 0.07, 0.05, 0.08, 5, FL_RED)
    kit("prickly_pear", b)
    b = Bld(36)
    for k in range(6):
        a = math.tau * k / 6
        b.tube((0.14 * math.cos(a), 0.14 * math.sin(a), 0.02), (0.55 * math.cos(a), 0.55 * math.sin(a), 0.34 + 0.12 * (k % 2)), 0.1, 0.01, 5, mixc(PAL["scrub"], CAC, 0.55))
    kit("sage", b)
    b = Bld(37)
    col = mixc(PAPER, PAL["stone"], 0.45)
    b.tube((0, 0, 0), (0.1, 0.05, 2.6), 0.22, 0.14, 6, col, caps=(False, False))
    b.tube((0.1, 0.05, 2.6), (0.5, 0.1, 3.5), 0.14, 0.08, 6, col)
    b.tube((0.05, 0.03, 1.6), (-1.2, 0.3, 2.7), 0.1, 0.05, 5, col)
    b.tube((0.1, 0.05, 2.2), (1.3, -0.3, 3.0), 0.09, 0.04, 5, col)
    b.tube((-0.7, 0.2, 2.2), (-1.0, 0.8, 3.1), 0.05, 0.02, 4, col)
    kit("dead_tree", b)
    for v in range(4):
        b = Bld(40 + v)
        rr = (0.9, 1.3, 1.7, 1.1)[v]
        b.rock(0, 0, 0, rr, rr * (0.8 + 0.2 * (v % 2)), mixc(PAL["stone"], PAL["cliff_base"], 0.25 * v), n=7, sq=(1.1, 0.9))
        if v == 1:
            b.rock(1.1, 0.5, 0, 0.6, 0.55, PAL["stone"], n=6)
        kit("boulder_" + "abcd"[v], b)
    # --- fences
    b = Bld(50)
    for x in (-1.5, 1.5):
        b.box(x, 0, 0, 0.12, 0.12, 1.15, GREY_WOOD)
    for z in (0.35, 0.75):
        b.box(0, 0.06, z, 3.0, 0.05, 0.09, GREY_WOOD)
    for i in range(6):
        b.box(-1.25 + i * 0.5, 0, 0, 0.11, 0.04, 1.0, mixc(GREY_WOOD, PAPER, 0.15 * (i % 2)), top=0.35)
    kit("fence_whole", b)
    b = Bld(51)
    b.box(-1.5, 0, 0, 0.12, 0.12, 1.15, GREY_WOOD)
    b.box(1.5, 0, 0, 0.12, 0.12, 1.15, GREY_WOOD, shear=(0.12, 0))
    b.beam((-1.5, 0.06, 0.35), (0.2, 0.06, 0.4), 0.05, 0.09, GREY_WOOD)
    b.beam((0.4, 0.06, 0.16), (1.5, 0.06, 0.8), 0.05, 0.09, GREY_WOOD)
    for i in (0, 1, 2, 5):
        b.box(-1.25 + i * 0.5, 0, 0, 0.11, 0.04, 1.0 - 0.3 * (i == 2), mixc(GREY_WOOD, PAPER, 0.15 * (i % 2)), top=0.35, shear=(0.12 * (i == 5), 0))
    b.beam((0.1, -0.2, 0.05), (0.9, 0.2, 0.08), 0.11, 0.04, GREY_WOOD)
    kit("fence_broken", b)
    # --- wheelbarrow, tub, outhouse, well, handcart, toy
    b = Bld(55)
    b.box(0, 0, 0.35, 1.0, 0.6, 0.3, WOOD, top=1.3, planks=0.3)
    b.tube((0.62, -0.06, 0.28), (0.62, 0.06, 0.28), 0.28, 0.28, 8, IRON)
    b.beam((-0.4, -0.24, 0.45), (-1.0, -0.3, 0.7), 0.05, 0.05, WOOD_D)
    b.beam((-0.4, 0.24, 0.45), (-1.0, 0.3, 0.7), 0.05, 0.05, WOOD_D)
    for sy in (-1, 1):
        b.beam((-0.35, sy * 0.24, 0.35), (-0.4, sy * 0.24, 0.0), 0.05, 0.05, WOOD_D)
    kit("wheelbarrow", b)
    b = Bld(56)
    b.cyl(0, 0, 0, 0.42, 0.52, 0.4, 10, mixc(IRON, WOOD, 0.4))
    b.tube((0.5, 0, 0.3), (0.62, 0, 0.3), 0.04, 0.04, 5, IRON)
    kit("washtub", b)
    b = Bld(57)
    b.box(0, 0, 0, 1.5, 1.5, 2.3, GREY_WOOD, planks=0.3, shear=(0.1, 0.0))
    b.box(0, -0.78, 0.1, 0.8, 0.05, 1.9, WOOD_D, shear=(0.1, 0))
    b.slab((-0.95, -0.95, 2.45), (0.95, -0.95, 2.45), (0.95, 0.95, 2.75), (-0.95, 0.95, 2.75), 0.1, hexc("#8c3f26"))
    kit("outhouse", b)
    b = Bld(58)
    for k in range(10):
        a = math.tau * k / 10
        b.rock(0.95 * math.cos(a), 0.95 * math.sin(a), 0, 0.3, 0.55, PAL["stone"], n=5)
    b.box(-0.95, 0, 0.3, 0.14, 0.14, 2.2, WOOD_D, shear=(0.1, 0))
    b.box(0.95, 0, 0.3, 0.14, 0.14, 2.2, WOOD_D, shear=(-0.05, 0))
    b.beam((-0.9, 0, 2.5), (0.95, 0, 2.5), 0.12, 0.12, WOOD)
    b.slab((-1.2, -0.7, 2.5), (1.2, -0.7, 2.5), (1.2, 0, 3.1), (-1.2, 0, 3.1), 0.06, hexc("#8c3f26"))
    b.slab((1.2, 0.7, 2.5), (-1.2, 0.7, 2.5), (-1.2, 0, 3.1), (1.2, 0, 3.1), 0.06, hexc("#8c3f26"))
    b.tube((0.1, 0, 2.5), (0.1, 0, 1.4), 0.015, 0.015, 4, hexc("#c8a256"))
    b.cyl(0.1, 0, 1.0, 0.16, 0.2, 0.4, 7, WOOD)
    kit("well", b)
    # handcart (tipped on its side, spilling) built upright then rotated about its base
    b = Bld(59)
    s0 = len(b.V)
    b.box(0, 0, 0.45, 1.5, 0.9, 0.5, mixc(WOOD, GREY_WOOD, 0.35), top=1.15, planks=0.3)
    for sy in (-1, 1):
        b.tube((0, sy * 0.52, 0.35), (0, sy * 0.6, 0.35), 0.37, 0.37, 10, IRON)
    b.beam((0.7, -0.3, 0.55), (2.1, -0.35, 0.9), 0.06, 0.06, WOOD_D)
    b.beam((0.7, 0.3, 0.55), (2.1, 0.35, 0.9), 0.06, 0.06, WOOD_D)
    b.apply(Matrix.Rotation(math.radians(78), 4, "X"), s0)
    b.apply(Matrix.Rotation(math.radians(-18), 4, "Z"), s0)
    b.ground(s0)
    kit("handcart_tipped", b)
    b = Bld(60)
    for k in range(14):
        b.rock(r.uniform(-1.1, 1.1), r.uniform(-0.8, 0.8), 0, r.uniform(0.1, 0.22), r.uniform(0.1, 0.2), mixc(PAL["stone"], CAC, 0.3 * (k % 3 == 0)), n=5)
    kit("ore_spill", b)
    b = Bld(61)       # a child's wooden pull toy on wheels (a toy, not an animal model)
    b.box(0, 0, 0.14, 0.34, 0.14, 0.14, mixc(CREAM, WOOD, 0.4))
    b.box(0.2, 0, 0.26, 0.1, 0.1, 0.18, WOOD)
    b.box(0.26, 0, 0.42, 0.14, 0.1, 0.1, WOOD, top=0.7)
    for (x, y) in ((-0.1, -0.09), (-0.1, 0.09), (0.12, -0.09), (0.12, 0.09)):
        b.tube((x, y - 0.015, 0.07), (x, y + 0.015, 0.07), 0.07, 0.07, 8, CO_RED)
    kit("toy_pull", b)
    # --- hitching rail, notice board, telegraph pole, gate
    b = Bld(62)
    for x in (-1.4, 1.4):
        b.box(x, 0, 0, 0.18, 0.18, 1.3, WOOD_D)
    b.beam((-1.5, 0, 1.0), (1.5, 0, 1.0), 0.14, 0.14, WOOD)
    b.beam((-1.4, 0, 0.5), (1.4, 0, 0.55), 0.08, 0.08, WOOD)
    kit("hitching_rail", b)
    b = Bld(63)
    for x in (-0.95, 0.95):
        b.box(x, 0, 0, 0.14, 0.14, 2.3, WOOD_D)
    b.box(0, 0, 0.9, 2.0, 0.08, 1.3, mixc(WOOD, WOOD_D, 0.2), planks=0.5)
    b.slab((-1.15, -0.15, 2.25), (1.15, -0.15, 2.25), (1.15, 0.3, 2.45), (-1.15, 0.3, 2.45), 0.07, hexc("#8c3f26"))
    for k in range(16):
        x, z = -0.8 + 0.4 * (k % 5) + r.uniform(-0.05, 0.05), 1.05 + 0.4 * (k // 5) + r.uniform(-0.04, 0.04)
        rot = r.uniform(-0.2, 0.2)
        c = mixc(PAPER, PAL["scrub"], r.uniform(0.0, 0.5))
        ca, sa = math.cos(rot), math.sin(rot)
        w, h = 0.27, 0.34
        b.face([(x + (-w / 2) * ca + (-h / 2) * -sa * 0, -0.06, z - h / 2), (x + w / 2, -0.06, z - h / 2), (x + w / 2, -0.06, z + h / 2), (x - w / 2, -0.06, z + h / 2)], c)
        if k % 4 == 0:
            b.face([(x - 0.06, -0.062, z + 0.02), (x + 0.06, -0.062, z + 0.02), (x + 0.06, -0.062, z + 0.1), (x - 0.06, -0.062, z + 0.1)], CO_RED)
    kit("notice_board", b)
    b = Bld(64)
    b.tube((0, 0, 0), (0, 0, 7.0), 0.16, 0.11, 7, GREY_WOOD, caps=(False, True))
    b.beam((-0.95, 0, 6.35), (0.95, 0, 6.35), 0.12, 0.14, GREY_WOOD)
    b.beam((-0.5, 0, 5.5), (-0.1, 0, 6.2), 0.07, 0.07, GREY_WOOD)
    b.beam((0.5, 0, 5.5), (0.1, 0, 6.2), 0.07, 0.07, GREY_WOOD)
    for x in (-0.85, -0.3, 0.3, 0.85):
        b.cyl(x, 0, 6.4, 0.05, 0.04, 0.16, 5, CO_TEAL)
    kit("telegraph_pole", b)
    build_gate()

def build_gate():
    b = Bld(70)
    for sx in (-1, 1):
        x = sx * 4.6
        b.box(x, 0, 0, 0.5, 0.5, 5.4, WOOD_D, planks=0.25)
        b.box(x, 0, 5.4, 0.7, 0.7, 0.16, WOOD)
        b.beam((x, 0, 3.4), (x - sx * 1.4, 0, 5.2), 0.2, 0.2, WOOD)
        b.rock(x, 0, 0, 0.55, 0.5, PAL["stone"], n=6)
    b.beam((-5.2, 0, 5.2), (5.2, 0, 5.2), 0.5, 0.5, WOOD)
    b.beam((-4.6, 0, 4.2), (4.6, 0, 4.2), 0.26, 0.26, WOOD_D)
    b.beam((-5.0, 0, 5.62), (5.0, 0, 5.62), 0.34, 0.34, GREY_WOOD)
    # signboard hung from the beam on two chains: a pick and a rail pictogram (no text)
    for x in (-1.2, 1.2):
        b.beam((x, 0, 4.2), (x, 0, 3.5), 0.03, 0.03, IRON)
    b.box(0, -0.05, 2.6, 2.8, 0.14, 1.0, mixc(WOOD, WOOD_D, 0.4), planks=0.4)
    b.beam((-0.55, -0.14, 2.75), (0.4, -0.14, 3.4), 0.1, 0.03, PAPER)
    b.beam((0.4, -0.14, 3.4), (0.7, -0.14, 3.1), 0.2, 0.03, IRON)
    b.beam((-0.9, -0.14, 2.9), (0.9, -0.14, 2.9), 0.07, 0.03, CREAM)
    for x in (-0.7, -0.2, 0.3, 0.8):
        b.beam((x, -0.14, 2.8), (x, -0.14, 3.0), 0.06, 0.03, WOOD_D)
    # a made-up rail-and-rising-sun emblem plate
    b.box(3.3, -0.1, 4.45, 0.9, 0.08, 0.6, CO_RED)
    b.face([(3.3 + 0.28 * math.cos(math.pi * k / 6), -0.15, 4.5 + 0.28 * math.sin(math.pi * k / 6)) for k in range(7)], FLAME_T)
    b.beam((2.95, -0.16, 4.5), (3.65, -0.16, 4.5), 0.7, 0.02, IRON) if False else b.beam((2.95, -0.16, 4.52), (3.65, -0.16, 4.52), 0.05, 0.02, IRON)
    # lantern on a hook (named group lantern, parts lantern_frame and glow come from the kit)
    b.beam((-4.2, 0, 5.0), (-4.2, -0.5, 5.0), 0.06, 0.06, IRON)
    kit("gate_trailhead", b)

# ---------------------------------------------------------------- shacks (six distinct builds)
ROOF_RUST = hexc("#8c3f26"); ROOF_TEAL = mixc(CO_TEAL, PAPER, 0.12); ROOF_CREAM = mixc(CREAM, PAL["scrub"], 0.25); ROOF_CHAR = mixc(IRON, WOOD_D, 0.3)

def roof_gable(b, w, d, z, pitch, col, ov=0.55, patches=()):
    X, Y = w / 2 + ov, d / 2 + ov
    zr = z + pitch * (Y / (d / 2))
    b.slab((-X, -Y, z - 0.1), (X, -Y, z - 0.1), (X, 0, zr), (-X, 0, zr), 0.12, col)
    b.slab((X, Y, z - 0.1), (-X, Y, z - 0.1), (-X, 0, zr), (X, 0, zr), 0.12, col)
    for sx in (-1, 1):
        b.face_out([(sx * w / 2, -d / 2, z), (sx * w / 2, d / 2, z), (sx * w / 2, 0, z + pitch * 0.95)], shade(GREY_WOOD, 0.9), (sx, 0, 0))
    for (px, side, pc) in patches:
        yy = -1 if side == "f" else 1
        t0, t1 = 0.25, 0.7
        zz = lambda t: z - 0.1 + (zr - z + 0.1) * t
        b.slab((px - 0.9, yy * Y * (1 - t0), zz(t0) + 0.02), (px + 0.9, yy * Y * (1 - t0), zz(t0) + 0.02), (px + 0.9, yy * Y * (1 - t1), zz(t1) + 0.02), (px - 0.9, yy * Y * (1 - t1), zz(t1) + 0.02), 0.02, pc)

def door_window(b, w, d, z0, dx, col_door=WOOD_D, win_x=None):
    b.box(dx, -d / 2 - 0.04, z0, 1.0, 0.08, 2.05, col_door, planks=0.25)
    b.box(dx, -d / 2 - 0.06, z0 + 2.02, 1.3, 0.1, 0.12, WOOD)
    for sx in (-1, 1):
        b.box(dx + sx * 0.6, -d / 2 - 0.06, z0, 0.1, 0.1, 2.1, WOOD)
    if win_x is not None:
        b.box(win_x, -d / 2 - 0.03, z0 + 1.0, 0.9, 0.06, 0.8, DARK_IN)
        for sx in (-1, 1):
            b.box(win_x + sx * 0.55, -d / 2 - 0.07, z0 + 1.0, 0.4, 0.05, 0.8, mixc(CO_TEAL, WOOD_D, 0.4), planks=0.2)

def porch(b, w, d, z0, h, depth=1.7, raised=0.0, sag=0.0, col=ROOF_RUST):
    zd = z0 + raised
    b.box(0, -d / 2 - depth / 2, z0, w + 0.2, depth, 0.28 + raised, mixc(WOOD, GREY_WOOD, 0.4), planks=0.35)
    for px, ps in ((-w / 2 + 0.25, 0.0), (0.0, 0.0), (w / 2 - 0.25, sag)):
        b.box(px, -d / 2 - depth + 0.2, zd + 0.28, 0.14, 0.14, 2.35 - ps, WOOD_D)
    zt = zd + 0.28 + 2.35
    b.slab((-w / 2 - 0.2, -d / 2 + 0.05, zt + 0.3), (w / 2 + 0.2, -d / 2 + 0.05, zt + 0.3), (w / 2 + 0.2, -d / 2 - depth - 0.1, zt - 0.12 - sag), (-w / 2 - 0.2, -d / 2 - depth - 0.1, zt - 0.1), 0.1, col)
    if raised > 0:
        b.box(0, -d / 2 - depth / 2, z0, w + 0.1, depth - 0.15, raised, DARK_IN)       # the dark crawlspace behind the lattice
        for i in range(int((w + 0.2) / 0.45) + 1):
            x = -w / 2 - 0.1 + i * 0.45
            b.beam((x, -d / 2 - depth - 0.02, z0), (x + 0.4, -d / 2 - depth - 0.02, z0 + raised), 0.04, 0.03, GREY_WOOD)
            b.beam((x + 0.4, -d / 2 - depth - 0.02, z0), (x, -d / 2 - depth - 0.02, z0 + raised), 0.04, 0.03, GREY_WOOD)
        b.box(0.5, -d / 2 - depth - 0.35, z0, 1.6, 0.5, raised * 0.5, WOOD)        # step
    else:
        b.box(0.0, -d / 2 - depth - 0.35, z0, 1.2, 0.5, 0.14, WOOD)

def shack_spec(sid):
    return dict(
        S1=dict(w=6.0, d=5.0, h=2.9, wall=GREY_WOOD, roof=ROOF_RUST, kind="gable", pitch=1.35, porch=dict(sag=0.14), patches=((-1.2, "f", ROOF_TEAL), (1.5, "b", ROOF_CREAM)), chimney=(1.6, 0.8)),
        S2=dict(w=6.2, d=5.2, h=3.0, wall=mixc(WOOD, GREY_WOOD, 0.6), roof=ROOF_TEAL, kind="gable", pitch=1.3, porch=dict(raised=0.7, sag=0.1), open_door=True, patches=((1.0, "f", ROOF_CREAM),), chimney=(-1.8, 1.0)),
        S3=dict(w=9.0, d=4.5, h=2.8, wall=mixc(GREY_WOOD, PAL["stone"], 0.3), roof=ROOF_CHAR, kind="gable", pitch=1.1, porch=dict(), patches=((-2.5, "f", ROOF_RUST),), chimney=(3.0, 0.5), two_doors=True),
        S4=dict(w=6.0, d=4.2, h=2.6, wall=WOOD, roof=ROOF_CREAM, kind="lean", pitch=1.2, porch=None, patches=()),
        S5=dict(w=5.0, d=5.0, h=3.2, wall=mixc(CO_TEAL, GREY_WOOD, 0.55), roof=ROOF_RUST, kind="flat", pitch=0.0, porch=None, patches=(), falsefront=True),
        S6=dict(w=5.0, d=4.2, h=2.6, wall=mixc(WOOD_D, GREY_WOOD, 0.5), roof=ROOF_CREAM, kind="gable", pitch=1.15, porch=dict(sag=0.2), patches=((0.5, "f", ROOF_RUST), (-1.4, "b", ROOF_TEAL)), chimney=(-1.2, -0.6), lean=2.6),
    )[sid]

def build_shack(sid, seed):
    sp = shack_spec(sid)
    b = Bld(seed)
    w, d, h = sp["w"], sp["d"], sp["h"]
    wc = sp["wall"]
    z0 = 0.18 + (sp["porch"] or {}).get("raised", 0.0)
    b.box(0, 0, 0, w + 0.3, d + 0.3, z0, PAL["stone"])
    door_part = None
    if sp.get("open_door"):
        t = 0.2
        b.box(0, d / 2 - t / 2, z0, w, t, h, wc, planks=0.5)
        b.box(-w / 2 + t / 2, 0, z0, t, d, h, wc, planks=0.5)
        b.box(w / 2 - t / 2, 0, z0, t, d, h, wc, planks=0.5)
        dx, dw = -w * 0.18, 1.1
        lw, rw = (dx - dw / 2) + w / 2, w / 2 - (dx + dw / 2)
        b.box(-w / 2 + lw / 2, -d / 2 + t / 2, z0, lw, t, h, wc, planks=0.5)
        b.box(w / 2 - rw / 2, -d / 2 + t / 2, z0, rw, t, h, wc, planks=0.5)
        b.box(dx, -d / 2 + t / 2, z0 + 2.1, dw, t, h - 2.1, wc)
        b.box(0, 0, z0, w - 2 * t, d - 2 * t, 0.05, hexc("#33241a"))
        b.box(0, 0, z0 + h - 0.1, w - 2 * t, d - 2 * t, 0.1, WOOD_D)
        b.box(w / 2 - 0.9, -0.2, z0, 1.2, 0.9, 0.55, WOOD_D)              # a cot
        b.box(w * 0.18, -d / 2 - 0.04, z0 + 1.0, 0.9, 0.06, 0.8, DARK_IN)
        b.box(dx, -d / 2 - 0.06, z0 + 2.1, 1.3, 0.1, 0.12, WOOD)
        for sx in (-1, 1):
            b.box(dx + sx * 0.62, -d / 2 - 0.06, z0, 0.1, 0.1, 2.1, WOOD)
        bd = Bld(seed + 100)
        bd.box(dw / 2, 0, 0, dw, 0.08, 2.05, WOOD_D, planks=0.25)       # the door, hinge at x = 0
        door_part = (bd, (dx - dw / 2, -d / 2 - 0.02, z0))
    else:
        b.box(0, 0, z0, w, d, h, wc, planks=0.5)
        if sp.get("two_doors"):
            door_window(b, w, d, z0, -w * 0.3, win_x=-w * 0.05)
            door_window(b, w, d, z0, w * 0.3, win_x=w * 0.05)
        else:
            door_window(b, w, d, z0, -w * 0.17, win_x=w * 0.25)
        b.box(w / 2 + 0.02, 0, z0 + 1.1, 0.05, 0.8, 0.7, DARK_IN)
    zr = z0 + h
    if sp["kind"] == "gable":
        roof_gable(b, w, d, zr, sp["pitch"], sp["roof"], patches=sp["patches"])
    elif sp["kind"] == "lean":
        X, Y = w / 2 + 0.5, d / 2 + 0.5
        b.slab((-X, -Y, zr - 0.2), (X, -Y, zr - 0.2), (X, Y, zr + sp["pitch"]), (-X, Y, zr + sp["pitch"]), 0.12, sp["roof"])
        for sx in (-1, 1):
            b.face_out([(sx * w / 2, -d / 2, zr), (sx * w / 2, d / 2, zr), (sx * w / 2, d / 2, zr + sp["pitch"] - 0.05)], shade(wc, 0.9), (sx, 0, 0))
        b.slab((-X + 0.3, -Y + 0.4, zr - 0.18), (-X + 1.9, -Y + 0.4, zr - 0.18), (-X + 1.9, -Y + 2.0, zr + 0.2), (-X + 0.3, -Y + 2.0, zr + 0.2), 0.02, ROOF_TEAL)
    else:
        b.slab((-w / 2 - 0.2, -d / 2 - 0.2, zr), (w / 2 + 0.2, -d / 2 - 0.2, zr), (w / 2 + 0.2, d / 2 + 0.2, zr + 0.1), (-w / 2 - 0.2, d / 2 + 0.2, zr + 0.1), 0.15, sp["roof"])
        if sp.get("falsefront"):
            b.box(0, -d / 2 - 0.12, zr, w + 0.3, 0.2, 1.5, mixc(wc, WOOD, 0.3), planks=0.5)
            b.box(0, -d / 2 - 0.24, zr + 1.4, w * 0.5, 0.14, 0.35, CREAM)
            door_window(b, w, d, z0, -w * 0.15, win_x=w * 0.28)
    if sp.get("porch") is not None:
        porch(b, w, d, 0.0, h, depth=1.7, col=sp["roof"], **sp["porch"])
    if sp.get("chimney"):
        cx, cy = sp["chimney"]
        b.box(cx, cy, zr + 0.4, 0.7, 0.7, 1.6, mixc(PAL["stone"], PAL["cliff_base"], 0.3), top=0.85)
        b.box(cx, cy, zr + 2.0, 0.85, 0.85, 0.1, PAL["stone"])
    if sp.get("lean"):
        b.apply(Matrix.Rotation(math.radians(sp["lean"]), 4, "Y"))
    ob = kit("shack_" + sid, b)
    if door_part:
        bd, loc = door_part
        KITS["door_" + sid] = bd.finish("kit_door_" + sid, coll("50_props"), hide=True)
        KIT_TRIS["door_" + sid] = bd.tris()
        KITS["door_" + sid]["hinge"] = tuple(loc)
    return ob

# ---------------------------------------------------------------- placement
S13 = dict(count_prop=0, count_foliage=0, tris=[], markers=[], hides=0, inter=0)

def frame(d, u, x=0.0, y=0.0):
    """World point and heading for road-local coordinates: d along, u north of the centre line, then x along / y north of that."""
    t = tang_at(d)
    n = Vector((-t.y, t.x))
    P = centre(d) + n * u + t * x + n * y
    return Vector((P.x, P.y, 0.0)), math.atan2(t.y, t.x)

def new_empty(name, pos, rotz=0.0, parent=None, size=0.35):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "PLAIN_AXES"
    e.empty_display_size = size
    e.location = pos
    e.rotation_euler = (0, 0, rotz)
    (coll("50_props")).objects.link(e)
    e["rw_gen"] = "s1_3"
    if parent is not None:
        e.parent = parent
    return e

def inst(kit_name, name, pos, rotz=0.0, scale=1.0, parent=None, cat="prop", d=None, hide=False, rot=None, count=True):
    ob = bpy.data.objects.new(name, KITS[kit_name].data)
    ob.location = pos
    ob.rotation_euler = rot if rot is not None else (0, 0, rotz)
    ob.scale = (scale, scale, scale) if not isinstance(scale, tuple) else scale
    (coll("60_foliage") if cat == "foliage" else coll("50_props")).objects.link(ob)
    ob["rw_gen"] = "s1_3"
    ob["rw_cat"] = cat
    if d is not None:
        ob["rw_d"] = d
    if parent is not None:
        ob.parent = parent
    if hide:
        ob.hide_render = True
        ob.hide_viewport = True
    if count and parent is None:
        S13["count_foliage" if cat == "foliage" else "count_prop"] += 1
    if count:
        S13["tris"].append((d if d is not None else (parent["rw_d"] if parent is not None and "rw_d" in parent.keys() else 0), KIT_TRIS.get(kit_name, 0)))
    return ob

def marker(name, pos, rw_type, rw_id, radius, note):
    m = add_marker("marker_%s_%s" % (rw_type, name), (pos.x, pos.y, 0.3), rw_type, rw_id, radius, note, 0.9)
    m["rw_gen"] = "s1_3"
    S13["markers"].append((rw_id, rw_type, round(pos.x, 1), round(-pos.y, 1), radius, note))
    if rw_type == "hide":
        S13["hides"] += 1
    elif rw_type in ("breakable", "loot", "door", "lever", "climb", "lore", "vantage", "campfire", "hazard"):
        S13["inter"] += 1
    return m

def remove_old_trailhead():
    victims = [o for o in bpy.data.objects if not o.get("rw_gen") and o.users_scene and bpy.data.scenes["PeteArea1"] in o.users_scene
               and o.parent is None and o.location.x < -100 and o.type in ("MESH", "EMPTY")]
    for o in victims:
        for ch in list(o.children_recursive):
            me = ch.data if ch.type == "MESH" else None
            bpy.data.objects.remove(ch, do_unlink=True)
            if me is not None and me.users == 0:
                bpy.data.meshes.remove(me)
        me = o.data if o.type == "MESH" else None
        bpy.data.objects.remove(o, do_unlink=True)
        if me is not None and me.users == 0:
            bpy.data.meshes.remove(me)
    return len(victims)

def make_group(name, pos, rotz, d):
    g = new_empty(name, pos, rotz)
    g["rw_d"] = d
    return g

def crate_group(name, pos, rotz, d, open_=False):
    g = make_group("prop_crate_" + name, pos, rotz, d)
    inst("crate_body", "crate_body", Vector((0, 0, 0)), parent=g, d=d)
    lid = inst("crate_lid", "lid", Vector((0, 0.52, 0.92)), parent=g, d=d)
    if open_:
        lid.rotation_euler = (math.radians(-105), 0, 0)
    S13["count_prop"] += 1
    return g

def pot_group(name, pos, rotz, d):
    g = make_group("prop_pot_" + name, pos, rotz, d)
    inst("pot_whole", "pot_whole", Vector((0, 0, 0)), parent=g, d=d)
    inst("pot_shards", "pot_shards", Vector((0, 0, 0)), parent=g, d=d, hide=True)
    S13["count_prop"] += 1
    return g

def barrel_group(name, pos, rotz, d):
    g = make_group("prop_barrel_" + name, pos, rotz, d)
    inst("barrel_whole", "barrel_whole", Vector((0, 0, 0)), parent=g, d=d)
    inst("barrel_broken", "barrel_broken", Vector((0, 0, 0)), parent=g, d=d, hide=True)
    S13["count_prop"] += 1
    return g

def lantern_group(name, pos, d, rotz=0.0):
    g = make_group("lantern_" + name, pos, rotz, d)
    g.name = "lantern" if "lantern" not in bpy.data.objects else "lantern_" + name
    inst("lantern_frame", "lantern_frame", Vector((0, 0, 0)), parent=g, d=d)
    inst("lantern_glow", "glow", Vector((0, 0, 0)), parent=g, d=d)
    S13["count_prop"] += 1
    return g

def fence_break_group(name, pos, rotz, d):
    g = make_group("prop_fence_" + name, pos, rotz, d)
    inst("fence_whole", "fence_whole", Vector((0, 0, 0)), parent=g, d=d)
    inst("fence_broken", "fence_broken", Vector((0, 0, 0)), parent=g, d=d, hide=True)
    S13["count_prop"] += 1
    return g

def build_lamp_post():
    b = Bld(80)
    b.tube((0, 0, 0), (0, 0, 3.0), 0.1, 0.07, 6, WOOD_D)
    b.beam((0, 0, 2.9), (0.6, 0, 2.9), 0.07, 0.07, WOOD_D)
    b.beam((0.1, 0, 2.5), (0.5, 0, 2.85), 0.05, 0.05, WOOD_D)
    kit("lamp_post", b)

def wire_mesh(poles):
    b = Bld(81)
    for a, c in zip(poles, poles[1:]):
        for dz in (-0.85, -0.3, 0.3, 0.85):
            A, C = a.copy(), c.copy()
            for (p, off) in ((A, a), (C, c)):
                pass
            n = 16
            for k in range(n):
                t0, t1 = k / n, (k + 1) / n
                sag = lambda t: 0.9 * (1 - (2 * t - 1) ** 2)
                p0 = Vector((A.x + (C.x - A.x) * t0, A.y + (C.y - A.y) * t0, 6.45 - sag(t0)))
                p1 = Vector((A.x + (C.x - A.x) * t1, A.y + (C.y - A.y) * t1, 6.45 - sag(t1)))
                tt = (C - A).normalized()
                nn = Vector((-tt.y, tt.x, 0))
                off = nn * (dz * 0.9)
                b.beam(p0 + off, p1 + off, 0.03, 0.03, IRON, caps=False)
    ob = b.finish("telegraph_wire_s1", coll("50_props"))
    return ob

def scatter_ok(d, u):
    """Keep the centre line and 8 m either side free of standing props."""
    return abs(u) > 9.0

def build_laundry(d, u, seed):
    """H05: two hanging lines of grey sheets forming a small cloth corridor."""
    rng = random.Random(seed)
    b = Bld(seed)
    cols = [mixc(PAPER, PAL["stone"], 0.55), mixc(PAPER, PAL["stone"], 0.7), mixc(CREAM, PAL["stone"], 0.4), mixc(CO_TEAL, PAL["stone"], 0.6)]
    for yy in (-1.15, 1.15):
        for x in (-4.4, 4.4):
            b.tube((x, yy, 0), (x + 0.05, yy, 2.6), 0.07, 0.05, 5, WOOD_D)
        for k in range(18):
            t0, t1 = k / 18, (k + 1) / 18
            p = lambda t: Vector((-4.4 + 8.8 * t, yy, 2.5 - 0.28 * (1 - (2 * t - 1) ** 2)))
            b.beam(p(t0), p(t1), 0.025, 0.025, WOOD_D, caps=False)
        for i in range(6):
            x0 = -3.6 + i * 1.4 + rng.uniform(-0.1, 0.1)
            wdt = 1.05
            tt = lambda x: (x + 4.4) / 8.8
            top = lambda x: 2.5 - 0.28 * (1 - (2 * tt(x) - 1) ** 2)
            hang = rng.uniform(1.4, 1.75)
            c = cols[(i + (yy > 0)) % 4]
            for q in range(3):
                xa, xb = x0 + wdt * q / 3, x0 + wdt * (q + 1) / 3
                wa, wb = 0.07 * math.sin(xa * 3.1 + yy), 0.07 * math.sin(xb * 3.1 + yy)
                b.card([(xa, yy + wa, top(xa) - hang - 0.02 * q), (xb, yy + wb, top(xb) - hang - 0.02 * (q + 1)), (xb, yy + wb, top(xb)), (xa, yy + wa, top(xa))], shade(c, 0.92 + 0.05 * q))
    pos, ang = frame(d, u)
    ob = b.finish("prop_laundry_lines_%d" % d, coll("50_props"))
    ob.location = pos
    ob.rotation_euler = (0, 0, ang)
    ob["rw_gen"] = "s1_3"; ob["rw_d"] = d; ob["rw_cat"] = "prop"
    S13["count_prop"] += 1
    S13["tris"].append((d, b.tris()))
    return ob

def build_dry_garden():
    b = Bld(82)
    soil = mixc(PAL["mud"], PAL["cliff_dark"], 0.3)
    b.box(0, 0, 0, 3.0, 1.8, 0.04, soil)
    for sx in (-1, 1):
        b.beam((sx * 1.5, -0.9, 0.0), (sx * 1.5, 0.9, 0.0), 0.08, 0.2, GREY_WOOD)
    for sy in (-1, 1):
        b.beam((-1.5, sy * 0.9, 0.0), (1.5, sy * 0.9, 0.0), 0.08, 0.2, GREY_WOOD)
    r = random.Random(83)
    for row in range(4):
        for i in range(7):
            x, y = -1.2 + i * 0.4 + r.uniform(-0.05, 0.05), -0.6 + row * 0.4
            h = r.uniform(0.2, 0.55)
            for a in (0.0, math.pi / 2):
                ca, sa = math.cos(a), math.sin(a)
                b.card([(x - 0.05 * ca, y - 0.05 * sa, 0.04), (x + 0.05 * ca, y + 0.05 * sa, 0.04), (x + 0.02 * ca, y + 0.02 * sa, h)], mixc(PAL["scrub"], WOOD, r.uniform(0.2, 0.6)))
    kit("dry_garden", b)

def build_stack_lumber():
    b = Bld(84)
    r = random.Random(85)
    for row in range(4):
        for i in range(3 - row // 2):
            b.box(0, -0.2 + i * 0.22 - row * 0.02, row * 0.1, 2.4 - 0.1 * row, 0.2, 0.1, mixc(WOOD, GREY_WOOD, r.uniform(0.0, 0.6)))
    kit("lumber_stack", b)

def place_shack_yard(sid, d, u, pos, ang):
    """Yard dressing in the shack's own frame (x along the road, y north, front is -y)."""
    sp = shack_spec(sid)
    w, dp = sp["w"], sp["d"]
    cs, sn = math.cos(ang), math.sin(ang)
    P = lambda x, y, z=0.0: Vector((pos.x + x * cs - y * sn, pos.y + x * sn + y * cs, z))
    rot = lambda a=0.0: ang + a
    inst("shack_" + sid, "prop_shack_" + sid, P(0, 0), ang + (0.03 if sid in ("S3", "S5") else -0.03 * (sid == "S1")), d=d)
    return P, rot

def run_s1_3_place():
    S13.update(count_prop=0, count_foliage=0, tris=[], markers=[], hides=0, inter=0)
    rng = random.Random(404)
    removed = remove_old_trailhead()
    build_kits(); build_lamp_post(); build_dry_garden(); build_stack_lumber()
    for i, sid in enumerate(("S1", "S2", "S3", "S4", "S5", "S6")):
        build_shack(sid, 200 + i)

    # ---------------- the Trailhead (0 to 60 m)
    gp, ga = frame(-3, 0)
    g = make_group("prop_gate_trailhead", gp, ga + math.pi / 2, -3)
    inst("gate_trailhead", "gate_frame", Vector((0, 0, 0)), parent=g, d=-3)
    S13["count_prop"] += 1
    lg = lantern_group("gate", Vector((-4.2, -0.5, 4.38)), -3)
    lg.parent = g
    S13["count_prop"] -= 1
    marker("gate", gp, "lore", "TH_GATE", 6, "Trailhead gate: pick-and-rail pictogram signboard, Company emblem, lantern. Section 1 starts here.")

    camp = Vector((_L["campfires"][0]["x"], -_L["campfires"][0]["z"], 0.0))
    dc, uc = world_to_du(Vector((camp.x, camp.y)))
    fire = make_group("prop_campfire_a1-trail", camp, 0.0, dc)
    for nm, kn in (("campfire_stones", "campfire_stones"), ("campfire_logs", "campfire_logs"), ("fire_glow", "fire_glow"), ("fire_flame", "fire_flame")):
        inst(kn, nm, Vector((0, 0, 0)), parent=fire, d=dc)
    S13["count_prop"] += 1
    marker("a1-trail", camp, "campfire", "I01", 3.0, "Trailhead campfire, the first checkpoint (layout a1-trail). Keep 3 m clear.")
    _, a0 = frame(dc, uc)
    CP = lambda x, y, z=0.0: Vector((camp.x + x * math.cos(a0) - y * math.sin(a0), camp.y + x * math.sin(a0) + y * math.cos(a0), z))
    for (x, y, rr) in ((-2.4, -1.3, 0.5), (0.5, -2.8, 1.6), (2.6, -1.0, 2.6)):
        inst("log_seat", "prop_log_seat", CP(x, y), a0 + rr, d=dc)
    inst("bedroll", "prop_bedroll", CP(-1.7, -2.3), a0 + 0.4, d=dc)
    inst("coffee_pot", "prop_coffee_pot", CP(0.95, 0.4, 0.2), a0, d=dc)
    for k, (x, y) in enumerate(((1.35, -0.15), (1.6, 0.25), (1.25, 0.75))):
        inst("tin_cup", "prop_tin_cup", CP(x, y), a0, d=dc)
    for k, (x, y) in enumerate(((-3.5, 1.6), (-2.9, 2.4))):
        barrel_group("th%d" % k, CP(x, y), a0 + k, dc)
    crate_group("th_camp", CP(3.2, 1.8), a0 + 0.3, dc)
    inst("crate_body", "prop_crate_stack", CP(3.3, 1.7, 0.92), a0 + 0.9, d=dc)
    marker("sleeper-1", Vector((_L["guardAnchors"][0]["x"], -_L["guardAnchors"][0]["z"], 0)), "guard", "a1-sleeper-1", 8, "Layout guard anchor (a sleeper by the trail fire). Marker only; the game spawns the bandit.")
    marker("start", Vector((_L["start"]["x"], -_L["start"]["z"], 0)), "start", "START", 3, "Player start (layout).")
    hp, ha = frame(22, -10.0)
    inst("hitching_rail", "prop_hitching_rail", hp, ha, d=22)
    cp, ca = frame(36, -15.6)
    inst("handcart_tipped", "prop_handcart_tipped", cp, ca + 0.35, scale=1.5, d=36)
    inst("ore_spill", "prop_ore_spill", frame(36, -13.2, 0.8, 0.0)[0], ca, d=36)
    marker("H02", frame(36, -15.2, 1.0)[0], "hide", "H02", 2.5, "Tipped handcart against the south berm: a pocket behind it. Entrance on the road side.")
    nb, na = frame(14, 12.4)
    inst("notice_board", "prop_notice_board", nb, na, d=14)
    marker("I02", nb, "lore", "I02", 2.5, "Trailhead notice board: nailed papers, pictograms only; the story banner can appear here.")
    # H01 tall dry-grass patch with a trampled dip
    h1, _ = frame(30, 12.5)
    for k in range(46):
        x, y = rng.uniform(-2.5, 2.5), rng.uniform(-2.0, 2.0)
        if x * x / 1.6 + y * y / 1.0 < 0.5:
            continue
        pp, aa = frame(30, 12.5, x, y)
        inst("tuft_dry", "foliage_tall_grass", pp, rng.uniform(0, 6.28), rng.uniform(1.3, 1.9), cat="foliage", d=30)
    marker("H01", h1, "hide", "H01", 2.8, "Waist-high dry-grass patch (5 x 4 m) with a trampled dip. Hides a crouching marshal.")
    # telegraph poles with sagging wire (they start at 52 m)
    poles = []
    for dd in (52, 80, 108, 136):
        pp, aa = frame(dd, -12.6)
        inst("telegraph_pole", "prop_telegraph_pole", pp, aa + math.pi / 2, d=dd)
        poles.append(Vector((pp.x, pp.y, 0)))
    wire_mesh(poles)
    S13["count_prop"] += 1
    # pots and the layout crate
    for k, (pid, dxy) in enumerate((("a1-pot-1", _L["pots"][0]), ("a1-pot-2", _L["pots"][1]))):
        pp = Vector((dxy["x"], -dxy["z"], 0))
        dd, uu = world_to_du(Vector((pp.x, pp.y)))
        pot_group(pid, pp, rng.uniform(0, 6), dd)
        if k == 0:
            for (x, y) in ((0.8, 0.5), (-0.6, 0.7)):
                pot_group("th_extra%d" % int(x * 10), Vector((pp.x + x, pp.y + y, 0)), rng.uniform(0, 6), dd)
            marker(pid, pp, "breakable", "I03", 1.8, "Clay pot cluster (3 pots, layout %s). pot_whole / pot_shards." % pid)
        else:
            marker(pid, pp, "breakable", "I03b", 1.2, "Layout pot %s." % pid)
    cx, cy = _L["crates"][0]["x"], -_L["crates"][0]["z"]
    cd, _ = world_to_du(Vector((cx, cy)))
    crate_group("a1-crate-1", Vector((cx, cy, 0)), 0.3, cd)
    marker("a1-crate-1", Vector((cx, cy, 0)), "loot", "I08", 1.5, "Layout crate a1-crate-1 (ammo). crate_body / lid pivot at the back edge.")

    # ---------------- Shack Row (60 to 140 m)
    slot_pos = {}
    for (sid, d, u) in SHACK_SLOTS:
        pos, ang = frame(d, u)
        slot_pos[sid] = (pos, ang, d, u)
        for m in [o for o in bpy.data.objects if o.name == "marker_slot_shack_%s" % sid]:
            pass
    placements = {}
    for sid in ("S1", "S2", "S3", "S4", "S5", "S6"):
        pos, ang, d, u = slot_pos[sid]
        sp = shack_spec(sid)
        w, dp = sp["w"], sp["d"]
        s_obj = inst("shack_" + sid, "prop_shack_" + sid, pos + Vector((0, 0, 0)), ang + (-0.04 if sid in ("S1", "S4") else 0.035 * (sid == "S6")), d=d)
        P = lambda x, y, z=0.0, pos=pos, ang=ang: Vector((pos.x + x * math.cos(ang) - y * math.sin(ang), pos.y + x * math.sin(ang) + y * math.cos(ang), z))
        placements[sid] = P
    # S2: the open door, a dim room with a loot crate (I15, also a hiding place)
    P2, ang2 = placements["S2"], slot_pos["S2"][1]
    hinge = KITS["door_S2"]["hinge"]
    door = inst("door_S2", "door", P2(hinge[0], hinge[1], hinge[2]), ang2 - math.radians(105), d=90)
    crate_group("shack2_loot", P2(1.6, 1.4, 0.93), ang2 + 0.4, 90)
    lantern_group("shack2", P2(-1.8, 1.4, 1.9), 90)
    marker("I15", P2(-1.1, -2.9), "door", "I15", 2.2, "Shack 2 door (opens inward): dim 5 x 4 m room with one loot crate. Door pivot at the hinge. Also a hiding place.")
    marker("H03", P2(0, -3.4), "hide", "H03", 2.6, "Raised porch with an open lattice front and a dark crawlspace. Entrance on the road side.")
    # yards
    items = {
        "S1": [("dry_garden", 6.8, -0.5, 0.2), ("wheelbarrow", -4.6, -1.8, 0.6), ("washtub", 4.4, -4.0, 0), ("sage", -5.2, 2.5, 0), ("fence", -6.5, 1.0, math.pi / 2), ("fence", 6.5, 3.6, math.pi / 2), ("fence_break", 0, 6.0, 0)],
        "S2": [("barrel", -4.2, 1.8, 0), ("barrel", -4.9, 2.6, 0), ("crate", 4.4, -1.2, 0.3), ("lumber_stack", 5.1, 1.8, 0.1), ("fence", 7.0, 0.0, math.pi / 2), ("fence", -7.0, -0.5, math.pi / 2), ("fence_break", 3.0, 6.0, 0), ("sage", 4.7, 4.5, 0)],
        "S3": [("dry_garden", -7.0, -1.0, 0), ("washtub", 5.8, -3.6, 0), ("wheelbarrow", 6.4, 2.0, 2.5), ("outhouse", 9.5, 4.0, 0.15), ("fence", -7.6, 3.0, math.pi / 2), ("fence", 0, 5.8, 0), ("fence_break", 3.0, 5.8, 0), ("barrel", 7.5, -2.6, 0)],
        "S4": [("well", 7.3, 2.2, 0), ("dry_garden", -5.8, 0.0, -0.1), ("crate", -4.2, -3.0, 0.5), ("barrel", 4.2, -2.6, 0), ("fence", -3.0, 5.0, 0), ("fence", 0, 5.0, 0), ("sage", 4.4, 5.0, 0)],
        "S5": [("barrel", -3.6, -1.8, 0), ("crate", 3.4, -2.0, 0.2), ("lumber_stack", 4.2, 1.6, 0.3), ("sage", -4.2, 2.6, 0)],
        "S6": [("barrel", 3.6, -1.5, 0), ("washtub", -3.9, -2.8, 0), ("sage", 4.3, 2.6, 0), ("fence", 0, 4.6, 0)],
    }
    nfence = 0
    for sid, lst in items.items():
        P = placements[sid]
        _, ang, d, u = slot_pos[sid]
        for (kind, x, y, r_) in lst:
            pp = P(x, y)
            if kind == "fence":
                inst("fence_whole", "prop_fence", pp, ang + r_, d=d)
            elif kind == "fence_break":
                nfence += 1
                fence_break_group("sr%d" % nfence, pp, ang + r_, d)
                marker("sr%d" % nfence, pp, "breakable", "I14_%d" % nfence, 1.8, "Breakable fence section: fence_whole / fence_broken.")
            elif kind == "barrel":
                barrel_group("%s_%d" % (sid, int(x * 10)), pp, rng.uniform(0, 6), d)
            elif kind == "crate":
                crate_group("%s_%d" % (sid, int(x * 10)), pp, ang + r_, d)
            else:
                cat = "foliage" if kind in ("sage",) else "prop"
                inst({"dry_garden": "dry_garden", "wheelbarrow": "wheelbarrow", "washtub": "washtub", "sage": "sage", "outhouse": "outhouse", "well": "well", "lumber_stack": "lumber_stack"}[kind], "prop_" + kind, pp, ang + r_, cat=cat, d=d)
    # hanging lanterns on porches and lamp posts along the walkway
    for sid in ("S1", "S6"):
        P = placements[sid]
        sp = shack_spec(sid)
        lantern_group("porch_" + sid, P(-sp["w"] / 2 + 0.25, -sp["d"] / 2 - 1.5, 1.8), slot_pos[sid][2])
    for dd in (68, 100, 132):
        pp, aa = frame(dd, 22.2)
        inst("lamp_post", "prop_lamp_post", pp, aa, d=dd)
        lantern_group("post_%d" % dd, Vector((pp.x - math.sin(aa) * 0 + math.cos(aa) * 0.6, pp.y + math.sin(aa) * 0.6, 2.3)), dd)
    # I23 barrel (explodes), I24 toy, H04 barrel alcove, H05 laundry maze, walkway
    bp, ba = frame(110, 12.0)
    barrel_group("I23", bp, 0.4, 110)
    marker("I23", bp, "breakable", "I23", 1.4, "Barrel that splinters: barrel_whole / barrel_broken.")
    tp, ta = frame(100, -8.8)
    inst("toy_pull", "prop_toy_pull", tp, ta + 0.6, d=100)
    marker("I24", tp, "lore", "I24", 1.5, "A child's wooden pull toy left in the road (a story beat).")
    for k, (x, y) in enumerate(((-1.55, -16.2), (-0.5, -16.3), (0.55, -16.2), (1.6, -16.3), (-2.0, -15.2), (-2.1, -14.2), (2.0, -15.1), (2.05, -14.1))):
        pp, aa = frame(118, 0, x, y)
        barrel_group("H04_%d" % k, pp, rng.uniform(0, 6), 118)
    tarp = Bld(86)
    tarp.slab((-2.4, -16.9, 2.15), (2.4, -16.9, 2.15), (2.4, -13.4, 1.65), (-2.4, -13.4, 1.65), 0.04, mixc(CO_TEAL, PAPER, 0.15))
    to = tarp.finish("prop_tarp_roof_H04", coll("50_props"))
    to.location, to.rotation_euler = frame(118, 0)[0], (0, 0, frame(118, 0)[1])
    to["rw_gen"] = "s1_3"; to["rw_d"] = 118; to["rw_cat"] = "prop"
    S13["count_prop"] += 1; S13["tris"].append((118, tarp.tris()))
    marker("H04", frame(118, -14.5)[0], "hide", "H04", 2.6, "Barrel U-shape with a tarp roof, opening to the road.")
    build_laundry(135, 29.0, 90)
    marker("H05", frame(135, 29.0)[0], "hide", "H05", 3.2, "Laundry-line maze: hanging grey sheets forming a cloth corridor.")
    build_walkway_marker = None

    # ---------------- plants and scatter (Trailhead flowers, grass tufts, cacti, rocks)
    for k in range(16):
        d = rng.uniform(-22, 58)
        u = rng.choice([-1, 1]) * rng.uniform(9, 30)
        pp, aa = frame(d, u)
        inst("flowers_" + rng.choice(("red", "yellow")), "foliage_flowers", pp, rng.uniform(0, 6), rng.uniform(0.9, 1.4), cat="foliage", d=d)
    for (d, u, v) in ((-12, 24, "a"), (40, -27, "b"), (55, 23, "c"), (-4, -26, "a"), (126, -26, "b")):
        pp, aa = frame(d, u)
        inst("saguaro_" + v, "foliage_saguaro", pp, rng.uniform(0, 6), rng.uniform(0.9, 1.2), cat="foliage", d=d)
    for k in range(10):
        d = rng.uniform(-20, 140)
        u = rng.choice([-1, 1]) * rng.uniform(10, 42)
        if scatter_ok(d, u):
            pp, aa = frame(d, u)
            inst(rng.choice(("barrel_cactus", "prickly_pear")), "foliage_cactus", pp, rng.uniform(0, 6), rng.uniform(0.8, 1.2), cat="foliage", d=d)
    for (d, u) in ((-6, 30), (138, 46)):
        pp, aa = frame(d, u)
        inst("dead_tree", "foliage_dead_tree", pp, rng.uniform(0, 6), 1.0, cat="foliage", d=d)
    for k in range(70):
        d = rng.uniform(-22, 142)
        u = rng.choice([-1, 1]) * rng.uniform(9.5, 40)
        pp, aa = frame(d, u)
        inst(rng.choice(("tuft_dry", "tuft_green", "tuft_dry")), "foliage_tuft", pp, rng.uniform(0, 6), rng.uniform(0.9, 1.5), cat="foliage", d=d)
    for k in range(16):
        d = rng.uniform(-22, 142)
        u = rng.choice([-1, 1]) * rng.uniform(10, 44)
        pp, aa = frame(d, u)
        inst("sage", "foliage_sage", pp, rng.uniform(0, 6), rng.uniform(0.8, 1.3), cat="foliage", d=d)
    for k in range(22):
        d = rng.uniform(-24, 144)
        u = rng.choice([-1, 1]) * rng.uniform(10, 48)
        pp, aa = frame(d, u)
        inst("boulder_" + rng.choice("abcd"), "prop_boulder", pp, rng.uniform(0, 6), rng.uniform(0.7, 1.2), d=d)
    return removed

def run_s1_3(render=False):
    run_s1_2(render=False)
    clear_generated("s1_3")
    removed = run_s1_3_place()
    tri_by_chunk = {}
    for ck, (a, b) in CHUNKS.items():
        tri_by_chunk[ck] = sum(t for (d, t) in S13["tris"] if a <= d <= b)
    shack_tris = {k: v for k, v in KIT_TRIS.items() if k.startswith("shack_") or k.startswith("gate")}
    stats = dict(removed_old=removed, props=S13["count_prop"], foliage=S13["count_foliage"], hiding_places=S13["hides"], interactables=S13["inter"],
                 s1_3_tris_by_chunk_instanced=tri_by_chunk, kit_tris=shack_tris)
    print(json.dumps(stats, indent=1))
    for m in S13["markers"]:
        print("MARKER", m)
    if render:
        s13_renders()
    return stats

def aerial(name, d, u, off, h, lens=35, res=(1920, 1080)):
    """A review camera hovering over road-local (d, u), offset (x, y) metres and h up, looking down at it."""
    c = get_cam("ReviewCloseCamera")
    c.data.type = "PERSP"; c.data.sensor_fit = "AUTO"; c.data.lens = lens; c.data.clip_end = 3000
    p2 = du_w(d, u)
    tgt = Vector((p2.x, p2.y, 0.0)); pos = Vector((p2.x + off[0], p2.y + off[1], h))
    c.location = pos
    c.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
    return render_to(c, name, res)

def s13_renders():
    cc, cp = get_cam("ChaseCamera"), get_cam("ChaseCameraPhone")
    for d in (28, 50, 72, 100, 125):
        place_chase_camera(cc, d)
        render_to(cc, "s1-3_chase_d%03d" % d, (1920, 1080))
    place_chase_camera(cc, 96, u=22)
    render_to(cc, "s1-3_chase_walkway_d096", (1920, 1080))
    place_chase_camera(cp, 110, phone=True)
    render_to(cp, "s1-3_chase_phone_d110", (1080, 1920))
    aerial("s1-3_closeup_trailhead_camp", 14, 0, (-6, -34), 26)
    aerial("s1-3_closeup_trailhead_east", 38, -6, (-8, -36), 26)
    aerial("s1-3_closeup_shack_row_west", 84, 28, (-14, -44), 26)
    aerial("s1-3_closeup_shack_row_east", 118, 28, (-14, -44), 26)
    aerial("s1-3_closeup_H04_barrel_alcove", 118, -12, (-6, -28), 20)
    aerial("s1-3_closeup_H05_laundry", 135, 28, (-8, -34), 22)
    aerial("s1-3_closeup_gate", -3, 0, (14, -24), 14)
    aerial("s1-3_closeup_H02_cart", 36, -14, (-6, -26), 16)
    aerial("s1-3_closeup_S2_door_porch", 90, 28, (-3, -16), 11)
    gc = bpy.data.objects["GameCamera"]
    place_game_camera(gc, 90)
    render_to(gc, "s1-3_game_camera_d090", (1920, 1080))
    render_to(bpy.data.objects["ReviewTopCamera"], "s1-3_top_down", (1920, 1080))

# ================================================================ step S1-4: the Sluice Field (140 to 215 m) and the Headframe (215 to 275 m)
RUST = mixc(hexc("#8c3f26"), IRON, 0.3)
TAIL = mixc(mixc(PAL["stone"], PAL["scrub"], 0.3), PAL["cliff_base"], 0.18)
CLAIMS_C = Vector((_L["encounters"][0]["x"], -_L["encounters"][0]["z"]))
FIGHT_R = 26.0

def in_fight(p, pad=2.0):
    return (Vector((p.x, p.y)) - CLAIMS_C).length < FIGHT_R + pad

def trestle(b, x, y, w, h, col=GREY_WOOD):
    for sy in (-1, 1):
        b.beam((x, y + sy * w / 2, 0), (x + 0.0, y + sy * (w / 2 - 0.1), h), 0.12, 0.12, col)
    b.beam((x, y - w / 2 + 0.05, h * 0.45), (x, y + w / 2 - 0.05, h * 0.75), 0.07, 0.07, col)
    b.beam((x, y + w / 2 - 0.05, h * 0.45), (x, y - w / 2 + 0.05, h * 0.75), 0.07, 0.07, col)

def sluice(b, v, L=5.6, W=0.9):
    hh = 0.95
    s0 = len(b.V)
    for x in (-L / 2 + 0.3, 0.0, L / 2 - 0.3):
        trestle(b, x, 0, W + 0.3, hh)
    b.box(0, 0, hh, L, W, 0.07, GREY_WOOD, planks=0.5)
    for sy in (-1, 1):
        if v == 1 and sy == 1:
            b.box(-L / 4, sy * (W / 2), hh, L / 2, 0.06, 0.5, GREY_WOOD, planks=0.6)       # one side board missing on the right half
        else:
            b.box(0, sy * (W / 2), hh, L, 0.06, 0.5, mixc(GREY_WOOD, WOOD, 0.3), planks=0.6)
    b.box(-L / 2, 0, hh, 0.06, W, 0.5, GREY_WOOD)
    for i in range(9):
        b.box(-L / 2 + 0.5 + i * 0.52, 0, hh + 0.07, 0.05, W - 0.12, 0.1, WOOD_D)
    b.beam((-L / 2 - 0.2, 0, hh + 0.3), (-L / 2 - 0.9, 0, hh + 0.9), 0.5, 0.05, RUST)       # feed hopper lip
    b.apply(Matrix.Rotation(math.radians(-5 if v != 2 else -22), 4, "Y"), s0)
    if v == 2:                                                                               # collapsed on one end
        b.apply(Matrix.Translation((0, 0, -0.35)), s0)
    b.ground(s0)

def build_kits_s14():
    r = random.Random(140)
    for v in range(3):
        b = Bld(300 + v)
        sluice(b, v)
        kit("sluice_" + "abc"[v], b)
    # walkable sluice trough (H06): a long covered flume you can walk through, open at both ends
    b = Bld(310)
    L, W, H = 9.0, 2.4, 2.5
    for sy in (-1, 1):
        b.box(0, sy * (W / 2), 0, L, 0.14, H, mixc(GREY_WOOD, WOOD, 0.25), planks=0.45)
    for k in range(7):
        x = -L / 2 + 0.6 + k * (L - 1.2) / 6
        if k in (2, 5):
            continue                                                                        # gaps in the roof let light in
        b.box(x, 0, H, 0.55, W + 0.5, 0.1, WOOD_D)
    for x in (-L / 2 + 0.3, 0, L / 2 - 0.3):
        for sy in (-1, 1):
            b.beam((x, sy * (W / 2 + 0.2), 0), (x, sy * (W / 2 + 0.2), H + 0.1), 0.2, 0.2, WOOD_D)
        b.beam((x, -W / 2 - 0.2, H - 0.1), (x, W / 2 + 0.2, H - 0.1), 0.18, 0.18, WOOD_D)
    b.box(0, 0, 0.02, L - 0.2, W - 0.3, 0.03, DARK_IN)
    for i in range(8):
        b.box(-L / 2 + 1 + i, 0, 0.05, 0.06, W - 0.4, 0.07, WOOD_D)
    kit("sluice_walk", b)
    # tailings heaps (three)
    for v in range(3):
        b = Bld(320 + v)
        R = (3.2, 2.6, 3.8)[v]
        b.rock(0, 0, 0, R, R * 0.45, TAIL, n=9, sq=(1.15, 1.0))
        b.rock(0.2 * R, 0.1 * R, R * 0.3, R * 0.62, R * 0.32, mixc(TAIL, PAL["cliff_dark"], 0.3), n=8)
        for _ in range(6):
            a = r.uniform(0, math.tau)
            b.rock(R * 0.95 * math.cos(a), R * 0.8 * math.sin(a), 0, r.uniform(0.25, 0.5), r.uniform(0.2, 0.4), mixc(TAIL, PAL["stone"], 0.4), n=5)
        kit("tailings_" + "abc"[v], b)
    # ore bin: timber hopper on legs with a chute
    b = Bld(330)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.beam((sx * 1.3, sy * 1.3, 0), (sx * 1.3, sy * 1.3, 2.0), 0.28, 0.28, WOOD_D)
    for z in (0.7, 1.3):
        for (a, c) in (((-1.3, -1.3), (1.3, -1.3)), ((1.3, -1.3), (1.3, 1.3)), ((1.3, 1.3), (-1.3, 1.3)), ((-1.3, 1.3), (-1.3, -1.3))):
            b.beam((a[0], a[1], z), (c[0], c[1], z), 0.12, 0.12, WOOD)
    b.box(0, 0, 1.9, 1.0, 1.0, 1.2, mixc(WOOD, GREY_WOOD, 0.4), top=3.0, planks=0.5)
    b.box(0, 0, 3.1, 3.0, 3.0, 0.9, mixc(WOOD, GREY_WOOD, 0.4), planks=0.5)
    b.face([(-1.4, -1.4, 4.02), (1.4, -1.4, 4.02), (1.4, 1.4, 4.02), (-1.4, 1.4, 4.02)], mixc(PAL["scrub"], TAIL, 0.5))
    for z in (3.3, 3.8):
        b.box(0, 0, z, 3.1, 3.1, 0.07, IRON)
    b.beam((0, -0.4, 1.9), (0, -1.4, 0.9), 0.5, 0.06, RUST)
    kit("ore_bin", b)
    # washing station: a short trough, a table and buckets
    b = Bld(340)
    sluice(b, 0, L=3.2, W=0.8)
    b.box(2.6, 0.6, 0.7, 2.0, 0.8, 0.07, WOOD)
    for sx in (-1, 1):
        for sy in (-1, 1):
            b.box(2.6 + sx * 0.9, 0.6 + sy * 0.3, 0, 0.1, 0.1, 0.7, WOOD_D)
    for (x, y) in ((2.2, 0.55), (3.0, 0.7)):
        b.cyl(x, y, 0.77, 0.18, 0.22, 0.28, 8, mixc(IRON, WOOD, 0.4))
    kit("wash_station", b)
    b = Bld(341)
    b.cyl(0, 0, 0, 0.18, 0.22, 0.3, 8, mixc(IRON, WOOD, 0.4))
    kit("bucket", b)
    # Company tents (three distinct): ridge tent, wall tent, lean-to
    b = Bld(350)
    w, d, h = 4.0, 4.6, 2.7
    # ridge along y: two slopes in x
    for sx in (-1, 1):
        for j in range(6):
            y0, y1 = -d / 2 + j * d / 6, -d / 2 + (j + 1) * d / 6
            c = CO_RED if j % 3 == 1 else CREAM
            pts = [(sx * w / 2, y0, 0.05), (0, y0, h), (0, y1, h), (sx * w / 2, y1, 0.05)]
            b.face_out(pts, shade(c, 0.95 + 0.05 * (j % 2)), (sx, 0, 1))
    b.face([(-w / 2, -d / 2, 0.05), (w / 2, -d / 2, 0.05), (0, -d / 2, h)], DARK_IN)
    b.face_out([(-w / 2, d / 2, 0.05), (w / 2, d / 2, 0.05), (0, d / 2, h)], shade(CREAM, 0.85), (0, 1, 0))
    b.beam((0, -d / 2 - 0.5, h + 0.05), (0, d / 2 + 0.5, h + 0.05), 0.1, 0.1, WOOD_D)
    for sx in (-1, 1):
        b.beam((sx * w / 2, -d / 2, 0.8), (sx * (w / 2 + 1.5), -d / 2 - 1.0, 0.0), 0.03, 0.03, WOOD)
        b.beam((sx * w / 2, d / 2, 0.8), (sx * (w / 2 + 1.5), d / 2 + 1.0, 0.0), 0.03, 0.03, WOOD)
    kit("tent_a", b)
    b = Bld(351)
    w, d, wh, h = 4.4, 5.0, 1.3, 2.7
    b.box(0, 0, 0, w, d, wh, mixc(CO_TEAL, CREAM, 0.55), planks=1.1)
    for sx in (-1, 1):
        pts = [(sx * w / 2, -d / 2, wh), (0, -d / 2, h), (0, d / 2, h), (sx * w / 2, d / 2, wh)]
        b.face_out(pts, mixc(CO_TEAL, CREAM, 0.35), (sx, 0, 1))
    b.face_out([(-w / 2, -d / 2, wh), (w / 2, -d / 2, wh), (0, -d / 2, h)], mixc(CO_TEAL, CREAM, 0.45), (0, -1, 0))
    b.face_out([(-w / 2, d / 2, wh), (w / 2, d / 2, wh), (0, d / 2, h)], mixc(CO_TEAL, CREAM, 0.45), (0, 1, 0))
    b.box(0, -d / 2 - 0.02, 0, 1.0, 0.04, 1.2, DARK_IN)
    b.box(0, 0, h, 0.12, d + 0.8, 0.12, WOOD_D)
    kit("tent_b", b)
    b = Bld(352)
    w, d = 4.2, 3.6
    b.face_out([(-w / 2, d / 2, 0.0), (w / 2, d / 2, 0.0), (w / 2, d / 2, 2.4), (-w / 2, d / 2, 2.4)], mixc(CO_RED, CREAM, 0.55), (0, 1, 0))
    b.face_out([(-w / 2, d / 2, 2.4), (w / 2, d / 2, 2.4), (w / 2, -d / 2, 0.9), (-w / 2, -d / 2, 0.9)], mixc(CO_RED, CREAM, 0.7), (0, 0, 1))
    for sx in (-1, 1):
        b.face_out([(sx * w / 2, d / 2, 0.0), (sx * w / 2, d / 2, 2.4), (sx * w / 2, -d / 2, 0.9), (sx * w / 2, -d / 2, 0.0)], mixc(CO_RED, CREAM, 0.6), (sx, 0, 0))
    for sx in (-1, 1):
        b.beam((sx * w / 2, -d / 2, 0), (sx * w / 2, -d / 2, 0.95), 0.1, 0.1, WOOD_D)
    b.box(0, 0.9, 0, 2.0, 1.0, 0.18, WOOD_D)
    kit("tent_c", b)
    # plank ramp over a shallow ditch (I19): a dark channel, timber edges and a deck at 0.05 m
    b = Bld(360)
    b.face([(-3.4, -1.3, 0.035), (3.4, -1.3, 0.035), (3.4, 1.3, 0.035), (-3.4, 1.3, 0.035)], mixc(PAL["cool_dark"], PAL["mud"], 0.5))
    for sy in (-1, 1):
        b.beam((-3.4, sy * 1.35, 0.06), (3.4, sy * 1.35, 0.06), 0.16, 0.2, GREY_WOOD)
    for i in range(9):
        b.box(-1.1 + i * 0.275, 0, 0.0, 0.25, 4.6, 0.05, mixc(WOOD, GREY_WOOD, 0.1 * (i % 4)))
    for (x, y) in ((-1.2, -2.0), (1.2, -2.0), (-1.2, 2.0), (1.2, 2.0)):
        b.beam((x, y, 0.05), (x, y, 1.0), 0.1, 0.1, WOOD_D)
    for sy in (-2.0, 2.0):
        b.beam((-1.2, sy, 0.95), (1.2, sy, 0.9), 0.04, 0.04, CREAM)
    kit("ditch_ramp", b)
    # dynamite crate: red, with a pictogram of a stick (no text)
    b = Bld(370)
    b.box(0, 0, 0, 1.0, 1.0, 0.8, CO_RED, planks=0.34)
    b.box(0, 0, 0, 1.04, 1.04, 0.06, IRON)
    b.box(0, 0, 0.7, 1.04, 1.04, 0.06, IRON)
    b.face([(-0.06, -0.52, 0.2), (0.06, -0.52, 0.2), (0.06, -0.52, 0.6), (-0.06, -0.52, 0.6)], PAPER)
    b.face([(0.0, -0.521, 0.6), (0.02, -0.521, 0.6), (0.1, -0.521, 0.72), (0.08, -0.521, 0.72)], IRON)
    kit("dynamite_crate", b)
    # hanging sign with a pick pictogram, cable spool, rail-tie pile, stump with a pick
    b = Bld(371)
    b.box(0, 0, 0, 0.18, 0.18, 3.0, WOOD_D)
    b.beam((0, 0, 2.8), (1.6, 0, 2.8), 0.12, 0.12, WOOD_D)
    b.box(1.2, 0, 1.7, 1.3, 0.08, 0.9, mixc(WOOD, WOOD_D, 0.3), planks=0.4)
    for x in (0.8, 1.6):
        b.beam((x, 0, 2.8), (x, 0, 2.6), 0.03, 0.03, IRON)
    b.beam((0.8, -0.06, 1.55), (1.5, -0.06, 2.1), 0.08, 0.03, PAPER)
    b.beam((1.2, -0.06, 2.15), (1.6, -0.06, 1.95), 0.3, 0.03, IRON)
    kit("hanging_sign", b)
    b = Bld(372)
    b.tube((0, -0.35, 0.6), (0, 0.35, 0.6), 0.6, 0.6, 12, WOOD)
    b.tube((0, -0.45, 0.6), (0, -0.35, 0.6), 0.65, 0.65, 12, GREY_WOOD)
    b.tube((0, 0.35, 0.6), (0, 0.45, 0.6), 0.65, 0.65, 12, GREY_WOOD)
    b.tube((0, -0.5, 0.6), (0, 0.5, 0.6), 0.12, 0.12, 6, IRON)
    kit("cable_spool", b)
    b = Bld(373)
    for row in range(3):
        for i in range(4 - row):
            b.box(-0.9 + i * 0.6 + row * 0.3, 0, row * 0.16, 0.2, 1.5, 0.15, WOOD_D)
    kit("tie_pile", b)
    b = Bld(374)
    b.cyl(0, 0, 0, 0.34, 0.3, 0.55, 8, GREY_WOOD)
    b.beam((0.1, 0, 0.55), (0.9, 0, 1.1), 0.07, 0.07, WOOD)
    b.beam((0.7, 0, 1.2), (1.1, 0, 1.0), 0.28, 0.05, IRON)
    kit("stump_pick", b)
    # ladder (named node ladder), lever and gate pieces (named nodes lever_arm, gate_leaf)
    b = Bld(380)
    s0 = len(b.V)
    for sx in (-0.35, 0.35):
        b.beam((sx, 0, 0), (sx, 0, 4.6), 0.1, 0.07, WOOD_D)
    for k in range(13):
        b.beam((-0.35, 0, 0.3 + k * 0.33), (0.35, 0, 0.3 + k * 0.33), 0.07, 0.07, WOOD)
    b.apply(Matrix.Rotation(math.radians(-12), 4, "X"), s0)
    kit("ladder", b)
    b = Bld(381)
    for x in (0.0, 4.0):
        b.box(x, 0, 0, 0.32, 0.32, 2.5, WOOD_D)
    b.beam((-0.1, 0, 2.4), (4.1, 0, 2.4), 0.2, 0.2, WOOD)
    kit("gate_posts", b)
    b = Bld(382)
    b.box(1.8, 0, 0.3, 3.5, 0.1, 1.7, GREY_WOOD, planks=0.4)
    b.beam((0.05, 0, 0.35), (3.5, 0, 1.95), 0.12, 0.06, WOOD_D)
    b.beam((0.05, 0, 0.35), (0.05, 0, 2.0), 0.1, 0.1, IRON)
    kit("gate_leaf", b)
    b = Bld(383)
    b.box(0, 0, 0, 0.5, 0.4, 0.6, PAL["stone"])
    b.box(0, 0, 0.6, 0.3, 0.2, 0.5, IRON)
    kit("lever_base", b)
    b = Bld(384)
    b.beam((0, 0, 0), (0, 0, 1.2), 0.08, 0.08, RUST)
    b.cyl(0, 0, 1.2, 0.07, 0.07, 0.2, 6, CO_RED)
    kit("lever_arm", b)
    build_headframe()
    build_adit()
    build_cart_boiler()

def build_headframe():
    b = Bld(400)
    H, base, top = 13.6, 2.6, 0.7
    legs = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for (sx, sy) in legs:
        b.beam((sx * base, sy * base, 0), (sx * top, sy * top, H), 0.44, 0.44, WOOD_D)
    levels = (0.0, 3.4, 6.9, 10.2, H)
    half = lambda z: base + (top - base) * z / H
    for z in levels[1:-1]:
        k = half(z)
        cs = [(-k, -k), (k, -k), (k, k), (-k, k)]
        for i in range(4):
            a, c = cs[i], cs[(i + 1) % 4]
            b.beam((a[0], a[1], z), (c[0], c[1], z), 0.24, 0.24, WOOD)
    for z0, z1 in zip(levels[:-1], levels[1:]):
        k0, k1 = half(z0), half(z1)
        for sy in (-1, 1):
            b.beam((-k0, sy * k0, z0), (k1, sy * k1, z1), 0.14, 0.14, GREY_WOOD)
            b.beam((k0, sy * k0, z0), (-k1, sy * k1, z1), 0.14, 0.14, GREY_WOOD)
        for sx in (-1, 1):
            b.beam((sx * k0, -k0, z0), (sx * k1, k1, z1), 0.12, 0.12, GREY_WOOD)
    b.box(0, 0, H, 2.6, 2.6, 0.22, WOOD)
    # sheave wheel on its axle with spokes (the wheel turns about x)
    zc = H + 1.45
    b.tube((-0.45, 0, zc), (0.45, 0, zc), 1.55, 1.55, 14, RUST)
    b.tube((-0.35, 0, zc), (0.35, 0, zc), 1.28, 1.28, 14, mixc(RUST, IRON, 0.5), caps=(False, False))
    for k in range(8):
        a = math.tau * k / 8
        b.beam((0, 0.1 * math.cos(a), zc + 0.1 * math.sin(a)), (0, 1.45 * math.cos(a), zc + 1.45 * math.sin(a)), 0.1, 0.1, IRON)
    b.tube((-1.1, 0, zc), (1.1, 0, zc), 0.12, 0.12, 6, IRON)
    for sx in (-1, 1):
        b.beam((sx * 0.9, -0.9, H + 0.2), (sx * 0.9, 0, zc), 0.18, 0.18, WOOD_D)
        b.beam((sx * 0.9, 0.9, H + 0.2), (sx * 0.9, 0, zc), 0.18, 0.18, WOOD_D)
    # hoist rope down to the shaft collar in front, and a guy to the hoist house behind
    b.tube((0, -1.5, zc - 0.5), (0, -6.8, 0.9), 0.06, 0.06, 5, IRON)
    b.tube((0, 1.5, zc - 0.5), (0, 5.2, 2.4), 0.06, 0.06, 5, IRON)
    b.box(0, -7.0, 0, 2.6, 2.6, 0.45, WOOD_D)
    b.box(0, -7.0, 0.45, 1.8, 1.8, 0.04, DARK_IN)
    for sx in (-1, 1):
        b.box(sx * 1.2, -7.0, 0.45, 0.14, 2.6, 0.6, WOOD)
    b.box(0, 5.2, 0, 4.0, 3.2, 2.6, mixc(WOOD, GREY_WOOD, 0.5), planks=0.5)
    b.slab((-2.4, 3.3, 2.5), (2.4, 3.3, 2.5), (2.4, 7.1, 3.2), (-2.4, 7.1, 3.2), 0.12, ROOF_RUST)
    b.box(1.0, 3.58, 0, 0.9, 0.06, 1.9, DARK_IN)
    kit("headframe_tower", b)

def build_adit():
    b = Bld(410)
    W = 5.2
    b.box(0, 0.7, 0.0, W - 0.4, 2.2, 3.4, DARK_IN)                                  # the dark mouth behind the boards
    for sx in (-1, 1):
        b.box(sx * W / 2, 0, 0, 0.5, 0.5, 3.9, WOOD_D)
    b.box(0, 0, 3.7, W + 0.8, 0.5, 0.5, WOOD)
    for k, z in enumerate((0.2, 0.75, 1.3, 1.85, 2.4, 2.95)):
        b.box(0.1 * (k % 2) - 0.05, -0.28, z, W - 0.2 - 0.3 * (k % 3), 0.07, 0.42, mixc(GREY_WOOD, WOOD, 0.4 * (k % 2)), rot=0.0, shear=(0, 0))
    b.beam((-W / 2 + 0.2, -0.34, 0.2), (W / 2 - 0.2, -0.34, 3.2), 0.4, 0.06, GREY_WOOD)
    b.beam((W / 2 - 0.2, -0.34, 0.2), (-W / 2 + 0.2, -0.34, 3.2), 0.4, 0.06, GREY_WOOD)
    b.box(0, -0.3, 4.15, 1.5, 0.08, 0.95, CO_RED)                                      # Company plate: rising sun over a rail
    b.face([(0.45 * math.cos(math.pi * k / 6), -0.36, 4.3 + 0.45 * math.sin(math.pi * k / 6)) for k in range(7)], FLAME_T)
    b.beam((-0.6, -0.37, 4.28), (0.6, -0.37, 4.28), 0.07, 0.02, IRON)
    kit("adit_mouth", b)

def build_cart_boiler():
    b = Bld(420)
    b.box(0, 0, 0.45, 1.7, 1.0, 0.65, RUST, top=1.2)
    for sy in (-1, 1):
        b.beam((-0.85, sy * 0.52, 1.1), (0.85, sy * 0.58, 1.1), 0.08, 0.08, IRON)
    for (x, y) in ((-0.55, -0.55), (0.55, -0.55), (-0.55, 0.55), (0.55, 0.55)):
        b.tube((x, y - 0.04, 0.25), (x, y + 0.04, 0.25), 0.25, 0.25, 8, IRON)
    b.rock(0, 0, 1.0, 0.55, 0.3, mixc(PAL["scrub"], TAIL, 0.4), n=6, sq=(1.3, 0.9))
    kit("ore_cart", b)
    b = Bld(421)
    s0 = len(b.V)
    b.box(0, 0, 0.45, 1.7, 1.0, 0.65, RUST, top=1.2)
    for (x, y) in ((-0.55, -0.55), (0.55, -0.55), (-0.55, 0.55), (0.55, 0.55)):
        b.tube((x, y - 0.04, 0.25), (x, y + 0.04, 0.25), 0.25, 0.25, 8, IRON)
    b.apply(Matrix.Rotation(math.radians(100), 4, "X"), s0)
    b.apply(Matrix.Rotation(math.radians(20), 4, "Z"), s0)
    b.ground(s0)
    kit("ore_cart_tipped", b)
    b = Bld(422)
    for x in (-1.2, 1.2):
        b.box(x, 0, 0, 0.7, 1.7, 0.6, PAL["stone"])
    b.tube((-1.9, 0, 1.7), (1.9, 0, 1.7), 0.95, 0.95, 12, RUST)
    for x in (-1.3, 0, 1.3):
        b.tube((x - 0.05, 0, 1.7), (x + 0.05, 0, 1.7), 1.0, 1.0, 12, IRON, caps=(False, False))
    b.tube((1.9, 0, 1.7), (2.15, 0, 1.7), 0.7, 0.55, 12, RUST)
    b.box(2.05, 0, 1.2, 0.08, 0.7, 0.7, IRON)
    b.tube((-1.4, 0, 2.5), (-1.4, 0, 7.4), 0.36, 0.26, 8, RUST)
    b.tube((-1.4, 0, 7.4), (-1.4, 0, 7.8), 0.3, 0.3, 8, IRON, caps=(False, False))
    b.tube((0.6, 0, 2.6), (0.6, 0, 3.7), 0.1, 0.1, 6, IRON)
    b.tube((0.6, 0, 3.7), (1.3, 0, 3.7), 0.1, 0.1, 6, IRON)
    kit("boiler", b)
    b = Bld(423)
    for k in range(6):
        a = math.tau * k / 6
        b.box(0.35 * math.cos(a), 0.35 * math.sin(a), 0.0, 0.5, 0.5, 0.5 + 0.08 * (k % 3), mixc(PAPER, PAL["stone"], 0.25 + 0.05 * (k % 3)), rot=a)
    b.box(0, 0, 0.45, 0.6, 0.6, 0.3, mixc(PAPER, PAL["stone"], 0.2))
    kit("steam_puff", b)

def track_mesh(name, pts, gauge=1.0):
    b = Bld(430)
    pl = [Vector(p) for p in pts]
    res = [pl[0]]
    for a, c in zip(pl, pl[1:]):
        n = max(1, int((c - a).length / 0.9))
        for k in range(1, n + 1):
            res.append(a + (c - a) * (k / n))
    for i, p in enumerate(res):
        q = res[min(i + 1, len(res) - 1)] - res[max(i - 1, 0)]
        t = q.normalized() if q.length > 1e-6 else Vector((1, 0, 0))
        n_ = Vector((-t.y, t.x, 0))
        b.box(p.x, p.y, 0.0, 0.2, 1.6, 0.1, mixc(WOOD_D, WOOD, 0.3 * (i % 3)), rot=math.atan2(t.y, t.x))
    for sgn in (-1, 1):
        for i in range(0, len(res) - 2, 2):
            a = res[i]; c = res[min(i + 2, len(res) - 1)]
            ta = (c - a).normalized()
            na = Vector((-ta.y, ta.x, 0))
            b.beam(a + na * (sgn * gauge / 2) + Vector((0, 0, 0.1)), c + na * (sgn * gauge / 2) + Vector((0, 0, 0.1)), 0.07, 0.12, RUST)
    ob = b.finish(name, coll("50_props"))
    ob["rw_d"] = 250; ob["rw_cat"] = "prop"
    S13["count_prop"] += 1
    S13["tris"].append((250, b.tris()))
    return ob

def lantern_string(d, u0, u1, zline, seed):
    """I20: a string of lanterns hung across the road; lanterns are real lantern groups."""
    b = Bld(seed)
    A, C = frame(d, u0)[0], frame(d, u1)[0]
    for P in (A, C):
        b.tube((P.x, P.y, 0), (P.x, P.y, zline + 0.4), 0.14, 0.1, 6, WOOD_D)
    n = 22
    pts = []
    for k in range(n + 1):
        t = k / n
        p = A + (C - A) * t
        pts.append(Vector((p.x, p.y, zline - 1.3 * (1 - (2 * t - 1) ** 2))))
    for p0, p1 in zip(pts, pts[1:]):
        b.beam(p0, p1, 0.04, 0.04, WOOD_D, caps=False)
    ob = b.finish("prop_lantern_string_%d" % d, coll("50_props"))
    ob["rw_d"] = d; ob["rw_cat"] = "prop"
    S13["count_prop"] += 1; S13["tris"].append((d, b.tris()))
    g = make_group("prop_lantern_string_I20", Vector((0, 0, 0)), 0.0, d)
    ob.parent = g
    for k, t in enumerate((0.14, 0.32, 0.5, 0.68, 0.86)):
        p = A + (C - A) * t
        zz = zline - 1.3 * (1 - (2 * t - 1) ** 2) - 0.75
        lg = lantern_group("string%d" % k, Vector((p.x, p.y, zz)), d)
        lg.parent = g
        lg.matrix_parent_inverse = g.matrix_world.inverted()
    return g

def mud_channels():
    V, F, COL = [], [], []
    chans = [[(148, 33), (156, 36), (166, 34), (176, 37), (186, 35)], [(152, -29), (160, -32), (171, -29), (183, -33), (196, -30)],
             [(200, 36), (208, 33), (214, 36)], [(256, 44), (262, 41), (270, 44)]]
    for pts in chans:
        wp = [Vector((frame(d, u)[0].x, frame(d, u)[0].y)) for d, u in pts]
        strip_mesh(V, F, COL, wp, 1.9, 0.052, 0.046, lambda e, i: shade(mixc(PAL["mud"], PAL["cliff_dark"], 0.55 - 0.2 * e), 0.9), step=1.4, meander=0.6, seed=len(F), ncross=5)
        c = wp[-1]
        add_poly(V, F, [(c.x + 2.2 * math.cos(k * math.tau / 10) * 1.3, c.y + 2.2 * math.sin(k * math.tau / 10)) for k in range(10)], 0.054)
        COL.append(shade(mixc(PAL["cool_light"], PAL["mud"], 0.4), 0.9))
    return flat_obj("decal_mud_channels_s1", V, F, COL, coll("30_road"), tag="s1_3")

def s14_place():
    rng = random.Random(1404)
    build_kits_s14()
    ok = lambda d, u: not in_fight(frame(d, u)[0])
    def P(d, u, x=0.0, y=0.0):
        return frame(d, u, x, y)
    # ---- Sluice Field (140 to 215 m)
    # I19 plank ramp over a shallow ditch, with the ditch drawn as a dark channel
    p, a = P(150, -19.5)
    inst("ditch_ramp", "prop_ditch_ramp", p, a + math.pi / 2, d=150)
    marker("I19", p, "climb", "I19", 3.0, "Plank ramp over a shallow drainage ditch (flat for the game, deck top 0.05 m): a crossover to the south lane.")
    # H06 walkable sluice trough
    p, a = P(165, -12.8)
    inst("sluice_walk", "prop_sluice_walk", p, a, d=165)
    marker("H06", p, "hide", "H06", 3.5, "Walkable wooden sluice trough, open at both ends, shaded inside.")
    for k, (d, u, v) in enumerate(((146, 34, "a"), (154, 42, "b"), (183, 33, "c"), (192, 45, "a"), (200, 36, "b"), (150, -31, "b"), (158, -38, "c"), (176, -30, "a"), (186, -37, "b"), (196, -31, "c"))):
        p, a = P(d, u)
        inst("sluice_" + v, "prop_sluice_box", p, a + rng.uniform(-0.5, 0.5) + (math.pi / 2 if k % 3 == 0 else 0), d=d)
    for (d, u, v) in ((184, -16, "a"), (200, 30, "b")):
        pass
    # H07 tailings crescent with a sheltered hollow
    cc = P(190, 30)[0]
    for k in range(5):
        ang = math.radians(25 + k * 32.5)
        d_off, u_off = 5.0 * math.cos(ang), 5.0 * math.sin(ang) * 0.9
        p, a = P(190, 30, d_off, u_off)
        inst("tailings_" + "abc"[k % 3], "prop_tailings", p, rng.uniform(0, 6), rng.uniform(0.95, 1.2), d=190)
    marker("H07", cc, "hide", "H07", 3.0, "Crescent of tailings heaps with a sheltered dip, open to the road side.")
    for (d, u, v) in ((158, 28, "b"), (170, 46, "a"), (204, 28, "c"), (176, -36, "c"), (206, -28, "a"), (262, 36, "b"), (276, 40, "a")):
        p, a = P(d, u)
        if ok(d, u):
            inst("tailings_" + v, "prop_tailings", p, rng.uniform(0, 6), rng.uniform(0.8, 1.3), d=d)
    # Company camp: three canvas tents, crates, barrels, a stump with a pick
    for (d, u, k, rot) in ((163, 40, "tent_a", 0.1), (172, 36, "tent_b", -0.15), (180, 41, "tent_c", 0.3)):
        p, a = P(d, u)
        inst(k, "prop_" + k, p, a + rot, d=d)
    for (d, u, rot) in ((167, 33, 0.2), (176, 32, 0.4), (168, 45, 0.1)):
        p, a = P(d, u)
        barrel_group("camp_%d" % d, p, rot, d)
    for (d, u) in ((168, 30), (170, 30.8), (169, 30.4)):
        pass
    cx, cy = _L["crates"][1]["x"], -_L["crates"][1]["z"]
    cd, cu = world_to_du(Vector((cx, cy)))
    crate_group("a1-crate-2", Vector((cx, cy, 0)), 0.4, cd)
    crate_group("camp_pile1", Vector((cx + 1.1, cy + 0.3, 0)), 0.8, cd)
    inst("crate_body", "prop_crate_stack", Vector((cx + 0.2, cy + 0.2, 0.92)), 0.2, d=cd)
    marker("a1-crate-2", Vector((cx, cy, 0)), "loot", "I09", 1.5, "Layout crate a1-crate-2 (ammo).")
    for k, (d, u) in enumerate(((176, 28), (161, 31))):
        p, a = P(d, u)
        crate_group("camp_%d" % k, p, a + 0.3 * k, d)
    p, a = P(174, 43)
    inst("stump_pick", "prop_stump_pick", p, a, d=174)
    p, a = P(168, 38)
    inst("bucket", "prop_bucket", p, a, d=168)
    # lantern string over the field (I20), eviction boards at the Claims entrance
    lantern_string(175, -12.8, 12.8, 4.9, 440)
    marker("I20", P(175, 0)[0], "hazard", "I20", 4.0, "Swinging lantern string over the road (decor with light): lantern groups with glow.")
    for (d, u, rot) in ((146, 12.0, 0.0), (157, -12.0, math.pi)):
        p, a = P(d, u)
        inst("notice_board", "prop_eviction_board", p, a + rot, d=d)
    # washing station and a few loose tools
    p, a = P(262, -32)
    inst("wash_station", "prop_wash_station", p, a, d=262)
    barrel_group("wash1", P(262, -32, 5.2, 0.8)[0], 0.2, 262)
    barrel_group("wash2", P(262, -32, 6.0, 1.4)[0], 1.2, 262)
    # ---- the Headframe (215 to 275 m)
    B248 = B_of(248)
    p, a = P(248, B248 - 7.5)
    inst("headframe_tower", "prop_headframe_tower", p, a, d=248)
    marker("headframe", p, "landmark", "LM_HEADFRAME", 7.0, "Landmark: 14 m timber A-frame headframe with hoist wheel, against the north cliffs.")
    B262 = B_of(262)
    p, a = P(262, B262 + 0.6)
    inst("adit_mouth", "prop_adit_mouth", p, a, d=262)
    marker("adit", p, "landmark", "ADIT", 4.0, "Boarded adit (mine tunnel mouth) with the made-up Company rail-and-rising-sun plate.")
    track = [frame(262, B262 - 1.0)[0], frame(262, 36)[0], frame(255, 32)[0], frame(244, 31)[0], frame(232, 32)[0], frame(226, 34)[0]]
    track_mesh("rail_track_s1", track)
    p, a = P(252, 31.2)
    inst("ore_cart", "prop_ore_cart", p, a + 0.15, d=252)
    p, a = P(236, 34.4)
    inst("ore_cart_tipped", "prop_ore_cart_tipped", p, a + 0.8, d=236)
    inst("ore_spill", "prop_ore_spill", P(236, 35.8, 0.8, 0)[0], a, d=236)
    # ore bins: a pair with a narrow slot (H08), plus two more in the yard
    for k, (d, u) in enumerate(((223.3, 43), (228.7, 43), (266, 45), (274, 47))):
        p, a = P(d, u)
        inst("ore_bin", "prop_ore_bin", p, a + (0.05 if k > 1 else 0), d=d)
    marker("H08", P(226, 43)[0], "hide", "H08", 2.0, "Narrow slot between two big ore bins (1.6 m wide).")
    # I18 ladder to the lowest terrace
    B205 = B_of(205)
    p, a = P(205, B205 + 1.1)
    inst("ladder", "ladder", p, a, d=205)
    marker("I18", p, "climb", "I18", 2.0, "Ladder to the lowest terrace (top at the terrace platform).")
    # I17 lever and yard gate in the berm opening
    p, a = P(242, 22)
    g = make_group("prop_gate_I17", p, a, 242)
    inst("gate_posts", "gate_posts", Vector((-2.0, 0, 0)), parent=g, d=242)
    inst("gate_leaf", "gate_leaf", Vector((-2.0 + 0.05, 0, 0)), parent=g, d=242)
    inst("lever_base", "lever_base", Vector((-3.4, -1.0, 0)), parent=g, d=242)
    inst("lever_arm", "lever_arm", Vector((-3.4, -1.0, 1.1)), parent=g, d=242)
    S13["count_prop"] += 1
    marker("I17", p, "lever", "I17", 3.0, "Lever (lever_arm rotates 60 degrees) opens gate_leaf: a shortcut from the north lane to the ore-bin yard.")
    # I26 second campfire, dynamite, lumber, spools, rail ties, hanging sign
    cp, ca = P(250, 12.5)
    fire = make_group("prop_campfire_I26", cp, 0.0, 250)
    for nm in ("campfire_stones", "campfire_logs", "fire_glow", "fire_flame"):
        inst(nm, nm, Vector((0, 0, 0)), parent=fire, d=250)
    S13["count_prop"] += 1
    inst("log_seat", "prop_log_seat", P(250, 12.5, -2.3, -1.0)[0], ca + 0.4, d=250)
    inst("log_seat", "prop_log_seat", P(250, 12.5, 1.5, 2.6)[0], ca + 1.8, d=250)
    marker("I26", cp, "campfire", "I26", 3.0, "Second campfire at the Headframe: checkpoint for Section 1's far half.")
    for k, (d, u) in enumerate(((268, 41), (270.2, 41.5), (269.1, 40.4))):
        p, a = P(d, u)
        inst("dynamite_crate", "prop_dynamite_crate", p, a + 0.1 * k, d=d)
    inst("dynamite_crate", "prop_dynamite_crate", P(269.2, 40.6)[0] + Vector((0, 0, 0.8)), a + 0.5, d=269)
    marker("dynamite", P(269, 41)[0], "hazard", "DYNAMITE", 3.0, "Red dynamite crates (stick pictogram): visual hazard marker; the game decides behaviour.")
    for (d, u, rot) in ((258, 46, 0.1), (244, 48, 0.0), (276, 33, 0.2)):
        p, a = P(d, u)
        inst("lumber_stack", "prop_lumber_stack", p, a + rot, d=d)
    for (d, u) in ((252, 44), (236, 46)):
        p, a = P(d, u)
        inst("cable_spool", "prop_cable_spool", p, a, d=d)
    p, a = P(240, 39)
    inst("tie_pile", "prop_tie_pile", p, a, d=240)
    p, a = P(246, 17.5)
    inst("hanging_sign", "prop_hanging_sign", p, a, d=246)
    barrel_group("I23b", P(256, 12.0)[0], 0.7, 256)
    marker("I23b", P(256, 12.0)[0], "breakable", "I23b", 1.4, "Second barrel that splinters (255 m).")
    # rusted boiler with steam
    p, a = P(274, 31)
    inst("boiler", "prop_boiler", p, a, d=274)
    for k, (z, s) in enumerate(((3.9, 0.6), (4.9, 0.9), (6.2, 1.3))):
        pp = Vector((p.x + math.cos(a) * 1.3 * 1.0 - math.sin(a) * 0.0 + 0.2 * k, p.y + math.sin(a) * 1.3, z))
        inst("steam_puff", "prop_steam_puff", pp, k * 0.7, s, d=274)
    # pots and the layout crate-3 and extra yard dressing
    for k, (pid, dxy) in enumerate((("a1-pot-3", _L["pots"][2]), ("a1-pot-4", _L["pots"][3]))):
        pp = Vector((dxy["x"], -dxy["z"], 0))
        dd, uu = world_to_du(Vector((pp.x, pp.y)))
        pot_group(pid, pp, rng.uniform(0, 6), dd)
        for (x, y) in ((0.8, 0.4), (-0.5, 0.8)):
            pot_group(pid + "_x%d" % int(x * 10), Vector((pp.x + x, pp.y + y, 0)), rng.uniform(0, 6), dd)
        marker(pid, pp, "breakable", "I04" if k == 0 else "I05", 1.8, "Clay pot cluster (layout %s)." % pid)
    cx, cy = _L["crates"][2]["x"], -_L["crates"][2]["z"]
    cd, cu = world_to_du(Vector((cx, cy)))
    crate_group("a1-crate-3", Vector((cx, cy, 0)), 0.3, cd)
    marker("a1-crate-3", Vector((cx, cy, 0)), "loot", "I10", 1.5, "Layout crate a1-crate-3 (health).")
    # the Claims guard group: markers only (the game spawns bandits and the wolf)
    marker("claims-guards", Vector((CLAIMS_C.x, CLAIMS_C.y, 0)), "encounter", "a1-claims-guards", FIGHT_R, "Fight circle (26 m radius, kept clear of tall props). Wake radius 34. Layout encounter.")
    for k, sp_ in enumerate(_L["encounters"][0]["spawnPoints"]):
        marker("claims-spawn%d" % k, Vector((sp_["x"], -sp_["z"], 0)), "spawn", "a1-claims-spawn-%s%d" % (sp_["type"], k), 1.5, "Layout spawn point (%s). Marker only." % sp_["type"])
    # telegraph poles continue, with their own wire
    poles = [frame(136, -12.6)[0]]
    for dd in (164, 192, 220, 248, 276):
        pp, aa = frame(dd, -12.6)
        inst("telegraph_pole", "prop_telegraph_pole", pp, aa + math.pi / 2, d=dd)
        poles.append(Vector((pp.x, pp.y, 0)))
    wire_mesh(poles)
    mud_channels()
    # lamp posts and stray props
    for dd in (156, 188, 232, 262):
        pp, aa = frame(dd, 22.2 if dd < 215 else 30.0)
        if ok(dd, 22.2):
            inst("lamp_post", "prop_lamp_post", pp, aa, d=dd)
            lantern_group("post_%d" % dd, Vector((pp.x + math.cos(aa) * 0.6, pp.y + math.sin(aa) * 0.6, 2.3)), dd)
    for k in range(10):
        d = rng.uniform(142, 276)
        u = rng.choice([-1, 1]) * rng.uniform(10, 40)
        p, a = P(d, u)
        if ok(d, u):
            inst(rng.choice(("wheelbarrow", "washtub", "bucket", "stump_pick")), "prop_yard", p, rng.uniform(0, 6), d=d)
    # plants and rocks over 140 to 275 m
    for k in range(70):
        d = rng.uniform(140, 276)
        u = rng.choice([-1, 1]) * rng.uniform(10, 44)
        p, a = P(d, u)
        if ok(d, u):
            inst(rng.choice(("tuft_dry", "tuft_dry", "tuft_green")), "foliage_tuft", p, rng.uniform(0, 6), rng.uniform(0.9, 1.5), cat="foliage", d=d)
    for k in range(18):
        d = rng.uniform(140, 276)
        u = rng.choice([-1, 1]) * rng.uniform(10, 46)
        p, a = P(d, u)
        if ok(d, u):
            inst(rng.choice(("sage", "barrel_cactus", "prickly_pear")), "foliage_scrub", p, rng.uniform(0, 6), rng.uniform(0.8, 1.3), cat="foliage", d=d)
    for (d, u, v) in ((160, -34, "b"), (214, 36, "c"), (270, -30, "a"), (186, 52, "a")):
        p, a = P(d, u)
        inst("saguaro_" + v, "foliage_saguaro", p, rng.uniform(0, 6), rng.uniform(0.9, 1.2), cat="foliage", d=d)
    for (d, u) in ((232, 52), (192, -40)):
        p, a = P(d, u)
        inst("dead_tree", "foliage_dead_tree", p, rng.uniform(0, 6), 1.0, cat="foliage", d=d)
    for k in range(26):
        d = rng.uniform(140, 276)
        u = rng.choice([-1, 1]) * rng.uniform(10, 50)
        p, a = P(d, u)
        if ok(d, u):
            inst("boulder_" + rng.choice("abcd"), "prop_boulder", p, rng.uniform(0, 6), rng.uniform(0.7, 1.2), d=d)

def run_s1_4(render=False):
    run_s1_2(render=False)
    clear_generated("s1_3")
    removed = run_s1_3_place()
    s14_place()
    ranges = {"a": (-35, 105), "b": (85, 210), "c": (190, 315), "d": (295, 447)}
    tri_by_chunk = {ck: sum(t for (d, t) in S13["tris"] if a <= d <= b) for ck, (a, b) in ranges.items()}
    kt = {k: v for k, v in KIT_TRIS.items() if k in ("headframe_tower", "adit_mouth", "ore_bin", "sluice_walk", "tent_a", "tent_b", "tent_c", "boiler", "sluice_a", "tailings_a")}
    stats = dict(props=S13["count_prop"], foliage=S13["count_foliage"], hiding_places=S13["hides"], interactables=S13["inter"], tris_by_chunk_instanced=tri_by_chunk, kit_tris=kt)
    print(json.dumps(stats, indent=1))
    for m in S13["markers"]:
        if m[0] in ("H06", "H07", "H08", "I17", "I18", "I19", "I20", "I26", "I09", "I10", "I04", "I05", "I23b", "a1-claims-guards", "LM_HEADFRAME", "ADIT", "DYNAMITE"):
            print("MARKER", m)
    if render:
        s14_renders()
    return stats

def s14_renders():
    cc, cp = get_cam("ChaseCamera"), get_cam("ChaseCameraPhone")
    for d in (150, 175, 205, 232, 258):
        place_chase_camera(cc, d)
        render_to(cc, "s1-4_chase_d%03d" % d, (1920, 1080))
    place_chase_camera(cc, 236, u=20)
    render_to(cc, "s1-4_chase_yard_gate_d236", (1920, 1080))
    place_chase_camera(cp, 245, phone=True)
    render_to(cp, "s1-4_chase_phone_d245", (1080, 1920))
    aerial("s1-4_aerial_sluice_field_west", 160, 33, (-14, -50), 30)
    aerial("s1-4_aerial_sluice_field_east", 190, 30, (-14, -46), 28)
    aerial("s1-4_aerial_south_lane_H06", 168, -22, (-10, -36), 24)
    aerial("s1-4_aerial_headframe", 250, 44, (-16, -44), 30)
    aerial("s1-4_aerial_headframe_close", 248, 52, (-10, -26), 18)
    aerial("s1-4_aerial_ore_yard_H08", 232, 40, (-12, -34), 24)
    aerial("s1-4_aerial_boiler_adit", 268, 40, (-16, -40), 26)
    aerial("s1-4_aerial_I20_lantern_string", 175, 0, (-6, -30), 20)
    gc = bpy.data.objects["GameCamera"]
    place_game_camera(gc, 235)
    render_to(gc, "s1-4_game_camera_d235", (1920, 1080))
    render_to(bpy.data.objects["ReviewTopCamera"], "s1-4_top_down", (1920, 1080))
