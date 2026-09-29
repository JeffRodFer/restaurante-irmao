require('dotenv').config();

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testar() {
  try {
    console.log('🔌 Conectando ao PostgreSQL...');

    await client.connect();

    console.log('✅ Conectado!');
    console.log('🔎 Executando consulta...');

    const result = await client.query('SELECT 1 AS teste');

    console.log('✅ Consulta executada!');
    console.log(result.rows);
  } catch (error) {
    console.error('❌ Erro:');
    console.error(error);
  } finally {
    await client.end().catch(() => {});
  }
}

testar();