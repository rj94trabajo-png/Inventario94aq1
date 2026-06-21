// API_BASE: usa localhost en desarrollo, /api en producción (mismo dominio)
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3000/api' 
  : '/api';
const SECTORS = ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4'];
const ESTADOS_MOTOR = [
  'Taller por Mantenimiento',
  'Placa',
  'Afuera por Mantenimiento',
  'Piscinas'
];

// User authentication state
let currentUser = null;
let sectoresPermitidos = [];

// Helper function to add JWT token to fetch options
function getAuthHeaders(options = {}) {
  const token = localStorage.getItem('authToken');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return {
    ...options,
    headers
  };
}

// Hamburger menu toggle
document.addEventListener('DOMContentLoaded', () => {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const sidebar = document.querySelector('.sidebar');

  if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // Cerrar sidebar al hacer clic fuera de él
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target) && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Check authentication on load
  checkSession();

  // Login modal event listeners
  const loginOverlay = document.getElementById('login-overlay');
  const loginSubmit = document.getElementById('login-submit');

  // No permitir cerrar el modal de login sin autenticarse
  // El botón de cierre está deshabilitado en el HTML

  if (loginSubmit) {
    loginSubmit.addEventListener('click', handleLogin);
  }

  // Allow Enter key to submit login
  document.getElementById('login-password')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('login-username')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
});

// Toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  toastMessage.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Authentication functions
async function checkSession() {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      showLoginModal();
      return;
    }

    const response = await fetch(`${API_BASE}/session`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (response.ok) {
      const user = await response.json();
      currentUser = user;
      sectoresPermitidos = user.sectoresPermitidos || [];
      applySectorRestrictions();
    } else {
      // Si la sesión del servidor falla, intentar usar localStorage
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          currentUser = user;
          sectoresPermitidos = user.sectoresPermitidos || [];
          applySectorRestrictions();
        } catch (e) {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('authToken');
          showLoginModal();
        }
      } else {
        localStorage.removeItem('authToken');
        showLoginModal();
      }
    }
  } catch (error) {
    console.error('Error checking session:', error);
    // Si hay error de red, intentar usar localStorage
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        currentUser = user;
        sectoresPermitidos = user.sectoresPermitidos || [];
        applySectorRestrictions();
      } catch (e) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        showLoginModal();
      }
    } else {
      localStorage.removeItem('authToken');
      showLoginModal();
    }
  }
}

function showLoginModal() {
  document.getElementById('login-overlay').classList.add('open');
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    showToast('Usuario y contraseña son requeridos');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data;
      sectoresPermitidos = data.sectoresPermitidos || [];
      
      // Guardar token JWT y usuario en localStorage
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data));
      
      // Limpiar datos en memoria de la sesión anterior
      data.motores = [];
      data.piscinas = [];
      data.equipos = [];
      
      // Resetear todos los selects de sector
      document.querySelectorAll('.sector-filter').forEach(select => {
        select.value = '';
      });
      
      // Limpiar contenido de tablas
      document.getElementById('tbody-motores').innerHTML = '';
      document.getElementById('tbody-piscinas').innerHTML = '';
      document.getElementById('tbody-equipos').innerHTML = '';
      
      // Ocultar tablas y mostrar hints
      document.querySelectorAll('.table-wrapper').forEach(wrap => {
        wrap.classList.add('search-hidden');
      });
      document.querySelectorAll('.hint-text').forEach(hint => {
        hint.classList.remove('search-hidden');
      });
      document.querySelectorAll('.search-input').forEach(input => {
        input.classList.add('search-hidden');
      });
      
      // Ocultar paneles de resumen
      document.querySelectorAll('.resumen-panel').forEach(panel => {
        panel.classList.add('search-hidden');
      });
      
      // Limpiar contenido dinámico
      const trabajosContent = document.getElementById('trabajos-content');
      if (trabajosContent) trabajosContent.innerHTML = '';
      
      const componentesContent = document.getElementById('componentes-content');
      if (componentesContent) componentesContent.innerHTML = '';
      
      const sensoresContent = document.getElementById('sensores-content');
      if (sensoresContent) sensoresContent.innerHTML = '';
      
      document.getElementById('login-overlay').classList.remove('open');
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      showToast(`Bienvenido, ${data.username}`);
      applySectorRestrictions();
    } else {
      const error = await response.json();
      showToast(error.error || 'Error al iniciar sesión');
    }
  } catch (error) {
    console.error('Error en login:', error);
    showToast('Error al iniciar sesión');
  }
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST'
    });
    currentUser = null;
    sectoresPermitidos = [];
    // Eliminar token JWT y usuario de localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    // Limpiar datos en memoria
    data.motores = [];
    data.piscinas = [];
    data.equipos = [];
    
    // Resetear todos los selects de sector
    document.querySelectorAll('.sector-filter').forEach(select => {
      select.value = '';
    });
    
    // Limpiar contenido de tablas
    document.getElementById('tbody-motores').innerHTML = '';
    document.getElementById('tbody-piscinas').innerHTML = '';
    document.getElementById('tbody-equipos').innerHTML = '';
    
    // Ocultar tablas y mostrar hints
    document.querySelectorAll('.table-wrapper').forEach(wrap => {
      wrap.classList.add('search-hidden');
    });
    document.querySelectorAll('.hint-text').forEach(hint => {
      hint.classList.remove('search-hidden');
    });
    document.querySelectorAll('.search-input').forEach(input => {
      input.classList.add('search-hidden');
    });
    
    // Ocultar paneles de resumen
    document.querySelectorAll('.resumen-panel').forEach(panel => {
      panel.classList.add('search-hidden');
    });
    
    // Limpiar contenido dinámico
    const trabajosContent = document.getElementById('trabajos-content');
    if (trabajosContent) trabajosContent.innerHTML = '';
    
    const componentesContent = document.getElementById('componentes-content');
    if (componentesContent) componentesContent.innerHTML = '';
    
    const sensoresContent = document.getElementById('sensores-content');
    if (sensoresContent) sensoresContent.innerHTML = '';
    
    showToast('Sesión cerrada');
    showLoginModal();
  } catch (error) {
    console.error('Error en logout:', error);
    showToast('Error al cerrar sesión');
  }
}

function applySectorRestrictions() {
  // Filter all sector selects based on user permissions
  const sectorSelects = document.querySelectorAll('.sector-filter');
  sectorSelects.forEach(select => {
    const options = select.querySelectorAll('option');
    options.forEach(option => {
      // Normalizar ambos valores para comparación (eliminar espacios)
      const normalizedOption = option.value.replace(/\s/g, '');
      const normalizedPermitted = sectoresPermitidos.map(s => s.replace(/\s/g, ''));
      
      if (option.value && option.value !== '' && !normalizedPermitted.includes(normalizedOption)) {
        option.disabled = true;
        option.style.display = 'none';
      } else {
        option.disabled = false;
        option.style.display = '';
      }
    });

    // If user has only one permitted sector, auto-select it
    if (sectoresPermitidos.length === 1 && !select.value) {
      select.value = sectoresPermitidos[0];
      // Trigger change event to load data
      select.dispatchEvent(new Event('change'));
    }
  });

  // Add logout button to sidebar if not exists
  if (!document.getElementById('logout-btn')) {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
      const logoutLi = document.createElement('li');
      logoutLi.innerHTML = `<a href="#" id="logout-btn"><span class="nav-icon">🚪</span> Cerrar Sesión</a>`;
      navLinks.appendChild(logoutLi);
      document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
      });
    }
  }
}

let data = {
  motores: [],
  piscinas: [],
  equipos: []
};
let editingId = null;
let currentModal = null;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES');
}

function sectorOptions(selected = '', includeEmpty = true) {
  const empty = includeEmpty
    ? `<option value="">— Seleccione un sector —</option>`
    : '';
  const opts = SECTORS.map(s =>
    `<option value="${s}" ${selected === s ? 'selected' : ''}>${s}</option>`
  ).join('');
  return empty + opts;
}

function restrictDecimal(el) {
  if (!el) return;
  el.addEventListener('input', () => {
    let v = el.value.replace(/\s/g, '');
    v = v.replace(/[^\d.]/g, '');
    const dot = v.indexOf('.');
    if (dot !== -1) {
      v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
    }
    el.value = v;
  });
}

function isValidDecimal(val) {
  if (!val) return true;
  return /^\d+(\.\d+)?$/.test(val) || /^\.\d+$/.test(val);
}

function parseSf200(val) {
  return parseFloat(val) || 0;
}

function formatMotorEstado(estado) {
  if (estado === 'Placa') return 'Problemas de Placa';
  if (estado === 'Piscinas') return 'Motores en Piscina';
  return estado;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function restrictNumeric(el, maxLen) {
  if (!el) return;
  el.addEventListener('input', () => {
    el.value = el.value.replace(/\D/g, '').slice(0, maxLen || 99);
  });
  el.addEventListener('keypress', e => {
    if (!/\d/.test(e.key)) e.preventDefault();
  });
}

// API Functions
async function fetchPiscinas(sector = '') {
  try {
    const url = sector ? `${API_BASE}/piscinas?sector=${encodeURIComponent(sector)}` : `${API_BASE}/piscinas`;
    const response = await fetch(url, getAuthHeaders());
    const piscinas = await response.json();
    // Convert snake_case to camelCase
    return piscinas.map(p => ({
      id: p.id,
      sector: p.sector,
      numero: p.numero,
      nombre: p.nombre,
      fechaRegistro: p.fecha_registro
    }));
  } catch (error) {
    console.error('Error fetching piscinas:', error);
    return [];
  }
}

async function fetchModelosBaterias(sector = '') {
  try {
    const url = sector ? `${API_BASE}/modelos-baterias?sector=${encodeURIComponent(sector)}` : `${API_BASE}/modelos-baterias`;
    const response = await fetch(url, getAuthHeaders());
    const modelos = await response.json();
    return modelos.map(m => ({
      id: m.id,
      sector: m.sector,
      nombre: m.nombre,
      amperaje: m.amperaje,
      fechaRegistro: m.fecha_registro
    }));
  } catch (error) {
    console.error('Error fetching modelos baterías:', error);
    return [];
  }
}

async function fetchLotesBaterias(sector = '') {
  try {
    const url = sector ? `${API_BASE}/lotes-baterias?sector=${encodeURIComponent(sector)}` : `${API_BASE}/lotes-baterias`;
    const response = await fetch(url, getAuthHeaders());
    const lotes = await response.json();
    return lotes.map(l => ({
      id: l.id,
      sector: l.sector,
      nombre_completo: l.nombre_completo,
      fecha_registro: l.fecha_registro
    }));
  } catch (error) {
    console.error('Error fetching lotes baterías:', error);
    return [];
  }
}

async function fetchInstalacionesBaterias(sector = '') {
  try {
    const url = sector ? `${API_BASE}/instalaciones-baterias?sector=${encodeURIComponent(sector)}` : `${API_BASE}/instalaciones-baterias`;
    const response = await fetch(url, getAuthHeaders());
    const instalaciones = await response.json();
    return instalaciones.map(i => ({
      id: i.id,
      sector: i.sector,
      modeloBateriaId: i.modelo_bateria_id,
      modeloNombre: i.modelo_nombre,
      amperaje: i.amperaje,
      loteBateriaId: i.lote_bateria_id,
      loteNombre: i.lote_nombre,
      piscinaNumero: i.piscina_numero,
      tolvaNumero: i.tolva_numero,
      fechaInstalacion: i.fecha_instalacion
    }));
  } catch (error) {
    console.error('Error fetching instalaciones baterías:', error);
    return [];
  }
}

async function fetchComponentes(sector = '') {
  try {
    const url = sector ? `${API_BASE}/componentes?sector=${encodeURIComponent(sector)}` : `${API_BASE}/componentes`;
    const response = await fetch(url, getAuthHeaders());
    const componentes = await response.json();
    return componentes.map(c => ({
      id: c.id,
      sector: c.sector,
      nombre: c.nombre,
      fechaRegistro: c.fecha_registro
    }));
  } catch (error) {
    console.error('Error fetching componentes:', error);
    return [];
  }
}

async function fetchInstalacionesComponentes(sector = '') {
  try {
    const url = sector ? `${API_BASE}/instalaciones-componentes?sector=${encodeURIComponent(sector)}` : `${API_BASE}/instalaciones-componentes`;
    const response = await fetch(url, getAuthHeaders());
    const instalaciones = await response.json();
    return instalaciones.map(i => ({
      id: i.id,
      sector: i.sector,
      componenteId: i.componente_id,
      componenteNombre: i.componente_nombre,
      puntoInstalacion: i.punto_instalacion,
      piscinaNumero: i.piscina_numero,
      tolvaNumero: i.tolva_numero,
      motorCodigo: i.motor_codigo,
      sf200Zona: i.sf200_zona,
      tallerDetalles: i.taller_detalles,
      fechaInstalacion: i.fecha_instalacion
    }));
  } catch (error) {
    console.error('Error fetching instalaciones componentes:', error);
    return [];
  }
}

async function fetchSensores(sector = '') {
  try {
    const url = sector ? `${API_BASE}/sensores?sector=${encodeURIComponent(sector)}` : `${API_BASE}/sensores`;
    const response = await fetch(url, getAuthHeaders());
    const sensores = await response.json();
    return sensores.map(s => ({
      id: s.id,
      sector: s.sector,
      nombre: s.nombre,
      fechaRegistro: s.fecha_registro
    }));
  } catch (error) {
    console.error('Error fetching sensores:', error);
    return [];
  }
}

async function fetchInstalacionesSensores(sector = '') {
  try {
    const url = sector ? `${API_BASE}/instalaciones-sensores?sector=${encodeURIComponent(sector)}` : `${API_BASE}/instalaciones-sensores`;
    const response = await fetch(url, getAuthHeaders());
    const instalaciones = await response.json();
    return instalaciones.map(i => ({
      id: i.id,
      sector: i.sector,
      sensorId: i.sensor_id,
      sensorNombre: i.sensor_nombre,
      puntoInstalacion: i.punto_instalacion,
      piscinaNumero: i.piscina_numero,
      tolvaNumero: i.tolva_numero,
      motorCodigo: i.motor_codigo,
      sf200Zona: i.sf200_zona,
      tallerDetalles: i.taller_detalles,
      loteId: i.lote_id,
      loteCodigo: i.lote_codigo,
      fechaInstalacion: i.fecha_instalacion
    }));
  } catch (error) {
    console.error('Error fetching instalaciones sensores:', error);
    return [];
  }
}

async function fetchLotesSensores(sector = '') {
  try {
    const url = sector ? `${API_BASE}/lotes-sensores?sector=${encodeURIComponent(sector)}` : `${API_BASE}/lotes-sensores`;
    const response = await fetch(url, getAuthHeaders());
    const lotes = await response.json();
    return lotes.map(l => ({
      id: l.id,
      sector: l.sector,
      codigoLote: l.codigo_lote,
      fechaRegistro: l.fecha_registro
    }));
  } catch (error) {
    console.error('Error fetching lotes sensores:', error);
    return [];
  }
}

async function fetchMotores(sector = '') {
  try {
    const url = sector ? `${API_BASE}/motores?sector=${encodeURIComponent(sector)}` : `${API_BASE}/motores`;
    const response = await fetch(url, getAuthHeaders());
    const motores = await response.json();
    return motores.map(m => ({
      id: m.id,
      sector: m.sector,
      codigo: m.codigo,
      estadoMotor: m.estado_motor,
      piscinaId: m.piscina_id,
      fechaRegistro: m.fecha_registro
    }));
  } catch (error) {
    console.error('Error fetching motores:', error);
    return [];
  }
}

async function fetchEquipos(sector = '') {
  try {
    const url = sector ? `${API_BASE}/equipos?sector=${encodeURIComponent(sector)}` : `${API_BASE}/equipos`;
    const response = await fetch(url, getAuthHeaders());
    const equipos = await response.json();
    return equipos.map(e => ({
      id: e.id,
      sector: e.sector,
      piscinaId: e.piscina_id,
      estadoPiscina: e.estado_piscina,
      tolvas: e.tolvas,
      sf200: e.sf200,
      hidrofos: e.hidrofos,
      motores: e.motores,
      estadoEma: e.estado_ema,
      fechaRegistro: e.fecha_registro
    }));
  } catch (error) {
    console.error('Error fetching equipos:', error);
    return [];
  }
}

async function loadAllData() {
  data.piscinas = await fetchPiscinas();
  data.motores = await fetchMotores();
  data.equipos = await fetchEquipos();
}

function getPiscinaById(id) {
  return data.piscinas.find(p => p.id === id);
}

function getPiscinasBySector(sector) {
  return data.piscinas
    .filter(p => p.sector === sector)
    .sort((a, b) => Number(a.numero) - Number(b.numero));
}

function findPiscina(sector, numero) {
  return data.piscinas.find(p => p.sector === sector && p.numero === numero);
}

function findMotorByCodigo(codigo) {
  return data.motores.find(m => m.codigo === codigo);
}

function findEquipoByPiscina(sector, piscinaId) {
  return data.equipos.find(e => e.sector === sector && e.piscinaId === piscinaId);
}

function getPiscinaLabel(piscinaId) {
  const p = getPiscinaById(piscinaId);
  return p ? `Piscina ${p.numero}` : '—';
}

function estadoBadge(text, type) {
  const map = {
    activa: 'badge-activo',
    pescada: 'badge-mantenimiento',
    operativo: 'badge-activo',
    inactivo: 'badge-inactivo',
    piscinas: 'badge-disponible'
  };
  const cls = type || map[text?.toLowerCase()] || 'badge-disponible';
  return `<span class="badge ${cls}">${text}</span>`;
}

function toggleSectorUI(sectorEl, searchEl, hintEl, tableWrap) {
  const hasSector = sectorEl?.value !== '';
  if (searchEl) searchEl.classList.toggle('search-hidden', !hasSector);
  if (tableWrap) tableWrap.classList.toggle('search-hidden', !hasSector);
  if (hintEl) hintEl.classList.toggle('search-hidden', hasSector);
}

function buildResumenEquiposHTML(sector) {
  const equipos = data.equipos.filter(e => e.sector === sector);
  const tolvas = equipos.reduce((s, e) => s + (parseInt(e.tolvas) || 0), 0);
  const sf200Total = equipos.reduce((s, e) => s + parseSf200(e.sf200), 0);
  const sf200Display = Number.isInteger(sf200Total) ? sf200Total : sf200Total.toFixed(1).replace(/\.0$/, '');
  const hidrofos = equipos.reduce((s, e) => s + (parseInt(e.hidrofos) || 0), 0);
  const motores = equipos.reduce((s, e) => s + (parseInt(e.motores) || 0), 0);
  const activas = equipos.filter(e => e.estadoPiscina === 'Activa').length;
  const pescadas = equipos.filter(e => e.estadoPiscina === 'Pescada').length;
  const emasOp = equipos.filter(e => e.estadoEma === 'Operativo').length;
  const emasIn = equipos.filter(e => e.estadoEma === 'Inactivo').length;

  // Calcular tolvas activas e inactivas
  const tolvasActivas = equipos.filter(e => e.estadoPiscina === 'Activa').reduce((s, e) => s + (parseInt(e.tolvas) || 0), 0);
  const tolvasInactivas = equipos.filter(e => e.estadoPiscina === 'Pescada').reduce((s, e) => s + (parseInt(e.tolvas) || 0), 0);
  // Calcular motores activos e inactivos por pesca
  const motoresActivos = equipos.filter(e => e.estadoPiscina === 'Activa').reduce((s, e) => s + (parseInt(e.motores) || 0), 0);
  const motoresInactivosPorPesca = equipos.filter(e => e.estadoPiscina === 'Pescada').reduce((s, e) => s + (parseInt(e.motores) || 0), 0);

  return {
    title: `Resumen del ${sector}`,
    body: `
      <li>Piscinas Activas: <strong>${activas}</strong></li>
      <li>Piscinas Pescadas: <strong>${pescadas}</strong></li>
      <li>Tolvas Activas: <strong>${tolvasActivas}</strong></li>
      <li>Tolvas Inactivas: <strong>${tolvasInactivas}</strong></li>
      <li>Motores Activos en Piscina: <strong>${motoresActivos}</strong></li>
      <li>Motores Inactivos por Pesca: <strong>${motoresInactivosPorPesca}</strong></li>
      <li>Tolvas: <strong>${tolvas}</strong></li>
      <li>Motores: <strong>${motores}</strong></li>
      <li>SF200: <strong>${sf200Display}</strong></li>
      <li>Hidrofos: <strong>${hidrofos}</strong></li>
      <li>Emas Operativos: <strong>${emasOp}</strong></li>
      <li>Emas Inactivos: <strong>${emasIn}</strong></li>
    `
  };
}

function buildResumenMotoresHTML(sector) {
  const motores = data.motores.filter(m => m.sector === sector);
  const total = motores.length;
  const taller = motores.filter(m => m.estadoMotor === 'Taller por Mantenimiento').length;
  const placa = motores.filter(m => m.estadoMotor === 'Placa').length;
  const afuera = motores.filter(m => m.estadoMotor === 'Afuera por Mantenimiento').length;
  const enPiscina = motores.filter(m => m.estadoMotor === 'Piscinas').length;

  return {
    title: `Resumen del ${sector}`,
    body: `
      <div class="resumen-stats">
        <ul class="resumen-lines">
          <li>Total de Motores Registrados: <strong>${total}</strong></li>
          <li>Taller por Mantenimiento: <strong>${taller}</strong></li>
          <li>Problemas de Placa: <strong>${placa}</strong></li>
          <li>Afuera por Mantenimiento: <strong>${afuera}</strong></li>
          <li>Motores en Piscina: <strong>${enPiscina}</strong></li>
        </ul>
      </div>
      <div class="resumen-charts">
        <div class="chart-container">
          <h3>Distribución por Estado</h3>
          <canvas id="motoresPieChart"></canvas>
        </div>
        <div class="chart-container">
          <h3>Conteo por Estado</h3>
          <canvas id="motoresBarChart"></canvas>
        </div>
      </div>
    `,
    chartData: {
      taller,
      placa,
      afuera,
      enPiscina
    }
  };
}

function showResumenSector(sector) {
  const { title, body } = buildResumenEquiposHTML(sector);
  document.getElementById('resumen-sector-title').textContent = title;
  document.getElementById('resumen-sector-body').innerHTML = `<ul class="resumen-lines">${body}</ul>`;
  document.getElementById('resumen-sector-overlay').classList.add('open');
}

function refreshResumenEquiposInline() {
  const sector = document.getElementById('filter-sector-equipos').value;
  if (!sector) return;
  const { title, body } = buildResumenEquiposHTML(sector);
  document.getElementById('equipos-resumen-title').textContent = title;
  document.getElementById('equipos-resumen-body').innerHTML = body;
}

function showResumenEquiposInline() {
  const sector = document.getElementById('filter-sector-equipos').value;
  if (!sector) {
    showToast('Seleccione un sector para ver el resumen.');
    return;
  }
  refreshResumenEquiposInline();
  document.getElementById('equipos-resumen-panel').classList.remove('search-hidden');
  document.getElementById('btn-resumen-equipos').classList.add('active');
}

function hideResumenEquiposInline() {
  document.getElementById('equipos-resumen-panel').classList.add('search-hidden');
  document.getElementById('btn-resumen-equipos').classList.remove('active');
}

function toggleResumenEquipos() {
  const panel = document.getElementById('equipos-resumen-panel');
  if (!panel.classList.contains('search-hidden')) {
    hideResumenEquiposInline();
    return;
  }
  showResumenEquiposInline();
}

function refreshResumenMotoresInline() {
  const sector = document.getElementById('filter-sector-motores').value;
  if (!sector) return;
  const { title, body, chartData } = buildResumenMotoresHTML(sector);
  document.getElementById('motores-resumen-title').textContent = title;
  document.getElementById('motores-resumen-body').innerHTML = body;
  
  // Renderizar gráficas después de actualizar el HTML
  setTimeout(() => {
    renderMotoresCharts(chartData);
  }, 100);
}

function renderMotoresCharts(data) {
  // Destruir gráficas anteriores si existen
  const pieCanvas = document.getElementById('motoresPieChart');
  const barCanvas = document.getElementById('motoresBarChart');
  
  if (pieCanvas && pieCanvas.chart) {
    pieCanvas.chart.destroy();
  }
  if (barCanvas && barCanvas.chart) {
    barCanvas.chart.destroy();
  }
  
  // Datos para las gráficas
  const labels = ['Taller por Mantenimiento', 'Problemas de Placa', 'Afuera por Mantenimiento', 'Motores en Piscina'];
  const values = [data.taller, data.placa, data.afuera, data.enPiscina];
  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'];
  
  // Gráfica de círculo (Pie Chart)
  if (pieCanvas) {
    pieCanvas.chart = new Chart(pieCanvas, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: {
                size: 11
              }
            }
          }
        }
      }
    });
  }
  
  // Gráfica de barras
  if (barCanvas) {
    barCanvas.chart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Cantidad de Motores',
          data: values,
          backgroundColor: colors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
}

