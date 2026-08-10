// Exportación de la propuesta a PDF y Word.
//
// Antes esto era `window.print()`: el navegador imprimía la página completa
// (cabecera y menú incluidos) y dependía del diálogo de impresión. Ahora se
// genera el archivo y se descarga.
//
// - PDF: se captura el mismo `.print-layout` que se usaba para imprimir, así
//   que el resultado es idéntico al diseño ya existente (portada, tablas,
//   Carta Gantt con sus barras). Es una imagen: el texto no queda seleccionable.
// - Word: se reconstruye el documento con la librería `docx`, de modo que sea
//   editable (párrafos, listas, tablas e imágenes reales).
//
// El Costeo Interno es confidencial y NO entra en ninguna de las dos.

import { jsPDF } from 'jspdf'
// html2canvas-pro (no html2canvas a secas): Tailwind 4 emite colores `oklch()`
// en su paleta por defecto y el html2canvas original revienta al parsearlos.
import html2canvas from 'html2canvas-pro'
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Header,
  HorizontalPositionAlign, HorizontalPositionRelativeFrom, ImageRun, Packer,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign,
  VerticalPositionAlign, VerticalPositionRelativeFrom, WidthType,
} from 'docx'
import { usePresupuesto } from '../stores/presupuesto.js'

// A4 a 96 dpi, que es la unidad en la que trabaja el DOM.
const ANCHO_PAGINA_PX = 794
const ALTO_PAGINA_PX = 1123
const MARGEN_PX = 38
const PX_A_PT = 72 / 96
const ESCALA = 2

const COLORES_FASE = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6', 'EC4899', '06B6D4', '84CC16']
const NEGRO = '18181B'
const VIOLETA = '8B5CF6'
const GRIS_BORDE = 'DDDDDD'

const TEXTO_MARCA = 'SIN APROBACIÓN INTERNA'

// La regla de "aprobada internamente" vive en el store, que es de donde la lee
// también la UI: una sola definición.
function estaAprobada() {
  return usePresupuesto().computed.aprobadaInternamente.value
}

// ---------------------------------------------------------------- utilidades

function nombreArchivo(ext) {
  const { state } = usePresupuesto()
  const qn = (state.quoteNumber || 'propuesta').replace(/[\\/:*?"<>|]/g, '-')
  return `Propuesta_${qn}.${ext}`
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari necesita que la URL siga viva un instante después del click.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// --------------------------------------------------------------------- PDF

// El layout de impresión está oculto en pantalla y sus estilos de tamaño solo
// se activan al imprimir. `export-mode` lo saca fuera de la pantalla con el
// ancho exacto de un A4 para poder fotografiarlo.
async function conLayoutDeExportacion(fn) {
  const layout = document.querySelector('.print-layout')
  if (!layout) throw new Error('No se encontró el layout de impresión')
  layout.classList.add('export-mode')
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready
    // Dos frames para que el navegador aplique layout y pinte antes de capturar.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    return await fn(layout)
  } finally {
    layout.classList.remove('export-mode')
  }
}

function capturar(el) {
  return html2canvas(el, {
    scale: ESCALA,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: ANCHO_PAGINA_PX,
  })
}

// Corta por el borde de los bloques de primer nivel para no partir un párrafo
// o una tabla por la mitad. Si un bloque es más alto que la página, se corta
// a lo bruto (no hay alternativa).
function cortesPorBloque(contenedor, altoUtil) {
  const base = contenedor.getBoundingClientRect().top
  const bloques = Array.from(contenedor.children).map(el => {
    const r = el.getBoundingClientRect()
    return { top: r.top - base, bottom: r.bottom - base }
  })
  const total = contenedor.getBoundingClientRect().height
  const cortes = [0]
  let inicio = 0

  for (const b of bloques) {
    if (b.bottom - inicio <= altoUtil) continue
    if (b.top - inicio > 0) { inicio = b.top; cortes.push(inicio) }
    while (b.bottom - inicio > altoUtil) { inicio += altoUtil; cortes.push(inicio) }
  }
  cortes.push(total)

  const limpios = []
  for (const c of cortes) {
    const v = Math.min(c, total)
    if (!limpios.length || v - limpios[limpios.length - 1] > 1) limpios.push(v)
  }
  return limpios
}

function cortesFijos(altoTotal, altoUtil) {
  const cortes = [0]
  while (cortes[cortes.length - 1] + altoUtil < altoTotal - 1) {
    cortes.push(cortes[cortes.length - 1] + altoUtil)
  }
  cortes.push(altoTotal)
  return cortes
}

function agregarPagina(pdf, canvas, desdePx, altoPx, { primera, margen }) {
  if (altoPx <= 0) return
  const sy = Math.round(desdePx * ESCALA)
  const sh = Math.min(Math.round(altoPx * ESCALA), canvas.height - sy)
  if (sh <= 0) return

  const trozo = document.createElement('canvas')
  trozo.width = canvas.width
  trozo.height = sh
  const ctx = trozo.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, trozo.width, trozo.height)
  ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh)

  if (!primera) pdf.addPage('a4', 'portrait')
  // JPEG y no PNG: las propuestas llevan fotos e imágenes base64 y en PNG el
  // archivo se va a decenas de MB.
  pdf.addImage(
    trozo.toDataURL('image/jpeg', 0.92), 'JPEG',
    0, margen * PX_A_PT,
    ANCHO_PAGINA_PX * PX_A_PT, (sh / ESCALA) * PX_A_PT,
    undefined, 'FAST',
  )
}

