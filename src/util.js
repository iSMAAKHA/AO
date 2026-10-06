// Utilitaires : dates, montants, nombres en lettres (français).

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const strip = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function monthIndex(name) {
  const n = strip(name);
  return MOIS.map(strip).findIndex(m => m === n || (n.length >= 3 && m.slice(0, 3) === n.slice(0, 3)));
}

export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

export const toISO = d => d.toISOString().slice(0, 10);

export function addDays(iso, n) {
  const d = parseISO(iso);
  if (!d) return '';
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** "2026-08-27" -> "27/08/2026" */
export function fmtDate(iso) {
  const d = parseISO(iso);
  if (!d) return '……/……/………';
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** "2026-08-27" -> "jeudi 27 août 2026" */
export function fmtDateLong(iso) {
  const d = parseISO(iso);
  if (!d) return '……………………';
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export const weekday = iso => { const d = parseISO(iso); return d ? JOURS[d.getUTCDay()] : ''; };

/** "10:00" -> "10H00" */
export function fmtHeure(h) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h || '');
  return m ? `${pad(m[1])}H${m[2]}` : '……H……';
}

/** Jours entre aujourd'hui et la date (négatif si passée). */
export function daysUntil(iso, now = new Date()) {
  const d = parseISO(iso);
  if (!d) return null;
  return Math.round((d.getTime() - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}

/** Parse un montant : "35 000,00", "1.768.800,00", "1 768 800". */
export function parseMoney(s) {
  if (s == null) return null;
  let t = String(s).replace(/[\s ]/g, '').replace(/[^\d.,]/g, '');
  if (!t) return null;
  const lastDot = t.lastIndexOf('.'), lastComma = t.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = Math.max(lastDot, lastComma);
    t = t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1);
  } else if (lastComma >= 0) {
    t = /,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '');
  } else if (lastDot >= 0) {
    t = /\.\d{1,2}$/.test(t) && (t.match(/\./g) || []).length === 1 ? t : t.replace(/\./g, '');
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/** 35000 -> "35 000,00" */
export function fmtMoney(n) {
  if (n == null || n === '' || Number.isNaN(+n)) return '';
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(+n).replace(/[  ]/g, ' ');
}

// ---------- Nombres en lettres ----------
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function below100(n) {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const t = Math.floor(n / 10), u = n % 10;
    return u === 0 ? TENS[t] : TENS[t] + (u === 1 ? ' et un' : '-' + UNITS[u]);
  }
  if (n < 80) return 'soixante' + (n === 71 ? ' et onze' : '-' + UNITS[n - 60]);
  return n === 80 ? 'quatre-vingts' : 'quatre-vingt-' + UNITS[n - 80];
}

// `final` : le groupe termine le nombre -> accords « cents » / « quatre-vingts ».
function below1000(n, final) {
  const c = Math.floor(n / 100), r = n % 100;
  let s = '';
  if (c > 0) s = (c === 1 ? 'cent' : UNITS[c] + ' cent') + (r === 0 && c > 1 && final ? 's' : '');
  if (r > 0) {
    const rest = r === 80 && !final ? 'quatre-vingt' : below100(r);
    s += (s ? ' ' : '') + rest;
  }
  return s;
}

export function intToWords(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zéro';
  const bn = Math.floor(n / 1e9), mn = Math.floor((n % 1e9) / 1e6), th = Math.floor((n % 1e6) / 1000), rest = n % 1000;
  const parts = [];
  if (bn) parts.push(below1000(bn, false) + (bn > 1 ? ' milliards' : ' milliard'));
  if (mn) parts.push(below1000(mn, false) + (mn > 1 ? ' millions' : ' million'));
  if (th) parts.push(th === 1 ? 'mille' : below1000(th, false) + ' mille');
  if (rest) parts.push(below1000(rest, true));
  return parts.join(' ');
}

/** 1768800 -> "Un million sept cent soixante-huit mille huit cents dirhams" */
export function moneyToWords(n, devise = 'dirham') {
  if (n == null || Number.isNaN(+n)) return '';
  const v = Math.round(+n * 100) / 100;
  const dh = Math.floor(v), cts = Math.round((v - dh) * 100);
  let s = `${intToWords(dh)} ${dh >= 1e6 && dh % 1e6 === 0 ? 'de ' : ''}${devise}${dh > 1 ? 's' : ''}`;
  if (cts) s += ` et ${intToWords(cts)} centime${cts > 1 ? 's' : ''}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const pad = (s, n = 2) => String(s).padStart(n, '0');

export const slug = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
