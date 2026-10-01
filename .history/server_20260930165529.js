'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL;

// Criamos o pool apenas se a URL do banco existir
let pool = null;

if (dbUrl) {
  pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  console.log("Conexão com o banco configurada com sucesso.");

  // Função assíncrona isolada para evitar erros de sintaxe e travamentos
  async function initDatabase() {
    try {
      // 1. Cria as tabelas necessárias
      await pool.query(`
        CREATE TABLE IF NOT EXISTS config (
          id INT PRIMARY KEY DEFAULT 1,
          dados JSONB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pedidos (
          id SERIAL PRIMARY KEY,
          dados JSONB NOT NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS menu_items (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(255) NOT NULL,
          categoria VARCHAR(255) NOT NULL,
          preco NUMERIC(10,2) DEFAULT 0,
          descricao TEXT,
          disponivel BOOLEAN DEFAULT true
        );
      `);
      console.log("✅ Tabelas (config, pedidos, menu_items) criadas/verificadas no PostgreSQL!");

      // 2. Inicializa a tabela config se estiver vazia
      const resConfig = await pool.query('SELECT dados FROM config WHERE id = 1');
      if (resConfig.rowCount === 0 || !resConfig.rows[0].dados.produtos || resConfig.rows[0].dados.produtos.length === 0) {
        const configInicial = {
          restaurante: "Restaurante do Irmão",
          categorias: ["Guarnições", "Proteínas", "Bebidas e Sucos", "Sobremesas"],
          produtos: [
            { id: 1, nome: "Arroz Branco", categoria: "Guarnições", preco: "0.00", descricao: "Acompanhamento" },
            { id: 2, nome: "Feijão Macassar", categoria: "Guarnições", preco: "0.00", descricao: "Acompanhamento" },
            { id: 3, nome: "Escondidinho de Charque", categoria: "Proteínas", preco: "25.00", descricao: "Prato principal" },
            { id: 4, nome: "Frango a Parmegiana", categoria: "Proteínas", preco: "22.00", descricao: "Prato principal" },
            { id: 5, nome: "Suco Natural", categoria: "Bebidas e Sucos", preco: "7.00", descricao: "500ml" }
          ]
        };

        await pool.query(`
          INSERT INTO config (id, dados) 
          VALUES (1, $1) 
          ON CONFLICT (id) DO UPDATE SET dados = $1
        `, [JSON.stringify(configInicial)]);

        console.log("✅ Cardápio inicial populado na tabela config!");
      }

      // 3. Inicializa a tabela menu_items se estiver vazia
      const resMenu = await pool.query('SELECT COUNT(*) FROM menu_items');
      if (parseInt(resMenu.rows[0].count) === 0) {
        const seedQuery = `
          INSERT INTO menu_items (nome, categoria, preco) VALUES
          ('Arroz Branco', 'Guarnições', 0),
          ('Arroz Carioca', 'Guarnições', 0),
          ('Feijão Macassar', 'Guarnições', 0),
          ('Feijão Mulato', 'Guarnições', 0),
          ('Feijão Preto', 'Guarnições', 0),
          ('Legumes', 'Guarnições', 0),
          ('Macarrão', 'Guarnições', 0),
          ('Purê', 'Guarnições', 0),
          ('Salada', 'Guarnições', 0),
          ('Almôndegas ao molho', 'Proteínas', 0),
          ('Empadão de frango', 'Proteínas', 0),
          ('Escondidinho de charque', 'Proteínas', 0),
          ('Feijoada', 'Proteínas', 0),
          ('Fígado acebolado', 'Proteínas', 0),
          ('Frango a Parmegiana', 'Proteínas', 0),
          ('Frango a quatro queijos com calabresa', 'Proteínas', 0),
          ('Frango grelhado', 'Proteínas', 0);
        `;
        await pool.query(seedQuery);
        console.log("✅ Tabela menu_items populada com sucesso!");
      }

    } catch (err) {
      console.error("❌ Erro ao inicializar o banco de dados:", err);
    }
  }

  // Executa a inicialização do banco
  initDatabase();

} else {
  console.log("DATABASE_URL não encontrada. Servidor rodando sem banco local.");
}

