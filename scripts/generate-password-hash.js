'use strict';

const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('Uso: npm run hash-password -- "SUA_SENHA"');
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 12));