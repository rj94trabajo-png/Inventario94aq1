const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createUsers() {
  const client = await pool.connect();
  try {
    // Usuarios a crear/actualizar
    const users = [
      {
        username: 'Sector1',
        password: '0marsa20261',
        rol: 'sector',
        sectoresPermitidos: ['Sector 1']
      },
      {
        username: 'Sector2',
        password: '0marsa20262',
        rol: 'sector',
        sectoresPermitidos: ['Sector 2']
      },
      {
        username: 'Sector3',
        password: '0marsa20263',
        rol: 'sector',
        sectoresPermitidos: ['Sector 3']
      },
      {
        username: 'Sector4',
        password: '0marsa20264',
        rol: 'sector',
        sectoresPermitidos: ['Sector 4']
      },
      {
        username: 'Administrador',
        password: 'Admin',
        rol: 'admin',
        sectoresPermitidos: ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4']
      }
    ];

    console.log('Verificando y actualizando usuarios...\n');

    for (const user of users) {
      // Verificar si el usuario ya existe
      const result = await client.query(
        'SELECT * FROM usuarios WHERE username = $1',
        [user.username]
      );

      if (result.rows.length > 0) {
        // Actualizar el usuario existente
        const hashedPassword = await bcrypt.hash(user.password, 10);
        
        await client.query(
          `UPDATE usuarios 
           SET password = $1, rol = $2, sectores_permitidos = $3
           WHERE username = $4`,
          [hashedPassword, user.rol, user.sectoresPermitidos, user.username]
        );
        
        console.log(`✅ Usuario '${user.username}' actualizado exitosamente`);
        console.log(`   - Rol: ${user.rol}`);
        console.log(`   - Sectores permitidos: ${user.sectoresPermitidos.join(', ')}`);
      } else {
        // Crear el usuario
        const hashedPassword = await bcrypt.hash(user.password, 10);
        const id = user.username.toLowerCase() + '-' + Date.now();
        
        await client.query(
          `INSERT INTO usuarios (id, username, password, rol, sectores_permitidos)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, user.username, hashedPassword, user.rol, user.sectoresPermitidos]
        );
        
        console.log(`✅ Usuario '${user.username}' creado exitosamente`);
        console.log(`   - Rol: ${user.rol}`);
        console.log(`   - Sectores permitidos: ${user.sectoresPermitidos.join(', ')}`);
      }
      console.log('');
    }

    // Mostrar todos los usuarios existentes
    console.log('--- Lista de usuarios existentes ---');
    const allUsers = await client.query('SELECT username, rol, sectores_permitidos FROM usuarios ORDER BY username');
    allUsers.rows.forEach(user => {
      console.log(`Usuario: ${user.username}`);
      console.log(`  Rol: ${user.rol}`);
      console.log(`  Sectores: ${user.sectores_permitidos.join(', ')}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error creando/actualizando usuarios:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createUsers();
