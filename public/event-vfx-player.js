(function () {
  "use strict";

  const sceneCache = new Map();
  const imageCache = new Map();
  const TAU = Math.PI * 2;

  function loadScene(url) {
    if (!sceneCache.has(url)) {
      sceneCache.set(url, fetch(url).then((response) => {
        if (!response.ok) throw new Error(`Event VFX scene ${response.status}: ${url}`);
        return response.json();
      }));
    }
    return sceneCache.get(url);
  }

  function loadImage(url) {
    if (!imageCache.has(url)) {
      imageCache.set(url, new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Event VFX texture failed: ${url}`));
        image.src = url;
      }));
    }
    return imageCache.get(url);
  }

  function construct(value, type) {
    return value && value.$ === type && Array.isArray(value.v) ? value.v : null;
  }

  function vector(value, fallback) {
    const values = construct(value, "Vector2") || construct(value, "Vector3");
    return values ? { x: Number(values[0]) || 0, y: Number(values[1]) || 0 } : fallback;
  }

  function color(value, fallback) {
    const values = construct(value, "Color");
    return values
      ? {
          r: Number(values[0]) || 0,
          g: Number(values[1]) || 0,
          b: Number(values[2]) || 0,
          a: values[3] == null ? 1 : Number(values[3]),
        }
      : fallback;
  }

  function refId(value, kind) {
    const values = construct(value, kind);
    return values && values.length ? String(values[0]) : null;
  }

  function subResource(scene, value) {
    const id = refId(value, "SubResource");
    return id ? scene.resources[id] || null : null;
  }

  function extResource(scene, value) {
    const id = refId(value, "ExtResource");
    return id ? scene.ext[id] || null : null;
  }

  function textureResource(scene, value) {
    return extResource(scene, value)?.texture || null;
  }

  function number(props, key, fallback) {
    const value = props[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hashString(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function randomFrom(seed) {
    let value = seed >>> 0;
    return function random() {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function multiplyColor(left, right) {
    return {
      r: left.r * right.r,
      g: left.g * right.g,
      b: left.b * right.b,
      a: left.a * right.a,
    };
  }

  function curvePoints(scene, value) {
    let resource = subResource(scene, value);
    if (!resource) return null;
    if (resource.type === "CurveTexture" || resource.type === "CurveXYZTexture") {
      resource = subResource(scene, resource.props.curve);
    }
    if (!resource || resource.type !== "Curve") return null;
    const data = resource.props._data;
    if (!Array.isArray(data)) return null;
    const points = [];
    for (let index = 0; index < data.length; index += 5) {
      const point = vector(data[index], null);
      if (point) points.push(point);
    }
    return points.sort((a, b) => a.x - b.x);
  }

  function sampleCurve(scene, value, progress, fallback) {
    const points = curvePoints(scene, value);
    if (!points || !points.length) return fallback;
    if (progress <= points[0].x) return points[0].y;
    for (let index = 1; index < points.length; index += 1) {
      const right = points[index];
      if (progress <= right.x) {
        const left = points[index - 1];
        const width = right.x - left.x;
        return mix(left.y, right.y, width > 0 ? (progress - left.x) / width : 0);
      }
    }
    return points[points.length - 1].y;
  }

  function gradient(scene, value) {
    let resource = subResource(scene, value);
    if (!resource) return null;
    if (resource.type === "GradientTexture1D") {
      resource = subResource(scene, resource.props.gradient);
    }
    if (!resource || resource.type !== "Gradient") return null;
    const offsets = construct(resource.props.offsets, "PackedFloat32Array") || [];
    const packed = construct(resource.props.colors, "PackedColorArray") || [];
    const colors = [];
    for (let index = 0; index < packed.length; index += 4) {
      colors.push({ r: packed[index], g: packed[index + 1], b: packed[index + 2], a: packed[index + 3] });
    }
    if (!colors.length) return null;
    const stops = colors.map((item, index) => ({
      at: offsets[index] == null ? index / Math.max(1, colors.length - 1) : offsets[index],
      color: item,
    }));
    return stops;
  }

  function sampleGradient(scene, value, progress, fallback) {
    const stops = gradient(scene, value);
    if (!stops) return fallback;
    if (progress <= stops[0].at) return stops[0].color;
    for (let index = 1; index < stops.length; index += 1) {
      const right = stops[index];
      if (progress <= right.at) {
        const left = stops[index - 1];
        const width = right.at - left.at;
        const t = width > 0 ? (progress - left.at) / width : 0;
        return {
          r: mix(left.color.r, right.color.r, t),
          g: mix(left.color.g, right.color.g, t),
          b: mix(left.color.b, right.color.b, t),
          a: mix(left.color.a, right.color.a, t),
        };
      }
    }
    return stops[stops.length - 1].color;
  }

  function bezier(a, b, c, d, t) {
    const mt = 1 - t;
    return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
  }

  function curve2dPoints(scene, value) {
    const resource = subResource(scene, value);
    const packed = resource?.props?._data?.points;
    const values = construct(packed, "PackedVector2Array");
    if (!values) return null;
    const points = [];
    for (let index = 0; index < values.length; index += 3) {
      points.push({
        incoming: vector(values[index], { x: 0, y: 0 }),
        outgoing: vector(values[index + 1], { x: 0, y: 0 }),
        position: vector(values[index + 2], { x: 0, y: 0 }),
      });
    }
    return points;
  }

  function samplePath(points, progress) {
    if (!points || points.length < 2) return { x: 0, y: 0, rotation: 0 };
    const scaled = (((progress % 1) + 1) % 1) * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(scaled));
    const t = scaled - index;
    const left = points[index];
    const right = points[index + 1];
    const c1 = { x: left.position.x + left.outgoing.x, y: left.position.y + left.outgoing.y };
    const c2 = { x: right.position.x + right.incoming.x, y: right.position.y + right.incoming.y };
    const x = bezier(left.position.x, c1.x, c2.x, right.position.x, t);
    const y = bezier(left.position.y, c1.y, c2.y, right.position.y, t);
    const nextT = Math.min(1, t + 0.001);
    const nextX = bezier(left.position.x, c1.x, c2.x, right.position.x, nextT);
    const nextY = bezier(left.position.y, c1.y, c2.y, right.position.y, nextT);
    return { x, y, rotation: Math.atan2(nextY - y, nextX - x) };
  }

  function compose(parent, local) {
    const cosine = Math.cos(parent.rotation);
    const sine = Math.sin(parent.rotation);
    const scaledX = local.x * parent.scaleX;
    const scaledY = local.y * parent.scaleY;
    return {
      x: parent.x + scaledX * cosine - scaledY * sine,
      y: parent.y + scaledX * sine + scaledY * cosine,
      rotation: parent.rotation + local.rotation,
      scaleX: parent.scaleX * local.scaleX,
      scaleY: parent.scaleY * local.scaleY,
      color: multiplyColor(parent.color, local.color),
    };
  }

  function localTransform(node, time, scene) {
    const props = node.props;
    let position = vector(props.position, { x: 0, y: 0 });
    let rotation = number(props, "rotation", 0);
    if (node.type === "PathFollow2D" && node._parent?.type === "Path2D") {
      const points = curve2dPoints(scene, node._parent.props.curve);
      const initial = number(props, "progress_ratio", 0);
      const sampled = samplePath(points, initial + time * 0.1);
      position = sampled;
      if (props.rotates !== false) rotation += sampled.rotation;
    }
    const scale = vector(props.scale, { x: 1, y: 1 });
    const tint = multiplyColor(
      color(props.modulate, { r: 1, g: 1, b: 1, a: 1 }),
      color(props.self_modulate, { r: 1, g: 1, b: 1, a: 1 }),
    );
    return { x: position.x, y: position.y, rotation, scaleX: scale.x, scaleY: scale.y, color: tint };
  }

  function prepareScene(scene, images, seedOffset) {
    const byPath = new Map();
    const root = scene.nodes[0] || null;
    for (const node of scene.nodes) {
      let path;
      if (!node.parent) path = ".";
      else if (node.parent === ".") path = node.name;
      else path = `${node.parent}/${node.name}`;
      node._path = path;
      byPath.set(path, node);
    }
    for (const node of scene.nodes) {
      node._parent = node === root || !node.parent ? null : byPath.get(node.parent) || root;
      if (node.type === "GPUParticles2D") {
        const amount = Math.max(1, Math.floor(number(node.props, "amount", 8)));
        const random = randomFrom(hashString(`${scene.source}:${node._path}:${seedOffset}`));
        node._particles = Array.from({ length: amount }, (_, index) => ({
          index,
          phase: random(),
          x: random(),
          y: random(),
          velocity: random(),
          angle: random(),
          angular: random(),
          scale: random(),
          anim: random(),
          turbulence: random() * TAU,
        }));
      }
    }
    scene._images = images;
    scene._nodes = scene.nodes
      .map((node, index) => ({ node, index, z: number(node.props, "z_index", 0) }))
      .sort((a, b) => a.z - b.z || a.index - b.index)
      .map((item) => item.node);
    return scene;
  }

  async function hydrateScene(url, seedOffset) {
    const raw = await loadScene(url);
    const scene = JSON.parse(JSON.stringify(raw));
    const textureEntries = Object.values(scene.ext)
      .filter((resource) => resource.texture)
      .map((resource) => resource.texture);
    const unique = [...new Map(textureEntries.map((texture) => [texture.src, texture])).values()];
    const loaded = await Promise.all(unique.map(async (texture) => [texture.src, await loadImage(texture.src)]));
    return prepareScene(scene, new Map(loaded), seedOffset);
  }

  function materialBlend(scene, value) {
    const sub = subResource(scene, value);
    if (sub?.type === "CanvasItemMaterial") return number(sub.props, "blend_mode", 0);
    const ext = extResource(scene, value);
    return ext?.path?.includes("additive") ? 1 : 0;
  }

  function setComposite(context, blendMode) {
    if (blendMode === 1) context.globalCompositeOperation = "lighter";
    else if (blendMode === 3) context.globalCompositeOperation = "multiply";
    else context.globalCompositeOperation = "source-over";
  }

  function drawImageCentered(context, image, source, width, height) {
    if (source) {
      context.drawImage(image, source.x, source.y, source.width, source.height, -width / 2, -height / 2, width, height);
    } else {
      context.drawImage(image, -width / 2, -height / 2, width, height);
    }
  }

  function animationMaterial(scene, value) {
    const resource = subResource(scene, value);
    if (!resource || resource.type !== "CanvasItemMaterial" || resource.props.particles_animation !== true) return null;
    return {
      horizontal: Math.max(1, number(resource.props, "particles_anim_h_frames", 1)),
      vertical: Math.max(1, number(resource.props, "particles_anim_v_frames", 1)),
      loop: resource.props.particles_anim_loop !== false,
    };
  }

  function textureFrame(texture, animation, frameProgress) {
    if (!animation) return null;
    const total = animation.horizontal * animation.vertical;
    const progress = animation.loop ? ((frameProgress % 1) + 1) % 1 : clamp(frameProgress, 0, 0.999999);
    const frame = Math.min(total - 1, Math.floor(progress * total));
    const width = texture.width / animation.horizontal;
    const height = texture.height / animation.vertical;
    return {
      x: (frame % animation.horizontal) * width,
      y: Math.floor(frame / animation.horizontal) * height,
      width,
      height,
    };
  }

  function drawParticleNode(context, scene, node, world, time, oneShot) {
    if (node.props.visible === false || node.props.emitting === false && !oneShot) return;
    const texture = textureResource(scene, node.props.texture);
    const image = texture ? scene._images.get(texture.src) : null;
    if (!texture || !image) return;
    const process = subResource(scene, node.props.process_material);
    if (!process || process.type !== "ParticleProcessMaterial") return;
    const props = process.props;
    const lifetime = Math.max(0.01, number(node.props, "lifetime", 1));
    const preprocess = number(node.props, "preprocess", 0);
    const speedScale = number(node.props, "speed_scale", 1);
    const explosiveness = number(node.props, "explosiveness", 0);
    const randomness = number(node.props, "randomness", 0);
    const nodeColor = world.color;
    const baseColor = color(props.color, { r: 1, g: 1, b: 1, a: 1 });
    const box = vector(props.emission_box_extents, { x: 1, y: 1 });
    const shapeScale = vector(props.emission_shape_scale, { x: 1, y: 1 });
    const direction = vector(props.direction, { x: 1, y: 0 });
    const directionLength = Math.hypot(direction.x, direction.y) || 1;
    const directionAngle = Math.atan2(direction.y, direction.x);
    const spread = number(props, "spread", 45) * Math.PI / 180;
    const velocityMin = number(props, "initial_velocity_min", 0);
    const velocityMax = number(props, "initial_velocity_max", velocityMin);
    const gravity = vector(props.gravity, { x: 0, y: 980 });
    const linearMin = number(props, "linear_accel_min", 0);
    const linearMax = number(props, "linear_accel_max", linearMin);
    const angularMin = number(props, "angular_velocity_min", 0);
    const angularMax = number(props, "angular_velocity_max", angularMin);
    const angleMin = number(props, "angle_min", 0);
    const angleMax = number(props, "angle_max", angleMin);
    const scaleMin = number(props, "scale_min", 1);
    const scaleMax = number(props, "scale_max", scaleMin);
    const orbitMin = number(props, "orbit_velocity_min", 0);
    const orbitMax = number(props, "orbit_velocity_max", orbitMin);
    const animation = animationMaterial(scene, node.props.material);
    const animationSpeedMin = number(props, "anim_speed_min", 0);
    const animationSpeedMax = number(props, "anim_speed_max", animationSpeedMin);
    const animationOffsetMin = number(props, "anim_offset_min", 0);
    const animationOffsetMax = number(props, "anim_offset_max", animationOffsetMin);
    const blend = materialBlend(scene, node.props.material);
    const shape = number(props, "emission_shape", 0);

    context.save();
    context.translate(world.x, world.y);
    context.rotate(world.rotation);
    context.scale(world.scaleX, world.scaleY);
    setComposite(context, blend);

    for (const particle of node._particles) {
      const phase = oneShot
        ? 0
        : ((particle.index / node._particles.length) * (1 - explosiveness) + particle.phase * randomness) * lifetime;
      const ageRaw = time * speedScale + preprocess + phase;
      if (oneShot && (ageRaw < 0 || ageRaw >= lifetime)) continue;
      const age = oneShot ? ageRaw : ((ageRaw % lifetime) + lifetime) % lifetime;
      const progress = age / lifetime;
      const velocity = mix(velocityMin, velocityMax, particle.velocity);
      const acceleration = mix(linearMin, linearMax, particle.velocity);
      const travel = velocity * age + 0.5 * acceleration * age * age;
      const emittedX = shape === 3 ? (particle.x * 2 - 1) * box.x * shapeScale.x : 0;
      const emittedY = shape === 3 ? (particle.y * 2 - 1) * box.y * shapeScale.y : 0;
      const angle = directionAngle + (particle.angle * 2 - 1) * spread;
      let x = emittedX + Math.cos(angle) / directionLength * travel + 0.5 * gravity.x * age * age;
      let y = emittedY + Math.sin(angle) / directionLength * travel + 0.5 * gravity.y * age * age;
      const orbit = mix(orbitMin, orbitMax, particle.angular) * TAU * age;
      if (orbit) {
        const cosine = Math.cos(orbit);
        const sine = Math.sin(orbit);
        const rotatedX = x * cosine - y * sine;
        y = x * sine + y * cosine;
        x = rotatedX;
      }
      if (props.turbulence_enabled === true) {
        const strength = number(props, "turbulence_noise_strength", 1);
        const influence = mix(
          number(props, "turbulence_influence_min", 0),
          number(props, "turbulence_influence_max", 0),
          particle.turbulence / TAU,
        );
        x += Math.sin(time * 1.7 + particle.turbulence) * strength * influence;
        y += Math.cos(time * 1.3 + particle.turbulence) * strength * influence;
      }
      let particleScale = mix(scaleMin, scaleMax, particle.scale);
      particleScale *= sampleCurve(scene, props.scale_curve, progress, 1);
      const particleColor = multiplyColor(
        multiplyColor(baseColor, sampleGradient(scene, props.color_ramp, progress, { r: 1, g: 1, b: 1, a: 1 })),
        nodeColor,
      );
      particleColor.a *= sampleCurve(scene, props.alpha_curve, progress, 1);
      if (particleColor.a <= 0.003 || Math.abs(particleScale) <= 0.0001) continue;
      const rotation = (mix(angleMin, angleMax, particle.angle) + mix(angularMin, angularMax, particle.angular) * age) * Math.PI / 180;
      const frameProgress = mix(animationOffsetMin, animationOffsetMax, particle.anim)
        + progress * mix(animationSpeedMin, animationSpeedMax, particle.anim);
      const source = textureFrame(texture, animation, frameProgress);
      const sourceWidth = source?.width || texture.width;
      const sourceHeight = source?.height || texture.height;
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
      const flip = props.particle_flag_rotate_y === true ? Math.cos(progress * TAU) : 1;
      context.scale(particleScale * flip, particleScale);
      context.globalAlpha = clamp(particleColor.a, 0, 1);
      drawImageCentered(context, image, source, sourceWidth, sourceHeight);
      context.restore();
    }
    context.restore();
  }

  function spriteTextureAtTime(scene, node, time) {
    if (node.type === "Sprite2D") return textureResource(scene, node.props.texture);
    const frames = subResource(scene, node.props.sprite_frames);
    const animations = frames?.props?.animations;
    if (!Array.isArray(animations) || !animations.length) return null;
    const requested = node.props.animation || node.props.autoplay;
    const animation = animations.find((item) => item.name === requested) || animations[0];
    if (!Array.isArray(animation.frames) || !animation.frames.length) return null;
    const speed = number(animation, "speed", 5) * number(node.props, "speed_scale", 1);
    const duration = animation.frames.reduce((sum, frame) => sum + number(frame, "duration", 1), 0);
    let cursor = animation.loop === false
      ? Math.min(duration - 0.0001, time * speed)
      : ((time * speed) % duration + duration) % duration;
    for (const frame of animation.frames) {
      cursor -= number(frame, "duration", 1);
      if (cursor < 0) return textureResource(scene, frame.texture);
    }
    return textureResource(scene, animation.frames[animation.frames.length - 1].texture);
  }

  function drawSpriteNode(context, scene, node, world, time) {
    if (node.props.visible === false) return;
    const texture = spriteTextureAtTime(scene, node, time);
    const image = texture ? scene._images.get(texture.src) : null;
    if (!texture || !image) return;
    const horizontal = Math.max(1, number(node.props, "hframes", 1));
    const vertical = Math.max(1, number(node.props, "vframes", 1));
    const frame = Math.max(0, Math.floor(number(node.props, "frame", 0)));
    const width = texture.width / horizontal;
    const height = texture.height / vertical;
    const source = horizontal > 1 || vertical > 1
      ? { x: (frame % horizontal) * width, y: Math.floor(frame / horizontal) * height, width, height }
      : null;
    const offset = vector(node.props.offset, { x: 0, y: 0 });
    context.save();
    context.translate(world.x, world.y);
    context.rotate(world.rotation);
    context.scale(world.scaleX * (node.props.flip_h ? -1 : 1), world.scaleY * (node.props.flip_v ? -1 : 1));
    context.translate(offset.x, offset.y);
    setComposite(context, materialBlend(scene, node.props.material));
    context.globalAlpha = clamp(world.color.a, 0, 1);
    drawImageCentered(context, image, source, width, height);
    context.restore();
  }

  function renderScene(context, scene, time, offset, oneShot) {
    const worldByNode = new Map();
    const rootWorld = {
      x: offset.x,
      y: offset.y,
      rotation: offset.rotation || 0,
      scaleX: offset.scale ?? 1,
      scaleY: offset.scale ?? 1,
      color: { r: 1, g: 1, b: 1, a: 1 },
    };
    for (const node of scene.nodes) {
      const parentWorld = node._parent ? worldByNode.get(node._parent) || rootWorld : rootWorld;
      worldByNode.set(node, compose(parentWorld, localTransform(node, time, scene)));
    }
    for (const node of scene._nodes) {
      const world = worldByNode.get(node);
      if (!world) continue;
      if (node.type === "GPUParticles2D") drawParticleNode(context, scene, node, world, time, oneShot);
      else if (node.type === "Sprite2D" || node.type === "AnimatedSprite2D") drawSpriteNode(context, scene, node, world, time);
    }
  }

  function smoothNoise(seed, time) {
    const x = time * 0.08;
    const left = Math.floor(x);
    const t = x - left;
    const smooth = t * t * (3 - 2 * t);
    const random = (index) => {
      const value = Math.sin((index + seed * 131.7) * 12.9898) * 43758.5453;
      return (value - Math.floor(value)) * 2 - 1;
    };
    return mix(random(left), random(left + 1), smooth) * 0.34;
  }

  function drawMirrorBase(context, image, scale, rotation) {
    const width = 2560 * 1.04 * scale;
    const height = 1200 * 1.04 * scale;
    context.save();
    context.translate(960, 545);
    context.rotate(rotation);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
  }

  function renderMirror(context, layer, scene, baseImage, time) {
    const maskTexture = Object.values(scene.ext).find((resource) => resource.texture)?.texture;
    const mask = maskTexture ? scene._images.get(maskTexture.src) : null;
    if (!mask) return;
    const layerContext = layer.getContext("2d");
    const rotations = [10, 20, 30];
    for (let index = 0; index < 3; index += 1) {
      const scale = Math.max(0.2, 1.05 + smoothNoise(index * 2, time * 2));
      const rotation = Math.abs(smoothNoise(index * 2 + 1, time * 2)) * rotations[index] * Math.PI / 180;
      layerContext.setTransform(1, 0, 0, 1, 0, 0);
      layerContext.clearRect(0, 0, layer.width, layer.height);
      layerContext.save();
      layerContext.translate(480, 540);
      layerContext.rotate(rotation);
      layerContext.scale(scale, scale);
      layerContext.drawImage(mask, -mask.width / 2, -mask.height / 2);
      layerContext.restore();
      layerContext.globalCompositeOperation = "source-in";
      drawMirrorBase(layerContext, baseImage, scale, index === 1 ? -0.0349066 : index === 2 ? 0.0349066 : 0);
      layerContext.globalCompositeOperation = "source-over";
      context.drawImage(layer, 0, 0);
    }
  }

  function resizeCanvas(canvas, context, logicalWidth, logicalHeight) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const density = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(rect.width * density));
    const height = Math.max(1, Math.round(rect.height * density));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(width / logicalWidth, 0, 0, height / logicalHeight, 0, 0);
    context.imageSmoothingEnabled = true;
    return true;
  }

  async function create(canvas, options) {
    const mirror = options.mode === "mirror";
    const logicalWidth = mirror ? 1920 : 2560;
    const logicalHeight = mirror ? 1080 : 1200;
    const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!context) throw new Error("Canvas 2D is unavailable for event VFX");
    const scene = await hydrateScene(options.sceneUrl, 0);
    const baseImage = mirror ? await loadImage(options.baseImageUrl) : null;
    const mirrorLayer = mirror ? document.createElement("canvas") : null;
    if (mirrorLayer) {
      mirrorLayer.width = logicalWidth;
      mirrorLayer.height = logicalHeight;
    }
    const bursts = [];
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const targetInterval = 1000 / (reducedMotion ? 12 : 30);
    let destroyed = false;
    let visible = true;
    let frameId = 0;
    let start = performance.now();
    let previous = 0;

    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting !== false; }, { rootMargin: "120px" })
      : null;
    observer?.observe(canvas);

    const render = (now) => {
      if (destroyed) return;
      frameId = requestAnimationFrame(render);
      if (!visible || document.hidden || now - previous < targetInterval) return;
      previous = now;
      if (!resizeCanvas(canvas, context, logicalWidth, logicalHeight)) return;
      context.clearRect(0, 0, logicalWidth, logicalHeight);
      const elapsed = (now - start) / 1000 * (reducedMotion ? 0.35 : 1);
      if (mirror) {
        renderMirror(context, mirrorLayer, scene, baseImage, elapsed);
      } else {
        renderScene(context, scene, elapsed, {
          x: options.offsetX ?? 268,
          y: options.offsetY ?? 49,
          scale: options.scale ?? 1,
          rotation: 0,
        }, false);
        for (let index = bursts.length - 1; index >= 0; index -= 1) {
          const burst = bursts[index];
          const age = (now - burst.startedAt) / 1000;
          if (age > burst.lifetime) {
            bursts.splice(index, 1);
            continue;
          }
          if (burst.scene) renderScene(context, burst.scene, age, burst, true);
        }
      }
    };
    frameId = requestAnimationFrame(render);
    options.onReady?.();

    return {
      async playOneShot(sceneUrl, placement) {
        const burst = {
          x: placement.x,
          y: placement.y,
          rotation: placement.rotation || 0,
          scale: placement.scale ?? 1,
          lifetime: placement.lifetime ?? 2,
          startedAt: performance.now(),
          scene: null,
        };
        bursts.push(burst);
        burst.scene = await hydrateScene(sceneUrl, bursts.length);
        burst.startedAt = performance.now();
      },
      destroy() {
        destroyed = true;
        cancelAnimationFrame(frameId);
        observer?.disconnect();
        canvas.width = 1;
        canvas.height = 1;
      },
      restart() {
        start = performance.now();
      },
    };
  }

  window.EventVfxPlayer = { create };
})();
