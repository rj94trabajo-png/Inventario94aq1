const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS configurado
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log('🌐 Request origin:', origin);
  console.log('🌐 Request path:', req.path);
  
  // En producción, no necesitamos CORS porque frontend y backend están en el mismo dominio
  // En desarrollo, permitir el origen específico
  if (origin && (process.env.NODE_ENV !== 'production' && process.env.RENDER !== 'true')) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled');
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(require('path').join(__dirname, '..'), {
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Inicializar base de datos
initDatabase().catch(console.error);

// Migración: Eliminar restricción UNIQUE de instalaciones_sensores
async function migrateDatabase() {
  try {
    const client = await pool.connect();
    try {
      // Intentar eliminar la restricción UNIQUE si existe
      await client.query(`
        ALTER TABLE instalaciones_sensores
        DROP CONSTRAINT IF EXISTS instalaciones_sensores_piscina_numero_sf200_zona_key
      `);
      console.log('✅ Migración aplicada: UNIQUE constraint eliminada de instalaciones_sensores');
    } catch (error) {
      console.log('ℹ️ Nota: La restricción UNIQUE podría no existir o tener otro nombre:', error.message);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error ejecutando migración:', error);
  }
}

// Ejecutar migración después de inicializar la base de datos
setTimeout(() => {
  migrateDatabase().catch(console.error);
}, 2000);

// Crear usuarios automáticamente si no existen
async function ensureUsersExist() {
  const bcrypt = require('bcrypt');
  try {
    console.log('🔍 Verificando usuarios en la base de datos...');
    const client = await pool.connect();
    try {
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

      for (const user of users) {
        console.log(`🔍 Verificando usuario: ${user.username}`);
        const result = await client.query(
          'SELECT * FROM usuarios WHERE username = $1',
          [user.username]
        );

        if (result.rows.length === 0) {
          console.log(`📝 Creando usuario: ${user.username}`);
          const hashedPassword = await bcrypt.hash(user.password, 10);
          const id = user.username.toLowerCase() + '-' + Date.now();
          
          await client.query(
            'INSERT INTO usuarios (id, username, password, rol, sectores_permitidos) VALUES ($1, $2, $3, $4, $5)',
            [id, user.username, hashedPassword, user.rol, user.sectoresPermitidos]
          );
          
          console.log(`✅ Usuario '${user.username}' creado automáticamente`);
        } else {
          console.log(`✅ Usuario '${user.username}' ya existe`);
        }
      }
      console.log('✅ Verificación de usuarios completada');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error verificando usuarios:', error);
  }
}

ensureUsersExist();

// Middleware de autenticación JWT
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'aq1-secret-key-2024');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Middleware de verificación de permisos por sector
const checkSectorPermission = (req, res, next) => {
  const user = req.user;
  
  // El administrador tiene acceso a todos los sectores
  if (user.rol === 'admin') {
    return next();
  }
  
  // Obtener el sector de la solicitud
  const sector = req.body.sector || req.query.sector;
  
  if (!sector) {
    return res.status(400).json({ error: 'Sector no especificado' });
  }
  
  // Verificar si el usuario tiene permiso para este sector
  // Normalizar ambos valores para comparación (eliminar espacios extras)
  const normalizedSector = sector.replace(/\s+/g, ' ').trim();
  const normalizedPermittedSectors = user.sectoresPermitidos.map(s => s.replace(/\s+/g, ' ').trim());
  
  if (!normalizedPermittedSectors.includes(normalizedSector)) {
    return res.status(403).json({ error: 'No tienes permiso para acceder a este sector' });
  }
  
  next();
};

// Aplicar middleware de autenticación a todas las rutas de la API excepto login, logout y session
app.use('/api', (req, res, next) => {
  // Rutas públicas que no requieren autenticación
  const publicRoutes = ['/login', '/logout', '/session'];
  if (publicRoutes.includes(req.path)) {
    next();
  } else {
    requireAuth(req, res, next);
  }
});

// --- PISCINAS ---

// Obtener todas las piscinas
app.get('/api/piscinas', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = 'SELECT * FROM piscinas';
    const params = [];
    
    if (sector) {
      query += ' WHERE sector = $1';
      params.push(sector);
    }
    
    query += ' ORDER BY numero::int';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo piscinas:', error);
    res.status(500).json({ error: 'Error al obtener piscinas' });
  }
});

// Obtener una piscina por ID
app.get('/api/piscinas/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM piscinas WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Piscina no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo piscina:', error);
    res.status(500).json({ error: 'Error al obtener piscina' });
  }
});

