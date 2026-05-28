import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
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
  // --- GDELT State ---
  const [geoData, setGeoData] = useState(null);
  const [timeframe, setTimeframe] = useState("7");
  const [keywordInput, setKeywordInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- POLYKRATIA Volatility State ---
  const [kalshiData, setKalshiData] = useState([]);
  
  // --- LINKED BRUSHING State ---
  const [hoveredTime, setHoveredTime] = useState(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    try {
      // 1. Fetch Geographic GDELT Data
      const geoUrl = `/api/events?days=${timeframe}&keyword=${encodeURIComponent(keywordInput)}`;
      const geoResponse = await fetch(geoUrl);
      const geoJson = await geoResponse.json();
      setGeoData(geoJson);

      // 2. Fetch Financial Volatility Data (Point this to your FastAPI host)
      const volUrl = `http://localhost:8001/api/v1/kalshi/volatility?limit=100`;
      const volResponse = await fetch(volUrl);
      const volJson = await volResponse.json();
      
      // Recharts plots left-to-right, so we reverse the descending DB data
      setKalshiData(volJson.reverse());

    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // GeoJSON Styling logic (Reacts to the chart hover!)
  const geoJsonStyle = (feature) => {
    const isHovered = hoveredTime && feature.properties.date === hoveredTime;
    
    return {
      radius: isHovered ? 12 : 6, // Pulse larger if hovered on chart
      fillColor: isHovered ? '#ffff00' : CATEGORY_COLORS[feature.properties.category] || CATEGORY_COLORS['Other'],
      color: isHovered ? '#ffffff' : '#000',
      weight: isHovered ? 2 : 1,
      opacity: 1,
      fillOpacity: isHovered ? 1.0 : 0.6 // Dim non-hovered items
    };
  };

// Trigger the initial data fetch when the application loads
  useEffect(() => {
    fetchDashboardData(); //  Updated to match your async function
  }, []);

  return (
    // Main Container: Flex Column for Stacking
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#121212', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* HEADER / CONTROLS */}
      <div style={{ padding: '15px 30px', backgroundColor: '#1e1e1e', display: 'flex', gap: '20px', alignItems: 'center', borderBottom: '1px solid #333' }}>
        <h2 style={{ margin: 0, color: '#f97316' }}>POLYGON INSTABILITY DASHBOARD</h2>
        <input 
          type="text" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
          placeholder="Filter events (e.g., 'drone', 'election')"
          style={{ padding: '8px', borderRadius: '4px', border: 'none', background: '#2d2d2d', color: 'white' }}
        />
        <button onClick={fetchDashboardData} disabled={isLoading} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {isLoading ? 'SYNCING...' : 'SYNC DATA'}
        </button>
      </div>

      {/* TOP HALF: THE GDELT MAP */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={[20, 0]} zoom={2} minZoom={2} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          
          {geoData && (
            <GeoJSON 
              key={`${geoData.features.length}-${hoveredTime}`} // Force re-render on hover
              data={geoData} 
              pointToLayer={(feature, latlng) => L.circleMarker(latlng, geoJsonStyle(feature))}
            />
          )}
        </MapContainer>
      </div>

      {/* BOTTOM HALF: THE FINANCIAL CHARTS */}
      <div style={{ height: '350px', display: 'flex', gap: '20px', padding: '20px', backgroundColor: '#1e1e1e', borderTop: '2px solid #333' }}>
        
        {/* CHART 1: Volume Spikes */}
        <div style={{ flex: 1, backgroundColor: '#121212', borderRadius: '8px', padding: '10px' }}>
          <h4 style={{ margin: '0 0 10px 10px', color: '#aaa' }}>Kalshi Market Volume</h4>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart 
              data={kalshiData}
	      onMouseMove={(e) => { 
                if (e && e.activePayload && e.activePayload[0]) { 
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
		  setHoveredTime(e.activePayload[0].payload.time.substring(0, 10));
		}
	      }}
              onMouseLeave={() => setHoveredTime(null)}
	    >
              <XAxis dataKey="time" tick={{fill: '#666', fontSize: 12}} />
              <YAxis tick={{fill: '#666', fontSize: 12}} />
              <RechartsTooltip contentStyle={{ backgroundColor: '#2d2d2d', border: 'none' }} />
              <Line type="monotone" dataKey="price_spread_cents" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

export default App;
