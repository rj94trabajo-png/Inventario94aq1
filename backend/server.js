const express = require('express');
const cors = require('cors');
const { pool, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar base de datos
initDatabase().catch(console.error);

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
app.post('/api/piscinas', async (req, res) => {
  const { id, sector, numero, nombre } = req.body;
  
  try {
    const query = `
      INSERT INTO piscinas (id, sector, numero, nombre)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (sector, numero) 
      DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING *
    `;
    const result = await pool.query(query, [id, sector, numero, nombre]);
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
app.delete('/api/piscinas/:id', async (req, res) => {
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
app.post('/api/motores', async (req, res) => {
  const { id, sector, codigo, estado_motor, piscina_id } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!codigo) return res.status(400).json({ error: 'El código es requerido' });
  if (!estado_motor) return res.status(400).json({ error: 'El estado del motor es requerido' });
  
  try {
    // Convertir string vacío a null
    const piscinaIdValue = piscina_id && piscina_id.trim() !== '' ? piscina_id : null;
    
    const query = `
      INSERT INTO motores (id, sector, codigo, estado_motor, piscina_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (codigo) 
      DO UPDATE SET sector = EXCLUDED.sector, estado_motor = EXCLUDED.estado_motor, piscina_id = EXCLUDED.piscina_id
      RETURNING *
    `;
    const result = await pool.query(query, [id, sector, codigo, estado_motor, piscinaIdValue]);
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
app.delete('/api/motores/:id', async (req, res) => {
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
app.post('/api/equipos', async (req, res) => {
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
    
    const query = `
      INSERT INTO equipos (id, sector, piscina_id, estado_piscina, tolvas, sf200, hidrofos, motores, estado_ema)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (sector, piscina_id) 
      DO UPDATE SET estado_piscina = EXCLUDED.estado_piscina, tolvas = EXCLUDED.tolvas, sf200 = EXCLUDED.sf200, hidrofos = EXCLUDED.hidrofos, motores = EXCLUDED.motores, estado_ema = EXCLUDED.estado_ema
      RETURNING *
    `;
    const result = await pool.query(query, [id, sector, piscina_id, estado_piscina, tolvasValue, sf200Value, hidrofosValue, motoresValue, estado_ema]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando equipo:', error);
    res.status(500).json({ error: 'Error al guardar equipo: ' + error.message });
  }
});

// Actualizar equipo
app.put('/api/equipos/:id', async (req, res) => {
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
app.post('/api/modelos-baterias', async (req, res) => {
  const { id, sector, nombre, amperaje } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  if (!amperaje) return res.status(400).json({ error: 'El amperaje es requerido' });
  if (!/^\d+$/.test(amperaje.toString())) return res.status(400).json({ error: 'El amperaje debe ser un número' });
  if (/\s/.test(nombre)) return res.status(400).json({ error: 'El nombre no puede contener espacios' });
  
  try {
    const query = `
      INSERT INTO modelos_baterias (id, sector, nombre, amperaje)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (sector, nombre, amperaje) 
      DO UPDATE SET nombre = EXCLUDED.nombre, amperaje = EXCLUDED.amperaje
      RETURNING *
    `;
    const result = await pool.query(query, [id, sector, nombre, amperaje]);
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
app.delete('/api/modelos-baterias/:id', async (req, res) => {
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
app.post('/api/lotes-baterias', async (req, res) => {
  const { id, sector, nombre_completo } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre_completo) return res.status(400).json({ error: 'El nombre completo es requerido' });

  try {
    const query = `
      INSERT INTO lotes_baterias (id, sector, nombre_completo)
      VALUES ($1, $2, $3)
      ON CONFLICT (sector, nombre_completo)
      DO UPDATE SET nombre_completo = EXCLUDED.nombre_completo
      RETURNING *
    `;
    const result = await pool.query(query, [id, sector, nombre_completo]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando lote de batería:', error);
    res.status(500).json({ error: 'Error al guardar lote de batería: ' + error.message });
  }
});

// Actualizar lote de batería
app.put('/api/lotes-baterias/:id', async (req, res) => {
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
app.post('/api/instalaciones-baterias', async (req, res) => {
  const { id, sector, modelo_bateria_id, lote_bateria_id, piscina_numero, tolva_numero } = req.body;
  
  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!modelo_bateria_id) return res.status(400).json({ error: 'El modelo de batería es requerido' });
  if (!lote_bateria_id) return res.status(400).json({ error: 'El lote de batería es requerido' });
  if (!piscina_numero) return res.status(400).json({ error: 'El número de piscina es requerido' });
  if (!tolva_numero) return res.status(400).json({ error: 'El número de tolva es requerido' });
  
  try {
    const query = `
      INSERT INTO instalaciones_baterias (id, sector, modelo_bateria_id, lote_bateria_id, piscina_numero, tolva_numero)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await pool.query(query, [id, sector, modelo_bateria_id, lote_bateria_id, piscina_numero, tolva_numero]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando instalación de batería:', error);
    res.status(500).json({ error: 'Error al guardar instalación de batería: ' + error.message });
  }
});

// Actualizar instalación de batería
app.put('/api/instalaciones-baterias/:id', async (req, res) => {
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
app.delete('/api/instalaciones-baterias/:id', async (req, res) => {
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
app.post('/api/componentes', async (req, res) => {
  const { id, sector, nombre } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });

  try {
    const query = `
      INSERT INTO componentes (id, sector, nombre)
      VALUES ($1, $2, $3)
      ON CONFLICT (sector, nombre)
      DO UPDATE SET nombre = EXCLUDED.nombre
      RETURNING *
    `;
    const result = await pool.query(query, [id, sector, nombre]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando componente:', error);
    res.status(500).json({ error: 'Error al guardar componente: ' + error.message });
  }
});

// Actualizar componente
app.put('/api/componentes/:id', async (req, res) => {
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
app.post('/api/instalaciones-componentes', async (req, res) => {
  const { id, sector, componente_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles } = req.body;

  // Validaciones
  if (!sector) return res.status(400).json({ error: 'El sector es requerido' });
  if (!componente_id) return res.status(400).json({ error: 'El componente es requerido' });
  if (!punto_instalacion) return res.status(400).json({ error: 'El punto de instalación es requerido' });

  try {
    const query = `
      INSERT INTO instalaciones_componentes (id, sector, componente_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await pool.query(query, [id, sector, componente_id, punto_instalacion, piscina_numero, tolva_numero, motor_codigo, sf200_zona, taller_detalles]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error guardando instalación de componente:', error);
    res.status(500).json({ error: 'Error al guardar instalación de componente: ' + error.message });
  }
});

// Actualizar instalación de componente
app.put('/api/instalaciones-componentes/:id', async (req, res) => {
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
app.delete('/api/instalaciones-componentes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM instalaciones_componentes WHERE id = $1', [req.params.id]);
    res.json({ message: 'Instalación de componente eliminada' });
  } catch (error) {
    console.error('Error eliminando instalación de componente:', error);
    res.status(500).json({ error: 'Error al eliminar instalación de componente' });
  }
});

// Servir archivos estáticos del frontend
app.use(express.static('../'));

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
