const campoBusca = document.querySelector('#busca');
const menu = document.querySelector('#menu');
const botaoMenu = document.querySelector('.botao-menu');
const botaoTema = document.querySelector('#botaoTema');
const contadorCarrinho = document.querySelector('#contadorCarrinho');
const areaUsuario = document.querySelector('#areaUsuario');
const janelaAcesso = document.querySelector('#janelaAcesso');
const formularioLogin = document.querySelector('#formularioLogin');
const formularioCadastro = document.querySelector('#formularioCadastro');
const formularioPerfil = document.querySelector('#formularioPerfil');

function lerArmazenado(chave, padrao) {
  try {
    let valor = localStorage.getItem(chave);
    if (valor) {
      return JSON.parse(valor);
    }
    return padrao;
  } catch (erro) {
    return padrao;
  }
}

function salvarArmazenado(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (erro) {
    console.warn('Não foi possível salvar os dados.');
  }
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lerProdutosDaPagina() {
  let lista = [];
  let cartoes = document.querySelectorAll('#listaProdutos .cartao');

  for (let i = 0; i < cartoes.length; i++) {
    let cartao = cartoes[i];
    let id = Number(cartao.dataset.id);

    lista.push({
      id: id,
      nome: cartao.dataset.nome,
      categoria: cartao.dataset.categoria,
      preco: Number(cartao.dataset.preco),
      imagem: cartao.querySelector('img').getAttribute('src'),
      descricao: cartao.querySelector('p').textContent,
      destaque: id <= 4
    });
  }

  return lista;
}

let PRODUTOS = lerProdutosDaPagina();
let token = localStorage.getItem('rb_token');
let usuario = null;
let carrinho = lerArmazenado('rb_carrinho', {});
let categoriaAtual = 'Todos';
let termoBusca = '';

function formatarReal(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buscarProduto(id) {
  for (let i = 0; i < PRODUTOS.length; i++) {
    if (PRODUTOS[i].id === Number(id)) {
      return PRODUTOS[i];
    }
  }
  return undefined;
}

async function api(caminho, opcoes) {
  opcoes = opcoes || {};

  let cabecalhos = {};
  if (opcoes.body) {
    cabecalhos['Content-Type'] = 'application/json';
  }
  if (token) {
    cabecalhos['Authorization'] = 'Bearer ' + token;
  }

  const resposta = await fetch(caminho, {
    method: opcoes.method || 'GET',
    headers: cabecalhos,
    body: opcoes.body
  });

  const texto = await resposta.text();
  let dados = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch (erro) {
      dados = null;
    }
  }

  if (!resposta.ok) {
    let mensagemErro = 'Não foi possível falar com o servidor.';
    if (dados && dados.mensagem) {
      mensagemErro = dados.mensagem;
    }
    const falha = new Error(mensagemErro);
    falha.status = resposta.status;
    throw falha;
  }

  return dados;
}

function aplicarTema(tema) {
  if (tema === 'escuro') {
    document.documentElement.setAttribute('data-tema', 'escuro');
    botaoTema.textContent = '☀️';
  } else {
    document.documentElement.removeAttribute('data-tema');
    botaoTema.textContent = '🌙';
  }
}

const temaSalvo = lerArmazenado('rb_tema', null);
const sistemaEscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (temaSalvo) {
  aplicarTema(temaSalvo);
} else if (sistemaEscuro) {
  aplicarTema('escuro');
} else {
  aplicarTema('claro');
}

botaoTema.addEventListener('click', function () {
  let temaAtual = 'claro';
  if (document.documentElement.getAttribute('data-tema') === 'escuro') {
    temaAtual = 'escuro';
  }

  let novoTema = 'escuro';
  if (temaAtual === 'escuro') {
    novoTema = 'claro';
  }

  aplicarTema(novoTema);
  salvarArmazenado('rb_tema', novoTema);
});

const mascaras = {
  nome: function (v) {
    return v.replace(/[^A-Za-zÀ-ÿ\s]/g, '');
  },
  numero: function (v) {
    return v.replace(/\D/g, '');
  },
  cpf: function (v) {
    return v.replace(/\D/g, '').slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  },
  telefone: function (v) {
    return v.replace(/\D/g, '').slice(0, 11)
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  },
  cep: function (v) {
    return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
  },
  data: function (v) {
    return v.replace(/\D/g, '').slice(0, 8)
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\d{2})(\d)/, '$1/$2');
  },
  cartao: function (v) {
    return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  },
  validade: function (v) {
    return v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2');
  },
  cvv: function (v) {
    return v.replace(/\D/g, '').slice(0, 4);
  }
};

