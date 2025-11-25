class Files {
	// Standard visualizers method
	constructor(visualizerId, container, main, options) {
		this.id = visualizerId;
		this.container = container;
		this.main = main;
		this.options = options;

		this.options['visualizer-options'] = {
			field: 'file', // Default field name containing the file
			name: 'name', // Optional field that determines the name to show
			ext: null, // Optional field that determines the file extension
			icon: null, // Optional field that determines the icon to show
			extra_fields: [], // Optional array of field names to show as additional info below the file name
			iconMapping: {
				// Default icon mapping based on file types
				'pdf': 'fas fa-file-pdf',
				'doc': 'fas fa-file-word',
				'docx': 'fas fa-file-word',
				'xls': 'fas fa-file-excel',
				'xlsx': 'fas fa-file-excel',
				'txt': 'fas fa-file-alt',
				'csv': 'fas fa-file-csv',
				'jpg': 'fas fa-file-image',
				'jpeg': 'fas fa-file-image',
				'png': 'fas fa-file-image',
				'gif': 'fas fa-file-image',
				'zip': 'fas fa-file-archive',
				'rar': 'fas fa-file-archive',
			},
			defaultIcon: 'fas fa-file',
			"add-button": true,
			onshow: null,
			onadd: null,
			ondelete: null,
			onrestore: null,
			onchange: null,
			...(options['visualizer-options'] || {})
		};

		this.useFilters = true;
		this.forceTableOnSearch = false;
		this.hasPagination = this.main; // No pagination for sublists

		this.selectedRows = [];

		// Store files for multi-upload (main visualizer only)
		this.filesToUpload = [];

		// Sublist-specific properties (like FormList)
		this.rows = new Map();
		this.newRows = [];
		this.saving = false;

		if (this.main) {
			addPageAction('new', {
				'fa-icon': 'far fa-plus-square',
				text: 'Nuovo',
				action: 'getMainVisualizer().handleMultiUpload()',
			});
		}
	}

	// Standard visualizers method
	async render(list, options = {}) {
		options = {...options};

		// Clear the container
		this.container.innerHTML = '';

		// Create files container
		const filesContainer = document.createElement('div');
		filesContainer.className = 'files-container';
		this.container.appendChild(filesContainer);
		this.filesContainer = filesContainer;

		// Add drag and drop functionality
		this.setupDragAndDrop(filesContainer);

		// For sublists, load template and basic data like FormList
		if (!this.main) {
			this.template = this.loadTemplate();
			this.basicData = this.loadBasicData();

			// Force background loading
			this.template.then();
			this.basicData.then();
		}

		if (list.length === 0 && this.main) {
			this.renderEmptyState(filesContainer);
			return;
		}

		const draggable = this.options['custom-order'];
		if (draggable) {
			filesContainer.setAttribute('data-draggable-cont', '');
			filesContainer.setAttribute('data-draggable-callback', 'adminRowDragged(element.id, element.idx, target.idx)');
		}

		// Render each file in the list
		if (this.main) {
			for (const item of list)
				this.renderFileBox(filesContainer, item, draggable);
		} else {
			// For sublists, use local row management like FormList
			for (const item of list) {
				const data = {};
				for (let k of Object.keys(item.data))
					data[k] = (item.data[k] && typeof item.data[k] === 'object' && item.data[k].hasOwnProperty('value')) ? item.data[k].value : item.data[k];

				await this.addLocalRow(item.id, {
					data,
					fields: (await this.basicData).fields
				}, item.privileges ? item.privileges['D'] : true, false);
			}

			// Show empty state if no files after loading
			if (this.getRows().length === 0)
				this.renderEmptyState(filesContainer);

			// Add "Add files" button for sublists
			if (this.options.privileges['C'] && this.options['visualizer-options']['add-button']) {
				const addButton = document.createElement('div');
				addButton.className = 'files-add-button';
				addButton.innerHTML = '<i class="fas fa-plus"></i> Aggiungi file';
				addButton.addEventListener('click', () => this.handleAddFiles());
				this.container.insertBefore(addButton, filesContainer);
			}
		}
	}

	renderEmptyState(container) {
		const emptyMessage = document.createElement('div');
		emptyMessage.className = 'files-empty';
		emptyMessage.innerHTML = '<i class="fas fa-folder-open"></i><p>No files found</p><p class="drag-info">Drag and drop files here to upload</p>';
		container.appendChild(emptyMessage);
	}

	async loadTemplate() {
		let templateDiv = document.createElement('div');
		templateDiv.id = 'files-template-' + this.id;
		templateDiv.className = 'files-template';

		let templateUrl = adminPrefix + 'template/';
		let get = {ajax: ''};
		templateUrl += this.options.page.split('/')[0] + '/' + this.id.replace(/\/(new)?[0-9]+\//g, '/');

		templateDiv.innerHTML = await loadPage(templateUrl, get, {}, {fill_main: false});

		return templateDiv;
	}

	loadBasicData() {
		return new Promise(resolve => {
			let defaultData = {};
			for (let k of Object.keys(this.options.fields))
				defaultData[k] = this.options.fields[k].hasOwnProperty('default') ? this.options.fields[k].default : null;

			resolve({
				fields: this.options.fields,
				data: defaultData,
				sublists: []
			});
		});
	}

	// Add a local row (for sublist mode)
	async addLocalRow(id = null, providedData = null, canDelete = true, historyPush = true) {
		providedData = JSON.parse(JSON.stringify(providedData)); // Clone to avoid reference issues

		const fileField = this.options['visualizer-options'].field;
		let isNew = false, data = providedData;
		let pendingFileData = null;

		if (id === null) {
			id = 'new' + this.newRows.length;
			data = JSON.parse(JSON.stringify(await this.basicData));
			isNew = true;
			if (providedData !== null)
				data.data = {...data.data, ...providedData.data};
		}

		// Extract file data before form.build (it can't handle parsed file arrays)
		if (data.data[fileField] && Array.isArray(data.data[fileField])) {
			pendingFileData = data.data[fileField];
			data.data[fileField] = null; // Clear for form.build
		}

		// Prepare field attributes
		for (let fieldName of Object.keys(data.fields)) {
			if (data.fields[fieldName].hasOwnProperty('attributes')) {
				for (let attrName of Object.keys(data.fields[fieldName].attributes)) {
					if (typeof data.fields[fieldName].attributes[attrName] === 'string')
						data.fields[fieldName].attributes[attrName] = data.fields[fieldName].attributes[attrName].replace('[id]', id);
				}
			}
		}

		let form = new FormManager(this.id + '-' + id, {updateAdminHistory: true});
		pageForms.set(this.id + '-' + id, form);

		if (historyPush && typeof historyMgr !== 'undefined')
			historyMgr.sublistAppend(this.id, 'new', id);

		let rowObj = {
			id,
			data: data.data,
			fields: data.fields,
			form,
			isNew,
			deleted: false,
			canDelete,
			fileElement: null,
		};

		this.rows.set(id, rowObj);
		if (isNew)
			this.newRows.push(id);

		// Build the form (without rendering to DOM - we'll use it for the popup edit)
		let template = (await this.template).cloneNode(true);
		await replaceTemplateValues(template, id, data.data, data.fields);
		await form.build(template, data);

		// Restore file data after form.build and mark as changed
		if (pendingFileData) {
			rowObj.data[fileField] = pendingFileData;
			form.changedValues[fileField] = pendingFileData;
		}

		// Render the file box
		this.renderSublistFileBox(rowObj);

		// Remove empty state if present
		const emptyState = this.filesContainer.querySelector('.files-empty');
		if (emptyState)
			emptyState.remove();

		await this.callHook('show', id);
		if (isNew) {
			await this.callHook('add', id);
			await this.callHook('change', id);
		}

		return rowObj;
	}

	// Render a file box for sublist mode
	renderSublistFileBox(rowObj) {
		const fileField = this.options['visualizer-options'].field;
		const nameField = this.options['visualizer-options'].name;
		const iconField = this.options['visualizer-options'].icon;

		const fileBox = document.createElement('div');
		fileBox.className = 'file-box';
		fileBox.dataset.rowId = rowObj.id;

		rowObj.fileElement = fileBox;

		this.updateFileBoxContent(rowObj);

		// Click handler
		fileBox.addEventListener('click', (e) => {
			// Don't trigger if clicking on action buttons
			if (e.target.closest('.file-actions'))
				return;

			const fileValue = rowObj.data[fileField];
			if (fileValue && typeof fileValue === 'string' && !rowObj.isNew) {
				// Existing file - open it
				window.open(PATH + fileValue);
			} else if (rowObj.isNew || !fileValue) {
				// New row or no file - trigger file input
				this.triggerFileInput(rowObj);
			}
		});

		// Add action buttons
		const actions = document.createElement('div');
		actions.className = 'file-actions';

		// Edit button (for extra fields)
		const hasExtraFields = this.hasEditableExtraFields(rowObj);
		if (hasExtraFields) {
			const editBtn = document.createElement('button');
			editBtn.type = 'button';
			editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
			editBtn.setAttribute('title', 'Modifica');
			editBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.editLocalRow(rowObj.id);
			});
			actions.appendChild(editBtn);
		}

		// Delete button
		if (this.options.privileges['D'] && rowObj.canDelete) {
			const deleteBtn = document.createElement('button');
			deleteBtn.type = 'button';
			deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
			deleteBtn.setAttribute('title', 'Elimina');
			deleteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				if (confirm('Sicuro di voler eliminare questo file?'))
					this.deleteLocalRow(rowObj.id);
			});
			actions.appendChild(deleteBtn);
		}

		fileBox.appendChild(actions);
		this.filesContainer.appendChild(fileBox);
	}

	// Check if there are extra fields to edit (other than the file field)
	hasEditableExtraFields(rowObj) {
		const fileField = this.options['visualizer-options'].field;
		for (let fieldName of Object.keys(rowObj.fields)) {
			if (fieldName !== fileField && fieldName !== 'id')
				return true;
		}
		return false;
	}

	// Update file box content based on current data
	updateFileBoxContent(rowObj) {
		const fileBox = rowObj.fileElement;
		if (!fileBox) return;

		const fileField = this.options['visualizer-options'].field;
		const nameField = this.options['visualizer-options'].name;
		const iconField = this.options['visualizer-options'].icon;

		// Clear existing content (except actions)
		const actions = fileBox.querySelector('.file-actions');
		fileBox.innerHTML = '';
		fileBox.style.backgroundImage = '';

		const fileValue = rowObj.data[fileField];
		let fileName = '';
		let fileUrl = null;
		let isImage = false;
		let fileExtension = 'default';

		if (fileValue) {
			if (typeof fileValue === 'string') {
				// Existing file path
				fileUrl = fileValue;
				fileName = nameField && rowObj.data[nameField] ? rowObj.data[nameField] : fileValue.split('/').pop();
			} else if (Array.isArray(fileValue) && fileValue.length > 0) {
				// File object from form (new upload)
				const fileData = fileValue[0];
				fileName = fileData.name || 'File';

				// Check if it's an image
				if (fileData.type && fileData.type.startsWith('image/')) {
					isImage = true;
					// Create data URL for preview
					fileUrl = 'data:' + fileData.type + ';base64,' + fileData.file;
				}

				// Get extension from filename
				if (fileData.name && fileData.name.includes('.'))
					fileExtension = fileData.name.split('.').pop().toLowerCase();
			}
		} else {
			fileName = nameField && rowObj.data[nameField] ? rowObj.data[nameField] : 'Nuovo file';
		}

		// Get extension for icon
		if (fileUrl && typeof fileUrl === 'string' && fileUrl.includes('.') && !fileUrl.startsWith('data:'))
			fileExtension = fileUrl.split('.').pop().toLowerCase();

		// Check if existing file is an image
		const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
		if (!isImage && imageExtensions.includes(fileExtension))
			isImage = true;

		// Determine icon class
		let iconClass = this.options['visualizer-options'].defaultIcon;
		if (iconField && rowObj.data[iconField])
			iconClass = rowObj.data[iconField];
		else if (this.options['visualizer-options'].iconMapping[fileExtension])
			iconClass = this.options['visualizer-options'].iconMapping[fileExtension];

		// Set title
		fileBox.setAttribute('title', fileName);

		if (isImage && fileUrl) {
			// Display image thumbnail
			if (fileUrl.startsWith('data:')) {
				fileBox.style.backgroundImage = 'url(\'' + fileUrl + '\')';
			} else {
				fileBox.style.backgroundImage = 'url(\'' + PATH + fileUrl + '\')';
			}
		} else if (!fileValue) {
			// No file - show upload icon
			const icon = document.createElement('div');
			icon.className = 'file-icon file-icon-upload';
			icon.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>';
			fileBox.appendChild(icon);
		} else {
			// Non-image file - show icon
			const icon = document.createElement('div');
			icon.className = 'file-icon';
			icon.innerHTML = `<i class="${iconClass}"></i>`;
			fileBox.appendChild(icon);
		}

		// File name
		const name = document.createElement('div');
		name.className = 'file-name';
		name.textContent = fileName;
		fileBox.appendChild(name);

		// Extra fields info
		const extraFields = this.options['visualizer-options'].extra_fields;
		if (extraFields && extraFields.length > 0) {
			const extraInfo = document.createElement('div');
			extraInfo.className = 'file-extra-info';

			for (const fieldName of extraFields) {
				if (rowObj.data[fieldName]) {
					let fieldValue = (rowObj.form?.fields.get(fieldName) && rowObj.form?.fields.get(fieldName) instanceof FieldSelect) ? rowObj.form?.fields.get(fieldName).options['options'].find(o => o.id.toString() === rowObj.data[fieldName].toString())?.text : rowObj.data[fieldName];
					if (typeof fieldValue === 'object')
						fieldValue = fieldValue.text || fieldValue.id || JSON.stringify(fieldValue);

					const fieldElement = document.createElement('div');
					fieldElement.className = 'file-extra-field';
					fieldElement.textContent = fieldValue;
					extraInfo.appendChild(fieldElement);
				}
			}

			if (extraInfo.children.length > 0)
				fileBox.appendChild(extraInfo);
		}

		// Re-append actions
		if (actions)
			fileBox.appendChild(actions);
	}

	// Trigger file input for selecting a file
	triggerFileInput(rowObj) {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.style.display = 'none';
		document.body.appendChild(fileInput);

		fileInput.addEventListener('change', async () => {
			if (fileInput.files && fileInput.files.length > 0) {
				const file = fileInput.files[0];
				const parsedFile = await this.parseFile(file);

				const fileField = this.options['visualizer-options'].field;
				rowObj.data[fileField] = [parsedFile];

				// Mark field as changed in the form (don't call setValue - it expects a File object)
				rowObj.form.changedValues[fileField] = [parsedFile];

				// Update display
				this.updateFileBoxContent(rowObj);

				await this.callHook('change', rowObj.id);
			}
			document.body.removeChild(fileInput);
		});

		fileInput.click();
	}

	// Parse file to base64
	parseFile(file) {
		return new Promise(resolve => {
			const reader = new FileReader();
			reader.onload = function (e) {
				const mime = e.target.result.match(/^data:(.*);/)[1];
				resolve({
					name: file.name,
					file: e.target.result.substring(('data:' + mime + ';base64,').length),
					type: mime,
				});
			};
			reader.readAsDataURL(file);
		});
	}

	// Edit a local row (open popup with extra fields)
	async editLocalRow(id) {
		const rowObj = this.rows.get(id);
		if (!rowObj) return;

		const fileField = this.options['visualizer-options'].field;

		return zkPopup('', {
			onClose: () => {}
		}).then(async () => {
			const popupReal = _('popup-real');
			popupReal.innerHTML = '';

			const form = document.createElement('form');
			form.id = 'form-files-edit-' + id;
			form.addEventListener('submit', e => e.preventDefault());

			const template = (await this.template).cloneNode(true);

			// Remove the file field placeholder from the popup (we don't want to edit file here)
			const fileFieldPlaceholder = template.querySelector('[data-fieldplaceholder="' + fileField + '"]');
			if (fileFieldPlaceholder)
				fileFieldPlaceholder.remove();

			form.appendChild(template);

			// Add save button
			const saveButtonCont = document.createElement('div');
			saveButtonCont.className = 'text-center pt-2';
			saveButtonCont.innerHTML = '<input type="submit" value="Salva" class="btn btn-primary"/>';
			form.appendChild(saveButtonCont);

			popupReal.appendChild(form);

			await replaceTemplateValues(template, id, rowObj.data, rowObj.fields);

			const editForm = new FormManager('files-edit-' + id);
			pageForms.set('files-edit-' + id, editForm);
			await editForm.build(template, {fields: rowObj.fields, data: rowObj.data});

			form.addEventListener('submit', async (e) => {
				e.preventDefault();

				const newValues = await editForm.getValues();

				// Update the row data
				for (let k of Object.keys(newValues)) {
					if (k !== fileField) {
						rowObj.data[k] = newValues[k];
						if (rowObj.form.fields.get(k))
							await rowObj.form.fields.get(k).setValue(newValues[k], false);
					}
				}

				// Mark as changed
				for (let k of Object.keys(editForm.getChangedValues())) {
					rowObj.form.changedValues[k] = newValues[k];
				}

				this.updateFileBoxContent(rowObj);
				await this.callHook('change', id);

				zkPopupClose();
				pageForms.delete('files-edit-' + id);
			});

			await fillPopup();
		});
	}

	// Delete a local row
	async deleteLocalRow(id, historyPush = true) {
		const rowObj = this.rows.get(id);
		if (!rowObj || rowObj.deleted) return;

		if (pageForms.get(this.id + '-' + id))
			pageForms.get(this.id + '-' + id).ignore = true;

		if (rowObj.fileElement)
			rowObj.fileElement.classList.add('d-none');

		rowObj.deleted = true;

		if (historyPush && typeof historyMgr !== 'undefined')
			historyMgr.sublistAppend(this.id, 'delete', id);

		// Show empty state if no more visible rows
		if (this.getRows().length === 0)
			this.renderEmptyState(this.filesContainer);

		await this.callHook('delete', id);
		await this.callHook('change', id);
	}

	// Restore a deleted local row
	async restoreLocalRow(id) {
		const rowObj = this.rows.get(id);
		if (!rowObj) return;

		if (pageForms.get(this.id + '-' + id))
			pageForms.get(this.id + '-' + id).ignore = false;

		if (rowObj.fileElement)
			rowObj.fileElement.classList.remove('d-none');

		rowObj.deleted = false;

		// Remove empty state if present
		const emptyState = this.filesContainer.querySelector('.files-empty');
		if (emptyState)
			emptyState.remove();

		await this.callHook('show', id);
		await this.callHook('restore', id);
		await this.callHook('change', id);
	}

	// Call hook functions
	async callHook(hook, id) {
		const hookName = 'on' + hook;
		if (this.options['visualizer-options'][hookName]) {
			switch (typeof this.options['visualizer-options'][hookName]) {
				case 'function':
					await this.options['visualizer-options'][hookName].call(this, id);
					break;
				case 'string':
					await eval(this.options['visualizer-options'][hookName]);
					break;
			}
		}
	}

	// Get visible rows
	getRows() {
		let arr = [];
		for (let id of this.rows.keys()) {
			let row = this.rows.get(id);
			if (!row.deleted)
				arr.push(row);
		}
		return arr;
	}

	// Get deleted rows (for saving)
	getDeletedRows() {
		let deleted = [];
		for (let [id, row] of this.rows.entries()) {
			if (row.deleted && !row.isNew)
				deleted.push(id);
		}
		return deleted;
	}

	// Get save data (like FormList)
	getSave() {
		if (this.options.custom)
			return null;

		let list = [], atLeastOneChange = false;
		for (let [id, row] of this.rows.entries()) {
			if (row.deleted) {
				if (!row.isNew)
					atLeastOneChange = true;
				continue;
			}

			let changed = row.form.getChangedValues();
			if (Object.keys(changed).length || row.isNew)
				atLeastOneChange = true;

			if (!row.isNew)
				changed.id = id;

			list.push(changed);
		}

		return atLeastOneChange ? list : null;
	}

	// Handle adding files (sublist mode)
	handleAddFiles() {
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.multiple = true;
		fileInput.style.display = 'none';
		document.body.appendChild(fileInput);

		fileInput.addEventListener('change', async () => {
			if (fileInput.files && fileInput.files.length > 0) {
				for (const file of fileInput.files) {
					const parsedFile = await this.parseFile(file);
					const fileField = this.options['visualizer-options'].field;

					await this.addLocalRow(null, {
						data: {[fileField]: [parsedFile]}
					}, true, true);
				}
			}
			document.body.removeChild(fileInput);
		});

		fileInput.click();
	}

	// Render file box for main visualizer (original behavior)
	renderFileBox(container, item, draggable) {
		const fileField = this.options['visualizer-options'].field;
		const nameField = this.options['visualizer-options'].name;
		const iconField = this.options['visualizer-options'].icon;

		const fileName = String((nameField && item.data[nameField]?.value) || '');

		const fileUrl = item.data[fileField]?.value;

		// Get file extension for icon
		let fileExtension = 'default';
		if (fileUrl && fileUrl.includes('.'))
			fileExtension = fileUrl.split('.').pop().toLowerCase();

		// Determine if this is an image file
		const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
		const isImage = imageExtensions.includes(fileExtension);

		// Determine icon class (for non-image files)
		let iconClass = this.options['visualizer-options'].defaultIcon;
		if (iconField && item.data[iconField]?.value)
			iconClass = item.data[iconField].value.toLowerCase();
		else if (this.options['visualizer-options'].iconMapping[fileExtension])
			iconClass = this.options['visualizer-options'].iconMapping[fileExtension];

		// Create file box element
		const fileBox = document.createElement('div');
		fileBox.className = 'file-box';
		fileBox.setAttribute('title', fileName);

		if (draggable) {
			if (item.id) {
				fileBox.setAttribute('data-draggable-id', item.id);
				fileBox.setAttribute('data-draggable-index', item['order-idx']);
			} else {
				fileBox.setAttribute('data-draggable-set', '1');
			}
		}

		// Add the selected class if this file is selected
		if (this.selectedRows.includes(item.id))
			fileBox.classList.add('selected');

		if (isImage && fileUrl) {
			// Display actual image thumbnail
			fileBox.style.backgroundImage = 'url(\'' + PATH + fileUrl + '\')';
		} else {
			// Create file icon or thumbnail
			const icon = document.createElement('div');
			icon.className = 'file-icon';

			// Display icon for non-image files
			icon.innerHTML = `<i class="${iconClass}"></i>`;

			fileBox.appendChild(icon);
		}

		// Create file name
		const name = document.createElement('div');
		name.className = 'file-name';
		name.textContent = fileName;
		fileBox.appendChild(name);

		// Add extra fields if configured
		const extraFields = this.options['visualizer-options'].extra_fields;
		if (extraFields && extraFields.length > 0) {
			const extraInfo = document.createElement('div');
			extraInfo.className = 'file-extra-info';

			for (const fieldName of extraFields) {
				if (item.data[fieldName]?.value) {
					let fieldValue = item.data[fieldName].text || item.data[fieldName].value;
					if (typeof fieldValue === 'object')
						fieldValue = fieldValue.text || fieldValue.id || JSON.stringify(fieldValue);

					const fieldElement = document.createElement('div');
					fieldElement.className = 'file-extra-field';
					fieldElement.textContent = fieldValue;
					extraInfo.appendChild(fieldElement);
				}
			}

			if (extraInfo.children.length > 0)
				fileBox.appendChild(extraInfo);
		}

		// Add click handler for selection or opening
		fileBox.addEventListener('click', () => {
			// If there are already selected files, clicking will select/deselect this file
			if (this.selectedRows.length > 0) {
				this.selectFile(item.id, fileBox);
			} else {
				// If no files are selected, open the file (original behavior)
				window.open(PATH + item.data[fileField]?.value);
			}
		});

		// Add action buttons if privileges allow
		const actions = document.createElement('div');
		actions.className = 'file-actions';

		const selectBtn = document.createElement('button');
		selectBtn.type = 'button';
		selectBtn.innerHTML = '<i class="fas fa-check-square"></i>';
		selectBtn.setAttribute('title', 'Seleziona');
		selectBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.selectFile(item.id, fileBox);
		});
		actions.appendChild(selectBtn);

		if (item.privileges && (item.privileges['R'] || item.privileges['U'])) {
			const editBtn = document.createElement('button');
			editBtn.type = 'button';
			editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
			editBtn.setAttribute('title', 'Modifica');
			editBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.editFile(item.id);
			});
			actions.appendChild(editBtn);
		}

		if (item.privileges && item.privileges['D']) {
			const deleteBtn = document.createElement('button');
			deleteBtn.type = 'button';
			deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
			deleteBtn.setAttribute('title', 'Elimina');
			deleteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.deleteFile(item.id);
			});
			actions.appendChild(deleteBtn);
		}

		fileBox.appendChild(actions);

		container.appendChild(fileBox);
	}

	selectFile(id, fileBoxElement) {
		const index = this.selectedRows.indexOf(id);

		if (index === -1) {
			// Select file
			this.selectedRows.push(id);
			fileBoxElement.classList.add('selected');
		} else {
			// Deselect file
			this.selectedRows.splice(index, 1);
			fileBoxElement.classList.remove('selected');
		}
	}

	async editFile(id) {
		return openElementInPopup(id);
	}

	async deleteFile(id) {
		deleteRows([id]);
	}

	// Standard visualizers methods
	async getFieldsToRetrieve() {
		if (!this.main)
			return null; // Sublists retrieve all fields

		const fields = [this.options['visualizer-options'].field, this.options['visualizer-options'].name, 'id'];
		if (this.options['visualizer-options'].icon)
			fields.push(this.options['visualizer-options'].icon);

		// Add extra fields to the request
		const extraFields = this.options['visualizer-options'].extra_fields;
		if (extraFields && extraFields.length > 0)
			fields.push(...extraFields);

		return fields;
	}

	async reload() {
		if (this.main) {
			return reloadMainList();
		} else {
			// For sublists, we don't reload from server
			console.log('Sublist reload not implemented - data is managed locally');
		}
	}

	getSorting(options = {}) {
		return {};
	}

	setSorting(sorting) {
		// Files visualizer doesn't use sorting
	}

	async getSpecialFilters(options = {}) {
		return [];
	}

	// Setup drag and drop handlers
	setupDragAndDrop(container) {
		container.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.stopPropagation();
			container.classList.add('drag-over');
		});

		container.addEventListener('dragleave', (e) => {
			e.preventDefault();
			e.stopPropagation();
			container.classList.remove('drag-over');
		});

		container.addEventListener('drop', (e) => {
			e.preventDefault();
			e.stopPropagation();
			container.classList.remove('drag-over');

			if (e.dataTransfer.files && e.dataTransfer.files.length > 0)
				this.handleDroppedFiles(e.dataTransfer.files);
		});
	}

	// Handle dropped files
	async handleDroppedFiles(files) {
		if (files.length === 0) return;

		if (this.main) {
			// Main visualizer - use existing upload logic
			this.filesToUpload = Array.from(files);
			this.openUploadForm();
		} else {
			// Sublist - add as local rows
			for (const file of files) {
				const parsedFile = await this.parseFile(file);
				const fileField = this.options['visualizer-options'].field;

				await this.addLocalRow(null, {
					data: {[fileField]: [parsedFile]}
				}, true, true);
			}
		}
	}

	// Handle multi upload action (triggered from toolbar) - main visualizer only
	handleMultiUpload() {
		// Reset files array
		this.filesToUpload = [];

		// Create file input and trigger it
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.multiple = true;
		fileInput.style.display = 'none';
		document.body.appendChild(fileInput);

		fileInput.addEventListener('change', () => {
			if (fileInput.files && fileInput.files.length > 0) {
				this.handleDroppedFiles(fileInput.files);
			}
			document.body.removeChild(fileInput);
		});

		fileInput.click();
	}

	// Open form for upload metadata - main visualizer only
	openUploadForm() {
		if (this.filesToUpload.length === 0) return;

		// Open the form in popup
		openElementInPopup(0, {
			afterLoad: async () => {
				let fields = Array.from(_('form-popup').querySelectorAll('[data-fieldplaceholder]'));
				if (fields.length === 1 && fields[0].dataset.fieldplaceholder === this.options['visualizer-options'].field)
					fields[0].remove();

				fields = Array.from(_('form-popup').querySelectorAll('[data-fieldplaceholder]'));
				if (fields.length === 0) {
					_('form-popup').addClass('d-none');
					await this.processUploadForm(false);
				}
			},
			save: async () => {
				await this.processUploadForm();
			},
			close_after_save: false,
		});
	}

	async processUploadForm(get_form_data = true) {
		const formData = get_form_data ? (await pageForms.get('popup').getValues()) : {};
		_('#form-popup .btn-primary').value = 'Attendere...';

		// Process all files with the same form data
		await this.processMultipleFiles(formData);

		// Clear file list after upload
		this.filesToUpload = [];

		// Reload the list
		await this.reload();

		if (!document.querySelector('.upload-error-item'))
			zkPopupClose();
	}

	// Process multiple files with the same form data - main visualizer only
	async processMultipleFiles(formData) {
		if (this.filesToUpload.length === 0) return;

		// Show progress indicator
		showLoadingMask();

		// Create custom progress bar in the popup
		const popupElement = document.querySelector('#popup-real');
		const progressContainer = document.createElement('div');
		progressContainer.className = 'upload-progress-container';

		const progressLabel = document.createElement('div');
		progressLabel.className = 'upload-progress-label';
		progressLabel.textContent = 'Uploading files...';

		const progressBarOuter = document.createElement('div');
		progressBarOuter.className = 'upload-progress-bar-outer';

		const progressBarInner = document.createElement('div');
		progressBarInner.className = 'upload-progress-bar-inner';

		const progressText = document.createElement('div');
		progressText.className = 'upload-progress-text';
		progressText.textContent = '0%';

		// Create error container
		const errorsContainer = document.createElement('div');
		errorsContainer.className = 'upload-errors';
		errorsContainer.style.display = 'none'; // Hide initially

		progressBarOuter.appendChild(progressBarInner);
		progressContainer.appendChild(progressLabel);
		progressContainer.appendChild(progressBarOuter);
		progressContainer.appendChild(progressText);
		progressContainer.appendChild(errorsContainer);

		// Add the progress bar to the popup
		popupElement.appendChild(progressContainer);
		await fillPopup();

		try {
			// Get page from options
			const page = currentAdminPage.split('/')[0];
			const fileField = this.options['visualizer-options'].field;

			// Process each file
			let successCount = 0;
			let errorCount = 0;

			// Function to update progress
			const updateProgress = (percent) => {
				progressBarInner.style.width = `${percent}%`;
				progressText.textContent = `${percent}% (${successCount} of ${this.filesToUpload.length})`;
			};

			// Function to add error message
			const addErrorMessage = (fileName, errorMsg) => {
				// Show the errors container if it was hidden
				if (errorsContainer.style.display === 'none')
					errorsContainer.style.display = 'block';

				const errorItem = document.createElement('div');
				errorItem.className = 'upload-error-item';
				errorItem.textContent = `${fileName}: ${errorMsg}`;
				errorsContainer.appendChild(errorItem);
				errorCount++;
			};

			for (let i = 0; i < this.filesToUpload.length; i++) {
				const file = this.filesToUpload[i];

				const parsedFile = await new Promise(resolve => {
					const reader = new FileReader();
					reader.onload = function (e) {
						const mime = e.target.result.match(/^data:(.*);/)[1];
						resolve({
							name: file.name,
							file: e.target.result.substring(('data:' + mime + ';base64,').length),
							type: mime,
						});
					};
					reader.readAsDataURL(file);
				});

				// Update progress
				const percent = Math.round(((i + 1) / this.filesToUpload.length) * 100);
				updateProgress(percent);

				// Create payload for this file
				let payload = {...formData};

				// Update progress label with current file
				progressLabel.textContent = `Uploading: ${file.name}`;

				// Upload the file and save the record
				try {
					parsedFile.admin_upload = await uploadPayloadFile(page, parsedFile);
					delete parsedFile.file;
					payload[fileField] = [parsedFile];

					await adminApiRequest(`page/${page}/save/0`, {data: payload});

					successCount++;
					updateProgress(percent); // Update with success count
				} catch (error) {
					console.error('Error uploading file:', file.name, error);
					// Add error to UI
					const errorMessage = typeof error === 'string' ? error : (error.message || 'Unknown error occurred');
					addErrorMessage(file.name, errorMessage);
				}
			}

			// Update final message to include errors if any
			progressLabel.textContent = errorCount > 0 ? `Upload completed with ${errorCount} errors` : 'Upload completed successfully';

			// Show success message
			inPageMessage(`Successfully uploaded ${successCount} of ${this.filesToUpload.length} file(s)`, 'success');
		} catch (error) {
			reportAdminError(error);
		} finally {
			// Hide progress indicator
			hideLoadingMask();
			_('#form-popup .btn-primary').value = 'Salva';
		}
	}
}

visualizerClasses.set('Files', Files);
