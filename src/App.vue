<script setup>
import { onMounted, nextTick } from 'vue'
import { usePresupuesto } from './stores/presupuesto.js'
import CoverPage from './components/CoverPage.vue'
import Sidebar from './components/Sidebar.vue'
import PropuestaTab from './components/PropuestaTab.vue'
import CosteoInterno from './components/CosteoInterno.vue'
import GanttTab from './components/GanttTab.vue'
import HistorialTab from './components/HistorialTab.vue'
import PrintGantt from './components/PrintGantt.vue'

const icons = {
  propuesta: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  gantt: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="14" x2="18" y2="14"/><line x1="9" y1="18" x2="15" y2="18"/></svg>',
  costeo: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
  historial: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
}

const { state, computed, fmt, loadHistorial, saveBudget, loadBudget, syncPropuestaSections } = usePresupuesto()

onMounted(() => {
  const today = new Date()
  state.quoteDate = today.toISOString().slice(0, 10)
  const f = new Date(); f.setDate(f.getDate() + 30)
  state.validUntil = f.toISOString().slice(0, 10)
  if (!state.proposalItems.length) state.proposalItems.push({ desc: '', qty: 1, price: 0 })
  state.propuestaSections.forEach(s => { if (state.printSections[s.id] === undefined) state.printSections[s.id] = true })
  if (state.printSections.economica === undefined) state.printSections.economica = true
  if (state.printSections.gantt === undefined) state.printSections.gantt = true
  loadHistorial()
})