document.addEventListener('input', function (e) {
  let tipo = e.target.dataset.mascara;
  if (tipo) {
    e.target.value = mascaras[tipo](e.target.value);
  }
});

document.addEventListener('keypress', function (e) {
  let tipo = e.target.dataset.mascara;
  let ehTecla = e.key.length === 1;
  if (tipo && tipo !== 'nome' && ehTecla && !/\d/.test(e.key)) {
    e.preventDefault();
  }
});

function irParaPagina(nome, semHash) {
  if ((nome === 'pedidos' || nome === 'perfil') && !token) {
    abrirJanela('login');
    nome = 'inicio';
  }

  let paginas = document.querySelectorAll('.pagina');
  for (let i = 0; i < paginas.length; i++) {
    paginas[i].classList.toggle('ativo', paginas[i].id === nome);
  }

  let links = document.querySelectorAll('.menu a');
  for (let i = 0; i < links.length; i++) {
    links[i].classList.toggle('ativo', links[i].dataset.pagina === nome);
  }

  menu.classList.remove('aberto');
  if (!semHash) {
    location.hash = nome;
  }

  if (nome === 'carrinho') mostrarCarrinho();
  if (nome === 'pedidos') mostrarPedidos();
  if (nome === 'perfil') carregarPerfil();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', function () {
  let nome = location.hash.slice(1);
  let elemento = document.getElementById(nome);
  if (elemento && elemento.classList.contains('pagina')) {
    irParaPagina(nome, true);
  }
});

botaoMenu.addEventListener('click', function () {
  menu.classList.toggle('aberto');
});

function htmlCartao(produto) {
  return `
    <article class="cartao" data-id="${produto.id}" data-nome="${escapar(produto.nome)}" data-categoria="${escapar(produto.categoria)}" data-preco="${produto.preco}">
      <img class="foto-produto" src="${escapar(produto.imagem)}" alt="${escapar(produto.nome)}" loading="lazy" />
      <h3>${escapar(produto.nome)}</h3>
      <p>${escapar(produto.descricao)}</p>
      <div class="fileira">
        <span class="preco">${formatarReal(produto.preco)}</span>
        <button data-acao="adicionar" data-id="${produto.id}">Adicionar</button>
      </div>
    </article>`;
}

function mostrarProdutos() {
  let encontrados = 0;

  let cartoes = document.querySelectorAll('#listaProdutos .cartao');
  for (let i = 0; i < cartoes.length; i++) {
    let cartao = cartoes[i];
    let texto = cartao.dataset.nome + ' ' + cartao.querySelector('p').textContent;
    let dentroDaCategoria = categoriaAtual === 'Todos' || cartao.dataset.categoria === categoriaAtual;
    let combinaComBusca = texto.toLowerCase().includes(termoBusca);
    let visivel = dentroDaCategoria && combinaComBusca;

    cartao.hidden = !visivel;
    if (visivel) {
      encontrados++;
    }
  }

  let botoes = document.querySelectorAll('#filtros button');
  for (let i = 0; i < botoes.length; i++) {
    botoes[i].classList.toggle('ativo', botoes[i].dataset.categoria === categoriaAtual);
  }

  document.querySelector('#semResultados').hidden = encontrados > 0;
}

