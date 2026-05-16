import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CATEGORY_COLORS = {
  'Armed Conflict / Violence': '#ef4444',
  'Protest / Unrest': '#f97316',
  'Coercion / Force Posture': '#eab308',
  'Diplomatic Tension': '#3b82f6',
  'Other': '#9ca3af'
};

function App() {
  const [geoData, setGeoData] = useState(null);
  const [uniqueDates, setUniqueDates] = useState([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [uniqueCategories, setUniqueCategories] = useState([]);
  const [activeCategories, setActiveCategories] = useState([]);

  // --- NEW: BACKEND FILTER STATE ---
  const [timeframe, setTimeframe] = useState("7"); // Defaults to 7 days
  const [keywordInput, setKeywordInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- REFACTORED: FETCH FUNCTION ---
  // We moved the fetch logic into a reusable function so we can call it when the user clicks "Search"
  const fetchMapData = () => {
    setIsLoading(true);
    
    // Dynamically build the URL based on the user's inputs
    const apiUrl = `/api/events?days=${timeframe}&keyword=${encodeURIComponent(keywordInput)}`;

    fetch(apiUrl)
      .then(response => response.json())
      .then(data => {
        const dates = [...new Set(data.features.map(f => f.properties.date))].sort();
        setUniqueDates(dates);
        setSelectedDateIndex(dates.length - 1); // Reset slider to newest date
        
        const categories = [...new Set(data.features.map(f => f.properties.category))].sort();
        setUniqueCategories(categories);
        setActiveCategories(categories); 
        
        setGeoData(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        setIsLoading(false);
      });
  };

  // Run the fetch once when the app first loads
  useEffect(() => {
    fetchMapData();
  }, []);

  // --- MAP STYLING & LOGIC ---
  const pointToLayer = (feature, latlng) => {
    const markerColor = CATEGORY_COLORS[feature.properties.category] || "#ffffff";
    return L.circleMarker(latlng, {
      radius: 6, fillColor: markerColor, color: "#000", weight: 1, opacity: 1, fillOpacity: 0.8
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

  const handleCategoryToggle = (category) => {
    setActiveCategories(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]              
    );
  };

  const activeDate = uniqueDates[selectedDateIndex];
  const filteredData = geoData ? {
    ...geoData,
    features: geoData.features.filter(f => 
      f.properties.date === activeDate && activeCategories.includes(f.properties.category)
    )
  } : null;

  // --- RENDER ---
  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
      
      {/* NEW: THE DATABASE QUERY PANEL (Top Left) */}
      <div style={{
        position: 'absolute', top: '20px', left: '50px', zIndex: 1000,
        backgroundColor: 'rgba(45, 45, 45, 0.9)', padding: '15px',
        borderRadius: '8px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
        display: 'flex', gap: '10px', alignItems: 'center'
      }}>
        <select 
          value={timeframe} 
          onChange={(e) => setTimeframe(e.target.value)}
          style={{ padding: '5px', borderRadius: '4px', backgroundColor: '#333', color: 'white', border: '1px solid #555' }}
        >
          <option value="7">Past 7 Days</option>
          <option value="30">Past 30 Days</option>
          <option value="all">All History</option>
        </select>

        <input 
          type="text" 
          placeholder="Search keyword (e.g. riot)..." 
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchMapData()}
          style={{ padding: '5px', borderRadius: '4px', backgroundColor: '#333', color: 'white', border: '1px solid #555' }}
        />

        <button 
          onClick={fetchMapData}
          style={{ padding: '6px 12px', borderRadius: '4px', backgroundColor: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          {isLoading ? "Loading..." : "Search"}
        </button>
      </div>

      {/* CATEGORY FILTERS (Top Right) */}
      <div style={{
        position: 'absolute', top: '20px', right: '20px', zIndex: 1000,
        backgroundColor: 'rgba(45, 45, 45, 0.9)', padding: '15px',
        borderRadius: '8px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.5)', minWidth: '220px'
      }}>
        <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #555', paddingBottom: '8px' }}>Filters</h4>
        {uniqueCategories.map(cat => (
          <div key={cat} style={{ marginBottom: '10px' }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" checked={activeCategories.includes(cat)} onChange={() => handleCategoryToggle(cat)} style={{ marginRight: '10px', cursor: 'pointer' }}/>
              <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: CATEGORY_COLORS[cat] || '#ffffff', borderRadius: '50%', marginRight: '8px', border: '1px solid #000' }}></span>
              <span style={{ fontSize: '14px' }}>{cat}</span>
            </label>
          </div>
        ))}
      </div>

      {/* TIMELINE SLIDER (Bottom Center) */}
      <div style={{
        position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
        backgroundColor: 'rgba(45, 45, 45, 0.9)', padding: '15px 30px',
        borderRadius: '8px', color: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.5)', width: '300px', textAlign: 'center'
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontFamily: 'sans-serif' }}>Event Timeline</h4>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#ff4444', fontWeight: 'bold' }}>
          Showing events for: {activeDate || (isLoading ? 'Searching...' : 'No Data')}
        </p>
        <input 
          type="range" min="0" max={Math.max(0, uniqueDates.length - 1)} 
          value={selectedDateIndex} onChange={(e) => setSelectedDateIndex(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }} disabled={uniqueDates.length === 0}
        />
      </div>

      {/* THE MAP */}
      <MapContainer center={[20, 0]} zoom={2} minZoom={2} maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' noWrap={true} />
        {filteredData && filteredData.features.length > 0 && (
          <GeoJSON key={`geojson-${activeDate}-${activeCategories.length}`} data={filteredData} pointToLayer={pointToLayer} onEachFeature={onEachFeature} />
        )}
      </MapContainer>
    </div>
  );
}

export default App;
