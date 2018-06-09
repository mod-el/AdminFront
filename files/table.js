function tableEvents() {
	let table = _('results-table');

	table.addEventListener('scroll', function () {
		let intest = _('table-headings');
		if (this.scrollLeft > (intest.scrollWidth - intest.clientWidth))
			this.scrollLeft = intest.scrollWidth - intest.clientWidth;
		intest.scrollLeft = this.scrollLeft;
	});

	table.querySelectorAll('[id^="row-checkbox-"]').forEach(function (checkbox) {
		if (selectedRows.indexOf(checkbox.dataset.id) !== -1)
			checkbox.setValue(1, false);
	});

	table.querySelectorAll('.results-table-row').forEach(function (row) {
		if (!row.parentNode.parentNode.hasAttribute('data-draggable-cont')) {
			row.addEventListener('click', function (event) {
				if (event.button === 0) {
					adminRowClicked(row);
				}
			});
		}
	});

	if (_('sortedBy'))
		sortedBy = JSON.parse(_('sortedBy').getValue(true));
	if (_('currentPage'))
		currentPage = _('currentPage').getValue(true);
}

function instantSave(id, f, field) {
	field.style.opacity = 0.2;
	let v = field.getValue(true);

	let ids = [];
	document.querySelectorAll('.results-table-row[data-id]').forEach(r => {
		ids.push(r.getAttribute('data-id'));
	});

	let riga = _('.results-table-row[data-id="' + id + '"]');
	if (!riga)
		return false;

	let n = parseInt(riga.getAttribute('data-n'));
	if (_('instant-' + (n + 1) + '-' + f)) {
		_('instant-' + (n + 1) + '-' + f).focus();
		_('instant-' + (n + 1) + '-' + f).select();
	}

	return ajax(adminPrefix + (currentAdminPage.split('/'))[0] + '/saveInstant/' + id, 'track=' + encodeURIComponent(ids.join(',')) + '&ajax', 'c_id=' + c_id + '&field=' + encodeURIComponent(f) + '&v=' + encodeURIComponent(v)).then(r => {
		if (typeof r !== 'object') {
			alert(r);
			field.style.display = 'none';
		} else if (typeof r.err !== 'undefined') {
			alert(r.err);
			field.style.display = 'none';
		} else if (r.status !== 'ok') {
			alert('Error');
			field.style.display = 'none';
		} else {
			field.style.opacity = 1;

			for (let id in r.changed) {
				let el = r.changed[id];

				let row = _('.results-table-row[data-id="' + id + '"]');
				if (!row)
					return;

				if (el.background)
					row.style.background = el.background;
				else
					row.style.background = '';

				if (el.color)
					row.style.color = el.color;
				else
					row.style.color = '';

				for (let k in el.columns) {
					let cell = row.querySelector('[data-column="' + k + '"]');
					if (!cell)
						continue;

					let c = el.columns[k];

					if (c.background)
						cell.style.background = c.background;
					else
						cell.style.background = '';

					if (c.color)
						cell.style.color = c.color;
					else
						cell.style.color = '';

					if (cell.hasClass('editable-cell')) {
						let f = cell.querySelector('input, select, textarea');
						f.setValue(c.value, false);
					} else {
						cell.firstElementChild.innerHTML = c.text;
					}
				}
			}
		}
	});
}

document.addEventListener('mousemove', event => {
	let coords = getMouseCoords(event);
	if (columnResizing !== false) {
		let diff = coords.x - columnResizing.startX;
		let newW = columnResizing.startW + diff;
		if (newW < 20)
			newW = 20;

		let celle = document.querySelectorAll('[data-column="' + columnResizing.k + '"]');
		celle.forEach(function (cella) {
			cella.style.width = newW + 'px';
		});

		columnResizing.endW = newW;
	}
});

document.addEventListener('mouseup', event => {
	if (columnResizing !== false) {
		if (columnResizing.endW !== false)
			saveColumnWidth(columnResizing.k, columnResizing.endW);
		columnResizing = false;
	}
});