// Se estampa al final, sobre las páginas ya compuestas, para que quede encima
// del contenido y no la tape la imagen capturada.
function estamparMarcaDeAgua(pdf) {
  const ancho = ANCHO_PAGINA_PX * PX_A_PT
  const alto = ALTO_PAGINA_PX * PX_A_PT
  const paginas = pdf.getNumberOfPages()

  const ANGULO = 35
  const rad = ANGULO * Math.PI / 180

  pdf.setFont('helvetica', 'bold')
  // Se ajusta el cuerpo para que el texto girado ocupe ~80% del ancho de la
  // hoja: a tamaño fijo se salía de la página y quedaba cortado en los bordes.
  pdf.setFontSize(100)
  const anchoA100 = pdf.getTextWidth(TEXTO_MARCA)
  const cuerpo = Math.min(48, Math.floor(100 * (ancho * 0.8 / Math.cos(rad)) / anchoA100))
  pdf.setFontSize(cuerpo)

  // `align: 'center'` no centra bien junto con `angle`, así que el punto de
  // inicio se calcula a mano desde el centro de la hoja (la y crece hacia abajo).
  const anchoTexto = pdf.getTextWidth(TEXTO_MARCA)
  const x = ancho / 2 - (anchoTexto / 2) * Math.cos(rad)
  const y = alto / 2 + (anchoTexto / 2) * Math.sin(rad)

  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i)
    if (pdf.saveGraphicsState) pdf.saveGraphicsState()
    // La opacidad necesita un GState; si el motor no lo trae, se dibuja igual
    // en un rojo claro (peor, pero nunca deja el documento sin marcar).
    if (pdf.GState && pdf.setGState) {
      pdf.setGState(new pdf.GState({ opacity: 0.16 }))
      pdf.setTextColor(200, 0, 0)
    } else {
      pdf.setTextColor(240, 190, 190)
    }
    pdf.text(TEXTO_MARCA, x, y, { angle: ANGULO })
    if (pdf.restoreGraphicsState) pdf.restoreGraphicsState()
  }
}