async function carregarProdutos() {
  try {
    const lista = await api('/api/produtos');
    if (!Array.isArray(lista) || lista.length === 0) {
      return;
    }

    PRODUTOS = [];
    for (let i = 0; i < lista.length; i++) {
      let p = lista[i];
      PRODUTOS.push({
        id: Number(p.id),
        nome: p.nome,
        descricao: p.descricao,
        categoria: p.categoria,
        preco: Number(p.preco),
        imagem: p.imagem,
        destaque: Boolean(p.destaque)
      });
    }

    let htmlDestaques = '';
    let htmlTodos = '';
    for (let i = 0; i < PRODUTOS.length; i++) {
      if (PRODUTOS[i].destaque) {
        htmlDestaques += htmlCartao(PRODUTOS[i]);
      }
      htmlTodos += htmlCartao(PRODUTOS[i]);
    }

    document.querySelector('#destaques').innerHTML = htmlDestaques;
    document.querySelector('#listaProdutos').innerHTML = htmlTodos;
    mostrarProdutos();
  } catch (erro) {
    console.warn(erro);
  }
}

campoBusca.addEventListener('input', function () {
  termoBusca = campoBusca.value.toLowerCase().trim();
  categoriaAtual = 'Todos';
  mostrarProdutos();
  if (!document.querySelector('#produtos').classList.contains('ativo')) {
    irParaPagina('produtos');
  }
});

function salvarCarrinho() {
  salvarArmazenado('rb_carrinho', carrinho);

  let totalItens = 0;
  for (let id in carrinho) {
    totalItens += carrinho[id];
  }
  contadorCarrinho.textContent = totalItens;
}

function calcularTotal() {
  let soma = 0;
  for (let id in carrinho) {
    let produto = buscarProduto(id);
    if (produto) {
      soma += produto.preco * carrinho[id];
    }
  }
  return soma;
}

function adicionarAoCarrinho(id) {
  if (!buscarProduto(id)) {
    return;
  }
  carrinho[id] = (carrinho[id] || 0) + 1;
  salvarCarrinho();
  alert('Adicionado ao carrinho!');
}

function alterarQuantidade(id, valor) {
  let quantidade = parseInt(valor, 10) || 0;
  if (quantidade <= 0) {
    delete carrinho[id];
  } else {
    carrinho[id] = Math.min(quantidade, 99);
  }
  salvarCarrinho();
  mostrarCarrinho();
}

function mostrarCarrinho() {
  const caixa = document.querySelector('#caixaCarrinho');
  let ids = Object.keys(carrinho);

  if (ids.length === 0) {
    caixa.innerHTML = '<p>Seu carrinho está vazio.</p>';
    return;
  }

  let itens = '';
  for (let i = 0; i < ids.length; i++) {
    let id = ids[i];
    let produto = buscarProduto(id);
    if (!produto) {
      continue;
    }

    itens += `
      <div class="item-lista fileira">
        <span><img class="miniatura" src="${escapar(produto.imagem)}" alt="" /> <b>${escapar(produto.nome)}</b><br>${formatarReal(produto.preco)}</span>
        <span>
          <input class="quantidade" value="${carrinho[id]}" maxlength="2" inputmode="numeric" data-mascara="numero" data-id="${id}" />
          <button class="perigo" data-acao="remover" data-id="${id}">✕</button>
        </span>
        <b>${formatarReal(produto.preco * carrinho[id])}</b>
      </div>`;
  }

  caixa.innerHTML = itens + `
    <div class="fileira total-carrinho">
      <h3>Total: ${formatarReal(calcularTotal())}</h3>
      <button data-acao="finalizar">Finalizar pedido</button>
    </div>`;
}

document.addEventListener('change', function (e) {
  if (e.target.classList.contains('quantidade')) {
    alterarQuantidade(e.target.dataset.id, e.target.value);
  }
});

const FORMAS_PAGAMENTO = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro'];
let formaPagamento = null;
let pedidoPagamento = null;
let totalPagamento = 0;

