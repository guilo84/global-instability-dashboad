import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // CRITICAL: Leaflet will break without its CSS

function App() {
  // State to hold our GeoJSON data
  const [geoData, setGeoData] = useState(null);

  // Fetch data from the FastAPI backend on component mount
  useEffect(() => {
    fetch('http://localhost:8000/api/events')
      .then(response => response.json())
      .then(data => setGeoData(data))
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  // Style the points
  const pointToLayer = (feature, latlng) => {
    return L.circleMarker(latlng, {
      radius: 6,
      fillColor: "#ff4444",
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });
  };

  // Bind the popup data
  const onEachFeature = (feature, layer) => {
    const props = feature.properties;
    const popupContent = `
      <strong>${props.category}</strong><br/>
      Date: ${props.date}<br/>
      Severity: ${props.severity}<br/>
      <a href="${props.source}" target="_blank" style="color: #66b3ff;">Read Source</a>
    `;
    layer.bindPopup(popupContent);
  };

  return (
    <MapContainer 
      center={[20, 0]} 
      zoom={2} 
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      
      {/* Only render the GeoJSON layer once the data has been fetched */}
      {geoData && (
        <GeoJSON 
          data={geoData} 
          pointToLayer={pointToLayer} 
          onEachFeature={onEachFeature} 
        />
      )}
    </MapContainer>
  );
}

export default App;
