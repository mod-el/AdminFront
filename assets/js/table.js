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

function adminRowClicked(row) {
	if (row.dataset.clickable === '1') {
		if (row.dataset.onclick) {
			eval('var custom_function = function(){ ' + row.dataset.onclick + ' }');
			custom_function.call(row);
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

function selectAllRows(id, enable) {
	_('.results-table[data-table="' + id + '"]').querySelectorAll('[id^="row-checkbox-"]').forEach(checkbox => {
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

	_('#toolbar-button-delete img').src = PATHBASE + 'model/Output/files/loading.gif';

	var request = currentAdminPage.split('/');
	return ajax(adminPrefix + request[0] + '/delete', 'id=' + encodeURIComponent(ids.join(',')) + '&ajax', 'c_id=' + c_id).then(function (r) {
		if (typeof r !== 'object')
			r = {'err': r};

		_('#toolbar-button-delete img').src = PATHBASE + 'model/AdminTemplateEditt/assets/img/toolbar/delete.png';

		if (typeof r.err !== 'undefined') {
			alert(r.err);
		} else {
			selectedRows = [];
			if (request.length === 1)
				reloadResultsTable();
			else
				loadAdminPage(request[0]);
		}

		return r;
	});
}