function pagamentosSalvos() {
  return lerArmazenado('rb_pagamentos', {});
}

document.body.insertAdjacentHTML('beforeend',
  '<div class="janela" id="janelaPagamento"><div class="caixa" id="caixaPagamento"></div></div>');
const janelaPagamento = document.querySelector('#janelaPagamento');
const caixaPagamento = document.querySelector('#caixaPagamento');

function cartaoValido(numero) {
  let digitos = numero.replace(/\D/g, '');
  if (digitos.length !== 16) {
    return false;
  }

  let soma = 0;
  for (let i = 0; i < 16; i++) {
    let n = Number(digitos[15 - i]);
    if (i % 2 === 1) {
      n = n * 2;
      if (n > 9) {
        n = n - 9;
      }
    }
    soma += n;
  }
  return soma % 10 === 0;
}

function htmlCamposPagamento() {
  if (formaPagamento === 'Pix') {
    return '<p>Pague com Pix na entrega: o entregador apresenta o QR Code quando chegar.</p>';
  }

  if (formaPagamento === 'Dinheiro') {
    return `
      <label>Troco para quanto? (R$, opcional)
        <input id="pgTroco" data-mascara="numero" maxlength="5" inputmode="numeric" placeholder="Ex.: 50" />
      </label>`;
  }

  let parcelas = '';
  if (formaPagamento === 'Cartão de crédito') {
    let opcoes = '';
    for (let n = 1; n <= 3; n++) {
      opcoes += '<option value="' + n + '">' + n + 'x de ' + formatarReal(totalPagamento / n) + '</option>';
    }
    parcelas = `
      <label>Parcelas
        <select id="pgParcelas">${opcoes}</select>
      </label>`;
  }

  return `
    <label>Nome no cartão
      <input id="pgNome" data-mascara="nome" maxlength="40" autocomplete="cc-name" />
    </label>
    <label>Número do cartão
      <input id="pgNumero" data-mascara="cartao" maxlength="19" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" />
    </label>
    <div class="fileira linha-campos">
      <label>Validade
        <input id="pgValidade" data-mascara="validade" maxlength="5" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" />
      </label>
      <label>CVV
        <input id="pgCvv" data-mascara="cvv" maxlength="4" inputmode="numeric" autocomplete="cc-csc" placeholder="000" />
      </label>
    </div>
    ${parcelas}`;
}

function mostrarPassoPagamento() {
  let total = formatarReal(totalPagamento);

  if (!formaPagamento) {
    let botoes = '';
    for (let i = 0; i < FORMAS_PAGAMENTO.length; i++) {
      botoes += '<button class="secundario" data-acao="escolher-pagamento" data-forma="' + FORMAS_PAGAMENTO[i] + '">' + FORMAS_PAGAMENTO[i] + '</button>';
    }

    caixaPagamento.innerHTML = `
      <h3>Como você quer pagar?</h3>
      <p>Total do pedido: <b>${total}</b></p>
      <div class="opcoes-pagamento">${botoes}</div>
      <p class="centralizado"><button class="secundario" data-acao="fechar-pagamento">Cancelar</button></p>`;
    return;
  }

  caixaPagamento.innerHTML = `
    <h3>${formaPagamento}</h3>
    <p>Total do pedido: <b>${total}</b></p>
    ${htmlCamposPagamento()}
    <p class="mensagem" id="pagamentoMensagem"></p>
    <div class="fileira">
      <button class="secundario" data-acao="voltar-pagamento">Voltar</button>
      <button data-acao="confirmar-pagamento">Confirmar pedido</button>
    </div>`;
}

function abrirPagamento(pedidoId, total) {
  pedidoPagamento = pedidoId;
  totalPagamento = Number(total) || 0;
  formaPagamento = null;
  mostrarPassoPagamento();
  janelaPagamento.classList.add('ativo');
}

function fecharPagamento() {
  janelaPagamento.classList.remove('ativo');
  caixaPagamento.innerHTML = '';
  formaPagamento = null;
}

