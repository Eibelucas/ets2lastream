using ETS2LA.Logging;
using ETS2LA.Settings;
using ETS2LA.Shared;
using ETS2LA.StreamDeck.Bridge;

namespace ETS2LA.StreamDeck;

[Serializable]
public sealed class BridgePreferences
{
    public float? ManualSpeedKph = null;
    public int Port = Wire.DefaultPort;
}

public sealed class StreamDeckPlugin : Plugin
{
    private BridgeServer? server;
    private GameAdapter? adapter;
    public override float TickRate => 1;
    public override PluginInformation Info => new()
    {
        Id = "lucat.streamdeck", Name = "Stream Deck Bridge", Version = "0.1.1",
        AuthorName = "Lucat", Description = "Stream Deck: Live-Status, Assistenten und Straßenlimit/eigenes Zieltempo."
    };

    public override void OnEnable()
    {
        if (server is not null) return;
        var handler = new SettingsHandler();
        var preferences = handler.Load<BridgePreferences>("lucat.streamdeck.json");
        int port = preferences.Port is >= 1024 and <= 65535 ? preferences.Port : Wire.DefaultPort;
        adapter = new GameAdapter();
        var engine = new ControlEngine(adapter, preferences.ManualSpeedKph, value =>
        {
            preferences.ManualSpeedKph = value;
            handler.Save("lucat.streamdeck.json", preferences);
        });
        server = new BridgeServer(engine);
        try
        {
            server.StartAsync(port).GetAwaiter().GetResult();
            base.OnEnable();
            Logger.Info($"Stream Deck Bridge: ws://127.0.0.1:{port}/ets2la");
        }
        catch
        {
            Stop();
            throw;
        }
    }

    private void Stop()
    {
        var oldServer = server;
        server = null;
        try { oldServer?.DisposeAsync().AsTask().GetAwaiter().GetResult(); }
        finally { adapter?.Dispose(); adapter = null; }
    }

    public override void OnDisable() { base.OnDisable(); Stop(); }
    public override void Shutdown() { base.Shutdown(); Stop(); }
}
