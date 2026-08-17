const fs = require("fs");
const path = require("path");

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

module.exports = {
  getFiles,
  saveFileTelegram,
};
