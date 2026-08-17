<script setup>
import { ref } from 'vue'
import { usePresupuesto } from '../stores/presupuesto.js'
const { state, fmt, computed, recalcSales, addCosteoCategory, removeCosteoCategory, addCosteoItem, removeCosteoItem, addCosteoGroup, removeCosteoGroup, addItemToGroup, removeItemFromGroup, findItemByKey, groupTotal, syncSelectedToProposal, exportCosteoExcel } = usePresupuesto()

let dragSource = { type: null, key: null, groupId: null }

function onDragStart(e, itemKey) {
  e.dataTransfer.setData('text/plain', String(itemKey))
  e.dataTransfer.effectAllowed = 'copy'
  dragSource = { type: null, key: null, groupId: null }
}

function onDragStartCategory(e, cat) {
  const keys = cat.items.map(i => i._key)
  e.dataTransfer.setData('text/plain', JSON.stringify(keys))
  e.dataTransfer.effectAllowed = 'copy'
  dragSource = { type: null, key: null, groupId: null }
}

function onDragStartGroup(e, itemKey, groupId) {
  e.dataTransfer.setData('text/plain', String(itemKey))
  e.dataTransfer.effectAllowed = 'move'
  dragSource = { type: 'group', key: itemKey, groupId }
}

function onDrop(e, groupId) {
  e.preventDefault()
  if (dragSource.type === 'group' && dragSource.groupId === groupId) return
  const raw = e.dataTransfer.getData('text/plain')
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      parsed.forEach(k => addItemToGroup(groupId, k))
      return
    }
  } catch (_) {}
  const key = parseInt(raw)
  if (!key) return
  addItemToGroup(groupId, key)
  if (dragSource.type === 'group' && dragSource.key === key) {
    const src = state.costeoGroups.find(g => g.id === dragSource.groupId)
    if (src) {
      const idx = src.itemKeys.indexOf(key)
      if (idx !== -1) removeItemFromGroup(src.id, idx)
    }
  }
}

/**
 * Las mismas tres operaciones del drag, por toque. `dragstart`/`drop` son
 * HTML5 y no existen en táctil, así que en un teléfono los grupos no se podían
 * armar: se veían y no recibían nada. La semántica se conserva —de categoría a
 * grupo copia, de grupo a grupo mueve— porque debajo son las mismas funciones
 * del store que usa `onDrop`.
 */
function asignarItem(itemKey, groupId) {
  if (!groupId) return
  addItemToGroup(groupId, itemKey)
}
function asignarCategoria(cat, groupId) {
  if (!groupId) return
  cat.items.forEach(i => addItemToGroup(groupId, i._key))
}
function moverItem(fromGroupId, idx, key, toGroupId) {
  if (!toGroupId || toGroupId === fromGroupId) return
  addItemToGroup(toGroupId, key)
  removeItemFromGroup(fromGroupId, idx)
}
const otrosGrupos = id => state.costeoGroups.filter(g => g.id !== id)

const newGroupName = ref('')
</script>

