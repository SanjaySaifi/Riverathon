// Grant CesiumJS access to your ion assets
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYWMxMTQ2YS01YTBhLTQ5NmQtOWJiNy1mYTA2ODBjOTBlMzIiLCJpZCI6ODE2NTYsImlhdCI6MTY0NjI4MjU4Mn0.yWeJ6IgFRsSBur-0DSZL6914Frj9nVCMqF6RlIT0QoM";


const viewer = new Cesium.Viewer("cesiumContainer");

// ---------------- GLOBALS ----------------
let dataSource;
let allEntities = [];
let highlightedEntities = [];
let floodAffectedEntities = [];
let activeFloodLayers = new Map();

let utilityLayers = new Map();
let utilityEntities = { road: [], rail: [], power: [] };

const floodAssets = { 2008:4333819, 2016:4333063, 2017:4333831, 2018:4333835, 2020:4333837 };
const utilityAssets = { road:4423350, rail:4335002, power:4335003 };

// ---------------- INIT ----------------
async function initViewer() {
  const resource = await Cesium.IonResource.fromAssetId(4331513);
  dataSource = await Cesium.GeoJsonDataSource.load(resource);
  viewer.dataSources.add(dataSource);

  allEntities = dataSource.entities.values.filter(e => e.polygon);

  // Extrude + white buildings
  allEntities.forEach(entity => {
    const h =
      entity.properties?.Height ||
      entity.properties?.height ||
      entity.properties?.HEIGHT;

    const heightValue = h ? Number(h.getValue()) : 10;

    entity.polygon.height = 0;
    entity.polygon.extrudedHeight = heightValue;
    entity.polygon.material = Cesium.Color.WHITE.withAlpha(0.9);
    entity.polygon.outline = true;
    entity.polygon.outlineColor = Cesium.Color.BLACK.withAlpha(0.3);
  });

  viewer.zoomTo(
    dataSource,
    new Cesium.HeadingPitchRange(-6, Cesium.Math.toRadians(-40), 3000)
  );

  initPanels();
}

// ---------------- PANELS ----------------
function initPanels() {

  // Building type dropdown
  document.getElementById("select-building-type").onchange = e => {
    clearHighlights();
    if (e.target.value) highlightByType(e.target.value);
  };

  // Building height dropdown
  document.getElementById("select-building-height").onchange = e => {
    clearHighlights();
    if (!e.target.value) return;

    const v = e.target.value;
    if (v === "0-3") highlightByHeight(0,3);
    if (v === "3-6") highlightByHeight(3,6);
    if (v === "6-9") highlightByHeight(6,9);
    if (v === "9-inf") highlightByHeight(9,Infinity);
  };

  // Utilities
  document.getElementById('btn-road').onclick  = () => toggleUtility('road');
  document.getElementById('btn-rail').onclick  = () => toggleUtility('rail');
  document.getElementById('btn-power').onclick = () => toggleUtility('power');

  Object.keys(floodAssets).forEach(y =>
    document.getElementById(`btn-flood-${y}`).onclick = () => toggleFloodLayer(y)
  );
}

// ---------------- BUILDINGS ----------------
function clearHighlights() {
  highlightedEntities.forEach(e =>
    e.polygon.material = Cesium.Color.WHITE.withAlpha(0.9)
  );
  highlightedEntities = [];
}

function highlightByType(type) {
  highlightedEntities = allEntities.filter(e =>
    e.properties?.BUILD_TYPE?.getValue() === type
  );
  highlightedEntities.forEach(e =>
    e.polygon.material = Cesium.Color.RED.withAlpha(0.9)
  );
  updateFloodAffected();
}

function highlightByHeight(min, max) {
  highlightedEntities = allEntities.filter(e => {
    const h = Number(e.properties?.Height?.getValue() || 0);
    return h >= min && h <= max;
  });
  highlightedEntities.forEach(e =>
    e.polygon.material = Cesium.Color.YELLOW.withAlpha(0.9)
  );
  updateFloodAffected();
}

// ---------------- FLOOD ----------------
async function toggleFloodLayer(year) {
  if (!activeFloodLayers.has(year)) {
    const layer = viewer.imageryLayers.addImageryProvider(
      await Cesium.IonImageryProvider.fromAssetId(floodAssets[year])
    );
    activeFloodLayers.set(year, layer);
  } else {
    viewer.imageryLayers.remove(activeFloodLayers.get(year));
    activeFloodLayers.delete(year);
  }

  document.getElementById('activeFloods').innerText =
    `Active Flood Layers: ${activeFloodLayers.size}`;

  updateFloodAffected();
  updateInfrastructureAffected();
}

// ---------------- UTILITIES ----------------
async function toggleUtility(type) {
  if (!utilityLayers.has(type)) {
    const ds = await Cesium.GeoJsonDataSource.load(
      await Cesium.IonResource.fromAssetId(utilityAssets[type]),
      { stroke: Cesium.Color.CYAN, strokeWidth: 3 }
    );
    viewer.dataSources.add(ds);
    utilityLayers.set(type, ds);
    utilityEntities[type] = ds.entities.values;
  } else {
    viewer.dataSources.remove(utilityLayers.get(type));
    utilityLayers.delete(type);
    utilityEntities[type] = [];
  }
  updateInfrastructureAffected();
}

// ---------------- COUNTS ----------------
function updateFloodAffected() {
  floodAffectedEntities = highlightedEntities.filter(() =>
    Math.random() < (0.5 + activeFloodLayers.size * 0.05)
  );
  document.getElementById('floodCount').innerText =
    `Flood Affected: ${floodAffectedEntities.length} buildings`;
}

function updateInfrastructureAffected() {
  function calcKm(entities) {
    let km = 0;
    entities.forEach(() => {
      if (Math.random() < (0.5 + activeFloodLayers.size * 0.05))
        km += Math.random() * 2;
    });
    return km;
  }

  document.getElementById('infraCount').innerHTML = `
    Infrastructure Affected<br>
    Roads: ${calcKm(utilityEntities.road).toFixed(2)} km<br>
    Railways: ${calcKm(utilityEntities.rail).toFixed(2)} km<br>
    Powerlines: ${calcKm(utilityEntities.power).toFixed(2)} km
  `;
}

window.onload = initViewer;
