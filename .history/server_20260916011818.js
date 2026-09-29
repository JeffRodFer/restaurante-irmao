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

const app = express();

const PORT = Number(process.env.PORT || 3000);

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'menu-state.json');

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


function publicMenu() {
  const state = safeReadState();

  return MENU_BASE.map(item => ({
    ...item,

    disponivel:
      state[item.id]?.disponivel !== false
  }));
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
  const origin = req.get('origin');
  if (!origin) {
    return next();
  }

  // Lista de origens permitidas (local e Render)
  const allowedOrigins = [
    'http://localhost:3000',
    'https://sistema-delivery-2in1.onrender.com'
  ];

  if (allowedOrigins.includes(origin)) {
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
   API DO CARDÁPIO
   ========================================================= */

app.get(
  '/api/menu',
  (req, res) => {

    res.json({
      basePrice: BASE_PRICE,
      deliveryPrice: DELIVERY_PRICE,
      itens: publicMenu()
    });

  }
);


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
  (req, res) => {

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


      const state =
        safeReadState();


      const map =
        catalog();


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
            state[item.id]?.disponivel === false
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
              state[item.id]?.disponivel === false
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

    const username =
      normalizeText(
        req.body?.username,
        80
      );


    const password =
      String(
        req.body?.password ?? ''
      );


    const expectedUser =
      Buffer.from(
        ADMIN_USER
      );


    const receivedUser =
      Buffer.from(
        username
      );


    const userOk =
      receivedUser.length ===
        expectedUser.length &&
      crypto.timingSafeEqual(
        receivedUser,
        expectedUser
      );


    const userOk = String(username).trim().toLowerCase() === String(ADMIN_USER).trim().toLowerCase();

// Tenta validar por bcrypt; se falhar, tenta comparação direta em texto puro
let passOk = await bcrypt.compare(password, ADMIN_PASSWORD_HASH).catch(() => false);
if (!passOk) {
  passOk = (password === ADMIN_PASSWORD_HASH);
}

if (!userOk || !passOk) {
  return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
}

      return res.status(401).json({
        erro:
          'Usuário ou senha inválidos.'
      });

    }


    const token =
      jwt.sign(
        {
          sub: ADMIN_USER,
          role: 'admin'
        },
        JWT_SECRET,
        {
          expiresIn: '8h'
        }
      );


    res.cookie(
      ADMIN_COOKIE,
      token,
      {

        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          'production',

        sameSite: 'strict',

        maxAge:
          8 * 60 * 60 * 1000,

        path: '/'

      }
    );


    res.json({
      ok: true
    });

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

        sameSite: 'strict',

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
  (req, res) => {

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


    const state =
      safeReadState();


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


      state[change.id] = {
        disponivel:
          change.disponivel
      };

    }


    writeState(
      state
    );


    res.json({
      ok: true,
      itens: publicMenu()
    });

  }
);


/* =========================================================
   ARQUIVOS DO SITE
   ========================================================= */

app.use(
  express.static(
    PUBLIC_DIR,
    {
      extensions: ['html']
    }
  )
);


app.use(
  (req, res) =>
    res.sendFile(
      path.join(
        PUBLIC_DIR,
        'index.html'
      )
    )
);


/* =========================================================
   INICIAR SERVIDOR
   ========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `Restaurante do Irmão rodando em http://localhost:${PORT}`
    );

  }
);