function pegarValor(id) {
  let campo = document.querySelector(id);
  if (campo) {
    return campo.value.trim();
  }
  return '';
}

function validarPagamento() {
  if (formaPagamento === 'Dinheiro') {
    let troco = Number(pegarValor('#pgTroco'));
    if (troco && troco < totalPagamento) {
      return 'O valor do troco precisa ser maior que o total do pedido.';
    }
    return '';
  }

  if (formaPagamento === 'Pix') {
    return '';
  }

  if (pegarValor('#pgNome').length < 3) {
    return 'Informe o nome como está no cartão.';
  }
  if (!cartaoValido(pegarValor('#pgNumero'))) {
    return 'Número do cartão inválido.';
  }

  let validade = pegarValor('#pgValidade').match(/^(\d{2})\/(\d{2})$/);
  let hoje = new Date();
  let mes = 0;
  let ano = 0;
  if (validade) {
    mes = Number(validade[1]);
    ano = 2000 + Number(validade[2]);
  }
  let vencido = ano < hoje.getFullYear() || (ano === hoje.getFullYear() && mes < hoje.getMonth() + 1);
  if (!validade || mes < 1 || mes > 12 || vencido) {
    return 'Validade do cartão inválida.';
  }

  if (pegarValor('#pgCvv').length < 3) {
    return 'CVV incompleto.';
  }

  return '';
}

janelaPagamento.addEventListener('click', function (e) {
  if (e.target === janelaPagamento) {
    fecharPagamento();
  }
});

async function finalizarPedido() {
  if (!token) {
    abrirJanela('login');
    return;
  }

  let itens = [];
  for (let id in carrinho) {
    itens.push({
      produtoId: Number(id),
      quantidade: carrinho[id]
    });
  }

  try {
    await api('/api/pedidos', { method: 'POST', body: JSON.stringify({ itens: itens }) });
    carrinho = {};
    salvarCarrinho();
    irParaPagina('pedidos');
  } catch (erro) {
    alert(erro.message);
  }
}

function confirmarPagamento() {
  let erroPagamento = validarPagamento();
  if (erroPagamento) {
    document.querySelector('#pagamentoMensagem').textContent = erroPagamento;
    return;
  }

  let salvos = pagamentosSalvos();
  salvos[pedidoPagamento] = formaPagamento;
  salvarArmazenado('rb_pagamentos', salvos);

  fecharPagamento();
  mostrarPedidos();
}

async function mostrarPedidos() {
  const caixa = document.querySelector('#caixaPedidos');
  try {
    const meusPedidos = await api('/api/pedidos');
    if (meusPedidos.length === 0) {
      caixa.innerHTML = '<p>Você ainda não fez pedidos.</p>';
      return;
    }

    let salvos = pagamentosSalvos();
    let html = '';

    for (let i = 0; i < meusPedidos.length; i++) {
      let p = meusPedidos[i];

      let nomesItens = [];
      for (let j = 0; j < p.itens.length; j++) {
        nomesItens.push(escapar(p.itens[j]));
      }

      html += `
        <div class="item-lista fileira">
          <span>
            <b>Pedido #${String(p.id).slice(-5)}</b> · ${escapar(p.data)}<br>
            ${nomesItens.join(', ')}<br>
            <small>${escapar(p.status)} · Pagamento: ${escapar(salvos[p.id] || 'não informado')}</small>
          </span>
          <span>
            <b>${formatarReal(p.total)}</b>
            <button data-acao="pagamento" data-id="${p.id}" data-total="${p.total}">Forma de pagamento</button>
            <button class="perigo" data-acao="cancelar" data-id="${p.id}">Cancelar</button>
          </span>
        </div>`;
    }

    caixa.innerHTML = html;
  } catch (erro) {
    if (erro.status === 401) {
      sairDaConta();
      return;
    }
    caixa.innerHTML = '<p>' + escapar(erro.message) + '</p>';
  }
}

