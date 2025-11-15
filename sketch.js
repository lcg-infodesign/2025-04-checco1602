//visione di dettaglio della mappa dei vulcani :)

/* ---------------- CONFIG ---------------- */
const csvFile = "volcanoes-2025-10-27 - Es.3 - Original Data.csv";
const mapImageFile = "world.svg";

const panelFrac = 0.25;      // 25% width per pannello destro
const dotBaseSize = 10;      // dimensione base dei punti (più grandi)
const hoverRadiusFactor = 1.4;

const colorLow  = [255, 171, 64];  // colore per elev minima
const colorHigh = [214,  51,132];  // colore per elev massima

// header / footer layout (header rimane in alto)
const headerHeight = 110;   // spazio visuale per header (css creato qui)
const footerHeight = 0;     // non usiamo footer (metti 0)

/* ---------------- CSV header candidates ---------------- */
const latCandidates = ["Latitude", "Lat", "latitude", "lat"];
const lonCandidates = ["Longitude", "Lon", "longitude", "lon"];
const elevCandidates = ["Elevation", "Elevation (m)", "elevation", "Elev", "elev", "Height"];
const nameCandidates = ["Volcano Name", "Volcano", "Name", "volcano name"];
const countryCandidates = ["Country", "country"];
const locationCandidates = ["Location", "location"];
const typeCandidates = ["Type", "type"];
const typeCatCandidates = ["TypeCategory", "Type Category", "Type_Category", "typecategory"];
const statusCandidates = ["Status", "status"];
const eruptionCandidates = ["Last Known Eruption", "Last Known Eruption (Year)", "Last Known Eruption Year", "Last Known Eruption (year)", "Last Eruption", "Last Known", "Last known eruption"];

/* ---------------- GLOBAL ---------------- */
let table = null;
let mapImg = null;
let points = []; // {lat,lon,elev,x,y,fields}
let minElev = Infinity, maxElev = -Infinity;

// left canvas image placement (calcolato rispetto al canvas left)
let imgX = 0, imgY = 0, imgW = 0, imgH = 0, imgAspect = 2;

// p5 canvas dimensioni: leftWidth x canvasHeight
let leftWidth = 0;
let canvasHeight = 0;

// DOM elements
let headerEl = null;
let tooltipEl = null;
let rightPanel = null;
let glyphCanvas = null;
let glyphCtx = null;

// selection
let selectedPoint = null;
let hoverPoint = null;

// smoke animation loop handle
let smokeAnimReq = null;

