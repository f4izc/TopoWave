import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import Plotly from "plotly.js-basic-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import { Toaster, toast } from "sonner";
import { Radio, Target, Mountain, Compass, Ruler, AlertTriangle, CheckCircle, Settings, Info, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const Plot = createPlotlyComponent(Plotly);

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

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

// Convert lat/lon to Maidenhead locator (6 characters)
const latLonToMaidenhead = (lat, lon) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWX";
  
  lon = lon + 180;
  lat = lat + 90;
  
  const field_lon = Math.floor(lon / 20);
  const field_lat = Math.floor(lat / 10);
  
  const square_lon = Math.floor((lon % 20) / 2);
  const square_lat = Math.floor(lat % 10);
  
  const subsquare_lon = Math.floor((lon % 2) * 12);
  const subsquare_lat = Math.floor((lat % 1) * 24);
  
  return (
    chars[field_lon] +
    chars[field_lat] +
    square_lon.toString() +
    square_lat.toString() +
    chars[subsquare_lon].toLowerCase() +
    chars[subsquare_lat].toLowerCase()
  );
};

// Map picker component
const MapPicker = ({ position, onSelect }) => {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });
  
  return position ? <Marker position={position} /> : null;
};

// Map Dialog component
const MapDialog = ({ open, onClose, onSelect, title, initialPosition }) => {
  const [position, setPosition] = useState(initialPosition);
  
  const handleSelect = (latlng) => {
    setPosition([latlng.lat, latlng.lng]);
  };
  
  const handleConfirm = () => {
    if (position) {
      const locator = latLonToMaidenhead(position[0], position[1]);
      onSelect(locator.toUpperCase(), position);
      onClose();
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[95vw] h-[80vh] flex flex-col bg-card border-border p-0">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle className="font-heading text-primary tracking-widest flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 relative">
          <MapContainer
            center={position || [48.8566, 2.3522]}
            zoom={6}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapPicker position={position} onSelect={handleSelect} />
          </MapContainer>
          {position && (
            <div className="absolute bottom-4 left-4 bg-card/95 border border-border p-3 z-[1000] font-mono text-sm">
              <div className="text-muted-foreground text-xs mb-1">POSITION SELECTIONNEE</div>
              <div className="text-primary font-bold">{latLonToMaidenhead(position[0], position[1]).toUpperCase()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {position[0].toFixed(4)}°, {position[1].toFixed(4)}°
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-none border-border text-muted-foreground hover:bg-muted"
            data-testid="map-cancel-btn"
          >
            ANNULER
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!position}
            className="rounded-none bg-primary text-black hover:bg-primary/80 disabled:opacity-50"
            data-testid="map-confirm-btn"
          >
            CONFIRMER
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function App() {
  // Form state
  const [locatorA, setLocatorA] = useState(() => localStorage.getItem(LS_KEYS.LOCATOR_A) || "");
  const [locatorB, setLocatorB] = useState(() => localStorage.getItem(LS_KEYS.LOCATOR_B) || "");
  const [heightA, setHeightA] = useState(() => parseFloat(localStorage.getItem(LS_KEYS.HEIGHT_A)) || 10);
  const [heightB, setHeightB] = useState(() => parseFloat(localStorage.getItem(LS_KEYS.HEIGHT_B)) || 10);
  const [numPoints, setNumPoints] = useState(() => parseInt(localStorage.getItem(LS_KEYS.NUM_POINTS)) || 50);
  const [band, setBand] = useState(() => localStorage.getItem(LS_KEYS.BAND) || "");

  // Map dialog state
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [mapDialogStation, setMapDialogStation] = useState(null); // 'A' or 'B'

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

  const openMapDialog = (station) => {
    setMapDialogStation(station);
    setMapDialogOpen(true);
  };

  const handleMapSelect = (locator) => {
    if (mapDialogStation === 'A') {
      setLocatorA(locator);
    } else {
      setLocatorB(locator);
    }
  };

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
      font: { color: "#888", family: "JetBrains Mono", size: 10 },
      margin: { t: 20, r: 20, b: 40, l: 50 },
      xaxis: {
        title: { text: "Distance (km)", font: { color: "#888", size: 10 } },
        gridcolor: "#222",
        zerolinecolor: "#333",
        tickfont: { color: "#888", size: 9 },
      },
      yaxis: {
        title: { text: "Altitude (m)", font: { color: "#888", size: 10 } },
        gridcolor: "#222",
        zerolinecolor: "#333",
        tickfont: { color: "#888", size: 9 },
        range: [Math.max(0, minElevation - 50), maxElevation + 100],
      },
      legend: {
        orientation: "h",
        y: -0.2,
        x: 0.5,
        xanchor: "center",
        font: { color: "#888", size: 9 },
        bgcolor: "rgba(0,0,0,0)",
      },
      hovermode: "x unified",
      hoverlabel: {
        bgcolor: "#0A0A0A",
        bordercolor: "#333",
        font: { color: "#E0E0E0", family: "JetBrains Mono", size: 10 },
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
        
        {/* Map Dialog */}
        <MapDialog
          open={mapDialogOpen}
          onClose={() => setMapDialogOpen(false)}
          onSelect={handleMapSelect}
          title={`SELECTIONNER STATION ${mapDialogStation}`}
          initialPosition={null}
        />
        
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50" data-testid="header">
          <div className="container mx-auto px-3 md:px-4 h-12 md:h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Radio className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              <h1 className="text-base md:text-lg font-heading tracking-widest text-primary">TOPOWAVE</h1>
            </div>
            <div className="text-[10px] md:text-xs text-muted-foreground font-mono hidden sm:block">
              K = 4/3 Earth Model
            </div>
          </div>
        </header>

        <main className="container mx-auto p-3 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
            {/* Input Panel */}
            <aside className="lg:col-span-3 space-y-3 md:space-y-4" data-testid="input-panel">
              {/* Station A */}
              <div className="bg-card/50 border border-border p-3 md:p-4 corner-brackets">
                <h2 className="text-xs md:text-sm font-heading tracking-widest text-muted-foreground mb-3 md:mb-4 flex items-center gap-2">
                  <Target className="w-3 h-3 md:w-4 md:h-4" />
                  STATION A
                </h2>
                <div className="space-y-2 md:space-y-3">
                  <div>
                    <Label className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">Locator</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        data-testid="locator-a-input"
                        value={locatorA}
                        onChange={(e) => setLocatorA(formatLocator(e.target.value))}
                        placeholder="JN18DQ"
                        className="tactical-input flex-1"
                        maxLength={8}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openMapDialog('A')}
                        className="rounded-none border-border hover:border-primary hover:text-primary shrink-0"
                        data-testid="map-picker-a-btn"
                      >
                        <MapPin className="w-4 h-4" />
                      </Button>
                    </div>
                    {locatorA && !validateLocator(locatorA) && (
                      <p className="text-[10px] md:text-xs text-destructive mt-1">Format invalide</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">
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

              {/* Station B */}
              <div className="bg-card/50 border border-border p-3 md:p-4 corner-brackets">
                <h2 className="text-xs md:text-sm font-heading tracking-widest text-muted-foreground mb-3 md:mb-4 flex items-center gap-2">
                  <Target className="w-3 h-3 md:w-4 md:h-4" />
                  STATION B
                </h2>
                <div className="space-y-2 md:space-y-3">
                  <div>
                    <Label className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">Locator</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        data-testid="locator-b-input"
                        value={locatorB}
                        onChange={(e) => setLocatorB(formatLocator(e.target.value))}
                        placeholder="IN96GC"
                        className="tactical-input flex-1"
                        maxLength={8}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => openMapDialog('B')}
                        className="rounded-none border-border hover:border-primary hover:text-primary shrink-0"
                        data-testid="map-picker-b-btn"
                      >
                        <MapPin className="w-4 h-4" />
                      </Button>
                    </div>
                    {locatorB && !validateLocator(locatorB) && (
                      <p className="text-[10px] md:text-xs text-destructive mt-1">Format invalide</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">
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

              {/* Parameters */}
              <div className="bg-card/50 border border-border p-3 md:p-4 corner-brackets">
                <h2 className="text-xs md:text-sm font-heading tracking-widest text-muted-foreground mb-3 md:mb-4 flex items-center gap-2">
                  <Settings className="w-3 h-3 md:w-4 md:h-4" />
                  PARAMETRES
                </h2>
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">
                        Points d'echantillonnage
                      </Label>
                      <span className="text-[10px] md:text-xs font-mono text-primary">{numPoints}</span>
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
                      <Label className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">
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
                      <SelectTrigger className="tactical-input text-xs md:text-sm" data-testid="band-select-trigger">
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

              {/* Calculate Button */}
              <Button
                data-testid="calculate-btn"
                onClick={calculatePath}
                disabled={loading || !validateLocator(locatorA) || !validateLocator(locatorB)}
                className="w-full h-11 md:h-12 rounded-none bg-primary text-black font-bold uppercase tracking-wider font-mono transition-all active:scale-95 hover:bg-primary/90 disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground"
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
            <div className="lg:col-span-9 space-y-3 md:space-y-4">
              {/* Metrics Bar */}
              {result && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3" data-testid="metrics-bar">
                  <div className="metric-card corner-brackets">
                    <div className="metric-label flex items-center gap-1">
                      <Ruler className="w-3 h-3" /> Distance
                    </div>
                    <div className="metric-value text-lg md:text-2xl" data-testid="distance-value">
                      {result.distance_km}
                      <span className="metric-unit">km</span>
                    </div>
                  </div>
                  <div className="metric-card corner-brackets">
                    <div className="metric-label flex items-center gap-1">
                      <Compass className="w-3 h-3" /> Azimut A→B
                    </div>
                    <div className="metric-value text-secondary text-lg md:text-2xl" data-testid="azimuth-ab-value">
                      {result.azimuth_ab}
                      <span className="metric-unit">°</span>
                    </div>
                  </div>
                  <div className="metric-card corner-brackets">
                    <div className="metric-label flex items-center gap-1">
                      <Compass className="w-3 h-3" /> Azimut B→A
                    </div>
                    <div className="metric-value text-secondary text-lg md:text-2xl" data-testid="azimuth-ba-value">
                      {result.azimuth_ba}
                      <span className="metric-unit">°</span>
                    </div>
                  </div>
                  <div className="metric-card corner-brackets hidden sm:block">
                    <div className="metric-label">Altitude A</div>
                    <div className="metric-value text-muted-foreground text-base md:text-lg" data-testid="elevation-a-value">
                      {result.station_a.elevation}
                      <span className="metric-unit">m</span>
                    </div>
                  </div>
                  <div className={`metric-card col-span-2 sm:col-span-1 ${result.is_clear ? 'status-clear' : 'status-obstructed'}`}>
                    <div className="metric-label flex items-center gap-1">
                      {result.is_clear ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      Status
                    </div>
                    <div className={`metric-value text-base md:text-lg font-bold ${result.is_clear ? 'text-green-500' : 'text-red-500'}`} data-testid="status-value">
                      {result.is_clear ? "CLEAR" : "OBSTRUCTED"}
                    </div>
                  </div>
                </div>
              )}

              {/* Chart Area */}
              <div className="bg-black border border-border relative overflow-hidden scanlines" data-testid="chart-container">
                <div className="absolute top-2 left-2 text-[10px] md:text-xs font-mono text-muted-foreground z-20">
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
                    style={{ width: '100%', height: window.innerWidth < 768 ? '300px' : '400px' }}
                    useResizeHandler
                  />
                ) : (
                  <div className="h-[300px] md:h-[400px] flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Mountain className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 opacity-20" />
                      <p className="text-xs md:text-sm font-mono">Entrez les locators et calculez le profil</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Fresnel Info */}
              {result && result.fresnel_clearance_percent !== null && (
                <div className="bg-card/50 border border-warning/30 p-2 md:p-3 flex items-center gap-2 md:gap-3" data-testid="fresnel-info">
                  <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${result.fresnel_clearance_percent >= 60 ? 'bg-primary' : result.fresnel_clearance_percent >= 40 ? 'bg-warning' : 'bg-destructive'}`} />
                  <div className="text-xs md:text-sm">
                    <span className="text-muted-foreground">Zone Fresnel ({result.band}):</span>
                    <span className={`ml-2 font-mono font-bold ${result.fresnel_clearance_percent >= 60 ? 'text-primary' : result.fresnel_clearance_percent >= 40 ? 'text-warning' : 'text-destructive'}`}>
                      {result.fresnel_clearance_percent}% de dégagement
                    </span>
                    <span className="text-muted-foreground ml-2 hidden sm:inline">
                      {result.fresnel_clearance_percent >= 60 ? '(Excellent)' : result.fresnel_clearance_percent >= 40 ? '(Acceptable)' : '(Risque de diffraction)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-destructive/10 border border-destructive p-3 md:p-4 text-destructive text-xs md:text-sm font-mono" data-testid="error-display">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  {error}
                </div>
              )}

              {/* Info Panel */}
              <div className="bg-card/30 border border-border p-3 md:p-4 text-[10px] md:text-xs text-muted-foreground font-mono space-y-1">
                <p>Modele: Terre 4/3 (Reff = 8500 km) pour simulation de réfraction VHF+</p>
                <p>API Elevation: Open-TopoData (SRTM 30m)</p>
                {result && (
                  <p className="truncate">
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
