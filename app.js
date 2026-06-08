const API_BASE = 'http://localhost:3000/api';
const SECTORS = ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4'];
const ESTADOS_MOTOR = [
  'Contenedor por Mantenimiento',
  'Placa',
  'Afuera por Mantenimiento',
  'Piscinas'
];

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
    const response = await fetch(url);
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
    const response = await fetch(url);
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
    const response = await fetch(url);
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
    const response = await fetch(url);
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
    const response = await fetch(url);
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
    const response = await fetch(url);
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

async function fetchMotores(sector = '') {
  try {
    const url = sector ? `${API_BASE}/motores?sector=${encodeURIComponent(sector)}` : `${API_BASE}/motores`;
    const response = await fetch(url);
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
    const response = await fetch(url);
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

  return {
    title: `Resumen del ${sector}`,
    body: `
      <li>Piscinas Activas: <strong>${activas}</strong></li>
      <li>Piscinas Pescadas: <strong>${pescadas}</strong></li>
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
  const contenedor = motores.filter(m => m.estadoMotor === 'Contenedor por Mantenimiento').length;
  const placa = motores.filter(m => m.estadoMotor === 'Placa').length;
  const afuera = motores.filter(m => m.estadoMotor === 'Afuera por Mantenimiento').length;
  const enPiscina = motores.filter(m => m.estadoMotor === 'Piscinas').length;

  return {
    title: `Resumen del ${sector}`,
    body: `
      <li>Total de Motores Registrados: <strong>${total}</strong></li>
      <li>Contenedor por Mantenimiento: <strong>${contenedor}</strong></li>
      <li>Problemas de Placa: <strong>${placa}</strong></li>
      <li>Afuera por Mantenimiento: <strong>${afuera}</strong></li>
      <li>Motores en Piscina: <strong>${enPiscina}</strong></li>
    `
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
    alert('Seleccione un sector para ver el resumen.');
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
  const { title, body } = buildResumenMotoresHTML(sector);
  document.getElementById('motores-resumen-title').textContent = title;
  document.getElementById('motores-resumen-body').innerHTML = body;
}

function showResumenMotoresInline() {
  const sector = document.getElementById('filter-sector-motores').value;
  if (!sector) {
    alert('Seleccione un sector para ver el resumen.');
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
  });
});

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case 'motores': renderMotores(); break;
    case 'piscinas': renderPiscinas(); break;
    case 'inventario': renderEquipos(); break;
    case 'resumen': renderResumen(); break;
    case 'trabajos': renderTrabajos(); break;
    case 'componentes': renderComponentes(); break;
  }
}

function renderComponentes() {
  // Event listeners para los botones de componentes
  const btnRegistro = document.getElementById('btn-registro-componentes');
  const btnInstalacion = document.getElementById('btn-instalacion-componentes');
  const btnResumen = document.getElementById('btn-resumen-componentes');

  if (btnRegistro) {
    btnRegistro.addEventListener('click', () => showComponentesSubsection('registro'));
  }
  if (btnInstalacion) {
    btnInstalacion.addEventListener('click', () => showComponentesSubsection('instalacion'));
  }
  if (btnResumen) {
    btnResumen.addEventListener('click', () => showComponentesSubsection('resumen'));
  }
}

let componentesSubsection = null;

async function showComponentesSubsection(subsection) {
  const sector = document.getElementById('filter-sector-componentes').value;
  if (!sector) {
    alert('Seleccione un sector primero');
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
      <input type="text" id="f-nombre-componente" value="${componente.nombre || ''}" placeholder="Sin espacios">
    </div>
  `;

  document.getElementById('modal-save').onclick = saveComponente;
  document.getElementById('modal-overlay').classList.add('open');
};

async function saveComponente() {
  const sector = document.getElementById('filter-sector-componentes').value;
  const nombre = document.getElementById('f-nombre-componente').value.trim();

  if (!nombre) { alert('Debe ingresar el nombre del componente.'); return; }

  const componente = {
    id: editingId || generateId(),
    sector,
    nombre
  };

  try {
    const url = editingId ? `${API_BASE}/componentes/${editingId}` : `${API_BASE}/componentes`;
    const method = editingId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(componente)
    });
    if (!response.ok) throw new Error('Error al guardar componente');

    closeModal();
    showToast('Datos guardados');
    await showComponentesSubsection('registro');
  } catch (error) {
    console.error('Error saving componente:', error);
    alert('Error al guardar componente. Por favor intente nuevamente.');
  }
}

