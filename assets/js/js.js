var mainMenu = null;
var sId = null;
var firstLoad = true;
var currentAdminPage = false;
var currentPageDetails = {};
var runtimeLoadedJs = [];
var runtimeLoadedCss = [];
var selectedRows = [];
var currentPage = 1;
var searchCounter = 0;
var pageLoadingHash = '';
var adminApiToken = null;

var userCustomizationsCache = {};
var userCustomizationsBuffer = {};

var visualizerClasses = new Map();
var visualizers = new Map();

var dataCache = {'data': {}, 'children': []};

var saving = false;

var pageForms = new Map();

class HistoryManager {
	constructor() {
		this.changeHistory = [];
		this.canceledChanges = [];
	}

	append(form, field, oldValue, newValue) {
		this.changeHistory.push({form, field, oldValue, newValue});
		this.canceledChanges = [];
		this.rebuildBox();
	}

	stepBack() {
		if (this.changeHistory.length === 0)
			return false;

		let el = this.changeHistory.pop();
		this.canceledChanges.unshift(el);

		if (typeof el.sublist !== 'undefined') {
			/*switch (el.action) { // TODO
				case 'new':
					sublistDeleteRow(el.sublist, el.id, false);
					break;
				case 'delete':
					sublistRestoreRow(el.sublist, el.id);
					break;
			}*/
		} else {
			let form = pageForms.get(el.form);
			if (!form)
				return;

			// if (form[el.field].getAttribute('data-multilang') && form[el.field].getAttribute('data-lang')) // TODO
			// 	switchFieldLang(form[el.field].getAttribute('data-multilang'), form[el.field].getAttribute('data-lang'));

			let field = form.fields.get(el.field).getNode();
			field.setValue(el.oldValue, false);
			field.focus();
			if (field.select)
				field.select();
			form.changedValues[el.field] = el.oldValue;
		}

		this.rebuildBox();
	}

	stepForward() {
		if (this.canceledChanges.length === 0)
			return false;

		let el = this.canceledChanges.shift();
		this.changeHistory.push(el);

		if (typeof el.sublist !== 'undefined') {
			/*switch (el.action) { // TODO
				case 'new':
					sublistRestoreRow(el.sublist, el.id);
					break;
				case 'delete':
					sublistDeleteRow(el.sublist, el.id, false);
					break;
			}*/
		} else {
			let form = pageForms.get(el.form);
			if (!form)
				return;
			// if (form[el.field].getAttribute('data-multilang') && form[el.field].getAttribute('data-lang')) // TODO
			// 	switchFieldLang(form[el.field].getAttribute('data-multilang'), form[el.field].getAttribute('data-lang'));

			let field = form.fields.get(el.field).getNode();
			field.setValue(el.newValue, false);
			field.focus();
			if (field.select)
				field.select();
			form.changedValues[el.field] = el.newValue;
		}

		this.rebuildBox();
	}

	goToStep(t, i) {
		switch (t) {
			case 'reset':
				while (this.changeHistory.length > 0)
					this.stepBack();
				break;
			case 'back':
				while (this.changeHistory.length > i + 1)
					this.stepBack();
				break;
			case 'forward':
				if (i + 1 > this.canceledChanges)
					return;
				for (let c = 1; c <= i + 1; c++)
					this.stepForward();
				break;
		}
	}

	wipe() {
		this.changeHistory = [];
		this.canceledChanges = [];
		this.rebuildBox();
	}

	rebuildBox() {
		if (!_('links-history'))
			return false;

		_('links-history').innerHTML = '<a href="#" onclick="historyMgr.goToStep(\'reset\'); return false" class="link-history">Situazione iniziale</a>';

		this.changeHistory.forEach(function (i, idx) {
			var a = document.createElement('a');
			a.href = '#';
			a.setAttribute('onclick', 'historyMgr.goToStep(\'back\', ' + idx + '); return false');
			a.className = 'link-history';
			if (typeof i.sublist !== 'undefined') {
				switch (i.action) {
					case 'new':
						a.textContent = 'new sublist row in "' + i.sublist + '"';
						break;
					case 'delete':
						a.textContent = 'deleted row in "' + i.sublist + '"';
						break;
				}
			} else {
				a.textContent = 'edited "' + i.field + '"';
			}
			_('links-history').appendChild(a);
		});

		this.canceledChanges.forEach(function (i, idx) {
			var a = document.createElement('a');
			a.href = '#';
			a.setAttribute('onclick', 'historyMgr.goToStep(\'forward\', ' + idx + '); return false');
			a.className = 'link-history disabled';
			if (typeof i.sublist !== 'undefined') {
				switch (i.action) {
					case 'new':
						a.textContent = 'new sublist row in "' + i.sublist + '"';
						break;
					case 'delete':
						a.textContent = 'deleted row in "' + i.sublist + '"';
						break;
				}
			} else {
				a.textContent = 'edited "' + i.field + '"';
			}
			_('links-history').appendChild(a);
		});
	}
}

var historyMgr = new HistoryManager();

class FormManager {
	constructor(name) {
		this.name = name;
		this.version = 1;
		this.fields = new Map()
		this.changedValues = {};
	}

	async add(field) {
		let node = field.getNode();

		node.addEventListener('change', () => {
			let old = null;
			if (typeof this.changedValues[field.name] === 'undefined') {
				old = node.getAttribute('data-default-value');
			} else {
				old = this.changedValues[field.name];
			}

			node.getValue().then(v => {
				if (node.type !== 'file' && v == old)
					return;

				this.changedValues[field.name] = v;

				if (node.type !== 'file') // Files fields are complex structure, thus are not supported in the changes history
					historyMgr.append(this.name, field.name, old, v);
			});
		});

		if (node.type !== 'file') { // Files fields are complex structure, thus are not supported in the changes history
			let v = await node.getValue();
			node.setAttribute('data-default-value', v);
		}

		this.fields.set(field.name, field);
	}

	async build(cont, data) {
		if (data.version)
			this.version = data.version;

		for (let k of Object.keys(data.fields)) {
			let fieldCont = cont.querySelector('[data-fieldplaceholder="' + k + '"]');
			if (!fieldCont)
				continue;

			let fieldOptions = data.fields[k];
			if (typeof data.data[k] !== 'undefined')
				fieldOptions.value = data.data[k];

			let field = new Field(k, fieldOptions);
			await this.add(field);

			fieldCont.innerHTML = '';
			fieldCont.appendChild(field.getNode());
		}
	}

	getChangedValues() {
		return this.changedValues;
	}

	getRequired() {
		let required = [];
		for (let field of this.fields) {
			if (field.required)
				required.push(field.name);
		}
		return required;
	}
}

class Field {
	constructor(name, options = {}) {
		this.name = name;
		this.node = null;
		this.options = {
			'type': 'text',
			'value': null,
			'attributes': {},
			'options': [],
			'multilang': false,
			'required': false,
			...options
		};
	}

	getNode() {
		if (this.node === null) {
			let nodeType = null;
			let attributes = this.options['attributes'];

			switch (this.options['type']) {
				case 'textarea':
					nodeType = 'textarea';
					break;
				case 'select':
					nodeType = 'select';
					break;
				case 'date':
					nodeType = 'input';
					attributes['type'] = 'date';
					break;
				default:
					nodeType = 'input';
					attributes['type'] = this.options['type'];
					break;
			}

			if (typeof attributes['name'] === 'undefined')
				attributes['name'] = this.name;

			let node = document.createElement(nodeType);

			Object.keys(attributes).forEach(k => {
				node.setAttribute(k, attributes[k]);
			});

			if (this.options['type'] === 'select') {
				node.innerHTML = '<option value=""></option>';
				this.options['options'].forEach(option => {
					let el = document.createElement('option');
					el.value = option.id;
					el.innerHTML = option.text;
					if (option.id == this.options['value'])
						el.setAttribute('selected', '');
					node.appendChild(el);
				});
			} else {
				node.value = this.options['value'];
			}

			this.node = node;
		}

		return this.node;
	}
}

