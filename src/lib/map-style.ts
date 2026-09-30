import type { StyleSpecification } from "maplibre-gl";

// Minimal style over the self-hosted Protomaps (v4 schema) extract in
// public/maps/anu.pmtiles. No label layers, so no glyph/sprite fetches: the
// markers carry the names.
export const campusStyle: StyleSpecification = {
  version: 8,
  sources: {
    protomaps: {
      type: "vector",
      url: "pmtiles:///maps/anu.pmtiles",
      attribution:
        '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#faf8f3" } },
    {
      id: "earth",
      type: "fill",
      source: "protomaps",
      "source-layer": "earth",
      paint: { "fill-color": "#faf8f3" },
    },
    {
      id: "landuse-campus",
      type: "fill",
      source: "protomaps",
      "source-layer": "landuse",
      filter: ["in", ["get", "kind"], ["literal", ["university", "college", "school"]]],
      paint: { "fill-color": "#f5edde" },
    },
    {
      id: "landuse-green",
      type: "fill",
      source: "protomaps",
      "source-layer": "landuse",
      filter: [
        "in",
        ["get", "kind"],
        ["literal", ["park", "grass", "garden", "forest", "wood", "nature_reserve", "golf_course", "pitch", "playground", "recreation_ground", "meadow", "scrub"]],
      ],
      paint: { "fill-color": "#e3ecdc" },
    },
    {
      id: "water",
      type: "fill",
      source: "protomaps",
      "source-layer": "water",
      paint: { "fill-color": "#cfe0ea" },
    },
    {
      id: "roads-path",
      type: "line",
      source: "protomaps",
      "source-layer": "roads",
      filter: ["==", ["get", "kind"], "path"],
      paint: {
        "line-color": "#c9bfa8",
        "line-width": ["interpolate", ["linear"], ["zoom"], 15, 0.6, 18, 2],
        "line-dasharray": [2, 1.5],
      },
    },
    {
      id: "roads-casing",
      type: "line",
      source: "protomaps",
      "source-layer": "roads",
      filter: ["!=", ["get", "kind"], "path"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#d9d3c4",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2, 18, 14],
      },
    },
    {
      id: "roads",
      type: "line",
      source: "protomaps",
      "source-layer": "roads",
      filter: ["!=", ["get", "kind"], "path"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 18, 11],
      },
    },
    {
      id: "buildings",
      type: "fill",
      source: "protomaps",
      "source-layer": "buildings",
      paint: { "fill-color": "#e4ddcc", "fill-outline-color": "#bfb49b" },
    },
  ],
};
