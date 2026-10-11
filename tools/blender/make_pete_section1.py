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
GAPS_N = [(100, 10, "gap in berm"), (183, 22, "claims yard opening"), (235, 22, "ore-bin yard opening (I17 gate)"), (300, 8, "cart shed track"), (368, 14, "Smuggler's Stash path")]

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
            base = mixc(mixc(PAL["stone"], PAL["scrub"], 0.4), PAL["sand_ground"], 0.55)
        elif kd in ("lane_s",) and kd2 in ("lane_s", "bs0"):
            base = mixc(PAL["mud"], PAL["sand_ground"], 0.55)
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
