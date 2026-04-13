const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const publicPath = path.join(__dirname, "public");
const pedidosPath = path.join(__dirname, "pedidos");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "TodoPlotter2100!";

if (!fs.existsSync(pedidosPath)) {
  fs.mkdirSync(pedidosPath, { recursive: true });
}

app.use(express.json({ limit: "2mb" }));

function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Panel Admin"');
    return res.status(401).send("Acceso restringido.");
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
  const [username, password] = credentials.split(":");

  if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
    return next();
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="Panel Admin"');
  return res.status(401).send("Credenciales incorrectas.");
}

function generarCodigoPedido() {
  const numero = Math.floor(1000 + Math.random() * 9000);
  return `A${numero}`;
}

function existeCodigo(codigo) {
  const archivoJson = path.join(pedidosPath, `${codigo}.json`);
  return fs.existsSync(archivoJson);
}

function generarCodigoUnico() {
  let codigo = generarCodigoPedido();

  while (existeCodigo(codigo)) {
    codigo = generarCodigoPedido();
  }

  return codigo;
}

function limpiarTexto(valor) {
  return String(valor || "").trim();
}

function sanitizarParaArchivo(texto) {
  return limpiarTexto(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/[^\w.-]/g, "")
    .replace(/^_+|_+$/g, "") || "sin_dato";
}

function generarCSV(items) {
  const lineas = ["modelo,cantidad"];

  items
    .filter(item => item && item.modelo && Number(item.cantidad) > 0)
    .sort((a, b) =>
      String(a.modelo).localeCompare(String(b.modelo), undefined, {
        numeric: true,
        sensitivity: "base"
      })
    )
    .forEach(item => {
      lineas.push(`${item.modelo},${Number(item.cantidad)}`);
    });

  return lineas.join("\n");
}

function leerPedidoPorCodigo(codigo) {
  const jsonPath = path.join(pedidosPath, `${codigo}.json`);

  if (!fs.existsSync(jsonPath)) {
    return null;
  }

  const contenido = fs.readFileSync(jsonPath, "utf8");
  return JSON.parse(contenido);
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/pedidos", (req, res) => {
  try {
    const {
      cliente,
      localidad,
      telefono,
      material,
      medida,
      totalCantidad,
      precioUnitario,
      precioTotal,
      items
    } = req.body || {};

    const clienteLimpio = limpiarTexto(cliente);
    const localidadLimpia = limpiarTexto(localidad);
    const telefonoLimpio = limpiarTexto(telefono);
    const materialLimpio = limpiarTexto(material);
    const medidaLimpia = limpiarTexto(medida);
    const cantidadTotal = Number(totalCantidad) || 0;
    const unitario = Number(precioUnitario) || 0;
    const total = Number(precioTotal) || 0;
    const itemsArray = Array.isArray(items) ? items : [];

    if (!clienteLimpio) {
      return res.status(400).json({ ok: false, error: "Falta el nombre del cliente." });
    }

    if (!localidadLimpia) {
      return res.status(400).json({ ok: false, error: "Falta la localidad." });
    }

    if (!telefonoLimpio) {
      return res.status(400).json({ ok: false, error: "Falta el teléfono." });
    }

    if (!materialLimpio) {
      return res.status(400).json({ ok: false, error: "Falta el material." });
    }

    if (!medidaLimpia) {
      return res.status(400).json({ ok: false, error: "Falta la medida." });
    }

    if (!itemsArray.length) {
      return res.status(400).json({ ok: false, error: "El pedido no tiene productos." });
    }

    const minimo = medidaLimpia === "6cm" ? 130 : 50;

    if (cantidadTotal < minimo) {
      return res.status(400).json({
        ok: false,
        error: `El mínimo para ${medidaLimpia} es ${minimo}.`
      });
    }

    const itemsValidos = itemsArray
      .map(item => ({
        modelo: limpiarTexto(item.modelo),
        cantidad: Number(item.cantidad) || 0
      }))
      .filter(item => item.modelo && item.cantidad > 0);

    if (!itemsValidos.length) {
      return res.status(400).json({ ok: false, error: "No hay items válidos en el pedido." });
    }

    const codigo = generarCodigoUnico();
    const fecha = new Date().toISOString();
    const csv = generarCSV(itemsValidos);

    const nombreArchivoCSV = [
      codigo,
      sanitizarParaArchivo(clienteLimpio),
      sanitizarParaArchivo(localidadLimpia),
      sanitizarParaArchivo(telefonoLimpio),
      sanitizarParaArchivo(materialLimpio),
      sanitizarParaArchivo(medidaLimpia)
    ].join("_") + ".csv";

    const pedidoData = {
      codigo,
      fecha,
      cliente: clienteLimpio,
      localidad: localidadLimpia,
      telefono: telefonoLimpio,
      material: materialLimpio,
      medida: medidaLimpia,
      totalCantidad: cantidadTotal,
      precioUnitario: unitario,
      precioTotal: total,
      nombreArchivoCSV,
      items: itemsValidos,
      csv
    };

    const jsonPath = path.join(pedidosPath, `${codigo}.json`);
    const csvPath = path.join(pedidosPath, nombreArchivoCSV);

    fs.writeFileSync(jsonPath, JSON.stringify(pedidoData, null, 2), "utf8");
    fs.writeFileSync(csvPath, csv, "utf8");

    return res.json({
      ok: true,
      codigo,
      whatsappMessage: `Hola, ya hice mi pedido. Mi código es ${codigo}.`
    });
  } catch (error) {
    console.error("Error al guardar pedido:", error);
    return res.status(500).json({
      ok: false,
      error: "No se pudo guardar el pedido."
    });
  }
});

