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

var pageActions = new Map();

var userCustomizationsCache = {};
var userCustomizationsBuffer = {};

var visualizerClasses = new Map();
var visualizers = new Map();

var dataCache = {'data': {}, 'children': []};

var saving = false;

var pageForms = new Map();
var pageSublists = new Map();

class HistoryManager {
	constructor() {
		this.changeHistory = [];
		this.canceledChanges = [];
	}

	append(form, field, oldValue, newValue, lang = null) {
		this.changeHistory.push({form, field, oldValue, newValue, lang});
		this.canceledChanges = [];
		this.rebuildBox();
	}

	sublistAppend(sublist, action, id) {
		this.changeHistory.push({sublist, action, id});
		this.canceledChanges = [];
		this.rebuildBox();
	}

	async stepBack() {
		if (this.changeHistory.length === 0)
			return false;

		let el = this.changeHistory.pop();
		this.canceledChanges.unshift(el);

		if (typeof el.sublist !== 'undefined') {
			let sublist = pageSublists.get(el.sublist);
			if (sublist) {
				switch (el.action) {
					case 'new':
						sublist.deleteLocalRow(el.id, false);
						break;
					case 'delete':
						sublist.restoreLocalRow(el.id);
						break;
				}
			}
		} else {
			let form = pageForms.get(el.form);
			if (!form)
				return;

			let field = form.fields.get(el.field);
			await field.setValue(el.oldValue, false);

			if (el.lang && field.options.multilang)
				switchFieldLang(field.name, el.lang);

			field.focus(el.lang || null);

			form.changedValues[el.field] = el.oldValue;
		}

		this.rebuildBox();
	}

	async stepForward() {
		if (this.canceledChanges.length === 0)
			return false;

		let el = this.canceledChanges.shift();
		this.changeHistory.push(el);

		if (typeof el.sublist !== 'undefined') {
			let sublist = pageSublists.get(el.sublist);
			if (sublist) {
				switch (el.action) {
					case 'new':
						sublist.restoreLocalRow(el.id);
						break;
					case 'delete':
						sublist.deleteLocalRow(el.id, false);
						break;
				}
			}
		} else {
			let form = pageForms.get(el.form);
			if (!form)
				return;

			let field = form.fields.get(el.field);
			await field.setValue(el.newValue, false);

			if (el.lang && field.options.multilang)
				switchFieldLang(field.name, el.lang);

			field.focus(el.lang || null);

			form.changedValues[el.field] = el.newValue;
		}

		this.rebuildBox();
	}

	async goToStep(t, i) {
		switch (t) {
			case 'reset':
				while (this.changeHistory.length > 0)
					await this.stepBack();
				break;
			case 'back':
				while (this.changeHistory.length > i + 1)
					await this.stepBack();
				break;
			case 'forward':
				if (i + 1 > this.canceledChanges)
					return;
				for (let c = 1; c <= i + 1; c++)
					await this.stepForward();
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
						a.textContent = 'new row in "' + i.sublist + '"';
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
						a.textContent = 'new row in "' + i.sublist + '"';
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
		field.historyDefaultValue = await field.getValue();

		field.addEventListener('change', event => {
			let old = null;
			if (typeof this.changedValues[field.name] === 'undefined') {
				old = field.historyDefaultValue;
			} else {
				old = this.changedValues[field.name];
			}

			field.getValue().then(v => {
				if (v === old)
					return;

				this.changedValues[field.name] = v;

				historyMgr.append(this.name, field.name, old, v, event.langChanged || null);
			});
		});

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
			fieldCont.appendChild(await field.render());
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

		this.value = this.options.value;
		this.options.type = this.options.type.toLowerCase();

		this.listeners = new Map();
	}

	addEventListener(event, callback) {
		let listeners = this.listeners.get(event);
		if (!listeners)
			listeners = [];
		listeners.push(callback);
		this.listeners.set(event, listeners);
	}

	emit(eventName, event = null) {
		let listeners = this.listeners.get(eventName);
		if (!listeners)
			return;

		for (let listener of listeners)
			listener.call(this, event);
	}

	async setValue(v, trigger = true) {
		this.value = v;

		let node = await this.getNode();
		if (this.options.multilang) {
			for (let lang of this.options.multilang) {
				if (node.hasOwnProperty(lang) && v.hasOwnProperty(lang))
					await node[lang].setValue(v[lang], trigger);
			}
		} else {
			await node.setValue(v, trigger);
		}

		if (trigger)
			this.emit('change');
	}

	async getValue() {
		if (this.value === null || typeof this.value !== 'object')
			return this.value;
		else
			return {...this.value};
	}

	focus(lang = null) {
		this.getNode().then(obj => {
			let node;
			if (this.options.multilang) {
				if (lang === null)
					lang = this.options.multilang[0];
				node = obj[lang];
			} else {
				node = obj;
			}

			node.focus();
			if (node.select)
				node.select();
		});
	}

	getSingleNode(lang = null) {
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
		}

		for (let eventName of ['keyup', 'keydown', 'click', 'change', 'input']) {
			node.addEventListener(eventName, async event => {
				if (eventName === 'change') {
					await node.getValue().then(v => {
						if (this.options.multilang) {
							event.langChanged = lang;
							if (this.value === null || typeof this.value !== 'object')
								this.value = {};

							this.value[lang] = v;
						} else {
							this.value = v;
						}
					});
				}

				this.emit(eventName, event);
			});
		}

		return node;
	}

