using System.Text.Json;

namespace ETS2LA.StreamDeck.Bridge;

public sealed record GameState
{
    public bool GameRunning { get; set; }
    public bool Paused { get; set; }
    public bool TelemetryFresh { get; set; }
    public bool AssistsEnabled { get; set; }
    public string DrivingMode { get; set; } = "full";
    public bool AccAvailable { get; set; }
    public bool LaneAvailable { get; set; }
    public float SpeedKph { get; set; }
    public float TargetSpeedKph { get; set; }
    public float? RoadLimitKph { get; set; }
    public float MaximumSpeedKph { get; set; }
    public float FallbackSpeedKph { get; set; } = 30;
    public bool RoadLimitEnabled { get; set; }
    public string DisplayUnit { get; set; } = "km/h";
    public int FollowingDistance { get; set; } = 1;
    public int AccelerationResponse { get; set; } = 1;
    public int SteeringSensitivity { get; set; } = 1;
    public int CollisionAvoidance { get; set; } = 3;
    public int SpeedLimitWarning { get; set; } = 1;
    public bool TrafficLightsEnabled { get; set; } = true;
    public bool GatesEnabled { get; set; } = true;
    public bool PauseWhenUnstable { get; set; } = true;
}

public sealed record DeckState(GameState Game, float? ManualSpeedKph, string SpeedMode);
public sealed record Command(string Id, string Action, long IssuedAt, float? Value = null);
public sealed record CommandResult(string Id, bool Ok, string? Error = null);

public interface IGameAdapter
{
    GameState Read();
    void Apply(GameState before, GameState after);
}

public static class Wire
{
    public const int Version = 1;
    public const int DefaultPort = 38120;
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static string State(DeckState state) => JsonSerializer.Serialize(new
    {
        type = "state", protocol = Version, timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), state
    }, Json);
    public static string Result(CommandResult result) => JsonSerializer.Serialize(new
    {
        type = "result", protocol = Version, result.Id, result.Ok, result.Error
    }, Json);
}