// Crear o actualizar piscina
app.post('/api/piscinas', checkSectorPermission, async (req, res) => {
  const { id, sector, numero, nombre } = req.body;
  
  try {
    // Verificar si ya existe una piscina con este ID
    const existingCheck = await pool.query('SELECT id FROM piscinas WHERE id = $1', [id]);
    
    let result;
    if (existingCheck.rows.length > 0) {
      // Si existe, actualizar
      const query = `
        UPDATE piscinas 
        SET sector = $1, numero = $2, nombre = $3
        WHERE id = $4
        RETURNING *
      `;
      result = await pool.query(query, [sector, numero, nombre, id]);
    } else {
      // Si no existe, insertar
      const query = `
        INSERT INTO piscinas (id, sector, numero, nombre)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sector, numero) 
        DO UPDATE SET nombre = EXCLUDED.nombre
        RETURNING *
      `;
      result = await pool.query(query, [id, sector, numero, nombre]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando piscina:', error);
    res.status(500).json({ error: 'Error al guardar piscina' });
  }
});

// Actualizar piscina
app.put('/api/piscinas/:id', async (req, res) => {
  const { sector, numero, nombre } = req.body;
  
  try {
    const query = `
      UPDATE piscinas 
      SET sector = $1, numero = $2, nombre = $3
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [sector, numero, nombre, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Piscina no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando piscina:', error);
    res.status(500).json({ error: 'Error al actualizar piscina' });
  }
});

// Eliminar piscina
app.delete('/api/piscinas/:id', checkSectorPermission, async (req, res) => {
  try {
    await pool.query('DELETE FROM piscinas WHERE id = $1', [req.params.id]);
    res.json({ message: 'Piscina eliminada' });
  } catch (error) {
    console.error('Error eliminando piscina:', error);
    res.status(500).json({ error: 'Error al eliminar piscina' });
  }
});

// --- MOTORES ---

// Obtener todos los motores
app.get('/api/motores', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = 'SELECT * FROM motores';
    const params = [];
    
    if (sector) {
      query += ' WHERE sector = $1';
      params.push(sector);
    }
    
    query += ' ORDER BY codigo';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo motores:', error);
    res.status(500).json({ error: 'Error al obtener motores' });
  }
});

// Obtener un motor por ID
app.get('/api/motores/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM motores WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Motor no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo motor:', error);
    res.status(500).json({ error: 'Error al obtener motor' });
  }
});

// Obtener motor por código
app.get('/api/motores/codigo/:codigo', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM motores WHERE codigo = $1', [req.params.codigo]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Motor no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo motor por código:', error);
    res.status(500).json({ error: 'Error al obtener motor' });
  }
});

// Crear motor
app.post('/api/motores', checkSectorPermission, async (req, res) => {
  const { id, sector, codigo, estado_motor, piscina_id } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!codigo) return res.status(400).json({ error: 'El código es requerido' });
  if (!estado_motor) return res.status(400).json({ error: 'El estado del motor es requerido' });
  
  try {
    // Convertir string vacío a null
    const piscinaIdValue = piscina_id && piscina_id.trim() !== '' ? piscina_id : null;
    
    // Verificar si ya existe un motor con este ID
    const existingCheck = await pool.query('SELECT id FROM motores WHERE id = $1', [id]);
    
    let result;
    if (existingCheck.rows.length > 0) {
      // Si existe, actualizar
      const query = `
        UPDATE motores 
        SET sector = $1, codigo = $2, estado_motor = $3, piscina_id = $4
        WHERE id = $5
        RETURNING *
      `;
      result = await pool.query(query, [sector, codigo, estado_motor, piscinaIdValue, id]);
    } else {
      // Si no existe, insertar
      const query = `
        INSERT INTO motores (id, sector, codigo, estado_motor, piscina_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (codigo) 
        DO UPDATE SET sector = EXCLUDED.sector, estado_motor = EXCLUDED.estado_motor, piscina_id = EXCLUDED.piscina_id
        RETURNING *
      `;
      result = await pool.query(query, [id, sector, codigo, estado_motor, piscinaIdValue]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando motor:', error);
    res.status(500).json({ error: 'Error al guardar motor: ' + error.message });
  }
});

// Actualizar motor
app.put('/api/motores/:id', async (req, res) => {
  const { sector, codigo, estado_motor, piscina_id } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!codigo) return res.status(400).json({ error: 'El código es requerido' });
  if (!estado_motor) return res.status(400).json({ error: 'El estado del motor es requerido' });
  
  try {
    // Convertir string vacío a null
    const piscinaIdValue = piscina_id && piscina_id.trim() !== '' ? piscina_id : null;
    
    const query = `
      UPDATE motores 
      SET sector = $1, codigo = $2, estado_motor = $3, piscina_id = $4
      WHERE id = $5
      RETURNING *
    `;
    const result = await pool.query(query, [sector, codigo, estado_motor, piscinaIdValue, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Motor no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando motor:', error);
    res.status(500).json({ error: 'Error al actualizar motor: ' + error.message });
  }
});

// Eliminar motor
app.delete('/api/motores/:id', checkSectorPermission, async (req, res) => {
  try {
    await pool.query('DELETE FROM motores WHERE id = $1', [req.params.id]);
    res.json({ message: 'Motor eliminado' });
  } catch (error) {
    console.error('Error eliminando motor:', error);
    res.status(500).json({ error: 'Error al eliminar motor' });
  }
});

// --- EQUIPOS ---

// Obtener todos los equipos
app.get('/api/equipos', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = 'SELECT * FROM equipos';
    const params = [];
    
    if (sector) {
      query += ' WHERE sector = $1';
      params.push(sector);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo equipos:', error);
    res.status(500).json({ error: 'Error al obtener equipos' });
  }
});

// Obtener un equipo por ID
app.get('/api/equipos/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM equipos WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo equipo:', error);
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
});

// Obtener equipo por sector y piscina
app.get('/api/equipos/sector/:sector/piscina/:piscinaId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM equipos WHERE sector = $1 AND piscina_id = $2',
      [req.params.sector, req.params.piscinaId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo equipo por sector y piscina:', error);
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
});

// Crear equipo
app.post('/api/equipos', checkSectorPermission, async (req, res) => {
  const { id, sector, piscina_id, estado_piscina, tolvas, sf200, hidrofos, motores, estado_ema } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!piscina_id) return res.status(400).json({ error: 'La piscina es requerida' });
  if (!estado_piscina) return res.status(400).json({ error: 'El estado de piscina es requerido' });
  if (!estado_ema) return res.status(400).json({ error: 'El estado EMA es requerido' });
  
  try {
    // Convertir valores vacíos a null para campos numéricos opcionales
    const tolvasValue = tolvas !== undefined && tolvas !== '' ? parseInt(tolvas) || 0 : 0;
    const sf200Value = sf200 !== undefined && sf200 !== '' ? parseFloat(sf200) || 0 : 0;
    const hidrofosValue = hidrofos !== undefined && hidrofos !== '' ? parseInt(hidrofos) || 0 : 0;
    const motoresValue = motores !== undefined && motores !== '' ? parseInt(motores) || 0 : 0;
    
    // Verificar si ya existe un equipo con este ID
    const existingCheck = await pool.query('SELECT id FROM equipos WHERE id = $1', [id]);
    
    let result;
    if (existingCheck.rows.length > 0) {
      // Si existe, actualizar
      const query = `
        UPDATE equipos 
        SET sector = $1, piscina_id = $2, estado_piscina = $3, tolvas = $4, sf200 = $5, hidrofos = $6, motores = $7, estado_ema = $8
        WHERE id = $9
        RETURNING *
      `;
      result = await pool.query(query, [sector, piscina_id, estado_piscina, tolvasValue, sf200Value, hidrofosValue, motoresValue, estado_ema, id]);
    } else {
      // Si no existe, insertar
      const query = `
        INSERT INTO equipos (id, sector, piscina_id, estado_piscina, tolvas, sf200, hidrofos, motores, estado_ema)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (sector, piscina_id) 
        DO UPDATE SET estado_piscina = EXCLUDED.estado_piscina, tolvas = EXCLUDED.tolvas, sf200 = EXCLUDED.sf200, hidrofos = EXCLUDED.hidrofos, motores = EXCLUDED.motores, estado_ema = EXCLUDED.estado_ema
        RETURNING *
      `;
      result = await pool.query(query, [id, sector, piscina_id, estado_piscina, tolvasValue, sf200Value, hidrofosValue, motoresValue, estado_ema]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando equipo:', error);
    res.status(500).json({ error: 'Error al guardar equipo: ' + error.message });
  }
});

// Actualizar equipo
app.put('/api/equipos/:id', checkSectorPermission, async (req, res) => {
  const { sector, piscina_id, estado_piscina, tolvas, sf200, hidrofos, motores, estado_ema } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!piscina_id) return res.status(400).json({ error: 'La piscina es requerida' });
  if (!estado_piscina) return res.status(400).json({ error: 'El estado de piscina es requerido' });
  if (!estado_ema) return res.status(400).json({ error: 'El estado EMA es requerido' });
  
  try {
    // Convertir valores vacíos a null para campos numéricos opcionales
    const tolvasValue = tolvas !== undefined && tolvas !== '' ? parseInt(tolvas) || 0 : 0;
    const sf200Value = sf200 !== undefined && sf200 !== '' ? parseFloat(sf200) || 0 : 0;
    const hidrofosValue = hidrofos !== undefined && hidrofos !== '' ? parseInt(hidrofos) || 0 : 0;
    const motoresValue = motores !== undefined && motores !== '' ? parseInt(motores) || 0 : 0;
    
    const query = `
      UPDATE equipos 
      SET sector = $1, piscina_id = $2, estado_piscina = $3, tolvas = $4, sf200 = $5, hidrofos = $6, motores = $7, estado_ema = $8
      WHERE id = $9
      RETURNING *
    `;
    const result = await pool.query(query, [sector, piscina_id, estado_piscina, tolvasValue, sf200Value, hidrofosValue, motoresValue, estado_ema, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando equipo:', error);
    res.status(500).json({ error: 'Error al actualizar equipo: ' + error.message });
  }
});

// Eliminar equipo
app.delete('/api/equipos/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM equipos WHERE id = $1', [req.params.id]);
    res.json({ message: 'Equipo eliminado' });
  } catch (error) {
    console.error('Error eliminando equipo:', error);
    res.status(500).json({ error: 'Error al eliminar equipo' });
  }
});

// --- MODELOS DE BATERÍAS ---

// Obtener todos los modelos de baterías
app.get('/api/modelos-baterias', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = 'SELECT * FROM modelos_baterias';
    const params = [];
    
    if (sector) {
      query += ' WHERE sector = $1';
      params.push(sector);
    }
    
    query += ' ORDER BY nombre, amperaje';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo modelos de baterías:', error);
    res.status(500).json({ error: 'Error al obtener modelos de baterías' });
  }
});

// Obtener un modelo de batería por ID
app.get('/api/modelos-baterias/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM modelos_baterias WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Modelo de batería no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo modelo de batería:', error);
    res.status(500).json({ error: 'Error al obtener modelo de batería' });
  }
});

// Crear modelo de batería
app.post('/api/modelos-baterias', checkSectorPermission, async (req, res) => {
  const { id, sector, nombre, amperaje } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  if (!amperaje) return res.status(400).json({ error: 'El amperaje es requerido' });
  if (!/^\d+$/.test(amperaje.toString())) return res.status(400).json({ error: 'El amperaje debe ser un número' });
  if (/\s/.test(nombre)) return res.status(400).json({ error: 'El nombre no puede contener espacios' });
  
  try {
    // Verificar si ya existe un modelo de batería con este ID
    const existingCheck = await pool.query('SELECT id FROM modelos_baterias WHERE id = $1', [id]);
    
    let result;
    if (existingCheck.rows.length > 0) {
      // Si existe, actualizar
      const query = `
        UPDATE modelos_baterias 
        SET sector = $1, nombre = $2, amperaje = $3
        WHERE id = $4
        RETURNING *
      `;
      result = await pool.query(query, [sector, nombre, amperaje, id]);
    } else {
      // Si no existe, insertar
      const query = `
        INSERT INTO modelos_baterias (id, sector, nombre, amperaje)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sector, nombre, amperaje) 
        DO UPDATE SET nombre = EXCLUDED.nombre, amperaje = EXCLUDED.amperaje
        RETURNING *
      `;
      result = await pool.query(query, [id, sector, nombre, amperaje]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando modelo de batería:', error);
    res.status(500).json({ error: 'Error al guardar modelo de batería: ' + error.message });
  }
});

// Actualizar modelo de batería
app.put('/api/modelos-baterias/:id', async (req, res) => {
  const { sector, nombre, amperaje } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  if (!amperaje) return res.status(400).json({ error: 'El amperaje es requerido' });
  if (!/^\d+$/.test(amperaje.toString())) return res.status(400).json({ error: 'El amperaje debe ser un número' });
  if (/\s/.test(nombre)) return res.status(400).json({ error: 'El nombre no puede contener espacios' });
  
  try {
    const query = `
      UPDATE modelos_baterias 
      SET sector = $1, nombre = $2, amperaje = $3
      WHERE id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [sector, nombre, amperaje, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Modelo de batería no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando modelo de batería:', error);
    res.status(500).json({ error: 'Error al actualizar modelo de batería: ' + error.message });
  }
});

// Eliminar modelo de batería
app.delete('/api/modelos-baterias/:id', checkSectorPermission, async (req, res) => {
  try {
    await pool.query('DELETE FROM modelos_baterias WHERE id = $1', [req.params.id]);
    res.json({ message: 'Modelo de batería eliminado' });
  } catch (error) {
    console.error('Error eliminando modelo de batería:', error);
    res.status(500).json({ error: 'Error al eliminar modelo de batería' });
  }
});

// --- LOTES DE BATERÍAS ---

// Obtener todos los lotes de baterías
app.get('/api/lotes-baterias', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = 'SELECT * FROM lotes_baterias';
    const params = [];
    
    if (sector) {
      query += ' WHERE sector = $1';
      params.push(sector);
    }
    
    query += ' ORDER BY nombre_completo';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo lotes de baterías:', error);
    res.status(500).json({ error: 'Error al obtener lotes de baterías' });
  }
});

// Obtener un lote de batería por ID
app.get('/api/lotes-baterias/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lotes_baterias WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lote de batería no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo lote de batería:', error);
    res.status(500).json({ error: 'Error al obtener lote de batería' });
  }
});

