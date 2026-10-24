const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// 1. Segurança: Permitir que qualquer frontend converse com este backend (temporário para facilitar)
app.use(cors());
app.use(express.json());

// 2. Conexão com o banco de dados Neon
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 3. Rota de Boas-vindas (para testarmos se está online)
app.get('/', (req, res) => {
    res.send('Backend do Restaurante do Irmão está online e pronto!');
});

// 4. Rota para enviar o cardápio para o Frontend
app.get('/api/produtos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM produtos');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ erro: 'Erro ao buscar os produtos no banco de dados' });
    }
});

// 5. O segredo da Vercel: Exportar em vez de usar app.listen
module.exports = app;