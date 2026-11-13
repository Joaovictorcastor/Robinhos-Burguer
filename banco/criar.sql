CREATE DATABASE IF NOT EXISTS robinhos_burguer
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'robinhos'@'127.0.0.1' IDENTIFIED BY 'robinhos123';
CREATE USER IF NOT EXISTS 'robinhos'@'localhost' IDENTIFIED BY 'robinhos123';
GRANT ALL PRIVILEGES ON robinhos_burguer.* TO 'robinhos'@'127.0.0.1';
GRANT ALL PRIVILEGES ON robinhos_burguer.* TO 'robinhos'@'localhost';
FLUSH PRIVILEGES;

USE robinhos_burguer;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(60) NOT NULL,
  cpf CHAR(14) NOT NULL UNIQUE,
  telefone VARCHAR(15) NOT NULL,
  email VARCHAR(80) NOT NULL,
  nascimento CHAR(10) NOT NULL,
  cep CHAR(9) NOT NULL,
  endereco VARCHAR(120) NOT NULL,
  senha_hash CHAR(64) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produtos (
  id INT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL,
  descricao VARCHAR(180) NOT NULL,
  categoria VARCHAR(40) NOT NULL,
  preco DECIMAL(10,2) NOT NULL,
  imagem VARCHAR(120) NOT NULL,
  destaque TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Em preparo',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedidos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade INT NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_itens_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  CONSTRAINT fk_itens_produto FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE TABLE IF NOT EXISTS sessoes (
  token CHAR(64) PRIMARY KEY,
  usuario_id INT NOT NULL,
  expira_em DATETIME NOT NULL,
  CONSTRAINT fk_sessoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

INSERT IGNORE INTO produtos (id, nome, descricao, categoria, preco, imagem, destaque) VALUES
(1, 'Clássico Robinho', 'Blend 160g, queijo, alface e tomate', 'Hambúrguer', 24.90, 'img/Produto 1.jpg', 1),
(2, 'Duplo Cheddar', '2 carnes, cheddar cremoso e bacon', 'Hambúrguer', 32.90, 'img/Produto 2.jpg', 1),
(3, 'Burguer Veggie', 'Grão-de-bico, rúcula e molho verde', 'Hambúrguer', 27.90, 'img/Produto 3.jpg', 1),
(4, 'Chicken Crispy', 'Frango empanado e maionese da casa', 'Hambúrguer', 26.90, 'img/Produto 4.jpg', 1),
(5, 'Batata Frita', 'Porção crocante de 300g', 'Acompanhamento', 14.90, 'img/Produto 5.jpg', 0),
(6, 'Onion Rings', 'Anéis de cebola empanados', 'Acompanhamento', 16.90, 'img/Produto 6.jpg', 0),
(7, 'Refrigerante', 'Lata 350ml', 'Bebida', 7.50, 'img/Produto 7.jpg', 0),
(8, 'Milkshake', 'Chocolate, morango ou baunilha', 'Bebida', 18.90, 'img/Produto 8.jpg', 0),
(9, 'Robinho’s Triplo', '3 carnes, queijo e molho especial da casa', 'Hambúrguer', 39.90, 'img/Produto 9.jpg', 0),
(10, 'Robinho’s X-Tudo', 'Carne, ovo, bacon, presunto, queijo e salada', 'Hambúrguer', 36.90, 'img/Produto 10.jpg', 0),
(11, 'Robinho’s Pimenta', 'Carne, queijo e pimenta jalapeño', 'Hambúrguer', 34.90, 'img/Produto 11.jpg', 0),
(12, 'Robinho’s Simples', 'Pão, carne e queijo, do jeito tradicional', 'Hambúrguer', 19.90, 'img/Produto 12.jpg', 0),
(13, 'Robinho’s Barbecue', 'Carne com molho barbecue e cebola caramelizada', 'Hambúrguer', 29.90, 'img/Produto 13.jpg', 0),
(14, 'Robinho’s Bacon', 'Carne com bacon crocante em dobro', 'Hambúrguer', 31.90, 'img/Produto 14.jpg', 0),
(15, 'Robinho’s Mini', 'Versão menor, ideal para um lanche rápido', 'Hambúrguer', 22.90, 'img/Produto 15.jpg', 0),
(16, 'Robinho’s Frango Grill', 'Frango grelhado, alface e maionese temperada', 'Hambúrguer', 27.90, 'img/Produto 16.jpg', 0),
(17, 'Batata Robinho’s', 'Batatas rústicas com tempero da casa', 'Acompanhamento', 15.90, 'img/Produto 17.jpg', 0),
(18, 'Nuggets Robinho’s', '10 unidades de frango empanado', 'Acompanhamento', 17.90, 'img/Produto 18.jpg', 0),
(19, 'Mini Pastéis Robinho’s', 'Porção com 8 pastéis de queijo', 'Acompanhamento', 12.90, 'img/Produto 19.jpg', 0),
(20, 'Salada Robinho’s', 'Mix de folhas, tomate e molho de ervas', 'Acompanhamento', 11.90, 'img/Produto 20.jpg', 0),
(21, 'Suco Robinho’s', 'Laranja natural 400ml', 'Bebida', 9.90, 'img/Produto 21.jpg', 0),
(22, 'Água com Gás Robinho’s', 'Garrafa 500ml', 'Bebida', 5.90, 'img/Produto 22.jpg', 0),
(23, 'Café Robinho’s', 'Café coado fresquinho 200ml', 'Bebida', 8.90, 'img/Produto 23.jpg', 0),
(24, 'Sundae Robinho’s', 'Sorvete de creme com calda de chocolate', 'Sobremesa', 13.90, 'img/Produto 24.jpg', 0),
(25, 'Brownie Robinho’s', 'Brownie de chocolate com calda quente', 'Sobremesa', 16.90, 'img/Produto 25.jpg', 0);

INSERT IGNORE INTO usuarios (nome, cpf, telefone, email, nascimento, cep, endereco, senha_hash)
VALUES (
  'Cliente Exemplo',
  '123.456.789-09',
  '(31) 98888-7777',
  'cliente@robinhos.com',
  '01/01/2000',
  '30130-000',
  'Rua do Sabor, 100',
  '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
);