async function cancelarPedido(id) {
  if (!confirm('Cancelar este pedido?')) {
    return;
  }
  try {
    await api('/api/pedidos/' + id, { method: 'DELETE' });
    mostrarPedidos();
  } catch (erro) {
    alert(erro.message);
  }
}

function abrirJanela(tipo) {
  janelaAcesso.classList.add('ativo');
  formularioLogin.hidden = tipo !== 'login';
  formularioCadastro.hidden = tipo !== 'cadastro';
  document.querySelector('#abaLogin').classList.toggle('ativo', tipo === 'login');
  document.querySelector('#abaCadastro').classList.toggle('ativo', tipo === 'cadastro');
}

function fecharJanela() {
  janelaAcesso.classList.remove('ativo');
}

async function iniciarSessao(novoToken) {
  token = novoToken;
  localStorage.setItem('rb_token', novoToken);
  fecharJanela();
  await carregarUsuario();
  atualizarAreaUsuario();
}

function sairDaConta() {
  token = null;
  usuario = null;
  localStorage.removeItem('rb_token');
  atualizarAreaUsuario();
  irParaPagina('inicio');
}

async function carregarUsuario() {
  if (!token) {
    usuario = null;
    return;
  }

  try {
    usuario = await api('/api/perfil');
  } catch (erro) {
    token = null;
    usuario = null;
    localStorage.removeItem('rb_token');
  }
}

function atualizarAreaUsuario() {
  if (usuario) {
    let primeiroNome = escapar(usuario.nome.split(' ')[0]);
    areaUsuario.innerHTML = `
      <span>Olá, ${primeiroNome}</span>
      <button class="secundario" data-acao="sair">Sair</button>`;
  } else {
    areaUsuario.innerHTML = `
      <button class="secundario" data-acao="abrir-janela" data-tipo="login">Login</button>
      <button data-acao="abrir-janela" data-tipo="cadastro">Cadastro</button>`;
  }
}

formularioLogin.addEventListener('submit', async function (e) {
  e.preventDefault();
  const mensagem = document.querySelector('#loginMensagem');
  mensagem.textContent = '';

  try {
    const dados = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        cpf: document.querySelector('#loginCpf').value,
        senha: document.querySelector('#loginSenha').value
      })
    });
    await iniciarSessao(dados.token);
  } catch (erro) {
    mensagem.textContent = erro.message;
  }
});

formularioCadastro.addEventListener('submit', async function (e) {
  e.preventDefault();

  let rua = document.querySelector('#cadastroEndereco').value.trim();
  let numero = document.querySelector('#cadastroNumero').value;
  let novo = {
    nome: document.querySelector('#cadastroNome').value.trim(),
    cpf: document.querySelector('#cadastroCpf').value,
    telefone: document.querySelector('#cadastroTelefone').value,
    email: document.querySelector('#cadastroEmail').value.trim(),
    nascimento: document.querySelector('#cadastroNascimento').value,
    cep: document.querySelector('#cadastroCep').value,
    endereco: rua + ', ' + numero,
    senha: document.querySelector('#cadastroSenha').value
  };

  let erro = '';
  if (novo.nome.length < 3) erro = 'Informe o nome.';
  else if (novo.cpf.length !== 14) erro = 'CPF incompleto.';
  else if (novo.telefone.length < 14) erro = 'Telefone incompleto.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo.email)) erro = 'E-mail inválido.';
  else if (novo.nascimento.length !== 10) erro = 'Data de nascimento incompleta.';
  else if (novo.cep.length !== 9) erro = 'CEP incompleto.';
  else if (!rua || !numero) erro = 'Informe endereço e número.';
  else if (novo.senha.length < 6) erro = 'A senha precisa ter no mínimo 6 caracteres.';

  const mensagem = document.querySelector('#cadastroMensagem');
  mensagem.textContent = erro;
  if (erro) {
    return;
  }

  try {
    const dados = await api('/api/cadastro', { method: 'POST', body: JSON.stringify(novo) });
    await iniciarSessao(dados.token);
  } catch (falha) {
    mensagem.textContent = falha.message;
  }
});

