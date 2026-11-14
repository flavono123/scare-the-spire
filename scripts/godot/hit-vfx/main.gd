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
## The VFX sits at ORIGIN in the frame.

const ORIGIN := Vector2(960, 540)

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
	if args["kind"] == "sprite":
		frames = args["frames"].split(",")
		fps = float(args.get("fps", "15"))
		sprite = Sprite2D.new()
		var s := float(args.get("scale", "1"))
		sprite.scale = Vector2(s, s)
		sprite.rotation_degrees = float(args.get("rotation", "0"))
		sprite.position = ORIGIN
		add_child(sprite)
		sprite.texture = load(frames[0])
	else:
		var vfx: Node2D = load(args["scene"]).instantiate()
		add_child(vfx)
		vfx.position = ORIGIN
		for node in vfx.find_children("*", "GPUParticles2D", true, false):
			node.use_fixed_seed = true
			node.seed = 1
			node.emitting = true
		for node in vfx.find_children("*", "CPUParticles2D", true, false):
			node.use_fixed_seed = true
			node.seed = 1
			node.emitting = true

func _process(delta: float) -> void:
	t += delta
	if sprite:
		var i := int(t * fps)
		if i < frames.size():
			sprite.texture = load(frames[i])
		else:
			sprite.visible = false
