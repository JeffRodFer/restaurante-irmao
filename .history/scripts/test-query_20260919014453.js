require('dotenv').config();

const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL || '';

const client = new Client({
  connectionString: dbUrl,
  ssl: dbUrl.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined
});

async function testar() {
  try {
    console.log('🔌 Conectando...');

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