export async function exportarPropuestaPDF() {
  const { toast } = usePresupuesto()
  toast('Generando PDF…')
  try {
    await conLayoutDeExportacion(async (layout) => {
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
      let primera = true

      // Portada: a sangre, sin márgenes.
      const portada = layout.querySelector('.print-cover')
      if (portada && portada.getBoundingClientRect().height > 0) {
        const canvas = await capturar(portada)
        const alto = canvas.height / ESCALA
        const cortes = cortesFijos(alto, ALTO_PAGINA_PX)
        for (let i = 0; i < cortes.length - 1; i++) {
          agregarPagina(pdf, canvas, cortes[i], cortes[i + 1] - cortes[i], { primera, margen: 0 })
          primera = false
        }
      }

      const contenido = layout.querySelector('.print-content')
      if (contenido) {
        const canvas = await capturar(contenido)
        const altoUtil = ALTO_PAGINA_PX - MARGEN_PX * 2
        const cortes = cortesPorBloque(contenido, altoUtil)
        for (let i = 0; i < cortes.length - 1; i++) {
          agregarPagina(pdf, canvas, cortes[i], cortes[i + 1] - cortes[i], { primera, margen: MARGEN_PX })
          primera = false
        }
      }

      if (!estaAprobada()) estamparMarcaDeAgua(pdf)

      pdf.save(nombreArchivo('pdf'))
    })
    toast(estaAprobada() ? 'PDF descargado' : 'PDF descargado (sin aprobación interna)')
  } catch (e) {
    console.error('[export] PDF:', e)
    toast('No se pudo generar el PDF')
  }
}

// -------------------------------------------------------------------- Word

const TIPOS_IMG = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp' }

// `fetch` resuelve tanto las rutas del sitio como los data: URI que Tiptap
// deja incrustados en el HTML de las secciones.
async function binarioDeImagen(src) {
  const res = await fetch(src)
  if (!res.ok) throw new Error('imagen no accesible: ' + src)
  const buf = await res.arrayBuffer()
  const mime = (res.headers.get('content-type') || '').split(';')[0].toLowerCase()
  const tipo = TIPOS_IMG[mime]
  if (!tipo) throw new Error('formato de imagen no soportado en Word: ' + mime)
  return { data: new Uint8Array(buf), tipo }
}

function medirImagen(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ ancho: img.naturalWidth || 480, alto: img.naturalHeight || 320 })
    img.onerror = () => resolve({ ancho: 480, alto: 320 })
    img.src = src
  })
}

async function runDeImagen(src, anchoMax = 460) {
  const { data, tipo } = await binarioDeImagen(src)
  const { ancho, alto } = await medirImagen(src)
  const factor = Math.min(1, anchoMax / ancho)
  return new ImageRun({
    type: tipo,
    data,
    transformation: { width: Math.round(ancho * factor), height: Math.round(alto * factor) },
  })
}

// --- HTML de las secciones (Tiptap) → párrafos de Word

async function runsDeInline(el, formato = {}) {
  const runs = []
  for (const nodo of Array.from(el.childNodes)) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      const texto = nodo.textContent.replace(/\s+/g, ' ')
      if (texto.trim() || runs.length) runs.push(new TextRun({ text: texto, ...formato }))
      continue
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) continue

    const tag = nodo.tagName.toLowerCase()
    if (tag === 'br') { runs.push(new TextRun({ text: '', break: 1 })); continue }
    if (tag === 'img') {
      try { runs.push(await runDeImagen(nodo.getAttribute('src'))) } catch (e) { console.warn('[export] img omitida:', e.message) }
      continue
    }
    if (tag === 'a') {
      const hijos = await runsDeInline(nodo, { ...formato, style: 'Hyperlink' })
      const href = nodo.getAttribute('href')
      if (href) runs.push(new ExternalHyperlink({ children: hijos, link: href }))
      else runs.push(...hijos)
      continue
    }

    const extra = { ...formato }
    if (tag === 'strong' || tag === 'b') extra.bold = true
    if (tag === 'em' || tag === 'i') extra.italics = true
    if (tag === 'u') extra.underline = {}
    if (tag === 's' || tag === 'del' || tag === 'strike') extra.strike = true
    if (tag === 'code') extra.font = 'Consolas'
    runs.push(...await runsDeInline(nodo, extra))
  }
  return runs
}

