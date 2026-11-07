using System.Reflection;
using System.Runtime.Loader;

string installed = args[0];
string pluginPath = Path.GetFullPath(args[1]);
AssemblyLoadContext.Default.Resolving += (_, name) =>
{
    string path = Path.Combine(installed, name.Name + ".dll");
    return File.Exists(path) ? AssemblyLoadContext.Default.LoadFromAssemblyPath(path) : null;
};
// No app singletons, settings or input hooks are initialized by this load-only check.
Run(pluginPath);

static void Run(string pluginPath)
{
    var context = new ETS2LA.Backend.Plugins.PluginLoadContext(pluginPath, Path.GetDirectoryName(pluginPath)!);
    var assembly = context.LoadFromAssemblyPath(pluginPath);
    var plugins = assembly.GetTypes().Where(type => typeof(ETS2LA.Shared.IPlugin).IsAssignableFrom(type) && !type.IsAbstract).ToArray();
    if (plugins.Length != 1) throw new Exception("Expected exactly one plugin");
    var plugin = (ETS2LA.Shared.IPlugin)Activator.CreateInstance(plugins[0])!;
    if (plugin.Info.Id != "lucat.streamdeck") throw new Exception("Plugin identity mismatch");
    Console.WriteLine($"PASS Native ETS2LA loader discovers {plugin.Info.Name} ({plugin.Info.Version})");
    Console.WriteLine($"PASS Shared IPlugin identity is preserved across load contexts");
    // Touch framework types used by the embedded server in this exact load context.
    var server = assembly.GetType("ETS2LA.StreamDeck.Bridge.BridgeServer")!;
    _ = server.GetMethods();
    Console.WriteLine("PASS ASP.NET Core / WebSocket framework dependencies resolve");
    context.Unload();
}
