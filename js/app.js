const projCRS = "EPSG:2136";
const geogCRS = "EPSG:4326";

document.addEventListener("DOMContentLoaded", init);

function init() {
	registerProj();
	const map = new ol.Map({
		target: "map",
		layers: [googleTileLayer()],
		view: new ol.View({
			zoom: 7.6,
			center: [644788.14, 1224058.42],
			projection: projCRS,
		})
	});
	initControls(map);

	const hash = window.location.hash.substring(1);
	if(!hash) {
		return;
	}

	try {
		const [plotNumber, owner, locality, district , boundary] = parseHash(hash);
		const latlng = parseBoundary(boundary);
		const coords = projectLatLng(latlng, geogCRS, projCRS);
		let geometry = new ol.geom.Polygon([coords]);
		const gmapsUrl = getGoogleMapsLink(geometry, projCRS, geogCRS);

		const feature = new ol.Feature({geometry, plotNumber, owner, locality, district, gmapsUrl});

		const vectorSource = new ol.source.Vector({features: [feature]});
		const vectorLayer = new ol.layer.Vector({
			source: vectorSource, style: new ol.style.Style({
				stroke: new ol.style.Stroke({color: "#ff4d00", width: 3}),
				fill: new ol.style.Fill({color: "rgb(255 123 0 / 0.2)"})
			})
		});

		map.addLayer(vectorLayer);
		map.getView().fit(vectorSource.getExtent(), {
			padding: [50, 50, 50, 50],
			maxZoom: 20,
		});

	} catch(error) {
		console.error("Failed to parse QRC payload", error);
		document.getElementById("error-msg").style.display = "block";
	}

	const tooltipElement = document.getElementById("tooltip");
	const overlay = new ol.Overlay({element: tooltipElement, offset: [15, 0], positioning: "center-left"});
	map.addOverlay(overlay);

	//map.on("pointermove", displayTooltip);
	map.on("singleclick", displayTooltip);

	function displayTooltip(evt) {
		if(evt.dragging) {
			tooltipElement.style.display = "none";
			return;
		}
		const hitFeature = map.forEachFeatureAtPixel(evt.pixel, (o) => o);
		if(hitFeature) {
			tooltipElement.innerHTML = `
			  <strong>Plot #:</strong> ${hitFeature.get("plotNumber")}<br>
			  <strong>Owner:</strong> ${hitFeature.get("owner")}<br>
			  <strong>Locality:</strong> ${hitFeature.get("locality")}<br>
			  <strong>District:</strong> ${hitFeature.get("district")}<br>
			  <span>📍</span><a href="${hitFeature.get("gmapsUrl")}" target="_blank" style="color: #0066cc; text-decoration: underline; display: inline-block; margin-top: 5px;">View on Google Maps</a>
			`;
			tooltipElement.style.display = "block";

			overlay.setPosition(evt.coordinate);
			map.getTargetElement().style.cursor = "pointer";
		} else {
			tooltipElement.style.display = "none";
			map.getTargetElement().style.cursor = "";
		}
	}
}

function initControls(map) {
	map.addControl(new ol.control.MousePosition({
		coordinateFormat: ol.coordinate.createStringXY(2),
		projection: projCRS,
		className: "custom-mouse-position",
		undefinedHTML: "Cursor off map"
	}));
}

function parseHash(hash) {
	const decodedHash = decodeURIComponent(hash.replace(/\+/g, "%20"));
	const parts = decodedHash.split("\x1F");

	if(parts.length !== 5) {
		throw new Error("Invalid QR data format. Expected 3 parts.");
	}
	return parts
}

function projectLatLng(coords, geogCRS, projCRS) {
	return coords.map(function(c) {
		return ol.proj.transform([c[1], c[0]], geogCRS, projCRS);
	});
}

function parseBoundary(boundary) {
	const coords = polyline.decode(boundary);
	if(coords.length <= 2) {
		return;
	}
	const fpt = coords[0];
	const lpt = coords[coords.length - 1];
	if(fpt[0] !== lpt[0] || fpt[1] !== lpt[1]) {
		coords.push(fpt);
	}
	return coords
}

function googleTileLayer() {
	const url = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
	const crossOrigin = "anonymous";
	const projection = "EPSG:3857";
	const source = new ol.source.XYZ({url, crossOrigin, projection});
	return new ol.layer.Tile({source});
}

function getGoogleMapsLink(geometry, projCRS, geogCRS) {
	const interiorPoint = geometry.getInteriorPoint().getCoordinates();
	const lonLat = ol.proj.transform(interiorPoint, projCRS, geogCRS);
	const lat = lonLat[1].toFixed(6);
	const lng = lonLat[0].toFixed(6);
	return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function registerProj() {
	proj4.defs(projCRS, "+proj=tmerc +lat_0=4.66666666666667 +lon_0=-1 +k=0.99975 +x_0=274319.739163358 +y_0=0 +a=6378300 +rf=296 +towgs84=-170,33,326,0,0,0,0 +to_meter=0.304799710181509 +no_defs +type=crs");
	ol.proj.proj4.register(proj4);
}