async function bloqueAParrafos(nodo, nivel = 0) {
  if (nodo.nodeType === Node.TEXT_NODE) {
    const t = nodo.textContent.trim()
    return t ? [new Paragraph({ children: [new TextRun(t)], spacing: { after: 120 } })] : []
  }
  if (nodo.nodeType !== Node.ELEMENT_NODE) return []

  const tag = nodo.tagName.toLowerCase()
  const sangria = nivel ? { left: 360 * nivel } : undefined

  if (tag === 'ul' || tag === 'ol') {
    const parrafos = []
    let n = 1
    for (const li of Array.from(nodo.children)) {
      if (li.tagName.toLowerCase() !== 'li') continue
      const anidadas = Array.from(li.children).filter(c => ['ul', 'ol'].includes(c.tagName.toLowerCase()))
      anidadas.forEach(c => c.remove())

      const runs = await runsDeInline(li)
      if (runs.length) {
        parrafos.push(tag === 'ul'
          ? new Paragraph({ children: runs, bullet: { level: nivel }, spacing: { after: 60 } })
          // Las listas numeradas se escriben a mano: montar `numbering` en docx
          // exige declararlo a nivel de documento y no aporta nada acá.
          : new Paragraph({ children: [new TextRun({ text: `${n}. ` }), ...runs], indent: { left: 360 * (nivel + 1) }, spacing: { after: 60 } }))
        n++
      }
      for (const sub of anidadas) parrafos.push(...await bloqueAParrafos(sub, nivel + 1))
    }
    return parrafos
  }

  if (tag === 'img') {
    try {
      return [new Paragraph({ children: [await runDeImagen(nodo.getAttribute('src'))], spacing: { after: 120 } })]
    } catch (e) {
      console.warn('[export] img omitida:', e.message)
      return []
    }
  }

  if (tag === 'hr') {
    return [new Paragraph({ text: '', border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GRIS_BORDE } }, spacing: { after: 120 } })]
  }

  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    const runs = await runsDeInline(nodo, { bold: true, size: tag === 'h1' ? 26 : tag === 'h2' ? 24 : 22 })
    return runs.length ? [new Paragraph({ children: runs, spacing: { before: 180, after: 100 }, indent: sangria })] : []
  }

  if (tag === 'blockquote') {
    const parrafos = []
    for (const hijo of Array.from(nodo.childNodes)) parrafos.push(...await bloqueAParrafos(hijo, nivel + 1))
    return parrafos
  }

  // p, div, pre y cualquier otro contenedor de bloque.
  const runs = await runsDeInline(nodo)
  return runs.length ? [new Paragraph({ children: runs, spacing: { after: 120 }, indent: sangria })] : []
}

async function htmlAParrafos(html) {
  const cuerpo = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html').body
  const parrafos = []
  for (const nodo of Array.from(cuerpo.childNodes)) parrafos.push(...await bloqueAParrafos(nodo))
  return parrafos
}

// --- Piezas del documento

const BORDES_FINOS = {
  top: { style: BorderStyle.SINGLE, size: 2, color: GRIS_BORDE },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: GRIS_BORDE },
  left: { style: BorderStyle.SINGLE, size: 2, color: GRIS_BORDE },
  right: { style: BorderStyle.SINGLE, size: 2, color: GRIS_BORDE },
}
const SIN_BORDES = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
}

function celda(texto, { bold = false, color, fondo, align = AlignmentType.LEFT, size = 18, bordes = BORDES_FINOS, colSpan } = {}) {
  return new TableCell({
    borders: bordes,
    columnSpan: colSpan,
    shading: fondo ? { type: ShadingType.CLEAR, color: 'auto', fill: fondo } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(texto ?? ''), bold, color, size })] })],
  })
}

function tituloSeccion(texto) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: VIOLETA, space: 8 } },
    children: [new TextRun({ text: texto, bold: true, size: 24, color: NEGRO })],
  })
}