window.deleteComponente = async function(id) {
  if (!confirm('¿Eliminar este componente?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/componentes/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar componente');
    await showComponentesSubsection('registro');
  } catch (error) {
    console.error('Error deleting componente:', error);
    alert('Error al eliminar componente. Por favor intente nuevamente.');
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
            <input type="text" id="f-tolva-numero" placeholder="Ej: 1" value="${instalacion.tolvaNumero || ''}">
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
            <input type="text" id="f-motor-codigo" placeholder="Escriba para buscar..." value="${instalacion.motorCodigo || ''}" list="motores-list">
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
            <input type="text" id="f-taller-detalles" placeholder="Escriba los detalles..." value="${instalacion.tallerDetalles || ''}">
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
  const sector = document.getElementById('filter-sector-componentes').value;
  const componenteId = document.getElementById('f-componente-id').value;
  const puntoInstalacion = document.getElementById('f-punto-instalacion').value;

  if (!componenteId) { alert('Debe seleccionar un componente.'); return; }
  if (!puntoInstalacion) { alert('Debe seleccionar un punto de instalación.'); return; }

  let piscinaNumero = null;
  let tolvaNumero = null;
  let motorCodigo = null;
  let sf200Zona = null;
  let tallerDetalles = null;

  switch (puntoInstalacion) {
    case 'Tolvas':
      tolvaNumero = document.getElementById('f-tolva-numero').value.trim();
      piscinaNumero = document.getElementById('f-piscina-numero').value;
      if (!tolvaNumero) { alert('Debe ingresar el número de tolva.'); return; }
      if (!piscinaNumero) { alert('Debe seleccionar una piscina.'); return; }
      break;
    case 'Motores AQ1':
      motorCodigo = document.getElementById('f-motor-codigo').value.trim();
      if (!motorCodigo) { alert('Debe seleccionar un código de motor.'); return; }
      // Validar que el código de motor esté registrado
      const motores = await fetchMotores(sector);
      const motorRegistrado = motores.find(m => m.codigo === motorCodigo);
      if (!motorRegistrado) { alert('El código de motor no está registrado. Por favor seleccione un código válido.'); return; }
      break;
    case 'SF200':
      piscinaNumero = document.getElementById('f-piscina-numero').value;
      sf200Zona = document.getElementById('f-sf200-zona').value;
      if (!piscinaNumero) { alert('Debe seleccionar una piscina.'); return; }
      if (!sf200Zona) { alert('Debe seleccionar una zona.'); return; }
      break;
    case 'Torre':
      piscinaNumero = document.getElementById('f-piscina-numero').value;
      if (!piscinaNumero) { alert('Debe seleccionar una piscina.'); return; }
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
    
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(instalacion)
    });
    if (!response.ok) throw new Error('Error al guardar instalación de componente');

    closeModal();
    showToast('Datos guardados');
    await showComponentesSubsection('instalacion');
  } catch (error) {
    console.error('Error saving instalación componente:', error);
    alert('Error al guardar instalación de componente. Por favor intente nuevamente.');
  }
}

window.deleteInstalacionComponente = async function(id) {
  if (!confirm('¿Eliminar esta instalación de componente?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/instalaciones-componentes/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar instalación de componente');
    await showComponentesSubsection('instalacion');
  } catch (error) {
    console.error('Error deleting instalación componente:', error);
    alert('Error al eliminar instalación de componente. Por favor intente nuevamente.');
  }
};

