class Tree {
	// Standard visualizers method
	constructor(visualizerId, container, main, options) {
		this.id = visualizerId;
		this.container = container;
		this.main = main;
		this.options = {
			...{
				field: 'parent',
				separator: ' | '
			},
			...options
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
				drop: true
			},
			...options
		};

		let container = this.getLevelContainer(options.level, options.drop);
		container.innerHTML = '';

		for (let item of list) {
			let node = document.createElement('div');
			node.className = 'tree-node';
			node.setAttribute('data-id', item.id);

			let edit_link = document.createElement('a');
			edit_link.innerHTML = '<i class="fas fa-edit"></i>';
			edit_link.setAttribute('href', '#');
			edit_link.addEventListener('click', event => {
				event.preventDefault();
				event.stopPropagation();
			});
			node.appendChild(edit_link);

			let text = [];
			for (let field of Object.keys(item.data))
				text.push(item.data[field].text);

			let node_text = document.createElement('span');
			node_text.innerHTML = text.join(this.options.separator);
			node.appendChild(node_text);

			node.addEventListener('click', event => {
				this.selectNode(options.level, item.id);
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
				'filter': this.options.field,
				'type': '=',
				'value': options.parent
			}
		];
	}

	getLevelContainer(level, dropSubsequents = false) {
		level = parseInt(level);

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

	async selectNode(level, id) {
		let columnBefore = this.getLevelContainer(level);
		let nodes = columnBefore.querySelectorAll('.tree-node');
		for (let node of nodes) {
			if (node.getAttribute('data-id') == id)
				node.addClass('selected');
			else
				node.removeClass('selected');
		}

		this.getLevelContainer(level + 1, true).loading();

		return search(1, {
			empty_main: false,
			visualizer_meta: {
				level: level + 1,
				parent: id
			}
		});
	}
}

visualizerClasses.set('Tree', Tree);