window.addEventListener('DOMContentLoaded', function () {
	currentAdminPage = document.location.pathname.substr(adminPrefix.length);

	adminApiToken = getCookie('admin-user');
	adminInit();
});

function adminInit() {
	checkUserToken().then(r => {
		if (!r)
			return false;

		return adminApiRequest('pages').then(r => {
			mainMenu = r;
			buildMenu(r);
			return true;
		});
	}).then(r => {
		if (!r)
			return false;

		let get = objectFromQueryString();
		loadAdminPage(currentAdminPage, get, 'replace', true);

		document.addEventListener('notifications', function (event) {
			let notifications;
			if (typeof event.detail.notifications !== 'undefined' && event.detail.notifications.length !== 'undefined' && event.detail.notifications.length > 0)
				notifications = event.detail.notifications;
			else
				notifications = [];

			let counter = _('notifications-counter');
			counter.innerHTML = notifications.length;
			if (notifications.length > 0) {
				counter.style.display = 'block';
			} else {
				counter.style.display = 'none';
			}

			notifications.forEach(n => {
				if (!n.sent) {
					Notification.requestPermission().then(r => {
						if (r === 'granted') {
							navigator.serviceWorker.getRegistration().then(reg => {
								let title = n.title;
								let body = n.short_text;
								if (!title) {
									title = body;
									body = '';
								}

								reg.showNotification(title, {
									'body': body,
									'data': n
								});
							});
						}
					});
				}
			});
		});
	}).catch(err => alert(err));
}

function checkUserToken() {
	if (!adminApiToken)
		return loadLoginPage().then(() => false);

	unloadLoginPage();

	return adminApiRequest('user/auth').then(r => {
		_('header-username').innerHTML = r.username;
		model_notifications_user = r.id;
		return r;
	}).catch(err => {
		deleteCookie('admin-user', getAdminCookiePath());
		adminApiToken = null;
		adminInit();
		throw err;
	});
}

async function login() {
	_('login-button').innerHTML = 'Attendere...';

	let form = _('login');
	let username = await form['username'].getValue();
	let password = await form['password'].getValue();

	form.style.display = 'none';

	return adminApiRequest('user/login', {
		'path': adminPath,
		'username': username,
		'password': password
	}).then(r => {
		setCookie('admin-user', r.token, 365 * 10, getAdminCookiePath());
		adminApiToken = r.token;
		return adminInit();
	}).catch(err => {
		form.style.display = 'block';
		_('login-button').innerHTML = 'Login';

		let errorMessageDiv = _('login-error-message');
		errorMessageDiv.innerHTML = err;
		errorMessageDiv.style.display = 'block';
	});
}

function logout() {
	clearMainPage();
	adminApiToken = null;
	deleteCookie('admin-user', getAdminCookiePath());
	return loadLoginPage();
}

window.addEventListener('load', function () {
	resize();
	window.addEventListener('resize', function () {
		resize();
	});
});

if ('serviceWorker' in navigator) {
	window.addEventListener('load', function () {
		navigator.serviceWorker.register(adminPrefix + 'sw.js').then(function (registration) {
			// Registration was successful
			console.log('ServiceWorker registration successful with scope: ', registration.scope);

			navigator.serviceWorker.addEventListener('message', event => {
				switch (event.data.type) {
					case 'reload':
						if (confirm('Sono stati scaricati nuovi aggiornamenti per l\'admin, si consiglia di aggiornare la pagina. Vuoi aggiornare ora?'))
							document.location.reload();
						break;
					case 'notifications':
						let notificationEvent = new CustomEvent('notifications', {
							'detail': {
								'notifications': event.data.notifications
							}
						});
						document.dispatchEvent(notificationEvent);
						break;
					default:
						console.log('Messaggio ricevuto dal Service Worker:');
						console.log(event.data);
						break;
				}
			});
		}, function (err) {
			// registration failed :(
			console.log('ServiceWorker registration failed: ', err);
		});
	});
}

window.onpopstate = function (event) {
	var s = event.state;
	if (typeof s['request'] !== 'undefined') {
		if (s['request'] === currentAdminPage) {
			if (typeof s['filters'] === 'undefined')
				s['filters'] = {};

			fillFiltersValues(s['filters']).then(() => {
				if (typeof s['p'] !== 'undefined' && s['p'] !== currentPage) {
					goToPage(s['p'], s['sort-by'], false);
				} else {
					search(currentPage, s['sort-by'], false);
				}
			});
		} else {
			let request = s['request'].split('/');

			let get = {};

			sessionStorage.setItem('current-page', request[0]);

			if (typeof s['filters'] !== 'undefined')
				sessionStorage.setItem('filters-values', JSON.stringify(s['filters']));

			if (typeof s['p'] !== 'undefined')
				get['p'] = s['p'];

			loadAdminPage(s['request'], get, false, true);
		}
	}
};

function adminApiRequest(request, payload = {}, options = {}) {
	let headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json'
	};
	if (adminApiToken !== null)
		headers['X-Access-Token'] = adminApiToken;

	return ajax(adminApiPath + request, {}, payload, {
		'fullResponse': true,
		'headers': headers,
		'json': true,
		...options
	}).then(response => {
		return response.text().then(text => {
			try {
				let resp = JSON.parse(text);

				return {
					'status': response.status,
					'body': resp
				};
			} catch (e) {
				return {
					'status': response.status,
					'body': text
				};
			}
		});
	}).then(response => {
		if (typeof response.body !== 'object')
			throw response.body;

		if (response.status !== 200) {
			if (typeof response.body.error !== 'undefined') {
				throw response.body.error;
			} else {
				throw 'Invalid response from server';
			}
		}

		return response.body;
	}).catch(err => {
		throw err;
	});
}

window.addEventListener('beforeunload', function (event) {
	if (!saving && historyMgr.changeHistory.length === 0)
		return true;

	var message = 'There are unsaved data, are you sure?';
	if (typeof event === 'undefined')
		event = window.event;
	if (event)
		event.returnValue = message;

	return message;
});

window.addEventListener('keydown', function (event) {
	switch (event.keyCode) {
		case 90: // CTRL+Z
			if (event.ctrlKey) {
				historyMgr.stepBack();
				event.preventDefault();
			}
			break;
		case 89: // CTRL+Y
			if (event.ctrlKey) {
				historyMgr.stepForward();
				event.preventDefault();
			}
			break;

	}
});

/*
 Loads a page using fetch; fills the main div with the content when the response comes, and additionally returns a Promise
 */
function loadPage(url, get = {}, post = {}, deleteContent = true) {
	if (!checkBeforePageChange())
		return false;

	get['ajax'] = '';

	if (deleteContent)
		clearMainPage();

	pageLoadingHash = url + JSON.stringify(get) + JSON.stringify(post);

	return ajax(url, get, post).then((function (hash) {
		return function (response) {
			if (hash !== pageLoadingHash)
				return false;

			_('main-loading').addClass('d-none');
			_('main-content').jsFill(response);

			if (window.resetAllInstantSearches)
				resetAllInstantSearches();

			resize();
			return changedHtml().then(() => {
				return response;
			});
		}
	})(pageLoadingHash));
}

function clearMainPage() {
	_('main-loading').removeClass('d-none');
	_('main-content').innerHTML = '';
}

/*
 Moves between admin pages, moving the left menu and taking care of the browser history
 */
