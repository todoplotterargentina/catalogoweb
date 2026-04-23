const ftp = require("basic-ftp");
const fs = require("fs");
const path = require("path");

const CONFIG = {
  host: "br.storage.bunnycdn.com",
  user: "catalogotodoplotter",
  password: "7e4f654f-57b9-4eb7-93f3febe8b89-c10b-4474",
  port: 21,
  secure: false
};

const RUTAS_POSIBLES = [
  path.join(__dirname, "public", "imagenes"),
  path.join(__dirname, "imagenes"),
  path.join(__dirname, "..", "CATALOGO", "imagenes")
];

function existeDirConImagenes(dir) {
  if (!fs.existsSync(dir)) return false;
  const archivos = fs.readdirSync(dir);
  return archivos.some(a => /\.(jpg|jpeg|png|webp)$/i.test(a));
}

function encontrarCarpetaImagenes() {
  for (const ruta of RUTAS_POSIBLES) {
    if (existeDirConImagenes(ruta)) return ruta;
  }
  throw new Error(
    "No encontré la carpeta de imágenes. Probé estas rutas:\n" +
    RUTAS_POSIBLES.join("\n")
  );
}

function ordenarArchivos(lista) {
  return [...lista].sort((a, b) => {
    const na = path.parse(a).name;
    const nb = path.parse(b).name;

    const aNum = /^\d+$/.test(na) ? parseInt(na, 10) : NaN;
    const bNum = /^\d+$/.test(nb) ? parseInt(nb, 10) : NaN;

    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;

    return na.localeCompare(nb, undefined, {
      numeric: true,
      sensitivity: "base"
    });
  });
}

async function main() {
  const imagenesDir = encontrarCarpetaImagenes();
  console.log("Carpeta encontrada:");
  console.log(imagenesDir);
  console.log("");

  const archivos = fs.readdirSync(imagenesDir)
    .filter(a => /\.(jpg|jpeg|png|webp)$/i.test(a));

  if (!archivos.length) {
    throw new Error("No encontré imágenes para subir.");
  }

  const ordenados = ordenarArchivos(archivos);

  console.log(`Total a subir: ${ordenados.length}`);
  console.log("");

  const client = new ftp.Client(0);
  client.ftp.verbose = false;

  try {
    await client.access(CONFIG);
    console.log("Conectado a Bunny.");
    console.log("");

    let i = 0;
    for (const archivo of ordenados) {
      i++;
      const rutaLocal = path.join(imagenesDir, archivo);

      process.stdout.write(`[${i}/${ordenados.length}] Subiendo ${archivo}... `);
      await client.uploadFrom(rutaLocal, archivo);
      process.stdout.write("OK\n");
    }

    console.log("");
    console.log("Listo. Subida terminada.");
    console.log("Base URL CDN:");
    console.log("https://catalogotodoplotter.b-cdn.net/");
  } finally {
    client.close();
  }
}

main().catch(err => {
  console.error("");
  console.error("ERROR:");
  console.error(err.message || err);
  process.exit(1);
});