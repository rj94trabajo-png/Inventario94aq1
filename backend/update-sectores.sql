-- Actualizar sectores permitidos para que coincidan con el frontend (con espacio)
UPDATE usuarios 
SET sectores_permitidos = ARRAY['Sector 1'] 
WHERE username = 'Sector1';

UPDATE usuarios 
SET sectores_permitidos = ARRAY['Sector 2'] 
WHERE username = 'Sector2';

UPDATE usuarios 
SET sectores_permitidos = ARRAY['Sector 3'] 
WHERE username = 'Sector3';

UPDATE usuarios 
SET sectores_permitidos = ARRAY['Sector 4'] 
WHERE username = 'Sector4';

UPDATE usuarios 
SET sectores_permitidos = ARRAY['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4'] 
WHERE username = 'Administrador';

-- Verificar los cambios
SELECT username, rol, sectores_permitidos FROM usuarios ORDER BY username;
