# STS2 Modding Ecosystem (state as of 2026-10-18)

Scope note: "Local decompile" below means `sts2.dll` from the installed game (v0.111.0, commit 41cef1ea, built 2026-08-13 per `release_info.json`), decompiled with ilspycmd into a scratch dir. Class names are given so anyone can re-check them. "Local patch notes" means this repo's copies of the official Steam patch notes in `data/sts2-patch-notes/`. Facts from first-party sources (game code, Mega Crit patch notes or repos, megacrit.com) are kept apart from community claims.

Local evidence links:
- [sts2.dll v0.111.0](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/sts2.dll) (decompiled namespaces `MegaCrit.Sts2.Core.Modding`, `MegaCrit.Sts2.Core.Multiplayer*`, `MegaCrit.Sts2.Core.Nodes.Screens.ModdingScreen`)
- [release_info.json](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Resources/release_info.json)
- [sts2.runtimeconfig.json / sts2.deps.json](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/)
- [Local patch notes dir](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/)

## 1. Does STS2 have an official mod loader? How are mods discovered and loaded? What has Mega Crit said, and what changed in recent patches?

### Takeaway
Yes. STS2 has shipped a first-party mod loader since Early Access began, and Steam Workshop has been the official channel since Major Update #2 (v0.107.1, 2026-06-19). A mod is a folder holding a JSON manifest plus an optional `<id>.dll` and an optional `<id>.pck`. The loader loads the DLL into the game's own .NET context, runs Harmony (bundled with the game), and mounts the PCK through Godot's `ProjectSettings.LoadResourcePack`. Patches v0.107 to v0.111 were mostly loader polish: saves, Workshop, multiplayer hashing, and dependency/version gating.

