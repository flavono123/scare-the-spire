"use client";

import type { MonsterPhobiaModeParticle, MonsterPhobiaModeScene } from "@/lib/codex-types";

interface MonsterPhobiaSceneStageProps {
  imageUrl: string;
  scene: MonsterPhobiaModeScene;
  monsterName: string;
  className?: string;
}

export function MonsterPhobiaSceneStage({
  imageUrl,
  scene,
  monsterName,
  className,
}: MonsterPhobiaSceneStageProps) {
  const sprite = scene.sprite;
  const spriteWidth = sprite.width * Math.abs(sprite.scale.x);
  const spriteHeight = sprite.height * Math.abs(sprite.scale.y);
  const spriteX = sprite.position.x - spriteWidth / 2;
  const spriteY = sprite.position.y - spriteHeight / 2;

  return (
    <svg
      className={className}
      viewBox={`${scene.viewBox.x} ${scene.viewBox.y} ${scene.viewBox.width} ${scene.viewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={monsterName}
    >
      <image
        href={imageUrl}
        x={spriteX}
        y={spriteY}
        width={spriteWidth}
        height={spriteHeight}
        preserveAspectRatio="none"
      />
      {scene.particles.map((particle) => (
        <PhobiaParticleLayer
          key={`${scene.scenePath}:${particle.name}`}
          particle={particle}
          sprite={sprite}
        />
      ))}
    </svg>
  );
}

function PhobiaParticleLayer({
  particle,
  sprite,
}: {
  particle: MonsterPhobiaModeParticle;
  sprite: MonsterPhobiaModeScene["sprite"];
}) {
  const amount = Math.max(0, Math.min(140, Math.round(particle.amount)));
  if (amount === 0) return null;

  const centerX = sprite.position.x + particle.position.x * sprite.scale.x;
  const centerY = sprite.position.y + particle.position.y * sprite.scale.y;
  const radiusMin = Math.max(0, particle.material.emissionRingInnerRadius * Math.abs(sprite.scale.x));
  const radiusMax = Math.max(radiusMin, particle.material.emissionRingRadius * Math.abs(sprite.scale.x));
  const lifetime = Math.max(0.4, particle.lifetime || 1);
  const textureWidth = particle.texture.width * Math.abs(sprite.scale.x);
  const textureHeight = particle.texture.height * Math.abs(sprite.scale.y);

  return (
    <g opacity="0.86">
      {Array.from({ length: amount }, (_, index) => {
        const seed = seededUnit(`${particle.name}:${index}`);
        const seedB = seededUnit(`${particle.name}:radius:${index}`);
        const seedC = seededUnit(`${particle.name}:scale:${index}`);
        const seedD = seededUnit(`${particle.name}:orbit:${index}`);
        const angle = seed * 360;
        const radius = radiusMin + (radiusMax - radiusMin) * seedB;
        const scale = particle.material.scaleMin + (particle.material.scaleMax - particle.material.scaleMin) * seedC;
        const width = textureWidth * scale;
        const height = textureHeight * scale;
        const direction = seedD > 0.5 ? 1 : -1;
        const duration = lifetime * (1.2 + seedD * 1.8);
        const begin = -particle.preprocess * seed;
        const x = centerX + Math.cos((angle * Math.PI) / 180) * radius - width / 2;
        const y = centerY + Math.sin((angle * Math.PI) / 180) * radius - height / 2;

        return (
          <g key={index}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`${angle} ${centerX} ${centerY}`}
              to={`${angle + direction * 360} ${centerX} ${centerY}`}
              dur={`${duration}s`}
              begin={`${begin}s`}
              repeatCount="indefinite"
            />
            <image
              href={particle.texture.imageUrl}
              x={x}
              y={y}
              width={width}
              height={height}
              opacity={0.34 + seedC * 0.5}
              preserveAspectRatio="none"
            >
              <animate
                attributeName="opacity"
                values={`${0.18 + seedC * 0.22};${0.55 + seedC * 0.4};${0.22 + seedC * 0.26}`}
                dur={`${duration * 0.72}s`}
                begin={`${begin}s`}
                repeatCount="indefinite"
              />
            </image>
          </g>
        );
      })}
    </g>
  );
}

function seededUnit(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}
