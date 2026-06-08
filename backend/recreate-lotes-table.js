const { pool } = require('./database');

async function recreateLotesTable() {
  const client = await pool.connect();
  try {
    console.log('Eliminando tablas...');
    await client.query('DROP TABLE IF EXISTS instalaciones_baterias CASCADE');
    await client.query('DROP TABLE IF EXISTS lotes_baterias CASCADE');
    
    console.log('Verificando que las tablas no existen...');
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'lotes_baterias'
      );
    `);
    console.log('Tabla lotes_baterias existe:', checkTable.rows[0].exists);
    
    console.log('Creando tabla lotes_baterias...');
    await client.query(`
      CREATE TABLE lotes_baterias (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        nombre_completo VARCHAR(200) NOT NULL,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sector, nombre_completo)
      );
    `);
    
    console.log('Verificando estructura de la tabla...');
    const columns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lotes_baterias'
      ORDER BY ordinal_position;
    `);
    console.log('Columnas de lotes_baterias:', columns.rows);
    
    console.log('Creando tabla instalaciones_baterias...');
    await client.query(`
      CREATE TABLE instalaciones_baterias (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        modelo_bateria_id VARCHAR(50) NOT NULL,
        lote_bateria_id VARCHAR(50) NOT NULL,
        piscina_numero VARCHAR(10) NOT NULL,
        tolva_numero VARCHAR(10) NOT NULL,
        fecha_instalacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (modelo_bateria_id) REFERENCES modelos_baterias(id) ON DELETE RESTRICT,
        FOREIGN KEY (lote_bateria_id) REFERENCES lotes_baterias(id) ON DELETE RESTRICT
      );
    `);
    
    console.log('✅ Tablas recreadas exitosamente');
  } catch (error) {
    console.error('❌ Error recreando tablas:', error);
  } finally {
    client.release();
    pool.end();
  }
}

recreateLotesTable();