// Crear lote de batería
app.post('/api/lotes-baterias', checkSectorPermission, async (req, res) => {
  const { id, sector, nombre_completo } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre_completo) return res.status(400).json({ error: 'El nombre completo es requerido' });

  try {
    // Verificar si ya existe un lote de batería con este ID
    const existingCheck = await pool.query('SELECT id FROM lotes_baterias WHERE id = $1', [id]);
    
    let result;
    if (existingCheck.rows.length > 0) {
      // Si existe, actualizar
      const query = `
        UPDATE lotes_baterias
        SET sector = $1, nombre_completo = $2
        WHERE id = $3
        RETURNING *
      `;
      result = await pool.query(query, [sector, nombre_completo, id]);
    } else {
      // Si no existe, insertar
      const query = `
        INSERT INTO lotes_baterias (id, sector, nombre_completo)
        VALUES ($1, $2, $3)
        ON CONFLICT (sector, nombre_completo)
        DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo
        RETURNING *
      `;
      result = await pool.query(query, [id, sector, nombre_completo]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando lote de batería:', error);
    res.status(500).json({ error: 'Error al guardar lote de batería: ' + error.message });
  }
});

// Actualizar lote de batería
app.put('/api/lotes-baterias/:id', checkSectorPermission, async (req, res) => {
  const { sector, nombre_completo } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre_completo) return res.status(400).json({ error: 'El nombre completo es requerido' });

  try {
    const query = `
      UPDATE lotes_baterias
      SET sector = $1, nombre_completo = $2
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [sector, nombre_completo, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lote de batería no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando lote de batería:', error);
    res.status(500).json({ error: 'Error al actualizar lote de batería: ' + error.message });
  }
});

// Eliminar lote de batería
app.delete('/api/lotes-baterias/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM lotes_baterias WHERE id = $1', [req.params.id]);
    res.json({ message: 'Lote de batería eliminado' });
  } catch (error) {
    console.error('Error eliminando lote de batería:', error);
    res.status(500).json({ error: 'Error al eliminar lote de batería' });
  }
});

// --- INSTALACIONES DE BATERÍAS ---

// Obtener todas las instalaciones de baterías
app.get('/api/instalaciones-baterias', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = `
      SELECT ib.*, mb.nombre as modelo_nombre, mb.amperaje, lb.nombre_completo as lote_nombre
      FROM instalaciones_baterias ib
      JOIN modelos_baterias mb ON ib.modelo_bateria_id = mb.id
      JOIN lotes_baterias lb ON ib.lote_bateria_id = lb.id
    `;
    const params = [];

    if (sector) {
      query += ' WHERE ib.sector = $1';
      params.push(sector);
    }

    query += ' ORDER BY ib.fecha_instalacion DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo instalaciones de baterías:', error);
    res.status(500).json({ error: 'Error al obtener instalaciones de baterías' });
  }
});

// Obtener una instalación de batería por ID
app.get('/api/instalaciones-baterias/:id', async (req, res) => {
  try {
    const query = `
      SELECT ib.*, mb.nombre as modelo_nombre, mb.amperaje, lb.nombre_completo as lote_nombre
      FROM instalaciones_baterias ib
      JOIN modelos_baterias mb ON ib.modelo_bateria_id = mb.id
      JOIN lotes_baterias lb ON ib.lote_bateria_id = lb.id
      WHERE ib.id = $1
    `;
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instalación de batería no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo instalación de batería:', error);
    res.status(500).json({ error: 'Error al obtener instalación de batería' });
  }
});

// Crear instalación de batería
app.post('/api/instalaciones-baterias', checkSectorPermission, async (req, res) => {
  const { id, sector, modelo_bateria_id, lote_bateria_id, piscina_numero, tolva_numero } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!modelo_bateria_id) return res.status(400).json({ error: 'El modelo de batería es requerido' });
  if (!lote_bateria_id) return res.status(400).json({ error: 'El lote de batería es requerido' });
  if (!piscina_numero) return res.status(400).json({ error: 'El número de piscina es requerido' });
  if (!tolva_numero) return res.status(400).json({ error: 'El número de tolva es requerido' });
  
  try {
    // Verificar si ya existe una instalación de batería con este ID
    const existingCheck = await pool.query('SELECT id FROM instalaciones_baterias WHERE id = $1', [id]);
    
    let result;
    if (existingCheck.rows.length > 0) {
      // Si existe, actualizar
      const query = `
        UPDATE instalaciones_baterias 
        SET sector = $1, modelo_bateria_id = $2, lote_bateria_id = $3, piscina_numero = $4, tolva_numero = $5
        WHERE id = $6
        RETURNING *
      `;
      result = await pool.query(query, [sector, modelo_bateria_id, lote_bateria_id, piscina_numero, tolva_numero, id]);
    } else {
      // Si no existe, insertar
      const query = `
        INSERT INTO instalaciones_baterias (id, sector, modelo_bateria_id, lote_bateria_id, piscina_numero, tolva_numero)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      result = await pool.query(query, [id, sector, modelo_bateria_id, lote_bateria_id, piscina_numero, tolva_numero]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando instalación de batería:', error);
    res.status(500).json({ error: 'Error al guardar instalación de batería: ' + error.message });
  }
});

// Actualizar instalación de batería
app.put('/api/instalaciones-baterias/:id', checkSectorPermission, async (req, res) => {
  const { sector, modelo_bateria_id, lote_bateria_id, piscina_numero, tolva_numero } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!modelo_bateria_id) return res.status(400).json({ error: 'El modelo de batería es requerido' });
  if (!lote_bateria_id) return res.status(400).json({ error: 'El lote de batería es requerido' });
  if (!piscina_numero) return res.status(400).json({ error: 'El número de piscina es requerido' });
  if (!tolva_numero) return res.status(400).json({ error: 'El número de tolva es requerido' });
  
  try {
    const query = `
      UPDATE instalaciones_baterias 
      SET sector = $1, modelo_bateria_id = $2, lote_bateria_id = $3, piscina_numero = $4, tolva_numero = $5
      WHERE id = $6
      RETURNING *
    `;
    const result = await pool.query(query, [sector, modelo_bateria_id, lote_bateria_id, piscina_numero, tolva_numero, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instalación de batería no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando instalación de batería:', error);
    res.status(500).json({ error: 'Error al actualizar instalación de batería: ' + error.message });
  }
});

// Eliminar instalación de batería
app.delete('/api/instalaciones-baterias/:id', checkSectorPermission, async (req, res) => {
  try {
    await pool.query('DELETE FROM instalaciones_baterias WHERE id = $1', [req.params.id]);
    res.json({ message: 'Instalación de batería eliminada' });
  } catch (error) {
    console.error('Error eliminando instalación de batería:', error);
    res.status(500).json({ error: 'Error al eliminar instalación de batería' });
  }
});

// ==================== COMPONENTES ====================

// Obtener todos los componentes
app.get('/api/componentes', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = 'SELECT * FROM componentes';
    const params = [];

    if (sector) {
      query += ' WHERE sector = $1';
      params.push(sector);
    }

    query += ' ORDER BY nombre';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo componentes:', error);
    res.status(500).json({ error: 'Error al obtener componentes' });
  }
});

