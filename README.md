# Restaurante do Irmão — versão segura do pedido

## Estrutura

```text
restaurante-do-irmao/
├── data/
│   └── menu-state.json
├── public/
│   └── index.html
├── scripts/
│   └── generate-password-hash.js
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js

# 🍽️ Sistema de Cardápio Digital & Pedidos via WhatsApp (Multi-tenant)

Uma aplicação Web Full-Stack responsiva desenvolvida para automatizar o processo de pedidos de restaurantes e estabelecimentos locais. O sistema permite navegação intuitiva pelos produtos, cálculo dinâmico de taxas e envio do pedido formatado diretamente para o WhatsApp do estabelecimento.

## 🚀 Funcionalidades

- **Arquitetura Multi-Tenant por Instância:** Configuração centralizada via `data/config.json`, permitindo adaptar a aplicação para diferentes clientes sem alterar o código-fonte.
- **Carrinho Dinâmico & Checkout:** Cálculo em tempo real do total de itens, taxas de entrega e mensagens personalizadas.
- **Integração com WhatsApp:** Envio automatizado do resumo do pedido diretamente para a API do WhatsApp.
- **Backend em Node.js:** Rota de API (`/api/config`) para servir dados operacionais e de pagamento (chave Pix) de forma segura.

## 🛠️ Tecnologias Utilizadas

- **Front-end:** HTML5, CSS3, JavaScript (ES6+, Async/Await, Manipulação do DOM)
- **Back-end:** Node.js, Express
- **Deploy & Hospedagem:** Render / Vercel

## ⚙️ Como Executar o Projeto

1. Clone o repositório:
   ```bash
   git clone [https://github.com/seu-usuario/seu-repositorio.git](https://github.com/seu-usuario/seu-repositorio.git)
