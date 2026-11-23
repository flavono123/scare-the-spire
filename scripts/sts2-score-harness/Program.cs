// Ground truth for src/lib/sts2/run-score.ts (scripts/sts2-run-score.check.ts compares the two).
// Usage (needs the .NET 9 SDK; GameDir defaults to ~/sts2-builds/0.113.0/...data_sts2_macos_arm64):
//   dotnet run -c Release --project scripts/sts2-score-harness -- <dir-or-.run-file>... > harness.jsonl
//   dotnet run -c Release --project scripts/sts2-score-harness -- --models > models.json
// One JSON line per run file, loaded through the game's MigrationManager (schema migrations included): the game's
// ScoreUtility score and score-line numbers, the badges the game recorded in the file, and ScoreUtility.GetBadges run
// on a SerializableRun rebuilt from the history. Headless: see HeadlessPatches. Non-JSON lines may precede the output
// (the game's Sentry module initializer prints one).
using System.Reflection;
using HarmonyLib;
using System.Text.Json;
using System.Text.Json.Nodes;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Multiplayer.Serialization;
using MegaCrit.Sts2.Core.Runs;
using MegaCrit.Sts2.Core.Runs.History;
using MegaCrit.Sts2.Core.Saves;
using MegaCrit.Sts2.Core.Saves.Migrations;
using MegaCrit.Sts2.Core.Saves.Runs;

var files = args.Where(a => !a.StartsWith("--")).SelectMany(a => Directory.Exists(a) ? Directory.GetFiles(a, "*.run") : new[] { a }).OrderBy(f => f).ToList();
HeadlessPatches.Apply();
var migrations = new MigrationManager(new ReadOnlyStore());
// CalculateScore(SerializableRun) only forwards these fields, so call its private overload with the history's.
var calculate = typeof(ScoreUtility).GetMethod("CalculateScore", BindingFlags.NonPublic | BindingFlags.Static)!;
string? modelDbError = null;
// OneTimeInitialization's model boot, minus Godot: ModelDb, then the id cache, then ids.
try
{
    MegaCrit.Sts2.Core.Modding.AssemblyInfo.Init();
    ModelDb.Init();
    ModelIdSerializationCache.Init();
    ModelDb.InitIds();
}
catch (Exception e) { modelDbError = (e.InnerException ?? e).GetType().Name + ": " + (e.InnerException ?? e).Message; }

var stdout = Console.Out;
if (args.Contains("--models"))
{
    // The model facts the badges read, for checking the TypeScript port's data tables.
    stdout.WriteLine(new JsonObject
    {
        ["modelDbError"] = modelDbError,
        ["cards"] = new JsonObject(ModelDb.All.OfType<CardModel>()
            .Select(c => KeyValuePair.Create(c.Id.Entry, (JsonNode?)new JsonObject { ["type"] = c.Type.ToString(), ["rarity"] = c.Rarity.ToString(), ["multiplayer"] = c.MultiplayerConstraint.ToString() }))),
        ["characters"] = new JsonObject(ModelDb.All.OfType<CharacterModel>().Select(c => KeyValuePair.Create(c.Id.Entry, (JsonNode?)c.StartingHp))),
    }.ToJsonString());
    return;
}
Console.SetOut(TextWriter.Null); // the game's Log writes to stdout; keep it out of the JSON lines
foreach (var file in files)
{
    var line = new JsonObject { ["file"] = Path.GetFileName(file) };
    try
    {
        var loaded = migrations.LoadSave<RunHistory>(file);
        line["status"] = loaded.Status.ToString();
        var h = loaded.SaveData ?? throw new Exception("load failed: " + loaded.ErrorMessage);
        var history = h.MapPointHistory;
        line["score"] = (int)calculate.Invoke(null, new object[] { history, h.Ascension, h.GameMode, h.Win, h.Players.Count })!;
        line["floors"] = ScoreUtility.GetScoreForFloor(history);
        line["goldPoints"] = ScoreUtility.GetScoreForGoldGained(history, h.Players.Count);
        line["elites"] = ScoreUtility.GetElitesKilledCount(history);
        line["bosses"] = ScoreUtility.GetBossesSlainCount(history, h.Win);
        var run = modelDbError == null ? Rebuild(h) : null;
        var players = new JsonArray();
        foreach (var p in h.Players)
        {
            var po = new JsonObject
            {
                ["id"] = p.Id,
                ["recorded"] = Badges(p.Badges.Select(b => (b.Id, b.Rarity.ToString()))),
            };
            if (run != null)
            {
                try
                {
                    // RunHistoryUtilities.GetBadgesForPlayer: abandoned runs record no badges.
                    var got = h.WasAbandoned ? new() : ScoreUtility.GetBadges(run, p.Id, h.Win);
                    po["computed"] = Badges(got.Select(b => (b.Id, b.Rarity.ToString())));
                }
                catch (Exception e) { po["computedError"] = e.GetType().Name + ": " + e.Message; }
            }
            players.Add(po);
        }
        line["players"] = players;
        if (modelDbError != null) line["modelDbError"] = modelDbError;
    }
    catch (Exception e) { line["error"] = (e.InnerException ?? e).ToString().Split('\n')[0]; }
    stdout.WriteLine(line.ToJsonString());
}

static JsonArray Badges(IEnumerable<(string id, string rarity)> badges) =>
    new(badges.OrderBy(b => b.id, StringComparer.Ordinal).Select(b => (JsonNode)new JsonObject { ["id"] = b.id, ["rarity"] = b.rarity }).ToArray());