function tablaMeta(state) {
  const fila = (celdas) => new TableRow({ children: celdas })
  const etiqueta = t => celda(t, { bold: true, color: NEGRO, size: 16, bordes: SIN_BORDES })
  const valor = t => celda(t, { size: 16, bordes: SIN_BORDES })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: SIN_BORDES,
    rows: [
      fila([etiqueta('CONTACTO'), valor(state.contactPerson), etiqueta(''), valor('')]),
      fila([etiqueta('FECHA'), valor(state.quoteDate), etiqueta('VÁLIDO HASTA'), valor(state.validUntil)]),
      fila([etiqueta('REVISIÓN'), valor(state.quoteRev), etiqueta('MONEDA'), valor(state.currency)]),
    ],
  })
}

function tablaEmpresaCliente(state) {
  const bloque = (titulo, lineas, responsable) => new TableCell({
    borders: SIN_BORDES,
    margins: { top: 40, bottom: 40, left: 0, right: 160 },
    children: [
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: titulo, bold: true, size: 18, color: NEGRO })] }),
      ...lineas.filter(Boolean).map(l => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: l, size: 16 })] })),
      new Paragraph({ spacing: { before: 40 }, children: [
        new TextRun({ text: 'Responsable: ', bold: true, size: 16 }),
        new TextRun({ text: responsable || '—', size: 16 }),
      ] }),
    ],
  })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: SIN_BORDES,
    rows: [new TableRow({ children: [
      bloque('EMPRESA', [state.company, state.companyAddr, state.companyPhone, state.companyEmail], state.companyResp),
      bloque('CLIENTE', [state.clientName, state.clientAddr, state.clientPhone, state.clientEmail], state.clientResp),
    ] })],
  })
}

function tablaEconomica(state, fmt) {
  const cabecera = new TableRow({
    tableHeader: true,
    children: [
      celda('ITEM', { bold: true, color: 'FFFFFF', fondo: NEGRO, align: AlignmentType.CENTER, size: 16 }),
      celda('DESCRIPCIÓN', { bold: true, color: 'FFFFFF', fondo: NEGRO, size: 16 }),
      celda('CANT.', { bold: true, color: 'FFFFFF', fondo: NEGRO, align: AlignmentType.RIGHT, size: 16 }),
      celda('P. UNITARIO', { bold: true, color: 'FFFFFF', fondo: NEGRO, align: AlignmentType.RIGHT, size: 16 }),
      celda('TOTAL', { bold: true, color: 'FFFFFF', fondo: NEGRO, align: AlignmentType.RIGHT, size: 16 }),
    ],
  })
  const filas = state.proposalItems.map((it, i) => new TableRow({
    children: [
      celda(`${i + 1}.1`, { align: AlignmentType.CENTER, size: 16 }),
      celda(it.desc, { size: 16 }),
      celda(it.qty, { align: AlignmentType.RIGHT, size: 16 }),
      celda(fmt(it.price || 0), { align: AlignmentType.RIGHT, size: 16 }),
      celda(fmt((it.qty || 0) * (it.price || 0)), { align: AlignmentType.RIGHT, size: 16 }),
    ],
  }))
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [800, 5200, 900, 1600, 1600],
    rows: [cabecera, ...filas],
  })
}

