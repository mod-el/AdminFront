class Table {
	constructor(options) {
		this.options = options;
	}

	render(container, list) {
		let head = document.createElement('div');
		head.className = 'table-head';

		let subHead = head.appendChild(document.createElement('div'));

		let checkboxTd = subHead.appendChild(document.createElement('div'));
		checkboxTd.className = 'special-cell';
		checkboxTd.style.padding = '0 5px';
		checkboxTd.innerHTML = '<input type="checkbox" onchange="if(this.checked) selectAllRows(1); else selectAllRows(0)"/>';

		let deleteTd = subHead.appendChild(document.createElement('div')); // TODO: renderlo visibile solo se c'è almeno una X
		deleteTd.className = 'special-cell';

		this.options['default-fields'].forEach(fieldName => {
			let field = this.options['fields'][fieldName];

			let div = subHead.appendChild(document.createElement('div'));
			div.setAttribute('id', 'column-' + fieldName);
			div.setAttribute('data-column', fieldName);

			let resize = div.appendChild(document.createElement('div'));
			resize.className = 'table-head-resize';
			resize.setAttribute('data-context-menu', "{'Ottimizza':function(){ autoResize('" + fieldName + "'); }, 'Ottimizza colonne':function(){ autoResize(false); }}");

			resize.addEventListener('mousedown', event => {
				startColumnResize(event, fieldName);
				event.stopPropagation();
				event.preventDefault();
			});
			resize.addEventListener('dblclick', event => {
				autoResize(fieldName);
			});

			// TODO: sorting
			let label = div.appendChild(document.createElement('div'));
			label.addClass('table-head-label');
			if (field.sortable)
				label.addClass('sortable');
			label.innerHTML = field.label;
		});

		/**************************/

		container.appendChild(head);
	}
}

visualizerClasses['Table'] = Table;
