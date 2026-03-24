const fs = require('fs');
const path = require('path');

const filesJsonPath = path.join(process.cwd(), 'files.json');

function getFiles() {
  if (!fs.existsSync(filesJsonPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filesJsonPath, 'utf8'));
  } catch (error) {
    return {};
  }
}

function saveFile(key, fileId) {
  const files = getFiles();
  files[key] = fileId;
  fs.writeFileSync(filesJsonPath, JSON.stringify(files, null, 2), 'utf8');
}

function saveFileTelegram(response, key) {
  const photo = response?.photo?.[response.photo.length - 1];

  if (!photo?.file_id) {
    return null;
  }

  saveFile(key, photo.file_id);
  return photo.file_id;
}

module.exports = {
  getFiles,
  saveFileTelegram,
};
