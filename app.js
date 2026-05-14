// Calendar Agricol România — logică aplicație
// Date: Open-Meteo (gratuit, fără API key)

const STATE = {
  judete: [],
  zone_offset: {},
  culturi: [],
  categorii: [],
  tipuri_lucrari: {},
  locatie: null, // {lat, lon, nume, zona}
  selectate: new Set(),
  meteo: null,
  vedere: 'luna', // 'luna' | 'tot'
  luna_activa: new Date().getMonth() + 1,
  setari: { bio: false, notif: false }
};

const LUNI = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const LUNI_SCURT = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Noi','Dec'];

// ---------- Persistență localStorage ----------
function salveaza() {
  localStorage.setItem('calagri', JSON.stringify({
    locatie: STATE.locatie,
    selectate: [...STATE.selectate],
    setari: STATE.setari
  }));
}
function incarca() {
  try {
    const d = JSON.parse(localStorage.getItem('calagri') || '{}');
    if (d.locatie) STATE.locatie = d.locatie;
    if (d.selectate) STATE.selectate = new Set(d.selectate);
    if (d.setari) STATE.setari = { ...STATE.setari, ...d.setari };
  } catch(e) {}
}

// ---------- Încărcare date ----------
async function incarcaDate() {
  const [j, c] = await Promise.all([
    fetch('data/judete.json').then(r => r.json()),
    fetch('data/culturi.json').then(r => r.json())
  ]);
  STATE.judete = j.judete;
  STATE.zone_offset = j.zone_offset_zile;
  STATE.culturi = c.culturi;
  STATE.categorii = c.categorii;
  STATE.tipuri_lucrari = c.tipuri_lucrari;
}

// ---------- UI: județe ----------
function populeazaJudete() {
  const sel = document.getElementById('select-judet');
  STATE.judete.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.cod;
    opt.textContent = `${j.nume} (${j.oras})`;
    sel.appendChild(opt);
  });
  if (STATE.locatie && STATE.locatie.cod) sel.value = STATE.locatie.cod;
  sel.addEventListener('change', e => {
    const j = STATE.judete.find(x => x.cod === e.target.value);
    if (j) setLocatie({ cod: j.cod, lat: j.lat, lon: j.lon, nume: `${j.nume} — ${j.oras}`, zona: j.zona });
  });
}

function setLocatie(loc) {
  STATE.locatie = loc;
  document.getElementById('locatie-info').textContent = `📍 ${loc.nume} (lat ${loc.lat.toFixed(2)}, lon ${loc.lon.toFixed(2)})`;
  document.getElementById('locatie-info').classList.remove('hidden');
  salveaza();
  incarcaMeteo();
  rendCalendar();
}

// ---------- GPS ----------
document.getElementById('btn-gps').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('GPS-ul nu e disponibil.');
  const btn = document.getElementById('btn-gps');
  btn.textContent = '📡 Se caută locația...';
  navigator.geolocation.getCurrentPosition(
    p => {
      const { latitude: lat, longitude: lon } = p.coords;
      const cel_mai_apropiat = STATE.judete.reduce((best, j) => {
        const d = Math.hypot(j.lat - lat, j.lon - lon);
        return (!best || d < best.d) ? { j, d } : best;
      }, null);
      const j = cel_mai_apropiat.j;
      setLocatie({ cod: j.cod, lat, lon, nume: `Lângă ${j.nume} (${j.oras})`, zona: j.zona });
      document.getElementById('select-judet').value = j.cod;
      btn.textContent = '📡 Folosește GPS-ul telefonului';
    },
    err => {
      alert('Nu am putut obține locația: ' + err.message);
      btn.textContent = '📡 Folosește GPS-ul telefonului';
    },
    { enableHighAccuracy: false, timeout: 10000 }
  );
});