async function renderResumenComponentes(sector) {
  const content = document.getElementById('componentes-content');
  const instalaciones = await fetchInstalacionesComponentes(sector);

  content.innerHTML = `
    <div class="card componentes-subsection">
      <div class="componentes-subsection-header">
        <h3>📊 Resumen de Componentes</h3>
      </div>
      <div class="resumen-componentes-tabs">
        <button class="btn btn-secondary btn-sm" id="btn-resumen-componentes-nombres">Por Nombre</button>
        <button class="btn btn-secondary btn-sm" id="btn-resumen-componentes-puntos">Por Punto de Instalación</button>
      </div>
      <div id="resumen-componentes-content"></div>
    </div>
  `;

  document.getElementById('btn-resumen-componentes-nombres').addEventListener('click', () => renderResumenComponentesPorNombre(instalaciones));
  document.getElementById('btn-resumen-componentes-puntos').addEventListener('click', () => renderResumenComponentesPorPunto(instalaciones));

  // Renderizar resumen inicial por nombre
  renderResumenComponentesPorNombre(instalaciones);
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
      ${Object.keys(agrupado).map((nombre, index) => `
        <div class="resumen-componentes-margen">
          <div class="resumen-componentes-margen-header">Componente ${index + 1}: ${nombre} (${agrupado[nombre].length} registros)</div>
          <ul class="resumen-list">
            ${agrupado[nombre].map(i => `
              <li>
                <span>${i.puntoInstalacion} - ${getDetallesInstalacion(i)} - ${formatDate(i.fechaInstalacion)}</span>
              </li>
            `).join('')}
          </ul>
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
          <ul class="resumen-list">
            ${agrupado[punto].map(i => `
              <li>
                <span>${i.componenteNombre} - ${getDetallesInstalacion(i)} - ${formatDate(i.fechaInstalacion)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  `;
}

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
      alert('Este número de piscina ya existe en el sector. Se cargaron los datos para actualizar.');
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
  const sector = document.getElementById('f-sector').value;
  const numero = document.getElementById('f-numero').value.trim();

  if (!sector) { alert('Debe seleccionar un sector.'); return; }
  if (!numero) { alert('Debe ingresar el número de piscina.'); return; }
  if (!/^\d+$/.test(numero)) { alert('Solo se permiten números.'); return; }

  const existing = findPiscina(sector, numero);
  if (existing && existing.id !== editingId) {
    if (!confirm('Este número ya existe en el sector. ¿Desea actualizar el registro existente?')) return;
    editingId = existing.id;
  }

  const piscina = {
    id: editingId || generateId(),
    sector,
    numero,
    nombre: `${sector} — Piscina ${numero}`
  };

  try {
    const response = await fetch(`${API_BASE}/piscinas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(piscina)
    });
    if (!response.ok) throw new Error('Error al guardar piscina');
    
    closeModal();
    document.getElementById('filter-sector-piscinas').value = sector;
    await renderPiscinas();
  } catch (error) {
    console.error('Error saving piscina:', error);
    alert('Error al guardar piscina. Por favor intente nuevamente.');
  }
}

