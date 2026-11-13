using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace RobinhosBurguer;

public static class Regras
{
    public static string? ValidarCadastro(CadastroDto dados)
    {
        var nome = (dados.Nome ?? "").Trim();
        var email = (dados.Email ?? "").Trim();
        var endereco = (dados.Endereco ?? "").Trim();

        if (nome.Length < 3) return "Informe o nome.";
        if (!Regex.IsMatch(dados.Cpf ?? "", @"^\d{3}\.\d{3}\.\d{3}-\d{2}$")) return "CPF incompleto.";
        if ((dados.Telefone ?? "").Length < 14) return "Telefone incompleto.";
        if (!Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$")) return "E-mail inválido.";
        if (!NascimentoValido(dados.Nascimento, out var mensagemData)) return mensagemData;
        if (!Regex.IsMatch(dados.Cep ?? "", @"^\d{5}-\d{3}$")) return "CEP incompleto.";
        if (endereco.Length < 3) return "Informe endereço e número.";
        if ((dados.Senha ?? "").Length < 6) return "A senha precisa ter no mínimo 6 caracteres.";
        return null;
    }

    public static string? ValidarPerfil(PerfilDto dados)
    {
        if ((dados.Nome ?? "").Trim().Length < 3 || (dados.Telefone ?? "").Length < 14)
            return "Verifique nome e telefone.";
        return null;
    }

    public static string? ValidarPedido(NovoPedidoDto pedido)
    {
        if (pedido.Itens is null || pedido.Itens.Count == 0)
            return "Seu carrinho está vazio.";

        foreach (var item in pedido.Itens)
        {
            if (item.Quantidade < 1 || item.Quantidade > 99)
                return "Quantidade inválida.";
        }

        return null;
    }

    public static decimal CalcularTotal(IEnumerable<(decimal Preco, int Quantidade)> itens)
    {
        decimal total = 0;
        foreach (var item in itens)
            total += item.Preco * item.Quantidade;
        return decimal.Round(total, 2);
    }

    private static bool NascimentoValido(string? texto, out string mensagem)
    {
        if (texto is null || texto.Length != 10)
        {
            mensagem = "Data de nascimento incompleta.";
            return false;
        }

        var real = DateTime.TryParseExact(texto, "dd/MM/yyyy", new CultureInfo("pt-BR"), DateTimeStyles.None, out var data);
        if (!real || data.Year < 1900 || data.Date > DateTime.Today)
        {
            mensagem = "Data de nascimento inválida.";
            return false;
        }

        mensagem = "";
        return true;
    }
}

public static class Senha
{
    public static string GerarHash(string senha)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(senha));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static bool Confere(string senha, string hashSalvo)
    {
        var calculado = Encoding.UTF8.GetBytes(GerarHash(senha));
        var salvo = Encoding.UTF8.GetBytes(hashSalvo.Trim().ToLowerInvariant());
        return calculado.Length == salvo.Length && CryptographicOperations.FixedTimeEquals(calculado, salvo);
    }

    public static string NovoToken()
    {
        return Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    }
}
