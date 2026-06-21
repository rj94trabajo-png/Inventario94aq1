const { pool } = require('./database');

async function checkDuplicates() {
  const client = await pool.connect();
  
  try {
    console.log('Verificando códigos duplicados en Sector 3...\n');
    
    // Buscar códigos duplicados en Sector 3
    const result = await client.query(
      `SELECT codigo, COUNT(*) as count 
       FROM motores 
       WHERE sector = 'Sector 3'
       GROUP BY codigo 
       HAVING COUNT(*) > 1`
    );
    
    if (result.rows.length === 0) {
      console.log('✅ No hay códigos duplicados en Sector 3');
    } else {
      console.log(`❌ Se encontraron ${result.rows.length} códigos duplicados en Sector 3:\n`);
      result.rows.forEach(row => {
        console.log(`  Código: ${row.codigo} - Repetido: ${row.count} veces`);
      });
    }
    
    // Contar total de motores en Sector 3
    const totalResult = await client.query(
      'SELECT COUNT(*) as total FROM motores WHERE sector = $1',
      ['Sector 3']
    );
    console.log(`\nTotal de motores en Sector 3: ${totalResult.rows[0].total}`);
    
    // Contar códigos únicos en Sector 3
    const uniqueResult = await client.query(
      'SELECT COUNT(DISTINCT codigo) as unique FROM motores WHERE sector = $1',
      ['Sector 3']
    );
    console.log(`Códigos únicos en Sector 3: ${uniqueResult.rows[0].unique}`);
    
  } catch (error) {
    console.error('Error verificando duplicados:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDuplicates();
