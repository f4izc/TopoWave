import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import Plotly from "plotly.js-basic-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";

const Plot = createPlotlyComponent(Plotly);
import { Toaster, toast } from "sonner";
import { Radio, Target, Mountain, Compass, Ruler, AlertTriangle, CheckCircle, Settings, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// LocalStorage keys
const LS_KEYS = {
  LOCATOR_A: "vhf_locator_a",
  LOCATOR_B: "vhf_locator_b",
  HEIGHT_A: "vhf_height_a",
  HEIGHT_B: "vhf_height_b",
  NUM_POINTS: "vhf_num_points",
  BAND: "vhf_band",
};

// Amateur radio bands
const BANDS = [
  { id: "2m", name: "2m (144 MHz)", frequency: 144 },
  { id: "70cm", name: "70cm (432 MHz)", frequency: 432 },
  { id: "21cm", name: "21cm (1296 MHz)", frequency: 1296 },
  { id: "13cm", name: "13cm (2320 MHz)", frequency: 2320 },
  { id: "3cm", name: "3cm (10368 MHz)", frequency: 10368 },
];

// Validate Maidenhead locator
const validateLocator = (locator) => {
  if (!locator || locator.length < 4 || locator.length > 8 || locator.length % 2 !== 0) {
    return false;
  }
  const pattern = /^[A-Ra-r]{2}[0-9]{2}([A-Xa-x]{2}([0-9]{2})?)?$/;
  return pattern.test(locator);
};

// Format locator input
const formatLocator = (value) => {
  return value.toUpperCase().slice(0, 8);
};

function App() {
  // Form state
  const [locatorA, setLocatorA] = useState(() => localStorage.getItem(LS_KEYS.LOCATOR_A) || "");
  const [locatorB, setLocatorB] = useState(() => localStorage.getItem(LS_KEYS.LOCATOR_B) || "");
  const [heightA, setHeightA] = useState(() => parseFloat(localStorage.getItem(LS_KEYS.HEIGHT_A)) || 10);
  const [heightB, setHeightB] = useState(() => parseFloat(localStorage.getItem(LS_KEYS.HEIGHT_B)) || 10);
  const [numPoints, setNumPoints] = useState(() => parseInt(localStorage.getItem(LS_KEYS.NUM_POINTS)) || 50);
  const [band, setBand] = useState(() => localStorage.getItem(LS_KEYS.BAND) || "");

  // Results state
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEYS.LOCATOR_A, locatorA);
  }, [locatorA]);
  useEffect(() => {
    localStorage.setItem(LS_KEYS.LOCATOR_B, locatorB);
  }, [locatorB]);
  useEffect(() => {
    localStorage.setItem(LS_KEYS.HEIGHT_A, heightA.toString());
  }, [heightA]);
  useEffect(() => {
    localStorage.setItem(LS_KEYS.HEIGHT_B, heightB.toString());
  }, [heightB]);
  useEffect(() => {
    localStorage.setItem(LS_KEYS.NUM_POINTS, numPoints.toString());
  }, [numPoints]);
  useEffect(() => {
    localStorage.setItem(LS_KEYS.BAND, band);
  }, [band]);

  const calculatePath = useCallback(async () => {
    if (!validateLocator(locatorA)) {
      toast.error("Locator A invalide", { description: "Format: AA00aa ou AA00aa00" });
      return;
    }
    if (!validateLocator(locatorB)) {
      toast.error("Locator B invalide", { description: "Format: AA00aa ou AA00aa00" });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API}/calculate-path`, {
        locator_a: locatorA.toUpperCase(),
        locator_b: locatorB.toUpperCase(),
        height_a: heightA,
        height_b: heightB,
        num_points: numPoints,
        band: band || null,
      });
      setResult(response.data);
      if (response.data.is_clear) {
        toast.success("CLEAR PATH", { description: `Distance: ${response.data.distance_km} km` });
      } else {
        toast.error("OBSTRUCTED", { description: "Le trajet est obstrué par le relief" });
      }
    } catch (err) {
      const message = err.response?.data?.detail || "Erreur de calcul du profil";
      setError(message);
      toast.error("Erreur", { description: message });
    } finally {
      setLoading(false);
    }
  }, [locatorA, locatorB, heightA, heightB, numPoints, band]);

  // Build Plotly data
  const getPlotData = () => {
    if (!result) return { data: [], layout: {} };

    const profile = result.elevation_profile;
    const distances = profile.map((p) => p.distance_km);
    const elevations = profile.map((p) => p.elevation);
    const losHeights = profile.map((p) => p.los_height);

    const data = [
      // Terrain fill
      {
        x: distances,
        y: elevations,
        type: "scatter",
        mode: "lines",
        fill: "tozeroy",
        fillcolor: "rgba(0, 255, 65, 0.15)",
        line: { color: "#00FF41", width: 2 },
        name: "Terrain",
        hovertemplate: "Distance: %{x:.1f} km<br>Altitude: %{y:.0f} m<extra></extra>",
      },
      // Line of Sight
      {
        x: distances,
        y: losHeights,
        type: "scatter",
        mode: "lines",
        line: { color: "#FF3333", width: 2, dash: "dot" },
        name: "Ligne de visée",
        hovertemplate: "Distance: %{x:.1f} km<br>LoS: %{y:.0f} m<extra></extra>",
      },
    ];

    // Fresnel zone if band selected
    const hasFresnelData = result.band && profile.some((p) => p.fresnel_radius !== null);
    if (hasFresnelData) {
      const fresnelUpper = profile.map((p) => (p.fresnel_radius ? p.los_height + p.fresnel_radius : p.los_height));
      const fresnelLower = profile.map((p) => (p.fresnel_radius ? p.los_height - p.fresnel_radius : p.los_height));

      data.push({
        x: [...distances, ...distances.slice().reverse()],
        y: [...fresnelUpper, ...fresnelLower.slice().reverse()],
        type: "scatter",
        mode: "lines",
        fill: "toself",
        fillcolor: "rgba(255, 176, 0, 0.1)",
        line: { color: "rgba(255, 176, 0, 0.5)", width: 1 },
        name: `Zone Fresnel (${result.band})`,
        hoverinfo: "skip",
      });
    }

    // Obstruction marker
    if (result.obstruction_point) {
      data.push({
        x: [result.obstruction_point.distance_km],
        y: [result.obstruction_point.elevation],
        type: "scatter",
        mode: "markers",
        marker: { color: "#FF3333", size: 12, symbol: "x" },
        name: "Obstruction",
        hovertemplate: `Obstruction<br>Distance: ${result.obstruction_point.distance_km} km<br>Altitude: ${result.obstruction_point.elevation} m<extra></extra>`,
      });
    }

    // Station markers
    data.push({
      x: [0, result.distance_km],
      y: [result.station_a.elevation + result.station_a.antenna_height, result.station_b.elevation + result.station_b.antenna_height],
      type: "scatter",
      mode: "markers+text",
      marker: { color: "#00F0FF", size: 10, symbol: "triangle-up" },
      text: [result.station_a.locator, result.station_b.locator],
      textposition: "top center",
      textfont: { color: "#00F0FF", size: 10, family: "JetBrains Mono" },
      name: "Stations",
      hovertemplate: "%{text}<extra></extra>",
    });

    const maxElevation = Math.max(...elevations, ...losHeights);
    const minElevation = Math.min(...elevations);

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "#888", family: "JetBrains Mono", size: 11 },
      margin: { t: 30, r: 30, b: 50, l: 60 },
      xaxis: {
        title: { text: "Distance (km)", font: { color: "#888" } },
        gridcolor: "#222",
        zerolinecolor: "#333",
        tickfont: { color: "#888" },
      },
      yaxis: {
        title: { text: "Altitude (m)", font: { color: "#888" } },
        gridcolor: "#222",
        zerolinecolor: "#333",
        tickfont: { color: "#888" },
        range: [Math.max(0, minElevation - 50), maxElevation + 100],
      },
      legend: {
        orientation: "h",
        y: -0.15,
        x: 0.5,
        xanchor: "center",
        font: { color: "#888", size: 10 },
        bgcolor: "rgba(0,0,0,0)",
      },
      hovermode: "x unified",
      hoverlabel: {
        bgcolor: "#0A0A0A",
        bordercolor: "#333",
        font: { color: "#E0E0E0", family: "JetBrains Mono" },
      },
    };

    return { data, layout };
  };

  const { data: plotData, layout: plotLayout } = getPlotData();

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background tactical-grid">
        <Toaster position="top-right" theme="dark" toastOptions={{
          style: { background: '#0A0A0A', border: '1px solid #333', fontFamily: 'JetBrains Mono' }
        }} />
        
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50" data-testid="header">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="w-6 h-6 text-primary" />
              <h1 className="text-lg font-heading tracking-widest text-primary">VHF-SHF PATH PROFILER</h1>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              K = 4/3 Earth Model
            </div>
          </div>
        </header>

        <main className="container mx-auto p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Input Panel */}
            <aside className="lg:col-span-3 space-y-4" data-testid="input-panel">
              <div className="bg-card/50 border border-border p-4 corner-brackets">
                <h2 className="text-sm font-heading tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  STATION A
                </h2>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Locator</Label>
                    <Input
                      data-testid="locator-a-input"
                      value={locatorA}
                      onChange={(e) => setLocatorA(formatLocator(e.target.value))}
                      placeholder="JN18DQ"
                      className="tactical-input mt-1"
                      maxLength={8}
                    />
                    {locatorA && !validateLocator(locatorA) && (
                      <p className="text-xs text-destructive mt-1">Format invalide</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Hauteur antenne (m AGL)
                    </Label>
                    <Input
                      data-testid="height-a-input"
                      type="number"
                      value={heightA}
                      onChange={(e) => setHeightA(Math.max(0, Math.min(1000, parseFloat(e.target.value) || 0)))}
                      min={0}
                      max={1000}
                      className="tactical-input mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-card/50 border border-border p-4 corner-brackets">
                <h2 className="text-sm font-heading tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  STATION B
                </h2>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Locator</Label>
                    <Input
                      data-testid="locator-b-input"
                      value={locatorB}
                      onChange={(e) => setLocatorB(formatLocator(e.target.value))}
                      placeholder="IN96GC"
                      className="tactical-input mt-1"
                      maxLength={8}
                    />
                    {locatorB && !validateLocator(locatorB) && (
                      <p className="text-xs text-destructive mt-1">Format invalide</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                      Hauteur antenne (m AGL)
                    </Label>
                    <Input
                      data-testid="height-b-input"
                      type="number"
                      value={heightB}
                      onChange={(e) => setHeightB(Math.max(0, Math.min(1000, parseFloat(e.target.value) || 0)))}
                      min={0}
                      max={1000}
                      className="tactical-input mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-card/50 border border-border p-4 corner-brackets">
                <h2 className="text-sm font-heading tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  PARAMETRES
                </h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                        Points d'echantillonnage
                      </Label>
                      <span className="text-xs font-mono text-primary">{numPoints}</span>
                    </div>
                    <Slider
                      data-testid="num-points-slider"
                      value={[numPoints]}
                      onValueChange={([val]) => setNumPoints(val)}
                      min={10}
                      max={200}
                      step={10}
                      className="py-2"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                        Bande (Fresnel)
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px]">
                          <p className="text-xs">Sélectionner une bande pour afficher la zone de Fresnel</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={band} onValueChange={setBand} data-testid="band-select">
                      <SelectTrigger className="tactical-input" data-testid="band-select-trigger">
                        <SelectValue placeholder="Optionnel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {BANDS.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button
                data-testid="calculate-btn"
                onClick={calculatePath}
                disabled={loading || !validateLocator(locatorA) || !validateLocator(locatorB)}
                className="w-full h-12 rounded-none border-primary/50 text-primary hover:bg-primary hover:text-black uppercase tracking-wider font-mono transition-all active:scale-95 shadow-[0_0_10px_rgba(0,255,65,0.1)] hover:shadow-[0_0_15px_rgba(0,255,65,0.4)] disabled:opacity-50"
              >
                {loading ? (
                  <span className="loading-pulse">CALCUL EN COURS...</span>
                ) : (
                  <>
                    <Mountain className="w-4 h-4 mr-2" />
                    CALCULER LE PROFIL
                  </>
                )}
              </Button>
            </aside>

            {/* Main Content */}
            <div className="lg:col-span-9 space-y-4">
              {/* Metrics Bar */}
              {result && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="metrics-bar">
                  <div className="metric-card corner-brackets">
                    <div className="metric-label flex items-center gap-1">
                      <Ruler className="w-3 h-3" /> Distance
                    </div>
                    <div className="metric-value" data-testid="distance-value">
                      {result.distance_km}
                      <span className="metric-unit">km</span>
                    </div>
                  </div>
                  <div className="metric-card corner-brackets">
                    <div className="metric-label flex items-center gap-1">
                      <Compass className="w-3 h-3" /> Azimut A→B
                    </div>
                    <div className="metric-value text-secondary" data-testid="azimuth-ab-value">
                      {result.azimuth_ab}
                      <span className="metric-unit">°</span>
                    </div>
                  </div>
                  <div className="metric-card corner-brackets">
                    <div className="metric-label flex items-center gap-1">
                      <Compass className="w-3 h-3" /> Azimut B→A
                    </div>
                    <div className="metric-value text-secondary" data-testid="azimuth-ba-value">
                      {result.azimuth_ba}
                      <span className="metric-unit">°</span>
                    </div>
                  </div>
                  <div className="metric-card corner-brackets">
                    <div className="metric-label">Altitude A</div>
                    <div className="metric-value text-muted-foreground text-lg" data-testid="elevation-a-value">
                      {result.station_a.elevation}
                      <span className="metric-unit">m</span>
                    </div>
                  </div>
                  <div className={`metric-card ${result.is_clear ? 'status-clear' : 'status-obstructed'}`}>
                    <div className="metric-label flex items-center gap-1">
                      {result.is_clear ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      Status
                    </div>
                    <div className="metric-value text-inherit text-lg" data-testid="status-value">
                      {result.is_clear ? "CLEAR" : "OBSTRUCTED"}
                    </div>
                  </div>
                </div>
              )}

              {/* Chart Area */}
              <div className="bg-black border border-border relative overflow-hidden scanlines" data-testid="chart-container">
                <div className="absolute top-2 left-2 text-xs font-mono text-muted-foreground z-20">
                  TERRAIN PROFILE
                </div>
                {result ? (
                  <Plot
                    data={plotData}
                    layout={plotLayout}
                    config={{
                      responsive: true,
                      displayModeBar: true,
                      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                      displaylogo: false,
                    }}
                    style={{ width: '100%', height: '500px' }}
                    useResizeHandler
                  />
                ) : (
                  <div className="h-[500px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Mountain className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p className="text-sm font-mono">Entrez les locators et calculez le profil</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Fresnel Info */}
              {result && result.fresnel_clearance_percent !== null && (
                <div className="bg-card/50 border border-warning/30 p-3 flex items-center gap-3" data-testid="fresnel-info">
                  <div className={`w-3 h-3 rounded-full ${result.fresnel_clearance_percent >= 60 ? 'bg-primary' : result.fresnel_clearance_percent >= 40 ? 'bg-warning' : 'bg-destructive'}`} />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Zone Fresnel ({result.band}):</span>
                    <span className={`ml-2 font-mono font-bold ${result.fresnel_clearance_percent >= 60 ? 'text-primary' : result.fresnel_clearance_percent >= 40 ? 'text-warning' : 'text-destructive'}`}>
                      {result.fresnel_clearance_percent}% de dégagement
                    </span>
                    <span className="text-muted-foreground ml-2">
                      {result.fresnel_clearance_percent >= 60 ? '(Excellent)' : result.fresnel_clearance_percent >= 40 ? '(Acceptable)' : '(Risque de diffraction)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-destructive/10 border border-destructive p-4 text-destructive text-sm font-mono" data-testid="error-display">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  {error}
                </div>
              )}

              {/* Info Panel */}
              <div className="bg-card/30 border border-border p-4 text-xs text-muted-foreground font-mono space-y-1">
                <p>Modele: Terre 4/3 (Reff = 8500 km) pour simulation de réfraction VHF+</p>
                <p>API Elevation: Open-TopoData (SRTM 30m)</p>
                {result && (
                  <p>
                    Coordonnees: {result.station_a.locator} ({result.station_a.latitude}°, {result.station_a.longitude}°) →{" "}
                    {result.station_b.locator} ({result.station_b.latitude}°, {result.station_b.longitude}°)
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;
