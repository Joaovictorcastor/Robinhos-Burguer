#!/bin/bash
# Publica o Robinho's Burguer no Ubuntu: MySQL + API C# + Apache2.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

sudo apt update
sudo apt install -y apache2 mysql-server
if ! command -v dotnet >/dev/null 2>&1; then
  sudo apt install -y dotnet-sdk-8.0
fi

sudo systemctl enable --now mysql
sudo mysql < "$RAIZ/banco/criar.sql"

dotnet publish "$RAIZ/api/RobinhosBurguer.csproj" -c Release -o "$RAIZ/publicar/saida"

sudo rm -rf /opt/robinhos
sudo mkdir -p /opt/robinhos
sudo cp -a "$RAIZ/publicar/saida/." /opt/robinhos/
sudo chown -R www-data:www-data /opt/robinhos

DOTNET="$(command -v dotnet)"
sudo sed "s|/usr/bin/dotnet|$DOTNET|" "$RAIZ/publicar/robinhos-api.service" | sudo tee /etc/systemd/system/robinhos-api.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now robinhos-api
sudo systemctl restart robinhos-api

sudo a2enmod proxy proxy_http
sudo cp "$RAIZ/publicar/apache-robinhos.conf" /etc/apache2/sites-available/robinhos.conf
sudo a2dissite 000-default.conf || true
sudo a2ensite robinhos.conf
sudo systemctl reload apache2

echo
echo "Site publicado: http://localhost/"
echo "Login de teste: CPF 123.456.789-09  senha 123456"
