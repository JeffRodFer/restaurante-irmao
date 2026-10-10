# 🍽️ Sistema de Delivery Integrado

Uma aplicação Web Full-Stack concebida para otimizar e automatizar o atendimento de um restaurante regional. O sistema oferece um cardápio digital interativo para os clientes e integração direta com o WhatsApp, eliminando atritos no processo de venda e estruturando os pedidos automaticamente para a cozinha.

## 🚀 Funcionalidades Principais

- **Cardápio Digital e Carrinho Dinâmico:** Navegação intuitiva pelos produtos, cálculo em tempo real do total de itens (incluindo taxas de entrega) e interface totalmente responsiva.
- **Integração com WhatsApp:** Os pedidos são validados e enviados de forma automatizada, com uma mensagem estruturada diretamente para a API do WhatsApp do estabelecimento.
- **Painel de Administração Seguro:** Área restrita para gestão do cardápio e configurações, protegida por um sistema de encriptação de senhas.
- **Gestão de Estado:** Comunicação assíncrona robusta entre o cliente e o servidor, garantindo a integridade dos dados através de rotas da API.

## 🛠️ Stack Tecnológico

- **Front-end:** HTML5, CSS3, JavaScript (Vanilla, manipulação avançada de DOM e gestão de estado).
- **Back-end:** Node.js, Express.js.
- **Base de Dados / Estado:** PostgreSQL (Neon) integrado com persistência local em JSON.
- **Segurança:** Sistema de *hash* de senhas (`generate-password-hash.js`) para proteção de rotas administrativas.
- **Infraestrutura:** Render (Deploy da API e Servidor Back-end).

## 📁 Estrutura do Projeto

```text
restaurante-do-irmao/
├── data/             # Gestão de estado e configurações (menu-state.json)
├── public/           # Ficheiros estáticos da interface (index.html)
├── scripts/          # Ferramentas de segurança (generate-password-hash.js)
├── .env.example      # Variáveis de ambiente de referência
├── .gitignore        # Regras de exclusão do Git
├── package.json      # Gestor de dependências Node.js
└── server.js         # Ponto de entrada da API REST (Express)