async function loadAdminPage(request, get = {}, history_push = true, loadFullDetails = false) {
	if (!checkBeforePageChange())
		return false;

	request = request.split('/');

	visualizers.clear();
	selectFromMainMenu(request);

	clearMainPage();

	return new Promise(resolve => {
		if (!firstLoad && currentAdminPage.split('/')[0] === request[0]) {
			resolve();
		} else {
			if (firstLoad)
				firstLoad = false;

			return adminApiRequest('page/' + request[0]).then(r => {
				if (typeof r !== 'object')
					throw r;

				currentPageDetails = r;
				resolve();
			});
		}
	}).then(async () => {
		let loadingPromises = [];

		runtimeLoadedCss.forEach(file => {
			unloadRuntimeCss(file);
		});
		runtimeLoadedCss = [];

		currentPageDetails.js.forEach(file => {
			loadingPromises.push(loadRuntimeJs(file));
		});
		currentPageDetails.css.forEach(file => {
			loadRuntimeCss(file);
		});

		let toolbar = _('toolbar');
		toolbar.addClass('d-none');
		toolbar.innerHTML = '';

		if (typeof request[1] !== 'undefined') {
			currentAdminPage = request.join('/');

			if (window.innerWidth < 800)
				closeMenu();

			wipeForms();

			if (history_push) {
				let replace = (typeof history_push === 'string' && history_push === 'replace');
				historyPush(request, queryStringFromObject(get), replace);
			}

			switch (request[1]) {
				case 'edit':
					let id = getIdFromRequest(request);

					toolbar.removeClass('d-none');

					// ==== Basic actions ====

					if (loadFullDetails) {
						return loadAdminElement(id, get, false);
					} else {
						return loadPage(adminPrefix + 'template/' + request[0]);
					}
					break;
			}
		} else {
			// TODO: rimuovere scritte sottostanti quando saranno fatte
			// Ripassare dalla richiesta per abilitare tutti i parametri restanti)
			//      Ad esempio: tasto print, eliminazione multipla righe

			if (sessionStorage.getItem('current-page') !== request[0])
				sessionStorage.removeItem('filters-values');
			sessionStorage.setItem('current-page', request[0]);

			switch (currentPageDetails.type) {
				case 'Custom':
					// ==== Custom actions ====

					if (currentPageDetails.actions && Object.keys(currentPageDetails.actions).length > 0) {
						toolbar.removeClass('d-none');

						Object.keys(currentPageDetails.actions).forEach(action => {
							addPageAction(action, currentPageDetails.actions[action]);
						});
					}
					break;
				default:
					toolbar.removeClass('d-none');

					// ==== Basic actions ====

					if (currentPageDetails.privileges.C) {
						addPageAction('new', {
							'fa-icon': 'far fa-plus-square',
							'text': 'Nuovo',
							'action': 'newElement()',
						});
					}

					if (currentPageDetails.privileges.D) {
						addPageAction('delete', {
							'fa-icon': 'far fa-trash-alt',
							'text': 'Elimina',
							'action': 'deleteRows()',
						});
					}

					addPageAction('filters', {
						'fa-icon': 'fas fa-filter',
						'text': 'Filtri',
						'action': 'switchFiltersForm(this)',
					});

					// ==== Custom actions ====

					Object.keys(currentPageDetails.actions).forEach(action => {
						addPageAction(action, currentPageDetails.actions[action]);
					});

					// ==== Build filters ====

					await rebuildFilters();

					// ==== Load visualizer files ====

					loadingPromises.push(loadRuntimeJs(PATH + 'model/AdminFront/assets/visualizers/' + currentPageDetails.type + '.js'));
					loadRuntimeCss(PATH + 'model/AdminFront/assets/visualizers/' + currentPageDetails.type + '.css');
					break;
			}

			return Promise.all(loadingPromises).then(() => {
				currentAdminPage = request.join('/');
				selectedRows = [];

				selectFromMainMenu(request);

				if (window.innerWidth < 800)
					closeMenu();

				clearMainPage();
				wipeForms();

				switch (currentPageDetails.type) {
					case 'Custom':
						if (history_push) {
							let replace = (typeof history_push === 'string' && history_push === 'replace');
							historyPush(request, queryStringFromObject(get), replace);
						}

						return loadPage(adminPrefix + request.join('/'));
						break;
					default:
						// ==== Set page variable ====
						if (typeof get['nopag'] !== 'undefined') {
							currentPage = null;
						} else if (typeof get['p'] !== 'undefined') {
							currentPage = parseInt(get['p']);
							if (isNaN(currentPage) || currentPage < 1)
								currentPage = 1;
						} else {
							currentPage = 1;
						}

						// ==== First search ====
						return search(currentPage, null, history_push);
						break;
				}
			});
		}
	});
}

function getIdFromRequest(request) {
	let id = 0;
	if (typeof request[2] !== 'undefined')
		id = parseInt(request[2]);
	if (isNaN(id))
		throw 'Id non valido';

	return id;
}

function loadRuntimeJs(file) {
	if (runtimeLoadedJs.indexOf(file) !== -1)
		return;

	return new Promise(resolve => {
		let fileref = document.createElement('script');
		fileref.setAttribute('type', 'text/javascript');
		document.getElementsByTagName('head')[0].appendChild(fileref);
		fileref.onload = () => {
			resolve();
		};
		fileref.setAttribute('src', file);

		runtimeLoadedJs.push(file);
	});
}

function loadRuntimeCss(file) {
	if (runtimeLoadedCss.indexOf(file) !== -1)
		return;

	let fileref = document.createElement('link');
	fileref.setAttribute('rel', 'stylesheet');
	fileref.setAttribute('type', 'text/css');
	fileref.setAttribute('href', file);
	document.getElementsByTagName('head')[0].appendChild(fileref);

	runtimeLoadedCss.push(file);
}

function unloadRuntimeCss(file) {
	let allsuspects = document.getElementsByTagName('link');
	for (let i = allsuspects.length; i >= 0; i--) {
		if (allsuspects[i] && allsuspects[i].getAttribute('href') !== null && allsuspects[i].getAttribute('href').indexOf(file) !== -1)
			allsuspects[i].parentNode.removeChild(allsuspects[i]);
	}
}

async function rebuildFilters() {
	let form = _('topForm');
	if (!form) {
		form = document.createElement('form');
		form.id = 'topForm';
		form.setAttribute('onsubmit', 'return false');
		_('toolbar').appendChild(form);
	}
	form.innerHTML = '<div class="flex-fields"></div>';

	let secondaryForm = _('filtersFormCont');
	secondaryForm.innerHTML = '<div class="flex-fields-wrap"></div>';

	let filters = await getFiltersFromPageDetails();

	let forms = {
		'primary': form,
		'secondary': secondaryForm
	};

	Object.keys(filters).forEach(formName => {
		filters[formName].forEach(filter => {
			let div = document.createElement('div');

			let label = '';
			if (typeof filter.options['label'] !== 'undefined') {
				label = filter.options['label'];
				if (filter.options['attributes']['data-filter-type'] !== '=')
					label += ' (' + filter.options['attributes']['data-filter-type'] + ')';
			}

			if (formName === 'secondary') {
				div.innerHTML = label + '<br/>';
			} else {
				if (typeof filter.options['attributes']['placeholder'] === 'undefined')
					filter.options['attributes']['placeholder'] = label;
			}

			let field = filter.getNode();
			switch (field.nodeName.toLowerCase()) {
				case 'input':
				case 'textarea':
					switch (field.type.toLowerCase()) {
						case 'checkbox':
						case 'radio':
						case 'hidden':
						case 'date':
							field.addEventListener('change', function () {
								search();
							});
							break;
						default:
							field.addEventListener('keyup', function (event) {
								if ((event.keyCode <= 40 && event.keyCode != 8 && event.keyCode != 13 && event.keyCode != 32))
									return false;

								searchCounter++;
								setTimeout((function (c) {
									return function () {
										if (c === searchCounter)
											search();
									}
								})(searchCounter), 400);
							});
							break;
					}
					break;
				default:
					field.addEventListener('change', function () {
						search();
					});
					break;
			}

			div.appendChild(field);
			forms[formName].firstChild.appendChild(div);
		});
	});

	resize();
}