function carregarPerfil() {
  if (!usuario) {
    return;
  }
  document.querySelector('#perfilNome').value = usuario.nome;
  document.querySelector('#perfilTelefone').value = usuario.telefone;
  document.querySelector('#perfilEndereco').value = usuario.endereco;
  document.querySelector('#perfilMensagem').textContent = '';
}

formularioPerfil.addEventListener('submit', async function (e) {
  e.preventDefault();
  let nome = document.querySelector('#perfilNome').value.trim();
  let telefone = document.querySelector('#perfilTelefone').value;
  const mensagem = document.querySelector('#perfilMensagem');

  if (nome.length < 3 || telefone.length < 14) {
    mensagem.classList.remove('sucesso');
    mensagem.textContent = 'Verifique nome e telefone.';
    return;
  }

  try {
    usuario = await api('/api/perfil', {
      method: 'PUT',
      body: JSON.stringify({
        nome: nome,
        telefone: telefone,
        endereco: document.querySelector('#perfilEndereco').value.trim()
      })
    });
    atualizarAreaUsuario();
    mensagem.classList.add('sucesso');
    mensagem.textContent = 'Dados salvos!';
  } catch (erro) {
    mensagem.classList.remove('sucesso');
    mensagem.textContent = erro.message;
  }
});

async function excluirConta() {
  if (!confirm('Excluir sua conta definitivamente?')) {
    return;
  }
  try {
    await api('/api/conta', { method: 'DELETE' });
    sairDaConta();
  } catch (erro) {
    alert(erro.message);
  }
}

document.addEventListener('click', function (e) {
  if (e.target === janelaAcesso) {
    fecharJanela();
  }

  let alvo = e.target.closest('[data-pagina], [data-acao]');
  if (!alvo) {
    return;
  }

  if (alvo.dataset.pagina) {
    e.preventDefault();
    irParaPagina(alvo.dataset.pagina);
    return;
  }

  let id = Number(alvo.dataset.id);

  switch (alvo.dataset.acao) {
    case 'adicionar': adicionarAoCarrinho(id); break;
    case 'remover': alterarQuantidade(id, 0); break;
    case 'finalizar': finalizarPedido(); break;
    case 'escolher-pagamento': formaPagamento = alvo.dataset.forma; mostrarPassoPagamento(); break;
    case 'voltar-pagamento': formaPagamento = null; mostrarPassoPagamento(); break;
    case 'pagamento': abrirPagamento(id, alvo.dataset.total); break;
    case 'confirmar-pagamento': confirmarPagamento(); break;
    case 'fechar-pagamento': fecharPagamento(); break;
    case 'cancelar': cancelarPedido(id); break;
    case 'filtrar': categoriaAtual = alvo.dataset.categoria; mostrarProdutos(); break;
    case 'abrir-janela': abrirJanela(alvo.dataset.tipo); break;
    case 'fechar-janela': fecharJanela(); break;
    case 'sair': sairDaConta(); break;
    case 'excluir-conta': excluirConta(); break;
  }
});

if (location.protocol === 'file:') {
  alert('Abra o site pelo servidor (http://127.0.0.1:5080 ou o Apache do Ubuntu). O arquivo aberto direto não conversa com o C# nem com o MySQL.');
}

mostrarProdutos();
salvarCarrinho();
atualizarAreaUsuario();

async function iniciar() {
  await carregarUsuario();
  atualizarAreaUsuario();

  let paginaInicial = location.hash.slice(1);
  let elementoPagina = document.getElementById(paginaInicial);
  let paginaValida = elementoPagina && elementoPagina.classList.contains('pagina');

  if (paginaValida) {
    irParaPagina(paginaInicial, true);
  } else {
    irParaPagina('inicio', true);
  }
  await carregarProdutos();
}

iniciar();