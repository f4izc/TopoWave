import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "@/App.css";
import axios from "axios";
import Plotly from "plotly.js-basic-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import { Toaster, toast } from "sonner";
import { Radio, Target, Mountain, Compass, Ruler, AlertTriangle, CheckCircle, Settings, Info, MapPin, X, Share2, Copy, Search, Coffee, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-geosearch/dist/geosearch.css";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";

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
  { id: "6m", name: "6m (50 MHz)", frequency: 50 },
  { id: "4m", name: "4m (70 MHz)", frequency: 70 },
  { id: "2m", name: "2m (144 MHz)", frequency: 144 },
  { id: "1.25m", name: "1.25m (222 MHz)", frequency: 222 },
  { id: "70cm", name: "70cm (432 MHz)", frequency: 432 },
  { id: "23cm", name: "23cm (1296 MHz)", frequency: 1296 },
  { id: "13cm", name: "13cm (2320 MHz)", frequency: 2320 },
  { id: "3cm", name: "3cm (10368 MHz)", frequency: 10368 },
];

// Validate Maidenhead locator (6-10 characters)
const validateLocator = (locator) => {
  if (!locator || locator.length < 6 || locator.length > 10 || locator.length % 2 !== 0) {
    return false;
  }
  // Pattern: AA00aa[00][aa]
  const pattern = /^[A-Ra-r]{2}[0-9]{2}[A-Xa-x]{2}([0-9]{2})?([A-Xa-x]{2})?$/;
  return pattern.test(locator);
};

// Validate GPS coordinates
const validateCoordinates = (lat, lon) => {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  return !isNaN(latNum) && !isNaN(lonNum) && 
         latNum >= -90 && latNum <= 90 && 
         lonNum >= -180 && lonNum <= 180;
};

// Format locator input
const formatLocator = (value) => {
  return value.toUpperCase().slice(0, 10);
};

// Geocode address using backend proxy with autocomplete support
const searchAddresses = async (query) => {
  if (!query || query.trim().length < 3) return [];
  try {
    const response = await axios.get(
      `${API}/geocode?q=${encodeURIComponent(query)}&limit=5`
    );
    if (response.data && response.data.results) {
      return response.data.results;
    }
    return [];
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
};

// Convert lat/lon to Maidenhead locator (10 characters for precision)
const latLonToMaidenhead = (lat, lon, precision = 10) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWX";
  
  lon = lon + 180;
  lat = lat + 90;
  
  // Field (20° x 10°)
  const field_lon = Math.floor(lon / 20);
  const field_lat = Math.floor(lat / 10);
  
  // Square (2° x 1°)
  const square_lon = Math.floor((lon % 20) / 2);
  const square_lat = Math.floor(lat % 10);
  
  // Subsquare (5' x 2.5')
  const subsquare_lon = Math.floor((lon % 2) * 12);
  const subsquare_lat = Math.floor((lat % 1) * 24);
  
  let locator = (
    chars[field_lon] +
    chars[field_lat] +
    square_lon.toString() +
    square_lat.toString() +
    chars[subsquare_lon].toLowerCase() +
    chars[subsquare_lat].toLowerCase()
  );
  
  if (precision >= 8) {
    // Extended square (30" x 15")
    const ext_lon = Math.floor(((lon % 2) * 12 - subsquare_lon) * 10);
    const ext_lat = Math.floor(((lat % 1) * 24 - subsquare_lat) * 10);
    locator += ext_lon.toString() + ext_lat.toString();
  }
  
  if (precision >= 10) {
    // Sub-subsquare (3" x 1.5")
    const subsubsquare_lon = Math.floor((((lon % 2) * 12 - subsquare_lon) * 10 - Math.floor(((lon % 2) * 12 - subsquare_lon) * 10)) * 24);
    const subsubsquare_lat = Math.floor((((lat % 1) * 24 - subsquare_lat) * 10 - Math.floor(((lat % 1) * 24 - subsquare_lat) * 10)) * 24);
    locator += chars[subsubsquare_lon].toLowerCase() + chars[subsubsquare_lat].toLowerCase();
  }
  
  return locator.toUpperCase();
};

