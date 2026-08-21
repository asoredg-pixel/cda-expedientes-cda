const fs = require('fs');
const p = 'D:/GitHub/cda-expedientes/index.html';
let s = fs.readFileSync(p, 'utf8');
const from = 'js/gmail.js?v=20260811j';
const to = 'js/gmail.js?v=20260821d';
if (!s.includes(from)) {
  const m = s.match(/gmail\.js\?v=[^"]+/);
  console.error('version not found', m && m[0]);
  process.exit(1);
}
s = s.split(from).join(to);
fs.writeFileSync(p, s, 'utf8');
console.log('bumped ok');
fs.writeFileSync(
  'D:/GitHub/cda-expedientes/.commitmsg.tmp',
  'fix: responsable puede conectar Drive/Gmail con el correo de ingreso\n\nLa validacion remapeaba responsables a NCA y exigia el correo del encargado; ahora solo exige coincidir con el email de la sesion.\n',
  'utf8'
);
