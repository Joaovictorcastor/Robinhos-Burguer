using Microsoft.Extensions.FileProviders;
using MySqlConnector;
using RobinhosBurguer;

var builder = WebApplication.CreateBuilder(args);
var urls = builder.Configuration["Urls"];
if (!string.IsNullOrWhiteSpace(urls))
    builder.WebHost.UseUrls(urls);

var conexao = builder.Configuration.GetConnectionString("MySql")
    ?? throw new InvalidOperationException("Connection string MySql não configurada.");

builder.Services.AddSingleton(new BancoDados(conexao));
builder.Services.AddSingleton<Operacoes>();

var app = builder.Build();
var banco = app.Services.GetRequiredService<BancoDados>();
var bancoPronto = false;

try
{
    await banco.PrepararAsync();
    bancoPronto = true;
    app.Logger.LogInformation("MySQL conectado. Tabelas e cardápio prontos.");
}
catch (Exception ex)
{
    app.Logger.LogError(ex, "Não foi possível preparar o MySQL. Importe banco/criar.sql e confira a senha.");
}

var pastaSite = EscolherPastaDoSite(builder.Environment.ContentRootPath);
var arquivos = new PhysicalFileProvider(pastaSite);
app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = arquivos });
app.UseStaticFiles(new StaticFileOptions { FileProvider = arquivos });

app.Use(async (contexto, proximo) =>
{
    if (contexto.Request.Path.StartsWithSegments("/api") && !bancoPronto)
    {
        contexto.Response.StatusCode = 503;
        contexto.Response.ContentType = "application/json; charset=utf-8";
        await contexto.Response.WriteAsync("{\"mensagem\":\"Banco de dados indisponível. Importe banco/criar.sql e confira a senha do MySQL.\"}");
        return;
    }
    await proximo();
});

app.MapGet("/api/produtos", async (BancoDados bd) => await Proteger(async () => Results.Json(await bd.ListarProdutosAsync())));

app.MapPost("/api/cadastro", async (CadastroDto dados, Operacoes op) => await Json(op.Cadastrar(dados)));
app.MapPost("/api/login", async (LoginDto dados, Operacoes op) => await Json(op.Entrar(dados)));

app.MapGet("/api/perfil", async (HttpRequest req, Operacoes op) =>
    await ComUsuario(req, usuario => op.VerPerfil(usuario)));
app.MapPut("/api/perfil", async (HttpRequest req, PerfilDto dados, Operacoes op) =>
    await ComUsuario(req, usuario => op.AtualizarPerfil(usuario, dados)));
app.MapDelete("/api/conta", async (HttpRequest req, Operacoes op) =>
    await ComUsuario(req, usuario => op.ExcluirConta(usuario)));

app.MapGet("/api/pedidos", async (HttpRequest req, Operacoes op) =>
    await ComUsuario(req, usuario => op.ListarPedidos(usuario)));
app.MapPost("/api/pedidos", async (HttpRequest req, NovoPedidoDto dados, Operacoes op) =>
    await ComUsuario(req, usuario => op.CriarPedido(usuario, dados)));
app.MapDelete("/api/pedidos/{id:int}", async (HttpRequest req, int id, Operacoes op) =>
    await ComUsuario(req, usuario => op.CancelarPedido(usuario, id)));

app.Run();

static async Task<IResult> Json(Task<Resultado> tarefa)
{
    return await Proteger(async () =>
    {
        var resultado = await tarefa;
        return Results.Json(resultado.Corpo, statusCode: resultado.Status);
    });
}

static async Task<IResult> ComUsuario(HttpRequest req, Func<Usuario, Task<Resultado>> acao)
{
    return await Proteger(async () =>
    {
        var banco = req.HttpContext.RequestServices.GetRequiredService<BancoDados>();
        var token = Token(req);
        if (token is null) return Results.Json(new { mensagem = "Faça login para continuar." }, statusCode: 401);

        var usuario = await banco.BuscarPorTokenAsync(token);
        if (usuario is null) return Results.Json(new { mensagem = "Faça login para continuar." }, statusCode: 401);

        var resultado = await acao(usuario);
        return Results.Json(resultado.Corpo, statusCode: resultado.Status);
    });
}

static async Task<IResult> Proteger(Func<Task<IResult>> acao)
{
    try
    {
        return await acao();
    }
    catch (MySqlException)
    {
        return Results.Json(new { mensagem = "Banco de dados indisponível." }, statusCode: 503);
    }
}

static string? Token(HttpRequest req)
{
    var cabecalho = req.Headers.Authorization.ToString();
    const string prefixo = "Bearer ";
    if (!cabecalho.StartsWith(prefixo, StringComparison.OrdinalIgnoreCase)) return null;
    var token = cabecalho[prefixo.Length..].Trim();
    return token.Length == 0 ? null : token;
}

static string EscolherPastaDoSite(string pastaDoProjeto)
{
    var publicada = Path.Combine(AppContext.BaseDirectory, "wwwroot");
    if (File.Exists(Path.Combine(publicada, "index.html"))) return publicada;

    var desenvolvimento = Path.GetFullPath(Path.Combine(pastaDoProjeto, ".."));
    if (File.Exists(Path.Combine(desenvolvimento, "index.html"))) return desenvolvimento;

    throw new DirectoryNotFoundException("Não encontrei o index.html do site.");
}
