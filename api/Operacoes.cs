using MySqlConnector;

namespace RobinhosBurguer;

public class Operacoes
{
    private readonly BancoDados _banco;

    public Operacoes(BancoDados banco)
    {
        _banco = banco;
    }

    public async Task<Resultado> Entrar(LoginDto dados)
    {
        if (string.IsNullOrWhiteSpace(dados.Cpf) || string.IsNullOrWhiteSpace(dados.Senha))
            return Resultado.Falha(400, "Informe CPF e senha.");

        var usuario = await _banco.BuscarPorCpfAsync(dados.Cpf);
        if (usuario is null || !Senha.Confere(dados.Senha, usuario.SenhaHash))
            return Resultado.Falha(401, "CPF ou senha inválidos.");

        var token = await _banco.CriarSessaoAsync(usuario.Id);
        return Resultado.Ok(DadosPublicos(usuario, token));
    }

    public async Task<Resultado> Cadastrar(CadastroDto dados)
    {
        var erro = Regras.ValidarCadastro(dados);
        if (erro is not null) return Resultado.Falha(400, erro);
        if (await _banco.CpfExisteAsync(dados.Cpf!)) return Resultado.Falha(400, "CPF já cadastrado.");

        var id = await _banco.InserirUsuarioAsync(dados, Senha.GerarHash(dados.Senha!));
        var token = await _banco.CriarSessaoAsync(id);
        var usuario = await _banco.BuscarPorCpfAsync(dados.Cpf!);
        return Resultado.Ok(DadosPublicos(usuario!, token));
    }

    public async Task<Resultado> VerPerfil(Usuario usuario)
    {
        return Resultado.Ok(new
        {
            nome = usuario.Nome,
            cpf = usuario.Cpf,
            telefone = usuario.Telefone,
            endereco = usuario.Endereco
        });
    }

    public async Task<Resultado> AtualizarPerfil(Usuario usuario, PerfilDto dados)
    {
        var erro = Regras.ValidarPerfil(dados);
        if (erro is not null) return Resultado.Falha(400, erro);

        await _banco.AtualizarPerfilAsync(usuario.Id, dados);
        return Resultado.Ok(new
        {
            nome = dados.Nome!.Trim(),
            cpf = usuario.Cpf,
            telefone = dados.Telefone,
            endereco = (dados.Endereco ?? "").Trim()
        });
    }

    public async Task<Resultado> ExcluirConta(Usuario usuario)
    {
        await _banco.ExcluirContaAsync(usuario.Id);
        return Resultado.Ok(new { mensagem = "Conta excluída." });
    }

    public Task<Resultado> ListarPedidos(Usuario usuario)
    {
        return Listar(usuario.Id);
    }

    public async Task<Resultado> CriarPedido(Usuario usuario, NovoPedidoDto pedido)
    {
        var erro = Regras.ValidarPedido(pedido);
        if (erro is not null) return Resultado.Falha(400, erro);

        await using var conexao = await _banco.AbrirAsync();
        await using var transacao = await conexao.BeginTransactionAsync();

        var linhas = new List<(decimal Preco, int Quantidade)>();
        var descricoes = new List<string>();

        foreach (var item in pedido.Itens!)
        {
            var produto = await _banco.BuscarProdutoAsync(item.ProdutoId, conexao, transacao);
            if (produto is null)
            {
                await transacao.RollbackAsync();
                return Resultado.Falha(400, "Um item do carrinho não está mais no cardápio.");
            }

            linhas.Add((produto.Preco, item.Quantidade));
            descricoes.Add($"{item.Quantidade}x {produto.Nome}");
        }

        var total = Regras.CalcularTotal(linhas);

        await using var inserirPedido = new MySqlCommand("""
            INSERT INTO pedidos (usuario_id, total, status)
            VALUES (@usuario, @total, 'Em preparo')
            """, conexao, transacao);
        inserirPedido.Parameters.AddWithValue("@usuario", usuario.Id);
        inserirPedido.Parameters.AddWithValue("@total", total);
        await inserirPedido.ExecuteNonQueryAsync();
        var pedidoId = (int)inserirPedido.LastInsertedId;

        for (var i = 0; i < pedido.Itens.Count; i++)
        {
            var item = pedido.Itens[i];
            var preco = linhas[i].Preco;
            await using var inserirItem = new MySqlCommand("""
                INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario)
                VALUES (@pedido, @produto, @quantidade, @preco)
                """, conexao, transacao);
            inserirItem.Parameters.AddWithValue("@pedido", pedidoId);
            inserirItem.Parameters.AddWithValue("@produto", item.ProdutoId);
            inserirItem.Parameters.AddWithValue("@quantidade", item.Quantidade);
            inserirItem.Parameters.AddWithValue("@preco", preco);
            await inserirItem.ExecuteNonQueryAsync();
        }

        await transacao.CommitAsync();

        return Resultado.Ok(new
        {
            id = pedidoId,
            data = DateTime.Now.ToString("dd/MM/yyyy HH:mm"),
            itens = descricoes,
            total,
            status = "Em preparo"
        });
    }

    public async Task<Resultado> CancelarPedido(Usuario usuario, int pedidoId)
    {
        var apagados = await _banco.CancelarPedidoAsync(usuario.Id, pedidoId);
        if (apagados == 0) return Resultado.Falha(404, "Pedido não encontrado.");
        return Resultado.Ok(new { mensagem = "Pedido cancelado." });
    }

    private async Task<Resultado> Listar(int usuarioId)
    {
        var pedidos = await _banco.ListarPedidosAsync(usuarioId);
        return Resultado.Ok(pedidos);
    }

    private static object DadosPublicos(Usuario usuario, string token)
    {
        return new
        {
            token,
            nome = usuario.Nome,
            cpf = usuario.Cpf,
            telefone = usuario.Telefone,
            endereco = usuario.Endereco
        };
    }
}
