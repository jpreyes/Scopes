let _keyCounter = 0;
function uid() { return ++_keyCounter; }

const APP = Vue.createApp({
  data() {
    return {
      activeTab: 'propuesta',
      tabs: [
        { id: 'portada', label: 'Portada', icon: '🏠' },
        { id: 'propuesta', label: 'Propuesta', icon: '📄' },
        { id: 'costeo', label: 'Costeo Interno', icon: '📊' },
        { id: 'historial', label: 'Historial', icon: '📋' },
      ],

      // Meta
      quoteNumber: 'CT-PS-001-2026',
      quoteRev: '01',
      quoteDate: '',
      validUntil: '',
      currency: '$',
      contactPerson: '',

      // Company
      company: 'Predikta Solutions SpA',
      companyAddr: 'Santiago, Chile',
      companyPhone: '+56 9 1234 5678',
      companyEmail: 'contacto@predikta.cl',
      companyResp: '',
      companyRespSig: '',

      // Client
      clientName: '',
      clientAddr: '',
      clientPhone: '',
      clientEmail: '',
      clientResp: '',
      clientRespSig: '',

      // Proposal
      subheader: 'LEVANTAMIENTO Y ESTUDIO DE LOSA',
      sections: [
        { key: 'presentacion', label: '01 PRESENTACIÓN', value: '', placeholder: 'Descripción de la empresa...', rows: 3 },
        { key: 'servicio', label: '02 SERVICIO', value: '', placeholder: 'Descripción del servicio a realizar...', rows: 4 },
        { key: 'objetivo', label: '03 OBJETIVO', value: '', placeholder: 'Objetivo del servicio...', rows: 3 },
        { key: 'alcance', label: '04 ALCANCE DEL SERVICIO', value: '', placeholder: 'Alcance del servicio...', rows: 3 },
        { key: 'ventajas', label: '05 VENTAJAS Y DIFERENCIADORES', value: '', placeholder: 'Ventajas y diferenciadores...', rows: 3 },
      ],
      notesSections: [
        { key: 'notes', label: 'NOTAS / CONDICIONES', value: '' },
        { key: 'entregables', label: 'ENTREGABLES', value: '' },
      ],

      proposalItems: [],

      taxRate: 19,
      dragOver: false,

      // Costeo
      costeoMarkup: 20,
      costeoUtilidadPct: 15,
      costeoImpuestoPct: 19,
      costeoCategories: [
        {
          id: 'personal', label: '1. PERSONAL',
          items: [
            { desc: 'Ingeniero Senior', qty: 1, days: 2, cost: 250000, sale: 300000, _key: uid(), _sel: true },
            { desc: 'Ingeniero Junior', qty: 1, days: 2, cost: 150000, sale: 180000, _key: uid(), _sel: true },
            { desc: 'Técnico Scanner', qty: 1, days: 2, cost: 120000, sale: 144000, _key: uid(), _sel: true },
            { desc: 'Constructor Civil', qty: 1, days: 2, cost: 100000, sale: 120000, _key: uid(), _sel: true },
          ]
        },
        {
          id: 'traslados', label: '2. TRASLADOS Y VIÁTICOS',
          items: [
            { desc: 'Pasajes aéreos', qty: 2, days: 1, cost: 150000, sale: 180000, _key: uid(), _sel: true },
            { desc: 'Hotel', qty: 2, days: 2, cost: 75000, sale: 90000, _key: uid(), _sel: true },
            { desc: 'Viáticos', qty: 3, days: 2, cost: 50000, sale: 60000, _key: uid(), _sel: true },
            { desc: 'Combustible / Peajes', qty: 1, days: 1, cost: 80000, sale: 96000, _key: uid(), _sel: true },
            { desc: 'Hidratación', qty: 3, days: 2, cost: 5000, sale: 6000, _key: uid(), _sel: true },
          ]
        },
        {
          id: 'equipos', label: '3. EQUIPOS E INSUMOS',
          items: [
            { desc: 'Profometer PM8000', qty: 1, days: 2, cost: 60000, sale: 72000, _key: uid(), _sel: true },
            { desc: 'Esclerómetro ZC3-A', qty: 1, days: 2, cost: 35000, sale: 42000, _key: uid(), _sel: true },
            { desc: 'Ultrasónico Pundit 200', qty: 1, days: 2, cost: 55000, sale: 66000, _key: uid(), _sel: true },
            { desc: 'Escáner láser 3D', qty: 1, days: 2, cost: 120000, sale: 144000, _key: uid(), _sel: true },
            { desc: 'Equipo carbonatación', qty: 1, days: 1, cost: 25000, sale: 30000, _key: uid(), _sel: true },
          ]
        },
        {
          id: 'epp', label: '4. EPP / OTROS',
          items: [
            { desc: 'Mascarilla 3M + filtros', qty: 3, days: 1, cost: 15000, sale: 18000, _key: uid(), _sel: true },
            { desc: 'Guantes de seguridad', qty: 3, days: 1, cost: 8000, sale: 9600, _key: uid(), _sel: true },
            { desc: 'Lentes de seguridad', qty: 3, days: 1, cost: 5000, sale: 6000, _key: uid(), _sel: true },
            { desc: 'Protector auditivo', qty: 3, days: 1, cost: 7000, sale: 8400, _key: uid(), _sel: true },
            { desc: 'Casco 3M', qty: 3, days: 1, cost: 12000, sale: 14400, _key: uid(), _sel: true },
          ]
        },
      ],

      // Cover
      coverBg: 'image8.png',
      coverImages: ['image8.png', 'image2.png', 'image5.png', 'image10.png', 'image7.png'],

      // Historial
      budgetList: [],
    };
  },

  computed: {
    proposalSubtotal() {
      return this.proposalItems.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0);
    },
    proposalTax() {
      return this.proposalSubtotal * (this.taxRate / 100);
    },
    proposalTotal() {
      return this.proposalSubtotal + this.proposalTax;
    },
    costeoTotalCost() {
      let total = 0;
      this.costeoCategories.forEach(cat => {
        cat.items.forEach(it => {
          total += (it.qty || 0) * (it.days || 0) * (it.cost || 0);
        });
      });
      return total;
    },
    costeoTotalSale() {
      let total = 0;
      this.costeoCategories.forEach(cat => {
        cat.items.forEach(it => {
          if (it._sel) {
            total += (it.qty || 0) * (it.days || 0) * (it.sale || 0);
          }
        });
      });
      return total;
    },
    costeoUtilidad() {
      return this.costeoTotalSale - this.costeoTotalCost;
    },
    costeoMargen() {
      if (this.costeoTotalSale === 0) return 0;
      return ((this.costeoTotalSale - this.costeoTotalCost) / this.costeoTotalSale * 100).toFixed(1);
    },
    selectedCount() {
      let count = 0;
      this.costeoCategories.forEach(cat => {
        cat.items.forEach(it => { if (it._sel) count++; });
      });
      return count;
    },
  },

  methods: {
    fmt(amount) {
      const cfg = this.getCurrencyConfig();
      const val = cfg.decimals === 0
        ? Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
        : Number(amount).toFixed(cfg.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return cfg.symbol + val;
    },
    getCurrencyConfig() {
      switch(this.currency) {
        case 'UF': return { symbol: 'UF ', decimals: 2 };
        case 'US$': return { symbol: 'US$ ', decimals: 2 };
        case '€': return { symbol: '€ ', decimals: 2 };
        default: return { symbol: '$ ', decimals: 0 };
      }
    },

    catTotal(cat) {
      let t = 0;
      cat.items.forEach(it => {
        t += (it.qty || 0) * (it.days || 0) * (it.sale || 0);
      });
      return t;
    },

    addProposalItem() {
      this.proposalItems.push({ desc: '', qty: 1, price: 0, _key: uid() });
    },

    removeProposalItem(i) {
      if (this.proposalItems.length <= 1) {
        const it = this.proposalItems[0];
        it.desc = ''; it.qty = 1; it.price = 0;
        return;
      }
      this.proposalItems.splice(i, 1);
    },

    recalcSale(item) {
      item.sale = Math.round(item.cost * (1 + this.costeoMarkup / 100));
    },

    addCosteoItem(cat) {
      cat.items.push({ desc: '', qty: 1, days: 1, cost: 0, sale: 0, _key: uid(), _sel: true });
    },

    removeCosteoItem(cat, i) {
      if (cat.items.length <= 1) {
        const it = cat.items[0];
        it.desc = ''; it.qty = 1; it.days = 1; it.cost = 0; it.sale = 0;
        return;
      }
      cat.items.splice(i, 1);
    },

    // Drag & Drop
    onDragStart(e, catId, idx) {
      e.dataTransfer.setData('text/plain', JSON.stringify({ catId, idx }));
      e.dataTransfer.effectAllowed = 'copy';
      this.dragOver = true;
    },

    // Called from HTML drop zone listeners
    handleDrop(e) {
      e.preventDefault();
      this.dragOver = false;
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const { catId, idx } = JSON.parse(raw);
      const cat = this.costeoCategories.find(c => c.id === catId);
      if (!cat || !cat.items[idx]) return;
      const src = cat.items[idx];
      const fullDesc = `${cat.label} - ${src.desc}`;
      this.proposalItems.push({
        desc: fullDesc,
        qty: (src.qty || 0) * (src.days || 1),
        price: src.sale || 0,
        _key: uid(),
      });
      // Visual feedback
      const zone = document.getElementById('proposalDropZone');
      zone.classList.add('drop-success');
      setTimeout(() => zone.classList.remove('drop-success'), 800);
    },

    syncSelectedToProposal() {
      this.proposalItems = [];
      this.costeoCategories.forEach(cat => {
        cat.items.forEach(it => {
          if (!it._sel) return;
          const fullDesc = `${cat.label} - ${it.desc}`;
          this.proposalItems.push({
            desc: fullDesc,
            qty: (it.qty || 0) * (it.days || 1),
            price: it.sale || 0,
            _key: uid(),
          });
        });
      });
      if (this.proposalItems.length === 0) this.addProposalItem();
      this.activeTab = 'propuesta';
    },

    // Budget persistence
    generateQuoteNumber() {
      const saved = JSON.parse(localStorage.getItem('presupuesto_counter') || '0');
      const next = saved + 1;
      const num = String(next).padStart(3, '0');
      const year = new Date().getFullYear();
      this.quoteNumber = `CT-PS-${num}-${year}`;
    },

    incrementCounter() {
      const saved = JSON.parse(localStorage.getItem('presupuesto_counter') || '0');
      localStorage.setItem('presupuesto_counter', JSON.stringify(saved + 1));
    },

    collectData() {
      const sections = {};
      this.sections.forEach(s => sections[s.key] = s.value);
      const notes = {};
      this.notesSections.forEach(s => notes[s.key] = s.value);
      const costeo = {};
      this.costeoCategories.forEach(cat => {
        costeo[cat.id] = cat.items.map(it => ({ ...it }));
      });

      return {
        quoteNumber: this.quoteNumber,
        quoteRev: this.quoteRev,
        quoteDate: this.quoteDate,
        validUntil: this.validUntil,
        currency: this.currency,
        contactPerson: this.contactPerson,
        company: this.company, companyAddr: this.companyAddr,
        companyPhone: this.companyPhone, companyEmail: this.companyEmail,
        companyResp: this.companyResp, companyRespSig: this.companyRespSig,
        client: this.clientName, clientAddr: this.clientAddr,
        clientPhone: this.clientPhone, clientEmail: this.clientEmail,
        clientResp: this.clientResp, clientRespSig: this.clientRespSig,
        subheader: this.subheader,
        sections, notes,
        proposalItems: JSON.parse(JSON.stringify(this.proposalItems)),
        taxRate: this.taxRate,
        costeo,
        costeoMarkup: this.costeoMarkup,
        costeoUtilidadPct: this.costeoUtilidadPct,
        costeoImpuestoPct: this.costeoImpuestoPct,
      };
    },

    saveBudget() {
      const data = this.collectData();
      const key = 'presupuesto_' + data.quoteNumber.replace(/\//g, '_');
      let list = JSON.parse(localStorage.getItem('presupuesto_list') || '[]');

      if (!list.find(item => item.quoteNumber === data.quoteNumber)) {
        list.push({ quoteNumber: data.quoteNumber, client: data.client, date: data.quoteDate, savedAt: new Date().toISOString() });
        localStorage.setItem('presupuesto_list', JSON.stringify(list));
      }

      localStorage.setItem(key, JSON.stringify(data));
      this.incrementCounter();
      this.loadHistorial();
      alert('Presupuesto guardado correctamente.');
    },

    loadBudget() {
      const list = JSON.parse(localStorage.getItem('presupuesto_list') || '[]');
      if (list.length === 0) {
        alert('No hay presupuestos guardados.');
        return;
      }
      let msg = 'Presupuestos guardados:\n';
      list.forEach((item, i) => {
        msg += `${i + 1}. ${item.quoteNumber} - ${item.client || 'Sin cliente'} (${item.date})\n`;
      });
      msg += '\nIngrese el número del presupuesto a cargar:';
      const idx = prompt(msg);
      if (idx === null) return;
      const n = parseInt(idx) - 1;
      if (isNaN(n) || n < 0 || n >= list.length) {
        alert('Número inválido.');
        return;
      }
      this.loadBudgetByNum(list[n].quoteNumber);
    },

    loadBudgetByNum(qn) {
      const key = 'presupuesto_' + qn.replace(/\//g, '_');
      const data = JSON.parse(localStorage.getItem(key));
      if (!data) { alert('Error al cargar.'); return; }
      this.restoreData(data);
    },

    restoreData(data) {
      // Meta
      this.quoteNumber = data.quoteNumber || '';
      this.quoteRev = data.quoteRev || '01';
      this.quoteDate = data.quoteDate || '';
      this.validUntil = data.validUntil || '';
      this.currency = data.currency || '$';
      this.contactPerson = data.contactPerson || '';
      this.subheader = data.subheader || '';

      // Company
      this.company = data.company || '';
      this.companyAddr = data.companyAddr || '';
      this.companyPhone = data.companyPhone || '';
      this.companyEmail = data.companyEmail || '';
      this.companyResp = data.companyResp || '';
      this.companyRespSig = data.companyRespSig || '';

      // Client
      this.clientName = data.client || '';
      this.clientAddr = data.clientAddr || '';
      this.clientPhone = data.clientPhone || '';
      this.clientEmail = data.clientEmail || '';
      this.clientResp = data.clientResp || '';
      this.clientRespSig = data.clientRespSig || '';

      // Sections
      if (data.sections) {
        this.sections.forEach(s => {
          s.value = data.sections[s.key] || '';
        });
      }
      if (data.notes) {
        this.notesSections.forEach(s => {
          s.value = data.notes[s.key] || '';
        });
      }

      // Proposal items
      this.proposalItems = (data.proposalItems || []).map(it => ({ ...it, _key: uid() }));
      if (this.proposalItems.length === 0) this.addProposalItem();
      this.taxRate = data.taxRate || 19;

      // Costeo
      if (data.costeo) {
        this.costeoCategories.forEach(cat => {
          const saved = data.costeo[cat.id];
          if (saved && saved.length) {
            cat.items = saved.map(it => ({ ...it, _key: uid(), _sel: it._sel !== undefined ? it._sel : true }));
          }
        });
      }
      this.costeoMarkup = data.costeoMarkup || 20;
      this.costeoUtilidadPct = data.costeoUtilidadPct || 15;
      this.costeoImpuestoPct = data.costeoImpuestoPct || 19;

      this.activeTab = 'propuesta';
    },

    deleteBudget(qn) {
      if (!confirm(`¿Eliminar presupuesto ${qn}?`)) return;
      const key = 'presupuesto_' + qn.replace(/\//g, '_');
      localStorage.removeItem(key);
      let list = JSON.parse(localStorage.getItem('presupuesto_list') || '[]');
      list = list.filter(item => item.quoteNumber !== qn);
      localStorage.setItem('presupuesto_list', JSON.stringify(list));
      this.loadHistorial();
    },

    loadHistorial() {
      const list = JSON.parse(localStorage.getItem('presupuesto_list') || '[]');
      this.budgetList = list.slice().reverse().map(item => {
        const key = 'presupuesto_' + item.quoteNumber.replace(/\//g, '_');
        const full = JSON.parse(localStorage.getItem(key));
        const total = full ? full.proposalItems.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0), 0) : 0;
        const currency = full ? full.currency : '$';
        const cfg = this.getCurrencyConfigFor(currency);
        const val = cfg.decimals === 0
          ? Math.round(total).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
          : Number(total).toFixed(cfg.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return {
          quoteNumber: item.quoteNumber,
          client: item.client || '-',
          date: item.date || '-',
          total: val,
          displayTotal: cfg.symbol + val,
        };
      });
    },

    getCurrencyConfigFor(c) {
      switch(c) {
        case 'UF': return { symbol: 'UF ', decimals: 2 };
        case 'US$': return { symbol: 'US$ ', decimals: 2 };
        case '€': return { symbol: '€ ', decimals: 2 };
        default: return { symbol: '$ ', decimals: 0 };
      }
    },

    // Excel exports
    exportCosteoExcel() {
      const wsData = [];
      wsData.push(['COSTEO INTERNO', this.quoteNumber, '', '', '', '', '', '']);
      wsData.push(['Cliente:', this.clientName, 'Fecha:', this.quoteDate, '', '', '', '']);
      wsData.push([]);

      this.costeoCategories.forEach(cat => {
        wsData.push([cat.label, '', '', '', '', '', '', '']);
        wsData.push(['ITEM', 'DESCRIPCIÓN', 'CANT.', 'DÍAS', 'P. COSTO', 'P. VENTA', 'TOTAL VENTA', 'SEL']);
        cat.items.forEach((it, idx) => {
          wsData.push([idx + 1, it.desc, it.qty, it.days, it.cost, it.sale, it.qty * it.days * it.sale, it._sel ? 'Sí' : 'No']);
        });
        wsData.push([]);
      });

      wsData.push(['Total Costos Directos', '', '', '', '', '', this.costeoTotalCost, '']);
      wsData.push(['Total Venta', '', '', '', '', '', this.costeoTotalSale, '']);
      wsData.push(['Utilidad (' + this.costeoUtilidadPct + '%)', '', '', '', '', '', this.costeoUtilidad, '']);
      wsData.push(['Margen', '', '', '', '', '', this.costeoMargen + '%', '']);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Costeo');
      XLSX.writeFile(wb, `Costeo_${this.quoteNumber.replace(/\//g, '-')}_${this.quoteDate || 'sindef'}.xlsx`);
    },

    exportHistorialExcel() {
      if (this.budgetList.length === 0) { alert('No hay datos para exportar.'); return; }
      const wsData = [['N° Presupuesto', 'Cliente', 'Fecha', 'Total', 'Guardado']];
      this.budgetList.forEach(item => {
        wsData.push([item.quoteNumber, item.client, item.date, item.displayTotal, '']);
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Historial');
      XLSX.writeFile(wb, 'Historial_Presupuestos.xlsx');
    },

    printPage() {
      window.print();
    },

    // Setup drag & drop
    setupDropZone() {
      const zone = document.getElementById('proposalDropZone');
      if (!zone) return;
      zone.addEventListener('dragover', (e) => { e.preventDefault(); this.dragOver = true; });
      zone.addEventListener('dragleave', () => { this.dragOver = false; });
      zone.addEventListener('drop', (e) => this.handleDrop(e));
    },

    // Setup Sortable for proposal items reordering
    setupSortable() {
      const el = document.getElementById('proposalItemsBody');
      if (!el || typeof Sortable === 'undefined') return;
      Sortable.create(el, {
        handle: '.col-item',
        animation: 200,
        onEnd: (evt) => {
          const item = this.proposalItems.splice(evt.oldIndex, 1)[0];
          this.proposalItems.splice(evt.newIndex, 0, item);
        },
      });
    },
  },

  mounted() {
    // Set dates
    const today = new Date();
    this.quoteDate = today.toISOString().slice(0, 10);
    const future = new Date();
    future.setDate(future.getDate() + 30);
    this.validUntil = future.toISOString().slice(0, 10);

    this.generateQuoteNumber();
    this.loadHistorial();
    if (this.proposalItems.length === 0) this.addProposalItem();

    this.$nextTick(() => {
      this.setupDropZone();
      this.setupSortable();
    });
  },
});

const vm = APP.mount('#app');