function autoResize(label) {
	if (label !== false) {
		let startW = parseInt(_('column-' + label).style.width);
		let maxW = 0;

		let celle = document.querySelectorAll('[data-column="' + label + '"]');
		celle.forEach(function (cella) {
			cella.lastElementChild.addClass('just-for-calculation');
			let w = cella.lastElementChild.scrollWidth;
			cella.lastElementChild.removeClass('just-for-calculation');

			if (w > maxW)
				maxW = w;
		});

		if (maxW) {
			maxW += 20;
			celle.forEach(function (cella) {
				cella.style.width = maxW + 'px';
			});
		}

		if (startW != maxW)
			saveColumnWidth(label, maxW);
	} else {
		let celle = document.querySelectorAll('#table-headings div[data-column]');
		celle.forEach(function (cella) {
			autoResize(cella.dataset.column);
		});
	}
}

function saveColumnWidth(k, w) {
	let request = currentAdminPage.split('/');
	return ajax(adminPrefix + request[0] + '/saveWidth', 'k=' + encodeURIComponent(k), 'w=' + encodeURIComponent(w) + '&c_id=' + c_id);
}

function adminRowClicked(row) {
	if (row.dataset.clickable === '1') {
		if (row.dataset.onclick) {
			eval('var custom_function = function(){ ' + this.dataset.onclick + ' }');
			custom_function.call(this);
		} else {
			loadElement(currentAdminPage.split('/')[0], row.dataset.id);
		}
	}
}

function adminRowDragged(element, target) {
	if (element.idx === target.idx) {
		let row = document.querySelector('.results-table-row[data-id="' + element.id + '"]');
		adminRowClicked(row);
	} else {
		showLoadingMask();
		ajax(adminPrefix + currentAdminPage.split('/')[0] + '/changeOrder/' + encodeURIComponent(element.id), 'to=' + target.idx + '&ajax', 'c_id=' + c_id).then(r => {
			hideLoadingMask();

			if (r !== 'ok') {
				alert(r);
				reloadResultsTable();
			}
		});
	}
}


function selectRow(id, enable) {
	let k = selectedRows.indexOf(id);
	if (k !== -1) {
		if (!enable) {
			selectedRows.splice(k, 1);
		}
	} else {
		if (enable) {
			selectedRows.push(id);
		}
	}
}

function selectAllRows(enable) {
	_('results-table').querySelectorAll('[id^="row-checkbox-"]').forEach(function (checkbox) {
		checkbox.setValue(enable);
	});
}

function deleteRows(ids) {
	let usingChecks = false;
	if (typeof ids === 'undefined') {
		ids = selectedRows;
		usingChecks = true;
	}
	if (ids.length === 0) {
		alert('Nessuna riga selezionata');
		return false;
	}

	if (!confirm('Sicuro di voler eliminare ' + ids.length + ' righe?'))
		return false;

	if (usingChecks) {
		let nChecked = 0;
		_('results-table').querySelectorAll('[id^="row-checkbox-"]').forEach(function (checkbox) {
			if (checkbox.checked)
				nChecked++;
		});

		if (ids.length > nChecked) {
			if (!confirm('ATTENZIONE: ci sono righe selezionate anche in altre pagine, saranno eliminate anche quelle. Continuare?'))
				return false;
		}
	}

	_('#toolbar-button-delete img').src = absolute_path + 'model/Output/files/loading.gif';

	var request = currentAdminPage.split('/');
	return ajax(adminPrefix + request[0] + '/delete', 'id=' + encodeURIComponent(ids.join(',')) + '&ajax', 'c_id=' + c_id).then(function (r) {
		if (typeof r !== 'object')
			r = {'err': r};

		_('#toolbar-button-delete img').src = absolute_path + 'model/AdminTemplateEditt/files/img/toolbar/delete.png';

		if (typeof r.err !== 'undefined') {
			alert(r.err);
		} else {
			selectedRows = [];
			if (request.length === 1)
				reloadResultsTable();
			else
				loadAdminPage([request[0]]);
		}

		return r;
	});
}