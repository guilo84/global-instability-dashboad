import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function App() {
  // --- STATE MANAGEMENT ---
  const [geoData, setGeoData] = useState(null);            // Holds the raw, master dataset
  const [uniqueDates, setUniqueDates] = useState([]);      // Holds an array of ['2026-04-23', '2026-04-24']
  const [selectedDateIndex, setSelectedDateIndex] = useState(0); // Tracks the slider's position

  // --- DATA FETCHING ---
  useEffect(() => {
    fetch('http://localhost:8000/api/events')
      .then(response => response.json())
      .then(data => {
        // 1. Extract unique dates and sort chronologically
        const dates = [...new Set(data.features.map(f => f.properties.date))].sort();
        setUniqueDates(dates);
        
        // 2. Default the slider to the most recent date (the end of the array)
        setSelectedDateIndex(dates.length - 1);
        
        // 3. Save the master dataset
        setGeoData(data);
      })
      .catch(error => console.error('Error fetching data:', error));
  }, []);

  // --- MAP STYLING ---
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

  const onEachFeature = (feature, layer) => {
    const props = feature.properties;
    layer.bindPopup(`
      <strong>${props.category}</strong><br/>
      Date: ${props.date}<br/>
      Severity: ${props.severity}<br/>
      <a href="${props.source}" target="_blank" style="color: #66b3ff;">Read Source</a>
    `);
  };

  // --- DATA FILTERING ---
  // Create a temporary subset of data based on where the slider is sitting
  const activeDate = uniqueDates[selectedDateIndex];
  const filteredData = geoData ? {
    ...geoData,
    features: geoData.features.filter(f => f.properties.date === activeDate)
  } : null;

  // --- RENDER ---
  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      
      {/* 1. THE FLOATING TIMELINE UI */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)', // Centers the box perfectly
        zIndex: 1000,                  // Ensures it floats above the Leaflet map
        backgroundColor: 'rgba(45, 45, 45, 0.9)',
        padding: '15px 30px',
        borderRadius: '8px',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
        width: '300px',
        textAlign: 'center'
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontFamily: 'sans-serif' }}>Event Timeline</h4>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#ff4444', fontWeight: 'bold' }}>
          Showing events for: {activeDate || 'Loading...'}
        </p>
        
        <input 
          type="range" 
          min="0" 
          max={Math.max(0, uniqueDates.length - 1)} 
          value={selectedDateIndex} 
          onChange={(e) => setSelectedDateIndex(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
          disabled={uniqueDates.length === 0}
        />
      </div>

      {/* 2. THE MAP */}
      <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        
        {/* CRITICAL REACT-LEAFLET TRICK: 
          React-Leaflet's GeoJSON component normally ignores data updates. 
          By passing the activeDate as the 'key', we force React to destroy 
          the old layer and draw a fresh one every time the slider moves. 
        */}
        {filteredData && filteredData.features.length > 0 && (
          <GeoJSON 
            key={`geojson-${activeDate}`} 
            data={filteredData} 
            pointToLayer={pointToLayer} 
            onEachFeature={onEachFeature} 
          />
        )}
      </MapContainer>
    </div>
  );
}

export default App;
