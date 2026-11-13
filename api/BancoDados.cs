using MySqlConnector;

namespace RobinhosBurguer;

public class BancoDados
{
    private readonly string _conexao;

    public BancoDados(string conexao)
    {
        _conexao = conexao;
    }

    public async Task PrepararAsync()
    {
        var sql = SemComentarios(await File.ReadAllTextAsync(AcharScript()));
        await using var conexao = await AbrirAsync();
        foreach (var parte in sql.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (Ignorar(parte)) continue;
            await using var comando = new MySqlCommand(parte, conexao);
            await comando.ExecuteNonQueryAsync();
        }
    }

    public async Task<List<object>> ListarProdutosAsync()
    {
        const string sql = """
            SELECT id, nome, descricao, categoria, preco, imagem, destaque
            FROM produtos
            ORDER BY id
            """;

        await using var conexao = await AbrirAsync();
        await using var comando = new MySqlCommand(sql, conexao);
        await using var leitura = await comando.ExecuteReaderAsync();
        var lista = new List<object>();
        while (await leitura.ReadAsync())
        {
            lista.Add(new
            {
                id = leitura.GetInt32("id"),
                nome = leitura.GetString("nome"),
                descricao = leitura.GetString("descricao"),
                categoria = leitura.GetString("categoria"),
                preco = leitura.GetDecimal("preco"),
                imagem = leitura.GetString("imagem"),
                destaque = leitura.GetBoolean("destaque")
            });
        }
        return lista;
    }

    public async Task<bool> CpfExisteAsync(string cpf)
    {
        await using var conexao = await AbrirAsync();
        await using var comando = new MySqlCommand("SELECT 1 FROM usuarios WHERE cpf = @cpf LIMIT 1", conexao);
        comando.Parameters.AddWithValue("@cpf", cpf);
        return await comando.ExecuteScalarAsync() is not null;
    }

    public async Task<int> InserirUsuarioAsync(CadastroDto dados, string senhaHash)
    {
        const string sql = """
            INSERT INTO usuarios (nome, cpf, telefone, email, nascimento, cep, endereco, senha_hash)
            VALUES (@nome, @cpf, @telefone, @email, @nascimento, @cep, @endereco, @senha)
            """;

        await using var conexao = await AbrirAsync();
        await using var comando = new MySqlCommand(sql, conexao);
        comando.Parameters.AddWithValue("@nome", dados.Nome!.Trim());
        comando.Parameters.AddWithValue("@cpf", dados.Cpf);
        comando.Parameters.AddWithValue("@telefone", dados.Telefone);
        comando.Parameters.AddWithValue("@email", dados.Email!.Trim());
        comando.Parameters.AddWithValue("@nascimento", dados.Nascimento);
        comando.Parameters.AddWithValue("@cep", dados.Cep);
        comando.Parameters.AddWithValue("@endereco", dados.Endereco!.Trim());
        comando.Parameters.AddWithValue("@senha", senhaHash);
        await comando.ExecuteNonQueryAsync();
        return (int)comando.LastInsertedId;
    }

    public async Task<Usuario?> BuscarPorCpfAsync(string cpf)
    {
        const string sql = """
            SELECT id, nome, cpf, telefone, email, endereco, senha_hash
            FROM usuarios
            WHERE cpf = @cpf
            LIMIT 1
            """;

        await using var conexao = await AbrirAsync();
        await using var comando = new MySqlCommand(sql, conexao);
        comando.Parameters.AddWithValue("@cpf", cpf);
        await using var leitura = await comando.ExecuteReaderAsync();
        if (!await leitura.ReadAsync()) return null;
        return LerUsuario(leitura);
    }

    public async Task<Usuario?> BuscarPorTokenAsync(string token)
    {
        const string sql = """
            SELECT u.id, u.nome, u.cpf, u.telefone, u.email, u.endereco, u.senha_hash
            FROM sessoes s
            INNER JOIN usuarios u ON u.id = s.usuario_id
            WHERE s.token = @token AND s.expira_em > UTC_TIMESTAMP()
            LIMIT 1
            """;

        await using var conexao = await AbrirAsync();
        await using var comando = new MySqlCommand(sql, conexao);
        comando.Parameters.AddWithValue("@token", token);
        await using var leitura = await comando.ExecuteReaderAsync();
        if (!await leitura.ReadAsync()) return null;
        return LerUsuario(leitura);
    }

