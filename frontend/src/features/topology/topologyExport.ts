import type { Core } from "cytoscape";
import {
  downloadDataUrl, downloadTextFile, buildTopologySvg, topologySvgDimensions, edgeClippedEndpoints,
} from "../../utils/download";

export function exportTopologyPng(cy: Core, edgeLabelFontSize: number) {
  const isDark = document.body.classList.contains("theme-dark");
  const { width, height, offsetX, offsetY } = topologySvgDimensions(cy);
  // skipText=true: SVG carries only shapes/icons; all text is drawn on canvas
  // directly so it always renders regardless of browser SVG-as-image quirks.
  const svgStr = buildTopologySvg(cy, isDark, true);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) { URL.revokeObjectURL(url); return; }
    ctx.scale(scale, scale);
    ctx.fillStyle = isDark ? "#0c1118" : "#fbfdfe";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    // Zone labels above their boxes
    const zoneLabelColor = isDark ? "#8ab0c8" : "#263b4b";
    ctx.font = "700 13px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = zoneLabelColor;
    cy.nodes(".zone").forEach((zone) => {
      const pos = zone.position();
      const top  = pos.y - zone.height() / 2 + offsetY;
      const left = pos.x - zone.width()  / 2 + offsetX;
      ctx.fillText(String(zone.data("label") ?? ""), left + 14, top - 6);
    });

    // Device labels below icons
    const deviceLabelColor = isDark ? "#d7e2ea" : "#13212b";
    ctx.font = "600 12px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = deviceLabelColor;
    cy.nodes(".device").forEach((node) => {
      const pos = node.position();
      const nodeScale = Math.max(0.7, Math.min(2.2, Number(node.data("nodeScale") ?? 1)));
      const size = Math.max(30, Math.min(130, 44 * nodeScale));
      const x = pos.x + offsetX;
      const labelY = pos.y + offsetY + size / 2 + 14;
      const label = String(node.data("label") ?? "");
      label.split("\n").forEach((line, index) => {
        ctx.fillText(line, x, labelY + index * 14);
      });
    });

    // Edge (link) labels at midpoint of the clipped edge line
    const edgeTxtColor = isDark ? "#c8dae8" : "#2a4055";
    const edgeBgColor  = isDark ? "#1d2f40" : "#eef3f7";
    ctx.font = `${edgeLabelFontSize}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    cy.edges().forEach((edge) => {
      const label = String(edge.data("label") ?? "");
      if (!label) return;
      const ep = edgeClippedEndpoints(edge, offsetX, offsetY);
      if (!ep) return;
      const mx = (ep.sx + ep.tx) / 2;
      const my = (ep.sy + ep.ty) / 2;
      const metrics = ctx.measureText(label);
      const pad = 4;
      const bw = metrics.width + pad * 2;
      const bh = edgeLabelFontSize + pad * 2;
      ctx.fillStyle = edgeBgColor;
      ctx.fillRect(mx - bw / 2, my - bh / 2, bw, bh);
      ctx.fillStyle = edgeTxtColor;
      ctx.fillText(label, mx, my);
    });

    downloadDataUrl(canvas.toDataURL("image/png"), "netmap-topology.png");
  };
  img.src = url;
}

export function exportTopologySvg(cy: Core) {
  const isDark = document.body.classList.contains("theme-dark");
  downloadTextFile(buildTopologySvg(cy, isDark), "netmap-topology.svg", "image/svg+xml");
}