async function getFiltersFromPageDetails() {
	let filtersArrangement = await getFiltersListFromStorage();
	let filtersValues = getFiltersValuesFromStorage();

	let filters = {
		'primary': [],
		'secondary': []
	};

	let idx = 0;
	Object.keys(filtersArrangement).forEach(form => {
		filtersArrangement[form].forEach(filterOptions => {
			if (typeof currentPageDetails['filters'][filterOptions.filter] === 'undefined')
				return;

			let fieldOptions = currentPageDetails['filters'][filterOptions.filter];
			if (typeof fieldOptions['attributes'] === 'undefined')
				fieldOptions['attributes'] = {};
			fieldOptions['attributes']['data-filter'] = filterOptions.filter;
			fieldOptions['attributes']['data-filter-type'] = filterOptions.type;

			let defaultValue = '';
			if (typeof fieldOptions.default !== 'undefined')
				defaultValue = fieldOptions.default;

			let value = defaultValue;
			if (filtersValues && typeof filtersValues[filterOptions.filter + '-' + filterOptions.type] !== 'undefined')
				value = filtersValues[filterOptions.filter + '-' + filterOptions.type];

			fieldOptions['value'] = value;
			fieldOptions['attributes']['data-default'] = defaultValue;

			let filter = new Field('filter-' + idx, fieldOptions);
			filters[form].push(filter);
			idx++;
		});
	});

	return filters;
}

async function getFiltersListFromStorage() {
	let request = currentAdminPage.split('/');
	let filters = await getUserCustomization('filters-' + request[0]);
	if (filters !== null) {
		return filters;
	} else {
		return currentPageDetails['default-filters']
	}
}

function getFiltersValuesFromStorage() {
	let filtersValues = sessionStorage.getItem('filters-values');
	try {
		if (filtersValues)
			filtersValues = JSON.parse(filtersValues);
	} catch (e) {
		filtersValues = null;
	}

	return filtersValues;
}

async function fillFiltersValues(values) {
	let promises = [];
	document.querySelectorAll('[data-filter]').forEach(el => {
		let k = el.getAttribute('data-filter') + '-' + el.getAttribute('data-filter-type');
		if (typeof values[k] !== 'undefined')
			promises.push(el.setValue(values[k], false));
		else
			promises.push(el.setValue(null, false));
	});
	return Promise.all(promises);
}

function checkBeforePageChange() {
	if (saving) {
		alert('Cannot change page while saving. Wait until finished or reload the page.');
		return false;
	}
	if (historyMgr.changeHistory.length > 0)
		return confirm('There are unsaved data. Do you really want to change page?');

	return true;
}

function addPageAction(name, action) {
	if (_('toolbar-button-' + name))
		_('toolbar-button-' + name).parentNode.removeChild(_('toolbar-button-' + name));

	var button = document.createElement('a');
	button.className = 'toolbar-button';
	button.id = 'toolbar-button-' + name;

	if (action.url)
		button.href = action.url;
	else
		button.href = '#';

	if (action.action)
		button.setAttribute('onclick', action.action + '; return false');
	else if (!action.url)
		button.setAttribute('onclick', 'return false');

	if (action.icon)
		button.innerHTML = '<img src="' + action.icon + '" alt="" onload="resize()" /> ';

	if (action['fa-icon'])
		button.innerHTML = '<i class="' + action['fa-icon'] + '" aria-hidden="true"></i> ';

	if (action.text)
		button.innerHTML += action.text;

	_('toolbar').appendChild(button);
}

async function goToPage(p, sortBy, history_push = true) {
	let mainContentDiv = _('main-content');

	let moveBy = mainContentDiv.offsetWidth + 50;
	if (p > currentPage)
		moveBy *= -1;

	let get = objectFromQueryString();
	if (typeof get['goTo'] !== 'undefined')
		delete get['goTo'];

	get['p'] = p;

	new Promise(resolve => {
		if (p !== currentPage) {
			mainContentDiv.style.left = moveBy + 'px';

			setTimeout(resolve, 300);
		} else {
			resolve();
		}
	}).then(() => {
		_('main-content').style.display = 'none';
		_('main-loading').removeClass('d-none');

		return search(p, sortBy, history_push);
	}).then(() => {
		_('main-content').style.display = 'block';
		_('main-loading').addClass('d-none');

		mainContentDiv.className = 'no-transition';
		mainContentDiv.style.left = (moveBy * -1) + 'px';
		mainContentDiv.offsetWidth;
		mainContentDiv.className = '';
		mainContentDiv.style.left = '0px';

		return new Promise(resolve => {
			setTimeout(resolve, 300);
		});
	});
}

async function allInOnePage() {
	return search(null);
}

var lightboxOldParent = false;

function toolsLightbox(id, options) {
	if (lightbox = _('tools-lightbox')) {
		while (lightbox.childNodes.length) {
			lightboxOldParent.appendChild(lightbox.firstChild);
		}
		lightboxOldParent = false;
		_('main-page').removeChild(lightbox);
		return;
	}

	options = array_merge({
		'origin': false,
		'width': false,
		'height': false,
		'left': false,
		'offset-x': 0,
		'offset-y': 0
	}, options);
	var lightbox = document.createElement('div');
	lightbox.className = 'tools-lightbox';
	lightbox.id = 'tools-lightbox';
	if (options['width'] !== false)
		lightbox.style.width = options['width'];
	if (options['height'] !== false)
		lightbox.style.height = options['height'];
	lightbox.style.transform = 'scale(1,0)';

	var contentDiv = _(id);
	lightboxOldParent = contentDiv;
	while (contentDiv.childNodes.length) {
		lightbox.appendChild(contentDiv.firstChild);
	}

	_('main-page').appendChild(lightbox);

	var coords = getElementCoords(options['origin']);

	coords.y += options['origin'].offsetHeight;
	coords.y -= window.pageYOffset;
	lightbox.style.top = (coords.y + options['offset-y']) + 'px';

	if (options['left'] !== false) {
		lightbox.style.left = options['left'];
	} else {
		if (coords.x + options['offset-x'] + lightbox.offsetWidth > window.innerWidth - 10) {
			lightbox.style.right = (window.innerWidth - coords.x - options['origin'].offsetWidth - options['offset-x']) + 'px';
		} else {
			lightbox.style.left = (coords.x + options['offset-x']) + 'px';
		}
	}

	lightbox.style.transform = 'scale(1,1)';

	changedHtml();
}

function historyPush(request, get = '', replace = false, state = {}) {
	state.request = request.join('/');

	if (replace) {
		if (history.replaceState)
			history.replaceState(state, '', adminPrefix + request.join('/') + '?' + get);
	} else {
		if (history.pushState)
			history.pushState(state, '', adminPrefix + request.join('/') + '?' + get);
	}
}

