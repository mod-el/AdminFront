var columnResizing = false;

class Table {
	constructor(id, container, options) {
		this.id = id;
		this.options = options;
		this.container = container;
	}

	render(list) {
		let head = document.createElement('div');
		head.className = 'table-head';
		head.setAttribute('data-table', this.id);

		let subHead = head.appendChild(document.createElement('div'));

		let checkboxTd = subHead.appendChild(document.createElement('div'));
		checkboxTd.className = 'special-cell';
		checkboxTd.style.padding = '0 5px';
		checkboxTd.innerHTML = '<input type="checkbox" onchange="if(this.checked) selectAllRows(1); else selectAllRows(0)"/>';

		let deleteTd = subHead.appendChild(document.createElement('div')); // TODO: renderlo visibile solo se c'è almeno una X
		deleteTd.className = 'special-cell';

		let columns = this.getColumns();
		let widths = this.getWidths();

		columns.forEach(fieldName => {
			let field = this.options['fields'][fieldName];

			let width = 150;
			if (typeof widths[fieldName] !== 'undefined')
				width = widths[fieldName];

			let div = subHead.appendChild(document.createElement('div'));
			div.setAttribute('id', 'column-' + this.id + '-' + fieldName);
			div.setAttribute('data-column', fieldName);
			div.style.width = width + 'px';

			let resize = div.appendChild(document.createElement('div'));
			resize.className = 'table-head-resize';
			resize.setAttribute('data-context-menu', "{'Ottimizza':function(){ autoResizeColumns('" + this.id + "', '" + fieldName + "'); }, 'Ottimizza colonne':function(){ autoResizeColumns('" + this.id + "'); }, 'Personalizza colonne':function(){ visualizers['" + this.id + "'].customizeColumns(); }}");

			resize.addEventListener('mousedown', event => {
				startColumnResize(event, this.id, fieldName);
				event.stopPropagation();
				event.preventDefault();
			});

			resize.addEventListener('dblclick', event => {
				autoResizeColumns(this.id, fieldName);
			});

			// TODO: sorting
			let label = div.appendChild(document.createElement('div'));
			label.addClass('table-head-label');
			if (field.sortable)
				label.addClass('sortable');
			label.innerHTML = field.label;
		});

		/**************************/

		this.container.appendChild(head);
	}

	getWidths() {
		let widths = {};

		if (localStorage.getItem('widths-' + this.id)) {
			try {
				widths = JSON.parse(localStorage.getItem('widths-' + this.id));
			} catch (e) {
				widths = {};
			}
		}

		return widths;
	}

	saveColumnWidth(column, w) {
		let widths = this.getWidths();
		widths[column] = w;

		localStorage.setItem('widths-' + this.id, JSON.stringify(widths));
	}

	getColumns() {
		let columns = null;

		if (localStorage.getItem('columns-' + this.id)) {
			try {
				columns = JSON.parse(localStorage.getItem('columns-' + this.id));
			} catch (e) {
				columns = null;
			}
		}

		if (columns === null)
			columns = this.options['default-fields'];

		return columns;
	}

	customizeColumns() {
		if (typeof this.options['fields'] === 'undefined')
			return;

		let fieldset = document.createElement('fieldset');
		fieldset.className = 'p-3';

		fieldset.innerHTML = '<form action="?" method="post" id="customize-columns-form" onsubmit="visualizers[\'' + this.id + '\'].saveColumns(); return false"><h2>Personalizza colonne</h2><div class="py-1 text-center"><input type="submit" value="Salva preferenza"/></div><div class="container-fluid py-2" id="customize-columns-cont" data-draggable-cont></div><div class="py-1 text-center"><input type="submit" value="Salva preferenza"/></div></form>';

		let cont = fieldset.querySelector('#customize-columns-cont');

		let currentColumns = this.getColumns();

		currentColumns.forEach(name => {
			let field = this.options['fields'][name];
			this.renderColumnChoiceForCustomize(cont, name, field, true);
		});

		Object.keys(this.options['fields']).forEach(name => {
			if (currentColumns.indexOf(name) !== -1)
				return;
			let field = this.options['fields'][name];
			this.renderColumnChoiceForCustomize(cont, name, field, false);
		});

		zkPopup(fieldset.outerHTML);
	}

	renderColumnChoiceForCustomize(cont, name, column, checked) {
		let row = document.createElement('div');
		row.className = 'row';

		let col = document.createElement('div');
		col.className = 'col-12';
		col = row.appendChild(col);

		let checkbox = document.createElement('input');
		checkbox.setAttribute('type', 'checkbox');
		checkbox.setAttribute('name', name);
		checkbox.setAttribute('data-customize-column', name);
		checkbox.setAttribute('id', 'customize-column-' + name);
		checkbox = col.appendChild(checkbox);
		if (checked)
			checkbox.setAttribute('checked', '');

		let labelNode = document.createElement('label');
		labelNode.setAttribute('for', 'customize-column-' + name);
		labelNode.innerHTML = '<i class="fas fa-grip-vertical" data-draggable-grip></i> ' + column.label;
		col.appendChild(labelNode);

		cont.appendChild(row);
	}

	saveColumns() {
		let columns = [];
		document.querySelectorAll('[data-customize-column]').forEach(column => {
			if (column.checked)
				columns.push(column.getAttribute('data-customize-column'));
		});

		localStorage.setItem('columns-' + this.id, JSON.stringify(columns));
		zkPopupClose();

		return search();
	}
}

visualizerClasses['Table'] = Table;

/***********************************************************************/

function startColumnResize(event, table, k) {
	let coords = getMouseCoords(event);
	columnResizing = {
		'table': table,
		'k': k,
		'startX': coords.x,
		'startW': parseInt(_('column-' + table + '-' + k).style.width),
		'endW': false
	};
}

document.addEventListener('mousemove', event => {
	if (columnResizing !== false) {
		let coords = getMouseCoords(event);

		let diff = coords.x - columnResizing.startX;
		let newW = columnResizing.startW + diff;
		if (newW < 20)
			newW = 20;

		let cells = document.querySelectorAll('[data-table="' + columnResizing.table + '"] [data-column="' + columnResizing.k + '"]');
		cells.forEach(cell => {
			cell.style.width = newW + 'px';
		});

		columnResizing.endW = newW;
	}
});

document.addEventListener('mouseup', event => {
	if (columnResizing !== false) {
		if (columnResizing.endW !== false)
			visualizers[columnResizing.table].saveColumnWidth(columnResizing.k, columnResizing.endW);
		columnResizing = false;
	}
});

function autoResizeColumns(table, column) {
	if (typeof column !== 'undefined') {
		let startW = parseInt(_('column-' + table + '-' + column).style.width);
		let maxW = 0;

		let cells = document.querySelectorAll('[data-table="' + table + '"] [data-column="' + column + '"]');
		cells.forEach(cell => {
			cell.lastElementChild.addClass('just-for-calculation');
			let w = cell.lastElementChild.scrollWidth;
			cell.lastElementChild.removeClass('just-for-calculation');

			if (w > maxW)
				maxW = w;
		});

		if (maxW) {
			maxW += 25;
			cells.forEach(cell => {
				cell.style.width = maxW + 'px';
			});
		}

		if (startW !== maxW)
			visualizers[table].saveColumnWidth(column, maxW);
	} else {
		let cells = document.querySelectorAll('.table-head[data-table="' + table + '"] div[data-column]');
		cells.forEach(cell => {
			autoResizeColumns(table, cell.dataset.column);
		});
	}
}