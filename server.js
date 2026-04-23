const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// 👉 PERMITIR IFRAME
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  res.removeHeader("X-Frame-Options");
  next();
});

app.use(express.json());
app.use(express.static("public"));

// carpeta pedidos
const PEDIDOS_DIR = path.join(__dirname, "pedidos");
if (!fs.existsSync(PEDIDOS_DIR)) {
  fs.mkdirSync(PEDIDOS_DIR);
}

// generar código tipo A1234
function generarCodigo() {
  const numero = Math.floor(1000 + Math.random() * 9000);
  return `A${numero}`;
}

// 👉 CSV CORREGIDO (DOS COLUMNAS REALES)
function generarCSV(items) {
  const lineas = ["modelo;cantidad"];

  items
    .filter(item => item && item.modelo && Number(item.cantidad) > 0)
    .sort((a, b) =>
      String(a.modelo).localeCompare(String(b.modelo), undefined, {
        numeric: true,
        sensitivity: "base"
      })
    )
    .forEach(item => {
      lineas.push(`${item.modelo};${Number(item.cantidad)}`);
    });

  return lineas.join("\n");
}

// crear pedido
app.post("/api/pedidos", (req, res) => {
  try {
    const {
      cliente,
      telefono,
      material,
      medida,
      totalCantidad,
      precioUnitario,
      precioTotal,
      items
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ ok: false, error: "Sin items" });
    }

    const codigo = generarCodigo();

    const dataPedido = {
      codigo,
      cliente,
      telefono,
      material,
      medida,
      totalCantidad,
      precioUnitario,
      precioTotal,
      items,
      fecha: new Date()
    };

    // guardar JSON
    fs.writeFileSync(
      path.join(PEDIDOS_DIR, `${codigo}.json`),
      JSON.stringify(dataPedido, null, 2)
    );

    // guardar CSV
    const csv = generarCSV(items);

    const nombreArchivo = `${codigo}_${cliente}_${telefono}_${material}_${medida}.csv`
      .replace(/\s+/g, "_");

    fs.writeFileSync(
      path.join(PEDIDOS_DIR, nombreArchivo),
      csv
    );

    // mensaje WhatsApp
    const whatsappMessage = `Hola, ya hice mi pedido. Mi código es ${codigo}.`;

    res.json({
      ok: true,
      codigo,
      whatsappMessage
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Error servidor" });
  }
});

// descargar CSV por código
app.get("/api/pedidos/:codigo", (req, res) => {
  const codigo = req.params.codigo;

  const archivos = fs.readdirSync(PEDIDOS_DIR);
  const archivo = archivos.find(a => a.startsWith(codigo) && a.endsWith(".csv"));

  if (!archivo) {
    return res.status(404).send("No encontrado");
  }

  res.download(path.join(PEDIDOS_DIR, archivo));
});

// health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("Servidor listo en puerto", PORT);
});