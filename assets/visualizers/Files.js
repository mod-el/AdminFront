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
			...(options['visualizer-options'] || {})
		};

		this.useFilters = true;
		this.forceTableOnSearch = false;
		this.hasPagination = true;

		this.selectedRows = [];

		// Store files for multi-upload
		this.filesToUpload = [];

		if (this.main) {
			// Add "upload" page action
			addPageAction('upload', {
				'fa-icon': 'fas fa-upload',
				text: 'Upload files',
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

		// Add drag and drop functionality
		this.setupDragAndDrop(filesContainer);

		if (list.length === 0) {
			const emptyMessage = document.createElement('div');
			emptyMessage.className = 'files-empty';
			emptyMessage.innerHTML = '<i class="fas fa-folder-open"></i><p>No files found</p><p class="drag-info">Drag and drop files here to upload</p>';
			filesContainer.appendChild(emptyMessage);
			return;
		}

		// Render each file in the list
		for (const item of list)
			this.renderFileBox(filesContainer, item);
	}

	renderFileBox(container, item) {
		const fileField = this.options['visualizer-options'].field;
		const nameField = this.options['visualizer-options'].name;
		const extField = this.options['visualizer-options'].ext;
		const iconField = this.options['visualizer-options'].icon;

		const fileName = item.data[nameField]?.value || 'No name';

		// Get file extension for icon
		let fileExtension = 'default';
		if (extField)
			fileExtension = item.data[extField]?.value;
		if (fileName.includes('.'))
			fileExtension = fileName.split('.').pop().toLowerCase();

		// Determine icon class
		let iconClass = this.options['visualizer-options'].defaultIcon;
		if (iconField && item.data[iconField]?.value)
			iconClass = item.data[iconField].value.toLowerCase();
		else if (this.options['visualizer-options'].iconMapping[fileExtension])
			iconClass = this.options['visualizer-options'].iconMapping[fileExtension];

		// Create file box element
		const fileBox = document.createElement('div');
		fileBox.className = 'file-box';
		fileBox.setAttribute('title', fileName);

		// Add the selected class if this file is selected
		if (this.selectedRows.includes(item.id))
			fileBox.classList.add('selected');

		// Create file icon
		const icon = document.createElement('div');
		icon.className = 'file-icon';
		icon.innerHTML = `<i class="${iconClass}"></i>`;
		fileBox.appendChild(icon);

		// Create file name
		const name = document.createElement('div');
		name.className = 'file-name';
		name.textContent = fileName;
		fileBox.appendChild(name);

		// Add click handler for selection
		fileBox.addEventListener('click', (e) => {
			this.openFile(item.id);
		});

		// Add action buttons if privileges allow
		if (item.privileges && (item.privileges['U'] || item.privileges['D'])) {
			const actions = document.createElement('div');
			actions.className = 'file-actions';

			if (item.privileges['U']) {
				const selectBtn = document.createElement('button');
				selectBtn.innerHTML = '<i class="fas fa-check-square"></i>';
				selectBtn.setAttribute('title', 'Select');
				selectBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.selectFile(item.id, fileBox);
				});
				actions.appendChild(selectBtn);
			}

			if (item.privileges['D']) {
				const deleteBtn = document.createElement('button');
				deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
				deleteBtn.setAttribute('title', 'Delete');
				deleteBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.deleteFile(item.id);
				});
				actions.appendChild(deleteBtn);
			}

			fileBox.appendChild(actions);
		}

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

	async openFile(id) {
		return openElementInPopup(id);
	}

	async deleteFile(id) {
		deleteRows([id]);
	}

	// Standard visualizers methods
	async getFieldsToRetrieve() {
		const fields = [this.options['visualizer-options'].field, this.options['visualizer-options'].name, 'id'];
		if (this.options['visualizer-options'].ext)
			fields.push(this.options['visualizer-options'].ext);
		if (this.options['visualizer-options'].icon)
			fields.push(this.options['visualizer-options'].icon);
		return fields;
	}

	async reload() {
		if (this.main) {
			return reloadMainList();
		} else {
			alert('TODO: sublist reloading');
			// TODO: sublist reloading
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

			if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				this.handleDroppedFiles(e.dataTransfer.files);
			}
		});
	}

	// Handle dropped files
	handleDroppedFiles(files) {
		if (files.length === 0) return;

		// Store the files
		this.filesToUpload = Array.from(files);

		// Open form to enter metadata
		this.openUploadForm();
	}

	// Handle multi upload action (triggered from toolbar)
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

	// Open form for upload metadata
	openUploadForm() {
		if (this.filesToUpload.length === 0) return;

		// Open the form in popup
		openElementInPopup(0, {
			save: async () => {
				const formData = await pageForms.get('popup').getValues();
				_('#form-popup .btn-primary').value = 'Attendere...';

				// Process all files with the same form data
				await this.processMultipleFiles(formData);

				// Clear file list after upload
				this.filesToUpload = [];

				// Reload the list
				await this.reload();

				return true; // Return true to close the popup
			}
		});
	}

	// Process multiple files with the same form data
	async processMultipleFiles(formData) {
		if (this.filesToUpload.length === 0) return;

		// Show progress indicator
		showLoadingMask();

		try {
			// Get page from options
			const page = currentAdminPage.split('/')[0];
			const fileField = this.options['visualizer-options'].field;

			// Process each file
			let successCount = 0;
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
				setLoadingBar(Math.round((i / this.filesToUpload.length) * 100));

				// Create payload for this file
				let payload = {...formData};

				// Upload the file and save the record
				try {
					parsedFile.admin_upload = await uploadPayloadFile(page, parsedFile);
					delete parsedFile.file;
					payload[fileField] = [parsedFile];

					await adminApiRequest(`page/${page}/save/0`, {data: payload});

					successCount++;
				} catch (error) {
					console.error('Error uploading file:', file.name, error);
				}
			}

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
