function getSublistArray(name) {
	let cont = _('cont-ch-' + name);
	if (!cont)
		return {};

	let list = {};

	let promises = [];

	cont.querySelectorAll('input[type="hidden"][name^="ch-' + name + '-"]').forEach(mainInput => {
		if (mainInput.getValue(true) != '1')
			return;
		let id = mainInput.name.substr(name.length + 4);
		let row = _('cont-ch-' + name + '-' + id);
		if (!row)
			return;

		list[id] = {};

		row.querySelectorAll('input[name^="ch-"], select[name^="ch-"], textarea[name^="ch-"]').forEach(input => {
			if (input === mainInput)
				return;

			let fieldName = input.name.substr(3);

			if (input.getAttribute('data-multilang')) {
				let lang = input.getAttribute('data-lang');
				fieldName = fieldName.substr(0, fieldName.length - ('-' + name + '-' + id + '-' + lang).length);

				if (typeof list[id][fieldName] === 'undefined')
					list[id][fieldName] = {};

				promises.push(input.getValue().then(((fieldName, lang) => {
					return v => {
						list[id][fieldName][lang] = v;
					};
				})(fieldName, lang)));
			} else {
				fieldName = fieldName.substr(0, fieldName.length - ('-' + name + '-' + id).length);
				promises.push(input.getValue().then((fieldName => {
					return v => {
						list[id][fieldName] = v;
					};
				})(fieldName)));
			}
		});
	});

	return Promise.all(promises).then(() => {
		return list;
	});
}

function getDeletedFromSublist(name) {
	let cont = _('cont-ch-' + name);
	if (!cont)
		return {};

	let list = [];

	cont.querySelectorAll('input[type="hidden"][name^="ch-' + name + '-"]').forEach(mainInput => {
		if (mainInput.getValue(true) != '1') {
			let id = mainInput.name.substr(name.length + 4);
			list.push(id);
		}
	});

	return list;
}

function saveFormList() {
	if (saving) {
		alert('Already saving');
		return false;
	}

	saving = true;
	toolbarButtonLoading('save');
	resize();

	return getSublistArray('list').then(list => {
		let deleted = getDeletedFromSublist('list');
		return ajax(adminPrefix + currentAdminPage.split('/')[0] + '/saveFormList', 'ajax', 'data=' + encodeURIComponent(JSON.stringify(list)) + '&deleted=' + encodeURIComponent(JSON.stringify(deleted)) + '&c_id=' + c_id).then(r => {
			saving = false;
			toolbarButtonRestore('save');
			historyWipe();

			if (typeof r !== 'object') {
				alert(r);
				return false;
			}
			if (r.status === 'ok') {
				return reloadResultsTable().then(() => {
					inPageMessage('Salvataggio correttamente effettuato.', 'success');
				});
			} else if (typeof r.err !== 'undefined') {
				alert(r.err);
			} else {
				alert('Generic error');
			}
		});
	});
}

function sublistAddRow(name, id, trigger) {
	if (typeof trigger === 'undefined')
		trigger = true;

	let form = _('adminForm');

	if (typeof id === 'undefined' || id === null) {
		let next = 0;
		while (typeof form['ch-' + name + '-new' + next] !== 'undefined')
			next++;

		id = 'new' + next;
	}

	let container = _('cont-ch-' + name);
	if (!container) {
		return new Promise(function (resolve) {
			resolve(false);
		});
	}

	let div = document.createElement('div');
	div.className = container.getAttribute('data-rows-class');
	div.id = 'cont-ch-' + name + '-' + id;
	div.innerHTML = _('sublist-template-' + name).innerHTML.replace(/\[n\]/g, id);

	let addbutton = _('cont-ch-' + name + '-addbutton');
	if (addbutton && addbutton.parentNode === container) {
		container.insertBefore(div, addbutton);
	} else {
		container.appendChild(div);
	}

	changedValues['ch-' + name + '-' + id] = 1;

	if (trigger) {
		changeHistory.push({
			'sublist': name,
			'action': 'new',
			'id': id
		});

		rebuildHistoryBox();

		return changedHtml().then((div => {
			return () => {
				div.querySelectorAll('input, select, textarea').forEach(f => {
					if (!f.name)
						return;

					f.setAttribute('data-filled', '1');
				});
			};
		})(div)).then(monitorFields).then((div => {
			return () => {
				let firstInput = div.querySelector('input:not([type="hidden"])');
				if (firstInput) {
					firstInput.focus();
					if (firstInput.select)
						firstInput.select();
				}
				return id;
			};
		})(div));
	} else {
		return changedHtml();
	}
}

function sublistDeleteRow(name, id, trigger) {
	if (typeof trigger === 'undefined')
		trigger = true;

	let form = _('adminForm');
	if (typeof form['ch-' + name + '-' + id] !== 'undefined')
		form['ch-' + name + '-' + id].setValue(0, false);
	_('cont-ch-' + name + '-' + id).style.display = 'none';

	changedValues['ch-' + name + '-' + id] = 0;

	if (trigger) {
		changeHistory.push({
			'sublist': name,
			'action': 'delete',
			'id': id
		});

		rebuildHistoryBox();
	}

	return changedHtml();
}

function sublistRestoreRow(name, id) {
	let form = _('adminForm');
	if (typeof form['ch-' + name + '-' + id] !== 'undefined')
		form['ch-' + name + '-' + id].setValue(1, false);
	_('cont-ch-' + name + '-' + id).style.display = 'block';
	changedValues['ch-' + name + '-' + id] = 1;

	return changedHtml();
}