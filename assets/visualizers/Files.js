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
			...(options['visualizer-options'] || {})
		};

		this.useFilters = true;
		this.forceTableOnSearch = false;
		this.hasPagination = true;

		this.selectedRows = [];

		// Store files for multi-upload
		this.filesToUpload = [];

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

		// Add drag and drop functionality
		this.setupDragAndDrop(filesContainer);

		if (list.length === 0) {
			const emptyMessage = document.createElement('div');
			emptyMessage.className = 'files-empty';
			emptyMessage.innerHTML = '<i class="fas fa-folder-open"></i><p>No files found</p><p class="drag-info">Drag and drop files here to upload</p>';
			filesContainer.appendChild(emptyMessage);
			return;
		}

		const draggable = this.options['custom-order'];
		if (draggable) {
			filesContainer.setAttribute('data-draggable-cont', '');
			filesContainer.setAttribute('data-draggable-callback', 'adminRowDragged(element.id, element.idx, target.idx)');
		}

		// Render each file in the list
		for (const item of list)
			this.renderFileBox(filesContainer, item, draggable);
	}

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
		selectBtn.innerHTML = '<i class="fas fa-check-square"></i>';
		selectBtn.setAttribute('title', 'Seleziona');
		selectBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.selectFile(item.id, fileBox);
		});
		actions.appendChild(selectBtn);

		if (item.privileges && (item.privileges['R'] || item.privileges['U'])) {
			const editBtn = document.createElement('button');
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

			if (e.dataTransfer.files && e.dataTransfer.files.length > 0)
				this.handleDroppedFiles(e.dataTransfer.files);
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

	// Process multiple files with the same form data
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
