namespace ETS2LA.StreamDeck.Bridge;

/// <summary>All commands and snapshots share this lock. No network thread writes game state directly.</summary>
public sealed class ControlEngine(IGameAdapter adapter, float? manualSpeed = null, Action<float>? saveManual = null)
{
    private readonly object gate = new();
    private float? rememberedManual = manualSpeed is > 0 and <= 300 ? manualSpeed : null;
    private readonly Dictionary<string, CommandResult> results = new();
    private readonly Queue<string> resultOrder = new();

    public DeckState Snapshot()
    {
        lock (gate)
        {
            var state = adapter.Read();
            RememberManual(state);
            return new(state, rememberedManual, state.RoadLimitEnabled ? "road" : "manual");
        }
    }

    private void RememberManual(GameState state)
    {
        if (!state.RoadLimitEnabled && state.TargetSpeedKph > 0 && float.IsFinite(state.TargetSpeedKph))
            SetManual(state.TargetSpeedKph);
    }

    private void SetManual(float value)
    {
        if (rememberedManual.HasValue && Math.Abs(rememberedManual.Value - value) < 0.05f) return;
        rememberedManual = value;
        saveManual?.Invoke(value);
    }

    private static float ClampSpeed(float value, GameState state) =>
        Math.Clamp(value, 0, state.MaximumSpeedKph > 0 ? Math.Min(300, state.MaximumSpeedKph) : 300);

    private static void RequireDriving(GameState state)
    {
        if (!state.GameRunning || !state.TelemetryFresh) throw new InvalidOperationException("Keine aktuellen Spieldaten.");
        if (state.Paused) throw new InvalidOperationException("Das Spiel ist pausiert.");
    }

    private static float Value(Command command, float fallback, float min, float max)
    {
        float value = command.Value ?? fallback;
        if (!float.IsFinite(value) || value < min || value > max)
            throw new InvalidOperationException($"Wert muss zwischen {min} und {max} liegen.");
        return value;
    }

    private static bool HasAcc(GameState state) => state.DrivingMode is "full" or "acc";
    private static bool HasLane(GameState state) => state.DrivingMode is "full" or "lane";

    private static void Enable(GameState state)
    {
        RequireDriving(state);
        if ((HasAcc(state) && !state.AccAvailable) || (HasLane(state) && !state.LaneAvailable))
            throw new InvalidOperationException("Benötigtes ACC-/Spurhalte-Plugin ist nicht eingeschaltet.");
        if (state.TargetSpeedKph <= 0)
            state.TargetSpeedKph = ClampSpeed(state.SpeedKph > 1 ? state.SpeedKph :
                state.RoadLimitKph ?? state.FallbackSpeedKph, state);
        state.AssistsEnabled = true;
    }

    public CommandResult Execute(Command command)
    {
        lock (gate)
        {
            if (string.IsNullOrWhiteSpace(command.Id) || command.Id.Length > 100)
                return new(command.Id ?? "", false, "Ungültige Befehls-ID.");
            if (results.TryGetValue(command.Id, out var cached)) return cached;
            CommandResult result;
            try
            {
                long age = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - command.IssuedAt;
                if (age > 3000 || age < -3000) throw new InvalidOperationException("Befehl ist abgelaufen.");
                var before = adapter.Read();
                RememberManual(before);
                var state = before with { };
                switch (command.Action)
                {
                    case "assist.toggle":
                        if (state.AssistsEnabled) state.AssistsEnabled = false; else Enable(state);
                        break;
                    case "assist.cancel": state.AssistsEnabled = false; break;
                    case "assist.resume": Enable(state); break;
                    case "acc.toggle":
                    case "lane.toggle":
                        RequireDriving(state);
                        bool acc = state.AssistsEnabled && HasAcc(state);
                        bool lane = state.AssistsEnabled && HasLane(state);
                        if (command.Action == "acc.toggle") acc = !acc; else lane = !lane;
                        if (!acc && !lane) state.AssistsEnabled = false;
                        else
                        {
                            state.DrivingMode = acc && lane ? "full" : acc ? "acc" : "lane";
                            Enable(state);
                        }
                        break;
                    case "mode.cycle":
                        state.DrivingMode = state.DrivingMode switch { "full" => "acc", "acc" => "lane", _ => "full" };
                        // Changing the mode never engages assists.
                        if (state.AssistsEnabled) Enable(state);
                        break;
                    case "speed.toggle":
                        RequireDriving(state);
                        if (state.RoadLimitEnabled)
                        {
                            state.TargetSpeedKph = ClampSpeed(Value(command,
                                rememberedManual ?? (state.TargetSpeedKph > 0 ? state.TargetSpeedKph : 80), 1, 300), state);
                            state.RoadLimitEnabled = false;
                        }
                        else
                        {
                            if (state.RoadLimitKph is not > 0)
                                throw new InvalidOperationException("Aktuell ist kein Straßenlimit bekannt.");
                            state.TargetSpeedKph = ClampSpeed(state.RoadLimitKph.Value, state);
                            state.RoadLimitEnabled = true;
                        }
                        break;
                    case "speed.increase":
                    case "speed.decrease":
                        RequireDriving(state);
                        float step = Value(command, 1, 0.1f, 50);
                        float start = state.TargetSpeedKph;
                        state.TargetSpeedKph = ClampSpeed(start + (command.Action == "speed.increase" ? step : -step), state);
                        state.RoadLimitEnabled = false;
                        break;
                    case "speed.set":
                        RequireDriving(state);
                        state.TargetSpeedKph = ClampSpeed(Value(command, 80, 1, 300), state);
                        state.RoadLimitEnabled = false;
                        break;
                    case "speed.capture":
                        RequireDriving(state);
                        state.TargetSpeedKph = ClampSpeed(MathF.Round(Math.Abs(state.SpeedKph)), state);
                        state.RoadLimitEnabled = false;
                        break;
                    case "distance.cycle": state.FollowingDistance = (state.FollowingDistance + 1) % 3; break;
                    case "response.cycle": state.AccelerationResponse = (state.AccelerationResponse + 1) % 3; break;
                    case "steering.cycle": state.SteeringSensitivity = (state.SteeringSensitivity + 1) % 3; break;
                    case "collision.cycle": state.CollisionAvoidance = (state.CollisionAvoidance + 1) % 4; break;
                    case "warning.cycle": state.SpeedLimitWarning = (state.SpeedLimitWarning + 1) % 3; break;
                    case "traffic-lights.toggle": state.TrafficLightsEnabled = !state.TrafficLightsEnabled; break;
                    case "gates.toggle": state.GatesEnabled = !state.GatesEnabled; break;
                    case "stability.toggle": state.PauseWhenUnstable = !state.PauseWhenUnstable; break;
                    default: throw new InvalidOperationException("Unbekannte Aktion.");
                }
                adapter.Apply(before, state);
                RememberManual(state);
                result = new(command.Id, true);
            }
            catch (Exception exception)
            {
                result = new(command.Id, false, exception.Message);
            }
            results[command.Id] = result;
            resultOrder.Enqueue(command.Id);
            while (resultOrder.Count > 256) results.Remove(resultOrder.Dequeue());
            return result;
        }
    }
}
