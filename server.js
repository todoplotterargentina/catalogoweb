const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PEDIDOS_DIR = path.join(__dirname, "pedidos");

if (!fs.existsSync(PEDIDOS_DIR)) {
  fs.mkdirSync(PEDIDOS_DIR, { recursive: true });
}

function generarCodigo() {
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letra = letras[Math.floor(Math.random() * letras.length)];
  const numero = Math.floor(1000 + Math.random() * 9000);
  return letra + numero;
}

function dividirCantidad(lineas, modelo, cantidad) {
  let restante = cantidad;

  while (restante > 0) {
    const tramo = restante >= 9 ? 9 : restante;
    lineas.push(`${modelo},${tramo}`);
    restante -= tramo;
  }
}

function limpiarTextoArchivo(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "");
}

app.post("/pedido", (req, res) => {
  try {
    const { cliente, items } = req.body;

    if (!cliente || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const { nombreApellido, telefono, material, medida } = cliente;

    if (!nombreApellido || !telefono || !material || !medida) {
      return res.status(400).json({ error: "Faltan datos del cliente" });
    }

    const codigo = generarCodigo();

    const lineas = ["modelo,cantidad"];

    for (const item of items) {
      const modelo = String(item.modelo || "").trim();
      const cantidad = parseInt(item.cantidad, 10) || 0;

      if (!modelo || cantidad <= 0) continue;

      dividirCantidad(lineas, modelo, cantidad);
    }

    if (lineas.length === 1) {
      return res.status(400).json({ error: "No hay items válidos" });
    }

    const nombreArchivoBase =
      `${codigo}_` +
      `${limpiarTextoArchivo(nombreApellido)}_` +
      `${limpiarTextoArchivo(telefono)}_` +
      `${limpiarTextoArchivo(medida)}_` +
      `${limpiarTextoArchivo(material)}`;

    const rutaCsv = path.join(PEDIDOS_DIR, `${nombreArchivoBase}.csv`);
    const rutaJson = path.join(PEDIDOS_DIR, `${nombreArchivoBase}.json`);

    fs.writeFileSync(rutaCsv, lineas.join("\n"), "utf8");

    fs.writeFileSync(
      rutaJson,
      JSON.stringify(
        {
          codigo,
          cliente,
          items,
          fecha: new Date().toISOString()
        },
        null,
        2
      ),
      "utf8"
    );

    return res.json({ ok: true, codigo });
  } catch (error) {
    console.error("Error al guardar pedido:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});