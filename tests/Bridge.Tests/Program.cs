using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using ETS2LA.StreamDeck.Bridge;

int passed = 0;
void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
    passed++;
    Console.WriteLine($"PASS {message}");
}
Command Cmd(string action, float? value = null) => new(Guid.NewGuid().ToString(), action, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), value);
FakeAdapter Fresh() => new(new()
{
    GameRunning = true, TelemetryFresh = true, AccAvailable = true, LaneAvailable = true,
    SpeedKph = 75, TargetSpeedKph = 90, RoadLimitKph = 80,
    RoadLimitEnabled = false, DrivingMode = "full"
});

if (args.Contains("--serve"))
{
    var fake = Fresh();
    await using var server = new BridgeServer(new ControlEngine(fake));
    int port = args.Length > 1 ? int.Parse(args[1]) : 38121;
    await server.StartAsync(port);
    Console.WriteLine($"READY {port}");
    await Task.Delay(Timeout.Infinite);
    return;
}

var adapter = Fresh();
var engine = new ControlEngine(adapter);
Check(engine.Execute(Cmd("speed.toggle")).Ok && adapter.State.TargetSpeedKph == 80 && adapter.State.RoadLimitEnabled,
    "Manual 90 → road 80");
adapter.State.RoadLimitKph = 60;
adapter.State.TargetSpeedKph = 60; // Native ETS2LA road-limit handling.
Check(engine.Execute(Cmd("speed.toggle")).Ok && adapter.State.TargetSpeedKph == 90 && !adapter.State.RoadLimitEnabled,
    "Road change does not overwrite remembered manual 90");
Check(!adapter.State.AssistsEnabled, "Speed-mode change never engages assists");
Check(engine.Execute(Cmd("speed.toggle")).Ok, "Return to road mode");
Check(engine.Execute(Cmd("speed.increase", 5)).Ok && adapter.State.TargetSpeedKph == 65 && !adapter.State.RoadLimitEnabled,
    "Plus selects manual mode from the live road target");
Check(!adapter.State.AssistsEnabled, "Plus never engages assists");
adapter.State.TargetSpeedKph = 95;
Check(engine.Snapshot().ManualSpeedKph == 95, "External wheel/keyboard target changes are remembered");
Check(engine.Execute(Cmd("speed.toggle")).Ok && engine.Execute(Cmd("speed.toggle")).Ok && adapter.State.TargetSpeedKph == 95,
    "External manual target survives road/manual round trip");
adapter.State.RoadLimitKph = null;
Check(!engine.Execute(Cmd("speed.toggle")).Ok && !adapter.State.RoadLimitEnabled && adapter.State.TargetSpeedKph == 95,
    "Unknown road limit is rejected without changing mode or target");
adapter.State.RoadLimitEnabled = true;
Check(engine.Execute(Cmd("speed.toggle", 88)).Ok && adapter.State.TargetSpeedKph == 88,
    "Explicit custom limit can override remembered manual target");
adapter.State.MaximumSpeedKph = 80;
Check(engine.Execute(Cmd("speed.set", 120)).Ok && adapter.State.TargetSpeedKph == 80, "ETS2LA maximum speed caps target");
Check(!engine.Execute(Cmd("speed.set", float.NaN)).Ok && adapter.State.TargetSpeedKph == 80, "NaN target is rejected");
Check(!engine.Execute(Cmd("speed.set", -1)).Ok, "Negative target is rejected");
Check(!engine.Execute(Cmd("speed.increase", 200)).Ok, "Invalid step is rejected");
Check(engine.Execute(Cmd("speed.decrease", 50)).Ok && engine.Execute(Cmd("speed.decrease", 50)).Ok && adapter.State.TargetSpeedKph == 0,
    "Target cannot become negative");
adapter.State.MaximumSpeedKph = 0;
adapter.State.TargetSpeedKph = 80;
adapter.State.DrivingMode = "lane";
adapter.State.AssistsEnabled = true;
Check(engine.Execute(Cmd("acc.toggle")).Ok && adapter.State.DrivingMode == "full" && adapter.State.AssistsEnabled,
    "Adding ACC preserves active lane assist");
Check(engine.Execute(Cmd("lane.toggle")).Ok && adapter.State.DrivingMode == "acc" && adapter.State.AssistsEnabled,
    "Removing lane assist preserves active ACC");
Check(engine.Execute(Cmd("acc.toggle")).Ok && !adapter.State.AssistsEnabled,
    "Removing last assist disables master enable");
adapter.State.LaneAvailable = false;
Check(!engine.Execute(Cmd("lane.toggle")).Ok && !adapter.State.AssistsEnabled,
    "Missing plugin prevents engagement");