### Cited Findings
**Official statements (first-party)**
- Major Update #2 (v0.107.1) patch notes: "We built STS2 with modding in mind, and the game has had an integrated mod loader from day one... But we purposefully haven't been advertising mod support, as we knew it still needed some work." Before this patch, the only supported install path was downloading mods and placing them next to the executable. Workshop support "has officially been added", and creators upload with Mega Crit's tool at github.com/megacrit/sts2-mod-uploader. — [wiki.gg v0.107.1 page](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.107.1_-_Major_Update_2); [local patch notes v0.107.1.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.107.1.md)
- The statement is attributed to programmer Ed Lu. v0.107.1 went live on the main branch on June 19, 2026. — [PCGamesN](https://www.pcgamesn.com/slay-the-spire-2/update-2-rng-rework-steam-workshop)
- Pre-launch, co-founder Casey Yano told Destructoid the goal was to make STS2 easy to mod with "reduced friction". Destructoid also noted it was unclear whether there would be an official mod tool. (Seen only via a search-result summary; the article was not fetched.) — [Destructoid](https://www.destructoid.com/?p=1188394)
- Mega Crit's official Workshop uploader (`megacrit/sts2-mod-uploader`) is a CLI, `ModUploader.exe`. Its workspace holds `workshop.json`, a `content/` folder ("at least a JSON file, and probably a PCK & DLL"), and `image.png` under 1 MB. `workshop.json` fields: title, description, visibility (private/public/unlisted/friends_only), changeNote, tags (the "Tools & APIs" tag is reserved), dependencies (Workshop IDs), contentDescriptors, and minBranch/maxBranch. The README itself says the branch fields "seem to have weird behavior". The repo was created 2026-06-03, has releases v0.1.0 (2026-06-18) and v0.2.0 (2026-06-26), 101 stars, no license file, and was last pushed 2026-07-06. — [megacrit/sts2-mod-uploader](https://github.com/megacrit/sts2-mod-uploader) (template README read via GitHub API)

**Loader mechanics (local decompile of v0.111.0, `MegaCrit.Sts2.Core.Modding.*`)**
- Discovery: `ModManager.Initialize` scans `<executable dir>/mods` (source `ModsDirectory`), a `mods_STEAMTEST` dir, and subscribed Steam Workshop item folders (source `SteamWorkshop`). The scan recurses into subfolders and treats every `*.json` file as a candidate manifest. A JSON file with none of id/name/author/description/version is skipped as "not a manifest". If it has some of those fields but no `id`, that is an error. — [sts2.dll](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/sts2.dll) (`ModManager.ReadModsInDirRecursive`, `ReadModManifest`)
- Manifest schema (`ModManifest` record): `id`, `name`, `author`, `description`, `version` (semver), `has_pck`, `has_dll`, `dependencies` (array of `{id, min_version}`), `affects_gameplay` (defaults to **true**), and `min_game_version`. There is no max_game_version field. The old style, dependencies as plain strings, still loads but logs a "migration required" error. — sts2.dll (`ModManifest`, `ModDependency`)
- Files must be named `<id>.dll` and `<id>.pck` and sit next to the manifest. The DLL loads with `AssemblyLoadContext.GetLoadContext(<sts2 assembly>).LoadFromAssemblyPath`, i.e. the same context as the game. The PCK loads with `ProjectSettings.LoadResourcePack`, and a failed mount throws. — sts2.dll (`ModManager.TryLoadMod`)
- Entry point: classes marked `[ModInitializer("MethodName")]` are called. If an assembly has none, the loader creates a Harmony instance with id `"<author>.<id>"` and calls `Harmony.PatchAll(assembly)`. The game ships `0Harmony.dll` and MonoMod, plus an `AssemblyResolve` hook that redirects any `0Harmony,` reference to the bundled Harmony. — sts2.dll (`ModInitializerAttribute`, `ModManager.HandleAssemblyResolveFailure`); game folder listing shows `0Harmony.dll`, `MonoMod.Backports.dll`, `MonoMod.ILHelpers.dll`
- Load order: a topological sort over dependencies (circular dependencies fail). Ties break on the user's manual order stored in settings. — sts2.dll (`ModManager.SortModList`)
- Enable/disable and consent: `ModSettings` stores `mods_enabled` (whether the player accepted the mod-loading warning popup, `NConfirmModLoadingPopup`) and `mod_list` entries `{id, source, is_enabled}`. Until the player accepts, mods get the state `Disabled`. An in-game Modding screen exists (`NModdingScreen`, `NModMenuRow`, `NModInfoContainer`). Mods cannot be loaded or unloaded at runtime: a mod added after init gets the state `AddedAtRuntime`, so a restart is required. A `nomods` launch argument skips mod init. — sts2.dll (`ModSettings`, `SettingsSaveMod`, `ModLoadState`, `ModManager.Initialize`)
- Version gating: if `min_game_version` is greater than the game version from `release_info.json`, the mod fails with `MOD_ERROR.GAME_VERSION_UNSUPPORTED`. For Workshop items, the game queries Steam UGC for each item's supported branch range. If the current branch is outside it, the game shows `STEAM_BRANCH_UNSUPPORTED` but **still loads** the mod. — sts2.dll (`ModManager.TryLoadMod`, `CheckSteamBranchSupport`)
- When the same mod id is installed both locally and from Workshop, the higher semver wins. — sts2.dll (`RemoveDisabledMods`); also [local patch notes v0.108.0](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.108.0.md) ("Steam mods now take precedence over local mods if the Steam version is greater")
- Side effects of running modded, triggered by any loaded mod including `affects_gameplay:false` ones because `IsRunningModded()` ignores that flag:
  - saves go to a separate `modded/` profile path (`UserDataPathProvider`)
  - the run-metrics upload is skipped, though mods can hook `ModManager.OnMetricsUpload` (`MetricUtilities`)
  - full debug commands are enabled in the dev console (`NDevConsole`: `shouldAllowDebugCommands = ... || ModManager.IsRunningModded()`)
  - Sentry crash reports are tagged as modded or Harmony-patched (`SentryService`)
  - a "modded" warning label is shown (`NDebugInfoLabelManager`)
  — sts2.dll
- Engine/runtime: `sts2.runtimeconfig.json` targets `net9.0` (Microsoft.NETCore.App 9.0.7). `sts2.deps.json` references `GodotSharp/4.5.1`. The game PCK header reads `GDPC`, pack format 3, engine 4.5.1. — [game data folder](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/)

**Mod-related patch-note items (official notes, local copies)**
- v0.99 (beta, exact date not in local copy): "Eliminated PCK file requirements", "Mod dependency declarations", "Native macOS arm64 support". — [local v0.99.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.99.md)
- v0.105.0 and v0.107.1: moving a `current_run.save` with a modded character back to an unmodded game now shows an error instead of a black screen. — [local v0.105.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.105.0.md)
- v0.107.0 and v0.107.1: "Base game no longer deletes progress from mods that are removed or errored". The beta fix list adds "Began publishing STS2.dll XML documentation" and "Fixed Steam mods causing ReflectionHelper.ModTypes to return nothing". — [wiki.gg v0.107.1](https://slaythespire.wiki.gg/wiki/Slay_the_Spire_2:V0.107.1_-_Major_Update_2)
- v0.108.0 ("Modding Updates"):
  - first modded launch copies unmodded saves and explains in a popup that the two sets stay separate
  - controller support for the Modding menu, plus a fix for controller navigation to the main-menu "mod settings" button
  - mods can register multiple assemblies
  - Steam versions beat local ones when their version is greater
  - the Workshop branch-support check is batched
  - XML docs are published
  - a set of multiplayer "version mismatch" fixes: content is sorted by ModelId, non-gameplay mods' content is sorted to the end of ID maps, and non-gameplay models are excluded from the hash
  - "Mega Crit still recommends using the exact same mods as your teammates, especially when those mods affect gameplay."
  — [local v0.108.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.108.0.md); covered by [The Escapist](https://www.escapistmagazine.com/news-slay-the-spire-2-beta-patch-multiplayer-cards-modding-fixes/)
- v0.109.0: `SavedPropertySerializationCache` merged into `ModelIdSerializationCache`, and "Models from non-gameplay-affecting mods are now properly excluded from the hash." — [local v0.109.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.109.0.md)
- v0.110.0: the "Report Bug" button is hidden in error dialogs when any player in the session has mods. — [local v0.110.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.110.0.md)
- v0.111.0: saves are no longer copied to the modded dir if the player declined mod loading but left mods installed. — [local v0.111.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.111.0.md)

### Inferences
- A cosmetic mod needs no third-party loader. Ship `<Id>.json` + `<Id>.dll` (Harmony patches on card rendering) + `<Id>.pck` (animated assets), or a PCK alone if pure asset replacement is enough.
- Godot's `LoadResourcePack` replaces `res://` files by default (`replace_files=true`, Godot API knowledge, not verified in the STS2 code). A mod PCK can therefore shadow base-game asset paths. That is how sprite and Spine replacement mods (e.g. Merchant2CuteII below) appear to work.
- Mega Crit treats the loader as a supported, evolving product: Workshop, an official uploader, XML docs, multiplayer-aware mod hashing. That lowers the risk of the loader being removed. The API surface (sts2.dll internals) is still unstable during Early Access.

### Gaps
- Release dates for v0.99, v0.108 to v0.110 are not in the local copies and were not verified online. v0.111.0's build date is 2026-08-13 (`release_info.json`).
- No official modding documentation site was found, beyond patch notes, XML docs, and the uploader README. Official Discord announcements were not accessible.
- Whether Steam achievements are disabled when modded was not checked; no achievement and ModManager link turned up in a quick grep.

## 2. Which community frameworks exist, who maintains them, how active are they, and which Godot/.NET versions do they target?

### Takeaway
The de facto standard is **BaseLib** (Alchyr) plus the **ModTemplate-StS2** dotnet templates. Both are very active through October 2026 and target Godot 4.5.1 (Mega Crit's "MegaDot" fork) and .NET 9. Harmony is not a separate install, because the game bundles it. RitsuLib is a second, newer library. There is no "ModTheSpire" equivalent, because the base game is its own loader.

### Cited Findings
- **BaseLib-StS2** (Alchyr): "Mod for Slay the Spire 2 to standardize content additions", meant as a dependency for other mods. Players install the `.dll`, `.pck` and `.json` into `Slay the Spire 2/mods`. Developers add it via NuGet `Alchyr.Sts2.BaseLib`. It has a wiki at alchyr.github.io/BaseLib-Wiki. License MIT, 459 stars, 92 forks, about 1,089 commits. — [GitHub](https://github.com/Alchyr/BaseLib-StS2); [NuGet](https://www.nuget.org/packages/Alchyr.Sts2.BaseLib)
- Activity: repo created 2026-03-05, last push 2026-10-07. Releases v3.4.1 (2026-07-31), v3.4.4 (08-06), v3.4.5 (08-14), v3.4.6 (09-10), v3.4.7 (09-11). The manifest at HEAD has `"min_game_version": "0.107.1"` and `"affects_gameplay": false`. Its build files include `project.godot`, `export_presets.cfg`, `Sts2PathDiscovery.props` and `build/BaseLib.props`. No `.github/` workflows were found at HEAD. — [GitHub API, BaseLib](https://github.com/Alchyr/BaseLib-StS2)
- **ModTemplate-StS2** (Alchyr): `dotnet new` templates for an empty mod, a content mod and a character mod, with BaseLib as a dependency. "Put solution and project in same directory" is required for Godot. Created 2026-03-06, last push 2026-10-16, 304 stars. — [GitHub](https://github.com/Alchyr/ModTemplate-StS2)
- Template build specifics (ContentMod.csproj):
  - `Sdk="Godot.NET.Sdk/4.5.1"` with `TargetFramework net9.0`
  - references `0Harmony.dll` and `sts2.dll` from the local game install, discovered by `Sts2PathDiscovery.props`, with `Private=false`
  - optional `Krafs.Publicizer` to access private members of sts2
  - NuGet `Alchyr.Sts2.BaseLib` and `Alchyr.Sts2.ModAnalyzers`
  - optional `BSchneppe.StS2.PckPacker` ("Generates a .pck file when building if only using simple assets. May not work on all setups.")
  - post-build targets that copy the dll, json and pdb (and the quick-packed pck) into the game's `mods/<Project>/`
  — [ModTemplate content/ContentModTemplate/ContentMod.csproj](https://github.com/Alchyr/ModTemplate-StS2)
- Template `Directory.Build.props`: "Megadot current version is 4.5.1, and the game won't load your .pck if the Godot version used is newer." `GodotPath` points to a MegaDot 4.5.1 mono executable "used for export-pack when publishing", with Win, Linux and Mac example paths. — [ModTemplate](https://github.com/Alchyr/ModTemplate-StS2)
- **MegaDot** is described as a "MegaCrit fork of the Godot Engine" (AUR package `megadot` 4.5.1_m.9, upstream megadot.megacrit.com, depends on dotnet-sdk-9.0, first submitted March 2026). — [AUR](https://aur.archlinux.org/packages/megadot). Mega Crit is a Godot sponsor and moved to Corporate Platinum in April 2026. — [GamingOnLinux](https://gamingonlinux.com/2026/04/godot-gets-a-funding-boost-from-slay-the-spire-2-devs-mega-crit)
- **STS2.RitsuLib** (NuGet, latest seen 0.5.4) is an alternative library that "sits beside" the base API and BaseLib without conflict. Some mods are built on it, e.g. `LuoTianOrange/STS2_WineFox`, and `NothingFumo/RitsuLibModTemplate` is a template. — [NuGet](https://www.nuget.org/packages/STS2.RitsuLib); [GitHub search](https://github.com/search?q=sts2+mod&type=repositories)
- **ModConfig-STS2** (xhyrzldf): "Universal Mod Configuration Framework... Injects a Mods tab into game settings". 31 stars, last push 2026-04-18, which may be stale. — [GitHub](https://github.com/xhyrzldf/ModConfig-STS2)
- Other dev tooling:
  - `L4ntern0/SlaytheSpire2-ModScaffold`, a "one-click setup (.NET 10, Godot, ILSpy MCP...)"
  - `elliotttate/sts2-modding-mcp`, an MCP server for mod code generation
  - `GlitchedReme/SlayTheSpire2ModdingTutorials`, 206 stars
  — [GitHub search](https://github.com/search?q=slay+the+spire+2+mod&type=repositories)
- Community claim (low confidence): some SEO guide sites say BepInEx is "the most common" framework for STS2 code mods. — [WiseGuyGaming](https://wiseguygaming.com/slay-the-spire-2-mods/); [discovermods](https://discovermods.com/guides/slaythespire2/install/). This is **not corroborated**: the templates and all repos inspected use the built-in loader and bundled Harmony.

### Inferences
- For a cosmetic mod, BaseLib is optional. Depending on it adds a hard dependency that players must install, and it is itself frequently re-released. A self-contained mod (built-in loader, raw Harmony) is the lighter option. BaseLib or ArtRoller would only be worth it if their card-art hooks save real work.
- The toolchain is pinned to Godot/MegaDot 4.5.1 + .NET 9 SDK. PCKs exported with a newer Godot will not load, per the template comment.

### Gaps
- MegaDot's diff from upstream Godot 4.5.1, and whether stock Godot 4.5.1 mono exports compatible PCKs, are unverified. The template implies MegaDot or Godot 4.5.1 both work.
- Exact HarmonyX version: the SLS2Mods README claims "HarmonyX 2.4.2" (community claim, not verified from `0Harmony.dll` metadata).

## 3. Distribution channels, mod counts, popular categories, and card-art precedents

### Takeaway
Steam Workshop (official since 2026-06-19) and Nexus Mods are the two main channels. GitHub Releases is used for source and manual installs. No Thunderstore community exists. No authoritative total mod count was found. GitHub has about 700 to 865 STS2 mod repos, and Nexus IDs exceed 1,490. Cosmetic mods (animations, skins) are among the most popular Workshop items, and several card-art or card-visual mods already exist.

### Cited Findings
- Workshop browse tags visible: **Cosmetics, Utility, Expansion**. Top "Most Popular" items include:
  - More Defect Animations (Cosmetics, 688 ratings) and More Ironclad / Necrobinder / Silent Animations (Cosmetics)
  - Couch Co-op (Utility, 601)
  - KaguyaSilentRavenSkin (2,715 ratings)
  - 劣人TV之尖塔MOD (4,556 ratings)
  - Draw & Guess (Expansion, 785)
  - several "X As Depicted" items
  — [Steam Workshop STS2](https://steamcommunity.com/app/2868840/workshop/) (fetched 2026-10-18; no total item count shown)
- "As Depicted" series by KineticKinkajou: Bullet Time, Perfected Strike, Crash Landing, Osty, Voltaic and Whistle As Depicted. These appear to be client-side visual mods tied to specific cards, e.g. Osty "the way they were supposed to be: Poke, Pull Aggro, Bone Shards, Fetch". The exact mechanism was not verified. — [Workshop collection "Slay 2 Client side mods"](https://steamcommunity.com/sharedfiles/filedetails/?id=3747911499)
- Nexus Mods hosts STS2 mods at nexusmods.com/slaythespire2. Mod IDs observed go up to at least 1494 (Relic Picker). The listing page returned HTTP 403 to the fetcher, so no count. — [Nexus Relic Picker](https://www.nexusmods.com/slaythespire2/mods/1494). A Vortex extension exists. — [Nexus Vortex extension](https://www.nexusmods.com/site/mods/1727)
- Third-party mod managers: `MohamedSerhan/sts2-mod-manager` (modpacks, GitHub release mods, Nexus watching, Workshop refs) and `wakaka6/SlaySP2Manger` (multi-preset, Nexus integration, save sync). — [STS2 Mod Manager](https://mohamedserhan.github.io/sts2-mod-manager/); [GitHub search](https://github.com/search?q=slay+the+spire+2+mod&type=repositories)
- Thunderstore: the community list from `thunderstore.io/api/experimental/community/` contains no community matching "spire", and `thunderstore.io/c/slay-the-spire-2/` returns 404. — [Thunderstore API](https://thunderstore.io/api/experimental/community/) (queried 2026-10-18)
- Aggregator sts2.gg lists mods (IDs above 1,300) and says "Mods are only available on Steam... not distributed on Epic or other stores". — [sts2.gg install guide](https://sts2.gg/mods/install-guide)
- GitHub repository search on 2026-10-18 via the GitHub API: "sts2 mod" returned 865 repos and "slay the spire 2 mod" returned 722. Top repos by stars:
  - STS2MCP (525, agent/MCP)
  - BaseLib (459)
  - STS2-Agent (338)
  - ModTemplate (304)
  - Quick-Restart (160)
  - RMP 4+ player lobby (142)
  - Game-Lobby (107)
  - Minty-Spire-2 QoL (106)
  - merchant-2-cute-ii cosmetic (103)
  - megacrit/sts2-mod-uploader (101)
  — [GitHub search](https://github.com/search?q=sts2+mod&type=repositories)
- Popular categories seen on GitHub: QoL (quick restart, undo/redo, route suggest), multiplayer extensions (bigger lobbies, direct IP, chat, damage meters), AI/MCP agent bridges, RNG prediction, new characters and content, and cosmetics. A large share of repos are Chinese-language. — [GitHub search](https://github.com/search?q=sts2+mod&type=repositories)
- **Card-art / card-visual precedents:**
  - `Shadowfall-Team/ArtRoller`, created 2026-09-28 and last pushed 2026-10-11: a tool "to recolor, mirror and re-art any card", with a Compendium editor for players and a shared library for modders, "rendering changes at runtime rather than needing to ship altered arts as image assets". Requires BaseLib. — [GitHub](https://github.com/Shadowfall-Team/ArtRoller)
  - `shuyang-huang/sts2_mod_CardsWithAncientSkin`: a visual-only mod that "hooks into the real in-game card render flow through Harmony patches" and reads portraits, borders and config from a `resources` folder, without changing card behavior. — [GitHub](https://github.com/shuyang-huang/sts2_mod_CardsWithAncientSkin)
  - A Necrobinder card-art pack on Nexus (seen only in search results, details unverified). — [search result: Nexus](https://www.nexusmods.com/slaythespire2/mods/883)
- **Cosmetic asset-replacement precedent:** `LinXce/merchant-2-cute-ii` (103 stars) replaces the merchant's Spine animations by shipping `.skel`, `.atlas` and `.tres` assets in a PCK plus a DLL. Its manifest has `"affects_gameplay": false`, and its README discloses "本项目的贴图基于AI生成并进行了部分修改" (textures are AI-generated, partly modified). — [GitHub](https://github.com/LinXce/merchant-2-cute-ii)

### Inferences
- Demand for cosmetic and animation mods is proven: the top Workshop items include "More X Animations". At least two card-render-hooking mods show that patching card visuals with Harmony works on current builds. An animated-card-art mod would be new in degree (animation), not in kind.
- Workshop is the default for reaching players (auto-update, branch checks). Nexus and GitHub Releases are secondary or complementary.

### Gaps
- No total counts for Workshop or Nexus. The Workshop page shows none, and Nexus blocked the fetch. Subscriber numbers for top items were not visible, only rating counts.
- Mechanism of the "As Depicted" and "More X Animations" mods was not verified (whether they animate card portraits or character/VFX).

## 4. How often do patches break mods during Early Access, and how do modders cope?

### Takeaway
Breakage is real and recurring, especially on beta-branch patches and for mods that patch private internals. Coping mechanisms are mostly in the platform (`min_game_version`, dependency `min_version`, Workshop min/max branch, published XML docs) plus fast re-releases. No formal compatibility shim layer was found.

### Cited Findings
- A Steam thread reports that after the 2026-03-18 hotfix the mods folder stopped triggering "load with mods", and many mods needed author updates after a base library update. — [Steam discussion "mods no longer functional after hotfix?"](https://steamcommunity.com/app/2868840/discussions/0/798964766335869993/)
- sts2.gg guide: "Game updates can break mods. Beta patches frequently break older mods, especially Baselib." — [sts2.gg install guide](https://sts2.gg/mods/install-guide)
- Workshop guide: a mod that works on v0.107.1 can break on the next patch until updated. If crashes start after an update, disable the mod and check for updates. — [bossdown](https://bossdown.com/guides/slay-the-spire-2-steam-workshop-mods/)
- Concrete example: the Merchant2CuteII changelog v1.5.1 (2026-07-04) says "修复了108版本的bug" (fixed a bug with game version 0.108). — [GitHub](https://github.com/LinXce/merchant-2-cute-ii)
- BaseLib shipped 5 releases between 2026-07-31 and 2026-09-11, which suggests frequent compatibility churn. — [GitHub releases](https://github.com/Alchyr/BaseLib-StS2)
- Loader-side churn: the dependency format changed to `{id, min_version}`, and the old format now logs a "migration required" error. The multiplayer ID-hash rules changed across v0.108.0 and v0.109.0. — sts2.dll (`ModManifest.ReadFromStream`); [local v0.108.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.108.0.md); [local v0.109.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.109.0.md)
- Platform coping tools:
  - `min_game_version` hard gate (sts2.dll)
  - Workshop minBranch/maxBranch, a warning only, and the uploader README calls it flaky
  - dependency `min_version`
  - Steam-vs-local version precedence
  - official XML docs for sts2.dll since about v0.107.1/v0.108.0
  — sts2.dll; [megacrit/sts2-mod-uploader](https://github.com/megacrit/sts2-mod-uploader); [local v0.108.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.108.0.md)
- Templates compile against the user's locally installed `sts2.dll`, not a pinned reference assembly, and optionally publicize private members (Krafs.Publicizer). — [ModTemplate](https://github.com/Alchyr/ModTemplate-StS2)

### Inferences
- A cosmetic mod that Harmony-patches card-rendering nodes (`NCard` and similar) is exposed to UI refactors. Mega Crit keeps updating card portrait art and VFX in patches; v0.110.0 shipped "polished portrait art for several cards". Budget for per-patch smoke tests and quick re-releases. Pinning `min_game_version` to the tested version guards against old game versions but not newer ones, since there is no max field. So CI should build against the current game DLL after each patch.
- Animations keyed to specific card IDs or portrait paths can silently go stale when Mega Crit replaces art. A data-driven manifest (card id → animation asset) plus a fallback to static art reduces breakage.

### Gaps
- No quantitative data on what share of mods break per patch.
- No community "compat layer" project found beyond BaseLib/RitsuLib abstractions.

## 5. How do STS2 modders structure repos (one repo per mod vs monorepo), and what build tooling and CI do they use?

### Takeaway
One repo per mod is the norm: Alchyr, erasels and most Chinese authors do this. Multi-mod monorepos exist, and `luojiesi/SLS2Mods` is the clearest example: per-mod csproj and manifest folders, shared tooling, and packaged release zips. Builds use `dotnet build` against the local `sts2.dll` plus a MegaDot/Godot 4.5.1 `--export-pack`, or the PckPacker NuGet, for the PCK. CI is uncommon because building needs the proprietary game DLLs.

### Cited Findings
- **Monorepo example**, `luojiesi/SLS2Mods`: "A collection of quality-of-life mods for Slay the Spire 2 (Godot 4.5.1 / C# / .NET 9.0), using HarmonyX 2.4.2". Layout:
  - top-level folders per mod (`QuickRestart/`, `RngPredictor/`, `SpeedUp/`, `UndoAndRedo/`, `UnifiedSavePath/`, `UpgradeAllCards/`), each with its own `<Mod>.csproj` and `<Mod>.json` manifest
  - `nexus_packages/*.zip` and `nexus_packages/workshop/<Mod>/` upload workspaces
  - a shared `tools/WorkshopUploader/` csproj with `steam_appid.txt`
  - UndoAndRedo is published on Workshop (id 3801936266) and also on Nexus (`nexusmods_description.bbcode`)
  — [GitHub luojiesi/SLS2Mods](https://github.com/luojiesi/SLS2Mods)
- Another collaborative multi-module repo: `DragonHuMaggotJiang/sts2-card-mechanics-mod` ("Collaborative modular card and mechanics mod"). — [GitHub search](https://github.com/search?q=sts2+card+art+OR+portrait+mod&type=repositories)
- Per-mod repos: Alchyr ships BaseLib, ModTemplate and Oddmelt as separate repos. erasels ships StS2-Quick-Restart and Minty-Spire-2 separately. — [GitHub search](https://github.com/search?q=slay+the+spire+2+mod&type=repositories)
- Template project layout: `<Mod>.csproj`, `<Mod>.json`, `project.godot`, `export_presets.cfg`, `Directory.Build.props` (GodotPath), `Sts2PathDiscovery.props`, a code folder `<Mod>Code/`, and an assets folder `<Mod>/` (`images/card_portraits/big`, `localization/eng/*.json`, and so on), plus a `.template.config`. — [ModTemplate](https://github.com/Alchyr/ModTemplate-StS2)
- Some repos commit build outputs. Merchant2CuteII commits `Merchant2CuteII.dll`, `.pck` and a `-sfw.pck` variant alongside the sources. — [GitHub](https://github.com/LinXce/merchant-2-cute-ii)
- Release practice: BaseLib uses GitHub Releases (dll + pck + json) and a NuGet package. The official uploader repo has `.github/workflows`. No workflows were found at BaseLib HEAD. — [BaseLib](https://github.com/Alchyr/BaseLib-StS2); [megacrit/sts2-mod-uploader](https://github.com/megacrit/sts2-mod-uploader)
- The game also offers `ModManager.AssociateAssemblyWithMod` for mods that create dynamic assemblies. Since v0.108.0, multiple assemblies per mod are supported. — sts2.dll; [local v0.108.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.108.0.md)

### Inferences
- A monorepo hosting several mods is a proven pattern. Recommended shape, mirroring SLS2Mods and the template:
  - `mods/<ModId>/` holding `<ModId>.csproj`, `<ModId>.json`, `project.godot`, `export_presets.cfg`, code and assets
  - a shared `Directory.Build.props` at the repo root for GodotPath, Sts2Path and common references
  - an optional `shared/` class library, compiled into each mod or shipped as a separate dependency mod with its own manifest
  - per-mod Workshop workspaces (`workshop.json`, `image.png`, `mod_id.txt`)
  
  Each mod must keep a unique `id` and file names `<id>.dll`/`<id>.pck`, because the loader requires this.
- A shared library across your own mods must either be compiled into each DLL, risking type duplication if two of your mods ship the same types, or published as its own mod listed in `dependencies`.
- CI on GitHub-hosted runners cannot legally fetch `sts2.dll`/`0Harmony.dll`, which are proprietary. Options: a self-hosted runner with the game installed, or committing generated reference assemblies (legal gray area, not observed). Local build + manual upload is the norm.
- Large animated assets (video, sprite sheets) argue against committing them raw. Use Git LFS or keep source assets out of the repo; no STS2 precedent was checked.

### Gaps
- Did not inspect any CI workflow YAML that builds an STS2 mod end to end.
- Did not verify how ArtRoller or CardsWithAncientSkin structure their builds.

## 6. Mega Crit's mod/IP policy: mods, reuse of game assets, monetization, generative AI

### Takeaway
Mega Crit's public Content Policy explicitly permits mods. They must not be plagiarized or "discriminatorily offensive" and must not claim affiliation. Donations are OK, but paywalls and other monetization are not. Generative AI is banned explicitly only for **merchandise and Gallery art**, not for mods. The studio's own stance is strongly anti-generative-AI for art. No clause found addresses altering game art inside mods; community mods routinely reuse it.

### Cited Findings
- Content Policy (megacrit.com; site built 2026-09-28, no policy date):
  - "You have permission to create mods for our games as long as they are not plagiarized or discriminatorily offensive"
  - "do not state or suggest that your mod is officially affiliated with Mega Crit"
  - mods must follow the hosting platform's terms
  - donations for modding are allowed, but other monetization, including paywalled mod content and stretch-goal fundraising, is not
  — [Mega Crit Content Policy](https://www.megacrit.com/content-policy)
- Same policy: merchandise by small creators must use original art, "not plagiarized, made with generative AI, or taken from the game or marketing materials". Gallery submissions must not be AI-made. This was read through a summarizing fetch; the exact wording should be re-checked on the page. — [Mega Crit Content Policy](https://www.megacrit.com/content-policy)
- Studio stance: Casey Yano said Mega Crit uses deliberately rough hand-drawn placeholder art instead of generative AI ("Choosing 'Shit' Art Over Generative AI"). Seen via search summaries only. — [GameSpot](https://www.gamespot.com/articles/slay-the-spire-2-is-choosing-shit-art-over-generative-ai/); [VGTimes](https://vgtimes.com/gaming-news/161131-slay-the-spire-2-devs-defend-rough-placeholder-art-and-reject-generative-ai.html)
- Community practice: the Relic Picker mod on Nexus says its relic icons are game assets "used under Mega Crit's Content Policy" and discloses AI-made preview images. Merchant2CuteII discloses AI-generated textures and is hosted on GitHub. Neither shows evidence of enforcement action. — [Nexus Relic Picker](https://www.nexusmods.com/slaythespire2/mods/1494); [GitHub merchant-2-cute-ii](https://github.com/LinXce/merchant-2-cute-ii)
- The Workshop uploader supports content descriptors (nudity, etc.). Its README has no content rules about assets or AI. — [megacrit/sts2-mod-uploader](https://github.com/megacrit/sts2-mod-uploader)

### Inferences
- An animated-card-art mod that derives from Mega Crit's own card art (animating the existing illustrations) fits the "mods are permitted" clause, provided it is free, non-affiliated, and not plagiarizing third-party art. Raw redistribution of extracted art is an untested gray area. The safest design ships only deltas: animation rigs, masks, shader parameters, or effect layers that read the game's own textures at runtime, as ArtRoller does.
- Generative-AI animation of card art is not prohibited for mods by written policy. It does run against the studio's publicly stated values and could draw community backlash, especially on Workshop. Hand-made or procedural (shader, Spine, parallax) animation is lower risk. Disclose any AI use.
- Monetization: donations only. No paid tiers, early access, or Patreon-gated builds.

### Gaps
- Full verbatim Content Policy text (the fetch tool limits quotes) and any separate EULA clause on reverse engineering were not checked. Re-read megacrit.com/content-policy and the Steam EULA directly before publishing.
- No official statement found specifically on AI-generated content in mods or on redistributing modified game art.

## 7. Are multiplayer/co-op sessions affected by client-only cosmetic mods?

### Takeaway
They aren't, as long as the manifest sets `"affects_gameplay": false`. Since v0.108/v0.109 the handshake only blocks on mismatched **gameplay-affecting** mod lists and on the content-ID hash, and non-gameplay mods are excluded from both. A non-gameplay mismatch is only logged. The flag defaults to `true`, so omitting it would block co-op with vanilla players.

### Cited Findings
- `PeerVersionInfo` (sent in the handshake) carries `version`, `branch`, `idDatabaseHash`, `gameplayAffectingMods` and `otherMods`. — sts2.dll (`MegaCrit.Sts2.Core.Multiplayer.PeerVersionInfo`)
- `HandshakeManager` order of checks:
  1. exact game version must match
  2. gameplay-affecting mod lists must match both ways, otherwise `HandshakeStatus.ModMismatch` with a "missingOnHost/missingOnLocal" popup
  3. `idDatabaseHash` must match, otherwise VersionMismatch
  4. a non-gameplay mod mismatch only logs: "This is allowed, but it's up to the mod authors to guarantee that it doesn't break anything."
  — sts2.dll (`MegaCrit.Sts2.Core.Multiplayer.Connection.HandshakeManager`, `ConnectionFailureExtraInfo`, `NetErrorInfo`)
- `ModelIdSerializationCache` hashes only content from mods whose `affects_gameplay` is true. Non-gameplay mods' types are sorted to the end and excluded from the hash. — sts2.dll; [local v0.108.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.108.0.md); [local v0.109.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.109.0.md)
- `ModManifest.affectsGameplay` defaults to `true`, and `GetGameplayRelevantModNameList` treats a missing manifest the same way (`m.manifest?.affectsGameplay ?? true`). — sts2.dll (`ModManifest`, `ModManager`)
- Mega Crit "still recommends using the exact same mods as your teammates, especially when those mods affect gameplay." — [local v0.108.0.md](file:///Users/flavono123/P/scare-the-spire/data/sts2-patch-notes/v0.108.0.md)
- Cosmetic precedents set the flag to false: BaseLib (`"affects_gameplay": false`) and Merchant2CuteII (`"affects_gameplay": false`). — [BaseLib.json](https://github.com/Alchyr/BaseLib-StS2); [Merchant2CuteII.json](https://github.com/LinXce/merchant-2-cute-ii)
- `NetMessageBus` has a modded-only branch for custom message types (`IsRunningModded() && b >= MessageTypes.Count`), so mods can add net messages. A cosmetic mod should not. — sts2.dll (`MegaCrit.Sts2.Core.Multiplayer.NetMessageBus`)

### Inferences
- A cosmetic animated-card-art mod is co-op safe if it (a) sets `affects_gameplay: false`, (b) registers no new ModelDb content (cards, relics, powers) or SavedProperties, and (c) sends no net messages. Each player can run it alone without desync, because card art is rendered locally and not synchronized.
- Even with `affects_gameplay:false`, players running it are "modded". They get the separate modded save profile (saves are copied on first launch), no metrics upload, the full dev console, and no in-game "Report Bug" button. Tell users this up front.

### Gaps
- Not tested empirically, i.e. no co-op session was run with mismatched cosmetic mods.
- Not checked: whether Steam achievements and leaderboards (daily climb) are restricted when modded.
