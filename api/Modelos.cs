namespace RobinhosBurguer;

public record CadastroDto(
    string? Nome,
    string? Cpf,
    string? Telefone,
    string? Email,
    string? Nascimento,
    string? Cep,
    string? Endereco,
    string? Senha);

public record LoginDto(string? Cpf, string? Senha);

public record PerfilDto(string? Nome, string? Telefone, string? Endereco);

public record ItemPedidoDto(int ProdutoId, int Quantidade);

public record NovoPedidoDto(List<ItemPedidoDto>? Itens);

public record Usuario(
    int Id,
    string Nome,
    string Cpf,
    string Telefone,
    string Email,
    string Endereco,
    string SenhaHash);

public record Produto(int Id, string Nome, decimal Preco);

public record Resultado(int Status, object Corpo)
{
    public static Resultado Ok(object corpo) => new(200, corpo);
    public static Resultado Falha(int status, string mensagem) => new(status, new { mensagem });
}