    public async Task<string> CriarSessaoAsync(int usuarioId)
    {
        var token = Senha.NovoToken();
        const string sql = """
            INSERT INTO sessoes (token, usuario_id, expira_em)
            VALUES (@token, @usuario, UTC_TIMESTAMP() + INTERVAL 7 DAY)
            """;

        await using var conexao = await AbrirAsync();
        await using var comando = new MySqlCommand(sql, conexao);
        comando.Parameters.AddWithValue("@token", token);
        comando.Parameters.AddWithValue("@usuario", usuarioId);
        await comando.ExecuteNonQueryAsync();
        return token;
    }

    public async Task AtualizarPerfilAsync(int usuarioId, PerfilDto dados)
    {
        const string sql = """
            UPDATE usuarios
            SET nome = @nome, telefone = @telefone, endereco = @endereco
            WHERE id = @id
            """;

        await using var conexao = await AbrirAsync();
        await using var comando = new MySqlCommand(sql, conexao);
        comando.Parameters.AddWithValue("@nome", dados.Nome!.Trim());
        comando.Parameters.AddWithValue("@telefone", dados.Telefone);
        comando.Parameters.AddWithValue("@endereco", (dados.Endereco ?? "").Trim());
        comando.Parameters.AddWithValue("@id", usuarioId);
        await comando.ExecuteNonQueryAsync();
    }

    public async Task ExcluirContaAsync(int usuarioId)
    {
        await using var conexao = await AbrirAsync();
        await using var transacao = await conexao.BeginTransactionAsync();

        await ExecutarAsync(conexao, transacao, """
            DELETE i FROM pedido_itens i
            INNER JOIN pedidos p ON p.id = i.pedido_id
            WHERE p.usuario_id = @id
            """, usuarioId);
        await ExecutarAsync(conexao, transacao, "DELETE FROM pedidos WHERE usuario_id = @id", usuarioId);
        await ExecutarAsync(conexao, transacao, "DELETE FROM sessoes WHERE usuario_id = @id", usuarioId);
        await ExecutarAsync(conexao, transacao, "DELETE FROM usuarios WHERE id = @id", usuarioId);

        await transacao.CommitAsync();
    }

    public async Task<Produto?> BuscarProdutoAsync(int id, MySqlConnection conexao, MySqlTransaction transacao)
    {
        const string sql = "SELECT id, nome, preco FROM produtos WHERE id = @id";
        await using var comando = new MySqlCommand(sql, conexao, transacao);
        comando.Parameters.AddWithValue("@id", id);
        await using var leitura = await comando.ExecuteReaderAsync();
        if (!await leitura.ReadAsync()) return null;
        return new Produto(leitura.GetInt32("id"), leitura.GetString("nome"), leitura.GetDecimal("preco"));
    }

    public async Task<MySqlConnection> AbrirAsync()
    {
        var conexao = new MySqlConnection(_conexao);
        await conexao.OpenAsync();
        return conexao;
    }

