var columnResizing = false;
var selectedRows = [];
var holdingRowsSelection = null;

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

		this.container.appendChild(head);

		/**************************/

		let draggable = this.options['custom-order']; // TODO: solo se non è stato applicato un sort manuale

		let body = document.createElement('div');
		body.className = 'results-table';
		body.setAttribute('data-table', this.id);
		body.addEventListener('scroll', () => {
			if (body.scrollLeft > (head.scrollWidth - head.clientWidth))
				body.scrollLeft = head.scrollWidth - head.clientWidth;
			head.scrollLeft = body.scrollLeft;
		});

		let bodyMain = body.appendChild(document.createElement('div'));
		if (draggable) {
			bodyMain.setAttribute('data-draggable-cont', '');
			bodyMain.setAttribute('data-draggable-callback', 'adminRowDragged(element, target)');
		}

		let rowCount = 0;
		list.forEach(item => {
			let clickable = '1';
			if (!item.id || !item.permissions['R'])
				clickable = '0';

			let row = bodyMain.appendChild(document.createElement('div'));
			row.className = 'results-table-row-cont';
			if (draggable) {
				if (item.id) {
					row.setAttribute('data-draggable-id', item.id);
					row.setAttribute('data-draggable-index', item['order-idx']);

					if (draggable.depending_on.length > 0) {
						let depending_values = [];
						draggable.depending_on.forEach(depending_field => {
							if (typeof item.data[depending_field] !== 'undefined')
								depending_values.push(item.data[depending_field].value);
						});
						row.setAttribute('data-draggable-parent', depending_values.join(','));
					}
				} else {
					row.setAttribute('data-draggable-set', '1');
				}
			} else {
				row.addEventListener('click', event => {
					if (event.button === 0)
						adminRowClicked(row);
				});
			}

			let innerRow = row.appendChild(document.createElement('div'));
			innerRow.className = 'results-table-row';
			innerRow.setAttribute('data-n', rowCount.toString());
			innerRow.setAttribute('data-id', item.id);
			innerRow.setAttribute('data-clickable', clickable);
			// TODO: "onclick" personalizzato; colore di sfondo; colore testo

			let checkboxCell = innerRow.appendChild(document.createElement('div'));
			checkboxCell.className = 'special-cell';
			checkboxCell.addEventListener('mousedown', event => {
				event.stopPropagation();
			});
			checkboxCell.addEventListener('mouseup', event => {
				event.stopPropagation();
				releaseRowsSelection();
			});
			checkboxCell.addEventListener('click', function (event) {
				event.stopPropagation();

				let check = this.firstElementChild.firstElementChild;
				check.getValue().then(v => {
					if (v)
						check.setValue(0);
					else
						check.setValue(1);
				});
			});
			checkboxCell = checkboxCell.appendChild(document.createElement('div'));
			checkboxCell.innerHTML = '<input type="checkbox" value="1" id="row-checkbox-' + item.id + '" data-id="' + item.id + '" onchange="selectRow(\'' + item.id + '\', this.checked ? 1 : 0)" onclick="event.stopPropagation()" onmousedown="if(event.shiftKey){ holdRowsSelection(this); } event.stopPropagation()" onmouseover="if(holdingRowsSelection!==null) this.setValue(holdingRowsSelection)" onkeydown="moveBetweenRows(this, event.keyCode)"/>';

			let deleteCell = innerRow.appendChild(document.createElement('div'));
			deleteCell.className = 'special-cell';
			deleteCell.addEventListener('mousedown', event => {
				event.stopPropagation();
			});
			deleteCell.addEventListener('click', event => {
				event.stopPropagation();
			});
			deleteCell = deleteCell.appendChild(document.createElement('div'));
			if (item.permissions['D']) {
				deleteCell.innerHTML = '<a href="#" onclick="event.stopPropagation(); deleteRows([\'' + item.id + '\']); return false"><img src="' + PATHBASE + 'model/AdminTemplateEditt/files/img/delete.png" alt="" style="vertical-align: middle"/></a>';
			}

			columns.forEach(fieldName => {
				let field = this.options['fields'][fieldName];

				let width = 150;
				if (typeof widths[fieldName] !== 'undefined')
					width = widths[fieldName];

				let div = innerRow.appendChild(document.createElement('div'));
				// TODO: colore sfondo e colore testo
				div.style.width = width + 'px';
				div.setAttribute('data-column', fieldName);
				div.setAttribute('title', item.data[fieldName].text);

				// TODO: gestione editable
				if (!clickable) {
					div.addEventListener('mousedown', event => {
						event.stopPropagation();
					});
					div.addEventListener('mouseup', event => {
						event.stopPropagation();
					});
					div.addEventListener('click', event => {
						event.stopPropagation();
					});
				}

				// TODO: gestione delle colonne price
				let innerDiv = div.appendChild(document.createElement('div'));
				innerDiv.innerHTML = entities(item.data[fieldName].text);
			});

			rowCount++;
		});

		this.container.appendChild(body);
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

window.addEventListener('mouseup', event => {
	releaseRowsSelection();

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

function holdRowsSelection(checkbox) {
	if (checkbox.getValue(true))
		holdingRowsSelection = 0;
	else
		holdingRowsSelection = 1;
	checkbox.setValue(holdingRowsSelection);
}

function releaseRowsSelection() {
	holdingRowsSelection = null;
}

function moveBetweenRows(checkbox, keyCode) {
	var id = checkbox.getAttribute('data-id');
	var row = document.querySelector('.results-table-row[data-id="' + id + '"]');
	if (!row)
		return;
	var n = row.getAttribute('data-n');

	switch (keyCode) {
		case 38:
			n--;
			break;
		case 40:
			n++;
			break;
		default:
			return;
			break;
	}

	var nextRow = document.querySelector('.results-table-row[data-n="' + n + '"]');
	if (!nextRow)
		return;

	var nextId = nextRow.getAttribute('data-id');
	var nextCheckbox = document.getElementById('row-checkbox-' + nextId);
	nextCheckbox.focus();
}