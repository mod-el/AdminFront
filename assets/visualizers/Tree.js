class Tree {
	// Standard visualizers method
	constructor(visualizerId, container, main, options) {
		this.id = visualizerId;
		this.container = container;
		this.main = main;
		this.options = options;

		this.options['visualizer-options'] = {
			field: 'parent',
			separator: ' | ',
			selectedOnTop: true,
			singleColumn: false,
			...(options['visualizer-options'] || {})
		};

		this.useFilters = false;
		this.hasPagination = false;

		if (this.main) {
			removePageAction('new');
			removePageAction('delete');
		}
	}

	// Standard visualizers method
	async render(list, options = {}) {
		options = {
			...{
				level: 1,
				drop: true,
				breadcrumbs: []
			},
			...options
		};

		this.container.addClass('tree-container');

		let container = this.getLevelContainer(options.level, options.drop);
		container.dataset.parent = options.parent || '';
		container.dataset.breadcrumbs = JSON.stringify(options.breadcrumbs);
		container.innerHTML = '';

		if (this.options['visualizer-options'].singleColumn && options.breadcrumbs.length) {
			let breadcrumbsNode = document.createElement('div');
			breadcrumbsNode.className = 'tree-node selected';
			breadcrumbsNode.innerHTML = options.breadcrumbs.map(item => item.text).join(' -&gt; ');
			container.appendChild(breadcrumbsNode);

			let backNode = document.createElement('div');
			backNode.className = 'tree-node';
			backNode.innerHTML = `<i class="fas fa-arrow-left"></i> <span>Indietro</span>`;

			backNode.addEventListener('click', event => {
				let parent = null;
				if (options.breadcrumbs.length > 1)
					parent = options.breadcrumbs[options.breadcrumbs.length - 2].id;

				this.selectNode(1, parent, options.breadcrumbs.slice(0, -1));
			});

			container.appendChild(backNode);
		}

		for (let item of list) {
			let node = document.createElement('div');
			node.className = 'tree-node';
			node.setAttribute('data-id', item.id);

			if (this.options.toPick) {
				let edit_node = document.createElement('i');
				edit_node.className = 'fas fa-check-circle';
				edit_node.addEventListener('click', event => {
					event.preventDefault();
					event.stopPropagation();

					this.options.toPick.call(node, item.id);
				});
				node.appendChild(edit_node);
			} else if (item.privileges['R']) {
				let edit_node = document.createElement('i');
				edit_node.className = 'fas fa-edit';
				edit_node.addEventListener('click', event => {
					event.preventDefault();
					event.stopPropagation();

					this.editNode(options.level, item.id);
				});
				node.appendChild(edit_node);
			}

			let text = [];
			for (let field of Object.keys(item.data))
				text.push(item.data[field].text);

			let node_text = document.createElement('span');
			node_text.innerHTML = text.join(this.options['visualizer-options'].separator);
			node.appendChild(node_text);

			node.addEventListener('click', event => {
				let newBreadcrumbs = [...options.breadcrumbs];
				newBreadcrumbs.push({
					id: item.id,
					text: node_text.innerHTML
				});
				this.selectNode(options.level, item.id, newBreadcrumbs);
			});

			if ((item.privileges['R'] || item.privileges['D']) && !this.options.toPick) {
				let menu = {};
				if (item.privileges['R']) {
					menu['Vedi / modifica'] = () => {
						this.editNode(options.level, item.id);
					};
				}

				if (item.privileges['R']) {
					menu['Elimina'] = () => {
						if (!confirm('Sicuro di voler eliminare?'))
							return;

						this.deleteNode(options.level, item.id);
					};
				}

				node.ctxMenu(menu);
			}

			container.appendChild(node);
		}

		if (this.options.privileges['C'] && !this.options.toPick) {
			let node = document.createElement('div');
			node.className = 'tree-node';
			node.innerHTML = '<i class="fas fa-plus"></i> <span>Nuovo</span>';

			node.addEventListener('click', event => {
				this.editNode(options.level, 0).then(() => {
					if (options.parent)
						pageForms.get('popup').fields.get(this.options['visualizer-options'].field).setValue(options.parent);
				});
			});

			container.appendChild(node);
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
		options = {...{parent: null}, ...options};

		return [
			{
				'filter': this.options['visualizer-options'].field,
				'type': '=',
				'value': options.parent
			}
		];
	}

	getLevelContainer(level, dropSubsequents = false) {
		level = parseInt(level);
		if (this.options['visualizer-options'].singleColumn)
			level = 1;

		let mainColumn = null;
		for (let cont of this.container.querySelectorAll('[data-tree-column]')) {
			let contLevel = parseInt(cont.getAttribute('data-tree-column'));
			if (dropSubsequents && contLevel > level)
				cont.remove();
			else if (contLevel === level)
				mainColumn = cont;
		}

		let subcolumn;
		if (mainColumn === null) {
			mainColumn = document.createElement('div');
			mainColumn.className = 'tree-column';
			mainColumn.setAttribute('data-tree-column', level);
			this.container.appendChild(mainColumn);

			subcolumn = document.createElement('div');
			subcolumn.className = 'tree-subcolumn';
			mainColumn.appendChild(subcolumn);
		} else {
			subcolumn = mainColumn.querySelector('.tree-subcolumn');
		}

		return subcolumn;
	}

	async selectNode(level, id, breadcrumbs) {
		let columnBefore = this.getLevelContainer(level);
		let nodes = columnBefore.querySelectorAll('.tree-node');
		for (let node of nodes) {
			if (node.getAttribute('data-id') == id) {
				node.addClass('selected');
				if (this.options['visualizer-options'].selectedOnTop)
					node.addClass('on-top');
			} else {
				node.removeClass('selected');
				if (this.options['visualizer-options'].selectedOnTop)
					node.removeClass('on-top');
			}
		}

		this.getLevelContainer(level + 1, true).loading();

		return search(null, {
			visualizer: this,
			endpoint: this.options.endpoint,
			empty_main: false,
			visualizer_meta: {
				level: level + 1,
				parent: id,
				breadcrumbs: breadcrumbs
			}
		});
	}

	async editNode(level, id) {
		if (!this.main)
			return;

		wipeForms();
		return openElementInPopup(id, {
			afterSave: () => {
				// Cancello eventuali residui dai form della pagina
				wipeForms();

				// Ricarico il livello al quale questo nodo apparteneva
				return this.reloadLevel(level);
			}
		});
	}

	async reloadLevel(level) {
		let column = this.getLevelContainer(level, true).loading();

		let parent = null;
		if (column.dataset.parent)
			parent = parseInt(column.dataset.parent);

		let breadcrumbs = [];
		if (column.dataset.breadcrumbs)
			breadcrumbs = JSON.parse(column.dataset.breadcrumbs);

		if (level > 1 && parent === null)
			throw 'Parent can\'t be null for levels other than the first one';

		return search(null, {
			visualizer: this,
			endpoint: this.options.endpoint,
			empty_main: false,
			visualizer_meta: {level, parent, breadcrumbs}
		});
	}

	async deleteNode(level, id) {
		document.body.style.cursor = 'pointer';

		let request = currentAdminPage.split('/');
		return adminApiRequest('page/' + request[0] + '/delete', {ids: [id]}).then(() => {
			wipeForms();

			return this.reloadLevel(level);
		}).catch(error => {
			reportAdminError(error);
		}).finally(() => {
			document.body.style.cursor = 'auto';
		});
	}
}

visualizerClasses.set('Tree', Tree);