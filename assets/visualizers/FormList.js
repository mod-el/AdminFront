class FormList {
	// Standard visualizers method
	constructor(id, container, main, options) {
		this.id = id;
		this.container = container;
		this.main = main;
		this.options = options;
		this.nextId = 0;

		this.options['visualizer-options'] = {
			"type": 'row',
			"class": 'flex-fields formlist-row',
			"add-button": true,
			"add-button-position": 'after',
			"on-add": null,
			"on-delete": null,
			...(this.options['visualizer-options'] || {})
		};
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
	}

	// Standard visualizers method
	async getFieldsToRetrieve() {
		return null;
	}

	// Standard visualizers method
	async reload() {
		if (this.main) {
			search(1, null, false);
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

	async addLocalRow(id = null) {
		let template = (await this.template).cloneNode(true);
		let data = await this.basicData;

		if (id === null) {
			id = 'new' + this.nextId;
			this.nextId++;
		}

		let form = new FormManager(this.id + '-' + id);
		form.build(template, data);

		let row;

		// let html = template.innerHTML.replace(/\[n\]/g, id); // TODO: forse non serve più?

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
					deleteDiv.innerHTML = '<i class="fas fa-trash" aria-label="Delete" style="color: #000"></i>';
					row.appendChild(deleteDiv);

					rightPart.style.width = '95%';
				} else {
					rightPart.style.width = '100%';
				}

				row.appendChild(rightPart);
				break;
		}

		row.id = 'cont-ch-' + this.id + '-' + id;
		this.rowsContainer.appendChild(row);

		// changedValues['ch-' + name + '-' + id] = 1; // TODO: serve?

		return changedHtml();
	}
}

visualizerClasses.set('FormList', FormList);