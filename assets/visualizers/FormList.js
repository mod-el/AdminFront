class FormList {
	// Standard visualizers method
	constructor(id, container, main, options) {
		this.id = id;
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
			...(this.options['visualizer-options'] || {})
		};

		this.rows = new Map();
		this.newRows = [];

		if (this.main) {
			addPageAction('new', {
				'fa-icon': 'far fa-plus-square',
				'text': 'Nuovo',
				'action': 'visualizers.get(currentAdminPage.split(\'/\')[0]).addLocalRow()',
			});
			removePageAction('delete');
		}
	}

	// Standard visualizers method
	async render(list, totals) {
		this.container.innerHTML = '';

		let addButtonRow = null;
		if (this.options.privileges['C'] && this.options['visualizer-options']['add-button']) {
			addButtonRow = document.createElement('div');
			addButtonRow.className = 'rob-field-cont formlist-row';
			addButtonRow.style.cursor = 'pointer';
			addButtonRow.innerHTML = `<div class="rob-field" style="width: 5%"></div><div class="rob-field" style="width: 95%">` + (this.options['visualizer-options']['add-button'] === true ? '<i class="fas fa-plus" aria-hidden="true"></i> Aggiungi' : this.options['visualizer-options']['add-button']) + `</div>`;
			addButtonRow.addEventListener('click', () => {
				this.addLocalRow();
			})
		}

		if (addButtonRow && this.options['visualizer-options']['add-button-position'] === 'before')
			this.container.appendChild(addButtonRow);

		this.rowsContainer = document.createElement('div');
		this.rowsContainer.id = 'cont-ch-' + this.id;
		this.container.appendChild(this.rowsContainer);

		if (addButtonRow && this.options['visualizer-options']['add-button-position'] === 'after')
			this.container.appendChild(addButtonRow);

		this.template = new Promise(async (resolve, reject) => {
			let templateDiv = document.createElement('div');
			templateDiv.id = 'formlist-template-' + this.id;
			templateDiv.className = 'formlist-template';

			let templateUrl = adminPrefix + 'template/';
			let get = {hideLayout: ''};
			if (this.main)
				templateUrl += this.id;
			else
				templateUrl += currentAdminPage.split('/') + '/' + this.id;

			templateDiv.innerHTML = await ajax(templateUrl, get);

			resolve(templateDiv);
		});

		if (this.main)
			this.basicData = adminApiRequest('page/' + this.id + '/data/0');
		else
			this.basicData = {data: {}, fields: {}}; // TODO: sublist

		// Forza il caricamento in background
		this.template.then();
		this.basicData.then();

		if (list.length > 0) {
			for (let item of list) {
				let data = {};
				for (let k of Object.keys(item.data))
					data[k] = item.data[k].value;

				this.addLocalRow(item.id, {
					data,
					fields: (await this.basicData).fields
				});
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
			reloadMainList();
		} else {
			// TODO: sublist reloading
		}
	}

	// Standard visualizers method
	getSorting() {
		return [];
	}

	// Standard visualizers method
	setSorting(sorting) {
	}

	async addLocalRow(id = null, data = null) {
		let template = (await this.template).cloneNode(true);

		let isNew = false;
		if (id === null) { // Nuova riga
			id = 'new' + this.newRows.length;
			data = await this.basicData;
			isNew = true;
		}

		let form = new FormManager(this.id + '-' + id);
		form.build(template, data);

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
					deleteDiv.style.width = '5%';

					let deleteLink = document.createElement('a');
					deleteLink.setAttribute('href', '#');
					deleteLink.addEventListener('click', event => {
						event.preventDefault();
						if (confirm('Sicuro di voler eliminare questa riga?'))
							this.deleteLocalRow(id);
					});

					deleteLink.innerHTML = '<i class="fas fa-trash" aria-label="Delete" style="color: #000"></i>';

					deleteLink = deleteDiv.appendChild(deleteLink);

					row.appendChild(deleteDiv);

					rightPart.style.width = '95%';
				} else {
					rightPart.style.width = '100%';
				}

				row.appendChild(rightPart);
				break;
		}

		this.rowsContainer.appendChild(row);

		this.rows.set(id, {row, form, isNew, deleted: false});
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
		});
	}

	async deleteLocalRow(id) {
		let row = this.rows.get(id);
		if (!row) {
			console.error('Riga non trovata al delete');
			return;
		}
		if (row.deleted)
			return;

		row.row.addClass('d-none');
		row.deleted = true;
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
}

visualizerClasses.set('FormList', FormList);