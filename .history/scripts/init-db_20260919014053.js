require('dotenv').config();

const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL || '';

const client = new Client({
  connectionString: dbUrl,
  ssl: dbUrl.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined
});

async function iniciarBanco() {
  try {
    await client.connect();

    console.log('🔌 Conectado ao PostgreSQL.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id VARCHAR(100) PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        categoria VARCHAR(100) NOT NULL,
        preco NUMERIC(10,2),
        disponivel BOOLEAN NOT NULL DEFAULT TRUE,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        cliente_nome VARCHAR(255) NOT NULL,
        telefone VARCHAR(30) NOT NULL,
        endereco TEXT,
        entrega BOOLEAN NOT NULL DEFAULT TRUE,
        taxa_entrega NUMERIC(10,2) NOT NULL DEFAULT 0,
        total NUMERIC(10,2) NOT NULL,
        assinatura VARCHAR(100),
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id VARCHAR(100) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        categoria VARCHAR(100) NOT NULL,
        quantidade INTEGER NOT NULL,
        preco_unitario NUMERIC(10,2) NOT NULL,
        observacao TEXT
      );
    `);

    console.log('✅ Tabela menu_items criada/verificada.');
    console.log('✅ Tabela orders criada/verificada.');
    console.log('✅ Tabela order_items criada/verificada.');
    console.log('');
    console.log('🎉 Banco de dados preparado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao preparar o banco:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

iniciarBanco();