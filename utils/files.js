const fs = require("fs");
const path = require("path");
const { PRODUCTS } = require("./products");
const shopCacheKeys = new Set(PRODUCTS.map((product) => product.cacheKey));

const isDevelop = process.env.DEVELOP === "TRUE";
const filesJsonPath = path.join(process.cwd(), isDevelop ? "files.develop.json" : "files.json");

function getFiles() {
  if (!fs.existsSync(filesJsonPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filesJsonPath, "utf8"));
  } catch (error) {
    return {};
  }
}

function saveFile(key, fileId) {
  const files = getFiles();
  if (files[key] === fileId) return;
  files[key] = fileId;
  fs.writeFileSync(filesJsonPath, JSON.stringify(files, null, 2), "utf8");
}

function saveFileTelegram(response, key) {
  const file = response?.document || response?.photo?.[response.photo.length - 1];

  if (!file?.file_id) {
    return null;
  }

  saveFile(key, file.file_id);
  return file.file_id;
}

function deleteCachedFiles(scope) {
  if (!["gallery", "shop", "base"].includes(scope)) throw new Error("Invalid cache scope");
  if (!fs.existsSync(filesJsonPath)) return 0;
  // Fail on invalid JSON instead of overwriting entries that must be preserved.
  const files = JSON.parse(fs.readFileSync(filesJsonPath, "utf8"));
  if (!files || typeof files !== "object" || Array.isArray(files)) throw new Error("Invalid cache format");
  let deleted = 0;
  for (const key of Object.keys(files)) {
    const gallery = key.startsWith("GALLERY_");
    const shop = shopCacheKeys.has(key);
    const shouldDelete = scope === "shop" ? shop : scope === "gallery" ? gallery : !gallery && !shop;
    if (shouldDelete) {
      delete files[key];
      deleted++;
    }
  }
  if (deleted) fs.writeFileSync(filesJsonPath, JSON.stringify(files, null, 2), "utf8");
  return deleted;
}

module.exports = {
  getFiles,
  saveFileTelegram,
  deleteCachedFiles,
};
