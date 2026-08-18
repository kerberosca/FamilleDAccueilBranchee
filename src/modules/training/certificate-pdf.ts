type CertificatePdfInput = {
  participantName: string;
  issuedAt: Date;
  certificateCode: string;
};

export function buildCertificatePdf(input: CertificatePdfInput): Buffer {
  const date = new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto"
  }).format(input.issuedAt);
  const participantName = input.participantName.trim() || "Alli\u00e9 FAB";
  const content = [
    "q",
    "1 1 1 rg 0 0 792 612 re f",
    "1 J 1 j",
    "0.09 0.23 0.20 RG 1.5 w 30 30 732 552 re S",
    "0.87 0.47 0.28 RG 0.7 w 40 40 712 532 re S",
    "0.09 0.23 0.20 rg 30 576 732 6 re f",
    "0.87 0.47 0.28 rg 30 30 732 4 re f",
    centeredText("FAB", "F2", 18, 532, "0.24 0.35 0.67"),
    centeredText("Famille d'accueil branch\u00e9e", "F1", 10.5, 512, "0.26 0.35 0.32"),
    "0.87 0.47 0.28 rg 326 493 140 2 re f",
    centeredText("CERTIFICAT DE R\u00c9USSITE", "F2", 29, 447, "0.09 0.23 0.20"),
    centeredText("Formation des Alli\u00e9s FAB", "F1", 13, 415, "0.26 0.35 0.32"),
    centeredText("Ce certificat est d\u00e9cern\u00e9 \u00e0", "F1", 12, 374, "0.32 0.39 0.37"),
    centeredText(participantName, "F2", participantFontSize(participantName), 329, "0.78 0.30 0.16"),
    "0.84 0.82 0.76 RG 0.6 w 180 307 432 0 re S",
    centeredText("pour la r\u00e9ussite de la formation", "F1", 11.5, 279, "0.32 0.39 0.37"),
    centeredText("Comprendre et soutenir les familles d'accueil", "F2", 20, 245, "0.09 0.23 0.20"),
    centeredText(
      "La personne participante ma\u00eetrise les notions essentielles li\u00e9es au r\u00f4le d'alli\u00e9",
      "F1",
      10.5,
      207,
      "0.30 0.36 0.34"
    ),
    centeredText(
      "aupr\u00e8s des familles d'accueil, selon les crit\u00e8res de Famille d'accueil branch\u00e9e.",
      "F1",
      10.5,
      189,
      "0.30 0.36 0.34"
    ),
    "0.80 0.80 0.77 RG 0.5 w 80 151 632 0 re S",
    leftText("DATE DE D\u00c9LIVRANCE", "F2", 7.5, 116, 84, "0.40 0.44 0.42"),
    leftText(date, "F1", 10.5, 96, 84, "0.09 0.23 0.20"),
    "0.09 0.23 0.20 RG 0.8 w 326 103 140 0 re S",
    centeredText("\u00c9quipe FAB", "F2", 9.5, 84, "0.09 0.23 0.20"),
    rightText("NUM\u00c9RO DE CERTIFICAT", "F2", 7.5, 116, 708, "0.40 0.44 0.42"),
    rightText(`No ${input.certificateCode}`, "F1", 10.5, 96, 708, "0.09 0.23 0.20"),
    "Q"
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`
  ];
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%FAB\n", "latin1")];
  const offsets = [0];
  let offset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`, "latin1");
    chunks.push(chunk);
    offset += chunk.length;
  });
  const xrefOffset = offset;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (let index = 1; index <= objects.length; index += 1) {
    xref.push(`${String(offsets[index]).padStart(10, "0")} 00000 n `);
  }
  xref.push("trailer", `<< /Size ${objects.length + 1} /Root 1 0 R >>`, "startxref", String(xrefOffset), "%%EOF");
  chunks.push(Buffer.from(`${xref.join("\n")}\n`, "latin1"));
  return Buffer.concat(chunks);
}

function pdfText(value: string) {
  return value.replace(/[^\x20-\xFF]/g, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function centeredText(value: string, font: "F1" | "F2", fontSize: number, y: number, color: string) {
  const x = Math.max(58, (792 - textWidth(value, fontSize)) / 2);
  return textCommand(value, font, fontSize, x, y, color);
}

function leftText(
  value: string,
  font: "F1" | "F2",
  fontSize: number,
  y: number,
  x: number,
  color: string
) {
  return textCommand(value, font, fontSize, x, y, color);
}

function rightText(
  value: string,
  font: "F1" | "F2",
  fontSize: number,
  y: number,
  rightEdge: number,
  color: string
) {
  return textCommand(value, font, fontSize, rightEdge - textWidth(value, fontSize), y, color);
}

function textCommand(
  value: string,
  font: "F1" | "F2",
  fontSize: number,
  x: number,
  y: number,
  color: string
) {
  return `BT /${font} ${number(fontSize)} Tf ${color} rg ${number(x)} ${number(y)} Td (${pdfText(value)}) Tj ET`;
}

function participantFontSize(value: string) {
  const widthAtOnePoint = textWidth(value, 1);
  if (!widthAtOnePoint) return 25;
  return Math.max(14, Math.min(25, Math.floor(580 / widthAtOnePoint)));
}

function textWidth(value: string, fontSize: number) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const units = [...normalized].reduce((sum, character) => sum + helveticaWidth(character), 0);
  return (units / 1000) * fontSize;
}

function helveticaWidth(character: string) {
  if (character === " ") return 278;
  if (/[0-9]/.test(character)) return 556;
  if (/[A-Z]/.test(character)) {
    if (character === "I") return 278;
    if (character === "J") return 500;
    if (character === "M") return 833;
    if (character === "W") return 944;
    if ("CGOQ".includes(character)) return 778;
    if ("FLZ".includes(character)) return 556;
    if ("FT".includes(character)) return 611;
    return 700;
  }
  if (/[a-z]/.test(character)) {
    if ("ilj".includes(character)) return 222;
    if ("frt".includes(character)) return 300;
    if (character === "m") return 833;
    if (character === "w") return 722;
    if ("cksvxyz".includes(character)) return 500;
    return 556;
  }
  if (".,:;!'".includes(character)) return 278;
  if ("-()".includes(character)) return 333;
  return 556;
}

function number(value: number) {
  return Number(value.toFixed(2)).toString();
}
