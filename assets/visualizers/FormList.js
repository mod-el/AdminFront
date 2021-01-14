class FormList {
	// Standard visualizers method
	constructor(visualizerId, container, main, options) {
		this.id = visualizerId;
		this.container = container;
		this.main = main;
		this.options = options;

		this.options['visualizer-options'] = {
			"type": 'row',
			"class": 'flex-fields formlist-row',
			"add-button": true,
			"add-button-position": 'after',
			"on-add": null, // TODO
			"on-delete": null, // TODO
			...(options['visualizer-options'] || {})
		};

		this.useFilters = true;
		this.hasPagination = true;

		this.rows = new Map();
		this.newRows = [];
		this.saving = false;

		if (this.main) {
			if (this.options.privileges['C']) {
				addPageAction('new', {
					'fa-icon': 'far fa-plus-square',
					'text': 'Nuovo',
					'action': 'getMainVisualizer().addLocalRow()',
				});
			} else {
				removePageAction('new');
			}

			if (this.options.privileges['C'] || this.options.privileges['U']) {
				addPageAction('save', {
					'fa-icon': 'far fa-save',
					'text': 'Salva',
					'action': 'getMainVisualizer().save()',
				});
			}

			removePageAction('delete');
		}
	}

	// Standard visualizers method
	async render(list, options = {}) {
		this.container.innerHTML = '';

		let addButtonRow = null;
		if (this.options.privileges['C'] && this.options['visualizer-options']['add-button']) {
			addButtonRow = document.createElement('div');
			addButtonRow.className = 'rob-field-cont formlist-row';
			addButtonRow.style.cursor = 'pointer';
			addButtonRow.innerHTML = `<div class="rob-field" style="width: 30px"></div><div class="rob-field" style="width: calc(100% - 30px)">` + (this.options['visualizer-options']['add-button'] === true ? '<i class="fas fa-plus" aria-hidden="true"></i> Aggiungi' : this.options['visualizer-options']['add-button']) + `</div>`;
			addButtonRow.addEventListener('click', () => {
				this.addLocalRow();
			})
		}

		if (addButtonRow && this.options['visualizer-options']['add-button-position'] === 'before')
			this.container.appendChild(addButtonRow);

		this.rowsContainer = document.createElement('div');
		this.container.appendChild(this.rowsContainer);

		if (addButtonRow && this.options['visualizer-options']['add-button-position'] === 'after')
			this.container.appendChild(addButtonRow);

		this.template = new Promise(async (resolve, reject) => {
			let templateDiv = document.createElement('div');
			templateDiv.id = 'formlist-template-' + this.id;
			templateDiv.className = 'formlist-template';

			let templateUrl = adminPrefix + 'template/';
			let get = {ajax: ''};
			if (this.main)
				templateUrl += this.id;
			else
				templateUrl += currentAdminPage.split('/')[0] + '/' + this.id;

			templateDiv.innerHTML = await loadPage(templateUrl, get, {}, {fill_main: false});

			resolve(templateDiv);
		});

		if (this.main) {
			this.basicData = adminApiRequest('page/' + this.id + '/data/0');
		} else {
			this.basicData = new Promise(resolve => {
				let defaultData = {};
				for (let k of Object.keys(this.options.fields))
					defaultData[k] = this.options.fields[k].hasOwnProperty('default') ? this.options.fields[k].default : null;

				resolve({
					fields: this.options.fields,
					data: defaultData
				});
			});
		}

		// Forza il caricamento in background
		this.template.then();
		this.basicData.then();

		if (list.length > 0) {
			for (let item of list) {
				let data = {};
				for (let k of Object.keys(item.data))
					data[k] = (item.data[k] && typeof item.data[k] === 'object' && item.data[k].hasOwnProperty('value')) ? item.data[k].value : item.data[k];

				await this.addLocalRow(item.id, {
					data,
					fields: (await this.basicData).fields
				}, item.privileges ? item.privileges['D'] : true, false);
			}
		}
	}

	// Standard visualizers method
	async getFieldsToRetrieve() {
		return null;
	}

	// Standard visualizers method
	async reload() {
		if (this.main) {
			return reloadMainList();
		} else {
			alert('TODO: sublist reloading');
			// TODO: sublist reloading
		}
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
		return [];
	}

	async addLocalRow(id = null, data = null, canDelete = true, historyPush = true) {
		let template = (await this.template).cloneNode(true);
		data = JSON.parse(JSON.stringify(data)); // clono per evitare problemi di referenze

		let isNew = false;
		if (id === null) { // Nuova riga
			id = 'new' + this.newRows.length;
			data = await this.basicData;
			isNew = true;
		}

		for (let fieldName of Object.keys(data.fields)) {
			if (data.fields[fieldName].hasOwnProperty('attributes')) {
				for (let attrName of Object.keys(data.fields[fieldName].attributes)) {
					if (typeof data.fields[fieldName].attributes[attrName] === 'string')
						data.fields[fieldName].attributes[attrName] = data.fields[fieldName].attributes[attrName].replace('[id]', id);
				}
			}
		}

		replaceTemplateValues(template, id, data.data);

		let form = new FormManager(this.id + '-' + id);

		pageForms.set(this.id + '-' + id, form);

		if (historyPush)
			historyMgr.sublistAppend(this.id, 'new', id);

		let row;

		switch (this.options['visualizer-options']['type']) {
			case 'outer-template':
				row = template;
				row.className = this.options['visualizer-options']['class'];
				break;
			default:
				row = document.createElement('div');
				row.className = 'rob-field-cont formlist-row';

				let rightPart = document.createElement('div');
				rightPart.className = 'rob-field';

				template.removeAttribute('id');
				template.className = this.options['visualizer-options']['class'];
				rightPart.appendChild(template);

				if (this.options.privileges['D']) {
					let deleteDiv = document.createElement('div');
					deleteDiv.className = 'rob-field text-center';
					deleteDiv.style.width = '30px';

					if (canDelete) {
						let deleteLink = document.createElement('a');
						deleteLink.setAttribute('href', '#');
						deleteLink.addEventListener('click', event => {
							event.preventDefault();
							if (confirm('Sicuro di voler eliminare questa riga?'))
								this.deleteLocalRow(id);
						});

						deleteLink.innerHTML = '<i class="fas fa-trash" aria-label="Delete" style="color: #000"></i>';

						deleteLink = deleteDiv.appendChild(deleteLink);
					}

					row.appendChild(deleteDiv);

					rightPart.style.width = 'calc(100% - 30px)';
				} else {
					rightPart.style.width = '100%';
				}

				row.appendChild(rightPart);
				break;
		}

		row.dataset.id = id;
		this.rowsContainer.appendChild(row);

		await form.build(template, data);

		this.rows.set(id, {id, row, form, isNew, deleted: false});
		if (isNew)
			this.newRows.push(id);

		return changedHtml().then(() => {
			if (isNew) {
				let firstInput = row.querySelector('input, select');
				if (firstInput) {
					firstInput.focus();
					if (firstInput.select)
						firstInput.select();
				}
			}

			return id;
		});
	}

	async deleteLocalRow(id, historyPush = true) {
		let row = this.rows.get(id);
		if (!row) {
			console.error('Riga non trovata al delete');
			return;
		}
		if (row.deleted)
			return;

		row.row.addClass('d-none');
		row.deleted = true;

		if (historyPush)
			historyMgr.sublistAppend(this.id, 'delete', id);
	}

	async restoreLocalRow(id) {
		let row = this.rows.get(id);
		if (!row) {
			console.error('Riga non trovata al delete');
			return;
		}

		row.row.removeClass('d-none');
		row.deleted = false;
	}

	getRows() {
		let arr = []
		for (let id of this.rows.keys()) {
			let row = this.rows.get(id);
			if (!row.deleted)
				arr.push(row);
		}

		return arr;
	}

	getNewRowsSave() {
		let response = [];
		for (let id of this.newRows) {
			let row = this.rows.get(id);
			if (!row || row.deleted)
				continue;
			response.push(row.form.getChangedValues());
		}

		return response;
	}

	getExistingRowsSave() {
		let response = {};
		for (let id of this.rows.keys()) {
			let row = this.rows.get(id);
			if (row.isNew || row.deleted)
				continue;

			let changed = row.form.getChangedValues();
			if (Object.keys(changed).length)
				response[id] = changed;
		}

		return response;
	}

	getDeletedRows() {
		let response = [];
		for (let id of this.rows.keys()) {
			let row = this.rows.get(id);
			if (!row.isNew && row.deleted)
				response.push(id);
		}

		return response;
	}

	getSave() {
		return {
			create: this.getNewRowsSave(),
			update: this.getExistingRowsSave(),
			delete: this.getDeletedRows()
		};
	}

	async save() {
		if (this.saving) {
			alert('Already saving');
			return;
		}
		if (!this.main) // Serve solo quando non sono in una sublist
			return;

		toolbarButtonLoading('save');
		let data = this.getSave();
		this.saving = true;

		return adminApiRequest('page/' + currentAdminPage.split('/')[0] + '/save-many', data).then(() => {
			return this.reload();
		}).catch(error => {
			reportAdminError(error);
		}).finally(() => {
			toolbarButtonRestore('save');
			this.saving = false;
		});
	}
}

visualizerClasses.set('FormList', FormList);