// Obtener un componente por ID
app.get('/api/componentes/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM componentes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo componente:', error);
    res.status(500).json({ error: 'Error al obtener componente' });
  }
});

// Crear componente
app.post('/api/componentes', checkSectorPermission, async (req, res) => {
  const { id, sector, nombre } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    // Verificar si ya existe un componente con este ID
    const existingCheck = await pool.query('SELECT id FROM componentes WHERE id = $1', [id]);
    
    let result;
    if (existingCheck.rows.length > 0) {
      // Si existe, actualizar
      const query = `
        UPDATE componentes
        SET sector = $1, nombre = $2
        WHERE id = $3
        RETURNING *
      `;
      result = await pool.query(query, [sector, nombre, id]);
    } else {
      // Si no existe, insertar
      const query = `
        INSERT INTO componentes (id, sector, nombre)
        VALUES ($1, $2, $3)
        ON CONFLICT (sector, nombre)
        DO UPDATE SET nombre = EXCLUDED.nombre
        RETURNING *
      `;
      result = await pool.query(query, [id, sector, nombre]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando componente:', error);
    res.status(500).json({ error: 'Error al guardar componente: ' + error.message });
  }
});

// Actualizar componente
app.put('/api/componentes/:id', checkSectorPermission, async (req, res) => {
  const { sector, nombre } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const query = `
      UPDATE componentes
      SET sector = $1, nombre = $2
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [sector, nombre, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Componente no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando componente:', error);
    res.status(500).json({ error: 'Error al actualizar componente: ' + error.message });
  }
});

// Eliminar componente
app.delete('/api/componentes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM componentes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Componente eliminado' });
  } catch (error) {
    console.error('Error eliminando componente:', error);
    res.status(500).json({ error: 'Error al eliminar componente' });
  }
});

// ==================== INSTALACIONES DE COMPONENTES ====================

// Obtener todas las instalaciones de componentes
app.get('/api/instalaciones-componentes', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = `
      SELECT ic.*, c.nombre as componente_nombre
      FROM instalaciones_componentes ic
      JOIN componentes c ON ic.componente_id = c.id
    `;
    const params = [];

    if (sector) {
      query += ' WHERE ic.sector = $1';
      params.push(sector);
    }

    query += ' ORDER BY ic.fecha_instalacion DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo instalaciones de componentes:', error);
    res.status(500).json({ error: 'Error al obtener instalaciones de componentes' });
  }
});

// Obtener una instalación de componente por ID
app.get('/api/instalaciones-componentes/:id', async (req, res) => {
  try {
    const query = `
      SELECT ic.*, c.nombre as componente_nombre
      FROM instalaciones_componentes ic
      JOIN componentes c ON ic.componente_id = c.id
      WHERE ic.id = $1
    `;
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instalación de componente no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo instalación de componente:', error);
    res.status(500).json({ error: 'Error al obtener instalación de componente' });
  }
});

// Crear instalación de componente
app.post('/api/instalaciones-componentes', checkSectorPermission, async (req, res) => {
  const { id, sector, componente_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!componente_id) return res.status(400).json({ error: 'El componente es requerido' });
  if (!punto_instalacion) return res.status(400).json({ error: 'El punto de instalación es requerido' });

  try {
    // Verificar si ya existe una instalación de componente con este ID
    const existingCheck = await pool.query('SELECT id FROM instalaciones_componentes WHERE id = $1', [id]);
    
    let result;
    if (existingCheck.rows.length > 0) {
      // Si existe, actualizar
      const query = `
        UPDATE instalaciones_componentes
        SET sector = $1, componente_id = $2, punto_instalacion = $3, piscina_numero = $4, tolva_numero = $5, motor_codigo = $6, sf200_zona = $7, taller_detalles = $8
        WHERE id = $9
        RETURNING *
      `;
      result = await pool.query(query, [sector, componente_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles, id]);
    } else {
      // Si no existe, insertar
      const query = `
        INSERT INTO instalaciones_componentes (id, sector, componente_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      result = await pool.query(query, [id, sector, componente_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando instalación de componente:', error);
    res.status(500).json({ error: 'Error al guardar instalación de componente: ' + error.message });
  }
});

// Actualizar instalación de componente
app.put('/api/instalaciones-componentes/:id', checkSectorPermission, async (req, res) => {
  const { sector, componente_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!componente_id) return res.status(400).json({ error: 'El componente es requerido' });
  if (!punto_instalacion) return res.status(400).json({ error: 'El punto de instalación es requerido' });

  try {
    const query = `
      UPDATE instalaciones_componentes
      SET sector = $1, componente_id = $2, punto_instalacion = $3, piscina_numero = $4, tolva_numero = $5, motor_codigo = $6, sf200_zona = $7, taller_detalles = $8
      WHERE id = $9
      RETURNING *
    `;
    const result = await pool.query(query, [sector, componente_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instalación de componente no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando instalación de componente:', error);
    res.status(500).json({ error: 'Error al actualizar instalación de componente: ' + error.message });
  }
});

// Eliminar instalación de componente
app.delete('/api/instalaciones-componentes/:id', checkSectorPermission, async (req, res) => {
  try {
    await pool.query('DELETE FROM instalaciones_componentes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Instalación de componente eliminada' });
  } catch (error) {
    console.error('Error eliminando instalación de componente:', error);
    res.status(500).json({ error: 'Error al eliminar instalación de componente' });
  }
});

// ==================== SENSORES ====================

// Obtener todos los sensores
app.get('/api/sensores', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = 'SELECT * FROM sensores';
    const params = [];

    if (sector) {
      query += ' WHERE sector = $1';
      params.push(sector);
    }

    query += ' ORDER BY nombre';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo sensores:', error);
    res.status(500).json({ error: 'Error al obtener sensores' });
  }
});

// Obtener un sensor por ID
app.get('/api/sensores/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sensores WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo sensor:', error);
    res.status(500).json({ error: 'Error al obtener sensor' });
  }
});

