import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function App() {
  // --- STATE MANAGEMENT ---
  const [geoData, setGeoData] = useState(null);
  const [uniqueDates, setUniqueDates] = useState([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  
  // NEW STATE: Track the unique categories and which ones are currently checked
  const [uniqueCategories, setUniqueCategories] = useState([]);
  const [activeCategories, setActiveCategories] = useState([]);

  // --- DATA FETCHING ---
  useEffect(() => {
    fetch('http://localhost:8000/api/events')
      .then(response => response.json())
      .then(data => {
        // Timeline setup
        const dates = [...new Set(data.features.map(f => f.properties.date))].sort();
        setUniqueDates(dates);
        setSelectedDateIndex(dates.length - 1);
        
        // Category setup: Extract all unique event categories
        const categories = [...new Set(data.features.map(f => f.properties.category))].sort();
        setUniqueCategories(categories);
        setActiveCategories(categories); // Default to all categories checked
        
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

  // --- INTERACTION LOGIC ---
  // Toggle categories in and out of the active array
  const handleCategoryToggle = (category) => {
    setActiveCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) // Remove it if it was checked
        : [...prev, category]              // Add it if it wasn't
    );
  };

  // --- DATA FILTERING ---
  const activeDate = uniqueDates[selectedDateIndex];
  
  // Update the filter to check BOTH the date and the category array
  const filteredData = geoData ? {
    ...geoData,
    features: geoData.features.filter(f => 
      f.properties.date === activeDate && 
      activeCategories.includes(f.properties.category)
    )
  } : null;

  // --- RENDER ---
  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      
      {/* NEW: THE FLOATING CATEGORY FILTER UI */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: 'rgba(45, 45, 45, 0.9)',
        padding: '15px',
        borderRadius: '8px',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
        minWidth: '200px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #555', paddingBottom: '5px' }}>Filters</h4>
        {uniqueCategories.map(cat => (
          <div key={cat} style={{ marginBottom: '8px' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <input 
                type="checkbox" 
                checked={activeCategories.includes(cat)}
                onChange={() => handleCategoryToggle(cat)}
                style={{ marginRight: '10px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px' }}>{cat}</span>
            </label>
          </div>
        ))}
      </div>

      {/* THE FLOATING TIMELINE UI (UNCHANGED) */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
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

      {/* THE MAP */}
      <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        
        {filteredData && filteredData.features.length > 0 && (
          <GeoJSON 
            // We update the key to include activeCategories length so React knows to redraw when boxes are checked
            key={`geojson-${activeDate}-${activeCategories.length}`} 
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
