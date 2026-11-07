using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace ETS2LA.StreamDeck.Bridge;

public sealed class BridgeServer(ControlEngine engine) : IAsyncDisposable
{
    private WebApplication? app;
    private readonly CancellationTokenSource shutdown = new();
    private int clients;

    public async Task StartAsync(int port = Wire.DefaultPort)
    {
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions
        {
            Args = [], ApplicationName = typeof(BridgeServer).Assembly.FullName,
            ContentRootPath = Path.GetTempPath()
        });
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(options => options.Listen(IPAddress.Loopback, port));
        app = builder.Build();
        app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(10) });
        app.MapGet("/health", () => Results.Json(new { name = "ETS2LA Stream Deck", protocol = Wire.Version }));
        app.Map("/ets2la", HandleClient);
        try { await app.StartAsync(shutdown.Token); }
        catch { await app.DisposeAsync(); app = null; throw; }
    }

    private async Task HandleClient(HttpContext context)
    {
        // A browser page must not be able to send driving commands to localhost.
        if (context.Request.Headers.ContainsKey("Origin")) { context.Response.StatusCode = 403; return; }
        if (!context.WebSockets.IsWebSocketRequest) { context.Response.StatusCode = 400; return; }
        if (Interlocked.Increment(ref clients) > 4)
        {
            Interlocked.Decrement(ref clients);
            context.Response.StatusCode = 429;
            return;
        }
        try
        {
            using var socket = await context.WebSockets.AcceptWebSocketAsync();
            using var session = CancellationTokenSource.CreateLinkedTokenSource(shutdown.Token, context.RequestAborted);
            using var sendLock = new SemaphoreSlim(1);
            async Task Send(string json)
            {
                await sendLock.WaitAsync(session.Token);
                try { await socket.SendAsync(Encoding.UTF8.GetBytes(json), WebSocketMessageType.Text, true, session.Token); }
                finally { sendLock.Release(); }
            }
            async Task Publish()
            {
                try
                {
                    using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(200));
                    do { await Send(Wire.State(engine.Snapshot())); }
                    while (await timer.WaitForNextTickAsync(session.Token));
                }
                finally { session.Cancel(); }
            }
            var publishTask = Publish();
            try
            {
                byte[] buffer = new byte[8192];
                while (!session.IsCancellationRequested && socket.State == WebSocketState.Open)
                {
                    int length = 0;
                    WebSocketReceiveResult message;
                    do
                    {
                        message = await socket.ReceiveAsync(new ArraySegment<byte>(buffer, length, buffer.Length - length), session.Token);
                        if (message.MessageType == WebSocketMessageType.Close) return;
                        if (message.MessageType != WebSocketMessageType.Text || length + message.Count >= buffer.Length)
                        {
                            await socket.CloseOutputAsync(WebSocketCloseStatus.MessageTooBig, "Text messages <8 KiB required", session.Token);
                            return;
                        }
                        length += message.Count;
                    } while (!message.EndOfMessage);
                    try
                    {
                        using var document = JsonDocument.Parse(buffer.AsMemory(0, length));
                        var root = document.RootElement;
                        if (root.GetProperty("protocol").GetInt32() != Wire.Version || root.GetProperty("type").GetString() != "command")
                            throw new JsonException("Unsupported protocol");
                        var command = root.GetProperty("command").Deserialize<Command>(Wire.Json) ?? throw new JsonException();
                        await Send(Wire.Result(engine.Execute(command)));
                        await Send(Wire.State(engine.Snapshot()));
                    }
                    catch (Exception ex) when (ex is JsonException or KeyNotFoundException or InvalidOperationException or FormatException)
                    {
                        await Send(Wire.Result(new("", false, "Ungültige Nachricht oder Protokollversion.")));
                    }
                }
            }
            catch (Exception ex) when (ex is OperationCanceledException or WebSocketException or IOException) { }
            finally
            {
                session.Cancel();
                try { await publishTask; } catch (Exception ex) when (ex is OperationCanceledException or WebSocketException or IOException) { }
                socket.Abort();
            }
        }
        finally { Interlocked.Decrement(ref clients); }
    }

    public async ValueTask DisposeAsync()
    {
        shutdown.Cancel();
        if (app is not null)
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            await app.StopAsync(timeout.Token);
            await app.DisposeAsync();
            app = null;
        }
        shutdown.Dispose();
    }
}
