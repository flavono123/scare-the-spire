extends Node2D
## Renders one of the game's hit VFX scenes from the game PCK on a transparent 1920x1080 frame, for
## scripts/extract-hit-vfx.py. The scenes' C# players do not load in MegaDot, so what they do is done here:
##   NVfxParticleSystem (NVfxParticleSystem.cs): _Ready sets every GPU/CPU particle node under the scene
##     to emitting; the node frees itself after _lifetime seconds.
##   NSpriteAnimator (NSpriteAnimator.cs): shows _frames in order at _fps, rotated by a random whole
##     number of degrees in _rotationRange when _randomizeRotation is on, and frees itself after the last.
## The script's exported values live in the .tscn, which the Python side reads and passes as user args:
##   --path scripts/godot/hit-vfx --write-movie out/f.png --fixed-fps 30 --quit-after N -- \
##       pck=<file.pck> kind=particles scene=res://scenes/vfx/<name>.tscn
##       pck=<file.pck> kind=sprite frames=res://a.png,res://b.png fps=15 scale=0.75 rotation=12
##       pck=<file.pck> kind=missile color=50b598 origin=960,900
## The VFX sits at `origin` (default 960,540) in the frame. `missile` is NSmallMagicMissileVfx, a dedicated
## C# node, ported from its 0.113.0 source (Initialize, ModulateParticles, PlaySequence):
##   direction = Up rotated -30 deg; top = where that line through the target meets y = 80;
##   anticipation container at top; projectile from top + dir*offset to target + dir*offset (offset -100)
##   0 s: anticipation particles restart; 0.2 s: projectile start specks, core visible, lerp for 0.2 s
##   (WaitTime); then the core is hidden and the impact particles restart.
## The game also shakes the screen at the impact (Medium, Short); the simulator does that from the damage.

const ORIGIN := Vector2(960, 540)
const MISSILE_SCENE := "res://scenes/vfx/vfx_small_magic_missile.tscn"
const MISSILE_ANTICIPATION := 0.2
const MISSILE_WAIT_TIME := 0.2
const MISSILE_OFFSET := -100.0

var origin := ORIGIN
var missile: Node2D
var missile_stage := 0
var missile_dir: Vector2
var missile_start: Vector2
var missile_end: Vector2
var sprite: Sprite2D
var frames: PackedStringArray = []
var fps := 15.0
var t := 0.0

func _ready() -> void:
	var args := {}
	for arg in OS.get_cmdline_user_args():
		var split := arg.find("=")
		if split > 0:
			args[arg.substr(0, split)] = arg.substr(split + 1)
	if not ProjectSettings.load_resource_pack(args["pck"], false):
		push_error("cannot load " + args["pck"])
		get_tree().quit(1)
		return
	if args.has("origin"):
		var xy: PackedStringArray = args["origin"].split(",")
		origin = Vector2(float(xy[0]), float(xy[1]))
	if args["kind"] == "missile":
		setup_missile(args)
		return
	if args["kind"] == "sprite":
		frames = args["frames"].split(",")
		fps = float(args.get("fps", "15"))
		sprite = Sprite2D.new()
		var s := float(args.get("scale", "1"))
		sprite.scale = Vector2(s, s)
		sprite.rotation_degrees = float(args.get("rotation", "0"))
		sprite.position = origin
		add_child(sprite)
		sprite.texture = load(frames[0])
	else:
		var vfx: Node2D = load(args["scene"]).instantiate()
		add_child(vfx)
		vfx.position = origin
		for node in vfx.find_children("*", "GPUParticles2D", true, false):
			node.use_fixed_seed = true
			node.seed = 1
			node.emitting = true
		for node in vfx.find_children("*", "CPUParticles2D", true, false):
			node.use_fixed_seed = true
			node.seed = 1
			node.emitting = true

func restart_nodes(paths: Array) -> void:
	for p in paths:
		missile.get_node(p).restart()

func setup_missile(args: Dictionary) -> void:
	var tint := Color(args["color"])
	missile = load(MISSILE_SCENE).instantiate()
	add_child(missile)
	missile.global_position = origin
	for p in ["anticipation_vfx_container/vfx_missile_sky_ray", "anticipation_vfx_container/vfx_common_ring_polar_a",
			"anticipation_vfx_container/vfx_common_specks", "projectile_vfx_container/vfx_missile_core",
			"impact_vfx_container/vfx_common_hit_flare", "impact_vfx_container/vfx_common_glow",
			"impact_vfx_container/vfx_common_specks", "impact_vfx_container/vfx_common_ring_polar_a"]:
		missile.get_node(p).self_modulate = tint
	for n in missile.find_children("*", "GPUParticles2D", true, false):
		n.emitting = false
		n.use_fixed_seed = true
		n.seed = 1
	missile_dir = Vector2(0, 1).rotated(deg_to_rad(-30.0)).normalized()
	var top: Vector2 = Geometry2D.line_intersects_line(origin, missile_dir, Vector2(0, 80), Vector2.RIGHT)
	missile.get_node("anticipation_vfx_container").global_position = top
	missile_start = top + missile_dir * MISSILE_OFFSET
	missile_end = origin + missile_dir * MISSILE_OFFSET
	missile.get_node("projectile_vfx_container").visible = false
	restart_nodes(["anticipation_vfx_container/vfx_missile_sky_ray", "anticipation_vfx_container/vfx_common_ring_polar_a"])

func process_missile() -> void:
	var proj: Node2D = missile.get_node("projectile_vfx_container")
	if missile_stage == 0 and t >= MISSILE_ANTICIPATION:
		missile_stage = 1
		restart_nodes(["anticipation_vfx_container/vfx_common_specks"])
		proj.global_position = missile_start
		proj.visible = true
		restart_nodes(["projectile_vfx_container/vfx_missile_core"])
	elif missile_stage == 1:
		var u := (t - MISSILE_ANTICIPATION) / MISSILE_WAIT_TIME
		if u < 1.0:
			proj.global_position = missile_start.lerp(missile_end, u)
		else:
			missile_stage = 2
			proj.visible = false
			restart_nodes(["impact_vfx_container/vfx_common_hit_flare", "impact_vfx_container/vfx_smoke_flipbook",
				"impact_vfx_container/vfx_common_glow", "impact_vfx_container/vfx_common_specks",
				"impact_vfx_container/vfx_common_ring_polar_a"])

func _process(delta: float) -> void:
	t += delta
	if missile:
		process_missile()
	if sprite:
		var i := int(t * fps)
		if i < frames.size():
			sprite.texture = load(frames[i])
		else:
			sprite.visible = false
