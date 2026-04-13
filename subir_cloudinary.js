const { v2: cloudinary } = require("cloudinary");
const fs = require("fs");
const path = require("path");

cloudinary.config({
  cloud_name: "da2c6wb9n",
  api_key: "344759884983444",
  api_secret: "41VkoZYGB5-nU-vAnCWVi9XJcgg"
});

const RUTAS_POSIBLES = [
  path.join(__dirname, "public", "imagenes"),
  path.join(__dirname, "imagenes"),
  path.join(__dirname, "..", "CATALOGO", "imagenes")
];

const PUBLIC_DIR = path.join(__dirname, "public");
const SALIDA_1 = path.join(PUBLIC_DIR, "archivos1.js");
const SALIDA_2 = path.join(PUBLIC_DIR, "archivos2.js");
const SALIDA_3 = path.join(PUBLIC_DIR, "archivos3.js");

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

function escribirJS(ruta, lista) {
  const lineas = [];
  lineas.push("const ARCHIVOS = [");
  for (let i = 0; i < lista.length; i++) {
    const coma = i < lista.length - 1 ? "," : "";
    lineas.push(`  "${lista[i]}"${coma}`);
  }
  lineas.push("];");
  fs.writeFileSync(ruta, lineas.join("\n"), "utf8");
}

async function subirArchivo(rutaArchivo, publicId, indice, total) {
  process.stdout.write(`[${indice}/${total}] Subiendo ${publicId}... `);

  await cloudinary.uploader.upload(rutaArchivo, {
    resource_type: "image",
    public_id: publicId,
    overwrite: true,
    invalidate: true,
    unique_filename: false,
    use_filename: false
  });

  process.stdout.write("OK\n");
}

async function main() {
  const imagenesDir = encontrarCarpetaImagenes();
  console.log("Carpeta de imágenes encontrada:");
  console.log(imagenesDir);
  console.log("");

  const archivos = fs.readdirSync(imagenesDir)
    .filter(a => /\.(jpg|jpeg|png|webp)$/i.test(a));

  if (archivos.length === 0) {
    throw new Error("No encontré imágenes para subir.");
  }

  const ordenados = ordenarArchivos(archivos);

  const publicIds = ordenados.map(a => path.parse(a).name);

  console.log(`Total de imágenes a subir: ${publicIds.length}`);
  console.log("");

  for (let i = 0; i < ordenados.length; i++) {
    const archivo = ordenados[i];
    const publicId = path.parse(archivo).name;
    const rutaArchivo = path.join(imagenesDir, archivo);

    await subirArchivo(rutaArchivo, publicId, i + 1, ordenados.length);
  }

  const total = publicIds.length;
  const corte1 = Math.ceil(total / 3);
  const corte2 = Math.ceil((total * 2) / 3);

  const grupo1 = publicIds.slice(0, corte1);
  const grupo2 = publicIds.slice(corte1, corte2);
  const grupo3 = publicIds.slice(corte2);

  escribirJS(SALIDA_1, grupo1);
  escribirJS(SALIDA_2, grupo2);
  escribirJS(SALIDA_3, grupo3);

  console.log("");
  console.log("Listo.");
  console.log(`archivos1.js: ${grupo1.length}`);
  console.log(`archivos2.js: ${grupo2.length}`);
  console.log(`archivos3.js: ${grupo3.length}`);
  console.log("");
  console.log("Cloudinary base:");
  console.log("https://res.cloudinary.com/da2c6wb9n/image/upload/");
}

main().catch(error => {
  console.error("");
  console.error("ERROR:");
  console.error(error.message || error);
  process.exit(1);
});