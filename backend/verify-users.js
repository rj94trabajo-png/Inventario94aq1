const { pool } = require('./database');

async function verifyUsers() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT username, rol, sectores_permitidos FROM usuarios ORDER BY username');
    console.log('Usuarios registrados en la base de datos:');
    console.log('==========================================');
    result.rows.forEach(user => {
      console.log(`Usuario: ${user.username}`);
      console.log(`Rol: ${user.rol}`);
      console.log(`Sectores permitidos: ${user.sectores_permitidos.join(', ')}`);
      console.log('------------------------------------------');
    });
  } catch (error) {
    console.error('Error verificando usuarios:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyUsers().catch(console.error);