function handlePrint() {
  state.activeTab = 'propuesta'
  nextTick(() => window.print())
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-bg-app via-surface to-bg-app p-4 md:p-6">
    <div class="max-w-6xl mx-auto bg-surface rounded-2xl shadow-xl border border-border">

      <!-- HEADER -->
      <header class="bg-gradient-to-r from-header-from via-header-via to-header-to text-white px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap gap-y-2 items-center justify-between border-b border-white/5">
        <div class="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button @click="state.sidebarOpen = !state.sidebarOpen" class="shrink-0 text-white/60 hover:text-white transition cursor-pointer p-1 -ml-1" title="Menú">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <img src="/images/image1.png" alt="Logo" class="h-8 sm:h-10 w-auto shrink-0" />
          <div class="leading-tight min-w-0 flex-1">
            <h1 class="text-sm sm:text-lg font-bold tracking-wide truncate">OFERTA TÉCNICO-ECONÓMICA</h1>
            <input type="text" v-model="state.subheader"
              class="text-xs sm:text-sm text-white/80 placeholder-white/40 bg-transparent border-b border-transparent hover:border-white/30 focus:border-primary outline-none transition w-full max-w-xs sm:max-w-md px-0" />
            <input type="text" v-model="state.headerClient" :placeholder="state.clientName || 'Cliente'"
              class="text-[10px] sm:text-xs text-white/60 placeholder-white/30 bg-transparent border-b border-transparent hover:border-white/30 focus:border-primary outline-none transition w-full max-w-[8rem] sm:max-w-xs px-0" />
          </div>
        </div>
        <div class="flex gap-1.5 sm:gap-2 no-print">
          <button @click="saveBudget" class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm transition cursor-pointer border border-white/10">Guardar</button>
          <button @click="loadBudget" class="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm transition cursor-pointer border border-white/10">Cargar</button>
          <button @click="handlePrint" class="px-3 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg bg-white text-text hover:shadow-lg transition cursor-pointer">Imprimir</button>
        </div>
      </header>

      <!-- SIDEBAR + CONTENT -->
      <div class="flex">
        <Sidebar />

        <div class="flex-1 min-w-0">
          <!-- TABS (solo para sección propuestas) -->
          <div v-if="state.activeSection === 'propuestas'" class="flex overflow-x-auto border-b border-border bg-bg-app px-4 sm:px-6 no-print">
            <button v-for="t in state.tabs" :key="t.id"
              class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all duration-200 cursor-pointer shrink-0"
              :class="state.activeTab === t.id ? 'text-primary border-primary bg-surface' : 'text-text-muted border-transparent hover:text-text hover:border-border'"
              @click="state.activeTab = t.id">
              <span v-html="icons[t.id]"></span>
              {{ t.label }}
            </button>
          </div>

          <!-- CONTENT -->
          <div class="p-3 sm:p-6 no-print">
            <!-- Propuestas sub-tabs -->
            <template v-if="state.activeSection === 'propuestas'">
              <PropuestaTab v-if="state.activeTab === 'propuesta'" />
              <GanttTab v-else-if="state.activeTab === 'gantt'" />
              <CosteoInterno v-else-if="state.activeTab === 'costeo'" />
              <HistorialTab v-else-if="state.activeTab === 'historial'" />
            </template>

            <!-- Dashboard -->
            <div v-else-if="state.activeSection === 'dashboard'" class="text-center py-16 text-text-muted">
              <p class="text-lg font-semibold">Dashboard</p>
              <p class="text-sm mt-1">Resumen y estadísticas — próximamente</p>
            </div>

            <!-- Clientes -->
            <div v-else-if="state.activeSection === 'clientes'" class="text-center py-16 text-text-muted">
              <p class="text-lg font-semibold">Clientes</p>
              <p class="text-sm mt-1">Gestión de clientes — próximamente</p>
            </div>

            <!-- Catálogo -->
            <div v-else-if="state.activeSection === 'catalogo'" class="text-center py-16 text-text-muted">
              <p class="text-lg font-semibold">Catálogo</p>
              <p class="text-sm mt-1">Productos y servicios — próximamente</p>
            </div>

            <!-- Historial -->
            <HistorialTab v-else-if="state.activeSection === 'historial'" />

            <!-- Configuración -->
            <div v-else-if="state.activeSection === 'config'" class="text-center py-16 text-text-muted">
              <p class="text-lg font-semibold">Configuración</p>
              <p class="text-sm mt-1">Ajustes de la aplicación — próximamente</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- PRINT LAYOUT: Cover + Propuesta -->
  <div class="print-layout">
    <div class="print-cover">
      <CoverPage />
    </div>
    <div class="print-content">
      <div class="print-header">
        <img src="/images/image1.png" alt="Logo" class="h-8" />
        <div>
          <h1>OFERTA TÉCNICO-ECONÓMICA</h1>
          <p>{{ state.quoteNumber }}</p>
        </div>
      </div>

      <table class="print-meta">
        <tr><td class="label">CONTACTO</td><td>{{ state.contactPerson }}</td></tr>
        <tr><td class="label">FECHA</td><td>{{ state.quoteDate }}</td><td class="label">VÁLIDO HASTA</td><td>{{ state.validUntil }}</td></tr>
        <tr><td class="label">REVISIÓN</td><td>{{ state.quoteRev }}</td><td class="label">MONEDA</td><td>{{ state.currency }}</td></tr>
      </table>

      <div class="print-company-grid">
        <div>
          <h3>EMPRESA</h3>
          <p>{{ state.company }}</p>
          <p>{{ state.companyAddr }}</p>
          <p>{{ state.companyPhone }}</p>
          <p>{{ state.companyEmail }}</p>
          <p><strong>Responsable:</strong> {{ state.companyResp }}</p>
        </div>
        <div>
          <h3>CLIENTE</h3>
          <p>{{ state.clientName }}</p>
          <p>{{ state.clientAddr }}</p>
          <p>{{ state.clientPhone }}</p>
          <p>{{ state.clientEmail }}</p>
          <p><strong>Responsable:</strong> {{ state.clientResp }}</p>
        </div>
      </div>

      <template v-for="(s, si) in state.propuestaSections" :key="s.id">
        <div v-if="state.printSections[s.id]" class="print-section">
          <h3>{{ String(si+1).padStart(2, '0') }} {{ s.label }}</h3>
          <div v-html="s.content"></div>
        </div>
      </template>

      <div v-if="state.printSections.economica">
        <h3>{{ String(state.propuestaSections.length + 1).padStart(2, '0') }} PROPUESTA ECONÓMICA</h3>
        <table class="print-table">
          <thead>
            <tr><th>ITEM</th><th>DESCRIPCIÓN</th><th>CANT.</th><th>P. UNITARIO</th><th>TOTAL</th></tr>
          </thead>
          <tbody>
            <tr v-for="(it, i) in state.proposalItems" :key="i">
              <td>{{ i+1 }}.1</td>
              <td>{{ it.desc }}</td>
              <td>{{ it.qty }}</td>
              <td>{{ fmt((it.qty||0)*(it.price||0)) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="print-totals">
          <div class="row"><span>Subtotal</span><span>{{ fmt(computed.proposalSubtotal.value) }}</span></div>
          <div class="row"><span>IVA / Impuesto ({{ state.taxRate }}%)</span><span>{{ fmt(computed.proposalTax.value) }}</span></div>
          <div class="row total"><span>Total</span><span>{{ fmt(computed.proposalTotal.value) }}</span></div>
        </div>

        <div class="print-signatures">
          <div><div class="line"></div><p>POR EMPRESA</p><p>{{ state.companyRespSig }}</p></div>
          <div><div class="line"></div><p>POR CLIENTE</p><p>{{ state.clientRespSig }}</p></div>
        </div>
      </div>

      <div v-if="state.printSections.gantt">
        <h3>{{ String(state.propuestaSections.length + 2).padStart(2, '0') }} CARTA GANTT</h3>
        <PrintGantt :tasks="state.ganttTasks" :span="state.ganttSpan" :unit="state.ganttUnit" :phases="state.ganttPhases" />
      </div>
    </div>
  </div>

  <!-- Toast notification -->
  <div v-if="state.toast"
    class="fixed bottom-6 right-6 z-50 bg-text text-surface px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold animate-fade-in">
    {{ state.toast }}
  </div>
</template>

<style>
@media screen {
  .print-layout { display: none; }
}

@media print {
  .no-print { display: none !important; }

  body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .print-layout {
    display: block !important;
  }

  .print-cover {
    display: block !important;
    page-break-after: always;
    page-break-inside: avoid;
  }

  .print-cover .rounded-xl { border-radius: 0 !important; }
  .print-cover .min-h-\[500px\] { min-height: 100vh !important; }

  .print-content {
    padding: 1.5cm 2cm;
    font-size: 11pt;
    line-height: 1.5;
  }

  .print-header {
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 2px solid var(--color-print-header);
    padding-bottom: 12px;
    margin-bottom: 24px;
  }

  .print-header h1 {
    font-size: 14pt;
    font-weight: 800;
    color: var(--color-print-header);
    margin: 0;
  }

  .print-header p {
    font-size: 10pt;
    color: var(--color-print-text);
    margin: 0;
  }

  .print-content input,
  .print-content textarea {
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    outline: none !important;
    resize: none !important;
    overflow: hidden !important;
    box-shadow: none !important;
  }

  .print-content .border-gray-200,
  .print-content .border-gray-100 {
    border-color: var(--color-print-border) !important;
  }

  .print-content .rounded-xl,
  .print-content .rounded-lg {
    border-radius: 0 !important;
  }

  .print-content .shadow-sm,
  .print-content .shadow-md {
    box-shadow: none !important;
  }

  .print-content thead th {
    background: var(--color-print-header) !important;
    color: #fff !important;
  }

  .print-content button,
  .print-content [data-print-hide] {
    display: none !important;
  }

  .print-content img { max-width: 100% !important; height: auto !important; }

  .print-content .print-meta { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10pt; }
  .print-content .print-meta td { padding: 2px 12px 2px 0; }
  .print-content .print-meta .label { font-weight: 700; color: var(--color-print-header); }

  .print-content .print-company-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .print-content .print-company-grid h3 { font-size: 10pt; font-weight: 800; color: var(--color-print-header); margin: 0 0 4px; }
  .print-content .print-company-grid p { margin: 1px 0; font-size: 9pt; }

  .print-content .print-section { margin-bottom: 16px; }
  .print-content .print-section h3 { font-size: 11pt; font-weight: 800; color: var(--color-print-header); border-left: 3px solid var(--color-primary); padding-left: 8px; margin: 0 0 6px; }
  .print-content .print-section p { margin: 4px 0; }
  .print-content .print-section ul, .print-content .print-section ol { padding-left: 20px; margin: 4px 0; }

  .print-content .print-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .print-content .print-table th { background: var(--color-print-header); color: #fff; padding: 6px 8px; font-size: 9pt; text-align: left; }
  .print-content .print-table th:first-child { text-align: center; }
  .print-content .print-table th:nth-child(3),
  .print-content .print-table th:nth-child(4),
  .print-content .print-table th:nth-child(5) { text-align: right; }
  .print-content .print-table td { padding: 4px 8px; border-bottom: 1px solid var(--color-print-border); font-size: 9pt; }
  .print-content .print-table td:first-child { text-align: center; }
  .print-content .print-table td:nth-child(3),
  .print-content .print-table td:nth-child(4),
  .print-content .print-table td:nth-child(5) { text-align: right; }

  .print-content .print-totals { width: 60%; margin-left: auto; margin-bottom: 20px; font-size: 10pt; }
  .print-content .print-totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
  .print-content .print-totals .total { font-weight: 800; font-size: 12pt; border-top: 2px solid var(--color-print-header); padding-top: 6px; margin-top: 4px; }

  .print-content .print-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 24px 0; padding: 16px 0; border-top: 1px solid var(--color-print-border); border-bottom: 1px solid var(--color-print-border); text-align: center; }
  .print-content .print-signatures .line { border-top: 1px solid #333; margin-bottom: 4px; }
  .print-content .print-signatures p { margin: 2px 0; font-size: 9pt; }

  a { color: var(--color-primary); text-decoration: none; }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
</style>
