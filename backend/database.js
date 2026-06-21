const { Pool } = require('pg');

// Cargar variables de entorno desde archivo .env solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: require('path').join(__dirname, '.env') });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Crear tablas si no existen
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS piscinas (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        numero VARCHAR(50) NOT NULL,
        nombre VARCHAR(100),
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sector, numero)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS motores (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        codigo VARCHAR(5) NOT NULL UNIQUE,
        estado_motor VARCHAR(100) NOT NULL,
        piscina_id VARCHAR(50),
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (piscina_id) REFERENCES piscinas(id) ON DELETE SET NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS equipos (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        piscina_id VARCHAR(50) NOT NULL,
        estado_piscina VARCHAR(50) NOT NULL,
        tolvas INTEGER DEFAULT 0,
        sf200 DECIMAL(10,1) DEFAULT 0,
        hidrofos INTEGER DEFAULT 0,
        motores INTEGER DEFAULT 0,
        estado_ema VARCHAR(50) NOT NULL,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sector, piscina_id),
        FOREIGN KEY (piscina_id) REFERENCES piscinas(id) ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS modelos_baterias (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        amperaje INTEGER NOT NULL,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sector, nombre, amperaje)
      );
    `);

    // NOTA: Las siguientes líneas que borraban tablas han sido eliminadas para evitar pérdida de datos
    // await client.query(`DROP TABLE IF EXISTS instalaciones_baterias CASCADE`);
    // await client.query(`DROP TABLE IF EXISTS lotes_baterias CASCADE`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lotes_baterias (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        nombre_completo VARCHAR(200) NOT NULL,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sector, nombre_completo)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS instalaciones_baterias (
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

    // Tablas para componentes
    await client.query(`
      CREATE TABLE IF NOT EXISTS componentes (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sector, nombre)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS instalaciones_componentes (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        componente_id VARCHAR(50) NOT NULL,
        punto_instalacion VARCHAR(50) NOT NULL,
        piscina_numero VARCHAR(10),
        tolva_numero VARCHAR(10),
        motor_codigo VARCHAR(50),
        sf200_zona VARCHAR(10),
        taller_detalles TEXT,
        fecha_instalacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (componente_id) REFERENCES componentes(id) ON DELETE RESTRICT
      );
    `);

    // Agregar columna taller_detalles si no existe
    try {
      const checkColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'instalaciones_componentes' 
        AND column_name = 'taller_detalles'
      `);
      
      if (checkColumn.rows.length === 0) {
        await client.query(`
          ALTER TABLE instalaciones_componentes ADD COLUMN taller_detalles TEXT
        `);
        console.log('✅ Columna taller_detalles agregada');
      }
    } catch (error) {
      console.error('Error verificando/agregando columna taller_detalles:', error);
    }

    // Tablas para sensores
    await client.query(`
      CREATE TABLE IF NOT EXISTS sensores (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sector, nombre)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS instalaciones_sensores (
        id VARCHAR(50) PRIMARY KEY,
        sector VARCHAR(50) NOT NULL,
        sensor_id VARCHAR(50) NOT NULL,
        punto_instalacion VARCHAR(50) NOT NULL,
        piscina_numero VARCHAR(10),
        tolva_numero VARCHAR(10),
        motor_codigo VARCHAR(50),
        sf200_zona VARCHAR(10),
        taller_detalles TEXT,
        fecha_instalacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sensor_id) REFERENCES sensores(id) ON DELETE RESTRICT
      );
    `);

    // Tabla de usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(50) NOT NULL,
        sectores_permitidos TEXT[] NOT NULL
      );
    `);

    // Tabla de sesiones para connect-pg-simple
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR(255) NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP NOT NULL
      );
    `);

    // Crear índice para optimizar la limpieza de sesiones expiradas
    await client.query(`
      CREATE INDEX IF NOT EXISTS session_expire_idx ON session (expire)
    `);

    console.log('✅ Tablas creadas/verificadas exitosamente');
  } catch (error) {
    console.error('❌ Error creando tablas:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