const res = await pool.query('SELECT dados FROM config WHERE id = 1');
if (res.rowCount === 0 || !res.rows[0].dados.produtos || res.rows[0].dados.produtos.length === 0) {

  const configInicial = {
    restaurante: "Restaurante do Irmão",
    categorias: ["Guarnições", "Proteínas", "Bebidas e Sucos", "Sobremesas"],
    produtos: [
      { id: 1, nome: "Arroz Branco", categoria: "Guarnições", preco: "0.00", descricao: "Acompanhamento" },
      { id: 2, nome: "Feijão Macassar", categoria: "Guarnições", preco: "0.00", descricao: "Acompanhamento" },
      { id: 3, nome: "Escondidinho de Charque", categoria: "Proteínas", preco: "25.00", descricao: "Prato principal" },
      { id: 4, nome: "Frango a Parmegiana", categoria: "Proteínas", preco: "22.00", descricao: "Prato principal" },
      { id: 5, nome: "Suco Natural", categoria: "Bebidas e Sucos", preco: "7.00", descricao: "500ml" }
    ]
  };

  // Atualiza ou insere o cardápio padrão
  await pool.query(`
          INSERT INTO config (id, dados) 
          VALUES (1, $1) 
          ON CONFLICT (id) DO UPDATE SET dados = $1
        `, [JSON.stringify(configInicial)]);

  console.log("✅ Cardápio inicial populado no banco Neon!");
}

  .catch (err => console.error("❌ Erro ao criar/popular tabelas:", err)); { else {
  console.log("DATABASE_URL não encontrada. Servidor rodando sem banco local.");
}
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const PORT = Number(process.env.PORT || 3000);

  const ROOT = __dirname;
  const PUBLIC_DIR = path.join(ROOT, 'public');
  const DATA_DIR = path.join(ROOT, 'data');
  const STATE_FILE = path.join(DATA_DIR, 'menu-state.json');
  const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

  if (!fs.existsSync(CONFIG_FILE)) {
    const defaultConfig = {
      nomeRestaurante: "Restaurante do Irmão",
      whatsapp: "5581999999999",
      chavePix: "81999999999",
      horarioFuncionamento: {
        abertura: "10:00",
        fechamento: "13:00"
      }
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
  }

  const ADMIN_COOKIE = 'admin_session';

  const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_padrao_123';
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || 'senha_padrao_123';

  if (!JWT_SECRET || !ADMIN_PASSWORD_HASH) {
    console.error(
      'ERRO: configure JWT_SECRET e ADMIN_PASSWORD_HASH no arquivo .env.'
    );

    process.exit(1);
  }

  const BASE_PRICE = 20;
  const DELIVERY_PRICE = 5;


  /* ============================================================ */
  /* NUMERO DE TELEFONE DO RESTAURANTE:                               */
  /* ============================================================ */

  app.post('/api/create-whatsapp-link', (req, res) => {
    // Pega o número protegido das variáveis de ambiente do Render
    const RESTAURANT_PHONE = process.env.RESTAURANT_PHONE || '5581920036280';

    const { orderSummary } = req.body;

    if (!orderSummary) {
      return res.status(400).json({ error: 'Resumo do pedido não fornecido.' });
    }

    // Gera a URL do WhatsApp no servidor
    const encodedText = encodeURIComponent(orderSummary);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${RESTAURANT_PHONE}&text=${encodedText}`;

    return res.json({ url: whatsappUrl });
  });


  /* =========================================================
     CARDÁPIO OFICIAL
     ========================================================= */

  const MENU_BASE = [
    ...[
      'Arroz Branco',
      'Arroz Carioca',
      'Feijão Macassar',
      'Feijão Mulato',
      'Feijão Preto',
      'Legumes',
      'Macarrão',
      'Purê',
      'Salada'
    ].map((nome, i) => ({
      id: `guarnicao-${i + 1}`,
      categoria: 'Guarnições',
      nome,
      preco: 0
    })),

    ...[
      'Almôndegas ao molho',
      'Arrumadinho',
      'Bisteca Suína',
      'Bobó de Camarão',
      'Camarão ao alho e óleo',
      'Costela ao Molho Madeira',
      'Costela no bafo',
      'Cozido (Arroz, pirão, carne e legume)',
      'Creme de bacalhau',
      'Empadão de frango',
      'Escondidinho de charque',
      'Feijoada',
      'Fígado acebolado',
      'Frango a Parmegiana',
      'Frango a quatro queijos com calabresa',
      'Frango grelhado',
      'Frango milanesa',
      'Frango xadrez',
      'Fricassê de frango',
      'Galinha assada',
      'Galinha guisada',
      'Guisado de boi',
      'Omelete de Charque',
      'Panqueca de carne',
      'Panqueca de Frango',
      'Parmegiana de frango',
      'Peixe ao molho',
      'Peixe Frito',
      'Polpetone de carne',
      'Rocambole de frango',
      'Sardinha ao Molho',
      'Sardinha na pressão',
      'Strogonoff de frango',
      'Toscana de frango',
      'Yakisoba Especial'
    ].map((nome, i) => ({
      id: `proteina-${i + 1}`,
      categoria: 'Proteínas',
      nome,
      preco: 0
    })),

    ...[
      ['Antártica', 6],
      ['Antártica Zero', 6],
      ['Coca-Cola Zero', 7],
      ['Coca-Cola Normal', 7],
      ['Fanta', 6],
      ['H2O', 8],
      ['Sprite', 6],
      ['Sprite Zero', 6]
    ].map(([nome, preco], i) => ({
      id: `bebida-gaseificada-${i + 1}`,
      categoria: 'Gaseificadas',
      nome,
      preco
    })),

    {
      id: 'bebida-suco-1',
      categoria: 'Sucos Naturais 350ml',
      nome: 'Laranja natural',
      preco: 6
    },

    ...[
      ['Graviola', 6],
      ['Manga', 6],
      ['Cajá', 6],
      ['Uva', 6],
      ['Acerola', 6],
      ['Mangaba', 6],
      ['Abacaxi com hortelã', 6]
    ].map(([nome, preco], i) => ({
      id: `bebida-polpa-${i + 1}`,
      categoria: 'Polpas 500ml',
      nome,
      preco
    })),

    ...[
      ['Bolo Bem Casado', 8],
      ['Bolo de Chocolate', 8],
      ['Bolo de Pote', 8],
      ['Bolo de Prestígio', 8],
      ['Delícia de Abacaxi', 9],
      ['Mousse de Chocolate', 6],
      ['Mousse de Maracujá', 6],
      ['Mousse de Morango', 6],
      ['Pote da Felicidade', 12],
      ['Pudim', 10],
      ['Torta de chocolate', 10]
    ].map(([nome, preco], i) => ({
      id: `sobremesa-${i + 1}`,
      categoria: 'Sobremesas',
      nome,
      preco
    }))
  ];

  const PRATOS_COMPLETOS = ['Arrumadinho', 'Feijoada', 'Yakisoba'];


  /* =========================================================
     ESTADO DO CARDÁPIO
     ========================================================= */

  function safeReadState() {
    try {
      if (!fs.existsSync(STATE_FILE)) {
        return {};
      }

      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw);

      return parsed && typeof parsed === 'object'
        ? parsed
        : {};

    } catch (err) {
      console.error(
        'Falha ao ler estado do menu:',
        err.message
      );

      return {};
    }
  }


  function writeState(state) {
    fs.mkdirSync(DATA_DIR, {
      recursive: true
    });

    const temp = `${STATE_FILE}.tmp`;

    fs.writeFileSync(
      temp,
      JSON.stringify(state, null, 2),
      'utf8'
    );

    fs.renameSync(
      temp,
      STATE_FILE
    );
  }

  async function publicMenuFromDatabase() {
    const result = await pool.query(`
    SELECT
      id,
      categoria,
      nome,
      preco,
      disponivel
    FROM menu_items
    ORDER BY id
  `);

    return result.rows.map(item => ({
      id: item.id,
      categoria: item.categoria,
      nome: item.nome,
      preco: Number(item.preco),
      disponivel: item.disponivel
    }));
  }

  async function publicMenu() {
    return await publicMenuFromDatabase();
  }


  function catalog() {
    return new Map(
      MENU_BASE.map(item => [
        item.id,
        item
      ])
    );
  }


  /* =========================================================
     FUNÇÕES AUXILIARES
     ========================================================= */

  function money(value) {
    return Number(value).toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL'
      }
    );
  }


  function normalizeText(value, max) {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, max);
  }


  function digits(value) {
    return String(value ?? '')
      .replace(/\D/g, '');
  }


  function escapeWhatsApp(value) {
    return String(value ?? '')
      .replace(/[\r\n]+/g, ' ')
      .trim();
  }


  /* =========================================================
     ASSINATURA DO PEDIDO
     ========================================================= */

  function signOrder(orderId, total) {
    return crypto
      .createHmac(
        'sha256',
        JWT_SECRET
      )
      .update(
        `${orderId}|${total.toFixed(2)}`
      )
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();
  }


  /* =========================================================
     MENSAGEM DO WHATSAPP
     ========================================================= */

  function makeOrderMessage(order) {

    const lines = [];

    lines.push(
      `*${escapeWhatsApp(order.cliente.nome)}*`
    );

    lines.push(
      escapeWhatsApp(
        order.cliente.telefone
      )
    );

    lines.push(
      escapeWhatsApp(
        order.cliente.endereco
      )
    );

    lines.push(
      `Entrega: ${order.entrega ? '(X)' : '( )'}`
    );

    lines.push(
      `Retira: ${order.entrega ? '( )' : '(X)'}`
    );

    lines.push('');


    order.marmitas.forEach((m, index) => {

      lines.push(
        `*Pedido ${String(index + 1).padStart(2, '0')}:*`
      );

      const food = [
        ...m.proteinas.map(
          item => `01 ${item.nome}`
        ),

        ...m.guarnicoes.map(
          item => item.nome
        )
      ];

      lines.push(...food);

      lines.push(
        money(BASE_PRICE)
      );


      if (m.bebidas.length) {

        m.bebidas.forEach(item => {

          lines.push(
            `${String(item.quantidade).padStart(2, '0')} ` +
            `${item.nome} ` +
            `${money(item.preco * item.quantidade)}`
          );

        });
      }


      if (m.sobremesas.length) {

        m.sobremesas.forEach(item => {

          lines.push(
            `${String(item.quantidade).padStart(2, '0')} ` +
            `${item.nome} ` +
            `${money(item.preco * item.quantidade)}`
          );

        });
      }


      if (m.observacao) {

        lines.push(
          `Obs: ${escapeWhatsApp(m.observacao)}`
        );

      }

      lines.push('');
    });


    lines.push(
      '---------------------------------------------------------------------------------'
    );


    order.marmitas.forEach((m, index) => {

      lines.push(
        `Marmita ${String(index + 1).padStart(2, '0')} = ${money(m.total)}`
      );

    });


    if (order.entrega) {

      lines.push(
        `Taxa de entrega = ${money(DELIVERY_PRICE)}`
      );

    }


    lines.push(
      `*Total final ${money(order.total)}*`
    );

    lines.push(
      `Pedido: ${order.id}`
    );

    lines.push(
      `Verificação: ${order.assinatura}`
    );


    return lines.join('\n');
  }


  /* =========================================================
     AUTENTICAÇÃO ADMINISTRATIVA
     ========================================================= */

  function requireAdmin(req, res, next) {

    const token =
      req.cookies[ADMIN_COOKIE];

    if (!token) {

      return res.status(401).json({
        erro: 'Não autenticado.'
      });

    }


    try {

      req.admin =
        jwt.verify(
          token,
          JWT_SECRET
        );

      next();

    } catch {

      return res.status(401).json({
        erro: 'Sessão expirada.'
      });

    }
  }


  /* =========================================================
     PROTEÇÃO DE ORIGEM
     ========================================================= */

  function sameOrigin(req, res, next) {
    const origin = req.get('origin') || req.get('referer');

    if (!origin) {
      return next();
    }

    // Remove barras no final para evitar falhas de comparação
    const cleanOrigin = origin.replace(/\/$/, '');

    const allowedOrigins = [
      'http://localhost:3000',
      'https://sistema-delivery-2wl.onrender.com',
      'https://sistema-delivery-2in1.onrender.com'
    ];

    const isAllowed = allowedOrigins.some(allowed => cleanOrigin.startsWith(allowed));

    if (isAllowed) {
      return next();
    }

    return res.status(403).json({ erro: 'Origem não autorizada.' });
  }


  /* =========================================================
     RATE LIMIT
     ========================================================= */

  const loginLimiter =
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false
    });


  const orderLimiter =
    rateLimit({
      windowMs: 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false
    });


  /* =========================================================
     MIDDLEWARE
     ========================================================= */

  app.disable('x-powered-by');


  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {

          defaultSrc: ["'self'"],

          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com'
          ],

          fontSrc: [
            "'self'",
            'https://fonts.gstatic.com'
          ],

          scriptSrc: [
            "'self'",
            "'unsafe-inline'"
          ],

          imgSrc: [
            "'self'",
            'data:',
            'https:'
          ],

          connectSrc: [
            "'self'"
          ],

          frameAncestors: [
            "'none'"
          ]
        }
      },

      referrerPolicy: {
        policy:
          'strict-origin-when-cross-origin'
      }
    })
  );


  app.use(
    express.json({
      limit: '100kb'
    })
  );


  app.use(cookieParser());

  /* =========================================================
     API DE CONFIGURAÇÕES DO RESTAURANTE
     ========================================================= */

  app.get('/api/config', (req, res) => {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        res.json(JSON.parse(configData));
      } else {
        res.status(404).json({ error: 'Arquivo config.json não encontrado.' });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      res.status(500).json({ error: 'Erro ao carregar configurações do restaurante.' });
    }
  });


  /* =========================================================
     API DO CARDÁPIO
     ========================================================= */

  app.get('/api/menu', async (req, res) => {
    try {
      let itens = [];

      // Tenta buscar da função existente
      try {
        if (typeof publicMenu === 'function') {
          itens = await publicMenu();
        }
      } catch (err) {
        console.warn("Tabela menu_items ainda não existe no Neon. Usando lista padrão.");
      }

      // Se não encontrou itens no banco ou a tabela não existe, usa os itens padrão:
      if (!itens || itens.length === 0) {
        itens = [
          { id: 1, nome: "Arroz Branco", categoria: "Guarnições", preco: 0 },
          { id: 2, nome: "Arroz Carioca", categoria: "Guarnições", preco: 0 },
          { id: 3, nome: "Feijão Macassar", categoria: "Guarnições", preco: 0 },
          { id: 4, nome: "Feijão Mulato", categoria: "Guarnições", preco: 0 },
          { id: 5, nome: "Feijão Preto", categoria: "Guarnições", preco: 0 },
          { id: 6, nome: "Legumes", categoria: "Guarnições", preco: 0 },
          { id: 7, nome: "Macarrão", categoria: "Guarnições", preco: 0 },
          { id: 8, nome: "Purê", categoria: "Guarnições", preco: 0 },
          { id: 9, nome: "Salada", categoria: "Guarnições", preco: 0 },
          { id: 10, nome: "Almôndegas ao molho", categoria: "Proteínas", preco: 0 },
          { id: 11, nome: "Empadão de frango", categoria: "Proteínas", preco: 0 },
          { id: 12, nome: "Escondidinho de charque", categoria: "Proteínas", preco: 0 },
          { id: 13, nome: "Feijoada", categoria: "Proteínas", preco: 0 },
          { id: 14, nome: "Fígado acebolado", categoria: "Proteínas", preco: 0 },
          { id: 15, nome: "Frango a Parmegiana", categoria: "Proteínas", preco: 0 },
          { id: 16, nome: "Frango a quatro queijos com calabresa", categoria: "Proteínas", preco: 0 },
          { id: 17, nome: "Frango grelhado", categoria: "Proteínas", preco: 0 }
        ];
      }

      res.json({
        basePrice: typeof BASE_PRICE !== 'undefined' ? BASE_PRICE : 0,
        deliveryPrice: typeof DELIVERY_PRICE !== 'undefined' ? DELIVERY_PRICE : 0,
        itens
      });

    } catch (error) {
      console.error('Erro geral no /api/menu:', error);
      res.status(500).json({ erro: 'Não foi possível carregar o menu.' });
    }
  });


  /* =========================================================
     API DE VERIFICAÇÃO
     ========================================================= */

  app.post(
    '/api/orders/verify',
    sameOrigin,
    (req, res) => {

      const id =
        normalizeText(
          req.body?.id,
          80
        );

      const total =
        Number(req.body?.total);

      const assinatura =
        normalizeText(
          req.body?.assinatura,
          32
        ).toUpperCase();


      if (
        !id ||
        !Number.isFinite(total) ||
        !assinatura
      ) {

        return res.status(400).json({
          valido: false
        });

      }


      const esperado =
        signOrder(
          id,
          total
        );


      const a =
        Buffer.from(assinatura);

      const b =
        Buffer.from(esperado);


      const valido =
        a.length === b.length &&
        crypto.timingSafeEqual(
          a,
          b
        );


      res.json({
        valido
      });

    }
  );


  /* =========================================================
     API PRINCIPAL DO PEDIDO
     ========================================================= */

  app.post(
    '/api/orders',
    orderLimiter,
    sameOrigin,
    async (req, res) => {

      try {

        const body =
          req.body || {};


        const nome =
          normalizeText(
            body.nome,
            100
          );


        const telefone =
          digits(
            body.telefone
          );


        const endereco =
          normalizeText(
            body.endereco,
            180
          );


        const entrega =
          body.entrega === true;


        const marmitasInput =
          Array.isArray(body.marmitas)
            ? body.marmitas
            : [];


        if (nome.length < 2) {

          return res.status(400).json({
            erro:
              'Informe o nome completo.'
          });

        }


        if (
          telefone.length < 10 ||
          telefone.length > 13
        ) {

          return res.status(400).json({
            erro:
              'Informe um telefone válido.'
          });

        }


        if (endereco.length < 5) {

          return res.status(400).json({
            erro:
              'Informe o endereço de entrega.'
          });

        }


        if (
          !marmitasInput.length ||
          marmitasInput.length > 20
        ) {

          return res.status(400).json({
            erro:
              'Quantidade de marmitas inválida.'
          });

        }


        const menuResult =
          await pool.query(`
    SELECT
      id,
      categoria,
      nome,
      preco,
      disponivel
    FROM menu_items
  `);


        const map =
          new Map(
            menuResult.rows.map(item => [
              item.id,
              {
                id: item.id,
                categoria: item.categoria,
                nome: item.nome,
                preco: Number(item.preco),
                disponivel: item.disponivel
              }
            ])
          );


        const marmitas = [];


        for (
          let i = 0;
          i < marmitasInput.length;
          i++
        ) {

          const input =
            marmitasInput[i] || {};


          const guarnicoesIds =
            Array.isArray(
              input.guarnicoes
            )
              ? input.guarnicoes
              : [];


          const proteinasIds =
            Array.isArray(
              input.proteinas
            )
              ? input.proteinas
              : [];


          const bebidasInput =
            input.bebidas &&
              typeof input.bebidas === 'object'
              ? input.bebidas
              : {};


          const sobremesasInput =
            input.sobremesas &&
              typeof input.sobremesas === 'object'
              ? input.sobremesas
              : {};


          const observacao =
            normalizeText(
              input.observacao,
              90
            );


          if (
            guarnicoesIds.length > 4
          ) {

            return res.status(400).json({
              erro:
                `Marmita ${i + 1}: máximo de 4 guarnições.`
            });

          }


          if (
            proteinasIds.length < 1 ||
            proteinasIds.length > 2
          ) {

            return res.status(400).json({
              erro:
                `Marmita ${i + 1}: escolha 1 ou 2 proteínas.`
            });

          }


          if (
            new Set(guarnicoesIds).size !==
            guarnicoesIds.length
          ) {

            return res.status(400).json({
              erro:
                `Marmita ${i + 1}: guarnição duplicada.`
            });

          }


          if (
            new Set(proteinasIds).size !==
            proteinasIds.length
          ) {

            return res.status(400).json({
              erro:
                `Marmita ${i + 1}: proteína duplicada.`
            });

          }


          function getFood(
            id,
            category
          ) {

            const item =
              map.get(String(id));


            if (
              !item ||
              item.categoria !== category
            ) {

              throw new Error(
                `Marmita ${i + 1}: item inválido.`
              );

            }


            if (
              item.disponivel !== true
            ) {

              throw new Error(
                `Marmita ${i + 1}: ${item.nome} está indisponível.`
              );

            }


            return item;
          }


          let guarnicoes;
          let proteinas;


          try {

            guarnicoes =
              guarnicoesIds.map(
                id =>
                  getFood(
                    id,
                    'Guarnições'
                  )
              );


            proteinas =
              proteinasIds.map(
                id =>
                  getFood(
                    id,
                    'Proteínas'
                  )
              );

          } catch (err) {

            return res.status(400).json({
              erro: err.message
            });

          }


          function parseExtras(
            inputMap,
            categories,
            label
          ) {

            const result = [];


            for (
              const [id, rawQty]
              of Object.entries(inputMap)
            ) {

              const qty =
                Number(rawQty);


              if (
                !Number.isInteger(qty) ||
                qty < 0 ||
                qty > 20
              ) {

                throw new Error(
                  `${label}: quantidade inválida.`
                );

              }


              if (qty === 0) {
                continue;
              }


              const item =
                map.get(String(id));


              if (
                !item ||
                !categories.includes(
                  item.categoria
                )
              ) {

                throw new Error(
                  `${label}: item inválido.`
                );

              }


              if (
                item.disponivel !== true
              ) {

                throw new Error(
                  `${label}: ${item.nome} está indisponível.`
                );

              }

              result.push({
                ...item,
                quantidade: qty
              });

            }


            return result;
          }


          let bebidas;
          let sobremesas;


          try {

            bebidas =
              parseExtras(
                bebidasInput,
                [
                  'Gaseificadas',
                  'Sucos Naturais 350ml',
                  'Polpas 500ml'
                ],
                'Bebida'
              );


            sobremesas =
              parseExtras(
                sobremesasInput,
                [
                  'Sobremesas'
                ],
                'Sobremesa'
              );

          } catch (err) {

            return res.status(400).json({
              erro: err.message
            });

          }


          const extrasTotal =
            bebidas.reduce(
              (sum, x) =>
                sum +
                x.preco *
                x.quantidade,
              0
            )
            +
            sobremesas.reduce(
              (sum, x) =>
                sum +
                x.preco *
                x.quantidade,
              0
            );


          const total =
            BASE_PRICE +
            extrasTotal;


          marmitas.push({

            numero:
              i + 1,

            guarnicoes,

            proteinas,

            bebidas,

            sobremesas,

            observacao,

            total

          });

        }


        const total =
          marmitas.reduce(
            (sum, m) =>
              sum + m.total,
            0
          )
          +
          (
            entrega
              ? DELIVERY_PRICE
              : 0
          );


        const id =
          `RI-${new Date()
            .toISOString()
            .replace(/\D/g, '')
            .slice(0, 14)}-${crypto
              .randomBytes(3)
              .toString('hex')
              .toUpperCase()}`;


        const assinatura =
          signOrder(
            id,
            total
          );


        const order = {

          id,

          assinatura,

          cliente: {
            nome,
            telefone,
            endereco
          },

          entrega,

          marmitas,

          total

        };


        const mensagem =
          makeOrderMessage(
            order
          );


        return res.json({

          ok: true,

          id,

          assinatura,

          total,

          mensagem

        });


      } catch (err) {

        console.error(
          'Erro ao criar pedido:',
          err
        );


        return res.status(500).json({
          erro:
            'Não foi possível calcular o pedido.'
        });

      }

    }
  );


  /* =========================================================
     LOGIN ADMIN
     ========================================================= */

  app.post(
    '/api/admin/login',
    loginLimiter,
    sameOrigin,
    async (req, res) => {
      const username = normalizeText(req.body?.username, 80);
      const password = String(req.body?.password ?? '');

      const envUser = process.env.ADMIN_USER || 'admin';
      const envHash = process.env.ADMIN_PASSWORD_HASH;

      const userOk = username.toLowerCase() === envUser.toLowerCase();

      let passOk = false;
      if (envHash && password) {
        passOk = await bcrypt.compare(password, envHash).catch(() => false);
      }

      if (!userOk || !passOk) {
        return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
      }

      // Gerando o token JWT
      const token = jwt.sign(
        { sub: username, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Salvando o token JWT no Cookie
      res.cookie(ADMIN_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000
      });

      return res.json({ ok: true });
    }
  );


  /* =========================================================
     ADMIN - SESSÃO
     ========================================================= */

  app.get(
    '/api/admin/me',
    requireAdmin,
    (req, res) => {

      res.json({
        ok: true,
        usuario:
          req.admin.sub
      });

    }
  );


  /* =========================================================
     ADMIN - LOGOUT
     ========================================================= */

  app.post(
    '/api/admin/logout',
    sameOrigin,
    (req, res) => {

      res.clearCookie(
        ADMIN_COOKIE,
        {
          httpOnly: true,

          secure:
            process.env.NODE_ENV ===
            'production',

          sameSite: 'lax',

          path: '/'
        }
      );


      res.json({
        ok: true
      });

    }
  );


  /* =========================================================
     ADMIN - ALTERAR DISPONIBILIDADE
     ========================================================= */

  app.put(
    '/api/admin/menu',
    requireAdmin,
    sameOrigin,
    async (req, res) => {

      try {

        const changes =
          req.body?.changes;

        if (
          !Array.isArray(changes) ||
          changes.length >
          MENU_BASE.length
        ) {

          return res.status(400).json({
            erro:
              'Dados de disponibilidade inválidos.'
          });

        }

        const validIds =
          new Set(
            MENU_BASE.map(
              item => item.id
            )
          );

        const seen =
          new Set();

        for (
          const change of changes
        ) {

          if (
            !change ||
            !validIds.has(
              change.id
            ) ||
            typeof change.disponivel !==
            'boolean' ||
            seen.has(change.id)
          ) {

            return res.status(400).json({
              erro:
                'Alteração de menu inválida.'
            });

          }

          seen.add(
            change.id
          );

        }

        for (
          const change of changes
        ) {

          await pool.query(
            `
            UPDATE menu_items
            SET
              disponivel = $1,
              atualizado_em = NOW()
            WHERE id = $2
          `,
            [
              change.disponivel,
              change.id
            ]
          );

        }

        const itens =
          await publicMenu();

        res.json({
          ok: true,
          itens
        });

      } catch (error) {

        console.error(
          'Erro ao atualizar disponibilidade do menu:',
          error
        );

        res.status(500).json({
          erro:
            'Não foi possível salvar o menu.'
        });

      }

    }
  );

  /* =========================================================
     ARQUIVOS DO SITE & FALLBACK
     ========================================================= */

  // Servir arquivos estáticos da pasta public
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

  // Rota fallback para entregar o index.html
  app.use((req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  /* =========================================================
     INICIAR SERVIDOR & ANTI-HIBERNAÇÃO
     ========================================================= */
  app.listen(PORT, () => {
    console.log(`Restaurante do Irmão rodando em http://localhost:${PORT}`);

    // --- ESTRATÉGIA ANTI-HIBERNAÇÃO (SELF-PING DO RENDER) ---
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

    if (RENDER_URL) {
      const PING_INTERVAL = 14 * 60 * 1000; // 14 minutos

      setInterval(async () => {
        try {
          const response = await fetch(`${RENDER_URL}/api/config`);
          console.log(`[Anti-SpinDown] Ping executado com sucesso: Status ${response.status}`);
        } catch (error) {
          console.error('[Anti-SpinDown] Erro ao executar ping:', error.message);
        }
      }, PING_INTERVAL);
    }
  });