async function search(page = 1, sortedBy = null, history_push = true) {
	let request = currentAdminPage.split('/');

	let filters = [];
	let searchValue = '';
	let filtersValues = {};

	document.querySelectorAll('[data-filter]').forEach(el => {
		let v = el.getValue(true);

		filtersValues[el.getAttribute('data-filter') + '-' + el.getAttribute('data-filter-type')] = v;

		if (v === '')
			return;

		if (el.getAttribute('data-filter') === 'zk-all') {
			searchValue = v;
			return;
		}

		filters.push({
			'filter': el.getAttribute('data-filter'),
			'type': el.getAttribute('data-filter-type'),
			'value': v
		});
	});

	sessionStorage.setItem('filters-values', JSON.stringify(filtersValues));

	let payload = {
		'search': searchValue,
		'filters': filters
	};

	if (page === null) {
		payload['per-page'] = 0;
	} else {
		payload['page'] = page;
	}

	let searchFields = await getSearchFieldsFromStorage();
	if (searchFields.length > 0)
		payload['search-fields'] = searchFields;

	_('main-content').innerHTML = `<div class="px-3 no-overflow">
			<div id="results-table-count">
				<div><img src="` + PATH + `model/Output/files/loading.gif" alt="" /></div>
			</div>
			<div id="results-table-pages"></div>
		</div>
		<div id="main-visualizer-cont"></div>`;

	if (sortedBy === null) {
		if (typeof visualizers[request[0]] !== 'undefined')
			sortedBy = visualizers[request[0]].getSorting();
		else
			sortedBy = [];
	}

	let visualizer = new (visualizerClasses.get(currentPageDetails['type']))(request[0], _('main-visualizer-cont'), true, currentPageDetails);
	visualizers.set(request[0], visualizer);

	visualizer.setSorting(sortedBy);
	payload['sort-by'] = sortedBy;

	let columns = await visualizer.getFieldsToRetrieve();
	if (columns !== null)
		payload['fields'] = columns;

	if (history_push) {
		let get;
		if (page === null) {
			get = 'nopag=1';
		} else {
			get = 'p=' + page;
		}

		let replace = (typeof history_push === 'string' && history_push === 'replace');
		historyPush(request, get, replace, {
			'filters': filtersValues,
			'p': page,
			'sort-by': sortedBy
		});
	}

	currentPage = page;

	return adminApiRequest('page/' + request[0] + '/search', payload).then(response => {
		_('results-table-pages').innerHTML = getPaginationHtml(response.pages, response.current);

		_('breadcrumbs').removeClass('d-none');
		_('breadcrumbs').innerHTML = '';

		let breadcrumbs = getBreadcrumbs(request[0]);
		breadcrumbs.forEach((link, idx) => {
			if (idx !== 0)
				_('breadcrumbs').appendChild(document.createTextNode(' -> '));
			_('breadcrumbs').appendChild(link);
		});

		_('results-table-count').innerHTML = '<div>' + response.tot + ' risultati presenti</div>';
		if (typeof payload['per-page'] !== 'undefined' && payload['per-page'] === 0) {
			_('results-table-count').innerHTML += '<span class="nowrap">[<a href="?p=1" onclick="goToPage(1); return false"> ritorna alla paginazione </a>]</span>';
		} else {
			_('results-table-count').innerHTML += '<span class="nowrap">[<a href="?nopag=1" onclick="if(confirm(\'Caricare tutti i risultati in una sola pagina potrebbe causare problemi di performance con tabelle molto grosse, confermi?\')) allInOnePage(); return false"> tutti su una pagina </a>]</span>';
		}

		return visualizer.render(response.list, response.totals).then(() => {
			_('main-loading').addClass('d-none');
			return changedHtml();
		});
	}).catch(error => alert(error));
}

function getPaginationHtml(tot_pages, current) {
	let start = current - 9;
	if (start < 1)
		start = 1;
	let end = current + 9;
	if (end > tot_pages)
		end = tot_pages;

	let pages = [];

	if (current > 1) {
		pages.push({'text': 'Inizio', 'p': 1, 'current': false, 'special': true});
		pages.push({'text': '&lt;', 'p': current - 1, 'current': false, 'special': true});
	}

	for (let p = start; p <= end; p++) {
		pages.push({'text': p, 'p': p, 'current': p === current, 'special': false});
	}

	if (current < tot_pages) {
		pages.push({'text': '&gt;', 'p': current + 1, 'current': false, 'special': true});
		pages.push({'text': 'Fine', 'p': tot_pages, 'current': false, 'special': true});
	}

	if (pages.length === 1)
		return '';

	let html = [];
	pages.forEach(p => {
		if (p.current) {
			html.push('<span class="zkpag-on">' + p.text + '</span>');
		} else {
			let className = 'zkpag-off';
			if (p.special)
				className = 'zkpag-special';

			html.push('<a href="?p=' + p.p + '" onclick="goToPage(' + p.p + '); return false" class="' + className + '">' + p.text + '</a>');
		}
	});

	return html.join(' ');
}

function getBreadcrumbs(page) {
	let breadcrumbsRoot = document.createElement('a');
	breadcrumbsRoot.setAttribute('href', adminPrefix);
	breadcrumbsRoot.addEventListener('click', function (event) {
		event.preventDefault();
		loadAdminPage('');
		return false;
	});
	breadcrumbsRoot.innerHTML = 'Home';

	let defaultBreadcrumbs = [breadcrumbsRoot];
	let breadcrumbs = searchPageForBreadcrumbs(page, mainMenu, defaultBreadcrumbs);
	return breadcrumbs ? breadcrumbs : defaultBreadcrumbs;
}

function searchPageForBreadcrumbs(page, pages, breadcrumbs, parentIdx) {
	let found = false;
	pages.some((menuPage, idx) => {
		let fullIdx = typeof parentIdx === 'undefined' ? idx : parentIdx + '-' + idx;
		let pageData = getLinkFromPage(menuPage, fullIdx);

		let a = document.createElement('a');
		a.innerHTML = menuPage.name;
		a.setAttribute('href', pageData.link);
		if (pageData.click)
			a.addEventListener('click', pageData.click);

		let temp = [...breadcrumbs];
		temp.push(a);

		if (menuPage.path === page) {
			found = temp;
			return true;
		} else {
			if (menuPage.sub.length > 0) {
				found = searchPageForBreadcrumbs(page, menuPage.sub, temp, fullIdx);
				if (found)
					return true;
			}
		}
		return false;
	});

	if (found)
		return found;
	else
		return false;
}

function filtersReset() {
	let promises = [];
	document.querySelectorAll('[data-filter]').forEach(function (el) {
		promises.push(el.setValue(el.dataset.default, false));
	});
	return Promise.all(promises).then(search);
}

function manageFilters() {
	if (typeof currentPageDetails.filters === 'undefined')
		return;

	let fieldset = document.createElement('fieldset');
	fieldset.className = 'p-3';
	fieldset.style.width = '1000px';

	fieldset.innerHTML = `<form action="#" method="post" id="pick-filters-form" onsubmit="saveFilters(); return false">
			<h2>Seleziona i filtri:</h2>
			<div class="py-1 text-center">
				<input type="submit" value="Salva preferenza" class="btn btn-primary"/>
				<input type="button" value="Ripristina default" class="btn btn-danger" onclick="if(confirm('Questo reimposterà i filtri al loro stato iniziale, sicuro?')) filtersLayoutReset()"/>
			</div>
			<div class="container-fluid py-2" id="pick-filters-cont"></div>
			<div class="py-1 text-center">
				<input type="submit" value="Salva preferenza" class="btn btn-primary"/>
				<input type="button" value="Ripristina default" class="btn btn-danger" onclick="if(confirm('Questo reimposterà i filtri al loro stato iniziale, sicuro?')) filtersLayoutReset()"/>
			</div>
		</form>`;

	let cont = fieldset.querySelector('#pick-filters-cont');

	Object.keys(currentPageDetails.filters).forEach(name => {
		let filter = currentPageDetails.filters[name];

		let row = document.createElement('div');
		row.className = 'row';

		let label = document.createElement('div');
		label.className = 'col-3 align-self-center';
		label.innerHTML = filter.label;
		row.appendChild(label);

		let selection = document.createElement('div');
		selection.className = 'col-6 align-self-center';
		selection = row.appendChild(selection);

		appendRadioToFiltersSelection(selection, 'type', name, '', 'No', true);
		appendRadioToFiltersSelection(selection, 'type', name, '=', 'S&igrave;');

		switch (filter.type) {
			case 'number':
				appendRadioToFiltersSelection(selection, 'type', name, '<', '&lt;');
				appendRadioToFiltersSelection(selection, 'type', name, '<=', '&lt;=');
				appendRadioToFiltersSelection(selection, 'type', name, '>', '&gt;');
				appendRadioToFiltersSelection(selection, 'type', name, '>=', '&gt;=');
				break;
			case 'text':
				if (name !== 'zk-all') {
					appendRadioToFiltersSelection(selection, 'type', name, 'begins', 'Inizia con...');
					appendRadioToFiltersSelection(selection, 'type', name, 'contains', 'Contiene...');
				}
				break;
		}

		if (name !== 'zk-all' && filter.type !== 'select') {
			appendRadioToFiltersSelection(selection, 'type', name, '!=', 'Diverso da');
			appendRadioToFiltersSelection(selection, 'type', name, 'empty', 'Vuoto');
		}

		let position = document.createElement('div');
		position.className = 'col-3 align-self-center';
		position = row.appendChild(position);

		appendRadioToFiltersSelection(position, 'form', name, 'primary', 'Primario');
		appendRadioToFiltersSelection(position, 'form', name, 'secondary', 'Secondario', true);

		cont.appendChild(row);
	});

	Promise.all([
		zkPopup('<img src="' + PATH + 'model/Output/files/loading.gif" alt="" />'),
		getFiltersListFromStorage()
	]).then(data => {
		let filters = data[1];
		zkPopup(fieldset.outerHTML).then(() => {
			Object.keys(filters).forEach(form => {
				filters[form].forEach(filter => {
					let typeRadio = _('filter-' + filter.filter + '-type-' + filter.type);
					if (typeRadio)
						typeRadio.checked = true;

					let positionRadio = _('filter-' + filter.filter + '-form-' + form);
					if (positionRadio)
						positionRadio.checked = true;
				});
			});
		});
	});
}