async function deletePiscina(id) {
  if (!confirm('¿Eliminar esta piscina?')) return;
  try {
    const response = await fetch(`${API_BASE}/piscinas/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar piscina');
    await renderPiscinas();
  } catch (error) {
    console.error('Error deleting piscina:', error);
    alert('Error al eliminar piscina. Por favor intente nuevamente.');
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
    tbody.innerHTML = `<tr><td colspan="2"><div class="empty-state"><div class="icon">🏊</div><p>No hay piscinas en este sector</p></div></td></tr>`;
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

  codigo?.addEventListener('blur', () => {
    if (!codigo.value || codigo.value.length !== 5) return;
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
      alert('Este código ya está registrado. Se cargaron los datos para actualizar.');
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
      <input type="text" inputmode="numeric" id="f-codigo" value="${m.codigo || ''}" maxlength="5" placeholder="00000">
    </div>
    ${editingId ? '<p class="form-note">Modo actualización — el código no se duplicará.</p>' : ''}
  `;
}

async function saveMotor() {
  const sector = document.getElementById('f-sector').value;
  const estadoMotor = document.getElementById('f-estadoMotor').value;
  const codigo = document.getElementById('f-codigo').value.trim();
  const piscinaId = document.getElementById('f-piscinaId')?.value || '';

  if (!sector) { alert('Debe seleccionar un sector.'); return; }
  if (!estadoMotor) { alert('Debe seleccionar el estado del motor.'); return; }
  if (!/^\d{5}$/.test(codigo)) { alert('El código debe tener exactamente 5 dígitos numéricos.'); return; }
  if (estadoMotor === 'Piscinas' && !piscinaId) { alert('Debe seleccionar una piscina.'); return; }

  const existing = findMotorByCodigo(codigo);
  if (existing && existing.id !== editingId) {
    if (!confirm('Este código ya existe. ¿Desea actualizar el registro existente?')) return;
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
    const response = await fetch(`${API_BASE}/motores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(motor)
    });
    if (!response.ok) throw new Error('Error al guardar motor');
    
    closeModal();
    document.getElementById('filter-sector-motores').value = sector;
    await renderMotores();
    if (!document.getElementById('motores-resumen-panel').classList.contains('search-hidden')) {
      refreshResumenMotoresInline();
    }
  } catch (error) {
    console.error('Error saving motor:', error);
    alert('Error al guardar motor. Por favor intente nuevamente.');
  }
}

async function deleteMotor(id) {
  if (!confirm('¿Eliminar este motor?')) return;
  try {
    const response = await fetch(`${API_BASE}/motores/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar motor');
    await renderMotores();
  } catch (error) {
    console.error('Error deleting motor:', error);
    alert('Error al eliminar motor. Por favor intente nuevamente.');
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
    if (!sector?.value || !piscina.value || editingId) return;
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
      alert('Esta piscina ya tiene equipo registrado. Se cargaron los datos para actualizar.');
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
      <input type="text" inputmode="numeric" id="f-tolvas" value="${e.tolvas || ''}" placeholder="Solo números">
    </div>
    <div class="form-group">
      <label>SF200</label>
      <input type="text" id="f-sf200" value="${e.sf200 || ''}" placeholder="Ej: 1.5 (un solo punto)">
    </div>
    <div class="form-group">
      <label>Hidrofos</label>
      <input type="text" inputmode="numeric" id="f-hidrofos" value="${e.hidrofos || ''}" placeholder="Total hidrofonos">
    </div>
    <div class="form-group">
      <label>Motores</label>
      <input type="text" inputmode="numeric" id="f-motores" value="${e.motores || ''}" placeholder="Número de motores">
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
  const sector = document.getElementById('f-sector').value;
  const piscinaId = document.getElementById('f-piscinaId').value;
  const estadoPiscina = document.getElementById('f-estadoPiscina').value;
  const tolvas = document.getElementById('f-tolvas').value.trim();
  const sf200 = document.getElementById('f-sf200').value.trim();
  const hidrofos = document.getElementById('f-hidrofos').value.trim();
  const motores = document.getElementById('f-motores').value.trim();
  const estadoEma = document.getElementById('f-estadoEma').value;

  if (!sector) { alert('Debe seleccionar un sector.'); return; }
  if (!piscinaId) { alert('Debe seleccionar una piscina.'); return; }

  if (tolvas && !/^\d+$/.test(tolvas)) { alert('Tolvas solo acepta números.'); return; }
  if (sf200 && !isValidDecimal(sf200)) { alert('SF200 solo acepta números con un punto (ej: 1.5).'); return; }
  if (hidrofos && !/^\d+$/.test(hidrofos)) { alert('Hidrofos solo acepta números.'); return; }
  if (motores && !/^\d+$/.test(motores)) { alert('Motores solo acepta números.'); return; }

  const existing = findEquipoByPiscina(sector, piscinaId);
  if (existing && existing.id !== editingId) {
    if (!confirm('Esta piscina ya tiene equipo registrado. ¿Desea actualizar el registro existente?')) return;
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
    const response = await fetch(`${API_BASE}/equipos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(equipo)
    });
    if (!response.ok) throw new Error('Error al guardar equipo');
    
    closeModal();
    document.getElementById('filter-sector-equipos').value = sector;
    await renderEquipos();
    if (!document.getElementById('equipos-resumen-panel').classList.contains('search-hidden')) {
      refreshResumenEquiposInline();
    }
  } catch (error) {
    console.error('Error saving equipo:', error);
    alert('Error al guardar equipo. Por favor intente nuevamente.');
  }
}

async function deleteEquipo(id) {
  if (!confirm('¿Eliminar este equipo?')) return;
  try {
    const response = await fetch(`${API_BASE}/equipos/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar equipo');
    await renderEquipos();
  } catch (error) {
    console.error('Error deleting equipo:', error);
    alert('Error al eliminar equipo. Por favor intente nuevamente.');
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
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="icon">📦</div><p>No hay equipos en este sector</p></div></td></tr>`;
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
    const { title: t, body } = buildResumenMotoresHTML(sector);
    title.textContent = t;
    panel.innerHTML = body;
  } else {
    const { title: t, body } = buildResumenEquiposHTML(sector);
    title.textContent = t;
    panel.innerHTML = body;
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

function renderResumen() {
  const tipo = getResumenTipo();
  const sector = getResumenSector();
  const sectorWrap = document.getElementById('resumen-sector-wrap');
  const content = document.getElementById('resumen-general-content');
  const searchMotores = document.getElementById('search-resumen-motores');
  const searchEquipos = document.getElementById('search-resumen-equipos-piscina');

  sectorWrap.classList.toggle('search-hidden', !tipo);

  if (!tipo || !sector) {
    content.classList.add('search-hidden');
    searchMotores.classList.add('search-hidden');
    searchEquipos.classList.add('search-hidden');
    return;
  }

  content.classList.remove('search-hidden');
  searchMotores.classList.toggle('search-hidden', tipo !== 'motores');
  searchEquipos.classList.toggle('search-hidden', tipo !== 'equipos');

  if (tipo === 'equipos') populateResumenPiscinaSearch(sector);
  if (tipo === 'motores') searchMotores.value = '';

  renderResumenGeneralSummary(sector, tipo);
  renderResumenGeneralTable();
}

function exportResumenExcel() {
  const tipo = getResumenTipo();
  const sector = getResumenSector();
  if (!tipo || !sector) {
    alert('Seleccione tipo de inventario y sector.');
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
  document.getElementById('search-resumen-motores').value = '';
  document.getElementById('search-resumen-equipos-piscina').value = '';
  renderResumen();
});
document.getElementById('filter-sector-resumen').addEventListener('change', () => {
  document.getElementById('search-resumen-motores').value = '';
  document.getElementById('search-resumen-equipos-piscina').value = '';
  renderResumen();
});
document.getElementById('search-resumen-motores').addEventListener('input', renderResumenGeneralTable);
restrictNumeric(document.getElementById('search-resumen-motores'), 5);
document.getElementById('search-resumen-equipos-piscina').addEventListener('change', renderResumenGeneralTable);
document.getElementById('btn-export-excel').addEventListener('click', exportResumenExcel);

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

async function showBateriasSubsection(subsection) {
  const sector = document.getElementById('filter-sector-trabajos').value;
  if (!sector) {
    alert('Seleccione un sector primero');
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

  content.innerHTML = `
    <div class="card baterias-subsection">
      <div class="baterias-subsection-header">
        <h3>🔧 Instalaciones de Baterías</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-instalacion-bateria">+ Nueva Instalación</button>
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
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${instalaciones.length === 0 ? '<tr><td colspan="7"><div class="empty-state"><div class="icon">🔧</div><p>No hay instalaciones de baterías</p></div></td></tr>' : 
            instalaciones.map(i => `
              <tr>
                <td><strong>${i.modeloNombre}</strong></td>
                <td>${i.amperaje}A</td>
                <td>${i.loteNombre}</td>
                <td>${i.piscinaNumero}</td>
                <td>${i.tolvaNumero}</td>
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
      <div class="resumen-baterias-container">
        <div class="resumen-baterias-tabs">
          <button class="resumen-baterias-tab active" data-tab="nombres">Por Nombres</button>
          <button class="resumen-baterias-tab" data-tab="lotes">Por Lotes</button>
        </div>
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
  
  // Event listeners para tabs de resumen
  document.querySelectorAll('.resumen-baterias-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.resumen-baterias-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderResumenBaterias(tab.dataset.tab, instalaciones);
    });
  });

  // Renderizar resumen inicial
  renderResumenBaterias('nombres', instalaciones);
}

function renderResumenBaterias(tipo, instalaciones) {
  const content = document.getElementById('resumen-baterias-content');
  
  if (tipo === 'nombres') {
    // Agrupar por nombre de batería
    const agrupado = {};
    instalaciones.forEach(i => {
      if (!agrupado[i.modeloNombre]) {
        agrupado[i.modeloNombre] = [];
      }
      agrupado[i.modeloNombre].push(i);
    });

    content.innerHTML = `
      <div class="resumen-baterias-margenes">
        ${Object.keys(agrupado).map((nombre, index) => `
          <div class="resumen-baterias-margen">
            <div class="resumen-baterias-margen-header">Modelo de Batería ${index + 1}: ${nombre} (${agrupado[nombre].length} registros)</div>
            <ul class="resumen-list">
              ${agrupado[nombre].map(i => `
                <li>
                  <span>Piscina ${i.piscinaNumero} - Tolva ${i.tolvaNumero} - ${formatDate(i.fechaInstalacion)}</span>
                  <span>${i.loteNombre}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    `;
  } else {
    // Agrupar por lote
    const agrupado = {};
    instalaciones.forEach(i => {
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
            <div class="resumen-baterias-margen-header">Lote ${index + 1}: ${loteKey} (${agrupado[loteKey].length} registros)</div>
            <ul class="resumen-list">
              ${agrupado[loteKey].map(i => `
                <li>
                  <span>${i.modeloNombre} (${i.amperaje}A) - Piscina ${i.piscinaNumero} - Tolva ${i.tolvaNumero}</span>
                  <span>${formatDate(i.fechaInstalacion)}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// Modal para modelo de batería
window.openModalModeloBateria = async function(id = null) {
  editingId = id;
  const sector = document.getElementById('filter-sector-trabajos').value;
  
  // Cargar modelos desde API si no están en data
  if (!data.modelosBaterias) {
    data.modelosBaterias = await fetchModelosBaterias(sector);
  }
  
  const modelos = data.modelosBaterias || [];
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
      <input type="text" id="f-nombre" value="${modelo.nombre || ''}" placeholder="Ej: TrojanL16">
    </div>
    <div class="form-group">
      <label>Amperaje * (solo números)</label>
      <input type="text" id="f-amperaje" value="${modelo.amperaje || ''}" placeholder="Ej: 360" inputmode="numeric">
    </div>
  `;

  restrictNumeric(document.getElementById('f-amperaje'));
  document.getElementById('modal-save').onclick = saveModeloBateria;
  document.getElementById('modal-overlay').classList.add('open');
};

async function saveModeloBateria() {
  const sector = document.getElementById('filter-sector-trabajos').value;
  const nombre = document.getElementById('f-nombre').value.trim();
  const amperaje = document.getElementById('f-amperaje').value.trim();

  if (!nombre) { alert('Debe ingresar el nombre de la batería.'); return; }
  if (/\s/.test(nombre)) { alert('El nombre no puede contener espacios.'); return; }
  if (!amperaje) { alert('Debe ingresar el amperaje.'); return; }
  if (!/^\d+$/.test(amperaje)) { alert('El amperaje debe ser un número.'); return; }

  const modelo = {
    id: editingId || generateId(),
    sector,
    nombre,
    amperaje: parseInt(amperaje)
  };

  try {
    const response = await fetch(`${API_BASE}/modelos-baterias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modelo)
    });
    if (!response.ok) throw new Error('Error al guardar modelo de batería');
    
    closeModal();
    await showBateriasSubsection('modelos');
  } catch (error) {
    console.error('Error saving modelo batería:', error);
    alert('Error al guardar modelo de batería. Por favor intente nuevamente.');
  }
}

window.deleteModeloBateria = async function(id) {
  if (!confirm('¿Eliminar este modelo de batería?')) return;
  try {
    const response = await fetch(`${API_BASE}/modelos-baterias/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar modelo de batería');
    await showBateriasSubsection('modelos');
  } catch (error) {
    console.error('Error deleting modelo batería:', error);
    alert('Error al eliminar modelo de batería. Por favor intente nuevamente.');
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
      <input type="text" id="f-nombre-completo" value="${lote.nombre_completo || ''}" placeholder="Ej: LoteA Ab1215/2026">
    </div>
  `;

  document.getElementById('modal-save').onclick = saveLoteBateria;
  document.getElementById('modal-overlay').classList.add('open');
};

async function saveLoteBateria() {
  const sector = document.getElementById('filter-sector-trabajos').value;
  const nombreCompleto = document.getElementById('f-nombre-completo').value.trim();

  if (!nombreCompleto) { alert('Debe ingresar el nombre y número del lote.'); return; }

  const lote = {
    id: editingId || generateId(),
    sector,
    nombre_completo: nombreCompleto
  };

  try {
    const url = editingId ? `${API_BASE}/lotes-baterias/${editingId}` : `${API_BASE}/lotes-baterias`;
    const method = editingId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lote)
    });
    if (!response.ok) throw new Error('Error al guardar lote de batería');

    closeModal();
    showToast('Datos guardados');
    await showBateriasSubsection('lotes');
  } catch (error) {
    console.error('Error saving lote batería:', error);
    alert('Error al guardar lote de batería. Por favor intente nuevamente.');
  }
}

window.deleteLoteBateria = async function(id) {
  if (!confirm('¿Eliminar este lote de batería?')) return;
  try {
    const response = await fetch(`${API_BASE}/lotes-baterias/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar lote de batería');
    await showBateriasSubsection('lotes');
  } catch (error) {
    console.error('Error deleting lote batería:', error);
    alert('Error al eliminar lote de batería. Por favor intente nuevamente.');
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
      <input type="text" id="f-tolva-numero" placeholder="Ej: 1">
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
    modelos.map(m => `<option value="${m.id}">${m.nombre} (${m.amperaje}A)</option>`).join('');

  loteSelect.innerHTML = '<option value="">— Seleccione un lote —</option>' +
    lotes.map(l => `<option value="${l.id}">${l.nombre_completo}</option>`).join('');
}

async function saveInstalacionBateria() {
  const sector = document.getElementById('filter-sector-trabajos').value;
  const modeloBateriaId = document.getElementById('f-modelo-bateria').value;
  const loteBateriaId = document.getElementById('f-lote-bateria').value;
  const piscinaNumero = document.getElementById('f-piscina-numero').value;
  const tolvaNumero = document.getElementById('f-tolva-numero').value.trim();

  if (!modeloBateriaId) { alert('Debe seleccionar un modelo de batería.'); return; }
  if (!loteBateriaId) { alert('Debe seleccionar un lote de batería.'); return; }
  if (!piscinaNumero) { alert('Debe seleccionar una piscina.'); return; }
  if (!tolvaNumero) { alert('Debe ingresar el número de tolva.'); return; }

  const instalacion = {
    id: editingId || generateId(),
    sector,
    modelo_bateria_id: modeloBateriaId,
    lote_bateria_id: loteBateriaId,
    piscina_numero: piscinaNumero,
    tolva_numero: tolvaNumero
  };

  try {
    const url = editingId ? `${API_BASE}/instalaciones-baterias/${editingId}` : `${API_BASE}/instalaciones-baterias`;
    const method = editingId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(instalacion)
    });
    if (!response.ok) throw new Error('Error al guardar instalación de batería');
    
    closeModal();
    showToast('Datos guardados');
    await showBateriasSubsection('instalaciones');
  } catch (error) {
    console.error('Error saving instalación batería:', error);
    alert('Error al guardar instalación de batería. Por favor intente nuevamente.');
  }
}

window.deleteInstalacionBateria = async function(id) {
  if (!confirm('¿Eliminar esta instalación de batería?')) return;
  try {
    const response = await fetch(`${API_BASE}/instalaciones-baterias/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error al eliminar instalación de batería');
    await showBateriasSubsection('instalaciones');
  } catch (error) {
    console.error('Error deleting instalación batería:', error);
    alert('Error al eliminar instalación de batería. Por favor intente nuevamente.');
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
