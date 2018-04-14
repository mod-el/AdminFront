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
			fieldName = fieldName.substr(0, fieldName.length - ('-' + name + '-' + id).length);
			promises.push(input.getValue().then((fieldName => {
				return v => {
					list[id][fieldName] = v;
				};
			})(fieldName)));
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
	changeSaveButton();
	resize();

	getSublistArray('list').then(list => {
		let deleted = getDeletedFromSublist('list');
		return ajax(adminPrefix + currentAdminPage.split('/')[0] + '/saveFormList', 'ajax', 'data=' + encodeURIComponent(JSON.stringify(list)) + '&deleted=' + encodeURIComponent(JSON.stringify(deleted)) + '&c_id=' + c_id).then(r => {
			saving = false;
			restoreSaveButton();

			if (typeof r !== 'object') {
				alert(r);
				return false;
			}
			if (r.status === 'ok') {
				return reloadResultsTable().then(() => {
					inPageMessage('Salvataggio correttamente effettuato.', 'green-message');
				});
			} else if (typeof r.err !== 'undefined') {
				alert(r.err);
			} else {
				alert('Generic error');
			}
		});
	});
}