const { pool } = require('./database');
const bcrypt = require('bcrypt');

async function seedUsers() {
  const client = await pool.connect();
  try {
    // Hash passwords
    const passwordSector1 = await bcrypt.hash('0marsa20261', 10);
    const passwordSector2 = await bcrypt.hash('0marsa20262', 10);
    const passwordSector3 = await bcrypt.hash('0marsa20263', 10);
    const passwordSector4 = await bcrypt.hash('0marsa20264', 10);
    const passwordAdmin = await bcrypt.hash('Admin', 10);

    // Delete existing users
    await client.query('DELETE FROM usuarios');

    // Insert users
    const users = [
      {
        id: 'user-sector-1',
        username: 'Sector1',
        password: passwordSector1,
        rol: 'sector',
        sectores_permitidos: ['Sector 1']
      },
      {
        id: 'user-sector-2',
        username: 'Sector2',
        password: passwordSector2,
        rol: 'sector',
        sectores_permitidos: ['Sector 2']
      },
      {
        id: 'user-sector-3',
        username: 'Sector3',
        password: passwordSector3,
        rol: 'sector',
        sectores_permitidos: ['Sector 3']
      },
      {
        id: 'user-sector-4',
        username: 'Sector4',
        password: passwordSector4,
        rol: 'sector',
        sectores_permitidos: ['Sector 4']
      },
      {
        id: 'user-admin',
        username: 'Administrador',
        password: passwordAdmin,
        rol: 'admin',
        sectores_permitidos: ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4']
      }
    ];

    for (const user of users) {
      await client.query(
        `INSERT INTO usuarios (id, username, password, rol, sectores_permitidos)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, user.username, user.password, user.rol, user.sectores_permitidos]
      );
      console.log(`✅ Usuario ${user.username} creado`);
    }

    console.log('✅ Todos los usuarios han sido creados exitosamente');
  } catch (error) {
    console.error('❌ Error creando usuarios:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedUsers().catch(console.error);