// The run-end SerializableRun fields the badges read that a history keeps: deck, relics, character, the last
// map point's gold and max HP, and run_time (RunHistoryUtilities writes WinTime there on a win). ExtraFields is not
// in a history; only CCCCOMBO, DAMAGE_LEADER and DEBUFFER read it, so it is set back from the badges the file recorded
// (the recorded leader gets 1 damage/debuff, everyone else 0).
static SerializableRun Rebuild(RunHistory h)
{
    var last = h.MapPointHistory.LastOrDefault()?.LastOrDefault();
    return new SerializableRun
    {
        MapPointHistory = h.MapPointHistory,
        Ascension = h.Ascension,
        GameMode = h.GameMode,
        WinTime = h.Win ? (long)h.RunTime : 0,
        RunTime = (long)h.RunTime,
        Players = h.Players.Select(p =>
        {
            var stats = last?.PlayerStats.FirstOrDefault(s => s.PlayerId == p.Id);
            return new SerializablePlayer
            {
                NetId = p.Id,
                CharacterId = p.Character,
                Deck = p.Deck.ToList(),
                Relics = p.Relics.ToList(),
                Potions = p.Potions.ToList(),
                Gold = stats?.CurrentGold ?? 0,
                MaxHp = stats?.MaxHp ?? 0,
                CurrentHp = stats?.CurrentHp ?? 0,
                ExtraFields = new SerializableExtraPlayerFields
                {
                    CccomboBadgeUnlocked = p.Badges.Any(b => b.Id == "CCCCOMBO"),
                    DamageDealt = p.Badges.Any(b => b.Id == "DAMAGE_LEADER") ? 1 : 0,
                    DebuffsApplied = p.Badges.Any(b => b.Id == "DEBUFFER") ? 1 : 0,
                },
            };
        }).ToList(),
    };
}

// Headless workaround: the game's Logger static constructor asks Godot's OS for the command line and its printer
// calls GD.Print; without a running engine both are native calls that segfault. Harmony (shipped with the game for
// mods) swaps the two for managed no-ops before anything logs.
static class HeadlessPatches
{
    public static void Apply()
    {
        var harmony = new HarmonyLib.Harmony("scare-the-spire.score-harness");
        var skip = new HarmonyLib.HarmonyMethod(typeof(HeadlessPatches), nameof(Skip));
        harmony.Patch(AccessTools.Method(typeof(MegaCrit.Sts2.Core.Logging.Logger), "GetIsRunningFromGodotEditor"),
            prefix: new HarmonyLib.HarmonyMethod(typeof(HeadlessPatches), nameof(NotEditor)));
        harmony.Patch(AccessTools.Method(typeof(MegaCrit.Sts2.Core.Logging.ConsoleLogPrinter), "Print"), prefix: skip);
        // No mod loader runs, so ModelDb.Init's ReflectionHelper.ModTypes would throw; there are no mod types.
        harmony.Patch(AccessTools.PropertyGetter(typeof(MegaCrit.Sts2.Core.Helpers.ReflectionHelper), "ModTypes"),
            prefix: new HarmonyLib.HarmonyMethod(typeof(HeadlessPatches), nameof(NoModTypes)));
        harmony.Patch(AccessTools.Method(typeof(MigrationRegistry), nameof(MigrationRegistry.RegisterAllMigrations)),
            prefix: new HarmonyLib.HarmonyMethod(typeof(HeadlessPatches), nameof(RunHistoryMigrationsOnly)));
    }

    // Other save types' migrations build Godot StringNames (SettingsSave controller keys) in their constructors.
    static bool RunHistoryMigrationsOnly(MigrationManager manager)
    {
        for (int i = 0; i < IMigrationSubtypes.Count; i++)
        {
            var type = IMigrationSubtypes.Get(i);
            if (type.GetCustomAttribute<MigrationAttribute>()?.SaveType == typeof(RunHistory))
                manager.RegisterMigration((IMigration)Activator.CreateInstance(type)!);
        }
        return false;
    }
    static bool NotEditor(ref bool __result) { __result = false; return false; }
    static bool Skip() => false;
    static bool NoModTypes(ref Type[] __result) { __result = Type.EmptyTypes; return false; }
}

// MigrationManager's only file access: reads the history file, never writes (no corrupt-file copies).
sealed class ReadOnlyStore : ISaveStore
{
    public string? ReadFile(string path) => File.Exists(path) ? File.ReadAllText(path) : null;
    public Task<string?> ReadFileAsync(string path) => Task.FromResult(ReadFile(path));
    public void WriteFile(string path, string content) { }
    public void WriteFile(string path, byte[] content) { }
    public Task WriteFileAsync(string path, string content) => Task.CompletedTask;
    public Task WriteFileAsync(string path, byte[] content) => Task.CompletedTask;
    public bool FileExists(string path) => File.Exists(path);
    public bool DirectoryExists(string path) => Directory.Exists(path);
    public void DeleteFile(string path) { }
    public void RenameFile(string sourcePath, string destinationPath) { }
    public string[] GetFilesInDirectory(string directoryPath) => Directory.GetFiles(directoryPath);
    public string[] GetDirectoriesInDirectory(string directoryPath) => Directory.GetDirectories(directoryPath);
    public void CreateDirectory(string directoryPath) { }
    public void DeleteDirectory(string directoryPath) { }
    public void DeleteTemporaryFiles(string directoryPath) { }
    public DateTimeOffset GetLastModifiedTime(string path) => File.GetLastWriteTimeUtc(path);
    public int GetFileSize(string path) => (int)new FileInfo(path).Length;
    public void SetLastModifiedTime(string path, DateTimeOffset time) { }
    public string GetFullPath(string filename) => Path.GetFullPath(filename);
}