<template>
  <div class="flex flex-col md:flex-row gap-6">

    <!-- LEFT: categories with draggable items -->
    <div class="flex-1 min-w-0 md:pr-2">
      <div class="flex justify-between items-center flex-wrap gap-3 pb-3 mb-4 border-b border-border">
        <h2 class="text-base font-bold text-text">
          COSTEO INTERNO <span class="ml-2 text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded font-bold align-middle">CONFIDENCIAL</span>
        </h2>
        <div class="flex gap-5 text-xs text-text-muted">
          <span>N°: <strong class="text-text">{{ state.quoteNumber }}</strong></span>
          <span>Cliente: <strong class="text-text">{{ state.clientName || '-' }}</strong></span>
        </div>
      </div>

      <div class="flex items-center gap-3 mb-4 px-4 py-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl flex-wrap shadow-sm">
        <span class="text-xs font-semibold text-amber-800">Margen</span>
        <select v-model="state.costeoMarginMode" @change="recalcSales"
          class="px-2 py-1 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800 bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10">
          <option value="venta">Margen de Venta</option>
          <option value="utilidad">Margen de Utilidad</option>
        </select>
        <div class="flex items-center gap-2 w-28">
          <input type="number" v-model.number="state.costeoMarkup" min="0" max="500" step="0.01"
            @input="recalcSales"
            class="w-full px-2 py-1 border border-amber-200 rounded-lg text-sm font-bold text-primary text-right outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
          <span class="text-sm font-bold text-primary">%</span>
        </div>
        <span class="text-[11px] text-text-dim">{{ state.costeoMarginMode === 'utilidad' ? 'P.Venta = Costo / (1 − margen%)' : 'P.Venta = Costo × (1 + margen%)' }}</span>
      </div>

      <div class="flex flex-col gap-4 mb-5">
        <div v-for="cat in state.costeoCategories" :key="cat.id"
          class="border border-border rounded-xl overflow-hidden bg-surface hover:shadow-lg transition">

          <div draggable="true" @dragstart="onDragStartCategory($event, cat)"
            class="flex justify-between items-center px-4 py-2.5 bg-surface/50 border-b border-border cursor-grab hover:bg-surface transition">
            <div class="flex items-center gap-1 flex-1 min-w-0">
              <span class="text-text-dim shrink-0 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>
              <input type="text" v-model="cat.label"
                class="w-full text-sm font-bold text-text bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1 outline-none transition" />
            </div>
            <span class="text-sm font-bold text-primary shrink-0">{{ fmt(cat.items.reduce((s,i) => s + (i.qty||0)*(i.days||0)*(i.sale||0), 0)) }}</span>
            <!-- El <select> es una acción, no un valor: vuelve solo a «→ grupo»
                 para poder mandar la misma categoría a dos grupos seguidos. -->
            <select v-if="state.costeoGroups.length" draggable="false"
              :value="''" @change="asignarCategoria(cat, $event.target.value); $event.target.value = ''"
              class="ml-2 shrink-0 px-1.5 py-0.5 border border-border rounded text-[10px] text-text-muted bg-surface outline-none focus:border-primary cursor-pointer"
              title="Agregar toda la categoría a un grupo">
              <option value="">→ grupo</option>
              <option v-for="g in state.costeoGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
            <button @click="removeCosteoCategory(cat.id)" class="text-red-400 hover:text-red-600 text-sm ml-2 transition cursor-pointer shrink-0" title="Eliminar categoría">&times;</button>
          </div>

          <div class="p-2">
            <div v-for="(it, i) in cat.items" :key="it._key"
              draggable="true"
              @dragstart="onDragStart($event, it._key)"
              class="flex items-center gap-2 p-2 mb-1 bg-surface/50 border border-border-light rounded-lg hover:border-blue-400 transition cursor-grab">

              <span class="text-text-dim shrink-0 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>

              <div class="flex-1 min-w-0">
                <input type="text" v-model="it.desc" class="w-full px-2 py-1 border border-transparent rounded text-sm font-semibold outline-none focus:border-primary focus:bg-surface transition" />
                <div class="flex gap-2 mt-1 flex-wrap items-center">
                  <label class="text-[10px] text-text-dim flex items-center gap-1">
                    C. <input type="number" v-model.number="it.qty" min="0" class="w-12 px-1 py-0.5 border border-border rounded text-xs text-right outline-none focus:border-primary" />
                  </label>
                  <label class="text-[10px] text-text-dim flex items-center gap-1">
                    D. <input type="number" v-model.number="it.days" min="0" class="w-12 px-1 py-0.5 border border-border rounded text-xs text-right outline-none focus:border-primary" />
                  </label>
                  <label class="text-[10px] text-text-dim flex items-center gap-1">
                    Costo <input type="number" v-model.number="it.cost" min="0" step="1" @input="recalcSales"
                      class="w-16 px-1 py-0.5 border border-border rounded text-xs text-right outline-none focus:border-primary" />
                  </label>
                  <label class="text-[10px] text-text-dim flex items-center gap-1">
                    Vta <input type="number" v-model.number="it.sale" min="0" step="1"
                      class="w-16 px-1 py-0.5 border border-border rounded text-xs text-right outline-none focus:border-primary" />
                  </label>
                  <span class="text-xs font-bold text-primary min-w-[5rem] text-right">{{ fmt((it.qty||0)*(it.days||0)*(it.sale||0)) }}</span>
                </div>
              </div>

              <select v-if="state.costeoGroups.length" draggable="false"
                :value="''" @change="asignarItem(it._key, $event.target.value); $event.target.value = ''"
                class="shrink-0 px-1.5 py-0.5 border border-border rounded text-[10px] text-text-muted bg-surface outline-none focus:border-primary cursor-pointer"
                title="Agregar a un grupo">
                <option value="">→</option>
                <option v-for="g in state.costeoGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>

              <button @click="removeCosteoItem(cat, i)" class="text-red-400 hover:text-red-600 text-lg px-1 opacity-30 hover:opacity-100 transition cursor-pointer shrink-0">&times;</button>
            </div>
          </div>

          <div class="px-3 pb-3">
            <button @click="addCosteoItem(cat)" class="px-3 py-1 text-xs text-text-muted border border-dashed border-border rounded-lg hover:bg-surface/50 transition cursor-pointer">+ Agregar item</button>
          </div>
        </div>
      </div>
      <button @click="addCosteoCategory()" class="w-full px-3 py-2 text-xs text-text-muted border border-dashed border-border rounded-xl hover:bg-surface/50 transition cursor-pointer">+ Agregar categoría</button>
    </div>

    <!-- RIGHT: groups panel (sticky, follows scroll) -->
    <div class="md:w-[340px] w-full shrink-0 space-y-3 md:border-l md:border-border md:pl-5 pt-4 md:pt-0 border-t md:border-t-0 border-border
      md:sticky md:top-[4.5rem] md:self-start md:max-h-[calc(100vh-5.5rem)] md:overflow-y-auto md:pb-4">

        <div class="flex items-center gap-2">
          <input v-model="newGroupName" @keyup.enter="addCosteoGroup(newGroupName); newGroupName = ''"
            placeholder="Nuevo grupo…"
            class="flex-1 px-3 py-1.5 border border-border rounded-lg text-xs outline-none focus:border-primary" />
          <button @click="addCosteoGroup(newGroupName); newGroupName = ''"
            class="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition cursor-pointer shrink-0">+</button>
        </div>

        <div v-for="g in state.costeoGroups" :key="g.id"
          class="border border-border rounded-xl overflow-hidden bg-surface"
          @dragover.prevent
          @drop="onDrop($event, g.id)">

          <div class="flex items-center justify-between px-3 py-2 bg-surface/50 border-b border-border">
            <div class="flex items-center gap-1 flex-1 min-w-0">
              <input type="text" v-model="g.name"
                class="w-full text-xs font-bold text-text bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1 outline-none transition" />
            </div>
            <span class="text-xs font-bold text-primary shrink-0">{{ fmt(groupTotal(g.id)) }}</span>
            <button @click="removeCosteoGroup(g.id)" class="text-red-400 hover:text-red-600 text-sm ml-1 transition cursor-pointer shrink-0">&times;</button>
          </div>

          <div class="p-1.5 min-h-[40px]">
            <div v-if="!g.itemKeys.length" class="text-[10px] text-text-dim text-center py-2 border border-dashed border-border rounded-lg">
              Arrastra items aquí, o mándalos con «→» desde la categoría
            </div>
            <div v-for="(key, idx) in g.itemKeys" :key="key"
              draggable="true" @dragstart="onDragStartGroup($event, key, g.id)"
              class="flex items-center justify-between px-2 py-1 mb-0.5 bg-surface/50 rounded text-[11px] cursor-grab hover:bg-surface transition">
              <span class="truncate flex-1">{{ findItemByKey(key)?.desc || '—' }}</span>
              <span class="font-semibold text-primary ml-1">{{ findItemByKey(key) ? fmt((findItemByKey(key).qty||0)*(findItemByKey(key).days||0)*(findItemByKey(key).sale||0)) : '' }}</span>
              <select v-if="otrosGrupos(g.id).length" draggable="false"
                :value="''" @change="moverItem(g.id, idx, key, $event.target.value); $event.target.value = ''"
                class="shrink-0 ml-1 px-1 py-0.5 border border-border rounded text-[10px] text-text-muted bg-surface outline-none focus:border-primary cursor-pointer"
                title="Mover a otro grupo">
                <option value="">⇄</option>
                <option v-for="og in otrosGrupos(g.id)" :key="og.id" :value="og.id">{{ og.name }}</option>
              </select>
              <button @click="removeItemFromGroup(g.id, idx)" class="text-red-400 hover:text-red-600 text-xs ml-1 transition cursor-pointer">&times;</button>
            </div>
          </div>
        </div>

        <div class="p-3 bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl border border-border text-xs space-y-1">
          <div class="flex justify-between">
            <span class="text-text-muted">Total Costos</span>
            <span class="font-semibold">{{ fmt(computed.costeoTotalCost.value) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-muted">Total Venta</span>
            <span class="font-semibold text-primary">{{ fmt(computed.costeoTotalSale.value) }}</span>
          </div>
          <div class="flex justify-between pt-1 border-t border-border">
            <span class="text-text-muted">Utilidad</span>
            <span class="font-semibold text-emerald-600">{{ fmt(computed.costeoUtilidad.value) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-text-muted">Margen</span>
            <span class="font-bold text-amber-600">{{ computed.costeoMargen.value }}%</span>
          </div>
        </div>

        <button @click="syncSelectedToProposal"
          class="w-full px-4 py-2.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover transition flex items-center justify-center gap-1.5 cursor-pointer">
          → Sincronizar a Propuesta
          <span v-if="computed.selectedCount.value" class="bg-white text-primary text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{{ computed.selectedCount.value }}</span>
        </button>

        <button @click="exportCosteoExcel" class="w-full px-4 py-2.5 bg-success text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition cursor-pointer">
          Exportar a Excel
        </button>
    </div>

  </div>
</template>
