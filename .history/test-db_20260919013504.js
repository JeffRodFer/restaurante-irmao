require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : undefined
});

async function testar() {
  try {
    await client.connect();

    const result = await client.query('SELECT NOW() AS agora');

    console.log('✅ PostgreSQL conectado!');
    console.log('Horário do banco:', result.rows[0].agora);
  } catch (error) {
    console.error('❌ Erro ao conectar ao PostgreSQL:');
    console.error(error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

testar();