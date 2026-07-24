class Calendar {
	static PALETTE = ['#7b1fa2', '#00796b', '#c2185b', '#5d4037', '#303f9f', '#f57c00', '#455a64', '#0097a7', '#afb42b', '#6d4c41'];
	static GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
	static GIORNI_BREVI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
	static MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
	static SLOT_HEIGHT = 40;

	// Standard visualizers method
	constructor(visualizerId, container, main, options) {
		this.id = visualizerId;
		this.container = container;
		this.main = main;
		this.options = options;

		this.options['visualizer-options'] = {
			'date-field': 'date',
			'duration-field': null, // Durata in minuti; se assente, ogni evento occupa un solo slot
			'label-fields': [],
			'fill-field': null, // Colonna il cui background fa da colore di riempimento evento
			'border-field': null, // Campo il cui valore determina il colore del bordo (+ legenda e slot liberi)
			'slot-minutes': 30,
			'day-start': '08:00',
			'day-end': '20:00',
			'legend': [], // Voci fisse di legenda: [{color, label}]
			'edit-in-popup': false, // Apre creazione/modifica in popup invece di navigare al dettaglio
			...(options['visualizer-options'] || {}),
		};

		this.useFilters = true;
		this.forceTableOnSearch = false;
		this.hasPagination = false;

		this.state = this.loadState();
		this.borderColors = new Map();
		this.borderTexts = new Map();

		// La cancellazione massiva si appoggia alle checkbox della tabella, qui non c'è selezione
		if (this.main) {
			removePageAction('delete');

			if (this.options['visualizer-options']['edit-in-popup'] && this.options.privileges['C']) {
				addPageAction('new', {
					'fa-icon': 'far fa-plus-square',
					'text': 'Nuovo',
					'action': 'getMainVisualizer().openPopupForm(0)',
				});
			}
		}
	}

	loadState() {
		let state = null;
		try {
			state = JSON.parse(sessionStorage.getItem('calendar-state-' + this.id));
		} catch (e) {
			state = null;
		}

		if (!state || !['day', 'week', 'month'].includes(state.view) || !/^\d{4}-\d{2}-\d{2}$/.test(state.date || ''))
			state = {view: 'week', date: this.formatDate(new Date())};

		return state;
	}

	saveState() {
		sessionStorage.setItem('calendar-state-' + this.id, JSON.stringify(this.state));
	}

	// Standard visualizers method
	async getFieldsToRetrieve() {
		let vo = this.options['visualizer-options'];
		return [...new Set([
			vo['date-field'],
			vo['duration-field'],
			...vo['label-fields'],
			vo['fill-field'],
			vo['border-field'],
		].filter(field => field))];
	}

	// Standard visualizers method
	async reload() {
		if (this.main)
			return reloadMainList();
	}

	// Standard visualizers method
	getSorting(options = {}) {
		return [];
	}

	// Standard visualizers method
	setSorting(sorting) {
	}

	// Standard visualizers method
	async getSpecialFilters(options = {}) {
		if (options.view && options.date) {
			this.state = {view: options.view, date: options.date};
			this.saveState();
		}

		let range = this.getRange();
		let dateField = this.options['visualizer-options']['date-field'];
		return [
			{filter: dateField, type: '>=', value: this.formatDate(range.start) + ' 00:00:00'},
			{filter: dateField, type: '<=', value: this.formatDate(range.end) + ' 23:59:59'},
		];
	}

	/* Utility di data */

	parseDate(str) {
		let [y, m, d] = str.split('-').map(n => parseInt(n));
		return new Date(y, m - 1, d);
	}

	formatDate(date) {
		return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
	}

	formatTime(minutes) {
		return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
	}

	parseTime(str) {
		let [h, m] = str.split(':').map(n => parseInt(n));
		return h * 60 + m;
	}

	addDays(date, days) {
		let d = new Date(date);
		d.setDate(d.getDate() + days);
		return d;
	}

	startOfWeek(date) {
		return this.addDays(date, -((date.getDay() + 6) % 7));
	}

	getRange() {
		let date = this.parseDate(this.state.date);
		switch (this.state.view) {
			case 'day':
				return {start: date, end: date};
			case 'week': {
				let start = this.startOfWeek(date);
				return {start, end: this.addDays(start, 6)};
			}
			case 'month': {
				let first = new Date(date.getFullYear(), date.getMonth(), 1);
				let last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
				return {start: this.startOfWeek(first), end: this.addDays(this.startOfWeek(last), 6)};
			}
		}
	}

	/* Navigazione */

	async navigate(view, date) {
		this.state = {view, date: this.formatDate(date)};
		this.saveState();
		this.container.loading();
		return search(null, {
			visualizer: this,
			endpoint: this.options.endpoint,
			empty_main: false,
			history: false,
		});
	}

	shift(direction) {
		let date = this.parseDate(this.state.date);
		switch (this.state.view) {
			case 'day':
				date = this.addDays(date, direction);
				break;
			case 'week':
				date = this.addDays(date, direction * 7);
				break;
			case 'month':
				date = new Date(date.getFullYear(), date.getMonth() + direction, 1);
				break;
		}

		return this.navigate(this.state.view, date);
	}

	/* Rendering */

	// Standard visualizers method
	async render(list, options = {}) {
		if (options.view && options.date) {
			this.state = {view: options.view, date: options.date};
			this.saveState();
		}

		let events = this.parseEvents(list);
		this.buildBorderColors(events);

		this.container.innerHTML = '';

		let calendar = document.createElement('div');
		calendar.className = 'calendar';
		this.container.appendChild(calendar);

		calendar.appendChild(this.buildToolbar());
		calendar.appendChild(this.buildLegend());

		let body = document.createElement('div');
		body.className = 'calendar-body';
		calendar.appendChild(body);

		switch (this.state.view) {
			case 'day':
				this.renderDay(body, events);
				break;
			case 'week':
				this.renderWeek(body, events);
				break;
			case 'month':
				this.renderMonth(body, events);
				break;
		}
	}

	parseEvents(list) {
		let vo = this.options['visualizer-options'];
		let events = [];

		for (let item of list) {
			let cell = item.data[vo['date-field']];
			if (!cell || !cell.value)
				continue;

			let start = new Date(String(cell.value).replace(' ', 'T'));
			if (isNaN(start.getTime()))
				continue;

			let duration = vo['duration-field'] ? parseInt(item.data[vo['duration-field']]?.value) : NaN;
			if (isNaN(duration) || duration <= 0)
				duration = vo['slot-minutes'];

			let labels = [];
			for (let field of vo['label-fields']) {
				if (item.data[field] && item.data[field].text)
					labels.push(item.data[field].text);
			}

			events.push({
				id: item.id,
				item,
				start,
				end: new Date(start.getTime() + duration * 60000),
				label: labels.join(' · ') || '(senza descrizione)',
				fill: (vo['fill-field'] && item.data[vo['fill-field']]?.background) || '#e0e0e0',
				borderValue: vo['border-field'] ? String(item.data[vo['border-field']]?.value ?? '') : '',
				borderText: vo['border-field'] ? (item.data[vo['border-field']]?.text || '') : '',
			});
		}

		events.sort((a, b) => a.start - b.start);
		return events;
	}

	buildBorderColors(events) {
		this.borderColors = new Map();
		this.borderTexts = new Map();

		let values = [...new Set(events.map(ev => ev.borderValue).filter(v => v !== ''))];
		values.sort((a, b) => {
			let na = parseFloat(a), nb = parseFloat(b);
			if (!isNaN(na) && !isNaN(nb))
				return na - nb;
			return a.localeCompare(b);
		});

		for (let [idx, value] of values.entries())
			this.borderColors.set(value, Calendar.PALETTE[idx % Calendar.PALETTE.length]);

		for (let ev of events) {
			if (ev.borderValue !== '' && ev.borderText && !this.borderTexts.has(ev.borderValue))
				this.borderTexts.set(ev.borderValue, ev.borderText);
		}
	}

	readableTextColor(hex) {
		hex = String(hex).replace('#', '');
		if (hex.length === 3)
			hex = hex.split('').map(c => c + c).join('');
		if (hex.length !== 6)
			return '#000000';

		let r = parseInt(hex.substring(0, 2), 16);
		let g = parseInt(hex.substring(2, 4), 16);
		let b = parseInt(hex.substring(4, 6), 16);
		return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#000000' : '#ffffff';
	}

	getSelectedBorderValue() {
		let vo = this.options['visualizer-options'];
		if (!vo['border-field'])
			return null;

		let values = getFiltersValuesFromStorage() || {};
		let value = values[vo['border-field'] + '-='];
		if (value === undefined || value === null || value === '')
			return null;

		return String(value);
	}

	canCreate() {
		return !this.options.toPick && this.options.privileges && this.options.privileges['C'];
	}

	buildToolbar() {
		let toolbar = document.createElement('div');
		toolbar.className = 'calendar-toolbar';

		let nav = document.createElement('div');
		nav.className = 'calendar-nav';
		toolbar.appendChild(nav);

		let prev = document.createElement('button');
		prev.type = 'button';
		prev.className = 'calendar-btn';
		prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
		prev.addEventListener('click', () => this.shift(-1));
		nav.appendChild(prev);

		let today = document.createElement('button');
		today.type = 'button';
		today.className = 'calendar-btn';
		today.textContent = 'Oggi';
		today.addEventListener('click', () => this.navigate(this.state.view, new Date()));
		nav.appendChild(today);

		let next = document.createElement('button');
		next.type = 'button';
		next.className = 'calendar-btn';
		next.innerHTML = '<i class="fas fa-chevron-right"></i>';
		next.addEventListener('click', () => this.shift(1));
		nav.appendChild(next);

		let title = document.createElement('div');
		title.className = 'calendar-title';
		title.textContent = this.getTitle();
		toolbar.appendChild(title);

		let views = document.createElement('div');
		views.className = 'calendar-views';
		for (let [view, label] of [['day', 'Giorno'], ['week', 'Settimana'], ['month', 'Mese']]) {
			let btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'calendar-btn' + (this.state.view === view ? ' active' : '');
			btn.textContent = label;
			btn.addEventListener('click', () => this.navigate(view, this.parseDate(this.state.date)));
			views.appendChild(btn);
		}
		toolbar.appendChild(views);

		return toolbar;
	}

	getTitle() {
		let date = this.parseDate(this.state.date);
		switch (this.state.view) {
			case 'day':
				return Calendar.GIORNI[(date.getDay() + 6) % 7] + ' ' + date.getDate() + ' ' + Calendar.MESI[date.getMonth()] + ' ' + date.getFullYear();
			case 'week': {
				let {start, end} = this.getRange();
				if (start.getMonth() === end.getMonth())
					return start.getDate() + ' – ' + end.getDate() + ' ' + Calendar.MESI[end.getMonth()] + ' ' + end.getFullYear();
				if (start.getFullYear() === end.getFullYear())
					return start.getDate() + ' ' + Calendar.MESI[start.getMonth()] + ' – ' + end.getDate() + ' ' + Calendar.MESI[end.getMonth()] + ' ' + end.getFullYear();
				return start.getDate() + ' ' + Calendar.MESI[start.getMonth()] + ' ' + start.getFullYear() + ' – ' + end.getDate() + ' ' + Calendar.MESI[end.getMonth()] + ' ' + end.getFullYear();
			}
			case 'month': {
				let mese = Calendar.MESI[date.getMonth()];
				return mese.charAt(0).toUpperCase() + mese.slice(1) + ' ' + date.getFullYear();
			}
		}
	}

	buildLegend() {
		let legend = document.createElement('div');
		legend.className = 'calendar-legend';

		for (let entry of this.options['visualizer-options'].legend) {
			let node = document.createElement('div');
			node.className = 'calendar-legend-entry';
			node.innerHTML = '<span class="calendar-legend-swatch" style="background: ' + entry.color + '"></span>';
			node.appendChild(document.createTextNode(entry.label));
			legend.appendChild(node);
		}

		for (let [value, color] of this.borderColors) {
			let node = document.createElement('div');
			node.className = 'calendar-legend-entry';
			node.innerHTML = '<span class="calendar-legend-swatch calendar-legend-swatch-border" style="border-color: ' + color + '"></span>';
			node.appendChild(document.createTextNode(this.borderTexts.get(value) || value));
			legend.appendChild(node);
		}

		return legend;
	}

	buildChip(ev) {
		let chip = document.createElement('div');
		chip.className = 'calendar-chip';
		chip.style.background = ev.fill;
		chip.style.color = this.readableTextColor(ev.fill);
		if (ev.borderValue !== '' && this.borderColors.has(ev.borderValue))
			chip.style.borderColor = this.borderColors.get(ev.borderValue);

		let time = this.formatTime(ev.start.getHours() * 60 + ev.start.getMinutes());
		chip.innerHTML = '<span class="calendar-chip-time">' + time + '</span> <span class="calendar-chip-label">' + ev.label + '</span>';
		chip.title = time + ' · ' + ev.label.replace(/<[^>]*>/g, '');

		chip.dataset.id = ev.id;
		if (ev.item.onclick)
			chip.dataset.onclick = ev.item.onclick;

		if (this.options.toPick) {
			chip.classList.add('clickable');
			chip.addEventListener('click', event => {
				event.stopPropagation();
				this.options.toPick.call(chip, ev.id);
			});
		} else if (ev.item.privileges && ev.item.privileges['R']) {
			chip.classList.add('clickable');
			chip.addEventListener('click', event => {
				event.stopPropagation();
				if (this.options['visualizer-options']['edit-in-popup'] && !ev.item.onclick)
					this.openPopupForm(ev.id);
				else
					adminRowClicked(chip);
			});
		}

		return chip;
	}

	slotClicked(dateStr, minutes) {
		if (!this.canCreate())
			return;

		let vo = this.options['visualizer-options'];
		let init = {
			[vo['date-field']]: dateStr + ' ' + this.formatTime(minutes) + ':00',
		};

		let selected = this.getSelectedBorderValue();
		if (selected !== null && vo['border-field'])
			init[vo['border-field']] = selected;

		if (vo['edit-in-popup'])
			this.openPopupForm(0, init);
		else
			newElement({init_data: JSON.stringify(init)});
	}

	async openPopupForm(id, initData = null) {
		return openElementInPopup(id, {
			formName: 'popup',
			init_data: initData,
			afterLoad: async () => {
				// Il template viene inserito via innerHTML, che non esegue gli script inline:
				// li eseguo a mano e richiamo l'eventuale elementCallback (come fa il flusso a pagina intera)
				let form = _('form-popup');
				if (form) {
					for (let script of form.querySelectorAll('script')) {
						try {
							eval(script.textContent);
						} catch (e) {
							console.error(e);
						}
					}
				}
				await callElementCallback();
			},
			afterSave: async () => {
				await this.reload();
			},
		});
	}

	/* Vista giornaliera */

	layoutOverlaps(events) {
		let clusters = [];
		let current = null;
		for (let ev of events) {
			if (!current || ev.startMin >= current.end) {
				current = {events: [], end: ev.endMin};
				clusters.push(current);
			}
			current.events.push(ev);
			if (ev.endMin > current.end)
				current.end = ev.endMin;
		}

		for (let cluster of clusters) {
			let columns = []; // Minuto di fine dell'ultimo evento per colonna
			for (let ev of cluster.events) {
				let col = columns.findIndex(end => end <= ev.startMin);
				if (col === -1) {
					col = columns.length;
					columns.push(ev.endMin);
				} else {
					columns[col] = ev.endMin;
				}
				ev.col = col;
			}
			for (let ev of cluster.events)
				ev.cols = columns.length;
		}
	}

	renderDay(body, events) {
		let vo = this.options['visualizer-options'];
		let dateStr = this.state.date;
		let slot = vo['slot-minutes'];
		let dayStart = this.parseDate(dateStr);
		let dayEnd = this.addDays(dayStart, 1);

		let dayEvents = events.filter(ev => ev.start < dayEnd && ev.end > dayStart);

		// Confini della griglia: fascia oraria configurata, estesa se ci sono eventi fuori fascia
		let gridStart = this.parseTime(vo['day-start']);
		let gridEnd = this.parseTime(vo['day-end']);
		for (let ev of dayEvents) {
			ev.startMin = ev.start <= dayStart ? 0 : ev.start.getHours() * 60 + ev.start.getMinutes();
			let endMin = ev.end >= dayEnd ? 24 * 60 : ev.end.getHours() * 60 + ev.end.getMinutes();
			ev.endMin = Math.max(endMin, ev.startMin + slot / 2);

			if (ev.startMin < gridStart)
				gridStart = Math.floor(ev.startMin / slot) * slot;
			if (ev.endMin > gridEnd)
				gridEnd = Math.min(Math.ceil(ev.endMin / slot) * slot, 24 * 60);
		}

		this.layoutOverlaps(dayEvents);

		let selected = this.getSelectedBorderValue();

		let grid = document.createElement('div');
		grid.className = 'calendar-grid-day';
		body.appendChild(grid);

		let gutter = document.createElement('div');
		gutter.className = 'calendar-gutter';
		grid.appendChild(gutter);

		let column = document.createElement('div');
		column.className = 'calendar-day-column';
		grid.appendChild(column);

		for (let minutes = gridStart; minutes < gridEnd; minutes += slot) {
			let label = document.createElement('div');
			label.className = 'calendar-gutter-slot';
			if (minutes % 60 === 0)
				label.textContent = this.formatTime(minutes);
			gutter.appendChild(label);

			let slotNode = document.createElement('div');
			slotNode.className = 'calendar-slot' + (minutes % 60 === 0 ? ' calendar-slot-hour' : '');

			if (selected !== null) {
				let busy = dayEvents.some(ev => ev.borderValue === selected && ev.startMin < minutes + slot && ev.endMin > minutes);
				if (!busy)
					slotNode.classList.add('calendar-slot-free');
			}

			if (this.canCreate()) {
				slotNode.classList.add('clickable');
				slotNode.title = 'Nuovo alle ' + this.formatTime(minutes);
				slotNode.addEventListener('click', () => this.slotClicked(dateStr, minutes));
			}

			column.appendChild(slotNode);
		}

		for (let ev of dayEvents) {
			let block = this.buildChip(ev);
			block.classList.add('calendar-event');
			block.style.top = ((ev.startMin - gridStart) / slot * Calendar.SLOT_HEIGHT + 1) + 'px';
			block.style.height = (Math.max((ev.endMin - ev.startMin) / slot * Calendar.SLOT_HEIGHT, Calendar.SLOT_HEIGHT / 2) - 3) + 'px';
			block.style.left = 'calc(' + (ev.col / ev.cols * 100) + '% + 2px)';
			block.style.width = 'calc(' + (100 / ev.cols) + '% - 6px)';
			column.appendChild(block);
		}
	}

	/* Vista settimanale */

	renderWeek(body, events) {
		let vo = this.options['visualizer-options'];
		let range = this.getRange();
		let todayStr = this.formatDate(new Date());

		let grid = document.createElement('div');
		grid.className = 'calendar-week';
		body.appendChild(grid);

		for (let i = 0; i < 7; i++) {
			let day = this.addDays(range.start, i);
			let dayStr = this.formatDate(day);
			let dayEnd = this.addDays(day, 1);

			let cell = document.createElement('div');
			cell.className = 'calendar-week-day' + (dayStr === todayStr ? ' calendar-day-today' : '');
			grid.appendChild(cell);

			let header = document.createElement('div');
			header.className = 'calendar-day-header clickable';
			header.textContent = Calendar.GIORNI_BREVI[i] + ' ' + day.getDate();
			header.title = 'Vai alla vista giornaliera';
			header.addEventListener('click', () => this.navigate('day', day));
			cell.appendChild(header);

			let chipsCont = document.createElement('div');
			chipsCont.className = 'calendar-day-events';
			cell.appendChild(chipsCont);

			if (this.canCreate()) {
				chipsCont.classList.add('clickable');
				chipsCont.addEventListener('click', event => {
					if (event.target === chipsCont)
						this.slotClicked(dayStr, this.parseTime(vo['day-start']));
				});
			}

			for (let ev of events.filter(ev2 => ev2.start >= day && ev2.start < dayEnd))
				chipsCont.appendChild(this.buildChip(ev));
		}
	}

	/* Vista mensile */

	renderMonth(body, events) {
		let vo = this.options['visualizer-options'];
		let range = this.getRange();
		let current = this.parseDate(this.state.date);
		let todayStr = this.formatDate(new Date());

		let grid = document.createElement('div');
		grid.className = 'calendar-month';
		body.appendChild(grid);

		for (let giorno of Calendar.GIORNI_BREVI) {
			let header = document.createElement('div');
			header.className = 'calendar-month-header';
			header.textContent = giorno;
			grid.appendChild(header);
		}

		for (let day = new Date(range.start); day <= range.end; day = this.addDays(day, 1)) {
			let dayCopy = new Date(day);
			let dayStr = this.formatDate(day);
			let dayEnd = this.addDays(day, 1);
			let dayEvents = events.filter(ev => ev.start >= dayCopy && ev.start < dayEnd);

			let cell = document.createElement('div');
			cell.className = 'calendar-month-day';
			if (day.getMonth() !== current.getMonth())
				cell.classList.add('calendar-day-other-month');
			if (dayStr === todayStr)
				cell.classList.add('calendar-day-today');
			grid.appendChild(cell);

			let number = document.createElement('div');
			number.className = 'calendar-day-number clickable';
			number.textContent = day.getDate();
			number.title = 'Vai alla vista giornaliera';
			number.addEventListener('click', event => {
				event.stopPropagation();
				this.navigate('day', dayCopy);
			});
			cell.appendChild(number);

			if (this.canCreate())
				cell.addEventListener('click', event => {
					if (event.target === cell)
						this.slotClicked(dayStr, this.parseTime(vo['day-start']));
				});

			let maxChips = 3;
			for (let ev of dayEvents.slice(0, maxChips))
				cell.appendChild(this.buildChip(ev));

			if (dayEvents.length > maxChips) {
				let more = document.createElement('div');
				more.className = 'calendar-more clickable';
				more.textContent = '+' + (dayEvents.length - maxChips) + ' altri';
				more.addEventListener('click', event => {
					event.stopPropagation();
					this.navigate('day', dayCopy);
				});
				cell.appendChild(more);
			}
		}
	}
}

visualizerClasses.set('Calendar', Calendar);
