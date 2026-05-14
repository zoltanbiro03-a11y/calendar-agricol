# Calendar Agricol România

Aplicație web (funcționează și pe telefon, instalabilă ca PWA) pentru gestionarea calendarului agricol — pomi, viță, legume, culturi de câmp — cu prognoză meteo Open-Meteo și alerte personalizate.

## Funcționalități

- **Locație**: 41 județe + GPS automat
- **9 categorii** de culturi, ~25 specii cu calendar fenologic real
- **Calendar lunar și anual** cu lucrările grupate pe tip (plantat, stropit, tăieri, fertilizat, cules)
- **Prognoză meteo 7 zile** cu alerte: brumă, ploaie abundentă, vânt puternic, căldură extremă
- **Recomandări de fereastră optimă** pentru stropiri pe baza meteo
- **Funcționează offline** după prima vizită (service worker)
- **Instalabilă pe telefon** (Add to Home Screen)
- **Salvare locală** a setărilor și culturilor selectate

## Deployment pe GitHub Pages

### Pas 1 — Creează repository

1. Du-te pe [github.com/new](https://github.com/new)
2. Numele: `calendar-agricol` (sau ce vrei)
3. Public, fără README/gitignore (le avem deja)
4. Click **Create repository**

### Pas 2 — Pune codul în repo

Deschide un terminal în folderul `calendar-agricol/` și rulează (înlocuiește `USERUL-TAU`):

```bash
git init
git add .
git commit -m "Initial commit — calendar agricol"
git branch -M main
git remote add origin https://github.com/USERUL-TAU/calendar-agricol.git
git push -u origin main
```

### Pas 3 — Activează GitHub Pages

1. Pe pagina repo-ului → **Settings** → **Pages** (în meniul stânga)
2. Source: **Deploy from a branch**
3. Branch: **main** / folder: **/ (root)** → **Save**
4. După 1-2 minute, aplicația e live la:
   `https://USERUL-TAU.github.io/calendar-agricol/`

### Pas 4 — Instalează pe telefon

Pe Android (Chrome) sau iPhone (Safari):
- Deschide URL-ul
- Meniu (⋮ sau ⎘) → **Adaugă la ecran principal** / **Add to Home Screen**
- Aplicația apare cu iconiță proprie, fără bara de browser

## Structura fișierelor

```
calendar-agricol/
├── index.html         # UI principal
├── app.js             # Logică (locație, meteo, calendar, render)
├── manifest.json      # PWA manifest
├── sw.js              # Service worker (offline)
├── data/
│   ├── judete.json    # 41 județe + coordonate + zone climatice
│   └── culturi.json   # Baza de date culturi + lucrări fenologice
├── icons/
│   └── icon.svg       # Iconiță aplicație
└── README.md
```

## Cum adaugi noi culturi

Editezi `data/culturi.json` → adaugi o intrare în `culturi[]`:

```json
{
  "id": "id_unic",
  "nume": "Numele culturii",
  "categorie": "pomi",
  "icon": "🍎",
  "lucrari": [
    {
      "tip": "stropit",
      "luna_start": 4,
      "luna_end": 5,
      "titlu": "Titlu scurt",
      "descriere": "Detalii lucrare",
      "conditii": "Condiții meteo necesare"
    }
  ]
}
```

Tipuri valide: `plantat`, `stropit`, `taieri`, `fertilizat`, `lucrare_sol`, `cules`, `altele`.

## Sursa datelor

- **Meteo**: [Open-Meteo](https://open-meteo.com) — API public, gratuit, fără chei.
- **Calendar agronomic**: compilat din practici uzuale pentru România (zone climatice II-III). Calendarul este informativ — adaptați-l la fenofazele reale ale plantelor și la condițiile locale.

## Limitări

- Datele despre tratamente sunt orientative; respectați etichetele produselor și timpii de pauză.
- Calendarul nu calculează încă suma temperaturilor efective (GDD) — următoarea versiune.
- Nu include monitorizare boli prin observare (necesar inspecția vizuală a culturilor).

## Licență

Liberă pentru uz personal și comercial.