adapter.State.LaneAvailable = true;
Check(engine.Execute(Cmd("mode.cycle")).Ok && !adapter.State.AssistsEnabled, "Changing driving mode never engages assists");
adapter.State.Paused = true;
Check(!engine.Execute(Cmd("assist.resume")).Ok, "Paused game prevents engagement");
Check(!engine.Execute(Cmd("speed.set", 85)).Ok, "Paused game prevents target change");
adapter.State.AssistsEnabled = true;
Check(engine.Execute(Cmd("assist.cancel")).Ok && !adapter.State.AssistsEnabled, "Cancel works while paused");
adapter.State.Paused = false;
adapter.State.TelemetryFresh = false;
Check(!engine.Execute(Cmd("assist.resume")).Ok, "Stale telemetry prevents engagement");
Check(engine.Execute(Cmd("distance.cycle")).Ok && adapter.State.FollowingDistance == 2, "Settings work without live telemetry");
adapter.State.TelemetryFresh = true;
var duplicate = Cmd("speed.increase", 5);
float previous = adapter.State.TargetSpeedKph;
Check(engine.Execute(duplicate).Ok && engine.Execute(duplicate).Ok && adapter.State.TargetSpeedKph == previous + 5,
    "Duplicate command ID is applied only once");
Check(!engine.Execute(Cmd("speed.increase") with { IssuedAt = DateTimeOffset.UtcNow.AddSeconds(-5).ToUnixTimeMilliseconds() }).Ok,
    "Expired commands are rejected");
Check(!engine.Execute(Cmd("speed.increase") with { IssuedAt = DateTimeOffset.UtcNow.AddSeconds(5).ToUnixTimeMilliseconds() }).Ok,
    "Future commands are rejected");
Check(!engine.Execute(Cmd("not-a-command")).Ok, "Unknown action is rejected");

// Exercise the real transport, including fragmented frames, malformed packets and unload/rebind.
var listener = new TcpListener(IPAddress.Loopback, 0);
listener.Start(); int testPort = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop();
var liveServer = new BridgeServer(new ControlEngine(Fresh()));
await liveServer.StartAsync(testPort);
using var http = new HttpClient();
var health = JsonDocument.Parse(await http.GetStringAsync($"http://127.0.0.1:{testPort}/health"));
Check(health.RootElement.GetProperty("protocol").GetInt32() == 1, "Health endpoint identifies protocol");
using var browserSocket = new ClientWebSocket();
browserSocket.Options.SetRequestHeader("Origin", "https://example.com");
bool originRejected = false;
try { await browserSocket.ConnectAsync(new Uri($"ws://127.0.0.1:{testPort}/ets2la"), CancellationToken.None); }
catch (WebSocketException) { originRejected = true; }
Check(originRejected, "Browser-origin WebSocket connection is rejected");
using var socket = new ClientWebSocket();
await socket.ConnectAsync(new Uri($"ws://127.0.0.1:{testPort}/ets2la"), CancellationToken.None);
async Task<JsonElement> Next(string type)
{
    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
    byte[] buffer = new byte[32768];
    while (true)
    {
        int length = 0; WebSocketReceiveResult response;
        do { response = await socket.ReceiveAsync(new ArraySegment<byte>(buffer, length, buffer.Length - length), timeout.Token); length += response.Count; }
        while (!response.EndOfMessage);
        using var json = JsonDocument.Parse(buffer.AsMemory(0, length));
        if (json.RootElement.GetProperty("type").GetString() == type) return json.RootElement.Clone();
    }
}
Check((await Next("state")).GetProperty("state").GetProperty("game").GetProperty("targetSpeedKph").GetSingle() == 90,
    "Initial snapshot arrives over WebSocket");
var wireCommand = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { type = "command", protocol = 1, command = Cmd("speed.set", 88) }, Wire.Json));
await socket.SendAsync(wireCommand.AsMemory(0, 10), WebSocketMessageType.Text, false, CancellationToken.None);
await socket.SendAsync(wireCommand.AsMemory(10), WebSocketMessageType.Text, true, CancellationToken.None);
Check((await Next("result")).GetProperty("ok").GetBoolean(), "Fragmented command is reassembled and acknowledged");
Check((await Next("state")).GetProperty("state").GetProperty("game").GetProperty("targetSpeedKph").GetSingle() == 88,
    "Acknowledged target is reflected in the next live snapshot");
await socket.SendAsync(Encoding.UTF8.GetBytes("{}"), WebSocketMessageType.Text, true, CancellationToken.None);
Check(!(await Next("result")).GetProperty("ok").GetBoolean(), "Malformed JSON envelope is rejected without disconnect");
await socket.SendAsync(Encoding.UTF8.GetBytes("{broken"), WebSocketMessageType.Text, true, CancellationToken.None);
Check(!(await Next("result")).GetProperty("ok").GetBoolean(), "Invalid JSON text is rejected without disconnect");
socket.Abort();
await liveServer.DisposeAsync();
await using var rebound = new BridgeServer(new ControlEngine(Fresh()));
await rebound.StartAsync(testPort);
Check((await http.GetAsync($"http://127.0.0.1:{testPort}/health")).IsSuccessStatusCode,
    "Plugin unload releases the port for immediate reload");
Console.WriteLine($"{passed} checks passed.");

internal sealed class FakeAdapter(GameState state) : IGameAdapter
{
    public GameState State = state;
    public GameState Read() => State with { };
    public void Apply(GameState before, GameState after) => State = after;
}
