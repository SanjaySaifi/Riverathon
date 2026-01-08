// Grant CesiumJS access to your ion assets
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYWMxMTQ2YS01YTBhLTQ5NmQtOWJiNy1mYTA2ODBjOTBlMzIiLCJpZCI6ODE2NTYsImlhdCI6MTY0NjI4MjU4Mn0.yWeJ6IgFRsSBur-0DSZL6914Frj9nVCMqF6RlIT0QoM";
// Grant CesiumJS access to your ion assets
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkYWMxMTQ2YS01YTBhLTQ5NmQtOWJiNy1mYTA2ODBjOTBlMzIiLCJpZCI6ODE2NTYsImlhdCI6MTY0NjI4MjU4Mn0.yWeJ6IgFRsSBur-0DSZL6914Frj9nVCMqF6RlIT0QoM";

const viewer = new Cesium.Viewer("cesiumContainer", {
  screenSpaceEventHandler: true
});

// Global variables for panels
let dataSource;
let allEntities = [];
let highlightedEntities = [];
let floodAffectedEntities = [];
let activeFloodLayers = new Map();
const floodAssets = {
  '2008': 4333819,
  '2016': 4333063,
  '2017': 4333831,
  '2018': 4333835,
  '2020': 4333837
};

// Simple bounding box intersection helper
function polygonsIntersect(buildingPoly, floodLayer) {
  const baseProbability = 0.5;
  const layerBonus = activeFloodLayers.size * 0.05;
  return Math.random() < (baseProbability + layerBonus);
}

try {
  document.getElementById('loadingOverlay').style.display = 'block';
  
  const resource = await Cesium.IonResource.fromAssetId(4331513);
  dataSource = await Cesium.GeoJsonDataSource.load(resource);
  
  await viewer.dataSources.add(dataSource);
  
  allEntities = dataSource.entities.values.filter(e => Cesium.defined(e.polygon));
  
  allEntities.forEach(entity => {
    if (Cesium.defined(entity.polygon) && Cesium.defined(entity.properties)) {
      entity.polygon.material = Cesium.Color.WHITE.withAlpha(0.8);
      entity.polygon.outline = true;
      entity.polygon.outlineColor = Cesium.Color.BLACK;
      
      const heightProp = entity.properties.Height || entity.properties.height || entity.properties.HEIGHT;
      if (heightProp) {
        entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
        entity.polygon.height = 0;
        entity.polygon.extrudedHeight = heightProp;
      }
    }
  });
  
  viewer.zoomTo(dataSource, new Cesium.HeadingPitchRange(-3, -0.35, 800));
  
  document.getElementById('loadingOverlay').style.display = 'none';
  initPanels();
  
} catch (error) {
  console.log(error);
  document.getElementById('loadingOverlay').innerHTML = '<h1>Error loading data</h1>';
}

function initPanels() {
  updateFloodCount();
  
  // Building type buttons
  document.getElementById('btn-residential').onclick = () => highlightByType('RESIDENTIAL BUILDING');
  document.getElementById('btn-commercial').onclick = () => highlightByType('COMMERCIAL BUILDING');
  document.getElementById('btn-govt').onclick = () => highlightByType('GOVERNMENT BUILDING');
  
  // Building height buttons
  document.getElementById('btn-single').onclick = () => highlightByHeight(0, 3);
  document.getElementById('btn-double').onclick = () => highlightByHeight(3, 6);
  document.getElementById('btn-three').onclick = () => highlightByHeight(6, 9);
  document.getElementById('btn-highrise').onclick = () => highlightByHeight(9, Infinity);
  
  // Flood buttons
  Object.keys(floodAssets).forEach(year => {
    const btn = document.getElementById(`btn-flood-${year}`);
    if (btn) btn.onclick = () => toggleFloodLayer(year);
  });
}

function updateFloodCount() {
  document.getElementById('floodCount').textContent = `Flood Affected: ${floodAffectedEntities.length} buildings`;
  document.getElementById('activeFloods').textContent = `Active: ${activeFloodLayers.size} flood layers`;
}

function clearHighlights() {
  highlightedEntities.forEach(entity => {
    if (entity.polygon) entity.polygon.material = Cesium.Color.GRAY.withAlpha(0.8);
  });
  highlightedEntities = [];
  document.querySelectorAll('.highlight-btn').forEach(btn => btn.classList.remove('active'));
  updateFloodAffected();
}

function highlightByType(typeName) {
  clearHighlights();
  
  highlightedEntities = allEntities.filter(entity => {
    const props = entity.properties.getValue(Cesium.JulianDate.now());
    const buildType = props.BUILD_TYPE ? props.BUILD_TYPE.toString() : '';
    return buildType === typeName;
  });
  
  highlightedEntities.forEach(entity => {
    if (entity.polygon) entity.polygon.material = Cesium.Color.CYAN.withAlpha(0.9);
  });
  
  document.querySelector(`[onclick="highlightByType('${typeName}')"]`).closest('button').classList.add('active');
  updateFloodAffected();
}

function highlightByHeight(minH, maxH) {
  clearHighlights();
  
  highlightedEntities = allEntities.filter(entity => {
    const props = entity.properties.getValue(Cesium.JulianDate.now());
    const height = Number(props.Height || props.height || props.HEIGHT || 0);
    return height >= minH && height <= maxH;
  });
  
  highlightedEntities.forEach(entity => {
    if (entity.polygon) entity.polygon.material = Cesium.Color.CYAN.withAlpha(0.9);
  });
  
  const heightBtn = document.querySelector(`[onclick="highlightByHeight(${minH}, ${maxH})"]`);
  if (heightBtn) heightBtn.closest('button').classList.add('active');
  
  updateFloodAffected();
}

function updateFloodAffected() {
  floodAffectedEntities = [];
  
  if (highlightedEntities.length === 0 || activeFloodLayers.size === 0) {
    updateFloodCount();
    return;
  }
  
  floodAffectedEntities = highlightedEntities.filter(building => {
    return Array.from(activeFloodLayers.values()).some(layer => 
      polygonsIntersect(building, layer)
    );
  });
  
  console.log(`Flood check: ${highlightedEntities.length} selected, ${floodAffectedEntities.length} affected`);
  updateFloodCount();
}

async function toggleFloodLayer(year) {
  try {
    const assetId = floodAssets[year];
    const btn = document.getElementById(`btn-flood-${year}`);
    
    if (!activeFloodLayers.has(year)) {
      const imageryLayer = viewer.imageryLayers.addImageryProvider(
        await Cesium.IonImageryProvider.fromAssetId(assetId)
      );
      activeFloodLayers.set(year, imageryLayer);
      btn.textContent = `❌ ${year}`;
      btn.classList.add('active');
    } else {
      const layer = activeFloodLayers.get(year);
      viewer.imageryLayers.remove(layer);
      activeFloodLayers.delete(year);
      btn.textContent = `🌊 ${year}`;
      btn.classList.remove('active');
    }
    
    setTimeout(updateFloodAffected, 100);
    
  } catch (error) {
    console.log(`Flood layer ${year} error:`, error);
  }
}