// Search control component for Leaflet
const SearchControl = ({ onLocationFound }) => {
  const map = useMap();
  
  useEffect(() => {
    const provider = new OpenStreetMapProvider();
    
    const searchControl = new GeoSearchControl({
      provider: provider,
      style: 'bar',
      showMarker: false,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      keepResult: false,
      searchLabel: 'Rechercher une adresse...',
    });
    
    map.addControl(searchControl);
    
    map.on('geosearch/showlocation', (result) => {
      if (result.location) {
        onLocationFound([result.location.y, result.location.x]);
      }
    });
    
    return () => {
      map.removeControl(searchControl);
    };
  }, [map, onLocationFound]);
  
  return null;
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
    if (Array.isArray(latlng)) {
      setPosition(latlng);
    } else {
      setPosition([latlng.lat, latlng.lng]);
    }
  };
  
  const handleConfirm = () => {
    if (position) {
      const locator = latLonToMaidenhead(position[0], position[1], 10);
      onSelect(locator, position);
      onClose();
    }
  };
  
  // Reset position when dialog opens
  useEffect(() => {
    if (open) {
      setPosition(initialPosition);
    }
  }, [open, initialPosition]);
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[95vw] h-[80vh] flex flex-col bg-card border-border p-0 z-[9999]">
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
            <SearchControl onLocationFound={handleSelect} />
            <MapPicker position={position} onSelect={handleSelect} />
          </MapContainer>
          {position && (
            <div className="absolute bottom-4 left-4 bg-card/95 border border-border p-3 z-[1000] font-mono text-sm">
              <div className="text-muted-foreground text-xs mb-1">POSITION SELECTIONNEE</div>
              <div className="text-primary font-bold text-lg">{latLonToMaidenhead(position[0], position[1], 10)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {position[0].toFixed(6)}°, {position[1].toFixed(6)}°
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

// Share Dialog component
const ShareDialog = ({ open, onClose, shareUrl }) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Lien copié !", { description: "Le lien a été copié dans le presse-papier" });
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-heading text-primary tracking-widest flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            PARTAGER CE PROFIL
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Partagez ce lien pour permettre à d'autres radioamateurs de voir ce profil de terrain :
          </p>
          <div className="flex gap-2">
            <Input
              value={shareUrl}
              readOnly
              className="tactical-input flex-1 text-xs"
              data-testid="share-url-input"
            />
            <Button
              onClick={copyToClipboard}
              className="rounded-none bg-primary text-black hover:bg-primary/80 shrink-0"
              data-testid="copy-share-btn"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Path Map component - shows the line between two stations
const FitBoundsComponent = ({ stationA, stationB, obstructionPoint, showObstruction }) => {
  const map = useMap();
  
  useEffect(() => {
    if (showObstruction && obstructionPoint) {
      map.setView([obstructionPoint.latitude, obstructionPoint.longitude], 12);
    } else {
      const bounds = L.latLngBounds(
        [stationA.latitude, stationA.longitude],
        [stationB.latitude, stationB.longitude]
      );
      if (obstructionPoint) {
        bounds.extend([obstructionPoint.latitude, obstructionPoint.longitude]);
      }
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, stationA, stationB, obstructionPoint, showObstruction]);
  
  return null;
};

const PathMap = ({ stationA, stationB, obstructionPoint, showObstruction, onObstructionClose }) => {
  const centerLat = (stationA.latitude + stationB.latitude) / 2;
  const centerLon = (stationA.longitude + stationB.longitude) / 2;
  
  // Custom icons
  const stationIcon = new L.DivIcon({
    className: 'custom-marker',
    html: '<div style="background:#00F0FF;width:12px;height:12px;border-radius:50%;border:2px solid #000;box-shadow:0 0 10px #00F0FF;"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
  
  const obstructionIcon = new L.DivIcon({
    className: 'custom-marker',
    html: '<div style="background:#FF3333;width:16px;height:16px;border-radius:50%;border:2px solid #000;box-shadow:0 0 10px #FF3333;display:flex;align-items:center;justify-content:center;color:#000;font-weight:bold;font-size:10px;">X</div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  
  return (
    <div className="bg-card/50 border border-border" data-testid="path-map">
      <div className="p-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">CARTE DU TRAJET</span>
        {showObstruction && obstructionPoint && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onObstructionClose}
            className="h-6 px-2 text-xs text-warning"
          >
            <X className="w-3 h-3 mr-1" /> Fermer obstruction
          </Button>
        )}
      </div>
      <div style={{ height: "250px" }}>
        <MapContainer
          center={[centerLat, centerLon]}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <FitBoundsComponent 
            stationA={stationA} 
            stationB={stationB} 
            obstructionPoint={obstructionPoint}
            showObstruction={showObstruction}
          />
          {/* Station A marker */}
          <Marker position={[stationA.latitude, stationA.longitude]} icon={stationIcon}>
          </Marker>
          {/* Station B marker */}
          <Marker position={[stationB.latitude, stationB.longitude]} icon={stationIcon}>
          </Marker>
          {/* Path line */}
          <Polyline
            positions={[
              [stationA.latitude, stationA.longitude],
              [stationB.latitude, stationB.longitude]
            ]}
            color="#00FF41"
            weight={2}
            opacity={0.8}
            dashArray="5, 10"
          />
          {/* Obstruction marker */}
          {obstructionPoint && (
            <Marker position={[obstructionPoint.latitude, obstructionPoint.longitude]} icon={obstructionIcon}>
            </Marker>
          )}
        </MapContainer>
      </div>
      <div className="p-2 border-t border-border text-[10px] font-mono text-muted-foreground flex flex-wrap gap-4">
        <span><span className="inline-block w-2 h-2 rounded-full bg-[#00F0FF] mr-1"></span>{stationA.locator} ({stationA.latitude.toFixed(4)}°, {stationA.longitude.toFixed(4)}°)</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-[#00F0FF] mr-1"></span>{stationB.locator} ({stationB.latitude.toFixed(4)}°, {stationB.longitude.toFixed(4)}°)</span>
        {obstructionPoint && (
          <span className="text-destructive"><span className="inline-block w-2 h-2 rounded-full bg-destructive mr-1"></span>Obstruction ({obstructionPoint.latitude.toFixed(4)}°, {obstructionPoint.longitude.toFixed(4)}°)</span>
        )}
      </div>
    </div>
  );
};

function App() {
  // Parse URL parameters on load
  const getInitialValue = (key, urlParam, defaultValue, parser = (v) => v) => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlValue = urlParams.get(urlParam);
    if (urlValue !== null) {
      return parser(urlValue);
    }
    const lsValue = localStorage.getItem(key);
    if (lsValue !== null) {
      return parser(lsValue);
    }
    return defaultValue;
  };

  // Form state
  const [locatorA, setLocatorA] = useState(() => getInitialValue(LS_KEYS.LOCATOR_A, 'a', ''));
  const [locatorB, setLocatorB] = useState(() => getInitialValue(LS_KEYS.LOCATOR_B, 'b', ''));
  const [heightA, setHeightA] = useState(() => getInitialValue(LS_KEYS.HEIGHT_A, 'ha', 10, parseFloat));
  const [heightB, setHeightB] = useState(() => getInitialValue(LS_KEYS.HEIGHT_B, 'hb', 10, parseFloat));
  const [numPoints, setNumPoints] = useState(() => getInitialValue(LS_KEYS.NUM_POINTS, 'n', 50, parseInt));
  const [band, setBand] = useState(() => getInitialValue(LS_KEYS.BAND, 'band', ''));

  // Map dialog state
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [mapDialogStation, setMapDialogStation] = useState(null);
  
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  
  // Obstruction map state
  const [showObstructionOnMap, setShowObstructionOnMap] = useState(false);

  // Results state
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverWaking, setServerWaking] = useState(false);
  // Auto-calculate if URL has parameters (shared link)
  // Note: This effect is placed after calculatePath definition
  const [shouldAutoCalculate, setShouldAutoCalculateState] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('a') && urlParams.has('b');
  });

  // Input mode states for each station
  const [inputModeA, setInputModeA] = useState('locator');
  const [inputModeB, setInputModeB] = useState('locator');
  
  // Address input states
  const [addressA, setAddressA] = useState('');
  const [addressB, setAddressB] = useState('');
  const [addressLoadingA, setAddressLoadingA] = useState(false);
  const [addressLoadingB, setAddressLoadingB] = useState(false);
  const [addressSuggestionsA, setAddressSuggestionsA] = useState([]);
  const [addressSuggestionsB, setAddressSuggestionsB] = useState([]);
  const [showSuggestionsA, setShowSuggestionsA] = useState(false);
  const [showSuggestionsB, setShowSuggestionsB] = useState(false);
  
  // GPS input states
  const [latA, setLatA] = useState('');
  const [lonA, setLonA] = useState('');
  const [latB, setLatB] = useState('');
  const [lonB, setLonB] = useState('');
  
  // Methodology modal
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  // Debounced address search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (addressA.trim().length >= 3) {
        setAddressLoadingA(true);
        const results = await searchAddresses(addressA);
        setAddressSuggestionsA(results);
        setShowSuggestionsA(results.length > 0);
        setAddressLoadingA(false);
      } else {
        setAddressSuggestionsA([]);
        setShowSuggestionsA(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [addressA]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (addressB.trim().length >= 3) {
        setAddressLoadingB(true);
        const results = await searchAddresses(addressB);
        setAddressSuggestionsB(results);
        setShowSuggestionsB(results.length > 0);
        setAddressLoadingB(false);
      } else {
        setAddressSuggestionsB([]);
        setShowSuggestionsB(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [addressB]);

  // Handle focus on address input - trigger search if text is present
  const handleAddressFocus = async (station) => {
    const address = station === 'A' ? addressA : addressB;
    const suggestions = station === 'A' ? addressSuggestionsA : addressSuggestionsB;
    const setShowSuggestions = station === 'A' ? setShowSuggestionsA : setShowSuggestionsB;
    const setLoading = station === 'A' ? setAddressLoadingA : setAddressLoadingB;
    const setSuggestions = station === 'A' ? setAddressSuggestionsA : setAddressSuggestionsB;
    
    // If we already have suggestions, just show them
    if (suggestions.length > 0) {
      setShowSuggestions(true);
      return;
    }
    
    // If we have text but no suggestions, trigger a search
    if (address.trim().length >= 3) {
      setLoading(true);
      const results = await searchAddresses(address);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setLoading(false);
    }
  };

  // Handle address selection from suggestions
  const handleAddressSelect = (station, suggestion) => {
    const setLocator = station === 'A' ? setLocatorA : setLocatorB;
    const setAddress = station === 'A' ? setAddressA : setAddressB;
    const setShowSuggestions = station === 'A' ? setShowSuggestionsA : setShowSuggestionsB;
    
    const locator = latLonToMaidenhead(suggestion.lat, suggestion.lon, 10);
    setLocator(locator);
    setAddress(suggestion.display_name.split(',')[0]); // Keep short name
    setShowSuggestions(false);
    toast.success("Ville sélectionnée", { 
      description: `${locator} - ${suggestion.display_name.slice(0, 60)}...` 
    });
  };

  // Handle GPS coordinates input
  const handleGpsInput = (station) => {
    const lat = station === 'A' ? latA : latB;
    const lon = station === 'A' ? lonA : lonB;
    const setLocator = station === 'A' ? setLocatorA : setLocatorB;
    
    if (validateCoordinates(lat, lon)) {
      const locator = latLonToMaidenhead(parseFloat(lat), parseFloat(lon), 10);
      setLocator(locator);
      toast.success("Coordonnées converties", { description: `Locator: ${locator}` });
    } else {
      toast.error("Coordonnées invalides", { description: "Latitude: -90 à 90, Longitude: -180 à 180" });
    }
  };

  // Export results to CSV
  const exportToCSV = () => {
    if (!result) return;
    
    // Build CSV content
    const lines = [
      '# TopoWave - Profil de terrain',
      `# Station A: ${result.station_a.locator} (${result.station_a.latitude}, ${result.station_a.longitude})`,
      `# Station B: ${result.station_b.locator} (${result.station_b.latitude}, ${result.station_b.longitude})`,
      `# Distance: ${result.distance_km} km`,
      `# Azimut A->B: ${result.azimuth_ab}°, B->A: ${result.azimuth_ba}°`,
      `# Status: ${result.is_clear ? 'CLEAR' : 'OBSTRUCTED'}`,
      result.band ? `# Bande: ${result.band}` : '',
      '',
      'Distance_km,Latitude,Longitude,Elevation_m,LoS_Height_m,Fresnel_Radius_m,Obstructed'
    ].filter(Boolean);
    
    // Add data rows
    result.elevation_profile.forEach(point => {
      lines.push([
        point.distance_km,
        point.latitude,
        point.longitude,
        point.elevation,
        point.los_height,
        point.fresnel_radius || '',
        point.is_obstructed ? 'OUI' : 'NON'
      ].join(','));
    });
    
    // Create and download file
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `topowave_${result.station_a.locator}_${result.station_b.locator}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Export CSV", { description: "Fichier téléchargé" });
  };

  // Handle click on obstruction point in chart
  const handlePlotClick = (data) => {
    if (data.points && data.points[0]) {
      const point = data.points[0];
      // Check if clicked on obstruction marker (trace index 3 or has "Obstruction" name)
      if (point.data.name === "Obstruction" && result?.obstruction_point) {
        setShowObstructionOnMap(true);
      }
    }
  };

  // Generate share URL
  const shareUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (locatorA) params.set('a', locatorA);
    if (locatorB) params.set('b', locatorB);
    params.set('ha', heightA.toString());
    params.set('hb', heightB.toString());
    params.set('n', numPoints.toString());
    if (band && band !== 'none') params.set('band', band);
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [locatorA, locatorB, heightA, heightB, numPoints, band]);

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
      toast.error("Locator A invalide", { description: "Format: AA00aa, AA00aa00 ou AA00aa00aa (6-10 car.)" });
      return;
    }
    if (!validateLocator(locatorB)) {
      toast.error("Locator B invalide", { description: "Format: AA00aa, AA00aa00 ou AA00aa00aa (6-10 car.)" });
      return;
    }

    setLoading(true);
    setError(null);
    setServerWaking(false);

    // Timer to show "server waking up" message after 3 seconds
    const wakingTimer = setTimeout(() => {
      setServerWaking(true);
    }, 3000);

    try {
      const response = await axios.post(`${API}/calculate-path`, {
        locator_a: locatorA.toUpperCase(),
        locator_b: locatorB.toUpperCase(),
        height_a: heightA,
        height_b: heightB,
        num_points: numPoints,
        band: band || null,
      }, {
        timeout: 60000 // 60 seconds timeout for cold start
      });
      clearTimeout(wakingTimer);
      setServerWaking(false);
      setResult(response.data);
      if (response.data.is_clear) {
        toast.success("CLEAR PATH", { description: `Distance: ${response.data.distance_km} km` });
      }
    } catch (err) {
      clearTimeout(wakingTimer);
      setServerWaking(false);
      const message = err.response?.data?.detail || err.code === 'ECONNABORTED' 
        ? "Le serveur met trop de temps à répondre. Réessayez dans quelques secondes."
        : "Erreur de calcul du profil";
      setError(message);
      toast.error("Erreur", { description: message });
    } finally {
      setLoading(false);
    }
  }, [locatorA, locatorB, heightA, heightB, numPoints, band]);

  // Ref to store calculatePath for auto-calculate
  const calculatePathRef = useRef(calculatePath);
  calculatePathRef.current = calculatePath;

  // Auto-calculate if URL has parameters (shared link)
  useEffect(() => {
    if (shouldAutoCalculate && validateLocator(locatorA) && validateLocator(locatorB)) {
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
      setShouldAutoCalculateState(false);
      
      // Trigger calculation using ref to avoid dependency issues
      const timer = setTimeout(() => {
        calculatePathRef.current();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoCalculate, locatorA, locatorB]);

  // Build Plotly data
  const getPlotData = () => {
    if (!result) return { data: [], layout: {} };

    const profile = result.elevation_profile;
    const distances = profile.map((p) => p.distance_km);
    const elevations = profile.map((p) => p.elevation);
    const losHeights = profile.map((p) => p.los_height);

    const data = [
      {
        x: distances,
        y: elevations,
        customdata: profile.map((p) => [p.latitude, p.longitude]),
        type: "scatter",
        mode: "lines",
        fill: "tozeroy",
        fillcolor: "rgba(0, 255, 65, 0.15)",
        line: { color: "#00FF41", width: 2 },
        name: "Terrain",
        hovertemplate: "Distance: %{x:.1f} km<br>Altitude: %{y:.0f} m<br>GPS: %{customdata[0]:.5f}°, %{customdata[1]:.5f}°<extra></extra>",
      },
      {
        x: distances,
        y: losHeights,
        customdata: profile.map((p) => [p.latitude, p.longitude]),
        type: "scatter",
        mode: "lines",
        line: { color: "#FF3333", width: 2, dash: "dot" },
        name: "Ligne de visée",
        hovertemplate: "Distance: %{x:.1f} km<br>LoS: %{y:.0f} m<br>GPS: %{customdata[0]:.5f}°, %{customdata[1]:.5f}°<extra></extra>",
      },
    ];

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

    if (result.obstruction_point) {
      data.push({
        x: [result.obstruction_point.distance_km],
        y: [result.obstruction_point.elevation],
        customdata: [[result.obstruction_point.latitude, result.obstruction_point.longitude]],
        type: "scatter",
        mode: "markers",
        marker: { color: "#FF3333", size: 14, symbol: "x" },
        name: "Obstruction",
        hovertemplate: `<b>OBSTRUCTION</b><br>Distance: ${result.obstruction_point.distance_km} km<br>Altitude: ${result.obstruction_point.elevation} m<br>GPS: ${result.obstruction_point.latitude}°, ${result.obstruction_point.longitude}°<br><i>Cliquez pour voir sur la carte</i><extra></extra>`,
      });
    }

    data.push({
      x: [0, result.distance_km],
      y: [result.station_a.elevation + result.station_a.antenna_height, result.station_b.elevation + result.station_b.antenna_height],
      customdata: [
        [result.station_a.latitude, result.station_a.longitude],
        [result.station_b.latitude, result.station_b.longitude]
      ],
      type: "scatter",
      mode: "markers+text",
      marker: { color: "#00F0FF", size: 10, symbol: "triangle-up" },
      text: [result.station_a.locator, result.station_b.locator],
      textposition: "top center",
      textfont: { color: "#00F0FF", size: 10, family: "JetBrains Mono" },
      name: "Stations",
      hovertemplate: "%{text}<br>GPS: %{customdata[0]:.5f}°, %{customdata[1]:.5f}°<extra></extra>",
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
        
        {/* Share Dialog */}
        <ShareDialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          shareUrl={shareUrl}
        />
        
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50" data-testid="header">
          <div className="container mx-auto px-3 md:px-4 h-12 md:h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Radio className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              <h1 className="text-base md:text-lg font-heading tracking-widest text-primary">TOPOWAVE</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] md:text-xs text-muted-foreground font-mono hidden sm:block">
                K = 4/3 Earth Model
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShareDialogOpen(true)}
                className="rounded-none text-muted-foreground hover:text-primary hover:bg-transparent"
                data-testid="share-btn"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              {result && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={exportToCSV}
                  className="rounded-none text-muted-foreground hover:text-primary hover:bg-transparent"
                  data-testid="export-csv-btn"
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
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
                  <Tabs value={inputModeA} onValueChange={setInputModeA} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-background/50 h-8" data-testid="station-a-tabs">
                      <TabsTrigger value="locator" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-black" data-testid="tab-locator-a">Locator</TabsTrigger>
                      <TabsTrigger value="address" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-black" data-testid="tab-address-a">Ville</TabsTrigger>
                      <TabsTrigger value="gps" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-black" data-testid="tab-gps-a">GPS</TabsTrigger>
                    </TabsList>
                    <TabsContent value="locator" className="mt-2">
                      <div className="flex gap-2">
                        <Input
                          data-testid="locator-a-input"
                          value={locatorA}
                          onChange={(e) => setLocatorA(formatLocator(e.target.value))}
                          placeholder="JN18DQ96"
                          className="tactical-input flex-1"
                          maxLength={10}
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
                        <p className="text-[10px] text-destructive mt-1">Format: AA00aa (6-10 car.)</p>
                      )}
                      {locatorA && validateLocator(locatorA) && (
                        <p className="text-[10px] text-primary mt-1">✓ {locatorA}</p>
                      )}
                    </TabsContent>
                    <TabsContent value="address" className="mt-2">
                      <div className="relative">
                        <div className="flex gap-2">
                          <Input
                            value={addressA}
                            onChange={(e) => setAddressA(e.target.value)}
                            onFocus={() => handleAddressFocus('A')}
                            placeholder="Tour Eiffel, Paris..."
                            className="tactical-input flex-1"
                            data-testid="address-a-input"
                          />
                          {addressLoadingA && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        {showSuggestionsA && addressSuggestionsA.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-card border border-border max-h-48 overflow-y-auto">
                            {addressSuggestionsA.map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => handleAddressSelect('A', suggestion)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-primary/20 border-b border-border/50 last:border-b-0 transition-colors"
                                data-testid={`address-suggestion-a-${index}`}
                              >
                                <div className="text-foreground truncate">{suggestion.display_name.split(',')[0]}</div>
                                <div className="text-muted-foreground text-[10px] truncate">{suggestion.display_name.split(',').slice(1, 3).join(',')}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {locatorA && validateLocator(locatorA) && (
                        <p className="text-[10px] text-primary mt-1">→ {locatorA}</p>
                      )}
                    </TabsContent>
                    <TabsContent value="gps" className="mt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={latA}
                          onChange={(e) => setLatA(e.target.value)}
                          placeholder="Lat: 48.8566"
                          className="tactical-input text-xs"
                          data-testid="lat-a-input"
                        />
                        <Input
                          value={lonA}
                          onChange={(e) => setLonA(e.target.value)}
                          placeholder="Lon: 2.3522"
                          className="tactical-input text-xs"
                          data-testid="lon-a-input"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGpsInput('A')}
                        disabled={!validateCoordinates(latA, lonA)}
                        className="w-full mt-2 rounded-none border-border hover:border-primary hover:text-primary text-xs h-8"
                        data-testid="gps-convert-a-btn"
                      >
                        Convertir en locator
                      </Button>
                      {locatorA && validateLocator(locatorA) && (
                        <p className="text-[10px] text-primary mt-1">→ {locatorA}</p>
                      )}
                    </TabsContent>
                  </Tabs>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">
                        Hauteur antenne (m AGL)
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px]">
                          <p className="text-xs">Hauteur en mètre de l'antenne au dessus du sol</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      data-testid="height-a-input"
                      type="text"
                      inputMode="decimal"
                      value={heightA}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        const num = parseFloat(val) || 0;
                        setHeightA(Math.max(0, Math.min(1000, num)));
                      }}
                      className="tactical-input mt-1"
                      placeholder="10"
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
                  <Tabs value={inputModeB} onValueChange={setInputModeB} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-background/50 h-8" data-testid="station-b-tabs">
                      <TabsTrigger value="locator" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-black" data-testid="tab-locator-b">Locator</TabsTrigger>
                      <TabsTrigger value="address" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-black" data-testid="tab-address-b">Ville</TabsTrigger>
                      <TabsTrigger value="gps" className="text-[10px] data-[state=active]:bg-primary data-[state=active]:text-black" data-testid="tab-gps-b">GPS</TabsTrigger>
                    </TabsList>
                    <TabsContent value="locator" className="mt-2">
                      <div className="flex gap-2">
                        <Input
                          data-testid="locator-b-input"
                          value={locatorB}
                          onChange={(e) => setLocatorB(formatLocator(e.target.value))}
                          placeholder="IN96GC45"
                          className="tactical-input flex-1"
                          maxLength={10}
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
                        <p className="text-[10px] text-destructive mt-1">Format: AA00aa (6-10 car.)</p>
                      )}
                      {locatorB && validateLocator(locatorB) && (
                        <p className="text-[10px] text-primary mt-1">✓ {locatorB}</p>
                      )}
                    </TabsContent>
                    <TabsContent value="address" className="mt-2">
                      <div className="relative">
                        <div className="flex gap-2">
                          <Input
                            value={addressB}
                            onChange={(e) => setAddressB(e.target.value)}
                            onFocus={() => handleAddressFocus('B')}
                            placeholder="Berlin, Allemagne..."
                            className="tactical-input flex-1"
                            data-testid="address-b-input"
                          />
                          {addressLoadingB && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        {showSuggestionsB && addressSuggestionsB.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-card border border-border max-h-48 overflow-y-auto">
                            {addressSuggestionsB.map((suggestion, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => handleAddressSelect('B', suggestion)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-primary/20 border-b border-border/50 last:border-b-0 transition-colors"
                                data-testid={`address-suggestion-b-${index}`}
                              >
                                <div className="text-foreground truncate">{suggestion.display_name.split(',')[0]}</div>
                                <div className="text-muted-foreground text-[10px] truncate">{suggestion.display_name.split(',').slice(1, 3).join(',')}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {locatorB && validateLocator(locatorB) && (
                        <p className="text-[10px] text-primary mt-1">→ {locatorB}</p>
                      )}
                    </TabsContent>
                    <TabsContent value="gps" className="mt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={latB}
                          onChange={(e) => setLatB(e.target.value)}
                          placeholder="Lat: 52.5200"
                          className="tactical-input text-xs"
                          data-testid="lat-b-input"
                        />
                        <Input
                          value={lonB}
                          onChange={(e) => setLonB(e.target.value)}
                          placeholder="Lon: 13.4050"
                          className="tactical-input text-xs"
                          data-testid="lon-b-input"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGpsInput('B')}
                        disabled={!validateCoordinates(latB, lonB)}
                        className="w-full mt-2 rounded-none border-border hover:border-primary hover:text-primary text-xs h-8"
                        data-testid="gps-convert-b-btn"
                      >
                        Convertir en locator
                      </Button>
                      {locatorB && validateLocator(locatorB) && (
                        <p className="text-[10px] text-primary mt-1">→ {locatorB}</p>
                      )}
                    </TabsContent>
                  </Tabs>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground">
                        Hauteur antenne (m AGL)
                      </Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-3 h-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px]">
                          <p className="text-xs">Hauteur en mètre de l'antenne au dessus du sol</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      data-testid="height-b-input"
                      type="text"
                      inputMode="decimal"
                      value={heightB}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        const num = parseFloat(val) || 0;
                        setHeightB(Math.max(0, Math.min(1000, num)));
                      }}
                      className="tactical-input mt-1"
                      placeholder="10"
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
                className="w-full h-11 md:h-12 rounded-none bg-primary text-black font-bold uppercase tracking-wider font-mono transition-all active:scale-95 hover:bg-primary/90 disabled:opacity-100 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed"
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
                {loading ? (
                  <div className="h-[300px] md:h-[400px] flex items-center justify-center">
                    <div className="text-center">
                      {serverWaking ? (
                        <>
                          <Coffee className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-warning animate-pulse" />
                          <p className="text-sm md:text-base font-mono text-warning mb-2">Réveil du serveur en cours...</p>
                          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                            Le serveur était en veille pour économiser les ressources. 
                            Première connexion ~30 secondes.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                          <p className="text-xs md:text-sm font-mono text-muted-foreground">Calcul en cours...</p>
                        </>
                      )}
                    </div>
                  </div>
                ) : result ? (
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
                    onClick={handlePlotClick}
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

              {/* Path Map */}
              {result && (
                <PathMap
                  stationA={result.station_a}
                  stationB={result.station_b}
                  obstructionPoint={result.obstruction_point}
                  showObstruction={showObstructionOnMap}
                  onObstructionClose={() => setShowObstructionOnMap(false)}
                />
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
                <div className="flex items-center justify-between pt-1">
                  <p className="text-warning/70 italic">Application expérimentale générée avec l'IA</p>
                  <button
                    onClick={() => setMethodologyOpen(true)}
                    className="text-primary hover:text-primary/80 underline underline-offset-2 flex items-center gap-1"
                    data-testid="methodology-link"
                  >
                    <BookOpen className="w-3 h-3" />
                    En savoir plus
                  </button>
                </div>
              </div>

              {/* Methodology Modal */}
              <Dialog open={methodologyOpen} onOpenChange={setMethodologyOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="font-heading tracking-widest text-primary flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      MÉTHODOLOGIE DE CALCUL
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm text-muted-foreground">
                    
                    <section>
                      <h3 className="text-primary font-semibold mb-2">1. Conversion Maidenhead → Coordonnées</h3>
                      <p className="mb-2">Le système Maidenhead divise la Terre en carrés de taille décroissante :</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li><strong>Field (2 car.)</strong> : 20° lon × 10° lat (ex: JN)</li>
                        <li><strong>Square (4 car.)</strong> : 2° lon × 1° lat (ex: JN18)</li>
                        <li><strong>Subsquare (6 car.)</strong> : 5' lon × 2.5' lat (~8 km)</li>
                        <li><strong>Extended (8 car.)</strong> : 30" lon × 15" lat (~500 m)</li>
                        <li><strong>Super Extended (10 car.)</strong> : 1.25" lon × 0.625" lat (~3 m)</li>
                      </ul>
                      <p className="mt-2 text-xs">Les coordonnées retournées correspondent au <em>centre</em> du carreau.</p>
                    </section>

                    <section>
                      <h3 className="text-primary font-semibold mb-2">2. Calcul de Distance (Haversine)</h3>
                      <p className="mb-2">La formule de Haversine calcule la distance orthodromique sur une sphère :</p>
                      <div className="bg-background/50 p-3 rounded font-mono text-xs">
                        a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)<br/>
                        c = 2 × atan2(√a, √(1−a))<br/>
                        d = R × c
                      </div>
                      <p className="mt-2 text-xs">Où R = 6371 km (rayon terrestre moyen), φ = latitude, λ = longitude.</p>
                    </section>

                    <section>
                      <h3 className="text-primary font-semibold mb-2">3. Calcul d'Azimut (Great Circle)</h3>
                      <p className="mb-2">L'azimut initial (bearing) est calculé par :</p>
                      <div className="bg-background/50 p-3 rounded font-mono text-xs">
                        θ = atan2(sin(Δλ) × cos(φ2), cos(φ1) × sin(φ2) − sin(φ1) × cos(φ2) × cos(Δλ))
                      </div>
                      <p className="mt-2 text-xs">Le résultat est normalisé entre 0° et 360°. L'azimut inverse (B→A) est calculé séparément.</p>
                    </section>

                    <section>
                      <h3 className="text-primary font-semibold mb-2">4. Modèle de Terre 4/3 (Réfraction)</h3>
                      <p className="mb-2">La réfraction atmosphérique courbe les ondes radio. Pour les VHF/UHF/SHF, on utilise le modèle de "Terre équivalente" :</p>
                      <div className="bg-background/50 p-3 rounded font-mono text-xs">
                        R<sub>eff</sub> = K × R<sub>terre</sub> = 4/3 × 6371 km ≈ <strong>8495 km</strong>
                      </div>
                      <p className="mt-2 text-xs">Ce facteur K = 4/3 représente les conditions atmosphériques "standard" (gradient de réfractivité de -40 N-units/km).</p>
                    </section>

                    <section>
                      <h3 className="text-primary font-semibold mb-2">5. Ligne de Visée (LoS)</h3>
                      <p className="mb-2">La hauteur de la ligne de visée à chaque point est calculée en tenant compte de la courbure terrestre :</p>
                      <div className="bg-background/50 p-3 rounded font-mono text-xs">
                        correction_courbure = d² / (2 × R<sub>eff</sub>)<br/>
                        h<sub>LoS</sub> = h<sub>A</sub> + (h<sub>B</sub> − h<sub>A</sub>) × (d/D) − correction_courbure
                      </div>
                      <p className="mt-2 text-xs">Où d = distance au point, D = distance totale, h = hauteur (élévation + antenne).</p>
                    </section>

                    <section>
                      <h3 className="text-primary font-semibold mb-2">6. Zone de Fresnel</h3>
                      <p className="mb-2">La première zone de Fresnel définit l'espace où se propage l'essentiel de l'énergie radio. Son rayon varie le long du trajet :</p>
                      <div className="bg-background/50 p-3 rounded font-mono text-xs">
                        r<sub>1</sub> = √(λ × d<sub>1</sub> × d<sub>2</sub> / D)
                      </div>
                      <p className="mt-2">Où :</p>
                      <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                        <li>λ = c/f (longueur d'onde en mètres)</li>
                        <li>d<sub>1</sub> = distance au point depuis A</li>
                        <li>d<sub>2</sub> = distance au point depuis B</li>
                        <li>D = distance totale A-B</li>
                      </ul>
                      <p className="mt-2 text-xs">Le rayon est <strong>maximal au milieu du trajet</strong> et nul aux extrémités. Un dégagement de 60% de la 1ère zone de Fresnel est généralement suffisant pour éviter les pertes par diffraction.</p>
                    </section>

                    <section>
                      <h3 className="text-primary font-semibold mb-2">7. Détection d'Obstruction</h3>
                      <p className="mb-2">Un trajet est considéré "OBSTRUCTED" si l'élévation du terrain dépasse la ligne de visée en au moins un point :</p>
                      <div className="bg-background/50 p-3 rounded font-mono text-xs">
                        SI élévation[i] &gt; h<sub>LoS</sub>[i] → OBSTRUCTED
                      </div>
                      <p className="mt-2 text-xs">Le point d'obstruction affiché est celui avec la plus grande marge positive (terrain − LoS).</p>
                    </section>

                    <section className="border-t border-border pt-4">
                      <h3 className="text-primary font-semibold mb-2">Sources & Références</h3>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li><strong>Données d'élévation</strong> : <a href="https://www.opentopodata.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">Open-TopoData</a> (SRTM 30m, NASA/USGS)</li>
                        <li><strong>Géocodage</strong> : <a href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">Photon</a> (Komoot, basé sur OpenStreetMap)</li>
                        <li><strong>Cartes</strong> : <a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">OpenStreetMap</a> + tuiles CARTO Dark</li>
                        <li><strong>Maidenhead</strong> : <a href="https://en.wikipedia.org/wiki/Maidenhead_Locator_System" target="_blank" rel="noopener noreferrer" className="text-primary underline">Wikipedia - Maidenhead Locator System</a></li>
                        <li><strong>Haversine</strong> : <a href="https://en.wikipedia.org/wiki/Haversine_formula" target="_blank" rel="noopener noreferrer" className="text-primary underline">Wikipedia - Haversine formula</a></li>
                        <li><strong>Fresnel</strong> : <a href="https://en.wikipedia.org/wiki/Fresnel_zone" target="_blank" rel="noopener noreferrer" className="text-primary underline">Wikipedia - Fresnel zone</a></li>
                        <li><strong>Propagation VHF</strong> : ITU-R P.526 (Propagation by diffraction)</li>
                        <li><strong>Facteur K</strong> : ITU-R P.453 (The radio refractive index)</li>
                      </ul>
                    </section>

                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;
