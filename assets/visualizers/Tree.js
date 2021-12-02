class Tree {
	pinned = [];

	// Standard visualizers method
	constructor(visualizerId, container, main, options) {
		this.id = visualizerId;
		this.container = container;
		this.main = main;
		this.options = options;

		this.options['visualizer-options'] = {
			field: 'parent',
			separator: ' | ',
			selectedOnTop: false,
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

		if (this.options['visualizer-options'].singleColumn) {
			this.renderPinnedNodes();

			let breadcrumbsNode = this.container.querySelector('.tree-breadcrumbs');
			if (!breadcrumbsNode) {
				breadcrumbsNode = document.createElement('div');
				breadcrumbsNode.className = 'tree-labels tree-breadcrumbs';
				this.container.appendChild(breadcrumbsNode);
			}

			breadcrumbsNode.innerHTML = '';
			if (options.breadcrumbs.length) {
				let rootNode = document.createElement('div');
				rootNode.addEventListener('click', event => {
					this.selectNode(1, null, []);
				});
				rootNode.textContent = 'Root';
				breadcrumbsNode.appendChild(rootNode);

				for (let [idx, step] of options.breadcrumbs.entries()) {
					let stepNode = document.createElement('div');
					stepNode.addEventListener('click', () => {
						this.selectNode(1, step.id, options.breadcrumbs.slice(0, idx + 1));
					});
					stepNode.textContent = step.text;
					breadcrumbsNode.appendChild(stepNode);
				}
			}
		}

		let treeContainer = this.container.querySelector('.tree-container');
		if (!treeContainer) {
			treeContainer = document.createElement('div');
			treeContainer.className = 'tree-container';
			this.container.appendChild(treeContainer);
		}

		let levelContainer = this.getLevelContainer(options.level, options.drop);
		levelContainer.dataset.parent = options.parent || '';
		levelContainer.dataset.breadcrumbs = JSON.stringify(options.breadcrumbs);
		levelContainer.innerHTML = '';

		if (this.options['visualizer-options'].singleColumn) {
			let treeDetailContainer = treeContainer.querySelector('.tree-detail-container');
			if (!treeDetailContainer) {
				treeDetailContainer = document.createElement('div');
				treeDetailContainer.className = 'tree-detail-container';
				treeContainer.appendChild(treeDetailContainer);
			}

			if (options.parent === null && treeDetailContainer.innerHTML !== '') {
				treeDetailContainer.innerHTML = '';
				wipeForms();
			}

			if (options.breadcrumbs.length) {
				let backNode = document.createElement('div');
				backNode.className = 'tree-node';
				backNode.innerHTML = `<i class="fas fa-arrow-left"></i> <span>Indietro</span>`;

				backNode.addEventListener('click', event => {
					let parent = null;
					if (options.breadcrumbs.length > 1)
						parent = options.breadcrumbs[options.breadcrumbs.length - 2].id;

					this.selectNode(1, parent, options.breadcrumbs.slice(0, -1));
				});

				levelContainer.appendChild(backNode);
			}
		}

		if (this.options.toPick && (this.options.allowRootPick || options.parent)) {
			let pickNode = document.createElement('div');
			pickNode.className = 'tree-node';
			pickNode.innerHTML = `<i class="fas fa-check-circle"></i> <span>[scegli]</span>`;
			pickNode.addEventListener('click', event => {
				event.preventDefault();
				event.stopPropagation();

				this.options.toPick.call(pickNode, options.parent);
			});
			levelContainer.appendChild(pickNode);
		}

		for (let item of list) {
			let node = document.createElement('div');
			node.className = 'tree-node';
			node.setAttribute('data-id', item.id);

			if (item.background)
				node.style.background = item.background;

			if (item.color)
				node.style.color = item.color;

			if (this.options.toPick) {
				let pickNode = document.createElement('i');
				pickNode.className = 'fas fa-check-circle';
				pickNode.addEventListener('click', event => {
					event.preventDefault();
					event.stopPropagation();

					this.options.toPick.call(node, item.id);
				});
				node.appendChild(pickNode);
			} else if (item.privileges['R']) {
				let edit_node = document.createElement('i');
				edit_node.className = 'fas fa-edit';
				if (!this.options['visualizer-options'].singleColumn) {
					edit_node.addEventListener('click', event => {
						event.preventDefault();
						event.stopPropagation();

						this.editNode(options.level, item.id);
					});
				}
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
					text: node_text.textContent
				});
				this.selectNode(options.level, item.id, newBreadcrumbs);
			});

			let menu = {};

			if (this.options['visualizer-options'].singleColumn) {
				menu['Pin'] = () => {
					let newBreadcrumbs = [...options.breadcrumbs];
					newBreadcrumbs.push({
						id: item.id,
						text: node_text.textContent
					});

					this.pinned.push({
						id: item.id,
						text: node_text.textContent,
						breadcrumbs: newBreadcrumbs
					});

					this.renderPinnedNodes();
				};
			}

			if (!this.options.toPick) {
				if (item.privileges['R']) {
					menu['Vedi / modifica'] = () => {
						this.editNode(options.level, item.id);
					};
				}

				if (item.privileges['U']) {
					menu['Sposta'] = () => {
						this.moveNode(options.level, item.id);
					};
				}

				if (item.privileges['D']) {
					menu['Elimina'] = () => {
						if (!confirm('Sicuro di voler eliminare?'))
							return;

						this.deleteNode(options.level, item.id);
					};
				}
			}

			if (this.options['visualizer-options'].contextMenu) {
				for (let menuItem of this.options['visualizer-options'].contextMenu) {
					if (!this.options.toPick || menuItem.visible_in_pick) {
						menu[menuItem.label] = () => {
							window[menuItem.function].call(this, options, item);
						};
					}
				}
			}

			if (Object.keys(menu).length)
				node.ctxMenu(menu);

			levelContainer.appendChild(node);
		}

		if (this.options.privileges['C'] && !this.options.toPick) {
			let node = document.createElement('div');
			node.className = 'tree-node';
			node.innerHTML = '<i class="fas fa-plus"></i> <span>Nuovo</span>';

			node.addEventListener('click', event => {
				this.editNode(options.level, 0).then(() => {
					if (options.parent) {
						let formName = this.options['visualizer-options'].singleColumn ? 'main' : 'popup';
						pageForms.get(formName).fields.get(this.options['visualizer-options'].field).setValue(options.parent);
					}
				});
			});

			levelContainer.appendChild(node);
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

		let treeContainer = this.container.querySelector('.tree-container');
		if (!treeContainer)
			return null;

		let mainColumn = null;
		for (let cont of treeContainer.querySelectorAll('[data-tree-column]')) {
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
			treeContainer.appendChild(mainColumn);

			subcolumn = document.createElement('div');
			subcolumn.className = 'tree-subcolumn';
			mainColumn.appendChild(subcolumn);
		} else {
			subcolumn = mainColumn.querySelector('.tree-subcolumn');
		}

		return subcolumn;
	}

	renderPinnedNodes() {
		let pinnedsNode = this.container.querySelector('.tree-pinneds');

		if (this.pinned.length) {
			if (!pinnedsNode) {
				pinnedsNode = document.createElement('div');
				pinnedsNode.className = 'tree-labels tree-pinneds';
				this.container.insertBefore(pinnedsNode, this.container.firstElementChild);
			}

			pinnedsNode.innerHTML = '';
			for (let [idx, pinned] of this.pinned.entries()) {
				let pinnedNode = document.createElement('div');
				pinnedNode.addEventListener('click', () => {
					this.selectNode(1, pinned.id, pinned.breadcrumbs);
				});
				pinnedNode.textContent = pinned.text;

				pinnedNode.ctxMenu({
					"Rimuovi": () => {
						console.log(this.pinned);
						this.pinned.splice(idx, 1);
						console.log(this.pinned);
						this.renderPinnedNodes();
					}
				});

				pinnedsNode.appendChild(pinnedNode);
			}
		} else if (pinnedsNode) {
			pinnedsNode.remove();
		}
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

		let promises = [];
		promises.push(search(null, {
			visualizer: this,
			endpoint: this.options.endpoint,
			empty_main: false,
			visualizer_meta: {
				level: level + 1,
				parent: id,
				breadcrumbs: breadcrumbs
			}
		}));

		if (this.options['visualizer-options'].singleColumn && id)
			promises.push(this.editNode(level, id));

		return Promise.all(promises);
	}

	async editNode(level, id) {
		if (!this.main)
			return;

		wipeForms();

		if (this.options['visualizer-options'].singleColumn) {
			let container = this.container.querySelector('.tree-detail-container');

			_('main-content').scrollTo(0, 0);

			return openElementInContainer(id, container, {
				formName: 'main',
				afterSave: async newId => {
					// Cancello eventuali residui dai form della pagina
					wipeForms();

					// Ricarico il livello al quale questo nodo apparteneva
					await this.reloadLevel(level);

					// Ricarico l'elemento
					await this.editNode(level, newId);

					// Mostro il messaggio di successo
					inPageMessage('Salvataggio correttamente effettuato.', 'success', container);
				}
			});
		} else {
			return openElementInPopup(id, {
				afterSave: async () => {
					// Cancello eventuali residui dai form della pagina
					wipeForms();

					// Ricarico il livello al quale questo nodo apparteneva
					return this.reloadLevel(level);
				}
			});
		}
	}

	async reloadLevel(level) {
		if (this.options['visualizer-options'].singleColumn)
			level = 1;

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
		document.body.style.cursor = 'wait';

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

	async moveNode(level, sourceId) {
		return zkPopup(`<div id="move-node-${this.id}"></div>`).then(() => {
			let cont = _('move-node-' + this.id);

			let options = JSON.parse(JSON.stringify(this.options));
			options.allowRootPick = true;
			options.toPick = async targetId => {
				if (!confirm('Sicuro di voler spostare dentro questa categoria?'))
					return;

				try {
					document.body.style.cursor = 'wait';
					await adminApiRequest('page/' + this.options.endpoint + '/save/' + sourceId, {
						'data': {
							[this.options['visualizer-options'].field]: targetId
						}
					});

					await this.reloadLevel(level);

					zkPopupClose();
				} catch (e) {
					alert(e);
				} finally {
					document.body.style.cursor = 'auto';
				}
			};

			return loadVisualizer('Tree', 'move-node-' + this.id, cont, false, options);
		}).then(visualizer => {
			return search(null, {
				visualizer: visualizer,
				endpoint: this.options.endpoint,
				empty_main: false,
				visualizer_meta: {
					level: 1,
					parent: null,
					breadcrumbs: []
				}
			});
		});
	}
}

visualizerClasses.set('Tree', Tree);