// ---------- UI: categorii și culturi ----------
function rendCategorii() {
  const cont = document.getElementById('categorii-list');
  cont.innerHTML = '';
  STATE.categorii.forEach(cat => {
    const culturi_cat = STATE.culturi.filter(c => c.categorie === cat.id);
    if (!culturi_cat.length) return;
    const det = document.createElement('details');
    const sel_in_cat = culturi_cat.filter(c => STATE.selectate.has(c.id)).length;
    if (sel_in_cat > 0) det.open = true;
    det.className = 'border border-gray-200 rounded-lg overflow-hidden';
    det.innerHTML = `
      <summary class="p-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between">
        <span class="font-medium flex items-center gap-2"><span class="chevron">▶</span> ${cat.icon} ${cat.nume}</span>
        <span class="text-xs text-primary-700 font-semibold">${sel_in_cat ? sel_in_cat + ' bifate' : ''}</span>
      </summary>
      <div class="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        ${culturi_cat.map(c => `
          <label class="flex items-center gap-2 p-2 rounded hover:bg-primary-50 cursor-pointer ${STATE.selectate.has(c.id) ? 'bg-primary-50' : ''}">
            <input type="checkbox" data-id="${c.id}" ${STATE.selectate.has(c.id) ? 'checked' : ''} class="w-4 h-4 accent-primary-600 cultura-cb">
            <span class="text-sm">${c.icon} ${c.nume}</span>
          </label>
        `).join('')}
      </div>
    `;
    cont.appendChild(det);
  });
  document.querySelectorAll('.cultura-cb').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = e.target.dataset.id;
      if (e.target.checked) STATE.selectate.add(id);
      else STATE.selectate.delete(id);
      salveaza();
      actualizeazaContor();
      rendCategorii();
      rendCalendar();
    });
  });
  actualizeazaContor();
}

function actualizeazaContor() {
  const n = STATE.selectate.size;
  document.getElementById('contor-culturi').textContent = n ? `✓ ${n} culturi selectate` : '';
}

document.getElementById('btn-selectie-toate').addEventListener('click', () => {
  STATE.culturi.forEach(c => STATE.selectate.add(c.id));
  salveaza(); rendCategorii(); rendCalendar();
});
document.getElementById('btn-deselectie-toate').addEventListener('click', () => {
  STATE.selectate.clear();
  salveaza(); rendCategorii(); rendCalendar();
});

