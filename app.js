'use strict';

var ws = null;
var ip = '';
var token = '';
var conectado = false;
var estadoEl = document.getElementById('estado');
var ipEl = document.getElementById('ip');

function guardar(c, v) { try { localStorage.setItem(c, v); } catch (e) {} }
function leer(c) { try { return localStorage.getItem(c) || ''; } catch (e) { return ''; } }

function estado(texto, clase) {
  estadoEl.textContent = texto;
  estadoEl.className = clase || '';
}

function conectar(usar8001) {
  ip = ipEl.value.trim();
  if (!ip) { estado('Escribe la IP de la TV', 'mal'); return; }
  guardar('tv_ip', ip);
  token = leer('tv_token_' + ip);
  conectado = false;

  if (ws) { try { ws.close(); } catch (e) {} ws = null; }

  var nombre = btoa('Remoto Daniel');
  var url = usar8001 === true
    ? 'ws://' + ip + ':8001/api/v2/channels/samsung.remote.control?name=' + nombre
    : 'wss://' + ip + ':8002/api/v2/channels/samsung.remote.control?name=' + nombre + (token ? '&token=' + token : '');

  estado('Conectando a ' + (usar8001 === true ? '8001' : '8002') + '… mira la TV y acepta el permiso');

  var socket;
  try { socket = new WebSocket(url); }
  catch (e) { estado('Error: ' + e.message, 'mal'); return; }
  ws = socket;

  var abrio = false;
  var ultimoMensaje = '';

  socket.onopen = function () {
    abrio = true;
    estado('Abierto. Acepta el permiso en la TV…');
  };

  socket.onmessage = function (m) {
    var d;
    try { d = JSON.parse(m.data); } catch (e) { return; }
    ultimoMensaje = d.event || '';
    if (d.event === 'ms.channel.connect') {
      conectado = true;
      if (d.data && d.data.token) { token = d.data.token; guardar('tv_token_' + ip, token); }
      estado('Conectado ✔', 'ok');
    } else if (d.event === 'ms.channel.unauthorized') {
      estado('La TV NO te dio permiso. Revisa Lista de dispositivos en la TV (Denegado) y vuelve a intentar.', 'mal');
    } else if (d.event === 'ms.channel.timeOut') {
      estado('Se acabó el tiempo. Toca Conectar y acepta rápido en la TV.', 'mal');
    } else if (d.event === 'ms.error') {
      estado('Error de la TV: ' + (d.data && d.data.message ? d.data.message : ''), 'mal');
    }
  };

  socket.onclose = function (ev) {
    if (socket !== ws) return;
    conectado = false;
    if (abrio) {
      if (ultimoMensaje === 'ms.channel.unauthorized' || ultimoMensaje === 'ms.channel.timeOut' || ultimoMensaje === 'ms.error') return;
      estado('La TV cortó la conexión. Código ' + ev.code + '. Toca Conectar y acepta el permiso en la TV.', 'mal');
    } else if (usar8001 !== true && location.protocol !== 'https:') {
      estado('Probando puerto 8001…');
      conectar(true);
    } else {
      estado('No se pudo conectar. Revisa IP, que la TV esté encendida y en el mismo Wi-Fi. Toca el botón 1️⃣ para autorizar.', 'mal');
    }
  };
}

function autorizar() {
  ip = ipEl.value.trim();
  if (!ip) { estado('Escribe la IP de la TV', 'mal'); return; }
  guardar('tv_ip', ip);
  window.open('https://' + ip + ':8002', '_blank');
  estado('Acepta el aviso de seguridad, vuelve aquí y toca Conectar');
}

function enviarTecla(tecla) {
  if (!ws || ws.readyState !== 1 || !conectado) { estado('No estás conectado', 'mal'); return; }
  ws.send(JSON.stringify({
    method: 'ms.remote.control',
    params: { Cmd: 'Click', DataOfCmd: tecla, Option: 'false', TypeOfRemote: 'SendRemoteKey' }
  }));
  if (navigator.vibrate) navigator.vibrate(15);
}

function enviarTexto(t) {
  if (!ws || ws.readyState !== 1 || !conectado) { estado('No estás conectado', 'mal'); return; }
  ws.send(JSON.stringify({
    method: 'ms.remote.control',
    params: { Cmd: btoa(unescape(encodeURIComponent(t))), DataOfCmd: 'base64', TypeOfRemote: 'SendInputString' }
  }));
}

document.getElementById('btnConectar').addEventListener('click', function () { conectar(false); });
document.getElementById('cert').addEventListener('click', autorizar);
document.querySelectorAll('[data-key]').forEach(function (b) {
  b.addEventListener('click', function () { enviarTecla(b.getAttribute('data-key')); });
});

/* ---------- Teclado ---------- */
var textoEl = document.getElementById('texto');
textoEl.addEventListener('input', function () { enviarTexto(textoEl.value); });
document.getElementById('btnEnviar').addEventListener('click', function () {
  enviarTexto(textoEl.value);
  setTimeout(function () { enviarTecla('KEY_ENTER'); }, 400);
});
document.getElementById('btnBorrar').addEventListener('click', function () {
  textoEl.value = '';
  enviarTexto('');
});
document.getElementById('btnEnter').addEventListener('click', function () { enviarTecla('KEY_ENTER'); });

/* ---------- Fondo de imagen ---------- */
function aplicarFondo(src) {
  if (src) {
    document.body.style.backgroundImage = 'url(' + src + ')';
    document.body.classList.add('conFondo');
  } else {
    document.body.style.backgroundImage = 'none';
    document.body.classList.remove('conFondo');
  }
}
aplicarFondo(leer('tv_fondo'));

var archivoEl = document.getElementById('archivoFondo');
document.getElementById('btnFondo').addEventListener('click', function () { archivoEl.click(); });
document.getElementById('btnQuitarFondo').addEventListener('click', function () {
  guardar('tv_fondo', '');
  aplicarFondo('');
});
archivoEl.addEventListener('change', function () {
  var f = archivoEl.files && archivoEl.files[0];
  if (!f) return;
  var lector = new FileReader();
  lector.onload = function () {
    var img = new Image();
    img.onload = function () {
      var max = 1080;
      var esc = Math.min(1, max / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * esc);
      c.height = Math.round(img.height * esc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      var data = c.toDataURL('image/jpeg', 0.8);
      guardar('tv_fondo', data);
      aplicarFondo(data);
    };
    img.src = lector.result;
  };
  lector.readAsDataURL(f);
});

ipEl.value = leer('tv_ip');