// Crear sensor
app.post('/api/sensores', checkSectorPermission, async (req, res) => {
  const { id, sector, nombre } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    // Verificar si ya existe un sensor con este ID
    const existingCheck = await pool.query('SELECT id FROM sensores WHERE id = $1', [id]);
    
    let result;
    if (existingCheck.rows.length > 0) {
      // Si existe, actualizar
      const query = `
        UPDATE sensores
        SET sector = $1, nombre = $2
        WHERE id = $3
        RETURNING *
      `;
      result = await pool.query(query, [sector, nombre, id]);
    } else {
      // Si no existe, insertar
      const query = `
        INSERT INTO sensores (id, sector, nombre)
        VALUES ($1, $2, $3)
        ON CONFLICT (sector, nombre)
        DO UPDATE SET nombre = EXCLUDED.nombre
        RETURNING *
      `;
      result = await pool.query(query, [id, sector, nombre]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando sensor:', error);
    res.status(500).json({ error: 'Error al guardar sensor: ' + error.message });
  }
});

// Actualizar sensor
app.put('/api/sensores/:id', checkSectorPermission, async (req, res) => {
  const { sector, nombre } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const query = `
      UPDATE sensores
      SET sector = $1, nombre = $2
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [sector, nombre, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sensor no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando sensor:', error);
    res.status(500).json({ error: 'Error al actualizar sensor: ' + error.message });
  }
});

// Eliminar sensor
app.delete('/api/sensores/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sensores WHERE id = $1', [req.params.id]);
    res.json({ message: 'Sensor eliminado' });
  } catch (error) {
    console.error('Error eliminando sensor:', error);
    res.status(500).json({ error: 'Error al eliminar sensor' });
  }
});

// ==================== INSTALACIONES DE SENSORES ====================

// Obtener todas las instalaciones de sensores
app.get('/api/instalaciones-sensores', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = `
      SELECT isen.*, s.nombre as sensor_nombre, l.codigo_lote as lote_codigo
      FROM instalaciones_sensores isen
      JOIN sensores s ON isen.sensor_id = s.id
      LEFT JOIN lotes_sensores l ON isen.lote_id = l.id
    `;
    const params = [];

    if (sector) {
      query += ' WHERE isen.sector = $1';
      params.push(sector);
    }

    query += ' ORDER BY isen.fecha_instalacion DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo instalaciones de sensores:', error);
    res.status(500).json({ error: 'Error al obtener instalaciones de sensores' });
  }
});

// Obtener una instalación de sensor por ID
app.get('/api/instalaciones-sensores/:id', async (req, res) => {
  try {
    const query = `
      SELECT isen.*, s.nombre as sensor_nombre
      FROM instalaciones_sensores isen
      JOIN sensores s ON isen.sensor_id = s.id
      WHERE isen.id = $1
    `;
    const result = await pool.query(query, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instalación de sensor no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error obteniendo instalación de sensor:', error);
    res.status(500).json({ error: 'Error al obtener instalación de sensor' });
  }
});

// Crear instalación de sensor
app.post('/api/instalaciones-sensores', checkSectorPermission, async (req, res) => {
  const { id, sector, sensor_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles, lote_id } = req.body;

  // Convertir string vacío a null para lote_id
  const loteIdValue = (lote_id === '' || lote_id === undefined || lote_id === null) ? null : lote_id;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!sensor_id) return res.status(400).json({ error: 'El sensor es requerido' });
  if (!punto_instalacion) return res.status(400).json({ error: 'El punto de instalación es requerido' });

  try {
    // Verificar si ya existe una instalación de sensor con este ID
    const existingCheck = await pool.query('SELECT id FROM instalaciones_sensores WHERE id = $1', [id]);

    let result;
    if (existingCheck.rows.length > 0) {
      // Si existe, actualizar
      const query = `
        UPDATE instalaciones_sensores
        SET sector = $1, sensor_id = $2, punto_instalacion = $3, piscina_numero = $4, tolva_numero = $5, motor_codigo = $6, sf200_zona = $7, taller_detalles = $8, lote_id = $9
        WHERE id = $10
        RETURNING *
      `;
      result = await pool.query(query, [sector, sensor_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles, loteIdValue, id]);
    } else {
      // Si no existe, insertar
      const query = `
        INSERT INTO instalaciones_sensores (id, sector, sensor_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles, lote_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      result = await pool.query(query, [id, sector, sensor_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles, loteIdValue]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando instalación de sensor:', error);
    res.status(500).json({ error: 'Error al guardar instalación de sensor: ' + error.message });
  }
});

// Actualizar instalación de sensor
app.put('/api/instalaciones-sensores/:id', checkSectorPermission, async (req, res) => {
  const { sector, sensor_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles, lote_id } = req.body;

  // Convertir string vacío a null para lote_id
  const loteIdValue = (lote_id === '' || lote_id === undefined || lote_id === null) ? null : lote_id;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!sensor_id) return res.status(400).json({ error: 'El sensor es requerido' });
  if (!punto_instalacion) return res.status(400).json({ error: 'El punto de instalación es requerido' });

  try {
    const query = `
      UPDATE instalaciones_sensores
      SET sector = $1, sensor_id = $2, punto_instalacion = $3, piscina_numero = $4, tolva_numero = $5, motor_codigo = $6, sf200_zona = $7, taller_detalles = $8, lote_id = $9
      WHERE id = $10
      RETURNING *
    `;
    const result = await pool.query(query, [sector, sensor_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles, loteIdValue, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instalación de sensor no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando instalación de sensor:', error);
    res.status(500).json({ error: 'Error al actualizar instalación de sensor: ' + error.message });
  }
});

// Eliminar instalación de sensor
app.delete('/api/instalaciones-sensores/:id', checkSectorPermission, async (req, res) => {
  try {
    await pool.query('DELETE FROM instalaciones_sensores WHERE id = $1', [req.params.id]);
    res.json({ message: 'Instalación de sensor eliminada' });
  } catch (error) {
    console.error('Error eliminando instalación de sensor:', error);
    res.status(500).json({ error: 'Error al eliminar instalación de sensor' });
  }
});

// ==================== LOTES DE SENSORES ====================

// Obtener todos los lotes de sensores
app.get('/api/lotes-sensores', async (req, res) => {
  try {
    const { sector } = req.query;
    let query = `
      SELECT * FROM lotes_sensores
    `;
    const params = [];

    if (sector) {
      query += ' WHERE sector = $1';
      params.push(sector);
    }

    query += ' ORDER BY fecha_registro DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo lotes de sensores:', error);
    res.status(500).json({ error: 'Error al obtener lotes de sensores' });
  }
});

// Crear lote de sensor
app.post('/api/lotes-sensores', checkSectorPermission, async (req, res) => {
  const { id, sector, codigo_lote } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!codigo_lote) return res.status(400).json({ error: 'El código de lote es requerido' });

  // Eliminar espacios del código de lote
  const codigoLoteSinEspacios = codigo_lote.replace(/\s/g, '');

  if (!codigoLoteSinEspacios) return res.status(400).json({ error: 'El código de lote no puede estar vacío' });

  try {
    const query = `
      INSERT INTO lotes_sensores (id, sector, codigo_lote)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(query, [id, sector, codigoLoteSinEspacios]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando lote de sensor:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un lote con este código en este sector' });
    }
    res.status(500).json({ error: 'Error al guardar lote de sensor: ' + error.message });
  }
});

// Actualizar lote de sensor
app.put('/api/lotes-sensores/:id', checkSectorPermission, async (req, res) => {
  const { sector, codigo_lote } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!codigo_lote) return res.status(400).json({ error: 'El código de lote es requerido' });

  // Eliminar espacios del código de lote
  const codigoLoteSinEspacios = codigo_lote.replace(/\s/g, '');

  if (!codigoLoteSinEspacios) return res.status(400).json({ error: 'El código de lote no puede estar vacío' });

  try {
    const query = `
      UPDATE lotes_sensores
      SET sector = $1, codigo_lote = $2
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [sector, codigoLoteSinEspacios, req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lote de sensor no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error actualizando lote de sensor:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un lote con este código en este sector' });
    }
    res.status(500).json({ error: 'Error al actualizar lote de sensor: ' + error.message });
  }
});

// Eliminar lote de sensor
app.delete('/api/lotes-sensores/:id', checkSectorPermission, async (req, res) => {
  try {
    await pool.query('DELETE FROM lotes_sensores WHERE id = $1', [req.params.id]);
    res.json({ message: 'Lote de sensor eliminado' });
  } catch (error) {
    console.error('Error eliminando lote de sensor:', error);
    res.status(500).json({ error: 'Error al eliminar lote de sensor' });
  }
});

// ==================== AUTENTICACIÓN ====================

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('🔐 Intento de login:', { username });
    
    if (!username || !password) {
      console.log('❌ Usuario o contraseña faltantes');
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
    
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE username = $1',
      [username]
    );
    
    console.log('📊 Usuarios encontrados:', result.rows.length);
    
    if (result.rows.length === 0) {
      console.log('❌ Usuario no encontrado:', username);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const user = result.rows[0];
    console.log('👤 Usuario encontrado:', { username: user.username, rol: user.rol });
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      console.log('❌ Contraseña incorrecta');
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Generar token JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        rol: user.rol,
        sectoresPermitidos: user.sectores_permitidos
      },
      process.env.SESSION_SECRET || 'aq1-secret-key-2024',
      { expiresIn: '24h' }
    );
    
    console.log('✅ Login exitoso:', { username: user.username, rol: user.rol });
    
    res.json({
      token,
      id: user.id,
      username: user.username,
      rol: user.rol,
      sectoresPermitidos: user.sectores_permitidos
    });
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// Verificar sesión
app.get('/api/session', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    rol: req.user.rol,
    sectoresPermitidos: req.user.sectoresPermitidos
  });
});

// Logout (con JWT no es necesario hacer nada en el servidor)
app.post('/api/logout', (req, res) => {
  res.json({ message: 'Sesión cerrada' });
});

// ==================== INICIO SERVIDOR ====================

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
