require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL || '';

const client = new Client({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

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

async function migrar() {
  const statePath = path.join(__dirname, '..', 'data', 'menu-state.json');

  try {
    await client.connect();

    console.log('🔌 Conectado ao PostgreSQL.');
    console.log(`📋 Itens no cardápio: ${MENU_BASE.length}`);

    let state = {};

    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      console.log('📂 Estado atual do cardápio carregado.');
    } else {
      console.log('⚠️ menu-state.json não encontrado. Todos os itens ficarão disponíveis.');
    }

    await client.query('BEGIN');

    for (const item of MENU_BASE) {
      const disponivel = state[item.id]?.disponivel ?? true;

      await client.query(
        `
        INSERT INTO menu_items
          (id, nome, categoria, preco, disponivel)
        VALUES
          ($1, $2, $3, $4, $5)
        ON CONFLICT (id)
        DO UPDATE SET
          nome = EXCLUDED.nome,
          categoria = EXCLUDED.categoria,
          preco = EXCLUDED.preco,
          disponivel = EXCLUDED.disponivel,
          atualizado_em = NOW()
        `,
        [
          item.id,
          item.nome,
          item.categoria,
          item.preco,
          disponivel
        ]
      );

      const status = disponivel ? '✅ disponível' : '❌ indisponível';

      console.log(`${status} | ${item.id} | ${item.nome}`);
    }

    await client.query('COMMIT');

    console.log('');
    console.log('🎉 Migração do cardápio concluída!');
    console.log('📊 O PostgreSQL agora possui todos os itens do cardápio.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    console.error('');
    console.error('❌ Erro durante a migração:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

migrar();