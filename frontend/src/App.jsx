import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CATEGORY_COLORS = {
  'Armed Conflict / Violence': '#ef4444', // Red
  'Protest / Unrest': '#f97316',          // Orange
  'Coercion / Force Posture': '#eab308',  // Yellow
  'Diplomatic Tension': '#3b82f6',        // Blue
  'Other': '#9ca3af'                      // Gray
};

function App() {
  // --- GDELT FILTER STATE (From App1) ---
  const [geoData, setGeoData] = useState(null);
  const [timeframe, setTimeframe] = useState("7");
  const [keywordInput, setKeywordInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- MAP UI STATE (From App1) ---
  const [uniqueDates, setUniqueDates] = useState([]);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [uniqueCategories, setUniqueCategories] = useState([]);
  const [activeCategories, setActiveCategories] = useState([]);

  // --- FINANCIAL VOLATILITY STATE (From App2) ---
  const [kalshiData, setKalshiData] = useState([]);
  const [hoveredTime, setHoveredTime] = useState(null);

  // --- THE MERGE LOGIC ---
  // If the user is hovering over a chart, the map shows that day. 
  // Otherwise, it relies on where the slider is set.
  const sliderDate = uniqueDates[selectedDateIndex] || null;
  const effectiveDate = hoveredTime || sliderDate;

  // --- DATA INGESTION ---
  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    // --- 1. Fetch Geographic GDELT Data ---
    try {
      const geoUrl = `/api/events?days=${timeframe}&keyword=${encodeURIComponent(keywordInput)}`;
      const geoResponse = await fetch(geoUrl);
      if (geoResponse.ok) {
         const geoJson = await geoResponse.json();
         setGeoData(geoJson);

         // ---- RESTORED TIMELINE & VECTOR LOGIC ----
         if (geoJson.features && geoJson.features.length > 0) {
             // 1. Extract and sort unique dates
             const dates = [...new Set(geoJson.features.map(f => f.properties.date))].sort();
             setUniqueDates(dates);
             setSelectedDateIndex(Math.max(0, dates.length - 1)); // Auto-select the latest date

             // 2. Extract unique threat categories
             const categories = [...new Set(geoJson.features.map(f => f.properties.category))];
             setUniqueCategories(categories);
             setActiveCategories(categories); // Toggle all threat vectors ON by default
         } else {
             // Handle empty search results gracefully
             setUniqueDates([]);
             setUniqueCategories([]);
             setActiveCategories([]);
         }
         // ------------------------------------------

      } else {
         console.error("GDELT fetch returned status:", geoResponse.status);
      }
    } catch (err) {
      console.error("GDELT Fetch Error:", err);
    }

    // --- 2. Fetch Kalshi Data ---
    try {
      const volUrl = `/api/v1/kalshi/volatility?limit=100`;
      const kalshiResponse = await fetch(volUrl);
      if (kalshiResponse.ok) {
         const kalshiJson = await kalshiResponse.json();
         setKalshiData(kalshiJson);
      } else {
         console.error("Kalshi fetch returned status:", kalshiResponse.status);
         setKalshiData([]); // Prevent Recharts from crashing on null
      }
    } catch (err) {
      console.error("Kalshi Fetch Error:", err);
      setKalshiData([]); // Prevent Recharts from crashing on null
    }

    setIsLoading(false);
  };
  // Auto-fetch on initial mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --- LEAFLET RENDER LOGIC ---
  const pointToLayer = (feature, latlng) => {
    // If we are actively hovering a chart, pulse the matching nodes
    const isHovered = hoveredTime && feature.properties.date === hoveredTime;
    const baseColor = CATEGORY_COLORS[feature.properties.category] || CATEGORY_COLORS['Other'];
    
    return L.circleMarker(latlng, {
      radius: isHovered ? 12 : 6,
      fillColor: isHovered ? '#ffff00' : baseColor, // Pulse yellow on hover
      color: isHovered ? '#ffffff' : '#000',
      weight: isHovered ? 2 : 1,
      opacity: 1,
      fillOpacity: 0.8
    });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#121212', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* LEFT PANEL: THE MAP & OVERLAYS */}
      <div style={{ flex: 2, position: 'relative' }}>
        
        {/* OVERLAY 1: Category Toggles */}
        <div style={{ 
          position: 'absolute', top: '20px', right: '20px', zIndex: 1000,
          backgroundColor: 'rgba(45, 45, 45, 0.9)', padding: '15px',
          borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.5)'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Threat Vectors</h4>
          {uniqueCategories.map(category => (
            <label key={category} style={{ display: 'block', marginBottom: '5px', cursor: 'pointer', fontSize: '14px' }}>
              <input 
                type="checkbox" 
                checked={activeCategories.includes(category)}
                onChange={(e) => {
                  if (e.target.checked) setActiveCategories([...activeCategories, category]);
                  else setActiveCategories(activeCategories.filter(c => c !== category));
                }}
                style={{ marginRight: '8px' }}
              />
              <span style={{ color: CATEGORY_COLORS[category] || '#fff', fontWeight: 'bold' }}>■</span> {category}
            </label>
          ))}
        </div>

        {/* OVERLAY 2: Timeline Slider */}
        <div style={{ 
          position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          backgroundColor: 'rgba(45, 45, 45, 0.9)', padding: '15px 30px',
          borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.5)', width: '350px', textAlign: 'center'
        }}>
          <h4 style={{ margin: '0 0 5px 0' }}>Event Timeline</h4>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#ff4444', fontWeight: 'bold' }}>
            Showing: {effectiveDate || (isLoading ? 'Searching...' : 'No Data')}
            {hoveredTime && <span style={{color: '#ffff00', marginLeft: '10px'}}>(Chart Hover Active)</span>}
          </p>
          <input 
            type="range" min="0" max={Math.max(0, uniqueDates.length - 1)} 
            value={selectedDateIndex} 
            onChange={(e) => setSelectedDateIndex(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }} 
            disabled={uniqueDates.length === 0 || hoveredTime !== null} // Disable slider if hovering chart
          />
        </div>

        {/* THE MAP */}
        <MapContainer center={[20, 0]} zoom={2} minZoom={2} maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0} style={{ height: '100%', width: '100%', zIndex: 1 }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {geoData && (
            <GeoJSON 
              key={`${effectiveDate}-${activeCategories.join('-')}`} // Force re-render on state change
              data={geoData} 
              pointToLayer={pointToLayer}
              filter={(feature) => {
                // 1. Must match active checkboxes
                if (!activeCategories.includes(feature.properties.category)) return false;
                // 2. Must match the current timeline (or hovered chart time)
                if (effectiveDate && feature.properties.date !== effectiveDate) return false;
                return true;
              }}
              onEachFeature={(feature, layer) => {
                layer.bindPopup(`
                  <div style="color: black;">
                    <b>${feature.properties.category}</b><br/>
                    Date: ${feature.properties.date}<br/>
                    Severity: ${feature.properties.severity}
                  </div>
                `);
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* RIGHT PANEL: TELEMETRY & CHARTS */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', borderLeft: '1px solid #333' }}>
        
        <div style={{ backgroundColor: '#2d2d2d', padding: '15px', borderRadius: '8px' }}>
          <h2 style={{ margin: '0 0 15px 0' }}>Polykratia Terminal</h2>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input 
              type="text" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} 
              placeholder="Keyword (e.g., protest, oil)" 
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', backgroundColor: '#121212', color: 'white' }}
            />
            <select 
              value={timeframe} onChange={(e) => setTimeframe(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: 'none', backgroundColor: '#121212', color: 'white' }}
            >
              <option value="1">24 Hours</option>
              <option value="7">7 Days</option>
              <option value="30">30 Days</option>
              <option value="365">1 Year</option>
            </select>
          </div>
          
          <button 
            onClick={fetchDashboardData} disabled={isLoading}
            style={{ width: '100%', padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {isLoading ? 'DOWNLOADING TELEMETRY...' : 'SYNC DATA'}
          </button>
        </div>

        {/* CHART 1: Volume Spikes */}
        <div style={{ flex: 1, backgroundColor: '#121212', borderRadius: '8px', padding: '10px' }}>
          <h4 style={{ margin: '0 0 10px 10px', color: '#aaa' }}>Kalshi Volume Anomalies</h4>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart 
              data={kalshiData} 
              onMouseMove={(e) => { 
                if (e && e.activePayload && e.activePayload[0]) { 
                  // Extract YYYY-MM-DD
                  setHoveredTime(e.activePayload[0].payload.time.substring(0, 10)); 
                } 
              }}
              onMouseLeave={() => setHoveredTime(null)}
            >
              <XAxis dataKey="time" tick={{fill: '#666', fontSize: 12}} />
              <YAxis tick={{fill: '#666', fontSize: 12}} />
              <RechartsTooltip contentStyle={{ backgroundColor: '#2d2d2d', border: 'none' }} />
              <Bar dataKey="volume" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CHART 2: Price Spread / Volatility */}
        <div style={{ flex: 1, backgroundColor: '#121212', borderRadius: '8px', padding: '10px' }}>
          <h4 style={{ margin: '0 0 10px 10px', color: '#aaa' }}>Kalshi Implied Volatility (Spread)</h4>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart 
              data={kalshiData}
              onMouseMove={(e) => { 
                if (e && e.activePayload && e.activePayload[0]) { 
                  // Extract YYYY-MM-DD
                  setHoveredTime(e.activePayload[0].payload.time.substring(0, 10)); 
                } 
              }}
              onMouseLeave={() => setHoveredTime(null)}
            >
              <XAxis dataKey="time" tick={{fill: '#666', fontSize: 12}} />
              <YAxis tick={{fill: '#666', fontSize: 12}} />
              <RechartsTooltip contentStyle={{ backgroundColor: '#2d2d2d', border: 'none' }} />
              <Line type="monotone" dataKey="price_spread_cents" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

export default App;
