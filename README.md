# AQ1 Inventarios - Sistema con PostgreSQL

Este sistema de inventarios ahora guarda todos los datos en PostgreSQL en lugar de localStorage.

## Requisitos

- Node.js (v14 o superior)
- PostgreSQL (v12 o superior)

## Configuración

### 1. Instalar PostgreSQL

Si no tienes PostgreSQL instalado, descárgalo e instálalo desde:
- Windows: https://www.postgresql.org/download/windows/
- Mac: https://www.postgresql.org/download/macosx/
- Linux: Usa el gestor de paquetes de tu distribución

### 2. Crear la base de datos

Abre una terminal o pgAdmin y ejecuta:

```sql
CREATE DATABASE aq1_inventarios;
```

### 3. Configurar el backend

Copia el archivo de ejemplo de configuración:

```bash
cd backend
copy .env.example .env
```

Edita el archivo `.env` con tus credenciales de PostgreSQL:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aq1_inventarios
DB_USER=tu_usuario_postgres
DB_PASSWORD=tu_contraseña
PORT=3000
```

### 4. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 5. Iniciar el servidor backend

```bash
npm start
```

El servidor se iniciará en http://localhost:3000

### 6. Abrir la aplicación

Abre el archivo `index.html` en tu navegador o usa un servidor web:

```bash
# Desde la raíz del proyecto
npx serve .
```

O simplemente abre `index.html` directamente en el navegador.

## Estructura del proyecto

```
hola-page/
├── backend/
│   ├── package.json          # Dependencias del backend
│   ├── server.js            # Servidor Express con API
│   ├── database.js          # Configuración de PostgreSQL
│   └── .env                 # Configuración de la base de datos
├── index.html               # Frontend
├── app.js                   # Lógica del frontend (ahora usa API)
└── styles.css               # Estilos
```

## API Endpoints

### Piscinas
- `GET /api/piscinas` - Obtener todas las piscinas
- `GET /api/piscinas?sector=X` - Obtener piscinas por sector
- `GET /api/piscinas/:id` - Obtener una piscina
- `POST /api/piscinas` - Crear/actualizar piscina
- `PUT /api/piscinas/:id` - Actualizar piscina
- `DELETE /api/piscinas/:id` - Eliminar piscina

### Motores
- `GET /api/motores` - Obtener todos los motores
- `GET /api/motores?sector=X` - Obtener motores por sector
- `GET /api/motores/:id` - Obtener un motor
- `GET /api/motores/codigo/:codigo` - Obtener motor por código
- `POST /api/motores` - Crear/actualizar motor
- `PUT /api/motores/:id` - Actualizar motor
- `DELETE /api/motores/:id` - Eliminar motor

### Equipos
- `GET /api/equipos` - Obtener todos los equipos
- `GET /api/equipos?sector=X` - Obtener equipos por sector
- `GET /api/equipos/:id` - Obtener un equipo
- `POST /api/equipos` - Crear/actualizar equipo
- `PUT /api/equipos/:id` - Actualizar equipo
- `DELETE /api/equipos/:id` - Eliminar equipo

## Tablas de la base de datos

### piscinas
- id (VARCHAR, PRIMARY KEY)
- sector (VARCHAR)
- numero (VARCHAR)
- nombre (VARCHAR)
- fecha_registro (TIMESTAMP)
- UNIQUE(sector, numero)

### motores
- id (VARCHAR, PRIMARY KEY)
- sector (VARCHAR)
- codigo (VARCHAR, UNIQUE)
- estado_motor (VARCHAR)
- piscina_id (VARCHAR, FOREIGN KEY)
- fecha_registro (TIMESTAMP)

### equipos
- id (VARCHAR, PRIMARY KEY)
- sector (VARCHAR)
- piscina_id (VARCHAR, FOREIGN KEY)
- estado_piscina (VARCHAR)
- tolvas (INTEGER)
- sf200 (DECIMAL)
- hidrofos (INTEGER)
- motores (INTEGER)
- estado_ema (VARCHAR)
- fecha_registro (TIMESTAMP)
- UNIQUE(sector, piscina_id)
