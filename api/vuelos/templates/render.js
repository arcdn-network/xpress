const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const libre = require("libreoffice-convert");
const PDF_EXPORT_FILTER = "writer_pdf_Export";

const TEMPLATES = {
  sky: "doc1.docx",
  latam: "doc2.docx",
};

function convertAsync(document, format, filter) {
  return new Promise((resolve, reject) => {
    libre.convert(document, format, filter, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(result);
    });
  });
}

function generarDocxBuffer(templatePath, data) {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer" });
}

async function renderDocument(data, tipoDoc) {
  const templateName = TEMPLATES[tipoDoc];

  if (!templateName) {
    throw new Error(`Tipo de documento no soportado: ${tipoDoc}`);
  }

  const templatePath = path.join(__dirname, templateName);
  const docxBuffer = generarDocxBuffer(templatePath, data);
  const pdfBuffer = await convertAsync(docxBuffer, ".pdf", PDF_EXPORT_FILTER);
  return pdfBuffer.toString("base64");
}

module.exports = {
  renderDocument,
};