app.get("/admin.html", basicAuth, (req, res) => {
  res.sendFile(path.join(publicPath, "admin.html"));
});

app.get("/api/pedidos", basicAuth, (req, res) => {
  try {
    const archivos = fs
      .readdirSync(pedidosPath)
      .filter(nombre => nombre.toLowerCase().endsWith(".json"));

    const pedidos = archivos
      .map(nombre => {
        const fullPath = path.join(pedidosPath, nombre);
        const contenido = fs.readFileSync(fullPath, "utf8");
        const pedido = JSON.parse(contenido);

        return {
          codigo: pedido.codigo,
          fecha: pedido.fecha,
          cliente: pedido.cliente,
          localidad: pedido.localidad,
          telefono: pedido.telefono,
          material: pedido.material,
          medida: pedido.medida,
          totalCantidad: pedido.totalCantidad,
          precioUnitario: pedido.precioUnitario,
          precioTotal: pedido.precioTotal,
          nombreArchivoCSV: pedido.nombreArchivoCSV
        };
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return res.json({
      ok: true,
      pedidos
    });
  } catch (error) {
    console.error("Error al listar pedidos:", error);
    return res.status(500).json({
      ok: false,
      error: "No se pudieron listar los pedidos."
    });
  }
});

app.get("/api/pedidos/:codigo/csv", basicAuth, (req, res) => {
  try {
    const codigo = limpiarTexto(req.params.codigo);
    const pedido = leerPedidoPorCodigo(codigo);

    if (!pedido) {
      return res.status(404).json({
        ok: false,
        error: "Pedido no encontrado."
      });
    }

    const csvPath = path.join(pedidosPath, pedido.nombreArchivoCSV);

    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({
        ok: false,
        error: "CSV no encontrado."
      });
    }

    return res.download(csvPath, pedido.nombreArchivoCSV);
  } catch (error) {
    console.error("Error al descargar CSV:", error);
    return res.status(500).json({
      ok: false,
      error: "No se pudo descargar el CSV."
    });
  }
});

app.use(express.static(publicPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor listo en puerto ${PORT}`);
});