function showResumenMotoresInline() {
  const sector = document.getElementById('filter-sector-motores').value;
  if (!sector) {
    showToast('Seleccione un sector para ver el resumen.');
    return;
  }
  refreshResumenMotoresInline();
  document.getElementById('motores-resumen-panel').classList.remove('search-hidden');
  document.getElementById('btn-resumen-motores').classList.add('active');
}

function hideResumenMotoresInline() {
  document.getElementById('motores-resumen-panel').classList.add('search-hidden');
  document.getElementById('btn-resumen-motores').classList.remove('active');
}

function toggleResumenMotores() {
  const panel = document.getElementById('motores-resumen-panel');
  if (!panel.classList.contains('search-hidden')) {
    hideResumenMotoresInline();
    return;
  }
  showResumenMotoresInline();
}

function closeResumenSector() {
  document.getElementById('resumen-sector-overlay').classList.remove('open');
}

// Navigation
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(link.dataset.page);

    // Cerrar sidebar después de seleccionar una opción
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.remove('open');
    }
  });
});

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  renderPage(page);
  
  // Verificar si hay sector seleccionado y mostrar notificación si no
  setTimeout(() => {
    let sectorSelectId = '';
    switch (page) {
      case 'motores': sectorSelectId = 'filter-sector-motores'; break;
      case 'piscinas': sectorSelectId = 'filter-sector-piscinas'; break;
      case 'inventario': sectorSelectId = 'filter-sector-equipos'; break;
      case 'trabajos': sectorSelectId = 'filter-sector-trabajos'; break;
      case 'componentes': sectorSelectId = 'filter-sector-componentes'; break;
      case 'sensores': sectorSelectId = 'filter-sector-sensores'; break;
      case 'resumen': sectorSelectId = 'filter-sector-resumen'; break;
    }
    
    if (sectorSelectId) {
      const sectorSelect = document.getElementById(sectorSelectId);
      if (sectorSelect && !sectorSelect.value) {
        showToast('Seleccione un sector para ver los registros');
      }
    }
  }, 100);
}

function renderPage(page) {
  switch (page) {
    case 'motores': renderMotores(); break;
    case 'piscinas': renderPiscinas(); break;
    case 'inventario': renderEquipos(); break;
    case 'resumen': renderResumen(); break;
    case 'trabajos': renderTrabajos(); break;
    case 'componentes': renderComponentes(); break;
    case 'sensores': renderSensores(); break;
  }
}

function renderComponentes() {
  // Event listeners para los botones de componentes
  const btnRegistro = document.getElementById('btn-registro-componentes');
  const btnInstalacion = document.getElementById('btn-instalacion-componentes');
  const btnResumen = document.getElementById('btn-resumen-componentes');
  const sectorSelect = document.getElementById('filter-sector-componentes');

  if (btnRegistro) {
    btnRegistro.addEventListener('click', () => showComponentesSubsection('registro'));
  }
  if (btnInstalacion) {
    btnInstalacion.addEventListener('click', () => showComponentesSubsection('instalacion'));
  }
  if (btnResumen) {
    btnResumen.addEventListener('click', () => showComponentesSubsection('resumen'));
  }

  // Habilitar/deshabilitar botones basado en sector seleccionado
  if (sectorSelect) {
    const updateButtons = () => {
      const hasSector = sectorSelect.value !== '';
      if (btnRegistro) btnRegistro.disabled = !hasSector;
      if (btnInstalacion) btnInstalacion.disabled = !hasSector;
      if (btnResumen) btnResumen.disabled = !hasSector;
    };
    sectorSelect.addEventListener('change', async () => {
      const hasSector = sectorSelect.value !== '';
      const activeSubsection = componentesSubsection;
      
      // Limpiar contenido cuando cambia el sector
      const content = document.getElementById('componentes-content');
      if (content) {
        content.innerHTML = '';
      }
      
      // Si hay una subsección activa y hay sector seleccionado, volver a renderizar
      if (activeSubsection && hasSector) {
        componentesSubsection = activeSubsection;
        await showComponentesSubsection(activeSubsection);
      } else {
        componentesSubsection = null;
      }
      
      updateButtons();
    });
    updateButtons(); // Inicializar estado
  }
}

let componentesSubsection = null;

async function showComponentesSubsection(subsection) {
  const sector = document.getElementById('filter-sector-componentes').value;
  if (!sector) {
    showToast('Seleccione un sector primero');
    return;
  }

  componentesSubsection = subsection;
  const content = document.getElementById('componentes-content');

  switch (subsection) {
    case 'registro':
      await renderRegistroComponentes(sector);
      break;
    case 'instalacion':
      await renderInstalacionComponentes(sector);
      break;
    case 'resumen':
      await renderResumenComponentes(sector);
      break;
  }
}

async function renderRegistroComponentes(sector) {
  const content = document.getElementById('componentes-content');
  const componentes = await fetchComponentes(sector);

  content.innerHTML = `
    <div class="card componentes-subsection">
      <div class="componentes-subsection-header">
        <h3>📋 Registro de Componentes</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-componente">+ Añadir Componente</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${componentes.length === 0 ? '<tr><td colspan="3"><div class="empty-state"><div class="icon">📋</div><p>No hay componentes registrados</p></div></td></tr>' :
            componentes.map(c => `
              <tr>
                <td><strong>${c.nombre}</strong></td>
                <td>${formatDate(c.fechaRegistro)}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="window.openModalComponente('${c.id}')">Editar</button>
                  <button class="btn btn-danger btn-sm" onclick="window.deleteComponente('${c.id}')">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const btnAdd = document.getElementById('btn-add-componente');
  if (btnAdd) {
    btnAdd.addEventListener('click', function(e) {
      e.preventDefault();
      window.openModalComponente();
    });
  }
}

// Modal para componente
window.openModalComponente = async function(id = null) {
  editingId = id;
  const sector = document.getElementById('filter-sector-componentes').value;

  const componentes = await fetchComponentes(sector);
  const componente = id ? componentes.find(c => c.id === id) : {};

  document.getElementById('modal-title').textContent = id ? 'Actualizar Componente' : 'Nuevo Componente';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" disabled>
        <option value="${sector}">${sector}</option>
      </select>
    </div>
    <div class="form-group">
      <label>Nombre del Componente *</label>
      <input type="text" id="f-nombre-componente" value="${componente.nombre || ''}" placeholder="Sin espacios" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
  `;

  document.getElementById('modal-save').onclick = saveComponente;
  document.getElementById('modal-overlay').classList.add('open');
};

async function saveComponente() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  const sector = document.getElementById('filter-sector-componentes').value;
  const nombre = document.getElementById('f-nombre-componente').value.trim();

  if (!nombre) { showToast('Debe ingresar el nombre del componente.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  const componente = {
    id: editingId || generateId(),
    sector,
    nombre
  };

  try {
    const url = editingId ? `${API_BASE}/componentes/${editingId}` : `${API_BASE}/componentes`;
    const method = editingId ? 'PUT' : 'POST';
    
    const response = await fetch(url, getAuthHeaders({
      method: method,
      body: JSON.stringify(componente)
    }));
    if (!response.ok) throw new Error('Error al guardar componente');

    closeModal();
    showToast('Datos guardados');
    await showComponentesSubsection('registro');
  } catch (error) {
    console.error('Error saving componente:', error);
    showToast('Error al guardar componente. Por favor intente nuevamente.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

window.deleteComponente = async function(id) {
  try {
    const response = await fetch(`${API_BASE}/componentes/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar componente');
    showToast('Componente eliminado');
    await showComponentesSubsection('registro');
  } catch (error) {
    console.error('Error deleting componente:', error);
    showToast('Error al eliminar componente. Por favor intente nuevamente.');
  }
};

async function renderInstalacionComponentes(sector) {
  const content = document.getElementById('componentes-content');
  const instalaciones = await fetchInstalacionesComponentes(sector);
  const piscinas = await fetchPiscinas(sector);
  const componentes = await fetchComponentes(sector);
  const motores = await fetchMotores(sector);

  content.innerHTML = `
    <div class="card componentes-subsection">
      <div class="componentes-subsection-header">
        <h3>🔧 Instalación de Componentes</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-instalacion-componente">+ Nueva Instalación</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Componente</th>
              <th>Punto de Instalación</th>
              <th>Detalles</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${instalaciones.length === 0 ? '<tr><td colspan="5"><div class="empty-state"><div class="icon">🔧</div><p>No hay instalaciones de componentes</p></div></td></tr>' :
            instalaciones.map(i => `
              <tr>
                <td><strong>${i.componenteNombre}</strong></td>
                <td>${i.puntoInstalacion}</td>
                <td>${getDetallesInstalacion(i)}</td>
                <td>${formatDate(i.fechaInstalacion)}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="window.openModalInstalacionComponente('${i.id}')">Editar</button>
                  <button class="btn btn-danger btn-sm" onclick="window.deleteInstalacionComponente('${i.id}')">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const btnAdd = document.getElementById('btn-add-instalacion-componente');
  if (btnAdd) {
    btnAdd.addEventListener('click', function(e) {
      e.preventDefault();
      window.openModalInstalacionComponente({ piscinas, componentes, motores });
    });
  }
}

function getDetallesInstalacion(instalacion) {
  const detalles = [];
  if (instalacion.piscinaNumero) detalles.push(`Piscina ${instalacion.piscinaNumero}`);
  if (instalacion.tolvaNumero) detalles.push(`Tolva ${instalacion.tolvaNumero}`);
  if (instalacion.motorCodigo) detalles.push(`Motor ${instalacion.motorCodigo}`);
  if (instalacion.sf200Zona) detalles.push(`Zona ${instalacion.sf200Zona}`);
  if (instalacion.tallerDetalles) detalles.push(instalacion.tallerDetalles);
  return detalles.join(' - ') || '—';
}