	async getNode() {
		if (this.node === null) {
			if (this.options.multilang) {
				this.node = {};
				for (let lang of this.options.multilang)
					this.node[lang] = this.getSingleNode(lang);
			} else {
				this.node = this.getSingleNode();
			}

			await this.setValue(this.value, false);
		}

		return this.node;
	}

	async render() {
		let node = await this.getNode();

		if (this.options.multilang) {
			let cont = document.createElement('div');
			cont.className = 'multilang-field-container';
			cont.setAttribute('data-name', this.name);

			let firstLang = true;
			for (let lang of this.options.multilang) {
				let langCont = document.createElement('div');
				langCont.setAttribute('data-lang', lang);
				langCont.appendChild(node[lang]);

				if (firstLang) {
					firstLang = false;
				} else {
					langCont.style.display = 'none';
				}

				cont.appendChild(langCont);
			}

			let defaultLang = this.options.multilang[0];

			let flagsCont = document.createElement('div');
			flagsCont.className = 'multilang-field-lang-container';

			let mainFlag = document.createElement('a');
			mainFlag.href = '#';
			mainFlag.setAttribute('data-lang', defaultLang);
			mainFlag.addEventListener('click', event => {
				event.preventDefault();
				switchFieldLang(this.name, defaultLang);
			});
			mainFlag.innerHTML = `<img src="${PATH}model/Form/assets/img/langs/${defaultLang}.png" alt="${defaultLang}"/>`;
			flagsCont.appendChild(mainFlag);

			let otherFlagsCont = document.createElement('div');
			otherFlagsCont.className = 'multilang-field-other-langs-container';
			for (let lang of this.options.multilang) {
				if (lang === defaultLang)
					continue;

				let flag = document.createElement('a');
				flag.href = '#';
				flag.setAttribute('data-lang', lang);
				flag.addEventListener('click', event => {
					event.preventDefault();
					switchFieldLang(this.name, lang);
				});
				flag.innerHTML = `<img src="${PATH}model/Form/assets/img/langs/${lang}.png" alt="${lang}"/>`;
				otherFlagsCont.appendChild(flag);
			}
			flagsCont.appendChild(otherFlagsCont);

			cont.appendChild(flagsCont);

			return cont;
		} else {
			return node;
		}
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

	return ajax(adminApiPath + request, {c_id}, payload, {
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
		pageActions.clear();

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
			// TODO: tasto print, export csv, tasto url pubblico

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

					// ==== Preload visualizer files ====

					loadingPromises.push(loadVisualizer(currentPageDetails.type));
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

						hideBreadcrumbs();

						return loadPage(adminPrefix + 'template/' + request.join('/'), {ajax: 1});
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

	for (let formName of Object.keys(filters)) {
		for (let filter of filters[formName]) {
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

			switch (filter.options.type) {
				case 'checkbox':
				case 'radio':
				case 'hidden':
				case 'date':
				case 'select':
					filter.addEventListener('change', function () {
						search();
					});
					break;
				default:
					filter.addEventListener('keyup', function (event) {
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

			div.appendChild(await filter.render());
			forms[formName].firstChild.appendChild(div);
		}
	}

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
	let button = pageActions.get(name);
	let isNew = false;
	if (!button) {
		button = document.createElement('a');
		button.className = 'toolbar-button';
		pageActions.set(name, button);
		isNew = true;
	}

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

	if (isNew) {
		let toolbar = _('toolbar');
		let topForm = toolbar.querySelector('#topForm');
		if (topForm)
			toolbar.insertBefore(button, topForm);
		else
			toolbar.appendChild(button);
	}
}

function removePageAction(name) {
	let button = pageActions.get(name);
	if (button) {
		button.remove();
		pageActions.delete(name);
	}
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
		let visualizer = visualizers.get(request[0]);
		if (visualizer)
			sortedBy = visualizer.getSorting();
		else
			sortedBy = [];
	}

	let visualizer = await loadVisualizer(currentPageDetails['type'], request[0], _('main-visualizer-cont'), true, currentPageDetails);
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

		buildBreadcrumbs();

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

function buildBreadcrumbs() {
	_('breadcrumbs').innerHTML = '';
	_('breadcrumbs').removeClass('d-none');

	let request = currentAdminPage.split('/');

	let breadcrumbs = getBreadcrumbs(request[0]);
	breadcrumbs.forEach((link, idx) => {
		if (idx !== 0)
			_('breadcrumbs').appendChild(document.createTextNode(' -> '));
		_('breadcrumbs').appendChild(link);
	});
}

function hideBreadcrumbs() {
	_('breadcrumbs').innerHTML = '';
	_('breadcrumbs').addClass('d-none');
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
			reloadMainList();
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

	return Promise.all([templatePromise, dataPromise]).then(async responses => {
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

		let mainContent = _('main-content');

		let form = new FormManager('main');
		pageForms.set('main', form);
		await form.build(mainContent, responses[1]);

		let sublistsPromises = [];

		for (let sublist of responses[1].sublists) {
			let sublistCont = mainContent.querySelector('[data-sublistplaceholder="' + sublist.name + '"]');
			if (!sublistCont)
				continue;

			sublistsPromises.push(new Promise(async (resolve, reject) => {
				try {
					if (sublist.name === request[0])
						throw 'You cannot a sublist like the main page';

					let visualizer = await loadVisualizer(sublist.visualizer, sublist.name, sublistCont, false, {
						"fields": sublist.fields,
						"privileges": sublist.privileges,
						"visualizer-options": sublist['visualizer-options'],
					});

					pageSublists.set(sublist.name, visualizer);

					await visualizer.render(sublist.list);

					resolve();
				} catch (e) {
					reject(e);
				}
			}));
		}

		await Promise.all(sublistsPromises);

		for (let warning of responses[1].warnings)
			inPageMessage(warning, 'warning');

		buildBreadcrumbs();
		hideLoadingMask();
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
	pageSublists.clear();
	historyMgr.wipe();
}

function newElement(get = {}) {
	return loadAdminElement(0, get);
}

function toolbarButtonLoading(name) {
	let button = pageActions.get(name);
	if (!button)
		return;

	let img = button.querySelector('img');
	if (img) {
		img.setAttribute('data-old-path', img.src);
		img.src = PATHBASE + 'model/Output/files/loading.gif';
	}

	let icon = button.querySelector('i');
	if (icon) {
		icon.setAttribute('data-old-class', icon.className);
		icon.className = 'fas fa-spinner';
	}
}

function toolbarButtonRestore(name) {
	let button = pageActions.get(name);
	if (!button)
		return;

	let img = button.querySelector('img');
	if (img && img.hasAttribute('data-old-path'))
		img.src = img.getAttribute('data-old-path');

	let icon = button.querySelector('i');
	if (icon && icon.hasAttribute('data-old-class'))
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
			'data': pageForms.get('main').getChangedValues(),
			'version': pageForms.get('main').version,
			'sublists': {}
		};

		for (let k of pageSublists.keys()) {
			let sublist = pageSublists.get(k);
			let sublistChanges = sublist.getSave();
			if (sublistChanges.create.length || Object.keys(sublistChanges.update).length || sublistChanges.delete.length)
				payload.sublists[k] = sublistChanges;
		}

		if (Object.keys(payload.data).length === 0 && Object.keys(payload.sublists).length === 0)
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

function callElementCallback() {
	if (elementCallback) {
		elementCallback.call();
		elementCallback = null;
	}
}

function reportAdminError(err) {
	console.error(err);
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
			reloadMainList();
		else
			loadAdminPage(request[0]);
	}).catch(error => {
		alert(error);
	}).finally(() => {
		toolbarButtonRestore('delete');
	});
}

async function reloadMainList() {
	return search(1, null, false);
}

function getMainVisualizer() {
	return visualizers.get(currentAdminPage.split('/')[0]);
}

async function loadVisualizer(visualizerName, visualizerId, container, main, options) {
	loadRuntimeCss(PATH + 'model/AdminFront/assets/visualizers/' + visualizerName + '.css');
	await loadRuntimeJs(PATH + 'model/AdminFront/assets/visualizers/' + visualizerName + '.js');

	if (!visualizerId)
		return;

	let visualizerClass = visualizerClasses.get(visualizerName);
	if (!visualizerClass) {
		console.error('Visualizer ' + visualizerName + ' does not exist');
		return null;
	}

	return new (visualizerClass)(visualizerId, container, main, options);
}