function totales(state, computed, fmt) {
  const linea = (etiqueta, valor, fuerte = false) => new TableRow({
    children: [
      celda(etiqueta, { bold: fuerte, size: fuerte ? 20 : 18, bordes: SIN_BORDES, align: AlignmentType.RIGHT }),
      celda(valor, { bold: fuerte, size: fuerte ? 20 : 18, bordes: SIN_BORDES, align: AlignmentType.RIGHT }),
    ],
  })
  return new Table({
    width: { size: 60, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.RIGHT,
    borders: SIN_BORDES,
    rows: [
      linea('Subtotal', fmt(computed.proposalSubtotal.value)),
      linea(`IVA / Impuesto (${state.taxRate}%)`, fmt(computed.proposalTax.value)),
      linea('Total', fmt(computed.proposalTotal.value), true),
    ],
  })
}

function firmas(state) {
  const bloque = (rol, nombre) => new TableCell({
    borders: SIN_BORDES,
    margins: { top: 200, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({ text: '', border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' } } }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [new TextRun({ text: rol, size: 16 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: nombre || '', size: 16 })] }),
    ],
  })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: SIN_BORDES,
    rows: [new TableRow({ children: [bloque('POR EMPRESA', state.companyRespSig), bloque('POR CLIENTE', state.clientRespSig)] })],
  })
}

// La Gantt en pantalla son barras posicionadas con CSS. En Word se reconstruye
// como una grilla de celdas pintadas; si el rango es muy largo no cabe ninguna
// grilla legible en una hoja, así que se cae a una tabla de fechas.
function gantt(state) {
  const span = state.ganttSpan || 14
  const fases = state.ganttPhases && state.ganttPhases.length ? state.ganttPhases : ['CAPTURA DE DATOS', 'ANÁLISIS DE DATOS']
  const tareas = state.ganttTasks || []

  if (span > 40) {
    const cabecera = new TableRow({
      tableHeader: true,
      children: ['FASE', 'TAREA', 'INICIO', 'FIN', 'DURACIÓN'].map(t =>
        celda(t, { bold: true, color: 'FFFFFF', fondo: NEGRO, size: 16 })),
    })
    const filas = []
    fases.forEach(fase => {
      tareas.filter(t => t.phase === fase).forEach(t => {
        const ini = t.startDay || 1
        const fin = t.endDay || ini
        filas.push(new TableRow({ children: [
          celda(fase, { size: 16 }), celda(t.name, { size: 16 }),
          celda(ini, { align: AlignmentType.CENTER, size: 16 }),
          celda(fin, { align: AlignmentType.CENTER, size: 16 }),
          celda(fin - ini + 1, { align: AlignmentType.CENTER, size: 16 }),
        ] }))
      })
    })
    return filas.length ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [cabecera, ...filas] })] : []
  }

  const anchoTarea = 3000
  const anchoUnidad = Math.max(160, Math.floor(6000 / span))
  const cabecera = new TableRow({
    tableHeader: true,
    children: [
      celda('TAREA', { bold: true, color: 'FFFFFF', fondo: NEGRO, size: 14 }),
      ...Array.from({ length: span }, (_, i) =>
        celda(i + 1, { bold: true, color: 'FFFFFF', fondo: NEGRO, align: AlignmentType.CENTER, size: 12 })),
    ],
  })

  const filas = []
  fases.forEach((fase, fi) => {
    const deLaFase = tareas.filter(t => t.phase === fase)
    if (!deLaFase.length) return
    filas.push(new TableRow({ children: [celda(fase, { bold: true, fondo: 'EEEEEE', size: 14, colSpan: span + 1 })] }))
    deLaFase.forEach(t => {
      const ini = t.startDay || 0
      const fin = t.endDay || ini
      filas.push(new TableRow({ children: [
        celda(t.name, { size: 14 }),
        ...Array.from({ length: span }, (_, i) => {
          const dentro = ini && i + 1 >= ini && i + 1 <= fin
          return celda('', { fondo: dentro ? COLORES_FASE[fi % COLORES_FASE.length] : undefined, size: 12 })
        }),
      ] }))
    })
  })

  if (!filas.length) return []
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [anchoTarea, ...Array.from({ length: span }, () => anchoUnidad)],
    rows: [cabecera, ...filas],
  })]
}