// ---------- Meteo (Open-Meteo) ----------
async function incarcaMeteo() {
  if (!STATE.locatie) return;
  const sec = document.getElementById('sectiune-meteo');
  sec.classList.remove('hidden');
  document.getElementById('meteo-loading').textContent = 'Se încarcă prognoza...';
  document.getElementById('meteo-grid').innerHTML = '';

  const { lat, lon } = STATE.locatie;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weathercode` +
    `&timezone=Europe%2FBucharest&forecast_days=7`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    STATE.meteo = d.daily;
    rendMeteo();
    rendAlerteMeteo();
  } catch(e) {
    document.getElementById('meteo-loading').textContent = '⚠️ Nu pot încărca meteo. Verifică internet.';
  }
}

function codMeteoIcon(c) {
  if (c === 0) return '☀️';
  if (c <= 3) return '⛅';
  if (c <= 48) return '🌫️';
  if (c <= 67) return '🌧️';
  if (c <= 77) return '🌨️';
  if (c <= 82) return '🌦️';
  if (c <= 86) return '❄️';
  return '⛈️';
}

function rendMeteo() {
  const g = document.getElementById('meteo-grid');
  document.getElementById('meteo-loading').textContent = '';
  const d = STATE.meteo;
  g.innerHTML = d.time.map((t, i) => {
    const data = new Date(t);
    const zi = ['Dum','Lun','Mar','Mie','Joi','Vin','Sâm'][data.getDay()];
    return `
      <div class="bg-gradient-to-b from-sky-50 to-white border border-sky-100 rounded-lg p-2 text-center">
        <div class="text-xs font-medium text-gray-600">${zi} ${data.getDate()}/${data.getMonth()+1}</div>
        <div class="text-3xl my-1">${codMeteoIcon(d.weathercode[i])}</div>
        <div class="text-sm"><span class="font-semibold text-red-600">${Math.round(d.temperature_2m_max[i])}°</span> / <span class="text-blue-600">${Math.round(d.temperature_2m_min[i])}°</span></div>
        <div class="text-xs text-blue-700 mt-0.5">💧 ${d.precipitation_sum[i].toFixed(1)}mm</div>
        <div class="text-xs text-gray-500">💨 ${Math.round(d.wind_speed_10m_max[i])} km/h</div>
      </div>
    `;
  }).join('');
}

function rendAlerteMeteo() {
  const cont = document.getElementById('alerte-meteo');
  const al = [];
  const d = STATE.meteo;
  for (let i = 0; i < d.time.length; i++) {
    const data = new Date(d.time[i]);
    const dataStr = `${data.getDate()} ${LUNI_SCURT[data.getMonth()]}`;
    if (d.temperature_2m_min[i] <= 0) {
      al.push({ nivel: 'rosu', text: `🥶 <b>${dataStr}</b>: ger / brumă (min ${d.temperature_2m_min[i].toFixed(1)}°C) — protejează plantele sensibile (roșii, ardei, busuioc, floare).` });
    } else if (d.temperature_2m_min[i] <= 3) {
      al.push({ nivel: 'galben', text: `❄️ <b>${dataStr}</b>: risc brumă (min ${d.temperature_2m_min[i].toFixed(1)}°C) — atenție la culturi proaspăt plantate.` });
    }
    if (d.precipitation_sum[i] >= 10) {
      al.push({ nivel: 'galben', text: `🌧️ <b>${dataStr}</b>: ploaie abundentă (${d.precipitation_sum[i].toFixed(0)}mm) — AMÂNĂ stropirile programate.` });
    }
    if (d.wind_speed_10m_max[i] >= 30) {
      al.push({ nivel: 'galben', text: `💨 <b>${dataStr}</b>: vânt puternic (${Math.round(d.wind_speed_10m_max[i])} km/h) — fără stropiri (deviere produs).` });
    }
    if (d.temperature_2m_max[i] >= 32) {
      al.push({ nivel: 'galben', text: `🔥 <b>${dataStr}</b>: căldură mare (${Math.round(d.temperature_2m_max[i])}°C) — udare seara, fără stropiri la prânz.` });
    }
  }
  if (!al.length) {
    cont.innerHTML = `<div class="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-sm">✅ Săptămâna arată stabilă pentru lucrările agricole.</div>`;
    return;
  }
  const culori = { rosu: 'bg-red-50 border-red-200 text-red-800', galben: 'bg-amber-50 border-amber-200 text-amber-800' };
  cont.innerHTML = al.map(a => `<div class="border ${culori[a.nivel]} p-3 rounded-lg text-sm">${a.text}</div>`).join('');
}

// ---------- Calendar lucrări ----------
function ajusteazaLunaPentruZona(luna_start, luna_end) {
  // Aplică offset de zile pe baza zonei, convertit aproximativ la luni
  if (!STATE.locatie) return { start: luna_start, end: luna_end };
  const offset_zile = STATE.zone_offset[STATE.locatie.zona] || 0;
  // Conversie aproximativă: 15 zile = 0.5 lună, dar păstrăm întreaga lună
  // (nu reîmpărțim — am preferat să afișăm nota de zonă în UI)
  return { start: luna_start, end: luna_end };
}

function lucrariPentruLuna(luna) {
  const out = [];
  STATE.selectate.forEach(id => {
    const c = STATE.culturi.find(x => x.id === id);
    if (!c) return;
    c.lucrari.forEach(l => {
      const { start, end } = ajusteazaLunaPentruZona(l.luna_start, l.luna_end);
      const inInterval = (start <= end) ? (luna >= start && luna <= end) : (luna >= start || luna <= end);
      if (inInterval) {
        out.push({ cultura: c, lucrare: l });
      }
    });
  });
  return out;
}

function recomandareMeteoLucrare(tip) {
  // Verifică prognoza 3 zile pentru a recomanda fereastra optimă pentru stropit
  if (!STATE.meteo || tip !== 'stropit') return null;
  const d = STATE.meteo;
  for (let i = 0; i < Math.min(5, d.time.length); i++) {
    const ploaie = d.precipitation_sum[i] || 0;
    const ploaie_urmatoarea = (i+1 < d.time.length) ? d.precipitation_sum[i+1] : 0;
    const vant = d.wind_speed_10m_max[i] || 0;
    const t_max = d.temperature_2m_max[i] || 0;
    const t_min = d.temperature_2m_min[i] || 0;
    if (ploaie < 1 && ploaie_urmatoarea < 5 && vant < 25 && t_max < 28 && t_min > 5) {
      const data = new Date(d.time[i]);
      return `✅ Fereastră bună de stropit: <b>${data.getDate()} ${LUNI_SCURT[data.getMonth()]}</b> (uscat, vânt slab)`;
    }
  }
  return '⚠️ În următoarele 5 zile nu e fereastră ideală de stropit (ploaie/vânt). Monitorizează.';
}

function rendCalendar() {
  const sec = document.getElementById('sectiune-calendar');
  const empty = document.getElementById('empty-state');
  if (!STATE.locatie || STATE.selectate.size === 0) {
    sec.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  sec.classList.remove('hidden');

  // Lunar tabs
  const tabs = document.getElementById('luna-tabs');
  tabs.innerHTML = LUNI.map((nume, i) => {
    const luna = i + 1;
    const count = lucrariPentruLuna(luna).length;
    const active = STATE.vedere === 'luna' && luna === STATE.luna_activa;
    return `<button class="luna-tab ${active ? 'active' : 'bg-gray-100 hover:bg-gray-200'} px-3 py-1.5 rounded text-sm whitespace-nowrap" data-luna="${luna}">
      ${LUNI_SCURT[i]} ${count ? `<span class="ml-1 ${active ? 'bg-white/30':'bg-primary-600 text-white'} text-xs px-1.5 py-0.5 rounded-full">${count}</span>` : ''}
    </button>`;
  }).join('');
  tabs.querySelectorAll('.luna-tab').forEach(b => {
    b.addEventListener('click', () => {
      STATE.luna_activa = +b.dataset.luna;
      STATE.vedere = 'luna';
      document.getElementById('btn-vedere-luna').className = 'text-sm bg-primary-600 text-white px-3 py-1.5 rounded';
      document.getElementById('btn-vedere-tot').className = 'text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded';
      rendCalendar();
    });
  });

  const cont = document.getElementById('calendar-continut');
  if (STATE.vedere === 'luna') {
    cont.innerHTML = randCalendarLuna(STATE.luna_activa);
  } else {
    cont.innerHTML = LUNI.map((_, i) => {
      const luna = i + 1;
      const lucrari = lucrariPentruLuna(luna);
      if (!lucrari.length) return '';
      return `<details class="mb-3" ${luna === (new Date().getMonth()+1) ? 'open' : ''}>
        <summary class="font-semibold text-primary-800 p-2 bg-primary-50 rounded flex items-center gap-2">
          <span class="chevron">▶</span> ${LUNI[i]} <span class="text-xs text-gray-600 font-normal">(${lucrari.length} lucrări)</span>
        </summary>
        <div class="mt-2">${randLucrari(lucrari)}</div>
      </details>`;
    }).join('') || '<p class="text-gray-500 text-center py-6">Nu există lucrări programate pentru culturile selectate.</p>';
  }
}

function randCalendarLuna(luna) {
  const lucrari = lucrariPentruLuna(luna);
  if (!lucrari.length) {
    return `<div class="text-center py-8 text-gray-500">
      <div class="text-4xl mb-2">📭</div>
      <p>Nicio lucrare programată în <b>${LUNI[luna-1]}</b> pentru culturile selectate.</p>
    </div>`;
  }
  const nota_zona = STATE.locatie ? noteZona() : '';
  return nota_zona + randLucrari(lucrari);
}

function noteZona() {
  const offset = STATE.zone_offset[STATE.locatie.zona] || 0;
  if (offset === 0) return '';
  const sens = offset > 0 ? 'mai târziu' : 'mai devreme';
  return `<div class="bg-blue-50 border border-blue-200 text-blue-800 p-2 rounded text-xs mb-3">
    💡 Pentru zona <b>${STATE.locatie.zona}</b>, lucrările se aplică cu cca <b>${Math.abs(offset)} zile ${sens}</b> față de calendar — verifică fenofazele reale.
  </div>`;
}

function randLucrari(lucrari) {
  // Grupare după tip
  const ordine = ['plantat','taieri','stropit','fertilizat','lucrare_sol','cules','altele'];
  const grupate = {};
  lucrari.forEach(x => {
    const t = x.lucrare.tip;
    if (!grupate[t]) grupate[t] = [];
    grupate[t].push(x);
  });
  return ordine.filter(t => grupate[t]).map(t => {
    const info = STATE.tipuri_lucrari[t] || { culoare:'#666', icon:'📌' };
    return `<div class="mb-4">
      <h4 class="text-sm font-semibold mb-2 flex items-center gap-2" style="color:${info.culoare}">
        <span>${info.icon}</span> ${etichetaTip(t)} <span class="text-xs text-gray-500 font-normal">(${grupate[t].length})</span>
      </h4>
      <div class="grid sm:grid-cols-2 gap-2">
        ${grupate[t].map(x => randCardLucrare(x.cultura, x.lucrare, info)).join('')}
      </div>
    </div>`;
  }).join('');
}

function etichetaTip(t) {
  return ({
    plantat: 'Plantat / Semănat',
    taieri: 'Tăieri',
    stropit: 'Stropit / Tratamente',
    fertilizat: 'Fertilizare',
    lucrare_sol: 'Lucrări sol',
    cules: 'Cules / Recoltă',
    altele: 'Alte lucrări'
  })[t] || t;
}

function randCardLucrare(c, l, info) {
  const rec = recomandareMeteoLucrare(l.tip);
  return `<div class="lucrare-card border-l-4 p-3 rounded-lg bg-white border border-gray-200 shadow-sm" style="border-left-color:${info.culoare}">
    <div class="flex items-start justify-between gap-2 mb-1">
      <div class="font-medium text-sm">${c.icon} ${c.nume} — ${l.titlu}</div>
    </div>
    <p class="text-xs text-gray-700 leading-snug mb-1">${l.descriere}</p>
    ${l.conditii ? `<p class="text-xs text-gray-500 italic">📋 ${l.conditii}</p>` : ''}
    ${rec ? `<p class="text-xs text-primary-700 mt-1.5 bg-primary-50 p-1.5 rounded">${rec}</p>` : ''}
  </div>`;
}

document.getElementById('btn-vedere-luna').addEventListener('click', e => {
  STATE.vedere = 'luna';
  e.target.className = 'text-sm bg-primary-600 text-white px-3 py-1.5 rounded';
  document.getElementById('btn-vedere-tot').className = 'text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded';
  rendCalendar();
});
document.getElementById('btn-vedere-tot').addEventListener('click', e => {
  STATE.vedere = 'tot';
  e.target.className = 'text-sm bg-primary-600 text-white px-3 py-1.5 rounded';
  document.getElementById('btn-vedere-luna').className = 'text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded';
  rendCalendar();
});

// ---------- Setări ----------
document.getElementById('btn-setari').addEventListener('click', () => {
  document.getElementById('set-bio').checked = STATE.setari.bio;
  document.getElementById('set-notif').checked = STATE.setari.notif;
  document.getElementById('modal-setari').classList.remove('hidden');
  document.getElementById('modal-setari').classList.add('flex');
});
document.getElementById('set-bio').addEventListener('change', e => { STATE.setari.bio = e.target.checked; salveaza(); });
document.getElementById('set-notif').addEventListener('change', e => {
  STATE.setari.notif = e.target.checked;
  if (e.target.checked && 'Notification' in window) Notification.requestPermission();
  salveaza();
});
document.getElementById('btn-reset').addEventListener('click', () => {
  if (confirm('Sigur ștergi toate datele salvate?')) {
    localStorage.removeItem('calagri');
    location.reload();
  }
});

// ---------- Inițializare ----------
(async function init() {
  incarca();
  await incarcaDate();
  populeazaJudete();
  rendCategorii();
  if (STATE.locatie) {
    document.getElementById('locatie-info').textContent = `📍 ${STATE.locatie.nume}`;
    document.getElementById('locatie-info').classList.remove('hidden');
    incarcaMeteo();
  }
  STATE.luna_activa = new Date().getMonth() + 1;
  rendCalendar();
})();