function appendRadioToFiltersSelection(selection, type, name, value, label, checked = false) {
	let radio = document.createElement('input');
	radio.setAttribute('type', 'radio');
	radio.setAttribute('name', name + '-' + type);
	radio.setAttribute('data-manage-filter-' + type, name);
	radio.setAttribute('id', 'filter-' + name + '-' + type + '-' + value);
	radio.setAttribute('value', value);
	radio = selection.appendChild(radio);
	if (checked)
		radio.setAttribute('checked', '');

	let labelNode = document.createElement('label');
	labelNode.setAttribute('for', 'filter-' + name + '-' + type + '-' + value);
	labelNode.innerHTML = label;
	selection.appendChild(labelNode);
}

async function saveFilters() {
	let request = currentAdminPage.split('/');

	let filters = {
		'primary': [],
		'secondary': []
	};
	document.querySelectorAll('[data-manage-filter-type]').forEach(radio => {
		if (radio.checked && radio.value !== '') {
			let name = radio.getAttribute('data-manage-filter-type');

			let position = 'secondary';
			if (_('filter-' + name + '-form-primary').checked)
				position = 'primary';

			filters[position].push({
				'filter': name,
				'type': radio.value
			});
		}
	});

	_('popup-real').loading();
	await saveUserCustomization('filters-' + request[0], filters);
	zkPopupClose();
	await rebuildFilters();
	return search();
}

async function filtersLayoutReset() {
	let request = currentAdminPage.split('/');
	_('popup-real').loading();
	zkPopupClose();
	await deleteUserCustomization('filters-' + request[0]);
	await rebuildFilters();
	return search();
}

async function getSearchFieldsFromStorage() {
	let request = currentAdminPage.split('/');
	let fields = await getUserCustomization('search-fields-' + request[0]);
	return fields ? fields : [];
}

async function manageSearchFields() {
	if (typeof currentPageDetails.filters === 'undefined')
		return;

	let fieldset = document.createElement('fieldset');
	fieldset.className = 'p-3';

	fieldset.innerHTML = `<form action="?" method="post" id="pick-search-fields-form" onsubmit="saveSearchFields(); return false">
			<h2>Cerca nei seguenti campi:</h2>
			<div class="py-1 text-center">
				<input type="submit" value="Salva preferenza" class="btn btn-primary"/>
			</div>
			<div class="container-fluid py-2" id="pick-search-fields-cont"></div>
			<div class="py-1 text-center">
				<input type="submit" value="Salva preferenza" class="btn btn-primary"/>
			</div>
		</form>`;

	let cont = fieldset.querySelector('#pick-search-fields-cont');

	let currentSearchFields = await getSearchFieldsFromStorage();

	Object.keys(currentPageDetails.filters).forEach(name => {
		let filter = currentPageDetails.filters[name];
		if (name === 'zk-all' || (filter.type !== 'text' && filter.type !== 'number'))
			return;

		let row = document.createElement('div');
		row.className = 'row';

		let col = document.createElement('div');
		col.className = 'col-12';
		col = row.appendChild(col);

		let checkbox = document.createElement('input');
		checkbox.setAttribute('type', 'checkbox');
		checkbox.setAttribute('name', name);
		checkbox.setAttribute('data-managesearchfields', name);
		checkbox.setAttribute('id', 'search-field-' + name);
		checkbox = col.appendChild(checkbox);
		if (currentSearchFields.length === 0 || currentSearchFields.indexOf(name) !== -1)
			checkbox.setAttribute('checked', '');

		let labelNode = document.createElement('label');
		labelNode.setAttribute('for', 'search-field-' + name);
		labelNode.innerHTML = filter.label;
		col.appendChild(labelNode);

		cont.appendChild(row);
	});

	zkPopup(fieldset.outerHTML);
}

async function saveSearchFields() {
	let request = currentAdminPage.split('/');

	let fields = [];
	document.querySelectorAll('[data-managesearchfields]').forEach(function (check) {
		if (check.checked)
			fields.push(check.getAttribute('data-managesearchfields'));
	});

	await saveUserCustomization('search-fields-' + request[0], fields);
	zkPopupClose();
	return search();
}

function adminRowClicked(row) {
	if (row.dataset.onclick) {
		eval('var custom_function = function(){ ' + row.dataset.onclick + ' }');
		custom_function.call(row);
	} else {
		loadAdminElement(row.dataset.id);
	}
}

function adminRowDragged(id, elementIdx, targetIdx) {
	if (elementIdx !== targetIdx) {
		showLoadingMask();

		return adminApiRequest('page/' + currentAdminPage.split('/')[0] + '/change-order/' + id, {to: targetIdx}).then(r => {
			if (!r.success)
				throw 'Errore durante il cambio di ordine';
		}).catch(error => {
			alert(error);
			reloadList();
		}).finally(() => {
			hideLoadingMask();
		});
	}
}

function loadAdminElement(id, get = {}, history_push = true) {
	elementCallback = null;
	dataCache = {'data': {}, 'children': []};

	let request = currentAdminPage.split('/');

	let templatePromise = loadAdminPage(request[0] + '/edit/' + id, get, history_push, false).then(showLoadingMask);
	let dataPromise = loadElementData(request[0], id || 0);

	return Promise.all([templatePromise, dataPromise]).then(responses => {
		return checkSubPages().then(async () => {
			hideLoadingMask();

			// Check privilegi
			if (currentPageDetails.privileges.C) {
				addPageAction('new', {
					'fa-icon': 'far fa-plus-square',
					'text': 'Nuovo',
					'action': 'newElement()',
				});
			}

			if (id === 0) {
				if (currentPageDetails.privileges.C) {
					addPageAction('save', {
						'fa-icon': 'far fa-save',
						'text': 'Salva',
						'action': 'save()',
					});
				}

				addPageAction('list', {
					'fa-icon': 'fas fa-list',
					'text': 'Elenco',
					'action': 'loadAdminPage(' + JSON.stringify(request[0]) + ')',
				});
			} else {
				if (responses[1].privileges.U) {
					addPageAction('save', {
						'fa-icon': 'far fa-save',
						'text': 'Salva',
						'action': 'save()',
					});
				}

				addPageAction('list', {
					'fa-icon': 'fas fa-list',
					'text': 'Elenco',
					'action': 'loadAdminPage(' + JSON.stringify(request[0]) + ')',
				});

				if (currentPageDetails.privileges.C) {
					addPageAction('duplicate', {
						'fa-icon': 'far fa-clone',
						'text': 'Duplica',
						'action': 'duplicate()',
					});
				}

				if (responses[1].privileges.D) {
					addPageAction('delete', {
						'fa-icon': 'far fa-trash-alt',
						'text': 'Elimina',
						'action': 'deleteRows(' + JSON.stringify([id]) + ')',
					});
				}
			}

			// Tasti azione custom
			Object.keys(responses[1].actions).forEach(action => {
				addPageAction(action, responses[1].actions[action]);
			});

			let form = new FormManager('main');
			pageForms.set('main', form);
			return form.build(_('main-content'), responses[1]);
		});
	}).then(callElementCallback).then(() => {
		if (!_('adminForm'))
			return false;

		Array.from(_('adminForm').elements).some(field => {
			if (field.offsetParent !== null && field.type.toLowerCase() !== 'hidden' && field.name !== 'fakeusernameremembered' && field.name !== 'fakepasswordremembered') {
				field.focus();
				if (field.select)
					field.select();
				return true;
			}
			return false;
		});
	}).catch(reportAdminError);
}