// Word no tiene una API de marca de agua: la de verdad es una imagen flotante
// anclada al encabezado y puesta detrás del texto, que es justo lo que Word
// genera cuando insertas una marca de agua a mano.
async function encabezadoConMarcaDeAgua() {
  const lienzo = document.createElement('canvas')
  lienzo.width = 1400
  lienzo.height = 1900
  const ctx = lienzo.getContext('2d')
  const rad = 35 * Math.PI / 180

  // Igual que en el PDF: se mide y se escala para que el texto girado quepa en
  // el lienzo, si no queda cortado en los extremos.
  const cuerpoBase = 130
  ctx.font = `bold ${cuerpoBase}px Helvetica, Arial, sans-serif`
  const anchoBase = ctx.measureText(TEXTO_MARCA).width
  const anchoUtil = (lienzo.width * 0.9) / Math.cos(rad)
  const cuerpo = Math.floor(cuerpoBase * anchoUtil / anchoBase)

  ctx.translate(lienzo.width / 2, lienzo.height / 2)
  ctx.rotate(-rad)
  ctx.font = `bold ${cuerpo}px Helvetica, Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(200, 0, 0, 0.16)'
  ctx.fillText(TEXTO_MARCA, 0, 0)

  const blob = await new Promise(r => lienzo.toBlob(r, 'image/png'))
  const data = new Uint8Array(await blob.arrayBuffer())

  return new Header({
    children: [new Paragraph({
      children: [new ImageRun({
        type: 'png',
        data,
        transformation: { width: 700, height: 950 },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
          behindDocument: true,
          allowOverlap: true,
        },
      })],
    })],
  })
}

export async function exportarPropuestaWord() {
  const { state, computed, fmt, toast } = usePresupuesto()
  toast('Generando Word…')
  try {
    const hijos = []

    // Cabecera con logo.
    try {
      hijos.push(new Paragraph({ spacing: { after: 80 }, children: [await runDeImagen('/images/image1.png', 120)] }))
    } catch (e) {
      console.warn('[export] logo omitido:', e.message)
    }
    hijos.push(new Paragraph({
      spacing: { after: 40 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NEGRO } },
      children: [new TextRun({ text: 'Propuesta', bold: true, size: 28, color: NEGRO })],
    }))
    hijos.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: state.quoteNumber, size: 20, color: '666666' })] }))

    hijos.push(tablaMeta(state))
    hijos.push(new Paragraph({ text: '', spacing: { after: 160 } }))
    hijos.push(tablaEmpresaCliente(state))
    hijos.push(new Paragraph({ text: '', spacing: { after: 160 } }))

    // Secciones de texto enriquecido, con la misma numeración que la impresión
    // y respetando las casillas de "secciones a imprimir".
    for (let i = 0; i < state.propuestaSections.length; i++) {
      const s = state.propuestaSections[i]
      if (!state.printSections[s.id]) continue
      hijos.push(tituloSeccion(`${String(i + 1).padStart(2, '0')} ${s.label}`))
      hijos.push(...await htmlAParrafos(s.content))
    }

    if (state.printSections.economica) {
      hijos.push(tituloSeccion(`${String(state.propuestaSections.length + 1).padStart(2, '0')} PROPUESTA ECONÓMICA`))
      hijos.push(tablaEconomica(state, fmt))
      hijos.push(new Paragraph({ text: '', spacing: { after: 120 } }))
      hijos.push(totales(state, computed, fmt))
      hijos.push(new Paragraph({ text: '', spacing: { after: 160 } }))
      hijos.push(firmas(state))
    }

    if (state.printSections.gantt) {
      const tabla = gantt(state)
      if (tabla.length) {
        hijos.push(tituloSeccion(`${String(state.propuestaSections.length + 2).padStart(2, '0')} CARTA GANTT`))
        hijos.push(...tabla)
      }
    }

    const aprobada = estaAprobada()
    const seccion = {
      properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children: hijos,
    }
    if (!aprobada) {
      seccion.headers = { default: await encabezadoConMarcaDeAgua() }
    }

    const doc = new Document({
      creator: state.company || 'Scopes',
      title: `Propuesta ${state.quoteNumber}`,
      styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
      sections: [seccion],
    })

    descargar(await Packer.toBlob(doc), nombreArchivo('docx'))
    toast(aprobada ? 'Word descargado' : 'Word descargado (sin aprobación interna)')
  } catch (e) {
    console.error('[export] Word:', e)
    toast('No se pudo generar el Word')
  }
}
