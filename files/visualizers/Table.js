var columnResizing = false;

class Table {
	constructor(id, options) {
		this.id = id;
		this.options = options;

		let widths = this.getWidths();

		this.fields = [];
		this.options['default-fields'].forEach(fieldName => {
			let field = this.options['fields'][fieldName];
			field.id = fieldName;

			if (typeof widths[field.id] !== 'undefined')
				field.width = widths[field.id];
			else
				field.width = 150;

			this.fields.push(field);
		});


	}

	render(container, list) {
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

		this.fields.forEach(field => {
			let div = subHead.appendChild(document.createElement('div'));
			div.setAttribute('id', 'column-' + this.id + '-' + field.id);
			div.setAttribute('data-column', field.id);
			div.style.width = field.width + 'px';

			let resize = div.appendChild(document.createElement('div'));
			resize.className = 'table-head-resize';
			resize.setAttribute('data-context-menu', "{'Ottimizza':function(){ autoResizeColumns('" + this.id + "', '" + field.id + "'); }, 'Ottimizza colonne':function(){ autoResizeColumns('" + this.id + "'); }}");

			resize.addEventListener('mousedown', event => {
				startColumnResize(event, this.id, field.id);
				event.stopPropagation();
				event.preventDefault();
			});
			resize.addEventListener('dblclick', event => {
				autoResizeColumns(this.id, field.id);
			});

			// TODO: sorting
			let label = div.appendChild(document.createElement('div'));
			label.addClass('table-head-label');
			if (field.sortable)
				label.addClass('sortable');
			label.innerHTML = field.label;
		});

		/**************************/

		container.appendChild(head);
	}

	getWidths() {
		let widths = {};

		if (localStorage.getItem(this.id)) {
			try {
				widths = JSON.parse(localStorage.getItem(this.id));
			} catch (e) {
				widths = {};
			}
		}

		return widths;
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
		/*if (columnResizing.endW !== false)
			saveColumnWidth(columnResizing.table, columnResizing.k, columnResizing.endW);*/
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
			saveColumnWidth(table, column, maxW);
	} else {
		let cells = document.querySelectorAll('.table-head[data-table="' + table + '"] div[data-column]');
		cells.forEach(cell => {
			autoResizeColumns(table, cell.dataset.column);
		});
	}
}

/*function saveColumnWidth(k, w) {
	let request = currentAdminPage.split('/');
	return ajax(adminPrefix + request[0] + '/saveWidth', 'ajax&k=' + encodeURIComponent(k), 'w=' + encodeURIComponent(w) + '&c_id=' + c_id);
}*/