const TEXT = "SIMULACIÓN — SIN VALIDEZ DE PAGO";
const protectedPages = new WeakSet();

async function applyWatermark(page) {
  await page.evaluate((text) => {
    const id = "xpress-simulation-watermark";
    document.getElementById(id)?.remove();
    const root = document.documentElement;
    const width = Math.max(root.scrollWidth, window.innerWidth);
    const height = Math.max(root.scrollHeight, window.innerHeight);
    const overlay = document.createElement("div");
    overlay.id = id;
    overlay.setAttribute("aria-hidden", "true");
    const tileWidth = Math.min(420, width);
    const fontSize = Math.max(10, Math.min(18, tileWidth / 24));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="180"><g transform="translate(${tileWidth / 2},90) rotate(-18)"><rect x="-${tileWidth / 2}" y="-20" width="${tileWidth}" height="40" fill="white" fill-opacity="0.8"/><text text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="#a51424">${text}</text></g></svg>`;
    overlay.style.cssText = `position:absolute!important;left:0!important;top:0!important;width:${width}px!important;height:${height}px!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;opacity:1!important;background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}")!important;background-repeat:repeat!important;`;
    root.appendChild(overlay);
  }, TEXT);
}

function protectScreenshots(page) {
  if (protectedPages.has(page)) return page;
  const screenshot = page.screenshot.bind(page);
  page.screenshot = async (...args) => {
    // Reapply after setContent/navigation and fail closed if insertion fails.
    await applyWatermark(page);
    return screenshot(...args);
  };
  protectedPages.add(page);
  return page;
}

module.exports = { TEXT, applyWatermark, protectScreenshots };
