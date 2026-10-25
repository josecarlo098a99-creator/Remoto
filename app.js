'use strict';

var ws = null;
var ip = '';
var token = '';
var estadoEl = document.getElementById('estado');
var ipEl = document.getElementById('ip');

function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) {} }
function leer(clave) { try { return localStorage.getItem(clave) || ''; } catch (e) { return ''; } }

function estado(texto, clase) {
  estadoEl.textContent = texto;
  estadoEl.className = clase || '';
}

function conectar(usar8001) {
  ip = ipEl.value.trim();
  if (!ip) { estado('Escribe la IP de la TV', 'mal'); return; }
  guardar('tv_ip', ip);
  token = leer('tv_token_' + ip);

  if (ws) { try { ws.close(); } catch (e) {} ws = null; }

  var nombre = btoa('Remoto Daniel');
  var url = usar8001 === true
    ? 'ws://' + ip + ':8001/api/v2/channels/samsung.remote.control?name=' + nombre
    : 'wss://' + ip + ':8002/api/v2/channels/samsung.remote.control?name=' + nombre + (token ? '&token=' + token : '');

  estado('Conectando… mira la TV y acepta si pregunta');

  var socket;
  try { socket = new WebSocket(url); }
  catch (e) { estado('Error: ' + e.message, 'mal'); return; }
  ws = socket;

  var abrio = false;

  socket.onopen = function () { abrio = true; };

  socket.onmessage = function (m) {
    var d;
    try { d = JSON.parse(m.data); } catch (e) { return; }
    if (d.event === 'ms.channel.connect') {
      if (d.data && d.data.token) { token = d.data.token; guardar('tv_token_' + ip, token); }
      estado('Conectado ✔', 'ok');
    } else if (d.event === 'ms.channel.timeOut' || d.event === 'ms.error') {
      estado('La TV no autorizó. Intenta de nuevo y acepta en la TV.', 'mal');
    }
  };

  socket.onclose = function () {
    if (socket !== ws) return;
    if (abrio) {
      estado('Desconectado', 'mal');
    } else if (usar8001 !== true && location.protocol !== 'https:') {
      estado('Probando puerto 8001…');
      conectar(true);
    } else {
      estado('No se pudo conectar. Revisa la IP, que la TV esté encendida y en el mismo Wi-Fi. Toca el botón 1️⃣ para autorizar.', 'mal');
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
  if (!ws || ws.readyState !== 1) { estado('No estás conectado', 'mal'); return; }
  ws.send(JSON.stringify({
    method: 'ms.remote.control',
    params: { Cmd: 'Click', DataOfCmd: tecla, Option: 'false', TypeOfRemote: 'SendRemoteKey' }
  }));
  if (navigator.vibrate) navigator.vibrate(15);
}

document.getElementById('btnConectar').addEventListener('click', function () { conectar(false); });
document.getElementById('cert').addEventListener('click', autorizar);
document.querySelectorAll('[data-key]').forEach(function (b) {
  b.addEventListener('click', function () { enviarTecla(b.getAttribute('data-key')); });
});

ipEl.value = leer('tv_ip');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