function loadElementData(page, id) {
	return adminApiRequest('page/' + page + '/data/' + id);
}

function fillAdminForm(data, form = null) { // TODO: probabilmente obsoleto
	if (typeof data === 'undefined') {
		data = dataCache;
	} else if (form === null) { // Solo per il form principale se sono nel dettaglio
		dataCache = data;
	}

	if (form === null)
		form = _('adminForm');

	if (!form)
		throw 'Can\'t find form to fill';

	if (!data.data)
		data.data = {};

	return form.fill(data.data, false, 'filled').then(() => {
		let promises = [];

		if (data.children) {
			for (let name in data.children) {
				if (!data.children.hasOwnProperty(name))
					continue;

				let primary = data.children[name].primary;
				let list = data.children[name].list;

				for (let idx in list) {
					if (!list.hasOwnProperty(idx))
						continue;

					let id = list[idx][primary];

					promises.push(sublistAddRow(name, id, false).then(((el, id, name) => {
						return () => {
							let promises = [];

							for (let k in el) {
								if (!el.hasOwnProperty(k))
									continue;

								let form_k = 'ch-' + k + '-' + name + '-' + id;

								let column_cont = _('#cont-ch-' + name + '-' + id + ' [data-custom="' + k + '"]');
								if (column_cont)
									column_cont.innerHTML = el[k];

								if (el[k] !== null && typeof el[k] === 'object' && typeof el[k]['text'] === 'undefined') { // If it is an object, and has not "text" (hence, it's not an instant search) then it's a multilang field
									for (let lang in el[k]) {
										if (typeof form[form_k + '-' + lang] !== 'undefined') {
											promises.push(form[form_k + '-' + lang].setValue(el[k][lang], false).then((field => {
												return () => field.setAttribute('data-filled', '1');
											})(form[form_k + '-' + lang])));
										}
									}
								} else {
									if (typeof form[form_k] !== 'undefined') {
										promises.push(form[form_k].setValue(el[k], false).then((field => {
											return () => field.setAttribute('data-filled', '1');
										})(form[form_k])));
									}
								}
							}

							return Promise.all(promises);
						};
					})(list[idx], id, name)));
				}
			}
		}

		form.dataset.filled = '1';

		return Promise.all(promises);
	});
}

function switchHistoryBox() {
	var div = _('history-box');
	if (div.style.right === '0px') {
		div.style.right = '-15%';
	} else {
		div.style.right = '0px';
	}
}

function wipeForms() {
	pageForms.clear();
	historyMgr.wipe();
}

function newElement(get = {}) {
	return loadAdminElement(0, get);
}

function toolbarButtonLoading(button) {
	let img = _('#toolbar-button-' + button + ' img');
	if (!img)
		img = _('#toolbar-button-custom-' + button + ' img');
	if (img) {
		img.setAttribute('data-old-path', img.src);
		img.src = PATHBASE + 'model/Output/files/loading.gif';
	}

	let icon = _('#toolbar-button-' + button + ' i');
	if (!icon)
		icon = _('#toolbar-button-custom-' + button + ' i');
	if (icon) {
		icon.setAttribute('data-old-class', icon.className);
		icon.className = 'fas fa-spinner';
	}
}

function toolbarButtonRestore(button) {
	let img = _('#toolbar-button-' + button + ' img');
	if (!img)
		img = _('#toolbar-button-custom-' + button + ' img');
	if (img)
		img.src = img.getAttribute('data-old-path');

	let icon = _('#toolbar-button-' + button + ' i');
	if (!icon)
		icon = _('#toolbar-button-custom-' + button + ' i');
	if (icon)
		icon.className = icon.getAttribute('data-old-class');
}

async function save() {
	let formNode = _('adminForm');

	let required = [];
	for (let formName of pageForms.keys()) {
		let currentRequired = pageForms.get(formName).getRequired();
		required = required.concat(currentRequired);
	}

	if (!checkForm(formNode, required))
		return false;

	if (saving) {
		alert('Already saving');
		return false;
	}

	saving = true;
	toolbarButtonLoading('save');
	resize();

	setLoadingBar(0);

	return new Promise(function (resolve) {
		setTimeout(function () { // Gives a little bit of time for the fields to activate their "onchange" events
			resolve();
		}, 200);
	}).then(function () {
		let request = currentAdminPage.split('/');
		let id = getIdFromRequest(request);

		let payload = {
			'save': pageForms.get('main').getChangedValues(),
			'version': pageForms.get('main').version,
		};

		/*for (let k in changedValues) {
			if (typeof formNode[k] !== 'undefined' && formNode[k].getAttribute('data-multilang') && typeof payload.save[k] === 'undefined') {
				if (typeof payload.save[formNode[k].getAttribute('data-multilang')] === 'undefined')
					payload.save[formNode[k].getAttribute('data-multilang')] = {};
				payload.save[formNode[k].getAttribute('data-multilang')][formNode[k].getAttribute('data-lang')] = changedValues[k];
			} else {
				payload.save[k] = changedValues[k];
			}
		}*/

		if (Object.keys(payload.save).length === 0)
			throw 'Nessun dato modificato';

		return adminApiRequest('page/' + request[0] + '/save/' + id, payload, {
			/*'onprogress': function (event) { // TODO: al momento non supportato in fetch
				let percentage;
				if (event.total === 0) {
					percentage = 0;
				} else {
					percentage = Math.round(event.loaded / event.total * 100);
				}

				setLoadingBar(percentage);
			}*/
		}).then(response => {
			if (!response.id)
				throw 'Risposta server errata';

			wipeForms();
			saving = false;

			return loadAdminElement(response.id, {}, id === 0).then(() => {
				inPageMessage('Salvataggio correttamente effettuato.', 'success');
				return response.id;
			});
		});
	}).catch(error => {
		alert(error);
	}).finally(() => {
		setLoadingBar(0);

		saving = false;
		toolbarButtonRestore('save');
	});
}

function inPageMessage(text, className) {
	let div = document.createElement('div');
	div.className = 'alert alert-' + className + ' alert-dismissible fade show';
	div.setAttribute('role', 'alert');
	div.innerHTML = text + '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>';
	_('main-content').insertBefore(div, _('main-content').firstChild);
}

function setLoadingBar(percentage) {
	_('main-loading-bar').style.width = percentage + '%';
}

function duplicate() {
	if (historyMgr.changeHistory.length > 0) {
		alert('There are pending changes, can\'t duplicate.');
		return false;
	}

	if (!confirm('Stai per duplicare questo elemento, sei sicuro?'))
		return false;

	toolbarButtonLoading('duplicate');

	let request = currentAdminPage.split('/');
	return adminApiRequest('page/' + request[0] + '/duplicate/' + request[2], {method: 'POST'}).then(r => {
		if (r.id) {
			window.open(adminPrefix + request[0] + '/edit/' + r.id);
		} else {
			throw 'Errore sconosciuto';
		}
	}).catch(error => {
		alert(error);
	}).finally(() => {
		toolbarButtonRestore('duplicate');
	});
}