    public async Task<List<object>> ListarPedidosAsync(int usuarioId)
    {
        const string sql = """
            SELECT p.id, p.total, p.status, p.criado_em, i.quantidade, pr.nome
            FROM pedidos p
            INNER JOIN pedido_itens i ON i.pedido_id = p.id
            INNER JOIN produtos pr ON pr.id = i.produto_id
            WHERE p.usuario_id = @id
            ORDER BY p.id DESC, i.id
            """;

        await using var conexao = await AbrirAsync();
        await using var comando = new MySqlCommand(sql, conexao);
        comando.Parameters.AddWithValue("@id", usuarioId);
        await using var leitura = await comando.ExecuteReaderAsync();

        var pedidos = new List<PedidoMontado>();
        while (await leitura.ReadAsync())
        {
            var id = leitura.GetInt32("id");
            var atual = pedidos.LastOrDefault();
            if (atual is null || atual.Id != id)
            {
                atual = new PedidoMontado(
                    id,
                    leitura.GetDateTime("criado_em").ToString("dd/MM/yyyy HH:mm"),
                    leitura.GetDecimal("total"),
                    leitura.GetString("status"));
                pedidos.Add(atual);
            }
            atual.Itens.Add($"{leitura.GetInt32("quantidade")}x {leitura.GetString("nome")}");
        }

        return pedidos.Select(p => (object)new
        {
            id = p.Id,
            data = p.Data,
            itens = p.Itens,
            total = p.Total,
            status = p.Status
        }).ToList();
    }

    public async Task<int> CancelarPedidoAsync(int usuarioId, int pedidoId)
    {
        await using var conexao = await AbrirAsync();
        await using var transacao = await conexao.BeginTransactionAsync();

        await using (var apagarItens = new MySqlCommand("""
            DELETE i FROM pedido_itens i
            INNER JOIN pedidos p ON p.id = i.pedido_id
            WHERE p.id = @pedido AND p.usuario_id = @usuario
            """, conexao, transacao))
        {
            apagarItens.Parameters.AddWithValue("@pedido", pedidoId);
            apagarItens.Parameters.AddWithValue("@usuario", usuarioId);
            await apagarItens.ExecuteNonQueryAsync();
        }

        int apagados;
        await using (var apagarPedido = new MySqlCommand(
            "DELETE FROM pedidos WHERE id = @pedido AND usuario_id = @usuario", conexao, transacao))
        {
            apagarPedido.Parameters.AddWithValue("@pedido", pedidoId);
            apagarPedido.Parameters.AddWithValue("@usuario", usuarioId);
            apagados = await apagarPedido.ExecuteNonQueryAsync();
        }

        await transacao.CommitAsync();
        return apagados;
    }

    private static async Task ExecutarAsync(MySqlConnection conexao, MySqlTransaction transacao, string sql, int usuarioId)
    {
        await using var comando = new MySqlCommand(sql, conexao, transacao);
        comando.Parameters.AddWithValue("@id", usuarioId);
        await comando.ExecuteNonQueryAsync();
    }

    private static Usuario LerUsuario(MySqlDataReader leitura)
    {
        return new Usuario(
            leitura.GetInt32("id"),
            leitura.GetString("nome"),
            leitura.GetString("cpf"),
            leitura.GetString("telefone"),
            leitura.GetString("email"),
            leitura.GetString("endereco"),
            leitura.GetString("senha_hash"));
    }

    private static string AcharScript()
    {
        var candidatos = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "criar.sql"),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "banco", "criar.sql"))
        };
        return candidatos.FirstOrDefault(File.Exists)
            ?? throw new FileNotFoundException("Não encontrei banco/criar.sql.");
    }

    private static string SemComentarios(string sql)
    {
        var linhas = sql.Replace("\r\n", "\n").Split('\n')
            .Where(linha => !linha.TrimStart().StartsWith("--"));
        return string.Join('\n', linhas);
    }

    private static bool Ignorar(string sql)
    {
        var texto = sql.TrimStart();
        return texto.StartsWith("CREATE DATABASE", StringComparison.OrdinalIgnoreCase)
            || texto.StartsWith("CREATE USER", StringComparison.OrdinalIgnoreCase)
            || texto.StartsWith("GRANT ", StringComparison.OrdinalIgnoreCase)
            || texto.StartsWith("FLUSH ", StringComparison.OrdinalIgnoreCase)
            || texto.StartsWith("USE ", StringComparison.OrdinalIgnoreCase);
    }

    private sealed class PedidoMontado(int id, string data, decimal total, string status)
    {
        public int Id { get; } = id;
        public string Data { get; } = data;
        public decimal Total { get; } = total;
        public string Status { get; } = status;
        public List<string> Itens { get; } = [];
    }
}
