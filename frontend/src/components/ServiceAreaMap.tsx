
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, DrawingManager, Polygon, Marker } from '@react-google-maps/api';

const libraries: ("drawing" | "places" | "geometry")[] = ['places', 'drawing', 'geometry'];

interface ServiceAreaMapProps {
    initialLat?: number;
    initialLng?: number;
    initialPolygon?: number[][]; // [[lng, lat]]
    onLocationSelect?: (lat: number, lng: number) => void;
    onPolygonChange?: (coordinates: number[][]) => void;
    height?: string;
    mode: 'location' | 'area'; // 'location' for picking store point, 'area' for drawing polygon
}

export default function ServiceAreaMap({
    initialLat,
    initialLng,
    initialPolygon,
    onLocationSelect,
    onPolygonChange,
    height = "400px",
    mode
}: ServiceAreaMapProps) {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
    const [polygonPath, setPolygonPath] = useState<{ lat: number; lng: number }[]>([]);
    const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
    const polygonRef = useRef<google.maps.Polygon | null>(null);

    useEffect(() => {
        if (initialLat && initialLng) {
            setMarkerPosition({ lat: initialLat, lng: initialLng });
        }
    }, [initialLat, initialLng]);

    useEffect(() => {
        if (initialPolygon && initialPolygon.length > 0) {
            // Backend stores as [lng, lat], Google Maps needs {lat, lng}
            const path = initialPolygon.map(coord => ({ lat: coord[1], lng: coord[0] }));
            setPolygonPath(path);
        }
    }, [initialPolygon]);

    const onLoad = useCallback((map: google.maps.Map) => {
        setMap(map);
        if (initialLat && initialLng) {
            const bounds = new google.maps.LatLngBounds({ lat: initialLat, lng: initialLng });
            map.setCenter({ lat: initialLat, lng: initialLng });
            map.setZoom(14);
        }
    }, [initialLat, initialLng]);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    const onMapClick = (e: google.maps.MapMouseEvent) => {
        if (mode === 'location' && e.latLng && onLocationSelect) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            setMarkerPosition({ lat, lng });
            onLocationSelect(lat, lng);
        }
    };

    const onPolygonComplete = (poly: google.maps.Polygon) => {
        const path = poly.getPath();
        const plainCoordinates: number[][] = []; // [lat, lng] for temp storage

        for (let i = 0; i < path.getLength(); i++) {
            const point = path.getAt(i);
            plainCoordinates.push([point.lat(), point.lng()]);
        }

        // Convert to GeoJSON format [lng, lat] for backend
        // Ensure the polygon is closed (first point = last point)
        const geoJsonCoords = plainCoordinates.map(c => [c[1], c[0]]);
        if (geoJsonCoords.length > 0) {
            // Check if already closed
            const first = geoJsonCoords[0];
            const last = geoJsonCoords[geoJsonCoords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                geoJsonCoords.push(first);
            }
        }

        if (onPolygonChange) {
            onPolygonChange(geoJsonCoords);
        }

        // Update local state to render the controlled Polygon
        setPolygonPath(plainCoordinates.map(c => ({ lat: c[0], lng: c[1] })));

        // Remove the drawn polygon instance from DrawingManager (we render our own controlled one)
        poly.setMap(null);
    };

    const clearPolygon = () => {
        setPolygonPath([]);
        if (onPolygonChange) onPolygonChange([]);
    };

    if (!isLoaded) return <div className="animate-pulse bg-gray-200 w-full h-full rounded-lg"></div>;

    return (
        <div className="relative w-full rounded-lg overflow-hidden border border-neutral-300 shadow-sm" style={{ height }}>
            <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={markerPosition || { lat: 20.5937, lng: 78.9629 }}
                zoom={12}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={onMapClick}
                options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                }}
            >
                {/* Render Marker in Location Mode */}
                {mode === 'location' && markerPosition && (
                    <Marker position={markerPosition} />
                )}

                {/* Render Saved/Drawn Polygon */}
                {polygonPath.length > 0 && (
                    <Polygon
                        paths={polygonPath}
                        options={{
                            fillColor: "#0D9488", // Teal-600
                            fillOpacity: 0.3,
                            strokeColor: "#0F766E", // Teal-700
                            strokeWeight: 2,
                            editable: mode === 'area', // Allow editing points if in area mode
                            draggable: false
                        }}
                        onMouseUp={() => {
                            // Handle edit events if needed
                        }}
                    />
                )}

                {/* Drawing Manager for 'area' mode - Only show if no polygon exists yet */}
                {mode === 'area' && polygonPath.length === 0 && (
                    <DrawingManager
                        onPolygonComplete={onPolygonComplete}
                        options={{
                            drawingControl: true,
                            drawingControlOptions: {
                                position: google.maps.ControlPosition.TOP_LEFT,
                                drawingModes: [google.maps.drawing.OverlayType.POLYGON],
                            },
                            polygonOptions: {
                                fillColor: "#0D9488",
                                fillOpacity: 0.3,
                                strokeColor: "#0F766E",
                                strokeWeight: 2,
                                clickable: true,
                                editable: true,
                                zIndex: 1,
                            },
                        }}
                    />
                )}

                {/* Store Location Center Marker (Visual Reference in Area Mode) */}
                {mode === 'area' && markerPosition && (
                    <Marker
                        position={markerPosition}
                        icon={{
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 7,
                            fillColor: "#DC2626", // Red
                            fillOpacity: 1,
                            strokeWeight: 2,
                            strokeColor: "white",
                        }}
                        title="Store Location"
                    />
                )}
            </GoogleMap>

            {mode === 'area' && polygonPath.length > 0 && (
                <button
                    type="button"
                    onClick={clearPolygon}
                    className="absolute top-2 right-14 bg-white text-red-600 px-3 py-1.5 rounded shadow-md text-xs font-bold border border-gray-200 hover:bg-red-50 z-10"
                >
                    Clear Area
                </button>
            )}
        </div>
    );
}