// Modal para instalación de componente
window.openModalInstalacionComponente = async function(idOrData) {
  editingId = typeof idOrData === 'string' ? idOrData : null;
  const sector = document.getElementById('filter-sector-componentes').value;
  const piscinas = await fetchPiscinas(sector);
  const componentes = await fetchComponentes(sector);
  const motores = await fetchMotores(sector);

  let instalacion = {};
  if (editingId) {
    const instalaciones = await fetchInstalacionesComponentes(sector);
    instalacion = instalaciones.find(i => i.id === editingId) || {};
  }

  document.getElementById('modal-title').textContent = editingId ? 'Actualizar Instalación de Componente' : 'Nueva Instalación de Componente';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" disabled>
        <option value="${sector}">${sector}</option>
      </select>
    </div>
    <div class="form-group">
      <label>Tipo de Componente *</label>
      <select id="f-componente-id" required>
        <option value="">— Seleccione un componente —</option>
        ${componentes.map(c => `<option value="${c.id}" ${instalacion.componenteId === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Punto de Instalación *</label>
      <select id="f-punto-instalacion" required>
        <option value="">— Seleccione punto de instalación —</option>
        <option value="Motores AQ1" ${instalacion.puntoInstalacion === 'Motores AQ1' ? 'selected' : ''}>Motores AQ1</option>
        <option value="Tolvas" ${instalacion.puntoInstalacion === 'Tolvas' ? 'selected' : ''}>Tolvas</option>
        <option value="SF200" ${instalacion.puntoInstalacion === 'SF200' ? 'selected' : ''}>SF200</option>
        <option value="Torre" ${instalacion.puntoInstalacion === 'Torre' ? 'selected' : ''}>Torre</option>
        <option value="Taller" ${instalacion.puntoInstalacion === 'Taller' ? 'selected' : ''}>Taller</option>
      </select>
    </div>
    <div id="campos-dinamicos"></div>
    <div class="form-group">
      <label>Fecha</label>
      <input type="text" id="f-fecha" disabled value="${new Date().toLocaleDateString('es-ES')}">
    </div>
  `;

  // Event listener para mostrar campos dinámicos según punto de instalación
  document.getElementById('f-punto-instalacion').addEventListener('change', function() {
    const puntoInstalacion = this.value;
    const camposDinamicos = document.getElementById('campos-dinamicos');
    
    let camposHTML = '';
    switch (puntoInstalacion) {
      case 'Tolvas':
        camposHTML = `
          <div class="form-group">
            <label>Número de Tolvas *</label>
            <input type="text" id="f-tolva-numero" placeholder="Ej: 1" value="${instalacion.tolvaNumero || ''}" ${!editingId ? 'autocomplete="off"' : ''}>
          </div>
          <div class="form-group">
            <label>Piscina *</label>
            <select id="f-piscina-numero" required>
              <option value="">— Seleccione una piscina —</option>
              ${piscinas.map(p => `<option value="${p.numero}" ${instalacion.piscinaNumero === p.numero ? 'selected' : ''}>${p.numero}</option>`).join('')}
            </select>
          </div>
        `;
        break;
      case 'Motores AQ1':
        camposHTML = `
          <div class="form-group">
            <label>Código de Motor *</label>
            <input type="text" id="f-motor-codigo" placeholder="Escriba para buscar..." value="${instalacion.motorCodigo || ''}" list="motores-list" ${!editingId ? 'autocomplete="off"' : ''}>
            <datalist id="motores-list">
              ${motores.map(m => `<option value="${m.codigo}">${m.codigo}</option>`).join('')}
            </datalist>
          </div>
        `;
        break;
      case 'SF200':
        camposHTML = `
          <div class="form-group">
            <label>Piscina *</label>
            <select id="f-piscina-numero" required>
              <option value="">— Seleccione una piscina —</option>
              ${piscinas.map(p => `<option value="${p.numero}" ${instalacion.piscinaNumero === p.numero ? 'selected' : ''}>${p.numero}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Zona *</label>
            <select id="f-sf200-zona" required>
              <option value="">— Seleccione zona —</option>
              <option value="Z1/Z2" ${instalacion.sf200Zona === 'Z1/Z2' ? 'selected' : ''}>Z1/Z2</option>
              <option value="Z3/Z4" ${instalacion.sf200Zona === 'Z3/Z4' ? 'selected' : ''}>Z3/Z4</option>
              <option value="Z5/Z6" ${instalacion.sf200Zona === 'Z5/Z6' ? 'selected' : ''}>Z5/Z6</option>
            </select>
          </div>
        `;
        break;
      case 'Torre':
        camposHTML = `
          <div class="form-group">
            <label>Piscina *</label>
            <select id="f-piscina-numero" required>
              <option value="">— Seleccione una piscina —</option>
              ${piscinas.map(p => `<option value="${p.numero}" ${instalacion.piscinaNumero === p.numero ? 'selected' : ''}>${p.numero}</option>`).join('')}
            </select>
          </div>
        `;
        break;
      case 'Taller':
        camposHTML = `
          <div class="form-group">
            <label>Detalles</label>
            <input type="text" id="f-taller-detalles" placeholder="Escriba los detalles..." value="${instalacion.tallerDetalles || ''}" ${!editingId ? 'autocomplete="off"' : ''}>
          </div>
        `;
        break;
    }
    camposDinamicos.innerHTML = camposHTML;
  });

  // Trigger inicial si hay un punto de instalación seleccionado
  if (instalacion.puntoInstalacion) {
    document.getElementById('f-punto-instalacion').dispatchEvent(new Event('change'));
  }

  document.getElementById('modal-save').onclick = saveInstalacionComponente;
  document.getElementById('modal-overlay').classList.add('open');
};

async function saveInstalacionComponente() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  const sector = document.getElementById('filter-sector-componentes').value;
  const componenteId = document.getElementById('f-componente-id').value;
  const puntoInstalacion = document.getElementById('f-punto-instalacion').value;

  if (!componenteId) { showToast('Debe seleccionar un componente.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!puntoInstalacion) { showToast('Debe seleccionar un punto de instalación.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  let piscinaNumero = null;
  let tolvaNumero = null;
  let motorCodigo = null;
  let sf200Zona = null;
  let tallerDetalles = null;

  switch (puntoInstalacion) {
    case 'Tolvas':
      tolvaNumero = document.getElementById('f-tolva-numero').value.trim();
      piscinaNumero = document.getElementById('f-piscina-numero').value;
      if (!tolvaNumero) { showToast('Debe ingresar el número de tolva.'); return; }
      if (!piscinaNumero) { showToast('Debe seleccionar una piscina.'); return; }
      break;
    case 'Motores AQ1':
      motorCodigo = document.getElementById('f-motor-codigo').value.trim();
      if (!motorCodigo) { showToast('Debe seleccionar un código de motor.'); return; }
      // Validar que el código de motor esté registrado
      const motores = await fetchMotores(sector);
      const motorRegistrado = motores.find(m => m.codigo === motorCodigo);
      if (!motorRegistrado) { showToast('El código de motor no está registrado. Por favor seleccione un código válido.'); return; }
      break;
    case 'SF200':
      piscinaNumero = document.getElementById('f-piscina-numero').value;
      sf200Zona = document.getElementById('f-sf200-zona').value;
      if (!piscinaNumero) { showToast('Debe seleccionar una piscina.'); return; }
      if (!sf200Zona) { showToast('Debe seleccionar una zona.'); return; }
      break;
    case 'Torre':
      piscinaNumero = document.getElementById('f-piscina-numero').value;
      if (!piscinaNumero) { showToast('Debe seleccionar una piscina.'); return; }
      break;
    case 'Taller':
      tallerDetalles = document.getElementById('f-taller-detalles') ? document.getElementById('f-taller-detalles').value.trim() : '';
      break;
  }

  const instalacion = {
    id: editingId || generateId(),
    sector,
    componente_id: componenteId,
    punto_instalacion: puntoInstalacion,
    piscina_numero: piscinaNumero,
    tolva_numero: tolvaNumero,
    motor_codigo: motorCodigo,
    sf200_zona: sf200Zona,
    taller_detalles: tallerDetalles
  };

  try {
    const url = editingId ? `${API_BASE}/instalaciones-componentes/${editingId}` : `${API_BASE}/instalaciones-componentes`;
    const method = editingId ? 'PUT' : 'POST';
    
    const response = await fetch(url, getAuthHeaders({
      method: method,
      body: JSON.stringify(instalacion)
    }));
    if (!response.ok) throw new Error('Error al guardar instalación de componente');

    closeModal();
    showToast('Datos guardados');
    await showComponentesSubsection('instalacion');
  } catch (error) {
    console.error('Error saving instalación componente:', error);
    showToast('Error al guardar instalación de componente. Por favor intente nuevamente.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

window.deleteInstalacionComponente = async function(id) {
  try {
    const response = await fetch(`${API_BASE}/instalaciones-componentes/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar instalación de componente');
    showToast('Instalación eliminada');
    await showComponentesSubsection('instalacion');
  } catch (error) {
    console.error('Error deleting instalación componente:', error);
    showToast('Error al eliminar instalación de componente. Por favor intente nuevamente.');
  }
};

async function renderResumenComponentes(sector) {
  const content = document.getElementById('componentes-content');
  const instalaciones = await fetchInstalacionesComponentes(sector);

  // Generar lista de componentes disponibles
  const componentesDisponibles = [...new Set(instalaciones.map(i => i.componenteNombre))].sort();
  const mesesDisponibles = obtenerMesesDisponiblesComponentes(instalaciones);
  const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM

  content.innerHTML = `
    <div class="card componentes-subsection">
      <div class="componentes-subsection-header">
        <h3>📊 Resumen de Componentes</h3>
      </div>
      <div class="resumen-componentes-filters">
        <select id="filter-componente" class="form-select">
          <option value="">Todos los componentes</option>
          ${componentesDisponibles.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <select id="filter-mes" class="form-select">
          <option value="">Todos los meses</option>
          ${mesesDisponibles.map(m => `<option value="${m}" ${m === mesActual ? 'selected' : ''}>${formatMes(m)}</option>`).join('')}
        </select>
        <select id="filter-semana" class="form-select" disabled>
          <option value="">Todas las semanas</option>
        </select>
        <div>
          <label>Vista</label>
          <select id="filter-vista" class="form-select">
            <option value="nombres">Por Componente</option>
            <option value="puntos">Por punto de instalacion</option>
            <option value="combinadas">Combinadas</option>
          </select>
        </div>
      </div>
      <div id="resumen-componentes-content"></div>
    </div>
  `;

  // Event listeners para filtros
  const filterComponente = document.getElementById('filter-componente');
  const filterMes = document.getElementById('filter-mes');
  const filterSemana = document.getElementById('filter-semana');

  // Inicializar selector de semana si hay un mes seleccionado por defecto
  if (filterMes.value) {
    const semanas = obtenerSemanasDelMesComponentes(filterMes.value, instalaciones);
    filterSemana.innerHTML = '<option value="">Todas las semanas</option>' + 
      semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join('');
    filterSemana.disabled = false;
  }

  filterComponente.addEventListener('input', () => {
    aplicarFiltrosComponentes(instalaciones);
  });

  filterMes.addEventListener('input', () => {
    const mesSeleccionado = filterMes.value;
    if (mesSeleccionado) {
      const semanas = obtenerSemanasDelMesComponentes(mesSeleccionado, instalaciones);
      filterSemana.innerHTML = '<option value="">Todas las semanas</option>' + 
        semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join('');
      filterSemana.disabled = false;
    } else {
      filterSemana.innerHTML = '<option value="">Todas las semanas</option>';
      filterSemana.disabled = true;
    }
    aplicarFiltrosComponentes(instalaciones);
  });

  filterSemana.addEventListener('input', () => {
    aplicarFiltrosComponentes(instalaciones);
  });

  const filterVista = document.getElementById('filter-vista');
  filterVista.addEventListener('change', () => {
    const vista = filterVista.value;
    
    // Resetear filtro de componente cuando cambia la vista
    if (vista === 'combinadas') {
      filterComponente.value = '';
    }
    
    aplicarFiltrosComponentes(instalaciones, vista);
  });

  // Renderizar resumen inicial por nombre
  aplicarFiltrosComponentes(instalaciones, 'nombres');
}

function renderResumenComponentesPorNombre(instalaciones) {
  const content = document.getElementById('resumen-componentes-content');
  
  // Agrupar por nombre de componente
  const agrupado = {};
  instalaciones.forEach(i => {
    if (!agrupado[i.componenteNombre]) {
      agrupado[i.componenteNombre] = [];
    }
    agrupado[i.componenteNombre].push(i);
  });

  content.innerHTML = `
    <div class="resumen-componentes-margenes">
      ${Object.keys(agrupado).map((nombre) => `
        <div class="resumen-componentes-margen">
          <div class="resumen-componentes-margen-header">Componentes: ${nombre} (${agrupado[nombre].length} registros)</div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Punto de Instalación</th>
                  <th>Detalles</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${agrupado[nombre].map(i => `
                  <tr>
                    <td>${i.puntoInstalacion}</td>
                    <td>${getDetallesInstalacion(i)}</td>
                    <td>${formatDate(i.fechaInstalacion)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderResumenComponentesPorPunto(instalaciones) {
  const content = document.getElementById('resumen-componentes-content');
  
  // Agrupar por punto de instalación
  const agrupado = {};
  instalaciones.forEach(i => {
    if (!agrupado[i.puntoInstalacion]) {
      agrupado[i.puntoInstalacion] = [];
    }
    agrupado[i.puntoInstalacion].push(i);
  });

  content.innerHTML = `
    <div class="resumen-componentes-margenes">
      ${Object.keys(agrupado).map((punto, index) => `
        <div class="resumen-componentes-margen">
          <div class="resumen-componentes-margen-header">Punto de Instalación ${index + 1}: ${punto} (${agrupado[punto].length} registros)</div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Detalles</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${agrupado[punto].map(i => `
                  <tr>
                    <td>${i.componenteNombre}</td>
                    <td>${getDetallesInstalacion(i)}</td>
                    <td>${formatDate(i.fechaInstalacion)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderResumenComponentesCombinadas(instalaciones) {
  const content = document.getElementById('resumen-componentes-content');
  
  // Primera sección: Por Nombre
  const agrupadoPorNombre = {};
  instalaciones.forEach(i => {
    if (!agrupadoPorNombre[i.componenteNombre]) {
      agrupadoPorNombre[i.componenteNombre] = [];
    }
    agrupadoPorNombre[i.componenteNombre].push(i);
  });

  // Segunda sección: Por Punto de Instalación
  const agrupadoPorPunto = {};
  instalaciones.forEach(i => {
    if (!agrupadoPorPunto[i.puntoInstalacion]) {
      agrupadoPorPunto[i.puntoInstalacion] = [];
    }
    agrupadoPorPunto[i.puntoInstalacion].push(i);
  });

  content.innerHTML = `
    <div class="resumen-componentes-margenes">
      <div class="resumen-componentes-margen">
        <div class="resumen-componentes-margen-header">📋 Por Nombre</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Componentes</th>
                <th>Punto de Instalación</th>
                <th>Detalles</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${instalaciones.map(i => `
                <tr>
                  <td><strong>${i.componenteNombre}</strong></td>
                  <td>${i.puntoInstalacion}</td>
                  <td>${getDetallesInstalacion(i)}</td>
                  <td>${formatDate(i.fechaInstalacion)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="resumen-componentes-margen">
        <div class="resumen-componentes-margen-header">🔧 Por Punto de Instalación</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Punto de Instalación</th>
                <th>Componente</th>
                <th>Detalles</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${instalaciones.map(i => `
                <tr>
                  <td><strong>${i.puntoInstalacion}</strong></td>
                  <td>${i.componenteNombre}</td>
                  <td>${getDetallesInstalacion(i)}</td>
                  <td>${formatDate(i.fechaInstalacion)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function obtenerMesesDisponiblesComponentes(instalaciones) {
  const meses = new Set();
  instalaciones.forEach(i => {
    const fecha = new Date(i.fechaInstalacion);
    const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    meses.add(mesKey);
  });
  return Array.from(meses).sort().reverse();
}

function obtenerSemanasDelMesComponentes(mesKey, instalaciones) {
  const semanas = new Set();
  instalaciones.forEach(i => {
    const fecha = new Date(i.fechaInstalacion);
    const mesInstalacion = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (mesInstalacion === mesKey) {
      const dia = fecha.getDate();
      const semana = Math.ceil(dia / 7);
      semanas.add(semana);
    }
  });
  return Array.from(semanas).sort((a, b) => a - b);
}

function aplicarFiltrosComponentes(instalaciones, vista = 'nombres') {
  const filterComponente = document.getElementById('filter-componente');
  const filterMes = document.getElementById('filter-mes');
  const filterSemana = document.getElementById('filter-semana');
  
  let instalacionesFiltradas = [...instalaciones];
  
  // Filtrar por componente
  if (filterComponente && filterComponente.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => i.componenteNombre === filterComponente.value);
  }
  
  // Filtrar por mes
  if (filterMes && filterMes.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      return mesKey === filterMes.value;
    });
  }
  
  // Filtrar por semana
  if (filterSemana && filterSemana.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const dia = fecha.getDate();
      const semana = Math.ceil(dia / 7);
      return semana === parseInt(filterSemana.value);
    });
  }
  
  // Renderizar según la vista seleccionada
  if (vista === 'nombres') {
    renderResumenComponentesPorNombre(instalacionesFiltradas);
  } else if (vista === 'puntos') {
    renderResumenComponentesPorPunto(instalacionesFiltradas);
  } else if (vista === 'combinadas') {
    renderResumenComponentesCombinadas(instalacionesFiltradas);
  }
  
  // Generar gráficas basadas en los datos filtrados
  updateComponentesCharts(instalacionesFiltradas);
}

function updateComponentesCharts(instalaciones) {
  if (instalaciones.length === 0) {
    clearCharts();
    return;
  }
  
  // Agrupar datos para gráficas según la vista activa
  let labels = [];
  let data = [];
  
  if (activeComponentesTab === 'nombres') {
    // Agrupar por nombre de componente
    const agrupado = {};
    instalaciones.forEach(i => {
      if (!agrupado[i.componenteNombre]) {
        agrupado[i.componenteNombre] = 0;
      }
      agrupado[i.componenteNombre]++;
    });
    labels = Object.keys(agrupado);
    data = Object.values(agrupado);
  } else if (activeComponentesTab === 'puntos') {
    // Agrupar por punto de instalación
    const agrupado = {};
    instalaciones.forEach(i => {
      if (!agrupado[i.puntoInstalacion]) {
        agrupado[i.puntoInstalacion] = 0;
      }
      agrupado[i.puntoInstalacion]++;
    });
    labels = Object.keys(agrupado);
    data = Object.values(agrupado);
  } else if (activeComponentesTab === 'combinadas') {
    // Agrupar por nombre de componente para vista combinada
    const agrupado = {};
    instalaciones.forEach(i => {
      if (!agrupado[i.componenteNombre]) {
        agrupado[i.componenteNombre] = 0;
      }
      agrupado[i.componenteNombre]++;
    });
    labels = Object.keys(agrupado);
    data = Object.values(agrupado);
  }
  
  // Crear gráficas
  createBarChart(labels, data, 'Cantidad de Instalaciones');
  createPieChart(labels, data, 'Distribución');
}

function renderSensores() {
  // Event listeners para los botones de sensores
  const btnRegistro = document.getElementById('btn-registro-sensores');
  const btnLote = document.getElementById('btn-lote-sensores');
  const btnInstalacion = document.getElementById('btn-instalacion-sensores');
  const btnResumen = document.getElementById('btn-resumen-sensores');
  const sectorSelect = document.getElementById('filter-sector-sensores');

  if (btnRegistro) {
    btnRegistro.addEventListener('click', () => showSensoresSubsection('registro'));
  }
  if (btnLote) {
    btnLote.addEventListener('click', () => showSensoresSubsection('lote'));
  }
  if (btnInstalacion) {
    btnInstalacion.addEventListener('click', () => showSensoresSubsection('instalacion'));
  }
  if (btnResumen) {
    btnResumen.addEventListener('click', () => showSensoresSubsection('resumen'));
  }

  // Habilitar/deshabilitar botones basado en sector seleccionado
  if (sectorSelect) {
    const updateButtons = () => {
      const hasSector = sectorSelect.value !== '';
      if (btnRegistro) btnRegistro.disabled = !hasSector;
      if (btnLote) btnLote.disabled = !hasSector;
      if (btnInstalacion) btnInstalacion.disabled = !hasSector;
      if (btnResumen) btnResumen.disabled = !hasSector;
    };
    sectorSelect.addEventListener('change', async () => {
      const hasSector = sectorSelect.value !== '';
      const activeSubsection = sensoresSubsection;

      // Limpiar contenido cuando cambia el sector
      const content = document.getElementById('sensores-content');
      if (content) {
        content.innerHTML = '';
      }

      // Si hay una subsección activa y hay sector seleccionado, volver a renderizar
      if (activeSubsection && hasSector) {
        sensoresSubsection = activeSubsection;
        await showSensoresSubsection(activeSubsection);
      } else {
        sensoresSubsection = null;
      }

      updateButtons();
    });
    updateButtons(); // Inicializar estado
  }
}

let sensoresSubsection = null;

async function showSensoresSubsection(subsection) {
  const sector = document.getElementById('filter-sector-sensores').value;
  if (!sector) {
    showToast('Seleccione un sector primero');
    return;
  }

  sensoresSubsection = subsection;
  const content = document.getElementById('sensores-content');

  switch (subsection) {
    case 'registro':
      await renderRegistroSensores(sector);
      break;
    case 'lote':
      await renderLoteSensores(sector);
      break;
    case 'instalacion':
      await renderInstalacionSensores(sector);
      break;
    case 'resumen':
      await renderResumenSensores(sector);
      break;
  }
}

async function renderRegistroSensores(sector) {
  const content = document.getElementById('sensores-content');
  const sensores = await fetchSensores(sector);

  content.innerHTML = `
    <div class="card componentes-subsection">
      <div class="componentes-subsection-header">
        <h3>📋 Registro de Sensores</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-sensor">+ Añadir Sensor</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${sensores.length === 0 ? '<tr><td colspan="3"><div class="empty-state"><div class="icon">📋</div><p>No hay sensores registrados</p></div></td></tr>' :
            sensores.map(s => `
              <tr>
                <td><strong>${s.nombre}</strong></td>
                <td>${formatDate(s.fechaRegistro)}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="window.openModalSensor('${s.id}')">Editar</button>
                  <button class="btn btn-danger btn-sm" onclick="window.deleteSensor('${s.id}')">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const btnAdd = document.getElementById('btn-add-sensor');
  if (btnAdd) {
    btnAdd.addEventListener('click', function(e) {
      e.preventDefault();
      window.openModalSensor();
    });
  }
}

async function renderLoteSensores(sector) {
  const content = document.getElementById('sensores-content');
  const lotes = await fetchLotesSensores(sector);

  content.innerHTML = `
    <div class="card componentes-subsection">
      <div class="componentes-subsection-header">
        <h3>📦 Lotes de Sensores</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-lote-sensor">+ Añadir Lote</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Código de Lote</th>
              <th>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${lotes.length === 0 ? '<tr><td colspan="3"><div class="empty-state"><div class="icon">📦</div><p>No hay lotes registrados</p></div></td></tr>' :
            lotes.map(l => `
              <tr>
                <td><strong>${l.codigoLote}</strong></td>
                <td>${formatDate(l.fechaRegistro)}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="window.openModalLoteSensor('${l.id}')">Editar</button>
                  <button class="btn btn-danger btn-sm" onclick="window.deleteLoteSensor('${l.id}')">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const btnAdd = document.getElementById('btn-add-lote-sensor');
  if (btnAdd) {
    btnAdd.addEventListener('click', function(e) {
      e.preventDefault();
      window.openModalLoteSensor();
    });
  }
}

async function renderInstalacionSensores(sector) {
  const content = document.getElementById('sensores-content');
  const instalaciones = await fetchInstalacionesSensores(sector);
  const piscinas = await fetchPiscinas(sector);
  const sensores = await fetchSensores(sector);
  const motores = await fetchMotores(sector);

  content.innerHTML = `
    <div class="card componentes-subsection">
      <div class="componentes-subsection-header">
        <h3>🔧 Instalación de Sensores</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-instalacion-sensor">+ Nueva Instalación</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Sensor</th>
              <th>Punto de Instalación</th>
              <th>Ubicación</th>
              <th>Lote</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${instalaciones.length === 0 ? '<tr><td colspan="6"><div class="empty-state"><div class="icon">🔧</div><p>No hay instalaciones de sensores</p></div></td></tr>' :
            instalaciones.map(i => `
              <tr>
                <td><strong>${i.sensorNombre}</strong></td>
                <td>${i.puntoInstalacion}</td>
                <td>${getUbicacionInstalacionSensor(i)}</td>
                <td>${i.loteCodigo || '—'}</td>
                <td>${formatDate(i.fechaInstalacion)}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="window.openModalInstalacionSensor('${i.id}')">Editar</button>
                  <button class="btn btn-danger btn-sm" onclick="window.deleteInstalacionSensor('${i.id}')">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const btnAdd = document.getElementById('btn-add-instalacion-sensor');
  if (btnAdd) {
    btnAdd.addEventListener('click', function(e) {
      e.preventDefault();
      window.openModalInstalacionSensor({ piscinas, sensores, motores });
    });
  }
}

function getUbicacionInstalacionSensor(instalacion) {
  const detalles = [];
  if (instalacion.piscinaNumero) detalles.push(`Piscina ${instalacion.piscinaNumero}`);
  if (instalacion.tolvaNumero) detalles.push(`Tolva ${instalacion.tolvaNumero}`);
  if (instalacion.motorCodigo) detalles.push(`Motor ${instalacion.motorCodigo}`);
  if (instalacion.sf200Zona) detalles.push(instalacion.sf200Zona);
  if (instalacion.tallerDetalles) detalles.push(instalacion.tallerDetalles);
  return detalles.join(' - ') || '—';
}

function getDetallesInstalacionSensor(instalacion) {
  const detalles = [];
  if (instalacion.loteCodigo) detalles.push(`Lote: ${instalacion.loteCodigo}`);
  if (instalacion.piscinaNumero) detalles.push(`Piscina ${instalacion.piscinaNumero}`);
  if (instalacion.tolvaNumero) detalles.push(`Tolva ${instalacion.tolvaNumero}`);
  if (instalacion.motorCodigo) detalles.push(`Motor ${instalacion.motorCodigo}`);
  if (instalacion.sf200Zona) detalles.push(instalacion.sf200Zona);
  if (instalacion.tallerDetalles) detalles.push(instalacion.tallerDetalles);
  return detalles.join(' - ') || '—';
}

async function renderResumenSensores(sector) {
  const content = document.getElementById('sensores-content');
  const instalaciones = await fetchInstalacionesSensores(sector);
  const lotes = await fetchLotesSensores(sector);

  // Generar lista de sensores disponibles
  const sensoresDisponibles = [...new Set(instalaciones.map(i => i.sensorNombre))].sort();
  const mesesDisponibles = obtenerMesesDisponiblesSensores(instalaciones);
  const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM
  const lotesDisponibles = [...new Set(instalaciones.filter(i => i.loteCodigo).map(i => i.loteCodigo))].sort();

  content.innerHTML = `
    <div class="card componentes-subsection">
      <div class="componentes-subsection-header">
        <h3>📊 Resumen de Sensores</h3>
      </div>
      <div class="resumen-componentes-filters">
        <select id="filter-sensor" class="form-select">
          <option value="">Todos los sensores</option>
          ${sensoresDisponibles.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <select id="filter-lote-sensores" class="form-select">
          <option value="">Seleccionar lote</option>
          ${lotesDisponibles.map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
        <select id="filter-mes-sensores" class="form-select">
          <option value="">Todos los meses</option>
          ${mesesDisponibles.map(m => `<option value="${m}" ${m === mesActual ? 'selected' : ''}>${formatMes(m)}</option>`).join('')}
        </select>
      </div>
      <div id="resumen-sensores-content"></div>
    </div>
  `;

  // Event listeners para filtros
  const filterSensor = document.getElementById('filter-sensor');
  const filterLote = document.getElementById('filter-lote-sensores');
  const filterMes = document.getElementById('filter-mes-sensores');

  filterSensor.addEventListener('input', () => {
    filterLote.value = '';
    aplicarFiltrosSensores(instalaciones);
  });

  filterLote.addEventListener('input', () => {
    aplicarFiltrosSensores(instalaciones);
  });

  filterMes.addEventListener('input', () => {
    aplicarFiltrosSensores(instalaciones);
  });

  // Renderizar resumen inicial
  aplicarFiltrosSensores(instalaciones);
}

function obtenerMesesDisponiblesSensores(instalaciones) {
  const meses = new Set();
  instalaciones.forEach(i => {
    const fecha = new Date(i.fechaInstalacion);
    const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    meses.add(mesKey);
  });
  return Array.from(meses).sort().reverse();
}

function aplicarFiltrosSensores(instalaciones) {
  const filterSensor = document.getElementById('filter-sensor');
  const filterLote = document.getElementById('filter-lote-sensores');
  const filterMes = document.getElementById('filter-mes-sensores');

  let instalacionesFiltradas = [...instalaciones];

  if (filterSensor?.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => i.sensorNombre === filterSensor.value);
  }

  if (filterLote?.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => i.loteCodigo === filterLote.value);
  }

  if (filterMes?.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      return mesKey === filterMes.value;
    });
  }

  renderResumenSensoresContent(instalacionesFiltradas);
}

function renderResumenSensoresContent(instalaciones) {
  const content = document.getElementById('resumen-sensores-content');
  
  if (instalaciones.length === 0) {
    content.innerHTML = '<div class="empty-state"><div class="icon">📊</div><p>No hay datos para mostrar</p></div>';
    return;
  }
  
  // Agrupar por nombre de sensor
  const agrupado = {};
  instalaciones.forEach(i => {
    if (!agrupado[i.sensorNombre]) {
      agrupado[i.sensorNombre] = [];
    }
    agrupado[i.sensorNombre].push(i);
  });
  
  content.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Sensor</th>
            <th>Cantidad de Instalaciones</th>
          </tr>
        </thead>
        <tbody>
          ${Object.keys(agrupado).map(nombre => `
            <tr>
              <td><strong>${nombre}</strong></td>
              <td>${agrupado[nombre].length}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Modal para sensor
window.openModalSensor = async function(id = null) {
  editingId = id;
  const sector = document.getElementById('filter-sector-sensores').value;

  const sensores = await fetchSensores(sector);
  const sensor = id ? sensores.find(s => s.id === id) : {};

  document.getElementById('modal-title').textContent = id ? 'Actualizar Sensor' : 'Nuevo Sensor';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" disabled>
        <option value="${sector}">${sector}</option>
      </select>
    </div>
    <div class="form-group">
      <label>Nombre del Sensor *</label>
      <input type="text" id="f-nombre-sensor" value="${sensor.nombre || ''}" placeholder="Sin espacios" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
  `;

  document.getElementById('modal-save').onclick = saveSensor;
  document.getElementById('modal-overlay').classList.add('open');
};

async function saveSensor() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  const sector = document.getElementById('filter-sector-sensores').value;
  const nombre = document.getElementById('f-nombre-sensor').value.trim();

  if (!nombre) { showToast('Debe ingresar el nombre del sensor.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  const sensor = {
    id: editingId || generateId(),
    sector,
    nombre
  };

  try {
    const url = editingId ? `${API_BASE}/sensores/${editingId}` : `${API_BASE}/sensores`;
    const method = editingId ? 'PUT' : 'POST';
    
    const response = await fetch(url, getAuthHeaders({
      method: method,
      body: JSON.stringify(sensor)
    }));
    if (!response.ok) throw new Error('Error al guardar sensor');

    closeModal();
    showToast('Datos guardados');
    await showSensoresSubsection('registro');
  } catch (error) {
    console.error('Error saving sensor:', error);
    showToast('Error al guardar sensor. Por favor intente nuevamente.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

window.deleteSensor = async function(id) {
  try {
    const response = await fetch(`${API_BASE}/sensores/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar sensor');
    showToast('Sensor eliminado');
    await showSensoresSubsection('registro');
  } catch (error) {
    console.error('Error deleting sensor:', error);
    showToast('Error al eliminar sensor. Por favor intente nuevamente.');
  }
};

// Modal para lote de sensor
window.openModalLoteSensor = async function(id = null) {
  editingId = id;
  const sector = document.getElementById('filter-sector-sensores').value;

  const lotes = await fetchLotesSensores(sector);
  const lote = id ? lotes.find(l => l.id === id) : {};

  document.getElementById('modal-title').textContent = id ? 'Actualizar Lote de Sensor' : 'Nuevo Lote de Sensor';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" disabled>
        <option value="${sector}">${sector}</option>
      </select>
    </div>
    <div class="form-group">
      <label>Código de Lote *</label>
      <input type="text" id="f-codigo-lote" value="${lote.codigoLote || ''}" placeholder="Sin espacios" autocomplete="off">
    </div>
  `;

  // Agregar restricción para no permitir espacios
  const codigoLoteInput = document.getElementById('f-codigo-lote');
  if (codigoLoteInput) {
    codigoLoteInput.addEventListener('input', () => {
      codigoLoteInput.value = codigoLoteInput.value.replace(/\s/g, '');
    });
  }

  document.getElementById('modal-save').onclick = saveLoteSensor;
  document.getElementById('modal-overlay').classList.add('open');
};

async function saveLoteSensor() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  const sector = document.getElementById('filter-sector-sensores').value;
  const codigoLote = document.getElementById('f-codigo-lote').value.trim();

  if (!codigoLote) { showToast('Debe ingresar el código de lote.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  const lote = {
    id: editingId || generateId(),
    sector,
    codigo_lote: codigoLote
  };

  try {
    const url = editingId ? `${API_BASE}/lotes-sensores/${editingId}` : `${API_BASE}/lotes-sensores`;
    const method = editingId ? 'PUT' : 'POST';

    const response = await fetch(url, getAuthHeaders({
      method: method,
      body: JSON.stringify(lote)
    }));
    if (!response.ok) throw new Error('Error al guardar lote de sensor');

    closeModal();
    showToast('Datos guardados');
    await showSensoresSubsection('lote');
  } catch (error) {
    console.error('Error saving lote sensor:', error);
    showToast('Error al guardar lote. Por favor intente nuevamente.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

window.deleteLoteSensor = async function(id) {
  try {
    const response = await fetch(`${API_BASE}/lotes-sensores/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar lote de sensor');
    showToast('Lote eliminado');
    await showSensoresSubsection('lote');
  } catch (error) {
    console.error('Error deleting lote sensor:', error);
    showToast('Error al eliminar lote. Por favor intente nuevamente.');
  }
};

// Modal para instalación de sensor
window.openModalInstalacionSensor = async function(idOrData) {
  editingId = typeof idOrData === 'string' ? idOrData : null;
  const sector = document.getElementById('filter-sector-sensores').value;
  const piscinas = await fetchPiscinas(sector);
  const sensores = await fetchSensores(sector);
  const motores = await fetchMotores(sector);
  const lotes = await fetchLotesSensores(sector);

  let instalacion = {};
  if (editingId) {
    const instalaciones = await fetchInstalacionesSensores(sector);
    instalacion = instalaciones.find(i => i.id === editingId) || {};
  }

  document.getElementById('modal-title').textContent = editingId ? 'Actualizar Instalación de Sensor' : 'Nueva Instalación de Sensor';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" disabled>
        <option value="${sector}">${sector}</option>
      </select>
    </div>
    <div class="form-group">
      <label>Tipo de Sensor *</label>
      <select id="f-sensor-id" required>
        <option value="">— Seleccione un sensor —</option>
        ${sensores.map(s => `<option value="${s.id}" ${instalacion.sensorId === s.id ? 'selected' : ''}>${s.nombre}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Lote (Opcional)</label>
      <select id="f-lote-id">
        <option value="">— Sin lote —</option>
        ${lotes.map(l => `<option value="${l.id}" ${instalacion.loteId === l.id ? 'selected' : ''}>${l.codigoLote}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Punto de Instalación *</label>
      <select id="f-punto-instalacion" required>
        <option value="">— Seleccione punto de instalación —</option>
        <option value="Motores AQ1" ${instalacion.puntoInstalacion === 'Motores AQ1' ? 'selected' : ''}>Motores AQ1</option>
        <option value="Tolvas" ${instalacion.puntoInstalacion === 'Tolvas' ? 'selected' : ''}>Tolvas</option>
        <option value="Piscinas" ${instalacion.puntoInstalacion === 'Piscinas' ? 'selected' : ''}>Piscinas</option>
        <option value="Taller" ${instalacion.puntoInstalacion === 'Taller' ? 'selected' : ''}>Taller</option>
      </select>
    </div>
    <div id="campos-dinamicos-sensores"></div>
  `;

  // Manejar campos dinámicos según punto de instalación
  const puntoInstalacion = document.getElementById('f-punto-instalacion');
  const sensorSelect = document.getElementById('f-sensor-id');
  const camposDinamicos = document.getElementById('campos-dinamicos-sensores');

  const actualizarCamposDinamicos = () => {
    const seleccionado = puntoInstalacion.value;
    const sensorId = sensorSelect.value;
    const sensor = sensores.find(s => s.id === sensorId);
    const esHidrofonos = sensor && sensor.nombre.toLowerCase().includes('hidrofono');
    let camposHTML = '';

    switch (seleccionado) {
      case 'Motores AQ1':
        camposHTML = `
          <div class="form-group">
            <label>Código de Motor</label>
            <select id="f-motor-codigo">
              <option value="">— Seleccione un motor —</option>
              ${motores.map(m => `<option value="${m.codigo}" ${instalacion.motorCodigo === m.codigo ? 'selected' : ''}>${m.codigo}</option>`).join('')}
            </select>
          </div>
        `;
        break;
      case 'Tolvas':
        camposHTML = `
          <div class="form-group">
            <label>Piscina *</label>
            <select id="f-piscina-numero" required>
              <option value="">— Seleccione una piscina —</option>
              ${piscinas.map(p => `<option value="${p.numero}" ${instalacion.piscinaNumero === p.numero ? 'selected' : ''}>${p.numero}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Número de Tolva</label>
            <input type="text" id="f-tolva-numero" value="${instalacion.tolvaNumero || ''}" placeholder="Número de tolva">
          </div>
        `;
        break;
      case 'Piscinas':
        camposHTML = `
          <div class="form-group">
            <label>Piscina *</label>
            <select id="f-piscina-numero" required>
              <option value="">— Seleccione una piscina —</option>
              ${piscinas.map(p => `<option value="${p.numero}" ${instalacion.piscinaNumero === p.numero ? 'selected' : ''}>${p.numero}</option>`).join('')}
            </select>
          </div>
        `;
        if (esHidrofonos) {
          camposHTML += `
            <div class="form-group">
              <label>Zona *</label>
              <select id="f-sf200-zona" required>
                <option value="">— Seleccione una zona —</option>
                <option value="Zona 1" ${instalacion.sf200Zona === 'Zona 1' ? 'selected' : ''}>Zona 1</option>
                <option value="Zona 2" ${instalacion.sf200Zona === 'Zona 2' ? 'selected' : ''}>Zona 2</option>
                <option value="Zona 3" ${instalacion.sf200Zona === 'Zona 3' ? 'selected' : ''}>Zona 3</option>
                <option value="Zona 4" ${instalacion.sf200Zona === 'Zona 4' ? 'selected' : ''}>Zona 4</option>
                <option value="Zona 5" ${instalacion.sf200Zona === 'Zona 5' ? 'selected' : ''}>Zona 5</option>
                <option value="Zona 6" ${instalacion.sf200Zona === 'Zona 6' ? 'selected' : ''}>Zona 6</option>
                <option value="Zona 7" ${instalacion.sf200Zona === 'Zona 7' ? 'selected' : ''}>Zona 7</option>
                <option value="Zona 8" ${instalacion.sf200Zona === 'Zona 8' ? 'selected' : ''}>Zona 8</option>
              </select>
            </div>
          `;
        }
        break;
      case 'Taller':
        camposHTML = `
          <div class="form-group">
            <label>Detalles</label>
            <input type="text" id="f-taller-detalles" placeholder="Escriba los detalles..." value="${instalacion.tallerDetalles || ''}" ${!editingId ? 'autocomplete="off"' : ''}>
          </div>
        `;
        break;
    }
    camposDinamicos.innerHTML = camposHTML;
  };

  puntoInstalacion.addEventListener('change', actualizarCamposDinamicos);
  sensorSelect.addEventListener('change', actualizarCamposDinamicos);

  // Trigger inicial si hay un punto de instalación seleccionado
  if (instalacion.puntoInstalacion || instalacion.sensorId) {
    actualizarCamposDinamicos();
  }

  document.getElementById('modal-save').onclick = saveInstalacionSensor;
  document.getElementById('modal-overlay').classList.add('open');
};

async function saveInstalacionSensor() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  const sector = document.getElementById('filter-sector-sensores').value;
  const sensorId = document.getElementById('f-sensor-id').value;
  const loteId = document.getElementById('f-lote-id').value || null;
  const puntoInstalacion = document.getElementById('f-punto-instalacion').value;

  if (!sensorId) { showToast('Debe seleccionar un sensor.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!puntoInstalacion) { showToast('Debe seleccionar un punto de instalación.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  let piscinaNumero = null;
  let tolvaNumero = null;
  let motorCodigo = null;
  let sf200Zona = null;
  let tallerDetalles = null;

  switch (puntoInstalacion) {
    case 'Tolvas':
      tolvaNumero = document.getElementById('f-tolva-numero')?.value.trim() || null;
      piscinaNumero = document.getElementById('f-piscina-numero')?.value || null;
      if (!piscinaNumero) { showToast('Debe seleccionar una piscina.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
      break;
    case 'Piscinas':
      piscinaNumero = document.getElementById('f-piscina-numero')?.value || null;
      if (!piscinaNumero) { showToast('Debe seleccionar una piscina.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
      sf200Zona = document.getElementById('f-sf200-zona')?.value || null;
      break;
    case 'Motores AQ1':
      motorCodigo = document.getElementById('f-motor-codigo')?.value || null;
      if (!motorCodigo) { showToast('Debe seleccionar un motor.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
      break;
    case 'Taller':
      tallerDetalles = document.getElementById('f-taller-detalles')?.value.trim() || null;
      break;
  }

  const instalacion = {
    id: editingId || generateId(),
    sector,
    sensor_id: sensorId,
    lote_id: loteId,
    punto_instalacion: puntoInstalacion,
    piscina_numero: piscinaNumero,
    tolva_numero: tolvaNumero,
    motor_codigo: motorCodigo,
    sf200_zona: sf200Zona,
    taller_detalles: tallerDetalles
  };

  try {
    const url = editingId ? `${API_BASE}/instalaciones-sensores/${editingId}` : `${API_BASE}/instalaciones-sensores`;
    const method = editingId ? 'PUT' : 'POST';
    
    console.log('Sending request to:', url);
    console.log('Request body:', instalacion);
    
    const response = await fetch(url, getAuthHeaders({
      method: method,
      body: JSON.stringify(instalacion)
    }));
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error response:', errorData);
      throw new Error(errorData.error || 'Error al guardar instalación de sensor');
    }

    closeModal();
    showToast('Datos guardados');
    await showSensoresSubsection('instalacion');
  } catch (error) {
    console.error('Error saving instalacion sensor:', error);
    showToast('Error al guardar instalación. Por favor intente nuevamente.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

window.deleteInstalacionSensor = async function(id) {
  try {
    const response = await fetch(`${API_BASE}/instalaciones-sensores/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar instalación de sensor');
    showToast('Instalación eliminada');
    await showSensoresSubsection('instalacion');
  } catch (error) {
    console.error('Error deleting instalacion sensor:', error);
    showToast('Error al eliminar instalación. Por favor intente nuevamente.');
  }
};

// Modal
function openModal(type, id = null) {
  editingId = id;
  currentModal = type;
  const titles = {
    motor: id ? 'Actualizar Motor' : 'Añadir Motor',
    piscina: id ? 'Actualizar Piscina' : 'Nueva Piscina',
    equipo: id ? 'Actualizar Equipo AQ1' : 'Nuevo Equipo AQ1'
  };
  document.getElementById('modal-title').textContent = titles[type];
  const body = document.getElementById('modal-body');

  if (type === 'motor') {
    body.innerHTML = motorForm(id);
    initMotorFormHandlers();
    if (id) {
      const m = data.motores.find(x => x.id === id);
      if (m?.piscinaId) {
        const piscina = document.getElementById('f-piscinaId');
        if (piscina) piscina.value = m.piscinaId;
      }
    }
  } else if (type === 'piscina') {
    body.innerHTML = piscinaForm(id);
    initPiscinaFormHandlers();
  } else if (type === 'equipo') {
    body.innerHTML = equipoForm(id);
    initEquipoFormHandlers();
    if (id) {
      const e = data.equipos.find(x => x.id === id);
      if (e?.piscinaId) {
        const piscina = document.getElementById('f-piscinaId');
        if (piscina) piscina.value = e.piscinaId;
      }
    }
  }

  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
  currentModal = null;
}

function saveModal() {
  if (currentModal === 'motor') saveMotor();
  else if (currentModal === 'piscina') savePiscina();
  else if (currentModal === 'equipo') saveEquipo();
}

// --- PISCINAS ---
function initPiscinaFormHandlers() {
  const sector = document.getElementById('f-sector');
  const numero = document.getElementById('f-numero');
  if (!sector || !numero) return;

  function updateNumero() {
    const ok = sector.value !== '';
    numero.disabled = !ok;
    numero.placeholder = ok ? 'Solo números' : 'Seleccione un sector primero';
    if (!ok) numero.value = '';
  }

  sector.addEventListener('change', updateNumero);
  restrictNumeric(numero);

  numero.addEventListener('blur', () => {
    if (!sector.value || !numero.value || editingId) return;
    const dup = findPiscina(sector.value, numero.value);
    if (dup) {
      editingId = dup.id;
      document.getElementById('modal-title').textContent = 'Actualizar Piscina';
      showToast('Este número de piscina ya existe en el sector. Se cargaron los datos para actualizar.');
    }
  });

  updateNumero();
}

function piscinaForm(id) {
  const p = id ? data.piscinas.find(x => x.id === id) : {};
  const pageSector = document.getElementById('filter-sector-piscinas')?.value || '';

  return `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" required>${sectorOptions(p.sector || pageSector)}</select>
    </div>
    <div class="form-group">
      <label>N° de Piscina *</label>
      <input type="text" inputmode="numeric" id="f-numero" value="${p.numero || ''}" placeholder="Seleccione un sector primero" disabled>
    </div>
    ${editingId ? '<p class="form-note">Modo actualización — no se creará un registro duplicado.</p>' : ''}
  `;
}

async function savePiscina() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  const sector = document.getElementById('f-sector').value;
  const numero = document.getElementById('f-numero').value.trim();

  if (!sector) { showToast('Debe seleccionar un sector.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!numero) { showToast('Debe ingresar el número de piscina.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!/^\d+$/.test(numero)) { showToast('Solo se permiten números.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  const existing = findPiscina(sector, numero);
  if (existing && existing.id !== editingId) {
    editingId = existing.id;
  }

  const piscina = {
    id: editingId || generateId(),
    sector,
    numero,
    nombre: `${sector} — Piscina ${numero}`
  };

  try {
    const response = await fetch(`${API_BASE}/piscinas`, getAuthHeaders({
      method: 'POST',
      body: JSON.stringify(piscina)
    }));
    if (!response.ok) throw new Error('Error al guardar piscina');
    
    closeModal();
    document.getElementById('filter-sector-piscinas').value = sector;
    await renderPiscinas();
  } catch (error) {
    console.error('Error saving piscina:', error);
    showToast('Error al guardar piscina. Por favor intente nuevamente.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

async function deletePiscina(id) {
  try {
    const response = await fetch(`${API_BASE}/piscinas/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar piscina');
    showToast('Piscina eliminada');
    await renderPiscinas();
  } catch (error) {
    console.error('Error deleting piscina:', error);
    showToast('Error al eliminar piscina. Por favor intente nuevamente.');
  }
}

async function renderPiscinas() {
  const sector = document.getElementById('filter-sector-piscinas').value;
  const search = document.getElementById('search-piscinas').value.replace(/\D/g, '');
  const hint = document.getElementById('piscinas-hint');
  const wrap = document.getElementById('piscinas-table-wrap');
  const searchEl = document.getElementById('search-piscinas');

  toggleSectorUI(
    document.getElementById('filter-sector-piscinas'),
    searchEl, hint, wrap
  );

  const tbody = document.getElementById('tbody-piscinas');
  if (!sector) {
    tbody.innerHTML = '';
    return;
  }

  // Load data from API
  data.piscinas = await fetchPiscinas(sector);

  let list = getPiscinasBySector(sector);
  if (search) list = list.filter(p => p.numero.includes(search));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="2"><div class="empty-state"><div class="icon">🦐</div><p>No hay piscinas en este sector</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr>
      <td><strong>${p.numero}</strong></td>
      <td class="actions">
        <button class="btn btn-secondary btn-sm" onclick="openModal('piscina','${p.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deletePiscina('${p.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// --- MOTORES ---
function initMotorFormHandlers() {
  const sector = document.getElementById('f-sector');
  const estado = document.getElementById('f-estadoMotor');
  const piscinaWrap = document.getElementById('f-piscina-wrap');
  const piscinaSelect = document.getElementById('f-piscinaId');
  const codigo = document.getElementById('f-codigo');

  function refreshPiscinas() {
    if (!piscinaSelect) return;
    const list = getPiscinasBySector(sector?.value || '');
    piscinaSelect.innerHTML = list.length
      ? list.map(p => `<option value="${p.id}">Piscina ${p.numero}</option>`).join('')
      : '<option value="">— Sin piscinas en este sector —</option>';
  }

  function togglePiscinaField() {
    const show = estado?.value === 'Piscinas';
    if (piscinaWrap) piscinaWrap.style.display = show ? 'block' : 'none';
    if (show) refreshPiscinas();
  }

  sector?.addEventListener('change', () => {
    refreshPiscinas();
    togglePiscinaField();
  });
  estado?.addEventListener('change', togglePiscinaField);

  restrictNumeric(codigo, 5);

  codigo?.addEventListener('input', () => {
    if (!codigo.value || codigo.value.length !== 5) {
      // Si el código está vacío o no tiene 5 dígitos, restablecer a modo nuevo
      if (!codigo.value && editingId) {
        editingId = null;
        document.getElementById('modal-title').textContent = 'Nuevo Motor';
        sector.value = sector?.options[0]?.value || '';
        estado.value = '';
        togglePiscinaField();
      }
      return;
    }
    const dup = findMotorByCodigo(codigo.value);
    if (dup && dup.id !== editingId) {
      editingId = dup.id;
      document.getElementById('modal-title').textContent = 'Actualizar Motor';
      sector.value = dup.sector;
      estado.value = dup.estadoMotor;
      togglePiscinaField();
      if (dup.piscinaId && piscinaSelect) {
        refreshPiscinas();
        piscinaSelect.value = dup.piscinaId;
      }
      showToast('Este código ya está registrado. Se cargaron los datos para actualizar.');
    } else if (!dup && editingId) {
      // Si el código no existe pero estábamos en modo edición, restablecer a modo nuevo
      editingId = null;
      document.getElementById('modal-title').textContent = 'Nuevo Motor';
    }
  });

  togglePiscinaField();
  refreshPiscinas();
}

function motorForm(id) {
  const m = id ? data.motores.find(x => x.id === id) : {};
  const pageSector = document.getElementById('filter-sector-motores')?.value || '';
  const estadoOpts = ESTADOS_MOTOR.map(e =>
    `<option value="${e}" ${m.estadoMotor === e ? 'selected' : ''}>${e}</option>`
  ).join('');

  return `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" required>${sectorOptions(m.sector || pageSector)}</select>
    </div>
    <div class="form-group">
      <label>Estado del Motor *</label>
      <select id="f-estadoMotor" required>
        <option value="">— Seleccione estado —</option>
        ${estadoOpts}
      </select>
    </div>
    <div class="form-group" id="f-piscina-wrap" style="display:none">
      <label>Piscina *</label>
      <select id="f-piscinaId"></select>
    </div>
    <div class="form-group">
      <label>Código del Motor * (5 dígitos)</label>
      <input type="text" inputmode="numeric" id="f-codigo" value="${m.codigo || ''}" maxlength="5" placeholder="00000" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
    ${editingId ? '<p class="form-note">Modo actualización — el código no se duplicará.</p>' : ''}
  `;
}

async function saveMotor() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  const sector = document.getElementById('f-sector').value;
  const estadoMotor = document.getElementById('f-estadoMotor').value;
  const codigo = document.getElementById('f-codigo').value.trim();
  const piscinaId = document.getElementById('f-piscinaId')?.value || '';

  if (!sector) { showToast('Debe seleccionar un sector.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!estadoMotor) { showToast('Debe seleccionar el estado del motor.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!/^\d{5}$/.test(codigo)) { showToast('El código debe tener exactamente 5 dígitos numéricos.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (estadoMotor === 'Piscinas' && !piscinaId) { showToast('Debe seleccionar una piscina.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  const existing = findMotorByCodigo(codigo);
  if (existing && existing.id !== editingId) {
    editingId = existing.id;
  }

  const motor = {
    id: editingId || generateId(),
    sector,
    codigo,
    estado_motor: estadoMotor,
    piscina_id: estadoMotor === 'Piscinas' ? piscinaId : ''
  };

  try {
    const response = await fetch(`${API_BASE}/motores`, getAuthHeaders({
      method: 'POST',
      body: JSON.stringify(motor)
    }));
    if (!response.ok) throw new Error('Error al guardar motor');
    
    closeModal();
    document.getElementById('filter-sector-motores').value = sector;
    await renderMotores();
    if (!document.getElementById('motores-resumen-panel').classList.contains('search-hidden')) {
      refreshResumenMotoresInline();
    }
  } catch (error) {
    console.error('Error saving motor:', error);
    showToast('Error al guardar motor. Por favor intente nuevamente.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

async function deleteMotor(id) {
  try {
    const response = await fetch(`${API_BASE}/motores/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar motor');
    showToast('Motor eliminado');
    await renderMotores();
  } catch (error) {
    console.error('Error deleting motor:', error);
    showToast('Error al eliminar motor. Por favor intente nuevamente.');
  }
}

async function renderMotores() {
  const sector = document.getElementById('filter-sector-motores').value;
  const search = document.getElementById('search-motores').value.replace(/\D/g, '');
  const hint = document.getElementById('motores-hint');
  const wrap = document.getElementById('motores-table-wrap');
  const searchEl = document.getElementById('search-motores');

  toggleSectorUI(
    document.getElementById('filter-sector-motores'),
    searchEl, hint, wrap
  );

  if (!sector) hideResumenMotoresInline();
  else if (!document.getElementById('motores-resumen-panel').classList.contains('search-hidden')) {
    refreshResumenMotoresInline();
  }

  const tbody = document.getElementById('tbody-motores');
  if (!sector) {
    tbody.innerHTML = '';
    return;
  }

  // Load data from API
  data.motores = await fetchMotores(sector);

  let list = data.motores.filter(m => m.sector === sector);
  if (search) list = list.filter(m => m.codigo.includes(search));

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="icon">⚙️</div><p>No hay motores en este sector</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(m => `
    <tr>
      <td><strong>${m.codigo}</strong></td>
      <td>${m.estadoMotor}</td>
      <td>${m.estadoMotor === 'Piscinas' ? getPiscinaLabel(m.piscinaId) : '—'}</td>
      <td class="actions">
        <button class="btn btn-secondary btn-sm" onclick="openModal('motor','${m.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMotor('${m.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// --- EQUIPOS AQ1 ---
function initEquipoFormHandlers() {
  const sector = document.getElementById('f-sector');
  const piscina = document.getElementById('f-piscinaId');

  function refreshPiscinas() {
    if (!piscina) return;
    const current = piscina.value;
    const list = getPiscinasBySector(sector?.value || '');
    piscina.innerHTML = list.length
      ? `<option value="">— Seleccione piscina —</option>` +
        list.map(p => `<option value="${p.id}">Piscina ${p.numero}</option>`).join('')
      : '<option value="">— Sin piscinas en este sector —</option>';
    if (current) piscina.value = current;
  }

  sector?.addEventListener('change', () => {
    refreshPiscinas();
    piscina.value = '';
  });

  piscina?.addEventListener('change', () => {
    if (!sector?.value || !piscina.value) return;
    const dup = findEquipoByPiscina(sector.value, piscina.value);
    if (dup) {
      editingId = dup.id;
      document.getElementById('modal-title').textContent = 'Actualizar Equipo AQ1';
      document.getElementById('f-estadoPiscina').value = dup.estadoPiscina;
      document.getElementById('f-tolvas').value = dup.tolvas || '';
      document.getElementById('f-sf200').value = dup.sf200 || '';
      document.getElementById('f-hidrofos').value = dup.hidrofos || '';
      document.getElementById('f-motores').value = dup.motores || '';
      document.getElementById('f-estadoEma').value = dup.estadoEma;
      showToast('Esta piscina ya tiene equipo registrado. Se cargaron los datos para actualizar.');
    } else {
      editingId = null;
      document.getElementById('modal-title').textContent = 'Nuevo Equipo AQ1';
      document.getElementById('f-estadoPiscina').value = 'Activa';
      document.getElementById('f-tolvas').value = '';
      document.getElementById('f-sf200').value = '';
      document.getElementById('f-hidrofos').value = '';
      document.getElementById('f-motores').value = '';
      document.getElementById('f-estadoEma').value = 'Operativo';
    }
  });

  ['f-tolvas', 'f-hidrofos', 'f-motores'].forEach(id => {
    restrictNumeric(document.getElementById(id));
  });
  restrictDecimal(document.getElementById('f-sf200'));

  refreshPiscinas();
}

function equipoForm(id) {
  const e = id ? data.equipos.find(x => x.id === id) : {};
  const pageSector = document.getElementById('filter-sector-equipos')?.value || '';

  return `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" required>${sectorOptions(e.sector || pageSector)}</select>
    </div>
    <div class="form-group">
      <label>Piscina *</label>
      <select id="f-piscinaId" required>
        <option value="">— Seleccione sector primero —</option>
      </select>
    </div>
    <div class="form-group">
      <label>Estado de Piscina *</label>
      <select id="f-estadoPiscina" required>
        <option value="Activa" ${e.estadoPiscina === 'Activa' ? 'selected' : ''}>Activa</option>
        <option value="Pescada" ${e.estadoPiscina === 'Pescada' ? 'selected' : ''}>Pescada</option>
      </select>
    </div>
    <div class="form-group">
      <label>Tolvas</label>
      <input type="text" inputmode="numeric" id="f-tolvas" value="${e.tolvas || ''}" placeholder="Solo números" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
    <div class="form-group">
      <label>SF200</label>
      <input type="text" id="f-sf200" value="${e.sf200 || ''}" placeholder="Ej: 1.5 (un solo punto)" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
    <div class="form-group">
      <label>Hidrofos</label>
      <input type="text" inputmode="numeric" id="f-hidrofos" value="${e.hidrofos || ''}" placeholder="Total hidrofonos" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
    <div class="form-group">
      <label>Motores</label>
      <input type="text" inputmode="numeric" id="f-motores" value="${e.motores || ''}" placeholder="Número de motores" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
    <div class="form-group">
      <label>Estado EMA *</label>
      <select id="f-estadoEma" required>
        <option value="Operativo" ${e.estadoEma === 'Operativo' ? 'selected' : ''}>Operativo</option>
        <option value="Inactivo" ${e.estadoEma === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
      </select>
    </div>
    ${editingId ? '<p class="form-note">Modo actualización — no se duplicará el registro.</p>' : ''}
  `;
}

async function saveEquipo() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  const sector = document.getElementById('f-sector').value;
  const piscinaId = document.getElementById('f-piscinaId').value;
  const estadoPiscina = document.getElementById('f-estadoPiscina').value;
  const tolvas = document.getElementById('f-tolvas').value.trim();
  const sf200 = document.getElementById('f-sf200').value.trim();
  const hidrofos = document.getElementById('f-hidrofos').value.trim();
  const motores = document.getElementById('f-motores').value.trim();
  const estadoEma = document.getElementById('f-estadoEma').value;

  if (!sector) { showToast('Debe seleccionar un sector.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!piscinaId) { showToast('Debe seleccionar una piscina.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  if (!tolvas) { showToast('Debe ingresar el número de tolvas.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!/^\d+$/.test(tolvas)) { showToast('Tolvas solo acepta números.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!sf200) { showToast('Debe ingresar el valor SF200.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!isValidDecimal(sf200)) { showToast('SF200 solo acepta números con un punto (ej: 1.5).'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!hidrofos) { showToast('Debe ingresar el número de hidrofos.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!/^\d+$/.test(hidrofos)) { showToast('Hidrofos solo acepta números.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!motores) { showToast('Debe ingresar el número de motores.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!/^\d+$/.test(motores)) { showToast('Motores solo acepta números.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  const existing = findEquipoByPiscina(sector, piscinaId);
  if (existing && existing.id !== editingId) {
    editingId = existing.id;
  }

  const equipo = {
    id: editingId || generateId(),
    sector,
    piscina_id: piscinaId,
    estado_piscina: estadoPiscina,
    tolvas: parseInt(tolvas) || 0,
    sf200: parseFloat(sf200) || 0,
    hidrofos: parseInt(hidrofos) || 0,
    motores: parseInt(motores) || 0,
    estado_ema: estadoEma
  };

  try {
    const response = await fetch(`${API_BASE}/equipos`, getAuthHeaders({
      method: 'POST',
      body: JSON.stringify(equipo)
    }));
    if (!response.ok) throw new Error('Error al guardar equipo');
    
    closeModal();
    document.getElementById('filter-sector-equipos').value = sector;
    await renderEquipos();
    if (!document.getElementById('equipos-resumen-panel').classList.contains('search-hidden')) {
      refreshResumenEquiposInline();
    }
  } catch (error) {
    console.error('Error saving equipo:', error);
    showToast('Error al guardar equipo. Por favor intente nuevamente.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

async function deleteEquipo(id) {
  try {
    const response = await fetch(`${API_BASE}/equipos/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar equipo');
    showToast('Equipo eliminado');
    await renderEquipos();
  } catch (error) {
    console.error('Error deleting equipo:', error);
    showToast('Error al eliminar equipo. Por favor intente nuevamente.');
  }
}

async function renderEquipos() {
  const sector = document.getElementById('filter-sector-equipos').value;
  const search = document.getElementById('search-equipos').value.replace(/\D/g, '');
  const hint = document.getElementById('equipos-hint');
  const wrap = document.getElementById('equipos-table-wrap');
  const searchEl = document.getElementById('search-equipos');

  toggleSectorUI(
    document.getElementById('filter-sector-equipos'),
    searchEl, hint, wrap
  );

  if (!sector) hideResumenEquiposInline();
  else if (!document.getElementById('equipos-resumen-panel').classList.contains('search-hidden')) {
    refreshResumenEquiposInline();
  }

  const tbody = document.getElementById('tbody-equipos');
  if (!sector) {
    tbody.innerHTML = '';
    return;
  }

  // Load data from API
  data.equipos = await fetchEquipos(sector);
  data.piscinas = await fetchPiscinas(sector);

  let list = data.equipos.filter(e => e.sector === sector);
  if (search) {
    list = list.filter(e => {
      const p = getPiscinaById(e.piscinaId);
      return p && p.numero.includes(search);
    });
  }

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon">🖥️</div><p>No hay equipos en este sector</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(e => `
    <tr>
      <td><strong>${getPiscinaLabel(e.piscinaId)}</strong></td>
      <td>${estadoBadge(e.estadoPiscina)}</td>
      <td>${e.tolvas}</td>
      <td>${e.sf200}</td>
      <td>${e.hidrofos}</td>
      <td>${e.motores}</td>
      <td>${estadoBadge(e.estadoEma)}</td>
      <td class="actions">
        <button class="btn btn-secondary btn-sm" onclick="openModal('equipo','${e.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteEquipo('${e.id}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// --- RESUMEN GENERAL ---
function getResumenTipo() {
  return document.getElementById('resumen-tipo').value;
}

function getResumenSector() {
  return document.getElementById('filter-sector-resumen').value;
}

function populateResumenPiscinaSearch(sector) {
  const select = document.getElementById('search-resumen-equipos-piscina');
  const piscinas = getPiscinasBySector(sector);
  select.innerHTML = `<option value="">— Todas las piscinas —</option>` +
    piscinas.map(p => `<option value="${p.id}">Piscina ${p.numero}</option>`).join('');
}

function getMotoresSectorList(sector) {
  return data.motores.filter(m => m.sector === sector);
}

function getEquiposSectorList(sector) {
  return data.equipos.filter(e => e.sector === sector);
}

function renderResumenGeneralSummary(sector, tipo) {
  const panel = document.getElementById('resumen-general-body');
  const title = document.getElementById('resumen-general-title');
  document.getElementById('resumen-sector-label').textContent = sector;

  if (tipo === 'motores') {
    const { title: t, body, chartData } = buildResumenMotoresHTML(sector);
    title.textContent = t;
    panel.innerHTML = body;
    
    // Renderizar gráficas de motores
    setTimeout(() => {
      renderMotoresCharts(chartData);
    }, 100);
  } else {
    const { title: t, body } = buildResumenEquiposHTML(sector);
    title.textContent = t;
    panel.innerHTML = body;
    
    // Renderizar gráficas de equipos
    setTimeout(() => {
      renderResumenEquiposCharts(sector);
    }, 100);
  }
}

function renderResumenGeneralTable() {
  const tipo = getResumenTipo();
  const sector = getResumenSector();
  const thead = document.getElementById('resumen-general-thead');
  const tbody = document.getElementById('resumen-general-tbody');

  if (!tipo || !sector) {
    thead.innerHTML = '';
    tbody.innerHTML = '';
    return;
  }

  if (tipo === 'motores') {
    thead.innerHTML = `<tr>
      <th>Código</th><th>Estado de Motor</th><th>Piscina</th>
    </tr>`;
    let list = getMotoresSectorList(sector);
    const codigo = document.getElementById('search-resumen-motores').value.replace(/\D/g, '');
    if (codigo) list = list.filter(m => m.codigo.includes(codigo));

    tbody.innerHTML = list.length
      ? list.map(m => `<tr>
          <td>${m.codigo}</td>
          <td>${formatMotorEstado(m.estadoMotor)}</td>
          <td>${m.estadoMotor === 'Piscinas' ? getPiscinaLabel(m.piscinaId) : '—'}</td>
        </tr>`).join('')
      : '<tr><td colspan="3" class="empty-state">Sin datos</td></tr>';
  } else {
    thead.innerHTML = `<tr>
      <th>Piscina</th><th>Estado de Piscina</th><th>SF200</th>
      <th>Tolvas</th><th>Motores</th><th>Hidrofonos</th><th>Emas</th>
    </tr>`;
    let list = getEquiposSectorList(sector);
    const piscinaId = document.getElementById('search-resumen-equipos-piscina').value;
    if (piscinaId) list = list.filter(e => e.piscinaId === piscinaId);

    tbody.innerHTML = list.length
      ? list.map(e => `<tr>
          <td>${getPiscinaLabel(e.piscinaId)}</td>
          <td>${e.estadoPiscina}</td>
          <td>${e.sf200}</td>
          <td>${e.tolvas}</td>
          <td>${e.motores}</td>
          <td>${e.hidrofos}</td>
          <td>${e.estadoEma}</td>
        </tr>`).join('')
      : '<tr><td colspan="7" class="empty-state">Sin datos</td></tr>';
  }
}

let previousResumenTipo = '';
let activeBateriasTab = 'nombres';
let activeComponentesTab = 'nombres';
let chartBarInstance = null;
let chartPieInstance = null;

function createBarChart(labels, data, label) {
  const ctx = document.getElementById('chart-bar');
  if (!ctx) return;
  
  // Destruir gráfica existente si hay una
  if (chartBarInstance) {
    chartBarInstance.destroy();
  }
  
  chartBarInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: [
          'rgba(6, 182, 212, 0.7)',
          'rgba(34, 197, 94, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(139, 92, 246, 0.7)',
          'rgba(236, 72, 153, 0.7)'
        ],
        borderColor: [
          'rgba(6, 182, 212, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(236, 72, 153, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#94a3b8'
          },
          grid: {
            color: '#334155'
          }
        },
        x: {
          ticks: {
            color: '#94a3b8'
          },
          grid: {
            color: '#334155'
          }
        }
      }
    }
  });
}

function createPieChart(labels, data, label) {
  const ctx = document.getElementById('chart-pie');
  if (!ctx) return;
  
  // Destruir gráfica existente si hay una
  if (chartPieInstance) {
    chartPieInstance.destroy();
  }
  
  chartPieInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        backgroundColor: [
          'rgba(6, 182, 212, 0.7)',
          'rgba(34, 197, 94, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(139, 92, 246, 0.7)',
          'rgba(236, 72, 153, 0.7)'
        ],
        borderColor: [
          'rgba(6, 182, 212, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(139, 92, 246, 1)',
          'rgba(236, 72, 153, 1)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#f1f5f9',
            padding: 10
          }
        }
      }
    }
  });
}

function clearCharts() {
  if (chartBarInstance) {
    chartBarInstance.destroy();
    chartBarInstance = null;
  }
  if (chartPieInstance) {
    chartPieInstance.destroy();
    chartPieInstance = null;
  }
}

function renderResumenEquiposCharts(sector) {
  const equipos = data.equipos.filter(e => e.sector === sector);
  
  // Calcular datos para las gráficas
  const piscinasPescadas = equipos.filter(e => e.estadoPiscina === 'Pescada').length;
  const piscinasActivas = equipos.filter(e => e.estadoPiscina === 'Activa').length;
  const tolvasActivas = equipos.filter(e => e.estadoPiscina === 'Activa').reduce((s, e) => s + (parseInt(e.tolvas) || 0), 0);
  const tolvasInactivas = equipos.filter(e => e.estadoPiscina === 'Pescada').reduce((s, e) => s + (parseInt(e.tolvas) || 0), 0);
  const motoresActivos = equipos.filter(e => e.estadoPiscina === 'Activa').reduce((s, e) => s + (parseInt(e.motores) || 0), 0);
  const motoresPorPesca = equipos.filter(e => e.estadoPiscina === 'Pescada').reduce((s, e) => s + (parseInt(e.motores) || 0), 0);
  
  const labels = ['Piscinas Pescadas', 'Piscinas Activas', 'Tolvas Activas', 'Tolvas Inactivas', 'Motores Activos', 'Motores por Pesca'];
  const values = [piscinasPescadas, piscinasActivas, tolvasActivas, tolvasInactivas, motoresActivos, motoresPorPesca];
  const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
  
  // Limpiar gráficas anteriores
  clearCharts();
  
  // Crear gráfica de barras
  createBarChart(labels, values, 'Cantidad de Equipos');
  
  // Crear gráfica circular
  createPieChart(labels, values, 'Distribución de Equipos');
}

function renderResumen() {
  const tipo = getResumenTipo();
  const sector = getResumenSector();
  const sectorWrap = document.getElementById('resumen-sector-wrap');
  const content = document.getElementById('resumen-general-content');
  const searchMotores = document.getElementById('search-resumen-motores');
  const searchEquipos = document.getElementById('search-resumen-equipos-piscina');

  sectorWrap.classList.toggle('search-hidden', !tipo);

  // Si cambiamos de baterías, componentes o sensores a otro tipo, restaurar el HTML inmediatamente
  if ((previousResumenTipo === 'baterias' || previousResumenTipo === 'componentes' || previousResumenTipo === 'sensores') && tipo && tipo !== previousResumenTipo) {
    // Limpiar completamente el contenido antes de restaurar
    content.innerHTML = '';
    
    content.innerHTML = `
      <div class="resumen-sector-header">
        <h3 id="resumen-sector-label">Sector</h3>
        <button class="btn btn-primary btn-sm" id="btn-export-excel">Descargar Excel</button>
      </div>
      <div class="card resumen-panel resumen-panel-general">
        <span class="resumen-panel-title" id="resumen-general-title">Resumen del Sector</span>
        <ul class="resumen-lines" id="resumen-general-body"></ul>
      </div>
      <div class="toolbar sector-toolbar">
        <input type="text" class="search-input search-hidden" id="search-resumen-motores" inputmode="numeric" maxlength="5" placeholder="Buscar por código (5 dígitos)...">
        <select class="sector-select search-hidden" id="search-resumen-equipos-piscina">
          <option value="">— Todas las piscinas —</option>
        </select>
      </div>
      <div class="card">
        <div class="table-wrapper">
          <table>
            <thead id="resumen-general-thead"></thead>
            <tbody id="resumen-general-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    // Re-adjuntar event listeners
    document.getElementById('btn-export-excel').addEventListener('click', exportResumenExcel);
    document.getElementById('search-resumen-motores').addEventListener('input', renderResumenGeneralTable);
    restrictNumeric(document.getElementById('search-resumen-motores'), 5);
    document.getElementById('search-resumen-equipos-piscina').addEventListener('change', renderResumenGeneralTable);
    
    // Actualizar las referencias a los elementos
    const newSearchMotores = document.getElementById('search-resumen-motores');
    const newSearchEquipos = document.getElementById('search-resumen-equipos-piscina');
    
    if (!tipo || !sector) {
      content.classList.add('search-hidden');
      if (newSearchMotores) newSearchMotores.classList.add('search-hidden');
      if (newSearchEquipos) newSearchEquipos.classList.add('search-hidden');
      previousResumenTipo = tipo;
      return;
    }
    
    content.classList.remove('search-hidden');
    if (newSearchMotores) newSearchMotores.classList.toggle('search-hidden', tipo !== 'motores');
    if (newSearchEquipos) newSearchEquipos.classList.toggle('search-hidden', tipo !== 'equipos');
    
    if (tipo === 'equipos') populateResumenPiscinaSearch(sector);
    if (tipo === 'motores') newSearchMotores.value = '';
    
    renderResumenGeneralSummary(sector, tipo);
    renderResumenGeneralTable();
    
    previousResumenTipo = tipo;
    return;
  }

  if (!tipo || !sector) {
    content.classList.add('search-hidden');
    if (searchMotores) searchMotores.classList.add('search-hidden');
    if (searchEquipos) searchEquipos.classList.add('search-hidden');
    previousResumenTipo = tipo;
    return;
  }

  content.classList.remove('search-hidden');
  if (searchMotores) searchMotores.classList.toggle('search-hidden', tipo !== 'motores');
  if (searchEquipos) searchEquipos.classList.toggle('search-hidden', tipo !== 'equipos');

  if (tipo === 'equipos') populateResumenPiscinaSearch(sector);
  if (tipo === 'motores') searchMotores.value = '';

  // Manejar baterías, componentes y sensores de manera diferente
  if (tipo === 'baterias') {
    renderResumenBateriasPage(sector);
  } else if (tipo === 'componentes') {
    renderResumenComponentesPage(sector);
  } else if (tipo === 'sensores') {
    renderResumenSensoresPage(sector);
  } else {
    renderResumenGeneralSummary(sector, tipo);
    renderResumenGeneralTable();
  }
  
  previousResumenTipo = tipo;
}

async function renderResumenComponentesPage(sector) {
  try {
    const content = document.getElementById('resumen-general-content');
    const instalaciones = await fetchInstalacionesComponentes(sector);
    
    // Resetear activeComponentesTab al valor por defecto
    activeComponentesTab = 'nombres';

    // Generar lista de componentes disponibles
    const componentesDisponibles = [...new Set(instalaciones.map(i => i.componenteNombre))].sort();
    const mesesDisponibles = obtenerMesesDisponiblesComponentes(instalaciones);
    const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM

    content.innerHTML = `
      <div class="resumen-sector-header">
        <h3 id="resumen-sector-label">${sector}</h3>
        <div class="resumen-componentes-filters">
          <div class="form-group">
            <label>Vista</label>
            <select id="filter-vista" class="form-select">
              <option value="nombres">Por Nombre</option>
              <option value="puntos">Por Punto de Instalación</option>
              <option value="combinadas">Vista Combinada</option>
            </select>
          </div>
          <div class="form-group">
            <label>Componente</label>
            <select id="filter-componente" class="form-select">
              <option value="">Todos los componentes</option>
              ${componentesDisponibles.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Mes</label>
            <select id="filter-mes" class="form-select">
              <option value="">Todos los meses</option>
              ${mesesDisponibles.map(m => `<option value="${m}" ${m === mesActual ? 'selected' : ''}>${formatMes(m)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Semana</label>
            <select id="filter-semana" class="form-select" disabled>
              <option value="">Todas las semanas</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-export-excel">Descargar Excel</button>
      </div>
      <div class="resumen-layout">
        <div class="resumen-main">
          <div class="card resumen-panel resumen-panel-general">
            <span class="resumen-panel-title" id="resumen-general-title">Resumen de Componentes</span>
            <div id="resumen-componentes-content"></div>
          </div>
        </div>
        <div class="resumen-charts">
          <div class="card chart-card">
            <span class="chart-title">Gráfica de Barras</span>
            <canvas id="chart-bar"></canvas>
          </div>
          <div class="card chart-card">
            <span class="chart-title">Gráfica Circular</span>
            <canvas id="chart-pie"></canvas>
          </div>
        </div>
      </div>
    `;

    // Re-adjuntar event listener al botón de exportar Excel
    document.getElementById('btn-export-excel').addEventListener('click', exportResumenExcel);

    // Event listeners para filtros
    const filterVista = document.getElementById('filter-vista');
    const filterComponente = document.getElementById('filter-componente');
    const filterMes = document.getElementById('filter-mes');
    const filterSemana = document.getElementById('filter-semana');

    // Inicializar selector de semana si hay un mes seleccionado por defecto
    if (filterMes.value) {
      const semanas = obtenerSemanasDelMesComponentes(filterMes.value, instalaciones);
      filterSemana.innerHTML = '<option value="">Todas las semanas</option>' + 
        semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join('');
      filterSemana.disabled = false;
    }

    filterVista.addEventListener('change', () => {
      const vista = filterVista.value;
      
      // Resetear filtro de componente cuando cambia la vista
      if (vista === 'combinadas') {
        filterComponente.value = '';
      }
      
      activeComponentesTab = vista;
      aplicarFiltrosComponentes(instalaciones, vista);
    });

    filterComponente.addEventListener('input', () => {
      aplicarFiltrosComponentes(instalaciones, filterVista.value);
    });

    filterMes.addEventListener('input', () => {
      const mesSeleccionado = filterMes.value;
      if (mesSeleccionado) {
        const semanas = obtenerSemanasDelMesComponentes(mesSeleccionado, instalaciones);
        filterSemana.innerHTML = '<option value="">Todas las semanas</option>' + 
          semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join('');
        filterSemana.disabled = false;
      } else {
        filterSemana.innerHTML = '<option value="">Todas las semanas</option>';
        filterSemana.disabled = true;
      }
      aplicarFiltrosComponentes(instalaciones, filterVista.value);
    });

    filterSemana.addEventListener('input', () => {
      aplicarFiltrosComponentes(instalaciones, filterVista.value);
    });

    // Renderizar resumen inicial por nombre
    aplicarFiltrosComponentes(instalaciones, 'nombres');
  } catch (error) {
    console.error('Error renderizando resumen de componentes:', error);
    const content = document.getElementById('resumen-general-content');
    content.innerHTML = '<p class="hint-text">Error al cargar datos de componentes.</p>';
  }
}

async function renderResumenSensoresPage(sector) {
  try {
    const content = document.getElementById('resumen-general-content');
    const instalaciones = await fetchInstalacionesSensores(sector);

    // Generar lista de sensores disponibles
    const sensoresDisponibles = [...new Set(instalaciones.map(i => i.sensorNombre))].sort();
    const mesesDisponibles = obtenerMesesDisponiblesSensores(instalaciones);
    const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM
    const lotesDisponibles = [...new Set(instalaciones.filter(i => i.loteCodigo).map(i => i.loteCodigo))].sort();

    content.innerHTML = `
      <div class="resumen-sector-header">
        <h3 id="resumen-sector-label">${sector}</h3>
        <div class="resumen-componentes-filters">
          <div class="form-group">
            <label>Sensor</label>
            <select id="filter-sensor" class="form-select">
              <option value="">Todos los sensores</option>
              ${sensoresDisponibles.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Lote</label>
            <select id="filter-lote-sensores" class="form-select">
              <option value="">Seleccionar lote</option>
              ${lotesDisponibles.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Mes</label>
            <select id="filter-mes-sensores" class="form-select">
              <option value="">Todos los meses</option>
              ${mesesDisponibles.map(m => `<option value="${m}" ${m === mesActual ? 'selected' : ''}>${formatMes(m)}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-export-excel">Descargar Excel</button>
      </div>
      <div class="resumen-layout">
        <div class="resumen-main">
          <div class="card resumen-panel resumen-panel-general">
            <span class="resumen-panel-title" id="resumen-general-title">Resumen de Sensores</span>
            <div id="resumen-sensores-content"></div>
          </div>
        </div>
        <div class="resumen-charts">
          <div class="card chart-card">
            <span class="chart-title">Gráfica de Barras</span>
            <canvas id="chart-bar"></canvas>
          </div>
          <div class="card chart-card">
            <span class="chart-title">Gráfica Circular</span>
            <canvas id="chart-pie"></canvas>
          </div>
        </div>
      </div>
    `;

    // Re-adjuntar event listener al botón de exportar Excel
    document.getElementById('btn-export-excel').addEventListener('click', exportResumenExcel);

    // Event listeners para filtros
    const filterSensor = document.getElementById('filter-sensor');
    const filterLote = document.getElementById('filter-lote-sensores');
    const filterMes = document.getElementById('filter-mes-sensores');

    filterSensor.addEventListener('input', () => {
      filterLote.value = '';
      aplicarFiltrosSensores(instalaciones);
    });

    filterLote.addEventListener('input', () => {
      aplicarFiltrosSensores(instalaciones);
    });

    filterMes.addEventListener('input', () => {
      aplicarFiltrosSensores(instalaciones);
    });

    // Renderizar resumen inicial
    aplicarFiltrosSensores(instalaciones);
  } catch (error) {
    console.error('Error renderizando resumen de sensores:', error);
    const content = document.getElementById('resumen-general-content');
    content.innerHTML = '<p class="hint-text">Error al cargar datos de sensores.</p>';
  }
}

function getFilteredBateriasInstalaciones(instalaciones) {
  const filterMes = document.getElementById('filter-mes');
  const filterSemana = document.getElementById('filter-semana');
  const filterNombre = document.getElementById('filter-nombre');
  const filterLote = document.getElementById('filter-lote');
  
  let instalacionesFiltradas = [...instalaciones];
  
  // Filtrar por mes
  if (filterMes && filterMes.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      return mesKey === filterMes.value;
    });
  }
  
  // Filtrar por semana
  if (filterSemana && filterSemana.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const dia = fecha.getDate();
      const semana = Math.ceil(dia / 7);
      return semana === parseInt(filterSemana.value);
    });
  }
  
  // Filtrar por nombre de batería si se proporciona y no es "Todos"
  if (filterNombre && filterNombre.value && filterNombre.value !== 'Todos') {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => i.modeloNombre === filterNombre.value);
  }
  
  // Filtrar por lote si se proporciona y no es "Todos"
  if (filterLote && filterLote.value && filterLote.value !== 'Todos') {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => i.loteNombre === filterLote.value);
  }
  
  return instalacionesFiltradas;
}

function getFilteredComponentesInstalaciones(instalaciones) {
  const filterComponente = document.getElementById('filter-componente');
  const filterMes = document.getElementById('filter-mes');
  const filterSemana = document.getElementById('filter-semana');
  
  let instalacionesFiltradas = [...instalaciones];
  
  // Filtrar por componente
  if (filterComponente && filterComponente.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => i.componenteNombre === filterComponente.value);
  }
  
  // Filtrar por mes
  if (filterMes && filterMes.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      return mesKey === filterMes.value;
    });
  }
  
  // Filtrar por semana
  if (filterSemana && filterSemana.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const dia = fecha.getDate();
      const semana = Math.ceil(dia / 7);
      return semana === parseInt(filterSemana.value);
    });
  }
  
  return instalacionesFiltradas;
}

function exportResumenExcel() {
  const tipo = getResumenTipo();
  const sector = getResumenSector();
  if (!tipo || !sector) {
    showToast('Seleccione tipo de inventario y sector.');
    return;
  }

  let headers, rows, filename;
  const center = 'text-align:center;';

  if (tipo === 'motores') {
    headers = ['Codigo', 'Estado de Motor', 'Piscina'];
    rows = getMotoresSectorList(sector).map(m => [
      m.codigo,
      formatMotorEstado(m.estadoMotor),
      m.estadoMotor === 'Piscinas' ? getPiscinaLabel(m.piscinaId) : '—'
    ]);
    filename = `AQ1_Motores_${sector.replace(/\s/g, '_')}.xls`;
  } else if (tipo === 'baterias') {
    fetchInstalacionesBaterias(sector).then(instalaciones => {
      // Aplicar los mismos filtros que se muestran en la vista
      const instalacionesFiltradas = getFilteredBateriasInstalaciones(instalaciones);
      
      // Determinar el formato según la vista activa
      if (activeBateriasTab === 'nombres') {
        // Agrupar por nombre de batería
        const agrupado = {};
        instalacionesFiltradas.forEach(i => {
          if (!agrupado[i.modeloNombre]) {
            agrupado[i.modeloNombre] = [];
          }
          agrupado[i.modeloNombre].push(i);
        });
        
        headers = ['Piscina', 'Tolva', 'Fecha', 'Lote'];
        rows = [];
        Object.keys(agrupado).forEach((nombre, index) => {
          // Agregar fila de encabezado para el grupo
          rows.push([`Modelo de Batería ${index + 1}: ${nombre} (${agrupado[nombre].length} registros)`, '', '', '']);
          
          // Agregar filas de datos
          agrupado[nombre].forEach(i => {
            rows.push([
              i.piscinaNumero,
              i.tolvaNumero,
              formatDate(i.fechaInstalacion),
              i.loteNombre
            ]);
          });
          
          // Agregar fila vacía como separador
          rows.push(['', '', '', '']);
        });
        filename = `AQ1_Baterias_Por_Nombres_${sector.replace(/\s/g, '_')}.xls`;
      } else if (activeBateriasTab === 'lotes') {
        // Agrupar por lote
        const agrupado = {};
        instalacionesFiltradas.forEach(i => {
          const loteKey = i.loteNombre;
          if (!agrupado[loteKey]) {
            agrupado[loteKey] = [];
          }
          agrupado[loteKey].push(i);
        });
        
        headers = ['Lote', 'Modelo', 'Amperaje', 'Piscina', 'Tolva', 'Fecha'];
        rows = [];
        Object.keys(agrupado).forEach((loteKey, index) => {
          // Agregar filas de datos con el nombre del lote en la primera columna
          agrupado[loteKey].forEach(i => {
            rows.push([
              loteKey,
              i.modeloNombre,
              `${i.amperaje}A`,
              i.piscinaNumero,
              i.tolvaNumero,
              formatDate(i.fechaInstalacion)
            ]);
          });
          
          // Agregar fila vacía como separador entre lotes
          rows.push(['', '', '', '', '', '']);
        });
        filename = `AQ1_Baterias_Por_Lotes_${sector.replace(/\s/g, '_')}.xls`;
      } else {
        // Vista combinada
        headers = ['Nombre', 'Amperaje', 'Lote', 'Piscina', 'Tolva', 'Fecha'];
        rows = instalacionesFiltradas.map(i => [
          i.modeloNombre,
          `${i.amperaje}A`,
          i.loteNombre,
          i.piscinaNumero,
          i.tolvaNumero,
          formatDate(i.fechaInstalacion)
        ]);
        filename = `AQ1_Baterias_Combinada_${sector.replace(/\s/g, '_')}.xls`;
      }
      
      const th = h => `<th style="${center}background:#334155;color:#fff;font-weight:bold;">${escapeHtml(h)}</th>`;
      const td = v => `<td style="${center}">${escapeHtml(v)}</td>`;
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"></head>
<body><table border="1"><thead><tr>${headers.map(th).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></body></html>`;

      const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }).catch(error => {
      console.error('Error exportando baterías:', error);
      showToast('Error al exportar baterías.');
    });
    return;
  } else if (tipo === 'componentes') {
    fetchInstalacionesComponentes(sector).then(instalaciones => {
      // Aplicar los mismos filtros que se muestran en la vista
      const instalacionesFiltradas = getFilteredComponentesInstalaciones(instalaciones);
      
      // Determinar el formato según la vista activa
      if (activeComponentesTab === 'nombres') {
        headers = ['Componente', 'Punto de Instalación', 'Detalles', 'Fecha'];
        rows = instalacionesFiltradas.map(i => [
          i.componenteNombre,
          i.puntoInstalacion,
          getDetallesInstalacion(i),
          formatDate(i.fechaInstalacion)
        ]);
        filename = `AQ1_Componentes_Por_Nombre_${sector.replace(/\s/g, '_')}.xls`;
      } else if (activeComponentesTab === 'puntos') {
        headers = ['Punto de Instalación', 'Componente', 'Detalles', 'Fecha'];
        rows = instalacionesFiltradas.map(i => [
          i.puntoInstalacion,
          i.componenteNombre,
          getDetallesInstalacion(i),
          formatDate(i.fechaInstalacion)
        ]);
        filename = `AQ1_Componentes_Por_Punto_${sector.replace(/\s/g, '_')}.xls`;
      } else if (activeComponentesTab === 'combinadas') {
        // Vista combinada: mostrar ambas secciones como tablas planas
        rows = [];
        
        // Primera sección: Por Nombre
        rows.push(['POR NOMBRE', '', '', '']);
        rows.push(['Componente', 'Punto de Instalación', 'Detalles', 'Fecha']);
        instalacionesFiltradas.forEach(i => {
          rows.push([
            i.componenteNombre,
            i.puntoInstalacion,
            getDetallesInstalacion(i),
            formatDate(i.fechaInstalacion)
          ]);
        });
        
        // Separador entre secciones
        rows.push(['', '', '', '']);
        rows.push(['', '', '', '']);
        
        // Segunda sección: Por Punto de Instalación
        rows.push(['POR PUNTO DE INSTALACIÓN', '', '', '']);
        rows.push(['Punto de Instalación', 'Componente', 'Detalles', 'Fecha']);
        instalacionesFiltradas.forEach(i => {
          rows.push([
            i.puntoInstalacion,
            i.componenteNombre,
            getDetallesInstalacion(i),
            formatDate(i.fechaInstalacion)
          ]);
        });
        
        headers = ['Componente / Punto de Instalación', 'Punto de Instalación / Componente', 'Detalles', 'Fecha'];
        filename = `AQ1_Componentes_Combinada_${sector.replace(/\s/g, '_')}.xls`;
      }
      
      const th = h => `<th style="${center}background:#334155;color:#fff;font-weight:bold;">${escapeHtml(h)}</th>`;
      const td = v => `<td style="${center}">${escapeHtml(v)}</td>`;
      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"></head>
<body><table border="1"><thead><tr>${headers.map(th).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></body></html>`;

      const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    }).catch(error => {
      console.error('Error exportando componentes:', error);
      showToast('Error al exportar componentes.');
    });
    return;
  } else {
    headers = ['Piscina', 'Estado de Piscina', 'SF200', 'Tolvas', 'Motores', 'Hidrofonos', 'Emas'];
    rows = getEquiposSectorList(sector).map(e => [
      getPiscinaLabel(e.piscinaId),
      e.estadoPiscina,
      e.sf200,
      e.tolvas,
      e.motores,
      e.hidrofos,
      e.estadoEma
    ]);
    filename = `AQ1_Equipos_${sector.replace(/\s/g, '_')}.xls`;
  }

  const th = h => `<th style="${center}background:#334155;color:#fff;font-weight:bold;">${escapeHtml(h)}</th>`;
  const td = v => `<td style="${center}">${escapeHtml(v)}</td>`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"></head>
<body><table border="1"><thead><tr>${headers.map(th).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></body></html>`;

  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Event listeners
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-save').addEventListener('click', saveModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

document.getElementById('resumen-sector-close').addEventListener('click', closeResumenSector);
document.getElementById('resumen-sector-ok').addEventListener('click', closeResumenSector);
document.getElementById('resumen-sector-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeResumenSector();
});

document.getElementById('btn-add-motor').addEventListener('click', () => openModal('motor'));
document.getElementById('btn-add-piscina').addEventListener('click', () => openModal('piscina'));
document.getElementById('btn-add-item').addEventListener('click', () => openModal('equipo'));
document.getElementById('btn-resumen-equipos').addEventListener('click', toggleResumenEquipos);
document.getElementById('btn-resumen-motores').addEventListener('click', toggleResumenMotores);

// Habilitar/deshabilitar botones basado en sector seleccionado - Motores
const sectorMotores = document.getElementById('filter-sector-motores');
const btnAddMotor = document.getElementById('btn-add-motor');
const btnResumenMotores = document.getElementById('btn-resumen-motores');
if (sectorMotores && btnAddMotor) {
  const updateMotoresButtons = () => {
    const hasSector = sectorMotores.value !== '';
    btnAddMotor.disabled = !hasSector;
    if (btnResumenMotores) btnResumenMotores.disabled = !hasSector;
  };
  sectorMotores.addEventListener('change', updateMotoresButtons);
  updateMotoresButtons();
}

// Habilitar/deshabilitar botones basado en sector seleccionado - Piscinas
const sectorPiscinas = document.getElementById('filter-sector-piscinas');
const btnAddPiscina = document.getElementById('btn-add-piscina');
if (sectorPiscinas && btnAddPiscina) {
  const updatePiscinasButtons = () => {
    const hasSector = sectorPiscinas.value !== '';
    btnAddPiscina.disabled = !hasSector;
  };
  sectorPiscinas.addEventListener('change', updatePiscinasButtons);
  updatePiscinasButtons();
}

// Habilitar/deshabilitar botones basado en sector seleccionado - Equipos
const sectorEquipos = document.getElementById('filter-sector-equipos');
const btnAddEquipo = document.getElementById('btn-add-item');
const btnResumenEquipos = document.getElementById('btn-resumen-equipos');
if (sectorEquipos && btnAddEquipo) {
  const updateEquiposButtons = () => {
    const hasSector = sectorEquipos.value !== '';
    btnAddEquipo.disabled = !hasSector;
    if (btnResumenEquipos) btnResumenEquipos.disabled = !hasSector;
  };
  sectorEquipos.addEventListener('change', updateEquiposButtons);
  updateEquiposButtons();
}

document.getElementById('filter-sector-piscinas').addEventListener('change', renderPiscinas);
document.getElementById('search-piscinas').addEventListener('input', renderPiscinas);
restrictNumeric(document.getElementById('search-piscinas'));

document.getElementById('filter-sector-motores').addEventListener('change', renderMotores);
document.getElementById('search-motores').addEventListener('input', renderMotores);
restrictNumeric(document.getElementById('search-motores'), 5);

document.getElementById('filter-sector-equipos').addEventListener('change', renderEquipos);
document.getElementById('search-equipos').addEventListener('input', renderEquipos);
restrictNumeric(document.getElementById('search-equipos'));

document.getElementById('resumen-tipo').addEventListener('change', () => {
  document.getElementById('filter-sector-resumen').value = '';
  const searchMotores = document.getElementById('search-resumen-motores');
  const searchEquipos = document.getElementById('search-resumen-equipos-piscina');
  if (searchMotores) searchMotores.value = '';
  if (searchEquipos) searchEquipos.value = '';
  
  // Limpiar completamente el contenido al cambiar de tipo
  const content = document.getElementById('resumen-general-content');
  if (content) {
    content.innerHTML = '';
  }
  
  renderResumen();
});
document.getElementById('filter-sector-resumen').addEventListener('change', async () => {
  const searchMotores = document.getElementById('search-resumen-motores');
  const searchEquipos = document.getElementById('search-resumen-equipos-piscina');
  if (searchMotores) searchMotores.value = '';
  if (searchEquipos) searchEquipos.value = '';
  
  // Refrescar datos cuando cambia el sector
  const sector = document.getElementById('filter-sector-resumen').value;
  const tipo = document.getElementById('resumen-tipo').value;
  
  // Limpiar contenido si cambiamos de tipo de inventario especial (baterías, componentes, sensores)
  const content = document.getElementById('resumen-general-content');
  if ((previousResumenTipo === 'baterias' || previousResumenTipo === 'componentes' || previousResumenTipo === 'sensores') && tipo && tipo !== previousResumenTipo) {
    content.innerHTML = '';
  }
  
  if (sector && tipo === 'motores') {
    data.motores = await fetchMotores(sector);
  } else if (sector && tipo === 'equipos') {
    data.equipos = await fetchEquipos(sector);
    data.piscinas = await fetchPiscinas(sector);
  }
  // No necesitamos recargar datos para baterías o componentes aquí,
  // ya que renderResumenBateriasPage y renderResumenComponentesPage
  // hacen el fetch directamente dentro de ellas.
  
  renderResumen();
});
document.getElementById('search-resumen-motores').addEventListener('input', renderResumenGeneralTable);
restrictNumeric(document.getElementById('search-resumen-motores'), 5);
document.getElementById('search-resumen-equipos-piscina').addEventListener('change', renderResumenGeneralTable);
document.getElementById('btn-export-excel').addEventListener('click', exportResumenExcel);

// Habilitar/deshabilitar botón de exportar Excel basado en sector seleccionado - Resumen
const sectorResumen = document.getElementById('filter-sector-resumen');
const btnExportExcel = document.getElementById('btn-export-excel');
const resumenTipo = document.getElementById('resumen-tipo');
if (sectorResumen && btnExportExcel && resumenTipo) {
  const updateResumenButtons = () => {
    const hasSector = sectorResumen.value !== '';
    const hasTipo = resumenTipo.value !== '';
    btnExportExcel.disabled = !hasSector || !hasTipo;
  };
  sectorResumen.addEventListener('change', updateResumenButtons);
  resumenTipo.addEventListener('change', updateResumenButtons);
  updateResumenButtons();
}

window.openModal = openModal;
window.deletePiscina = deletePiscina;
window.deleteMotor = deleteMotor;
window.deleteEquipo = deleteEquipo;

// --- TRABAJOS / BATERÍAS ---

let trabajosSubsection = null;

function renderTrabajos() {
  const content = document.getElementById('trabajos-content');
  content.innerHTML = '';
  trabajosSubsection = null;
}

// Event listeners para botones de baterías
document.getElementById('btn-modelos-baterias').addEventListener('click', () => showBateriasSubsection('modelos'));
document.getElementById('btn-lotes-baterias').addEventListener('click', () => showBateriasSubsection('lotes'));
document.getElementById('btn-instalaciones-baterias').addEventListener('click', () => showBateriasSubsection('instalaciones'));
document.getElementById('btn-resumen-baterias').addEventListener('click', () => showBateriasSubsection('resumen'));

// Habilitar/deshabilitar botones basado en sector seleccionado - Baterías
const sectorTrabajos = document.getElementById('filter-sector-trabajos');
const btnModelosBaterias = document.getElementById('btn-modelos-baterias');
const btnLotesBaterias = document.getElementById('btn-lotes-baterias');
const btnInstalacionesBaterias = document.getElementById('btn-instalaciones-baterias');
const btnResumenBaterias = document.getElementById('btn-resumen-baterias');
if (sectorTrabajos && btnModelosBaterias) {
  const updateBateriasButtons = () => {
    const hasSector = sectorTrabajos.value !== '';
    btnModelosBaterias.disabled = !hasSector;
    if (btnLotesBaterias) btnLotesBaterias.disabled = !hasSector;
    if (btnInstalacionesBaterias) btnInstalacionesBaterias.disabled = !hasSector;
    if (btnResumenBaterias) btnResumenBaterias.disabled = !hasSector;
  };
  sectorTrabajos.addEventListener('change', () => {
    // Limpiar contenido cuando cambia el sector
    const content = document.getElementById('trabajos-content');
    if (content) {
      content.innerHTML = '';
    }
    trabajosSubsection = null;
    updateBateriasButtons();
  });
  updateBateriasButtons();
}

async function showBateriasSubsection(subsection) {
  const sector = document.getElementById('filter-sector-trabajos').value;
  if (!sector) {
    showToast('Seleccione un sector primero');
    return;
  }

  trabajosSubsection = subsection;
  const content = document.getElementById('trabajos-content');

  switch (subsection) {
    case 'modelos':
      await renderModelosBaterias(sector);
      break;
    case 'lotes':
      await renderLotesBaterias(sector);
      break;
    case 'instalaciones':
      await renderInstalacionesBaterias(sector);
      break;
    case 'resumen':
      await renderResumenBateriasSummary(sector);
      break;
  }
}

async function renderModelosBaterias(sector) {
  const content = document.getElementById('trabajos-content');
  const modelos = await fetchModelosBaterias(sector);

  content.innerHTML = `
    <div class="card baterias-subsection">
      <div class="baterias-subsection-header">
        <h3>📋 Modelos de Baterías</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-modelo-bateria">+ Añadir Modelo</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Amperaje</th>
              <th>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${modelos.length === 0 ? '<tr><td colspan="4"><div class="empty-state"><div class="icon">🔋</div><p>No hay modelos de baterías</p></div></td></tr>' : 
            modelos.map(m => `
              <tr>
                <td><strong>${m.nombre}</strong></td>
                <td>${m.amperaje}A</td>
                <td>${formatDate(m.fechaRegistro)}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="window.openModalModeloBateria('${m.id}')">Editar</button>
                  <button class="btn btn-danger btn-sm" onclick="window.deleteModeloBateria('${m.id}')">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const btnAdd = document.getElementById('btn-add-modelo-bateria');
  if (btnAdd) {
    btnAdd.addEventListener('click', function(e) {
      e.preventDefault();
      window.openModalModeloBateria();
    });
  }
}

async function renderLotesBaterias(sector) {
  const content = document.getElementById('trabajos-content');
  const lotes = await fetchLotesBaterias(sector);

  content.innerHTML = `
    <div class="card baterias-subsection">
      <div class="baterias-subsection-header">
        <h3>📦 Lotes de Baterías</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-lote-bateria">+ Añadir Lote</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre y Número</th>
              <th>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${lotes.length === 0 ? '<tr><td colspan="3"><div class="empty-state"><div class="icon">📦</div><p>No hay lotes de baterías</p></div></td></tr>' :
            lotes.map(l => `
              <tr>
                <td><strong>${l.nombre_completo || '—'}</strong></td>
                <td>${formatDate(l.fecha_registro)}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="window.openModalLoteBateria('${l.id}')">Editar</button>
                  <button class="btn btn-danger btn-sm" onclick="window.deleteLoteBateria('${l.id}')">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const btnAdd = document.getElementById('btn-add-lote-bateria');
  if (btnAdd) {
    btnAdd.addEventListener('click', function(e) {
      e.preventDefault();
      window.openModalLoteBateria();
    });
  }
}

async function renderInstalacionesBaterias(sector) {
  const content = document.getElementById('trabajos-content');
  const instalaciones = await fetchInstalacionesBaterias(sector);
  const piscinas = await fetchPiscinas(sector);
  
  const mesesDisponibles = obtenerMesesDisponiblesBaterias(instalaciones);
  const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM

  content.innerHTML = `
    <div class="card baterias-subsection">
      <div class="baterias-subsection-header">
        <h3>🔋  Instalaciones de Baterías 🔋</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-instalacion-bateria">+ Nueva Instalación</button>
      </div>
      <div class="resumen-baterias-filters">
        <div class="form-group">
          <label>Mes</label>
          <select id="filtro-mes-baterias" class="sector-select">
            <option value="">Todos los meses</option>
            ${mesesDisponibles.map(m => `<option value="${m}" ${m === mesActual ? 'selected' : ''}>${formatMes(m)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Semana</label>
          <select id="filtro-semana-baterias" class="sector-select" disabled>
            <option value="">Todas las semanas</option>
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Amperaje</th>
              <th>Lote</th>
              <th>Piscina</th>
              <th>Tolva</th>
              <th>Cant. Baterías</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${instalaciones.length === 0 ? '<tr><td colspan="8"><div class="empty-state"><div class="icon">🔧</div><p>No hay instalaciones de baterías</p></div></td></tr>' : 
            instalaciones.map(i => `
              <tr>
                <td><strong>${i.modeloNombre}</strong></td>
                <td>${i.amperaje}A</td>
                <td>${i.loteNombre}</td>
                <td>${i.piscinaNumero}</td>
                <td>${i.tolvaNumero}</td>
                <td>2</td>
                <td>${formatDate(i.fechaInstalacion)}</td>
                <td class="actions">
                  <button class="btn btn-secondary btn-sm" onclick="window.openModalInstalacionBateria('${i.id}')">Editar</button>
                  <button class="btn btn-danger btn-sm" onclick="window.deleteInstalacionBateria('${i.id}')">Eliminar</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Resumen de baterías -->
      <div class="resumen-baterias-filters">
        <div class="form-group">
          
          </select>
        </div>
      </div>
      <div class="resumen-baterias-container">
        <div id="resumen-baterias-content"></div>
      </div>
    </div>
  `;

  const btnAdd = document.getElementById('btn-add-instalacion-bateria');
  if (btnAdd) {
    btnAdd.addEventListener('click', function(e) {
      e.preventDefault();
      window.openModalInstalacionBateria(piscinas);
    });
  }
  
  // Event listeners para filtros de mes y semana
  const mesFilter = document.getElementById('filtro-mes-baterias');
  const semanaFilter = document.getElementById('filtro-semana-baterias');
  
  // Inicializar selector de semana si hay un mes seleccionado por defecto
  if (mesFilter.value) {
    const semanas = obtenerSemanasDelMesBaterias(mesFilter.value, instalaciones);
    semanaFilter.innerHTML = '<option value="">Todas las semanas</option>' +
      semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join('');
    semanaFilter.disabled = false;
  }
  
  mesFilter.addEventListener('input', () => {
    const mesSeleccionado = mesFilter.value;
    if (mesSeleccionado) {
      const semanas = obtenerSemanasDelMesBaterias(mesSeleccionado, instalaciones);
      semanaFilter.innerHTML = '<option value="">Todas las semanas</option>' +
        semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join('');
      semanaFilter.disabled = false;
    } else {
      semanaFilter.innerHTML = '<option value="">Todas las semanas</option>';
      semanaFilter.disabled = true;
    }
    // Filtrar instalaciones por mes y semana
    const tbody = document.querySelector('#trabajos-content tbody');
    const filteredInstalaciones = filterInstalacionesByDate(instalaciones, mesFilter.value, semanaFilter.value);
    tbody.innerHTML = filteredInstalaciones.length === 0 ?
      '<tr><td colspan="8"><div class="empty-state"><div class="icon">🔧</div><p>No hay instalaciones de baterías</p></div></td></tr>' :
      filteredInstalaciones.map(i => `
        <tr>
          <td><strong>${i.modeloNombre}</strong></td>
          <td>${i.amperaje}A</td>
          <td>${i.loteNombre}</td>
          <td>${i.piscinaNumero}</td>
          <td>${i.tolvaNumero}</td>
          <td>2</td>
          <td>${formatDate(i.fechaInstalacion)}</td>
          <td class="actions">
            <button class="btn btn-secondary btn-sm" onclick="window.openModalInstalacionBateria('${i.id}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteInstalacionBateria('${i.id}')">Eliminar</button>
          </td>
        </tr>
      `).join('');
  });

  semanaFilter.addEventListener('input', () => {
    // Filtrar instalaciones por mes y semana
    const tbody = document.querySelector('#trabajos-content tbody');
    const filteredInstalaciones = filterInstalacionesByDate(instalaciones, mesFilter.value, semanaFilter.value);
    tbody.innerHTML = filteredInstalaciones.length === 0 ?
      '<tr><td colspan="8"><div class="empty-state"><div class="icon">🔧</div><p>No hay instalaciones de baterías</p></div></td></tr>' :
      filteredInstalaciones.map(i => `
        <tr>
          <td><strong>${i.modeloNombre}</strong></td>
          <td>${i.amperaje}A</td>
          <td>${i.loteNombre}</td>
          <td>${i.piscinaNumero}</td>
          <td>${i.tolvaNumero}</td>
          <td>2</td>
          <td>${formatDate(i.fechaInstalacion)}</td>
          <td class="actions">
            <button class="btn btn-secondary btn-sm" onclick="window.openModalInstalacionBateria('${i.id}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteInstalacionBateria('${i.id}')">Eliminar</button>
          </td>
        </tr>
      `).join('');
  });
}

function filterInstalacionesByDate(instalaciones, mes, semana) {
  if (!mes) return instalaciones;
  
  return instalaciones.filter(i => {
    const fecha = new Date(i.fechaInstalacion);
    const fechaMes = fecha.toISOString().slice(0, 7); // YYYY-MM
    
    if (fechaMes !== mes) return false;
    
    if (semana) {
      const dia = fecha.getDate();
      const semanaNum = Math.ceil(dia / 7);
      return semanaNum === parseInt(semana);
    }
    
    return true;
  });
}

async function renderResumenBateriasSummary(sector) {
  const content = document.getElementById('trabajos-content');
  const instalaciones = await fetchInstalacionesBaterias(sector);
  
  const mesesDisponibles = obtenerMesesDisponiblesBaterias(instalaciones);
  
  // Obtener lista única de nombres de baterías y lotes
  const nombresUnicos = [...new Set(instalaciones.map(i => i.modeloNombre).filter(n => n))].sort();
  const lotesUnicos = [...new Set(instalaciones.map(i => i.loteNombre).filter(l => l))].sort();

  content.innerHTML = `
    <div class="card baterias-subsection">
      <div class="baterias-subsection-header">
        <h3>📊 Resumen de Baterías</h3>
      </div>
      <div class="resumen-baterias-filters">
        <div class="form-group">
          <label>Tipo de registro</label>
          <select id="tipo-registro-summary" class="sector-select">
            <option value="Seleccionar">Seleccionar</option>
            <option value="todos">Todos</option>
            <option value="nombres">Por Nombres</option>
            <option value="lotes">Por Lotes</option>
          </select>
        </div>
        <div class="form-group search-hidden" id="filtro-nombre-wrap">
          <label>Nombre de Batería</label>
          <select id="filtro-nombre-summary" class="sector-select">
            <option value="Todos">Todos</option>
            ${nombresUnicos.map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group search-hidden" id="filtro-lote-wrap">
          <label>Lote</label>
          <select id="filtro-lote-summary" class="sector-select">
            <option value="Todos">Todos</option>
            ${lotesUnicos.map(l => `<option value="${l}">${l}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Mes</label>
          <select id="filtro-mes-summary" class="sector-select">
            <option value="">Todos los meses</option>
            ${mesesDisponibles.map(m => `<option value="${m}">${formatMes(m)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Semana</label>
          <select id="filtro-semana-summary" class="sector-select" disabled>
            <option value="">Todas las semanas</option>
          </select>
        </div>
      </div>
      <div id="resumen-summary-content"></div>
    </div>
  `;

  // Event listeners para filtros
  const tipoRegistroSelect = document.getElementById('tipo-registro-summary');
  const nombreFilter = document.getElementById('filtro-nombre-summary');
  const loteFilter = document.getElementById('filtro-lote-summary');
  const mesFilter = document.getElementById('filtro-mes-summary');
  const semanaFilter = document.getElementById('filtro-semana-summary');
  const nombreWrap = document.getElementById('filtro-nombre-wrap');
  const loteWrap = document.getElementById('filtro-lote-wrap');
  
  tipoRegistroSelect.addEventListener('change', () => {
    const tipo = tipoRegistroSelect.value;
    
    // Mostrar/ocultar filtros según el tipo seleccionado
    nombreWrap.classList.toggle('search-hidden', tipo !== 'nombres');
    loteWrap.classList.toggle('search-hidden', tipo !== 'lotes');
    
    // Resetear filtros cuando cambia el tipo de registro
    if (tipo === 'todos') {
      nombreFilter.value = 'Todos';
      loteFilter.value = 'Todos';
    } else if (tipo === 'nombres') {
      loteFilter.value = 'Todos';
    } else if (tipo === 'lotes') {
      nombreFilter.value = 'Todos';
    }
    
    const mes = mesFilter.value;
    const semana = semanaFilter.value;
    const nombre = nombreFilter.value;
    const lote = loteFilter.value;
    renderResumenSummaryContent(tipo, instalaciones, mes, semana, nombre, lote);
  });
  
  nombreFilter.addEventListener('change', () => {
    loteFilter.value = 'Todos';
    const tipo = tipoRegistroSelect.value;
    const mes = mesFilter.value;
    const semana = semanaFilter.value;
    const nombre = nombreFilter.value;
    renderResumenSummaryContent(tipo, instalaciones, mes, semana, nombre, '');
  });
  
  loteFilter.addEventListener('change', () => {
    const tipo = tipoRegistroSelect.value;
    const mes = mesFilter.value;
    const semana = semanaFilter.value;
    const lote = loteFilter.value;
    renderResumenSummaryContent(tipo, instalaciones, mes, semana, '', lote);
  });
  
  mesFilter.addEventListener('change', () => {
    const mesSeleccionado = mesFilter.value;
    if (mesSeleccionado) {
      const semanas = obtenerSemanasDelMesBaterias(mesSeleccionado, instalaciones);
      semanaFilter.innerHTML = '<option value="">Todas las semanas</option>' + 
        semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join('');
      semanaFilter.disabled = false;
    } else {
      semanaFilter.innerHTML = '<option value="">Todas las semanas</option>';
      semanaFilter.disabled = true;
    }
    const tipo = tipoRegistroSelect.value;
    const nombre = nombreFilter.value;
    const lote = loteFilter.value;
    renderResumenSummaryContent(tipo, instalaciones, mesFilter.value, semanaFilter.value, nombre, lote);
  });
  
  semanaFilter.addEventListener('change', () => {
    const tipo = tipoRegistroSelect.value;
    const nombre = nombreFilter.value;
    const lote = loteFilter.value;
    renderResumenSummaryContent(tipo, instalaciones, mesFilter.value, semanaFilter.value, nombre, lote);
  });

  // Renderizar inicial con "Seleccionar" (no mostrar nada)
  renderResumenSummaryContent(tipoRegistroSelect.value, instalaciones);
}

function renderResumenSummaryContent(tipo, instalaciones, mes = '', semana = '', nombre = '', lote = '') {
  const content = document.getElementById('resumen-summary-content');
  
  // Si es "Seleccionar", no mostrar nada
  if (tipo === 'Seleccionar' || tipo === '') {
    content.innerHTML = '';
    return;
  }
  
  // Filtrar por mes y semana si se proporcionan
  let instalacionesFiltradas = instalaciones;
  if (mes !== '' || semana !== '') {
    instalacionesFiltradas = instalaciones.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const mesInstalacion = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const dia = fecha.getDate();
      const semanaInstalacion = Math.ceil(dia / 7);
      
      const coincideMes = mes === '' || mesInstalacion === mes;
      const coincideSemana = semana === '' || semanaInstalacion === parseInt(semana);
      
      return coincideMes && coincideSemana;
    });
  }
  
  // Filtrar por nombre de batería si se proporciona y no es "Todos"
  if (nombre && nombre !== 'Todos') {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => i.modeloNombre === nombre);
  }
  
  // Filtrar por lote si se proporciona y no es "Todos"
  if (lote && lote !== 'Todos') {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => i.loteNombre === lote);
  }
  
  if (tipo === 'todos') {
    // Mostrar agrupado por nombres y por lotes
    // Agrupar por nombre de batería
    const agrupadoPorNombre = {};
    instalacionesFiltradas.forEach(i => {
      if (!agrupadoPorNombre[i.modeloNombre]) {
        agrupadoPorNombre[i.modeloNombre] = [];
      }
      agrupadoPorNombre[i.modeloNombre].push(i);
    });

    // Agrupar por lote
    const agrupadoPorLote = {};
    instalacionesFiltradas.forEach(i => {
      const loteKey = i.loteNombre;
      if (!agrupadoPorLote[loteKey]) {
        agrupadoPorLote[loteKey] = [];
      }
      agrupadoPorLote[loteKey].push(i);
    });

    content.innerHTML = `
      <div class="resumen-baterias-margenes">
        <h4>📋 Por Nombres de Batería</h4>
        ${Object.keys(agrupadoPorNombre).map((nombre, index) => `
          <div class="resumen-baterias-margen">
            <div class="resumen-baterias-margen-header">Modelo de Batería ${index + 1}: ${nombre} (${agrupadoPorNombre[nombre].length} registros, ${agrupadoPorNombre[nombre].length * 2} baterías)</div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Piscina</th>
                    <th>Tolva</th>
                    <th>Cant. Baterías</th>
                    <th>Fecha</th>
                    <th>Lote</th>
                  </tr>
                </thead>
                <tbody>
                  ${agrupadoPorNombre[nombre].map(i => `
                    <tr>
                      <td>${i.piscinaNumero}</td>
                      <td>${i.tolvaNumero}</td>
                      <td>2</td>
                      <td>${formatDate(i.fechaInstalacion)}</td>
                      <td>${i.loteNombre}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="resumen-baterias-margenes" style="margin-top: 30px;">
        <h4>📦 Por Lotes</h4>
        ${Object.keys(agrupadoPorLote).map((loteKey, index) => `
          <div class="resumen-baterias-margen">
            <div class="resumen-baterias-margen-header">Lote ${index + 1}: ${loteKey} (${agrupadoPorLote[loteKey].length} registros, ${agrupadoPorLote[loteKey].length * 2} baterías)</div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Amperaje</th>
                    <th>Piscina</th>
                    <th>Tolva</th>
                    <th>Cant. Baterías</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  ${agrupadoPorLote[loteKey].map(i => `
                    <tr>
                      <td>${i.modeloNombre}</td>
                      <td>${i.amperaje}A</td>
                      <td>${i.piscinaNumero}</td>
                      <td>${i.tolvaNumero}</td>
                      <td>2</td>
                      <td>${formatDate(i.fechaInstalacion)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (tipo === 'nombres') {
    // Agrupar por nombre de batería
    const agrupado = {};
    instalacionesFiltradas.forEach(i => {
      if (!agrupado[i.modeloNombre]) {
        agrupado[i.modeloNombre] = [];
      }
      agrupado[i.modeloNombre].push(i);
    });

    content.innerHTML = `
      <div class="resumen-baterias-margenes">
        ${Object.keys(agrupado).map((nombre, index) => `
          <div class="resumen-baterias-margen">
            <div class="resumen-baterias-margen-header">Modelo de Batería ${index + 1}: ${nombre} (${agrupado[nombre].length} registros, ${agrupado[nombre].length * 2} baterías)</div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Piscina</th>
                    <th>Tolva</th>
                    <th>Cant. Baterías</th>
                    <th>Fecha</th>
                    <th>Lote</th>
                  </tr>
                </thead>
                <tbody>
                  ${agrupado[nombre].map(i => `
                    <tr>
                      <td>${i.piscinaNumero}</td>
                      <td>${i.tolvaNumero}</td>
                      <td>2</td>
                      <td>${formatDate(i.fechaInstalacion)}</td>
                      <td>${i.loteNombre}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (tipo === 'lotes') {
    // Agrupar por lote
    const agrupado = {};
    instalacionesFiltradas.forEach(i => {
      const loteKey = i.loteNombre;
      if (!agrupado[loteKey]) {
        agrupado[loteKey] = [];
      }
      agrupado[loteKey].push(i);
    });

    content.innerHTML = `
      <div class="resumen-baterias-margenes">
        ${Object.keys(agrupado).map((loteKey, index) => `
          <div class="resumen-baterias-margen">
            <div class="resumen-baterias-margen-header">Lote ${index + 1}: ${loteKey} (${agrupado[loteKey].length} registros, ${agrupado[loteKey].length * 2} baterías)</div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Amperaje</th>
                    <th>Piscina</th>
                    <th>Tolva</th>
                    <th>Cant. Baterías</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  ${agrupado[loteKey].map(i => `
                    <tr>
                      <td>${i.modeloNombre}</td>
                      <td>${i.amperaje}A</td>
                      <td>${i.piscinaNumero}</td>
                      <td>${i.tolvaNumero}</td>
                      <td>2</td>
                      <td>${formatDate(i.fechaInstalacion)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

async function renderResumenBateriasPage(sector) {
  try {
    const content = document.getElementById('resumen-general-content');
    const instalaciones = await fetchInstalacionesBaterias(sector);
    
    // Resetear activeBateriasTab al valor por defecto
    activeBateriasTab = 'nombres';

    // Generar lista de meses disponibles
    const mesesDisponibles = obtenerMesesDisponibles(instalaciones);
    const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Obtener lista única de nombres de baterías y lotes
    const nombresUnicos = [...new Set(instalaciones.map(i => i.modeloNombre).filter(n => n))].sort();
    const lotesUnicos = [...new Set(instalaciones.map(i => i.loteNombre).filter(l => l))].sort();

    content.innerHTML = `
      <div class="resumen-sector-header">
        <h3 id="resumen-sector-label">${sector}</h3>
        <div class="resumen-baterias-filters">
          <div class="form-group">
            <label>Vista</label>
            <select id="filter-vista" class="form-select">
              <option value="nombres">Por Nombres</option>
              <option value="lotes">Por Lotes</option>
              <option value="combinada">Vista Combinada</option>
            </select>
          </div>
          <div class="form-group" id="filtro-nombre-wrap">
            <label>Nombre de Batería</label>
            <select id="filter-nombre" class="form-select">
              <option value="Todos">Todos</option>
              ${nombresUnicos.map(n => `<option value="${n}">${n}</option>`).join('')}
            </select>
          </div>
          <div class="form-group search-hidden" id="filtro-lote-wrap">
            <label>Lote</label>
            <select id="filter-lote" class="form-select">
              <option value="Todos">Todos</option>
              ${lotesUnicos.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Mes</label>
            <select id="filter-mes" class="form-select">
              <option value="">Todos los meses</option>
              ${mesesDisponibles.map(m => `<option value="${m}" ${m === mesActual ? 'selected' : ''}>${formatMes(m)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Semana</label>
            <select id="filter-semana" class="form-select" disabled>
              <option value="">Todas las semanas</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-export-excel">Descargar Excel</button>
      </div>
      <div class="resumen-layout">
        <div class="resumen-main">
          <div class="card resumen-panel resumen-panel-general baterias-panel">
            <span class="resumen-panel-title" id="resumen-general-title">Resumen de Baterías</span>
            <div id="resumen-baterias-content"></div>
          </div>
        </div>
        <div class="resumen-charts">
          <div class="card chart-card">
            <span class="chart-title">Gráfica de Barras</span>
            <canvas id="chart-bar"></canvas>
          </div>
          <div class="card chart-card">
            <span class="chart-title">Gráfica Circular</span>
            <canvas id="chart-pie"></canvas>
          </div>
        </div>
      </div>
    `;

    // Re-adjuntar event listener al botón de exportar Excel
    document.getElementById('btn-export-excel').addEventListener('click', exportResumenExcel);

    // Event listeners para filtros
    const filterVista = document.getElementById('filter-vista');
    const filterNombre = document.getElementById('filter-nombre');
    const filterLote = document.getElementById('filter-lote');
    const filterMes = document.getElementById('filter-mes');
    const filterSemana = document.getElementById('filter-semana');
    const nombreWrap = document.getElementById('filtro-nombre-wrap');
    const loteWrap = document.getElementById('filtro-lote-wrap');

    // Inicializar selector de semana si hay un mes seleccionado por defecto
    if (filterMes.value) {
      const semanas = obtenerSemanasDelMes(filterMes.value, instalaciones);
      filterSemana.innerHTML = '<option value="">Todas las semanas</option>' + 
        semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join('');
      filterSemana.disabled = false;
    }

    filterVista.addEventListener('change', () => {
      const vista = filterVista.value;
      
      // Mostrar/ocultar filtros según la vista seleccionada
      nombreWrap.classList.toggle('search-hidden', vista !== 'nombres');
      loteWrap.classList.toggle('search-hidden', vista !== 'lotes');
      
      // Resetear filtros cuando cambia la vista
      if (vista === 'nombres') {
        filterLote.value = 'Todos';
      } else if (vista === 'lotes') {
        filterNombre.value = 'Todos';
      } else if (vista === 'combinada') {
        filterNombre.value = 'Todos';
        filterLote.value = 'Todos';
      }
      
      activeBateriasTab = vista;
      aplicarFiltrosBaterias(instalaciones);
    });

    filterNombre.addEventListener('change', () => {
      aplicarFiltrosBaterias(instalaciones);
    });

    filterLote.addEventListener('change', () => {
      aplicarFiltrosBaterias(instalaciones);
    });

    filterMes.addEventListener('input', () => {
      const mesSeleccionado = filterMes.value;
      if (mesSeleccionado) {
        const semanas = obtenerSemanasDelMes(mesSeleccionado, instalaciones);
        filterSemana.innerHTML = '<option value="">Todas las semanas</option>' + 
          semanas.map(s => `<option value="${s}">Semana ${s}</option>`).join('');
        filterSemana.disabled = false;
      } else {
        filterSemana.innerHTML = '<option value="">Todas las semanas</option>';
        filterSemana.disabled = true;
      }
      aplicarFiltrosBaterias(instalaciones);
    });

    filterSemana.addEventListener('input', () => {
      aplicarFiltrosBaterias(instalaciones);
    });

    // Renderizar resumen inicial por nombres
    aplicarFiltrosBaterias(instalaciones);
  } catch (error) {
    console.error('Error renderizando resumen de baterías:', error);
    const content = document.getElementById('resumen-general-content');
    content.innerHTML = '<p class="hint-text">Error al cargar datos de baterías.</p>';
  }
}

function renderResumenBaterias(tipo, instalaciones, mes = '', semana = '') {
  const content = document.getElementById('resumen-baterias-content');
  
  // Si es "Seleccionar", no mostrar nada
  if (tipo === 'Seleccionar' || tipo === '') {
    content.innerHTML = '';
    return;
  }
  
  // Filtrar por mes y semana si se proporcionan
  let instalacionesFiltradas = instalaciones;
  if (mes !== '' || semana !== '') {
    instalacionesFiltradas = instalaciones.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const mesInstalacion = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const dia = fecha.getDate();
      const semanaInstalacion = Math.ceil(dia / 7);
      
      const coincideMes = mes === '' || mesInstalacion === mes;
      const coincideSemana = semana === '' || semanaInstalacion === parseInt(semana);
      
      return coincideMes && coincideSemana;
    });
  }
  
  if (tipo === 'todos') {
    // Mostrar ambos: por nombres y por lotes
    let html = '';
    
    // Sección por nombres
    const agrupadoNombres = {};
    instalacionesFiltradas.forEach(i => {
      if (!agrupadoNombres[i.modeloNombre]) {
        agrupadoNombres[i.modeloNombre] = [];
      }
      agrupadoNombres[i.modeloNombre].push(i);
    });

    html += '<h3 style="margin-bottom: 1rem; color: var(--primary);">Por Nombres</h3>';
    html += '<div class="resumen-baterias-margenes">';
    html += Object.keys(agrupadoNombres).map((nombre, index) => `
      <div class="resumen-baterias-margen">
        <div class="resumen-baterias-margen-header">Modelo de Batería ${index + 1}: ${nombre} (${agrupadoNombres[nombre].length} registros, ${agrupadoNombres[nombre].length * 2} baterías)</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Piscina</th>
                <th>Tolva</th>
                <th>Fecha</th>
                <th>Lote</th>
              </tr>
            </thead>
            <tbody>
              ${agrupadoNombres[nombre].map(i => `
                <tr>
                  <td>${i.piscinaNumero}</td>
                  <td>${i.tolvaNumero}</td>
                  <td>${formatDate(i.fechaInstalacion)}</td>
                  <td>${i.loteNombre}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');
    html += '</div>';
    
    // Sección por lotes
    const agrupadoLotes = {};
    instalacionesFiltradas.forEach(i => {
      const loteKey = i.loteNombre;
      if (!agrupadoLotes[loteKey]) {
        agrupadoLotes[loteKey] = [];
      }
      agrupadoLotes[loteKey].push(i);
    });

    html += '<h3 style="margin: 2rem 0 1rem 0; color: var(--primary);">Por Lotes</h3>';
    html += '<div class="resumen-baterias-margenes">';
    html += Object.keys(agrupadoLotes).map((loteKey, index) => `
      <div class="resumen-baterias-margen">
        <div class="resumen-baterias-margen-header">Lote ${index + 1}: ${loteKey} (${agrupadoLotes[loteKey].length} registros, ${agrupadoLotes[loteKey].length * 2} baterías)</div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Amperaje</th>
                <th>Piscina</th>
                <th>Tolva</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${agrupadoLotes[loteKey].map(i => `
                <tr>
                  <td>${i.modeloNombre}</td>
                  <td>${i.amperaje}A</td>
                  <td>${i.piscinaNumero}</td>
                  <td>${i.tolvaNumero}</td>
                  <td>${formatDate(i.fechaInstalacion)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');
    html += '</div>';
    
    content.innerHTML = html;
  } else if (tipo === 'nombres') {
    // Agrupar por nombre de batería
    const agrupado = {};
    instalacionesFiltradas.forEach(i => {
      if (!agrupado[i.modeloNombre]) {
        agrupado[i.modeloNombre] = [];
      }
      agrupado[i.modeloNombre].push(i);
    });

    content.innerHTML = `
      <div class="resumen-baterias-margenes">
        ${Object.keys(agrupado).map((nombre, index) => `
          <div class="resumen-baterias-margen">
            <div class="resumen-baterias-margen-header">Modelo de Batería ${index + 1}: ${nombre} (${agrupado[nombre].length} registros, ${agrupado[nombre].length * 2} baterías)</div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Piscina</th>
                    <th>Tolva</th>
                    <th>Cant. Baterías</th>
                    <th>Fecha</th>
                    <th>Lote</th>
                  </tr>
                </thead>
                <tbody>
                  ${agrupado[nombre].map(i => `
                    <tr>
                      <td>${i.piscinaNumero}</td>
                      <td>${i.tolvaNumero}</td>
                      <td>2</td>
                      <td>${formatDate(i.fechaInstalacion)}</td>
                      <td>${i.loteNombre}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (tipo === 'lotes') {
    // Agrupar por lote
    const agrupado = {};
    instalacionesFiltradas.forEach(i => {
      const loteKey = i.loteNombre;
      if (!agrupado[loteKey]) {
        agrupado[loteKey] = [];
      }
      agrupado[loteKey].push(i);
    });

    content.innerHTML = `
      <div class="resumen-baterias-margenes">
        ${Object.keys(agrupado).map((loteKey, index) => `
          <div class="resumen-baterias-margen">
            <div class="resumen-baterias-margen-header">Lote ${index + 1}: ${loteKey} (${agrupado[loteKey].length} registros, ${agrupado[loteKey].length * 2} baterías)</div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Amperaje</th>
                    <th>Piscina</th>
                    <th>Tolva</th>
                    <th>Cant. Baterías</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  ${agrupado[loteKey].map(i => `
                    <tr>
                      <td>${i.modeloNombre}</td>
                      <td>${i.amperaje}A</td>
                      <td>${i.piscinaNumero}</td>
                      <td>${i.tolvaNumero}</td>
                      <td>2</td>
                      <td>${formatDate(i.fechaInstalacion)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (tipo === 'combinada') {
    // Vista combinada: Modelo de batería, Amperaje, Lote, Piscina, Tolva, Cant. Baterías, Fecha
    content.innerHTML = `
      <div class="table-wrapper-wide">
        <table>
          <thead>
            <tr>
              <th>Modelo de Batería</th>
              <th>Amperaje</th>
              <th>Lote</th>
              <th>Piscina</th>
              <th>Tolva</th>
              <th>Cant. Baterías</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${instalaciones.map(i => `
              <tr>
                <td><strong>${i.modeloNombre}</strong></td>
                <td>${i.amperaje}A</td>
                <td>${i.loteNombre}</td>
                <td>${i.piscinaNumero}</td>
                <td>${i.tolvaNumero}</td>
                <td>2</td>
                <td>${formatDate(i.fechaInstalacion)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

function obtenerMesesDisponibles(instalaciones) {
  const meses = new Set();
  instalaciones.forEach(i => {
    const fecha = new Date(i.fechaInstalacion);
    const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    meses.add(mesKey);
  });
  return Array.from(meses).sort().reverse();
}

function formatMes(mesKey) {
  const [year, month] = mesKey.split('-');
  const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${nombresMeses[parseInt(month) - 1]} ${year}`;
}

function obtenerSemanasDelMes(mesKey, instalaciones) {
  const semanas = new Set();
  instalaciones.forEach(i => {
    const fecha = new Date(i.fechaInstalacion);
    const mesInstalacion = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (mesInstalacion === mesKey) {
      const dia = fecha.getDate();
      const semana = Math.ceil(dia / 7);
      semanas.add(semana);
    }
  });
  return Array.from(semanas).sort((a, b) => a - b);
}

function obtenerMesesDisponiblesBaterias(instalaciones) {
  const meses = new Set();
  instalaciones.forEach(i => {
    const fecha = new Date(i.fechaInstalacion);
    const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    meses.add(mesKey);
  });
  return Array.from(meses).sort().reverse();
}

function obtenerSemanasDelMesBaterias(mesKey, instalaciones) {
  const semanas = new Set();
  instalaciones.forEach(i => {
    const fecha = new Date(i.fechaInstalacion);
    const mesInstalacion = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (mesInstalacion === mesKey) {
      const dia = fecha.getDate();
      const semana = Math.ceil(dia / 7);
      semanas.add(semana);
    }
  });
  return Array.from(semanas).sort((a, b) => a - b);
}

function aplicarFiltrosBaterias(instalaciones) {
  const filterMes = document.getElementById('filter-mes');
  const filterSemana = document.getElementById('filter-semana');
  const filterNombre = document.getElementById('filter-nombre');
  const filterLote = document.getElementById('filter-lote');
  
  let instalacionesFiltradas = [...instalaciones];
  
  // Filtrar por mes
  if (filterMes && filterMes.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      return mesKey === filterMes.value;
    });
  }
  
  // Filtrar por semana
  if (filterSemana && filterSemana.value) {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => {
      const fecha = new Date(i.fechaInstalacion);
      const dia = fecha.getDate();
      const semana = Math.ceil(dia / 7);
      return semana === parseInt(filterSemana.value);
    });
  }
  
  // Filtrar por nombre de batería si se proporciona y no es "Todos"
  if (filterNombre && filterNombre.value && filterNombre.value !== 'Todos') {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => i.modeloNombre === filterNombre.value);
  }
  
  // Filtrar por lote si se proporciona y no es "Todos"
  if (filterLote && filterLote.value && filterLote.value !== 'Todos') {
    instalacionesFiltradas = instalacionesFiltradas.filter(i => i.loteNombre === filterLote.value);
  }
  
  // Renderizar según la vista activa
  renderResumenBaterias(activeBateriasTab, instalacionesFiltradas);
  
  // Generar gráficas basadas en los datos filtrados
  updateBateriasCharts(instalacionesFiltradas);
}

function updateBateriasCharts(instalaciones) {
  if (instalaciones.length === 0) {
    clearCharts();
    return;
  }
  
  // Agrupar datos para gráficas según la vista activa
  let labels = [];
  let data = [];
  
  if (activeBateriasTab === 'nombres') {
    // Agrupar por nombre de batería
    const agrupado = {};
    instalaciones.forEach(i => {
      if (!agrupado[i.modeloNombre]) {
        agrupado[i.modeloNombre] = 0;
      }
      agrupado[i.modeloNombre]++;
    });
    labels = Object.keys(agrupado);
    data = Object.values(agrupado);
  } else if (activeBateriasTab === 'lotes') {
    // Agrupar por lote
    const agrupado = {};
    instalaciones.forEach(i => {
      if (!agrupado[i.loteNombre]) {
        agrupado[i.loteNombre] = 0;
      }
      agrupado[i.loteNombre]++;
    });
    labels = Object.keys(agrupado);
    data = Object.values(agrupado);
  } else if (activeBateriasTab === 'combinada') {
    // Agrupar por nombre de batería para vista combinada
    const agrupado = {};
    instalaciones.forEach(i => {
      if (!agrupado[i.modeloNombre]) {
        agrupado[i.modeloNombre] = 0;
      }
      agrupado[i.modeloNombre]++;
    });
    labels = Object.keys(agrupado);
    data = Object.values(agrupado);
  }
  
  // Crear gráficas
  createBarChart(labels, data, 'Cantidad de Instalaciones');
  createPieChart(labels, data, 'Distribución');
}

// Modal para modelo de batería
window.openModalModeloBateria = async function(id = null) {
  editingId = id;
  const sector = document.getElementById('filter-sector-trabajos').value;
  
  // Siempre obtener datos frescos de la API
  const modelos = await fetchModelosBaterias(sector);
  const modelo = id ? modelos.find(m => m.id === id) : {};

  document.getElementById('modal-title').textContent = id ? 'Actualizar Modelo de Batería' : 'Nuevo Modelo de Batería';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" disabled>
        <option value="${sector}">${sector}</option>
      </select>
    </div>
    <div class="form-group">
      <label>Nombre de Batería * (sin espacios)</label>
      <input type="text" id="f-nombre" value="${modelo.nombre || ''}" placeholder="Ej: TrojanL16" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
    <div class="form-group">
      <label>Amperaje * (solo números)</label>
      <input type="text" id="f-amperaje" value="${modelo.amperaje || ''}" placeholder="Ej: 360" inputmode="numeric" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
  `;

  restrictNumeric(document.getElementById('f-amperaje'));
  document.getElementById('modal-save').onclick = saveModeloBateria;
  document.getElementById('modal-overlay').classList.add('open');
};

async function saveModeloBateria() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  const sector = document.getElementById('filter-sector-trabajos').value;
  const nombre = document.getElementById('f-nombre').value.trim();
  const amperaje = document.getElementById('f-amperaje').value.trim();

  if (!nombre) { showToast('Debe ingresar el nombre de la batería.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (/\s/.test(nombre)) { showToast('El nombre no puede contener espacios.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!amperaje) { showToast('Debe ingresar el amperaje.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }
  if (!/^\d+$/.test(amperaje)) { showToast('El amperaje debe ser un número.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  const modelo = {
    id: editingId || generateId(),
    sector,
    nombre,
    amperaje: parseInt(amperaje)
  };

  try {
    const url = editingId ? `${API_BASE}/modelos-baterias/${editingId}` : `${API_BASE}/modelos-baterias`;
    const method = editingId ? 'PUT' : 'POST';
    
    const response = await fetch(url, getAuthHeaders({
      method: method,
      body: JSON.stringify(modelo)
    }));
    if (!response.ok) throw new Error('Error al guardar modelo de batería');
    
    closeModal();
    await showBateriasSubsection('modelos');
  } catch (error) {
    console.error('Error saving modelo batería:', error);
    showToast('Error al guardar modelo de batería. Por favor intente nuevamente.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

window.deleteModeloBateria = async function(id) {
  try {
    const response = await fetch(`${API_BASE}/modelos-baterias/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar modelo de batería');
    showToast('Modelo de batería eliminado');
    await showBateriasSubsection('modelos');
  } catch (error) {
    console.error('Error deleting modelo batería:', error);
    showToast('Error al eliminar modelo de batería. Por favor intente nuevamente.');
  }
};

// Modal para lote de batería
window.openModalLoteBateria = async function(id = null) {
  editingId = id;
  const sector = document.getElementById('filter-sector-trabajos').value;

  // Cargar lotes desde API siempre para tener datos actualizados
  const lotes = await fetchLotesBaterias(sector);
  const lote = id ? lotes.find(l => l.id === id) : {};

  document.getElementById('modal-title').textContent = id ? 'Actualizar Lote de Batería' : 'Nuevo Lote de Batería';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" disabled>
        <option value="${sector}">${sector}</option>
      </select>
    </div>
    <div class="form-group">
      <label>Nombre y Número del Lote *</label>
      <input type="text" id="f-nombre-completo" value="${lote.nombre_completo || ''}" placeholder="Ej: LoteA Ab1215/2026" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
  `;

  document.getElementById('modal-save').onclick = saveLoteBateria;
  document.getElementById('modal-overlay').classList.add('open');
};

async function saveLoteBateria() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  const sector = document.getElementById('filter-sector-trabajos').value;
  const nombreCompleto = document.getElementById('f-nombre-completo').value.trim();

  if (!nombreCompleto) { showToast('Debe ingresar el nombre y número del lote.'); saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; return; }

  const lote = {
    id: editingId || generateId(),
    sector,
    nombre_completo: nombreCompleto
  };

  try {
    const url = editingId ? `${API_BASE}/lotes-baterias/${editingId}` : `${API_BASE}/lotes-baterias`;
    const method = editingId ? 'PUT' : 'POST';
    
    const response = await fetch(url, getAuthHeaders({
      method: method,
      body: JSON.stringify(lote)
    }));
    if (!response.ok) throw new Error('Error al guardar lote de batería');

    closeModal();
    showToast('Datos guardados');
    await showBateriasSubsection('lotes');
  } catch (error) {
    console.error('Error saving lote batería:', error);
    showToast('Error al guardar lote de batería. Por favor intente nuevamente.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

window.deleteLoteBateria = async function(id) {
  try {
    const response = await fetch(`${API_BASE}/lotes-baterias/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar lote de batería');
    showToast('Lote de batería eliminado');
    await showBateriasSubsection('lotes');
  } catch (error) {
    console.error('Error deleting lote batería:', error);
    showToast('Error al eliminar lote de batería. Por favor intente nuevamente.');
  }
};

// Modal para instalación de batería
window.openModalInstalacionBateria = async function(idOrPiscinas) {
  editingId = typeof idOrPiscinas === 'string' ? idOrPiscinas : null;
  const sector = document.getElementById('filter-sector-trabajos').value;
  const piscinas = await fetchPiscinas(sector);

  document.getElementById('modal-title').textContent = editingId ? 'Actualizar Instalación de Batería' : 'Nueva Instalación de Batería';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Sector *</label>
      <select id="f-sector" disabled>
        <option value="${sector}">${sector}</option>
      </select>
    </div>
    <div class="form-group">
      <label>Modelo de Batería *</label>
      <select id="f-modelo-bateria" required>
        <option value="">— Seleccione un modelo —</option>
      </select>
    </div>
    <div class="form-group">
      <label>Amperaje</label>
      <input type="text" id="f-amperaje" disabled placeholder="Se mostrará automáticamente">
    </div>
    <div class="form-group">
      <label>Lote de Batería *</label>
      <select id="f-lote-bateria" required>
        <option value="">— Seleccione un lote —</option>
      </select>
    </div>
    <div class="form-group">
      <label>Número de Piscina *</label>
      <select id="f-piscina-numero" required>
        <option value="">— Seleccione una piscina —</option>
        ${piscinas.map(p => `<option value="${p.numero}">${p.numero}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Número de Tolva *</label>
      <input type="text" id="f-tolva-numero" placeholder="Ej: 1" ${!editingId ? 'autocomplete="off"' : ''}>
    </div>
    <div class="form-group">
      <label>Cantidad de Baterías</label>
      <input type="text" id="f-cantidad-baterias" value="2" readonly disabled>
    </div>
    <div class="form-group">
      <label>Fecha</label>
      <input type="text" id="f-fecha" disabled value="${new Date().toLocaleDateString('es-ES')}">
    </div>
  `;

  // Cargar modelos y lotes
  await loadModelosAndLotesForInstalacion(sector);

  // Si es edición, cargar los datos de la instalación
  if (editingId) {
    const instalaciones = await fetchInstalacionesBaterias(sector);
    const instalacion = instalaciones.find(i => i.id === editingId);
    if (instalacion) {
      document.getElementById('f-modelo-bateria').value = instalacion.modeloBateriaId;
      document.getElementById('f-amperaje').value = instalacion.amperaje;
      document.getElementById('f-lote-bateria').value = instalacion.loteBateriaId;
      document.getElementById('f-piscina-numero').value = instalacion.piscinaNumero;
      document.getElementById('f-tolva-numero').value = instalacion.tolvaNumero;
    }
  }
  
  // Event listener para mostrar amperaje automáticamente
  document.getElementById('f-modelo-bateria').addEventListener('change', async function() {
    const modeloId = this.value;
    if (modeloId) {
      const modelos = await fetchModelosBaterias(sector);
      const modelo = modelos.find(m => m.id === modeloId);
      if (modelo) {
        document.getElementById('f-amperaje').value = modelo.amperaje;
      }
    } else {
      document.getElementById('f-amperaje').value = '';
    }
  });

  document.getElementById('modal-save').onclick = saveInstalacionBateria;
  document.getElementById('modal-overlay').classList.add('open');
};

async function loadModelosAndLotesForInstalacion(sector) {
  const modelos = await fetchModelosBaterias(sector);
  const lotes = await fetchLotesBaterias(sector);

  const modeloSelect = document.getElementById('f-modelo-bateria');
  const loteSelect = document.getElementById('f-lote-bateria');

  modeloSelect.innerHTML = '<option value="">— Seleccione un modelo —</option>' +
    modelos.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');

  loteSelect.innerHTML = '<option value="">— Seleccione un lote —</option>' +
    lotes.map(l => `<option value="${l.id}">${l.nombre_completo}</option>`).join('');
}

let isSavingInstalacionBateria = false;

async function saveInstalacionBateria() {
  if (isSavingInstalacionBateria) {
    return;
  }

  isSavingInstalacionBateria = true;
  const saveButton = document.getElementById('modal-save');
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = 'Guardando...';
  }

  const sector = document.getElementById('filter-sector-trabajos').value;
  const modeloBateriaId = document.getElementById('f-modelo-bateria').value;
  const loteBateriaId = document.getElementById('f-lote-bateria').value;
  const piscinaNumero = document.getElementById('f-piscina-numero').value;
  const tolvaNumero = document.getElementById('f-tolva-numero').value.trim();

  if (!modeloBateriaId) { showToast('Debe seleccionar un modelo de batería.'); resetSaveButton(); return; }
  if (!loteBateriaId) { showToast('Debe seleccionar un lote de batería.'); resetSaveButton(); return; }
  if (!piscinaNumero) { showToast('Debe seleccionar una piscina.'); resetSaveButton(); return; }
  if (!tolvaNumero) { showToast('Debe ingresar el número de tolva.'); resetSaveButton(); return; }

  const instalacion = {
    id: editingId || generateId(),
    sector,
    modelo_bateria_id: modeloBateriaId,
    lote_bateria_id: loteBateriaId,
    piscina_numero: piscinaNumero,
    tolva_numero: tolvaNumero,
    fecha_instalacion: new Date().toISOString()
  };

  try {
    const url = editingId ? `${API_BASE}/instalaciones-baterias/${editingId}` : `${API_BASE}/instalaciones-baterias`;
    const method = editingId ? 'PUT' : 'POST';
    
    const response = await fetch(url, getAuthHeaders({
      method: method,
      body: JSON.stringify(instalacion)
    }));
    if (!response.ok) throw new Error('Error al guardar instalación de batería');
    
    closeModal();
    showToast('Datos guardados');
    await showBateriasSubsection('instalaciones');
  } catch (error) {
    console.error('Error saving instalación batería:', error);
    showToast('Error al guardar instalación de batería. Por favor intente nuevamente.');
  } finally {
    resetSaveButton();
  }
}

function resetSaveButton() {
  isSavingInstalacionBateria = false;
  const saveButton = document.getElementById('modal-save');
  if (saveButton) {
    saveButton.disabled = false;
    saveButton.textContent = 'Guardar';
  }
}

window.deleteInstalacionBateria = async function(id) {
  try {
    const response = await fetch(`${API_BASE}/instalaciones-baterias/${id}`, getAuthHeaders({
      method: 'DELETE'
    }));
    if (!response.ok) throw new Error('Error al eliminar instalación de batería');
    showToast('Instalación de batería eliminada');
    await showBateriasSubsection('instalaciones');
  } catch (error) {
    console.error('Error deleting instalación batería:', error);
    showToast('Error al eliminar instalación de batería. Por favor intente nuevamente.');
  }
};

// Event listener para cambio de sector en Trabajos
document.getElementById('filter-sector-trabajos').addEventListener('change', () => {
  if (trabajosSubsection) {
    showBateriasSubsection(trabajosSubsection);
  }
});

// Initialize with data from API
loadAllData().then(() => {
  navigateTo('motores');
}).catch(error => {
  console.error('Error loading initial data:', error);
  navigateTo('motores');
});
