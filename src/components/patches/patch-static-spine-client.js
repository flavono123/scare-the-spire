(() => {
  const PREVIEW_SELECTOR = "[data-static-spine-preview]";
  const FALLBACK_SELECTOR = "[data-static-spine-fallback]";
  const PLAYER_SCRIPT_SRC = "/_patches/spine-player.min.js";
  const REPLAY_INTERVAL_MS = 1250;
  const VIEWPORT_PADDING = { padTop: "0%", padBottom: "0%" };

  let spineRuntimePromise = null;

  function loadSpineRuntime() {
    if (window.spine?.SpinePlayer) return Promise.resolve(window.spine);
    if (spineRuntimePromise) return spineRuntimePromise;

    spineRuntimePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PLAYER_SCRIPT_SRC;
      script.async = true;
      script.onload = () => {
        if (window.spine?.SpinePlayer) {
          resolve(window.spine);
        } else {
          reject(new Error("Spine player runtime did not expose window.spine"));
        }
      };
      script.onerror = () => reject(new Error(`Failed to load ${PLAYER_SCRIPT_SRC}`));
      document.head.appendChild(script);
    });

    return spineRuntimePromise;
  }

  function parseAsset(node) {
    const raw = node.getAttribute("data-static-spine-asset");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Failed to parse static Spine asset payload:", error);
      return null;
    }
  }

  function getMoveId(node) {
    return node.getAttribute("data-static-spine-move-id") || null;
  }

  function getViewport(asset) {
    const base = asset.viewport
      ? {
          padLeft: "4%",
          padRight: "4%",
          padTop: "4%",
          padBottom: "4%",
          ...asset.viewport,
        }
      : asset.id === "CUBEX_CONSTRUCT"
        ? {
            padLeft: "18%",
            padRight: "18%",
            padTop: "22%",
            padBottom: "18%",
          }
        : {
            padLeft: "4%",
            padRight: "4%",
            padTop: "4%",
            padBottom: "4%",
          };

    return {
      ...base,
      ...VIEWPORT_PADDING,
      transitionTime: 0,
    };
  }

  function resolveAnimation(asset, moveId, availableAnimations) {
    const available = new Set(availableAnimations.length > 0 ? availableAnimations : asset.animations || []);
    const candidates = [
      ...((moveId && asset.moveAnimations?.[moveId]) || []),
      moveId ? moveId.toLowerCase() : null,
      asset.idleAnimation,
      asset.animations?.[0],
    ].filter(Boolean);

    return candidates.find((candidate) => available.has(candidate)) || asset.idleAnimation;
  }

  function setEntryFresh(entry) {
    if (!entry) return;
    entry.mixDuration = 0;
    entry.mixTime = 0;
    entry.trackTime = 0;
    entry.trackLast = -1;
    entry.animationLast = -1;
    entry.alpha = 1;
  }

  function restartAnimation(player, animation, loop) {
    player.animationState?.clearTrack(0);
    player.skeleton?.setToSetupPose();
    const entry = player.setAnimation(animation, loop);
    setEntryFresh(entry);
  }

  function restartTrackAnimations(player, trackAnimations, idleTracks) {
    player.animationState?.clearTracks();
    player.skeleton?.setToSetupPose();

    for (const trackAnimation of trackAnimations) {
      const entry = player.animationState?.setAnimation(
        trackAnimation.track,
        trackAnimation.animation,
        trackAnimation.loop ?? true,
      );
      setEntryFresh(entry);

      if (trackAnimation.loop === false && trackAnimation.idleAnimation) {
        const idleEntry = player.animationState?.addAnimation(
          trackAnimation.track,
          trackAnimation.idleAnimation,
          true,
          0,
        );
        if (idleEntry) {
          idleEntry.mixDuration = 0;
          idleEntry.mixTime = 0;
        }
      }
    }

    const configuredTracks = new Set(trackAnimations.map((trackAnimation) => trackAnimation.track));
    for (const idleTrack of idleTracks || []) {
      if (configuredTracks.has(idleTrack.track)) continue;
      const entry = player.animationState?.setAnimation(idleTrack.track, idleTrack.animation, idleTrack.loop ?? true);
      if (entry) {
        entry.mixDuration = 0;
        entry.mixTime = 0;
      }
    }
  }

  function applyCompositeSkin(runtime, player, asset, monsterName) {
    const skinNames = asset.defaultSkinCombination || [];
    if (skinNames.length === 0 || !player.skeleton || !runtime.Skin) return;

    const skeleton = player.skeleton;
    const skeletonData = skeleton.data;
    const compositeSkin = new runtime.Skin(`combined:${skinNames.join("+")}`);
    const defaultSkin = skeletonData.findSkin("default");
    if (defaultSkin) compositeSkin.addSkin(defaultSkin);

    for (const skinName of skinNames) {
      const skin = skeletonData.findSkin(skinName);
      if (!skin) {
        console.warn(`Missing Spine skin ${skinName} for ${monsterName}`);
        continue;
      }
      compositeSkin.addSkin(skin);
    }

    skeleton.setSkin(compositeSkin);
    skeleton.setSlotsToSetupPose();
    skeleton.updateWorldTransform(runtime.Physics?.update);
  }

  function playMove(state) {
    if (!state.player || !state.asset) return;

    const tracks = state.moveId ? state.asset.moveAnimationTracks?.[state.moveId] : null;
    try {
      if (tracks?.length) {
        restartTrackAnimations(state.player, tracks, state.asset.idleTracks);
      } else {
        restartAnimation(state.player, state.animation, true);
      }
      state.player.play();
      playEffect(state);
    } catch (error) {
      console.warn(`Failed to play static Spine animation ${state.animation}:`, error);
    }
  }

  function resolveEffect(asset, moveId) {
    if (!moveId) return null;
    return asset.moveEffects?.[moveId]?.find((effect) => effect.usable !== false) || null;
  }

  function clearEffect(state) {
    if (state.effectTimer) {
      window.clearTimeout(state.effectTimer);
      state.effectTimer = null;
    }
    if (state.effectPlayer) {
      state.effectPlayer.dispose();
      state.effectPlayer = null;
    }
    if (state.effectNode) {
      state.effectNode.replaceChildren();
    }
  }

  function playEffect(state) {
    const effect = resolveEffect(state.asset, state.moveId);
    clearEffect(state);
    if (!effect || !state.runtime?.SpinePlayer) return;

    if (!state.effectNode) {
      state.effectNode = document.createElement("span");
      state.effectNode.className = "sts2-static-spine-vfx sts2-spine-stage pointer-events-none absolute inset-0 z-30";
      state.node.appendChild(state.effectNode);
    }

    const player = new state.runtime.SpinePlayer(state.effectNode, {
      binaryUrl: effect.binaryUrl,
      atlasUrl: effect.atlasUrl,
      animation: effect.idleAnimation,
      animations: effect.animations,
      alpha: true,
      backgroundColor: "00000000",
      preserveDrawingBuffer: false,
      premultipliedAlpha: false,
      showControls: false,
      showLoading: false,
      viewport: {
        padLeft: "0%",
        padRight: "0%",
        padTop: "0%",
        padBottom: "0%",
        transitionTime: 0,
      },
      success: (loadedPlayer) => {
        state.effectPlayer = loadedPlayer;
        try {
          loadedPlayer.setAnimation(effect.idleAnimation, false);
          loadedPlayer.play();
        } catch (error) {
          console.warn(`Failed to play static Spine VFX ${effect.id}:`, error);
        }
      },
      error: (_loadedPlayer, message) => {
        console.warn(`Failed to load static Spine VFX ${effect.id}: ${message}`);
        clearEffect(state);
      },
    });
    state.effectPlayer = player;

    const durationMs = Math.max(250, Math.ceil((effect.durationSeconds || 0.75) * 1000) + 200);
    state.effectTimer = window.setTimeout(() => clearEffect(state), durationMs);
  }

  function setReady(node, ready) {
    node.style.opacity = ready ? "1" : "0";
    const fallback = node.parentElement?.querySelector(FALLBACK_SELECTOR);
    if (fallback) fallback.style.opacity = ready ? "0" : "";
  }

  function startReplay(state) {
    if (!state.player || state.replayTimer) return;
    playMove(state);
    state.replayTimer = window.setInterval(() => playMove(state), REPLAY_INTERVAL_MS);
  }

  function stopReplay(state) {
    if (state.replayTimer) {
      window.clearInterval(state.replayTimer);
      state.replayTimer = null;
    }
    clearEffect(state);
    state.player?.pause();
  }

  function initPreview(node) {
    const existing = node.__stsStaticSpineState;
    if (existing) {
      startReplay(existing);
      return;
    }

    const asset = parseAsset(node);
    if (!asset?.binaryUrl || !asset?.atlasUrl) return;

    const state = {
      node,
      asset,
      moveId: getMoveId(node),
      runtime: null,
      player: null,
      effectNode: null,
      effectPlayer: null,
      effectTimer: null,
      replayTimer: null,
      animation: asset.idleAnimation,
    };
    node.__stsStaticSpineState = state;

    loadSpineRuntime()
      .then((runtime) => {
        state.runtime = runtime;
        const monsterName = node.getAttribute("data-static-spine-monster-name") || asset.id;
        const player = new runtime.SpinePlayer(node, {
          binaryUrl: asset.binaryUrl,
          atlasUrl: asset.atlasUrl,
          animation: asset.idleAnimation,
          animations: asset.animations,
          skin: asset.skin || undefined,
          skins: asset.skins,
          alpha: true,
          backgroundColor: "00000000",
          preserveDrawingBuffer: false,
          premultipliedAlpha: false,
          showControls: false,
          showLoading: false,
          viewport: getViewport(asset),
          success: (loadedPlayer) => {
            state.player = loadedPlayer;
            applyCompositeSkin(runtime, loadedPlayer, asset, monsterName);
            const availableAnimations = loadedPlayer.skeleton?.data.animations.map((animation) => animation.name) || asset.animations || [];
            state.animation = resolveAnimation(asset, state.moveId, availableAnimations);
            setReady(node, true);
            startReplay(state);
          },
          error: (_loadedPlayer, message) => {
            console.warn(`Failed to load static Spine asset for ${monsterName}: ${message}`);
            setReady(node, false);
          },
        });
        state.player = player;
      })
      .catch((error) => {
        console.warn("Failed to initialize static Spine preview:", error);
        setReady(node, false);
      });
  }

  function boot() {
    const nodes = Array.from(document.querySelectorAll(PREVIEW_SELECTOR));
    if (nodes.length === 0) return;

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(initPreview);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const state = entry.target.__stsStaticSpineState;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            initPreview(entry.target);
          } else if (state) {
            stopReplay(state);
          }
        }
      },
      { threshold: [0, 0.35] },
    );

    nodes.forEach((node) => observer.observe(node));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
