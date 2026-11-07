using System.Diagnostics;
using ETS2LA.Backend;
using ETS2LA.Backend.Events;
using ETS2LA.Game.Telemetry;
using ETS2LA.Settings.Global;
using ETS2LA.State;
using ETS2LA.StreamDeck.Bridge;

namespace ETS2LA.StreamDeck;

internal sealed class GameAdapter : IGameAdapter, IDisposable
{
    private sealed record Telemetry(bool Active, bool Paused, float Speed, float Limit, long Received);
    private Telemetry telemetry = new(false, false, 0, 0, 0);
    private const float Kph = 3.6f;

    public GameAdapter() => Events.Current.Subscribe<GameTelemetryData>("ETS2LA.Telemetry.Data", OnTelemetry);

    private void OnTelemetry(GameTelemetryData data) => Volatile.Write(ref telemetry, new(
        data.sdkActive, data.paused, data.truckFloat.speed, data.truckFloat.speedLimit, Stopwatch.GetTimestamp()));

    private static bool PluginEnabled(string id)
    {
        var plugins = PluginBackend.Current.PluginHandler?.LoadedPlugins;
        return plugins?.Any(plugin => plugin.Info.Id == id && plugin._IsRunning) == true;
    }

    public GameState Read()
    {
        var data = Volatile.Read(ref telemetry);
        var state = ApplicationState.Current;
        var settings = AssistanceSettings.Current;
        return new()
        {
            GameRunning = data.Active && state.IsGameRunning,
            Paused = data.Paused,
            TelemetryFresh = data.Received != 0 && Stopwatch.GetElapsedTime(data.Received).TotalSeconds < 2,
            AssistsEnabled = state.EnableAssists,
            DrivingMode = state.DrivingMode switch
            {
                DrivingMode.AdaptiveCruiseControlOnly => "acc",
                DrivingMode.LaneAssistOnly => "lane",
                _ => "full"
            },
            AccAvailable = PluginEnabled("tumppi066.adaptivecruisecontrol"),
            LaneAvailable = PluginEnabled("tumppi066.laneassist"),
            SpeedKph = float.IsFinite(data.Speed) ? Math.Abs(data.Speed) * Kph : 0,
            TargetSpeedKph = float.IsFinite(state.DesiredSpeed) ? state.DesiredSpeed * Kph : 0,
            RoadLimitKph = data.Limit > 0 && float.IsFinite(data.Limit) ? data.Limit * Kph : null,
            MaximumSpeedKph = settings.MaximumSpeed * Kph,
            FallbackSpeedKph = StateSettingsHandler.Current.GetSettings().FallbackSpeed * Kph,
            RoadLimitEnabled = settings.EnabledTrafficRules.Contains(TrafficRule.Speedlimits),
            DisplayUnit = state.DisplayUnits == Units.Imperial ? "mph" : "km/h",
            FollowingDistance = (int)settings.FollowingDistance,
            AccelerationResponse = (int)settings.AccelerationResponse,
            SteeringSensitivity = (int)settings.SteeringSensitivity,
            CollisionAvoidance = (int)settings.CollisionAvoidanceOption,
            SpeedLimitWarning = (int)settings.SpeedLimitWarningOption,
            TrafficLightsEnabled = settings.EnabledTrafficRules.Contains(TrafficRule.TrafficLights),
            GatesEnabled = settings.EnabledTrafficRules.Contains(TrafficRule.Gates),
            PauseWhenUnstable = settings.PauseWhenUnstable
        };
    }

    public void Apply(GameState before, GameState after)
    {
        var state = ApplicationState.Current;
        var settings = AssistanceSettings.Current;
        if (!after.AssistsEnabled) state.EnableAssists = false;
        if (before.TargetSpeedKph != after.TargetSpeedKph) state.DesiredSpeed = after.TargetSpeedKph / Kph;
        if (before.DrivingMode != after.DrivingMode)
            state.DrivingMode = after.DrivingMode switch
            {
                "acc" => DrivingMode.AdaptiveCruiseControlOnly,
                "lane" => DrivingMode.LaneAssistOnly,
                _ => DrivingMode.FullSelfDriving
            };

        bool changed = false;
        void Rule(TrafficRule rule, bool oldValue, bool newValue)
        {
            if (oldValue == newValue) return;
            var rules = settings.EnabledTrafficRules.ToList();
            rules.RemoveAll(item => item == rule);
            if (newValue) rules.Add(rule);
            settings.EnabledTrafficRules = rules;
            changed = true;
        }
        Rule(TrafficRule.Speedlimits, before.RoadLimitEnabled, after.RoadLimitEnabled);
        Rule(TrafficRule.TrafficLights, before.TrafficLightsEnabled, after.TrafficLightsEnabled);
        Rule(TrafficRule.Gates, before.GatesEnabled, after.GatesEnabled);
        if (before.FollowingDistance != after.FollowingDistance)
        { settings.FollowingDistance = (FollowingDistanceOption)after.FollowingDistance; changed = true; }
        if (before.AccelerationResponse != after.AccelerationResponse)
        { settings.AccelerationResponse = (AccelerationResponseOption)after.AccelerationResponse; changed = true; }
        if (before.SteeringSensitivity != after.SteeringSensitivity)
        { settings.SteeringSensitivity = (SteeringSensitivityOption)after.SteeringSensitivity; changed = true; }
        if (before.CollisionAvoidance != after.CollisionAvoidance)
        { settings.CollisionAvoidanceOption = (CollisionAvoidance)after.CollisionAvoidance; changed = true; }
        if (before.SpeedLimitWarning != after.SpeedLimitWarning)
        { settings.SpeedLimitWarningOption = (SpeedLimitWarning)after.SpeedLimitWarning; changed = true; }
        if (before.PauseWhenUnstable != after.PauseWhenUnstable)
        { settings.PauseWhenUnstable = after.PauseWhenUnstable; changed = true; }
        if (changed) settings.Save();
        // Only an explicit engagement command changes this from false to true.
        if (before.AssistsEnabled != after.AssistsEnabled && after.AssistsEnabled) state.EnableAssists = true;
    }

    public void Dispose() => Events.Current.Unsubscribe<GameTelemetryData>("ETS2LA.Telemetry.Data", OnTelemetry);
}