/* ---------------- INI: inietto CSS + header + right panel skeleton ---------------- */
(function initDOM() {
  // base styles + Inter
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    html,body{height:100%;margin:0}
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#fff;color:#111}
    /* header top-left */
    #vw-header{position:fixed;left:18px;top:12px;z-index:2000;background:rgba(255,255,255,0.95);padding:12px 14px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.08);max-width:420px;border:1px solid rgba(0,0,0,0.04);backdrop-filter: blur(3px)}
    #vw-header h1{margin:0 0 6px 0;font-size:18px;letter-spacing:0.06em;text-transform:uppercase}
    #vw-header p.desc{margin:0;font-size:13px;color:#4b4b4b;line-height:1.3}
    /* legend under ticks */
    .vw-legend{margin-top:10px;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
    .vw-legend .ticks{display:flex;justify-content:space-between;font-size:12px;color:#444;width:170px}
    .vw-legend .bar{width:170px;height:12px;border-radius:8px;border:1px solid rgba(0,0,0,0.04);background:linear-gradient(90deg, rgb(${colorLow[0]},${colorLow[1]},${colorLow[2]}), rgb(${colorHigh[0]},${colorHigh[1]},${colorHigh[2]}))}
    /* tooltip */
    #vw-tooltip{position:fixed;z-index:3000;pointer-events:none;background:rgba(0,0,0,0.78);color:#fff;padding:6px 8px;font-size:13px;border-radius:6px;transform:translate(-50%,-120%);white-space:nowrap;display:none}
    /* layout: containers to keep right panel outside canvas */
    #vw-root{position:relative;width:100%;height:100vh;display:flex;flex-direction:row;overflow:hidden}
    #vw-left { width:75%; height:100%; } /* canvas will be full of this area */
    #vw-right { width:25%; height:100%; box-sizing:border-box; padding:18px; border-left:1px solid rgba(0,0,0,0.04); background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,250,0.98)); overflow:auto }
    /* right panel content */
    #info-title{font-size:16px;font-weight:700;margin-bottom:6px}
    .info-row{margin-bottom:10px}
    .info-label{font-size:12px;color:#666;font-weight:600;margin-bottom:4px}
    .info-value{font-size:15px;color:#111}
    /* glyph canvas area */
    #glyph-wrap{width:100%;height:220px;display:flex;align-items:center;justify-content:center;margin-top:8px;margin-bottom:12px}
    /* responsive */
    @media (max-width:900px){ #vw-left{width:100%} #vw-right{display:none} }
  `;
  const style = document.createElement("style");
  style.id = "vw-main-style";
  style.innerHTML = css;
  document.head.appendChild(style);

  // root container
  const existingRoot = document.getElementById("vw-root");
  if (existingRoot) existingRoot.remove();
  const root = document.createElement("div");
  root.id = "vw-root";

  const left = document.createElement("div");
  left.id = "vw-left";
  // canvas will be appended here by p5 (createCanvas attaches to document body; we'll move it in setup)

  const right = document.createElement("aside");
  right.id = "vw-right";
  right.innerHTML = `
    <div id="info-title">Select a volcano</div>
    <div id="info-name" class="info-row"><div class="info-label">Name · Country</div><div class="info-value">-</div></div>
    <div id="info-location" class="info-row"><div class="info-label">Location</div><div class="info-value">-</div></div>
    <div id="info-elev" class="info-row"><div class="info-label">Elevation (m)</div><div class="info-value">-</div></div>
    <div id="info-type" class="info-row"><div class="info-label">Type · TypeCategory</div><div class="info-value">-</div></div>
    <div id="info-status" class="info-row"><div class="info-label">Status</div><div class="info-value">-</div></div>
    <div id="info-eruption" class="info-row"><div class="info-label">Last Known Eruption</div><div class="info-value">-</div></div>

    <div id="glyph-wrap"><canvas id="glyph-canvas" width="300" height="220"></canvas></div>

    <div id="legend-mini" style="margin-top:8px">
      <div style="font-size:12px;color:#666;margin-bottom:6px">Elevation • color scale</div>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:140px;height:12px;border-radius:6px;background:linear-gradient(90deg, rgb(${colorLow[0]},${colorLow[1]},${colorLow[2]}), rgb(${colorHigh[0]},${colorHigh[1]},${colorHigh[2]}));border:1px solid rgba(0,0,0,0.04)"></div>
        <div style="font-size:12px;color:#444">${Math.round(minElev || 0)} — ${Math.round(maxElev || 1000)}</div>
      </div>
    </div>
  `;

  root.appendChild(left);
  root.appendChild(right);
  document.body.appendChild(root);

  headerEl = (function createHeader(){
    const existing = document.getElementById("vw-header");
    if (existing) existing.remove();
    const h = document.createElement("div");
    h.id = "vw-header";
    h.innerHTML = `
      <h1>Volcanoes World Map</h1>
      <p class="desc">Interactive overview of volcanoes from the dataset.<br>Color encodes elevation (m).<br><i>Click on a point to show details on the right.</i></p>
      <div class="vw-legend" aria-hidden="true">
        <div class="ticks" id="legendTicks"><span id="minTick">min</span><span id="midTick">mid</span><span id="maxTick">max</span></div>
        <div class="bar" id="legendBar"></div>
      </div>
    `;
    document.body.appendChild(h);
    return h;
  })();

  tooltipEl = document.createElement("div");
  tooltipEl.id = "vw-tooltip";
  document.body.appendChild(tooltipEl);

  // store right panel ref & glyph canvas ref
  rightPanel = document.getElementById("vw-right");
  glyphCanvas = document.getElementById("glyph-canvas");
  glyphCtx = glyphCanvas.getContext("2d");
})();

/* ---------------- p5 preload ---------------- */
function preload() {
  table = loadTable(csvFile, "csv", "header",
    () => console.log("CSV loaded:", csvFile),
    (err) => console.error("CSV load error:", err)
  );
  mapImg = loadImage(mapImageFile,
    () => console.log("Map loaded:", mapImageFile),
    (err) => { console.warn("Map load failed:", err); mapImg = null; }
  );
}

/* ---------------- p5 setup ---------------- */
function setup() {
  // compute left pane size
  leftWidth = Math.floor(windowWidth * (1 - panelFrac));
  canvasHeight = windowHeight; // full height
  // create p5 canvas sized to left pane
  const cnv = createCanvas(leftWidth, canvasHeight);
  cnv.parent("vw-left"); // attach inside left container
  // remove default margin
  cnv.style('display', 'block');

  // prevent body scroll when using left canvas
  noStroke();

  // parse CSV into points
  if (table && table.getRowCount() > 0) {
    preparePointsFromTable();
    updateLegendTicks();
  } else {
    console.warn("CSV missing or empty.");
  }

  computeImagePlacement();
  updatePointsXY();

  // initial glyph canvas clear
  drawGlyphPlaceholder();
}

/* ---------------- p5 draw ---------------- */
function draw() {
  clear();
  background(250);

  // draw map into left canvas
  if (mapImg) {
    image(mapImg, imgX, imgY, imgW, imgH);
  } else {
    drawFallbackMap();
  }

  // draw all points
  const sizeScale = max(0.9, min(width, height) / 900);
  const dotSize = dotBaseSize * sizeScale;
  const t = millis() / 1000;

  hoverPoint = null;
  // detect hover
  for (let p of points) {
    if (dist(mouseX, mouseY, p.x, p.y) <= dotSize * hoverRadiusFactor) {
      hoverPoint = p;
      break;
    }
  }

  for (let p of points) {
    const col = colorFromElevation(p.elev);
    if (selectedPoint === p) {
      const pulse = 1 + 0.22 * (0.5 + 0.5 * Math.sin(t * 6));
      fill(col[0], col[1], col[2]);
      ellipse(p.x, p.y, dotSize * pulse, dotSize * pulse);
      // highlight ring
      noFill();
      stroke(255, 180);
      strokeWeight(1.3);
      ellipse(p.x, p.y, dotSize * pulse + 6, dotSize * pulse + 6);
      noStroke();
    } else {
      fill(col[0], col[1], col[2]);
      ellipse(p.x, p.y, dotSize, dotSize);
    }
    // border for readability
    noFill();
    stroke(255, 30);
    strokeWeight(0.8);
    ellipse(p.x, p.y, dotSize + 0.8, dotSize + 0.8);
    noStroke();
  }

  // tooltip
  if (hoverPoint) {
    tooltipEl.style.display = "block";
    tooltipEl.textContent = hoverPoint.fields.name || "(no name)";
    const offsetX = 12;
    const offsetY = -12;
    // tooltip position relative to document (canvas is placed on the page)
    const canvasRect = document.querySelector("#vw-left canvas").getBoundingClientRect();
    const leftPos = constrain(mouseX + canvasRect.left + offsetX, 8, windowWidth - 8);
    const topPos = constrain(mouseY + canvasRect.top + offsetY, 8, windowHeight - 8);
    tooltipEl.style.left = `${leftPos}px`;
    tooltipEl.style.top = `${topPos}px`;
  } else {
    tooltipEl.style.display = "none";
  }

  // if there's a selected point, animate its glyph smoke (uses requestAnimationFrame loop separate), but also keep the glyph drawing updated per frame (so sync)
  if (selectedPoint) {
    // draw glyph based on selectedPoint every frame to keep animation smooth
    drawGlyph(selectedPoint);
  }
}

/* ---------------- windowResized ---------------- */
function windowResized() {
  // recompute sizes: left canvas is 75% of new window width
  leftWidth = Math.floor(windowWidth * (1 - panelFrac));
  canvasHeight = windowHeight;
  resizeCanvas(leftWidth, canvasHeight);
  // move/size right panel (it uses CSS percent)
  computeImagePlacement();
  updatePointsXY();
  updateLegendTicks();
  // redraw glyph to fit
  if (selectedPoint) drawGlyph(selectedPoint);
  else drawGlyphPlaceholder();
}

/* ---------------- preparePointsFromTable ---------------- */
function preparePointsFromTable() {
  points = [];
  minElev = Infinity; maxElev = -Infinity;

  const headers = table.columns.map(h => h.trim());
  const latKey = findHeader(headers, latCandidates);
  const lonKey = findHeader(headers, lonCandidates);
  const elevKey = findHeader(headers, elevCandidates);

  const nameKey = findHeader(headers, nameCandidates);
  const countryKey = findHeader(headers, countryCandidates);
  const locationKey = findHeader(headers, locationCandidates);
  const typeKey = findHeader(headers, typeCandidates);
  const typeCatKey = findHeader(headers, typeCatCandidates);
  const statusKey = findHeader(headers, statusCandidates);
  const eruptionKey = findHeader(headers, eruptionCandidates);

  if (!latKey || !lonKey) {
    console.error("Lat/Lon columns not found. Headers:", headers);
    return;
  }

  for (let r = 0; r < table.getRowCount(); r++) {
    const row = table.getRow(r);
    const lat = parseFloat(String(row.get(latKey)).replace(",", "."));
    const lon = parseFloat(String(row.get(lonKey)).replace(",", "."));
    const elevRaw = elevKey ? row.get(elevKey) : "";
    const elev = elevRaw === "" ? NaN : parseFloat(String(elevRaw).replace(",", "."));

    if (isNaN(lat) || isNaN(lon)) continue;

    if (!isNaN(elev)) {
      minElev = min(minElev, elev);
      maxElev = max(maxElev, elev);
    }

    const fields = {
      name: safeString(nameKey ? row.get(nameKey) : ""),
      country: safeString(countryKey ? row.get(countryKey) : ""),
      location: safeString(locationKey ? row.get(locationKey) : ""),
      elevation: !isNaN(elev) ? elev : "",
      type: safeString(typeKey ? row.get(typeKey) : ""),
      typeCategory: safeString(typeCatKey ? row.get(typeCatKey) : ""),
      status: safeString(statusKey ? row.get(statusKey) : ""),
      lastEruption: safeString(eruptionKey ? row.get(eruptionKey) : "")
    };

    points.push({ lat, lon, elev: isNaN(elev) ? NaN : elev, x: 0, y: 0, fields });
  }

  if (!isFinite(minElev) || !isFinite(maxElev)) {
    minElev = 0; maxElev = 4000;
  }
}

/* ---------------- findHeader utility ---------------- */
function findHeader(headers, candidates) {
  for (let c of candidates) if (headers.includes(c)) return c;
  const lower = headers.map(h => h.toLowerCase());
  for (let c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  for (let h of headers) {
    const low = h.toLowerCase();
    for (let c of candidates) {
      const cSimple = c.toLowerCase().replace(/\s+/g, "");
      if (low.includes(cSimple) || low.includes(c.split(" ")[0].toLowerCase())) return h;
    }
  }
  return null;
}

/* ---------------- computeImagePlacement - image inside left canvas ---------------- */
function computeImagePlacement() {
  // aspect ratio from image if available
  if (mapImg && mapImg.width > 0 && mapImg.height > 0) imgAspect = mapImg.width / mapImg.height;
  else imgAspect = 2;

  const padX = width * 0.06;
  const padY = height * 0.06 + headerHeight * 0.05; // small nudge for header visual

  const availW = width - 2 * padX;
  const availH = height - 2 * padY;

  const shrinkFactor = 0.94;

  if ((availW * shrinkFactor) / imgAspect <= (availH * shrinkFactor)) {
    imgW = availW * shrinkFactor;
    imgH = imgW / imgAspect;
  } else {
    imgH = availH * shrinkFactor;
    imgW = imgH * imgAspect;
  }

  imgX = (width - imgW) / 2;
  imgY = (height - imgH) / 2 + headerHeight * 0.06;
}

/* ---------------- updatePointsXY ---------------- */
function updatePointsXY() {
  for (let p of points) {
    p.x = imgX + map(p.lon, -180, 180, 0, imgW);
    p.y = imgY + map(p.lat, 90, -90, 0, imgH);
  }
}

/* ---------------- colorFromElevation ---------------- */
function colorFromElevation(elev) {
  if (!isFinite(elev)) elev = minElev;
  const t = constrain(map(elev, minElev, maxElev, 0, 1), 0, 1);
  const r = lerp(colorLow[0], colorHigh[0], t);
  const g = lerp(colorLow[1], colorHigh[1], t);
  const b = lerp(colorLow[2], colorHigh[2], t);
  return [r, g, b];
}

/* ---------------- drawFallbackMap ---------------- */
function drawFallbackMap() {
  noStroke();
  fill(235, 242, 249);
  rect(0, 0, width, height);
  computeImagePlacement();
  fill(230);
  rect(imgX, imgY, imgW, imgH);
  stroke(200);
  strokeWeight(1);
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = imgX + map(lon, -180, 180, 0, imgW);
    line(x, imgY, x, imgY + imgH);
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = imgY + map(lat, 90, -90, 0, imgH);
    line(imgX, y, imgX + imgW, y);
  }
  noStroke();
}

/* ---------------- mousePressed: click detection (only inside left canvas) ---------------- */
function mousePressed() {
  // only react if click is inside the left canvas area
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

  const sizeScale = max(0.9, min(width, height) / 900);
  const dotSize = dotBaseSize * sizeScale;
  const hitRadius = max(6, dotSize * 1.3);

  for (let p of points) {
    const d = dist(mouseX, mouseY, p.x, p.y);
    if (d <= hitRadius) {
      selectedPoint = p;
      populateRightPanel(p);
      // ensure glyph animation starts (drawGlyph called in draw loop)
      return;
    }
  }
}

/* ---------------- populateRightPanel: fills right side with fields and starts glyph animation ---------------- */
function populateRightPanel(p) {
  const f = p.fields;
  // title
  document.getElementById("info-title").textContent = f.name || "Volcano";
  document.querySelector("#info-name .info-value").textContent = `${f.name || "-"}${f.country ? " — " + f.country : ""}`;
  document.querySelector("#info-location .info-value").textContent = f.location || "-";
  document.querySelector("#info-elev .info-value").textContent = (f.elevation !== "" ? f.elevation : "-");
  document.querySelector("#info-type .info-value").textContent = (f.type || "-") + (f.typeCategory ? ` · ${f.typeCategory}` : "");
  document.querySelector("#info-status .info-value").textContent = f.status || "-";
  document.querySelector("#info-eruption .info-value").textContent = f.lastEruption || "-";

  // draw glyph immediately and start animation (drawGlyph runs each frame if selectedPoint set)
  drawGlyph(p);
}

/* ---------------- drawGlyphPlaceholder ---------------- */
function drawGlyphPlaceholder() {
  if (!glyphCtx) return;
  const c = glyphCanvas;
  glyphCtx.clearRect(0,0,c.width,c.height);
  glyphCtx.fillStyle = "#f5f5f5";
  glyphCtx.fillRect(0,0,c.width,c.height);
  glyphCtx.fillStyle = "#aaa";
  glyphCtx.font = "16px Inter, sans-serif";
  glyphCtx.textAlign = "center";
  glyphCtx.fillText("Click a point to see glyph", c.width/2, c.height/2);
}

/* ---------------- drawGlyph: draws central glifo and animates smoke ----------------
   - base circle colored by elevation
   - center shape depends on Type (triangle / square / star / pentagon)
   - smoke: animated particles rising from top; density depends on recency of last eruption
   - if lastEruption contains '?', shows big gray '?'
*/
function drawGlyph(p) {
  if (!glyphCtx) return;
  const c = glyphCanvas;
  const ctx = glyphCtx;
  ctx.clearRect(0,0,c.width,c.height);

  // sizes (responsive to canvas)
  const W = c.width, H = c.height;
  const cx = W/2, cy = H*0.55;
  const baseR = Math.min(W,H) * 0.22;

  // base color from elevation
  const col = colorFromElevation(p.elev || minElev);
  const fillColor = `rgb(${Math.round(col[0])},${Math.round(col[1])},${Math.round(col[2])})`;

  // draw shadow circle base
  ctx.beginPath();
  ctx.arc(cx, cy, baseR + 6, 0, Math.PI*2);
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fill();

  // draw filled circle (main body)
  ctx.beginPath();
  ctx.arc(cx, cy, baseR, 0, Math.PI*2);
  ctx.fillStyle = fillColor;
  ctx.fill();

  // draw center shape depending on type
  const type = (p.fields.type || "").toLowerCase();
  drawTypeShape(ctx, cx, cy, baseR*0.6, type);

  // draw label small
  ctx.fillStyle = "#222";
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(p.fields.name || "", cx, cy + baseR + 18);

  // handle eruption -> smoke animation
  const eruptStr = (p.fields.lastEruption || "").trim();

  if (eruptStr.includes("?")) {
    // big gray ? above glyph
    ctx.fillStyle = "#888";
    ctx.font = "48px Inter, sans-serif";
    ctx.fillText("?", cx, cy - baseR - 6);
    return;
  }

  // parse year if possible (try to extract last 4-digit year)
  let year = null;
  const m = eruptStr.match(/(19|20)\d{2}/);
  if (m) year = +m[0];
  // else maybe "Unknown" or empty -> treat as long time no eruption -> light smoke
  const currentYear = 2025; // per coerenza con contesto
  let density = 0.15; // 0..1
  if (year) {
    const yearsSince = Math.max(0, currentYear - year);
    if (yearsSince <= 5) density = 1.0;        // very dense smoke
    else if (yearsSince <= 50) density = 0.6;  // medium
    else density = 0.25;                       // light
  } else if (eruptStr === "" || eruptStr.toLowerCase().includes("unknown") || eruptStr.toLowerCase().includes("n/a")) {
    density = 0.2;
  } else {
    density = 0.35;
  }

  // draw a funnel shape (crater) atop circle
  const topY = cy - baseR;
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.moveTo(cx - baseR*0.32, topY + 6);
  ctx.lineTo(cx + baseR*0.32, topY + 6);
  ctx.lineTo(cx + baseR*0.18, topY - baseR*0.12);
  ctx.lineTo(cx - baseR*0.18, topY - baseR*0.12);
  ctx.closePath();
  ctx.fillStyle = "rgba(30,30,30,0.8)";
  ctx.fill();

  // animate smoke: draw several rising translucent blobs; use millis() for time-based animation
  const now = millis()/1000;
  const particles = Math.round(8 + density * 24); // more particles for denser
  for (let i = 0; i < particles; i++) {
    // base x offset random seed by index and name so animation stable per point
    const seed = hashString(p.fields.name || "") + i * 13.7;
    const phase = (now * 0.6 + (seed % 3)) % 10;
    const life = (phase % 1.0); // 0..1
    const px = cx + (Math.sin((seed + now) * 0.7 + i) * baseR * 0.12);
    const py = topY - life * (baseR * (0.9 + density * 1.3));
    const size = (6 + density * 18) * (0.3 + life * 1.2);
    const alpha = 0.15 * density * (1 - life) + 0.04;

    // draw cloud blob
    const g = ctx.createRadialGradient(px, py, size*0.1, px, py, size);
    g.addColorStop(0, `rgba(230,230,230,${alpha})`);
    g.addColorStop(1, `rgba(200,200,200,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(px, py, size, size*0.6, 0, 0, Math.PI*2);
    ctx.fill();
  }
} 

/* ---------------- drawTypeShape: draws a shape inside glyph depending on type ----------------
   - uses simple substring matching to pick a shape
   - triangle = stratovolcano, circle = shield, square = caldera, star = others
*/
function drawTypeShape(ctx, cx, cy, r, typeStr) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;

  const t = (typeStr || "").toLowerCase();
  if (t.includes("strato") || t.includes("composite") || t.includes("andesitic") || t.includes("stratovolcano")) {
    // triangle pointing up (peak-like)
    ctx.beginPath();
    ctx.moveTo(0, -r*0.9);
    ctx.lineTo(r*0.85, r*0.65);
    ctx.lineTo(-r*0.85, r*0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (t.includes("shield")) {
    // concentric circle
    ctx.beginPath();
    ctx.arc(0, 0, r*0.85, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.arc(0, 0, r*0.45, 0, Math.PI*2);
    ctx.fill();
  } else if (t.includes("caldera") || t.includes("maar")) {
    // rounded square (caldera)
    const s = r*1.0;
    roundRect(ctx, -s*0.6, -s*0.6, s*1.2, s*1.2, s*0.18);
    ctx.fill();
    ctx.stroke();
  } else {
    // star / irregular polygon for "other"
    ctx.beginPath();
    const spikes = 5;
    for (let i = 0; i < spikes*2; i++) {
      const angle = (Math.PI * 2 / (spikes*2)) * i;
      const rad = (i % 2 === 0) ? r*0.9 : r*0.4;
      const x = Math.cos(angle) * rad;
      const y = Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/* helper roundRect for canvas */
function roundRect(ctx, x, y, w, h, r) {
  const radius = r;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/* ---------------- utility: hashString stable pseudo-rand from string ---------------- */
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---------------- populate legend ticks ---------------- */
function updateLegendTicks() {
  const minTick = document.getElementById("minTick");
  const midTick = document.getElementById("midTick");
  const maxTick = document.getElementById("maxTick");
  if (minTick) minTick.textContent = `${Math.round(minElev)}`;
  if (midTick) midTick.textContent = `${Math.round((minElev + maxElev) / 2)}`;
  if (maxTick) maxTick.textContent = `${Math.round(maxElev)}`;
}

/* ---------------- small helpers ---------------- */
function safeString(v) {
  if (v === null || typeof v === 'undefined') return "";
  return String(v).trim();
}

/* ---------------- end of file ---------------- */
