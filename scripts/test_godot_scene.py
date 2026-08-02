#!/usr/bin/env python3
"""Minimal regression check for Godot packed resources."""
from lib.godot_scene import parse_scene


def main() -> None:
    scene = parse_scene(
        '''
[gd_scene load_steps=2 format=3]
[ext_resource type="PackedScene" path="res://child.tscn" id="1_child"]
[node name="Child" parent="." instance=ExtResource("1_child")]
[resource]
shader_parameter/flipbook_size = Vector2(3, 2)
''',
        "test.tscn",
    )
    assert scene["nodes"][0]["instance"] == {"$": "ExtResource", "v": ["1_child"]}
    assert scene["resource"]["shader_parameter/flipbook_size"] == {"$": "Vector2", "v": [3, 2]}


if __name__ == "__main__":
    main()