async function checkSubPages() {
	// TODO: vecchio codice, sistemare se mai servirà di nuovo
	return;
	let promises = [];

	let containers = document.querySelectorAll('[data-tabs]');
	containers.forEach(tabsCont => {
		let cont = document.querySelector('[data-subpages="' + tabsCont.getAttribute('data-name') + '"]');
		let tabs = tabsCont.querySelectorAll('[data-tab]');
		tabs.forEach(tab => {
			if (cont) {
				let page = cont.querySelector('[data-subpage="' + tab.getAttribute('data-tab') + '"]');
				if (!page) {
					let subPageCont = document.createElement('div');
					subPageCont.setAttribute('data-subpage', tab.getAttribute('data-tab'));
					subPageCont.innerHTML = '[to-be-loaded]';
					cont.appendChild(subPageCont);
				}
			}

			if (tab.getAttribute('data-oninit')) {
				(() => {
					eval(this.getAttribute('data-oninit'));
				}).call(tab);
			}

			tab.addEventListener('click', event => {
				loadSubPage(tab.parentNode.getAttribute('data-name'), tab.getAttribute('data-tab'));

				if (tab.getAttribute('data-onclick')) {
					eval(tab.getAttribute('data-onclick'));
				}

				return false;
			});
		});

		let def = null;
		if (sessionStorage.getItem(tabsCont.getAttribute('data-tabs'))) {
			def = sessionStorage.getItem(tabsCont.getAttribute('data-tabs'));
		} else if (tabsCont.getAttribute('data-default')) {
			def = tabsCont.getAttribute('data-default');
		} else {
			def = tabsCont.querySelector('[data-tab]');
			if (def)
				def = def.getAttribute('data-tab');
		}

		if (def) {
			promises.push(new Promise(resolve => {
				loadSubPage(tabsCont.getAttribute('data-name'), def).then(resolve);
			}));
		}
	});

	return Promise.all(promises);
}

function switchAdminTab(cont_name, p) {
	let tabsCont = document.querySelector('[data-tabs][data-name="' + cont_name + '"]');
	sessionStorage.setItem(tabsCont.getAttribute('data-tabs'), p);

	tabsCont.querySelectorAll('[data-tab]').forEach(el => {
		if (el.getAttribute('data-tab') === p) {
			el.addClass('selected');

			if (el.getAttribute('data-onchange')) {
				(() => {
					eval(this.getAttribute('data-onchange'));
				}).call(el);
			}
		} else {
			if (el.hasClass('selected')) {
				el.removeClass('selected');

				if (el.getAttribute('data-onchange')) {
					(() => {
						eval(this.getAttribute('data-onchange'));
					}).call(el);
				}
			}
		}
	});
}

function loadSubPage(cont_name, p) {
	switchAdminTab(cont_name, p);

	document.querySelectorAll('[data-subpages="' + cont_name + '"] [data-subpage]').forEach(cont => {
		if (cont.getAttribute('data-subpage') === p) {
			cont.style.display = 'block';
		} else {
			cont.style.display = 'none';
		}
	});

	let cont = document.querySelector('[data-subpages="' + cont_name + '"] [data-subpage="' + p + '"]');
	if (cont && cont.innerHTML === '[to-be-loaded]') {
		let request = currentAdminPage.split('/');
		if (request.length === 2)
			request.push(0);

		return cont.loading().ajax(adminPrefix + request.join('/') + '/' + p, 'ajax', '').then(() => {
			return new Promise(resolve => {
				setTimeout(() => {
					resolve(fillAdminForm);
				}, 500);
			});
		}).then(checkSubPages);
	} else {
		return new Promise(resolve => resolve());
	}
}

function callElementCallback() {
	if (elementCallback) {
		elementCallback.call();
		elementCallback = null;
	}
}

function reportAdminError(err) {
	console.log(err);
	alert(err);
}

function showLoadingMask() {
	_('main-loading').addClass('grey');
	_('main-loading').removeClass('d-none');
}

function hideLoadingMask() {
	_('main-loading').removeClass('grey');
	_('main-loading').addClass('d-none');
}

function getAdminCookiePath() {
	if (adminPrefix.substr(-1) === '/') {
		return adminPrefix.substr(0, adminPrefix.length - 1);
	} else {
		return adminPrefix;
	}
}

async function getUserCustomization(k) {
	if (typeof userCustomizationsCache[k] !== 'undefined')
		return userCustomizationsCache[k];

	return ajax(PATH + 'admin/get-user-customization', {
		'k': k
	}, {}, {
		'headers': {
			'X-Access-Token': adminApiToken
		}
	}).then(r => {
		if (typeof r !== 'object')
			throw r;
		if (typeof r.error !== 'undefined')
			throw r.error;
		if (typeof r.data === 'undefined')
			throw 'Unknown error';
		if (r.data === null)
			return null;

		try {
			return JSON.parse(r.data);
		} catch (e) {
			return null;
		}
	}).then(v => {
		userCustomizationsCache[k] = v;
		return v;
	});
}

async function saveUserCustomization(k, v) {
	return new Promise(resolve => {
		let oldValue = null;
		if (typeof userCustomizationsCache[k] !== 'undefined')
			oldValue = userCustomizationsCache[k];

		userCustomizationsCache[k] = v;
		userCustomizationsBuffer[k] = v;

		setTimeout((function (k, v, oldValue, resolve) {
			return function () {
				if (userCustomizationsBuffer[k] !== v)
					return;

				delete userCustomizationsBuffer[k];
				return ajax(PATH + 'admin/save-user-customization', {
					'k': k
				}, {
					'v': JSON.stringify(v),
				}, {
					'headers': {
						'X-Access-Token': adminApiToken
					}
				}).then(r => {
					if (r !== 'ok')
						throw r;
					resolve();
				});
			};
		})(k, v, oldValue, resolve), 300);
	});
}

async function deleteUserCustomization(k) {
	return ajax(PATH + 'admin/delete-user-customization', {
		'k': k
	}, {}, {
		'method': 'POST',
		'headers': {
			'X-Access-Token': adminApiToken
		}
	}).then(r => {
		if (r !== 'ok')
			throw r;

		if (typeof userCustomizationsCache[k] !== 'undefined')
			delete userCustomizationsCache[k];
	});
}

function selectRow(id, enable) {
	id = parseInt(id);
	let k = selectedRows.indexOf(id);
	if (k !== -1) {
		if (!enable)
			selectedRows.splice(k, 1);
	} else {
		if (enable)
			selectedRows.push(id);
	}
}

function checkForCsvExport(sId, rowsNumber) {
	var div = document.querySelector('[data-csvpage][data-csvexecuted="0"]');
	if (div) {
		div.loading();
		ajax(currentAdminPage, {'sId': sId, 'csv': div.getAttribute('data-csvpage')}, {'rows-number': rowsNumber}).then(r => {
			if (typeof r === 'object') {
				div.innerHTML = '[<a href="' + r.link + '" target="_blank"> ' + r.name + ' </a>]';
				div.setAttribute('data-csvexecuted', '1');
				checkForCsvExport(sId, rowsNumber);
			} else {
				div.innerHTML = 'Errore.';
				alert(r);
			}
		});
	}
}

function deleteRows(ids) {
	let usingChecks = false;
	if (typeof ids === 'undefined') {
		ids = selectedRows;
		usingChecks = true;
	}
	if (ids.length === 0) {
		alert('Nessuna riga selezionata');
		return false;
	}

	if (!confirm('Sicuro di voler eliminare ' + ids.length + ' elementi?'))
		return false;

	if (usingChecks) {
		let nChecked = 0;
		_('main-visualizer-cont').querySelectorAll('[id^="row-checkbox-"]').forEach(function (checkbox) {
			if (checkbox.checked)
				nChecked++;
		});

		if (ids.length > nChecked) {
			if (!confirm('ATTENZIONE: ci sono righe selezionate anche in altre pagine, saranno eliminate anche quelle. Continuare?'))
				return false;
		}
	}

	toolbarButtonLoading('delete');

	let request = currentAdminPage.split('/');
	return adminApiRequest('page/' + request[0] + '/delete', {ids}).then(r => {
		if (request.length === 1)
			reloadList();
		else
			loadAdminPage(request[0]);
	}).catch(error => {
		alert(error);
	}).finally(() => {
		toolbarButtonRestore('delete');
	});
}

function reloadList() {
	let request = currentAdminPage.split('/');
	return search(request[0], null, false);
}