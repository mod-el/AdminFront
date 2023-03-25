var mainMenu = null;
var firstLoad = true;
var currentAdminPage = false;
var currentPageDetails = {};
var runtimeLoadedJs = new Map();
var runtimeLoadedCss = [];
var currentPage = 1;
var searchCounter = 0;
var pageLoadingHash = '';
var adminApiToken = null;

var cachedPages = new Map();

var pageActions = new Map();

var userCustomizationsCache = {};
var userCustomizationsBuffer = {};

var adminFilters = {};

var visualizerClasses = new Map();
var visualizers = new Map();

var dataCache = {'data': {}, 'children': []};

var saving = false;

var pageForms = new Map();
var pageSublists = new Map();

const PAYLOAD_MAX_SIZE = 524288; // Must be a multiple of 4

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
						await sublist.deleteLocalRow(el.id, false);
						break;
					case 'delete':
						await sublist.restoreLocalRow(el.id);
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
						await sublist.restoreLocalRow(el.id);
						break;
					case 'delete':
						await sublist.deleteLocalRow(el.id, false);
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

		loadAdminPage(currentAdminPage, objectFromQueryString(), 'replace', true);

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
	}).catch(err => reportAdminError(err));
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
		path: adminPath,
		username,
		password
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

	setInterval(() => {
		adminApiRequest('keep-alive');
	}, 30000);

	if (enableHistoryNavigation) {
		window.addEventListener('keydown', function (event) {
			switch (event.keyCode) {
				case 90: // CTRL+Z
					if (event.ctrlKey) {
						event.preventDefault();
						historyMgr.stepBack();
					}
					break;

				case 89: // CTRL+Y
					if (event.ctrlKey) {
						event.preventDefault();
						historyMgr.stepForward();
					}
					break;
			}
		});
	}
});

// TODO: disattivo temporaneamente sw
/*if ('serviceWorker' in navigator) {
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
}*/

window.onpopstate = function (event) {
	var s = event.state;
	if (typeof s['request'] !== 'undefined') {
		if (s['request'] === currentAdminPage) {
			if (typeof s['filters'] === 'undefined')
				s['filters'] = {};

			fillFiltersValues(s['filters']).then(async () => {
				if (typeof s['p'] !== 'undefined' && s['p'] !== currentPage) {
					if (typeof s['per_page'] !== 'undefined')
						await _('changePerPage').setValue(s['per_page'], false);
					goToPage(s['p'], s['sort_by'], false);
				} else {
					let search_options = {
						sort_by: s['sort_by'],
						history: false
					};
					if (typeof s['per_page'] !== 'undefined')
						search_options.perPage = s['per_page'];
					search(currentPage, search_options);
				}
			});
		} else {
			let request = s['request'].split('/');

			let get = {};
			if (event.target.location.search && event.target.location.search.length > 1)
				get = objectFromQueryString(event.target.location.search.substr(1));

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

	let get = {};
	if (options.get) {
		get = options.get;
		delete options.get;
	}

	return ajax(adminApiPath + request, get, payload, {
		fullResponse: true,
		headers: headers,
		json: true,
		...options
	}).then(response => {
		return response.text().then(text => {
			try {
				let resp = JSON.parse(text);

				return {
					status: response.status,
					body: resp
				};
			} catch (e) {
				return {
					status: response.status,
					body: text
				};
			}
		});
	}).then(response => {
		if (typeof response.body !== 'object')
			throw response.body;

		if (response.status !== 200) {
			if (typeof response.body.error !== 'undefined')
				throw response.body.error;
			else
				throw 'Invalid response from server';
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

/*
 Loads a page using fetch; if specified fills the main div with the content when the response comes; it returns a Promise with the returned content
 */
function loadPage(url, get = {}, post = {}, options = {}) {
	options = {
		...{
			fill_main: true,
			cache: true
		},
		...options
	};

	// Ci sono casi in cui non è possibile cachare il template
	if (currentPageDetails.type === 'Custom' || Object.keys(post).length)
		options.cache = false;

	if (options.fill_main) {
		if (!checkBeforePageChange())
			return false;

		clearMainPage();

		pageLoadingHash = url + JSON.stringify(get) + JSON.stringify(post);
	}

	let cacheKey = url + '?' + queryStringFromObject(get);

	return (new Promise((resolve, reject) => {
		if (options.cache) {
			if (cachedPages.get(cacheKey))
				return resolve(cachedPages.get(cacheKey));
		}

		ajax(url, get, post).then(resolve).catch(reject);
	})).then((function (hash) {
		return function (response) {
			if (options.fill_main && hash !== pageLoadingHash)
				return false;

			if (options.cache)
				cachedPages.set(cacheKey, response);

			if (options.fill_main) {
				_('main-loading').addClass('d-none');
				_('main-content').jsFill(response);

				if (window.resetAllInstantSearches)
					resetAllInstantSearches();

				resize();
				return changedHtml().then(() => {
					return response;
				});
			} else {
				return response;
			}
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

	return new Promise((resolve, reject) => {
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
			}).catch(err => {
				reject(err);
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

		wipePageActions();

		currentAdminPage = request.join('/');

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

					if (loadFullDetails)
						return loadAdminElement(id, get, null, false);
					else
						return loadPage(adminPrefix + 'template/' + request[0], get);
			}
		} else {
			if (sessionStorage.getItem('current-page') !== request[0])
				sessionStorage.removeItem('filters-values');
			sessionStorage.setItem('current-page', request[0]);

			switch (currentPageDetails.type) {
				case 'Custom':
					// ==== Custom actions ====

					if (currentPageDetails.actions) {
						Object.keys(currentPageDetails.actions).forEach(action => {
							if (!currentPageDetails.actions[action])
								return;
							addPageAction(action, currentPageDetails.actions[action]);
						});
					}
					break;
				default:
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

					if (currentPageDetails.export) {
						addPageAction('export', {
							'fa-icon': 'fas fa-download',
							'text': 'Esporta',
							'action': `exportPopup(1)`,
						});
					}

					addPageAction('filters', {
						'fa-icon': 'fab fa-wpforms',
						'text': 'Filtri',
						'action': 'switchFiltersForm(this)',
					});

					// ==== Custom actions ====

					Object.keys(currentPageDetails.actions).forEach(action => {
						if (!currentPageDetails.actions[action])
							return;
						addPageAction(action, currentPageDetails.actions[action]);
					});

					// ==== Build filters ====

					await rebuildFilters();

					// ==== Preload visualizer files ====

					loadingPromises.push(loadVisualizer(currentPageDetails.type));
					break;
			}

			return Promise.all(loadingPromises).then(() => {
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

						get.ajax = 1;
						return loadPage(adminPrefix + 'template/' + request.join('/'), get);
					default:
						let search_options = {history: history_push};

						if (typeof get['perPage'] !== 'undefined') {
							let perPage = parseInt(get['perPage']);
							if (!isNaN(perPage) && perPage >= 0)
								search_options.per_page = perPage;
						}

						if (typeof get['p'] !== 'undefined') {
							currentPage = parseInt(get['p']);
							if (isNaN(currentPage) || currentPage < 1)
								currentPage = 1;
						} else {
							currentPage = 1;
						}

						// ==== First search ====
						return search(currentPage, search_options);
				}
			});
		}
	}).catch(err => {
		reportAdminError(err);
	});
}

function getIdFromRequest(request = null) {
	if (request === null)
		request = currentAdminPage.split('/');

	let id = 0;
	if (typeof request[2] !== 'undefined')
		id = parseInt(request[2]);
	if (isNaN(id))
		throw 'Id non valido';

	return id;
}

function loadRuntimeJs(file) {
	if (!runtimeLoadedJs.get(file)) {
		runtimeLoadedJs.set(file, new Promise(resolve => {
			let fileref = document.createElement('script');
			fileref.setAttribute('type', 'text/javascript');
			document.getElementsByTagName('head')[0].appendChild(fileref);
			fileref.onload = () => {
				resolve();
			};
			fileref.setAttribute('src', file);
		}));
	}

	return runtimeLoadedJs.get(file);
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

	refreshToolbarVisibility();

	form.innerHTML = '<div class="flex-fields"></div>';

	let secondaryForm = _('filtersFormCont');
	secondaryForm.innerHTML = '<div class="flex-fields-wrap"></div>';

	adminFilters = await getFiltersFromPageDetails();

	let forms = {
		'primary': form,
		'secondary': secondaryForm
	};

	for (let formName of Object.keys(adminFilters)) {
		for (let filter of adminFilters[formName]) {
			let div = document.createElement('div');

			let label = '';
			if (typeof filter.options['label'] !== 'undefined') {
				label = filter.options['label'];
				if (filter.options['adminFilter'].type !== '=')
					label += ' (' + filter.options['adminFilter'].type + ')';
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
				case 'instant-search':
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

	let filtersForm = new FormManager('filters');

	let filters = [];

	let idx = 0;
	Object.keys(filtersArrangement).forEach(form => {
		filtersArrangement[form].forEach(filterOptions => {
			if (typeof currentPageDetails['filters'][filterOptions.filter] === 'undefined')
				return;

			let fieldOptions = currentPageDetails['filters'][filterOptions.filter];
			fieldOptions['adminFilter'] = filterOptions;

			let defaultValue = '';
			if (typeof fieldOptions['adminFilter'].default !== 'undefined')
				defaultValue = fieldOptions['adminFilter'].default;
			else if (typeof fieldOptions.default !== 'undefined')
				defaultValue = fieldOptions.default;

			let value = defaultValue;
			if (filtersValues && typeof filtersValues[filterOptions.filter + '-' + filterOptions.type] !== 'undefined')
				value = filtersValues[filterOptions.filter + '-' + filterOptions.type];

			fieldOptions['value'] = value;
			fieldOptions['adminFilter'].default = defaultValue;

			if (filterOptions.type === 'empty') {
				fieldOptions.type = 'select';
				fieldOptions.options = [
					{
						id: 1,
						text: 'Sì'
					},
					{
						id: 0,
						text: 'No'
					}
				];
			}

			filters.push({
				form: form,
				name: filterOptions.filter,
				key: 'filter-' + idx,
				options: fieldOptions
			});
			idx++;
		});
	});

	let filtersArranged = {
		'primary': [],
		'secondary': []
	};

	for (let f of filters) {
		if (f.options.attributes && f.options.attributes['data-depending-parent']) {
			let dependingOptions = JSON.parse(f.options.attributes['data-depending-parent']);
			let newDependingOptions = [];
			for (let d of dependingOptions) {
				for (let _f of filters) {
					if (_f.name === d.name) {
						d = {...d, name: _f.key};
						newDependingOptions.push(d);
					}
				}
			}

			f.options.attributes['data-depending-parent'] = JSON.stringify(newDependingOptions);
		}

		let filter = buildFormField(f.key, f.options);
		filtersForm.add(filter);
		filtersArranged[f.form].push(filter);
	}

	return filtersArranged;
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

	for (let formName of Object.keys(adminFilters)) {
		for (let filter of adminFilters[formName]) {
			let k = filter.options['adminFilter'].filter + '-' + filter.options['adminFilter'].type;
			if (typeof values[k] !== 'undefined')
				promises.push(filter.setValue(values[k], false));
			else
				promises.push(filter.setValue(null, false));
		}
	}

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

function wipePageActions() {
	let toolbar = _('toolbar');
	toolbar.addClass('d-none');
	toolbar.innerHTML = '';
	pageActions.clear();

	refreshToolbarVisibility();
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

	if (action.url) {
		button.href = action.url;
		button.setAttribute('target', '_blank');
	} else {
		button.href = '#';
	}

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

	refreshToolbarVisibility();
}

function removePageAction(name) {
	let button = pageActions.get(name);
	if (button) {
		button.remove();
		pageActions.delete(name);
	}

	refreshToolbarVisibility();
}

function refreshToolbarVisibility() {
	let toolbar = _('toolbar');
	if (pageActions.size > 0 || (_('topForm') && _('topForm').innerHTML)) {
		_('main-page').removeClass('no-toolbar');
		toolbar.removeClass('d-none');
	} else {
		_('main-page').addClass('no-toolbar');
		toolbar.addClass('d-none');
	}
}

async function goToPage(p, sort_by = null, history_push = true) {
	let mainContentDiv = _('main-content');

	let moveBy = mainContentDiv.offsetWidth + 50;
	if (p > currentPage)
		moveBy *= -1;

	let perPage = null;
	if (_('changePerPage'))
		perPage = parseInt(await _('changePerPage').getValue());

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

		return search(p, {sort_by: sort_by, per_page: perPage, history: history_push});
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

async function search(page = 1, options = {}) {
	options = {
		...{
			sort_by: null,
			endpoint: null,
			history: true,
			return_payload: false,
			empty_main: true,
			visualizer_meta: {},
			visualizer: null,
			per_page: null
		},
		...options
	};

	if (options.per_page === currentPageDetails.default_per_page)
		options.per_page = null;

	let request = currentAdminPage.split('/');
	let endpoint = options.endpoint || request[0];

	if (options.empty_main) {
		_('main-content').innerHTML = `<div class="px-3 no-overflow">
			<div id="results-table-count">
				<div><img src="` + PATH + `model/Output/files/loading.gif" alt="" /></div>
			</div>
			<div id="results-table-pages"></div>
		</div>
		<div id="main-visualizer-cont"></div>`;
	}

	let visualizer = options.visualizer || visualizers.get(endpoint);

	let filters = [];
	let searchValue = '';
	let filtersValues = {};

	if (!visualizer || visualizer.main) {
		for (let formName of Object.keys(adminFilters)) {
			for (let filter of adminFilters[formName]) {
				let v = await filter.getValue();

				filtersValues[filter.options['adminFilter'].filter + '-' + filter.options['adminFilter'].type] = v;

				if (v === '' || v === null)
					continue;

				if (filter.options['adminFilter'].filter === 'zk-all') {
					searchValue = v;
					continue;
				}

				filters.push({
					'filter': filter.options['adminFilter'].filter,
					'type': filter.options['adminFilter'].type,
					'value': v
				});
			}
		}

		sessionStorage.setItem('filters-values', JSON.stringify(filtersValues));
	}

	if (options.sort_by === null)
		options.sort_by = visualizer ? visualizer.getSorting(options.visualizer_meta) : [];

	if (options.empty_main || !visualizer) {
		let currentSelectedRows = (visualizer && visualizer.hasOwnProperty('selectedRows')) ? getMainVisualizer().selectedRows : [];

		visualizer = await loadVisualizer(currentPageDetails['type'], endpoint, _('main-visualizer-cont'), true, currentPageDetails);
		if (visualizer.forceTableOnSearch && (searchValue || filters.length))
			visualizer = await loadVisualizer('Table', endpoint, _('main-visualizer-cont'), true, currentPageDetails);

		if (visualizer.hasOwnProperty('selectedRows'))
			visualizer.selectedRows = currentSelectedRows;

		visualizers.set(endpoint, visualizer);
	}

	if (visualizer.main && !visualizer.useFilters) {
		let form = _('topForm');
		if (form)
			form.innerHTML = '';

		let secondaryForm = _('filtersFormCont');
		if (secondaryForm)
			secondaryForm.innerHTML = '';

		removePageAction('filters');
	}

	filters = [...filters, ...await visualizer.getSpecialFilters(options.visualizer_meta)];

	let payload = {
		'search': searchValue,
		'filters': filters
	};

	if (!visualizer.hasPagination)
		options.per_page = 0;

	if (options.per_page !== null)
		payload['per-page'] = options.per_page;

	if (payload['per-page'] !== 0)
		payload['page'] = page;

	if (visualizer.useFilters) {
		let searchFields = await getSearchFieldsFromStorage();
		if (searchFields.length > 0)
			payload['search-fields'] = searchFields;
	}

	visualizer.setSorting(options.sort_by);
	payload['sort_by'] = options.sort_by;

	let columns = await visualizer.getFieldsToRetrieve();
	if (columns !== null)
		payload['fields'] = columns;

	if (options.return_payload)
		return payload;

	if (visualizer.main && options.history) {
		let get = {};
		if (page !== null)
			get.p = page;
		if (options.per_page !== null)
			get.perPage = options.per_page;
		get = queryStringFromObject(get);

		let replace = (typeof options.history === 'string' && options.history === 'replace');
		historyPush(request, get, replace, {
			'filters': filtersValues,
			'p': page,
			'per_page': options.per_page || null,
			'sort_by': options.sort_by
		});
	}

	currentPage = page;

	return adminApiRequest('page/' + endpoint + '/search', payload).then(response => {
		if (visualizer.main && endpoint !== currentAdminPage.split('/')[0]) // Nel frattempo è cambiata pagina?
			return;

		buildBreadcrumbs();

		if (visualizer.main && _('results-table-pages')) {
			if (visualizer.hasPagination) {
				_('results-table-pages').removeClass('d-none');
				_('results-table-count').removeClass('d-none');

				_('results-table-pages').innerHTML = getPaginationHtml(response.pages, response.current);

				let paginationOptions = [10, 20, 50, 100, 200, 500];
				if (currentPageDetails.default_per_page && !paginationOptions.includes(currentPageDetails.default_per_page))
					paginationOptions.push(currentPageDetails.default_per_page);
				paginationOptions.sort((a, b) => a - b);
				paginationOptions.push(0);

				let paginationOptionsStrings = [];
				for (let itemsPerPage of paginationOptions)
					paginationOptionsStrings.push(`<option value="${itemsPerPage}">${itemsPerPage ? itemsPerPage + ' per pagina' : 'Nessuna paginazione'}</option>`);

				_('results-table-count').innerHTML = '<div>' + response.tot + ' risultati presenti</div> <span class="nowrap pl-2"><select id="changePerPage" style="width: auto">' + paginationOptionsStrings.join('') + '</select></span>';

				let perPage;
				if (typeof payload['per-page'] !== 'undefined' && payload['per-page'] !== null)
					perPage = payload['per-page'];
				else
					perPage = currentPageDetails.default_per_page;

				_('changePerPage').setValue(perPage, false);
				_('changePerPage').addEventListener('change', async () => {
					let v = await _('changePerPage').getValue();
					v = parseInt(v);
					if (isNaN(v))
						v = null;

					if (v === 0) {
						if (!confirm('Caricare tutti i risultati in una sola pagina potrebbe causare problemi di performance con tabelle molto grosse, confermi?')) {
							await _('changePerPage').setValue(currentPageDetails.default_per_page);
							return;
						}
					}
					return search(1, {per_page: v});
				});
			} else {
				_('results-table-pages').addClass('d-none');
				_('results-table-count').addClass('d-none');
			}
		}

		return visualizer.render(response.list, {
			...{totals: response.totals},
			...options.visualizer_meta
		}).then(() => {
			if (visualizer.main)
				_('main-loading').addClass('d-none');
			return changedHtml();
		});
	}).catch(error => reportAdminError(error));
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
	_('main-page').removeClass('no-breadcrumbs');
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
	_('main-page').addClass('no-breadcrumbs');
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

	for (let formName of Object.keys(adminFilters)) {
		for (let filter of adminFilters[formName])
			promises.push(filter.setValue(filter.options['adminFilter'].default, false));
	}

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
			case 'date':
			case 'time':
			case 'datetime':
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
			reportAdminError(error);
			reloadMainList();
		}).finally(() => {
			hideLoadingMask();
		});
	}
}

function checkIfDefaultActionEnabled(action) {
	if (currentPageDetails.actions && typeof currentPageDetails.actions[action] !== 'undefined' && !currentPageDetails.actions[action])
		return false;
	else
		return true;
}

function loadAdminElement(id, get = {}, page = null, history_push = true) {
	elementCallback = null;
	dataCache = {'data': {}, 'children': []};

	if (page === null)
		page = currentAdminPage.split('/')[0];

	if (checkBeforePageChange())
		historyMgr.wipe(); // Evita di richiederlo in loadAdminPage
	else
		return false;

	let templatePromise = loadAdminPage(page + '/edit/' + id, get, history_push, false).then(showLoadingMask);
	let dataPromise = loadElementData(page, id || 0, get);

	return Promise.all([templatePromise, dataPromise]).then(async responses => {
		// Check privilegi
		if (currentPageDetails.privileges.C && checkIfDefaultActionEnabled('new')) {
			addPageAction('new', {
				'fa-icon': 'far fa-plus-square',
				'text': 'Nuovo',
				'action': 'newElement()',
			});
		}

		if (id === 0) {
			if (currentPageDetails.privileges.C && checkIfDefaultActionEnabled('save')) {
				addPageAction('save', {
					'fa-icon': 'far fa-save',
					'text': 'Salva',
					'action': 'save()',
				});
			}

			if (checkIfDefaultActionEnabled('list')) {
				addPageAction('list', {
					'fa-icon': 'fas fa-list',
					'text': 'Elenco',
					'action': 'loadAdminPage(' + JSON.stringify(page) + ')',
				});
			}
		} else {
			if (responses[1].privileges.U && checkIfDefaultActionEnabled('save')) {
				addPageAction('save', {
					'fa-icon': 'far fa-save',
					'text': 'Salva',
					'action': 'save()',
				});
			}

			if (checkIfDefaultActionEnabled('list')) {
				addPageAction('list', {
					'fa-icon': 'fas fa-list',
					'text': 'Elenco',
					'action': 'loadAdminPage(' + JSON.stringify(page) + ')',
				});
			}

			if (currentPageDetails.privileges.C && checkIfDefaultActionEnabled('duplicate')) {
				addPageAction('duplicate', {
					'fa-icon': 'far fa-clone',
					'text': 'Duplica',
					'action': 'duplicate()',
				});
			}

			if (responses[1].privileges.D && checkIfDefaultActionEnabled('delete')) {
				addPageAction('delete', {
					'fa-icon': 'far fa-trash-alt',
					'text': 'Elimina',
					'action': 'deleteRows(' + JSON.stringify([id]) + ')',
				});
			}
		}

		// Tasti azione custom
		Object.keys(responses[1].actions).forEach(action => {
			if (!responses[1].actions[action])
				return;
			addPageAction(action, responses[1].actions[action]);
		});

		if ((responses[1]['prev-item'] || responses[1]['next-item']) && window.handleItemsNavigation)
			handleItemsNavigation(responses[1]);

		let mainContent = _('main-content');
		await replaceTemplateValues(mainContent, id, responses[1].data, responses[1].fields);

		let form = new FormManager('main', {updateAdminHistory: true});
		pageForms.set('main', form);
		await form.build(mainContent, responses[1]);

		await renderSublists(responses[1].sublists, mainContent);

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

async function renderSublists(sublists, container, prefix = '') {
	if (prefix)
		prefix += '/';

	let sublistsPromises = [];

	for (let sublist of sublists) {
		let sublistCont = container.querySelector('[data-sublistplaceholder="' + sublist.name + '"]');
		if (!sublistCont)
			continue;

		sublistsPromises.push(new Promise(async (resolve, reject) => {
			try {
				if (sublist.name === currentAdminPage.split('/')[0])
					throw 'You cannot name a sublist like the main page';

				let visualizer = await loadVisualizer(sublist.visualizer, prefix + sublist.name, sublistCont, false, {
					"fields": sublist.fields,
					"privileges": sublist.privileges,
					"visualizer-options": sublist['visualizer-options'],
					"custom": sublist.custom,
					"sublists": sublist.sublists,
				});

				pageSublists.set(prefix + sublist.name, visualizer);

				await visualizer.render(sublist.list);

				resolve(visualizer);
			} catch (e) {
				reject(e);
			}
		}));
	}

	return Promise.all(sublistsPromises);
}

function loadElementData(page, id, get = {}) {
	return adminApiRequest('page/' + page + '/data/' + id, {}, {get});
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
	if (reloadingOptionsCache)
		reloadingOptionsCache.clear();
}

function newElement(get = {}, page = null, history_push = true) {
	return loadAdminElement(0, get, page, history_push);
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

async function save(options = {}) {
	options = {
		...{
			form: 'main',
			no_data_alert: true,
			load_element: true,
			sublists: true,
			page: null,
			id: null,
		},
		...options,
	};

	try {
		if (options.form === 'main') {
			for (let formName of pageForms.keys()) {
				let form = pageForms.get(formName);
				if (!form.ignore && !(await form.checkRequired()))
					return false;
			}

			if (saving) {
				alert('Already saving');
				return false;
			}

			saving = true;
			toolbarButtonLoading('save');
		} else {
			let form = pageForms.get(options.form);
			if (!form.ignore && !(await form.checkRequired()))
				return false;
		}

		if (_('form-' + options.form))
			_('form-' + options.form).querySelector('input[type="submit"]').value = 'Attendere...';

		resize();

		setLoadingBar(0);

		await new Promise(resolve => { // Gives a little bit of time for the fields to activate their "onchange" events
			setTimeout(() => {
				resolve();
			}, 200);
		});

		let request = currentAdminPage.split('/');
		if (options.page === null)
			options.page = request[0];
		if (options.id === null)
			options.id = getIdFromRequest(request);

		let payload = {
			data: {},
		};

		if (options.id === 0) // Al nuovo salvataggio invio tutto
			payload.data = await pageForms.get(options.form).getValues();
		else // Altrimenti solo i dati modificati
			payload.data = pageForms.get(options.form).getChangedValues();

		if (options.sublists) {
			for (let [k, sublist] of pageSublists.entries()) {
				if (k.includes('/')) // Non è una delle sublist principali
					continue;

				let sublistChanges = sublist.getSave();
				if (sublistChanges !== null)
					payload.data[k] = sublistChanges;
			}
		}

		if (Object.keys(payload.data).length === 0 && options.no_data_alert) {
			alert('Nessun dato modificato');
			return;
		}

		payload.data = await uploadPayloadFiles(options.page, payload.data);

		let response = await adminApiRequest('page/' + options.page + '/save/' + options.id, payload);
		if (!response.id)
			throw 'Risposta server errata';

		if (options.form === 'main') {
			wipeForms();
			saving = false;
		}

		if (options.load_element) {
			return loadAdminElement(response.id, {}, null, options.id === 0).then(() => {
				inPageMessage('Salvataggio correttamente effettuato.', 'success');
				return response.id;
			});
		} else {
			return response.id;
		}
	} catch (error) {
		reportAdminError(error);
		throw error;
	} finally {
		setLoadingBar(0);

		if (options.form === 'main') {
			saving = false;
			toolbarButtonRestore('save');
		}
	}
}

async function uploadPayloadFiles(page, payload) {
	payload = JSON.parse(JSON.stringify(payload));

	for (let k of Object.keys(payload)) {
		if (Array.isArray(payload[k]) && Array.from(pageSublists.keys()).includes(k)) { // Sublist
			for (let idx of payload[k].keys())
				payload[k][idx] = await uploadPayloadFiles(page, payload[k][idx]);
		} else if (typeof payload[k] === 'object' && payload[k] !== null && payload[k].hasOwnProperty('0') && typeof payload[k][0] === 'object' && payload[k][0].file) { // File
			payload[k][0].admin_upload = await uploadPayloadFile(page, payload[k][0]);
			delete payload[k][0].file;
		}
	}

	return payload;
}

async function uploadPayloadFile(page, file) {
	setLoadingBar(0);

	let ext, splitted_name = file.name.split('.');
	if (splitted_name)
		ext = splitted_name.pop();

	let length = file.file.length;
	let chunks = Math.ceil(length / PAYLOAD_MAX_SIZE);

	let {id} = await adminApiRequest('page/' + page + '/file-save-begin', {ext}, {method: 'POST'});
	for (let c = 0; c < chunks; c++) {
		let chunk = file.file.slice(c * PAYLOAD_MAX_SIZE, (c + 1) * PAYLOAD_MAX_SIZE);
		await adminApiRequest('page/' + page + '/file-save-process', {id, chunk});
		setLoadingBar(Math.round(100 / chunks * (c + 1)));
	}

	return id;
}

function inPageMessage(text, className, container = null) {
	if (container === null)
		container = _('main-content');
	if (!container)
		return;

	let div = document.createElement('div');
	div.className = 'alert alert-' + className + ' alert-dismissible fade show';
	div.setAttribute('role', 'alert');
	div.innerHTML = text + '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>';

	if (container.firstChild)
		container.insertBefore(div, container.firstChild);
	else
		container.appendChild(div);
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
	return adminApiRequest('page/' + request[0] + '/duplicate/' + request[2], {}, {method: 'POST'}).then(r => {
		if (r.id) {
			window.open(adminPrefix + request[0] + '/edit/' + r.id);
		} else {
			throw 'Errore sconosciuto';
		}
	}).catch(error => {
		reportAdminError(error);
	}).finally(() => {
		toolbarButtonRestore('duplicate');
	});
}

async function callElementCallback() {
	if (elementCallback) {
		await elementCallback.call();
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

	return ajax(adminPrefix + 'get-user-customization', {
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
				return ajax(adminPrefix + 'save-user-customization', {
					'k': k
				}, {
					'v': JSON.stringify(v),
				}, {
					'headers': {
						'X-Access-Token': adminApiToken
					}
				}).then(r => {
					if (!r.success)
						throw r;

					resolve();
				});
			};
		})(k, v, oldValue, resolve), 300);
	});
}

async function deleteUserCustomization(k) {
	return ajax(adminPrefix + 'delete-user-customization', {
		'k': k
	}, {}, {
		'method': 'POST',
		'headers': {
			'X-Access-Token': adminApiToken
		}
	}).then(r => {
		if (!r.success)
			throw r;

		if (typeof userCustomizationsCache[k] !== 'undefined')
			delete userCustomizationsCache[k];
	});
}

async function exportPopup(step) {
	switch (step) {
		case 1:
			return zkPopup({
				url: adminPrefix + 'export/' + currentAdminPage.split('/')[0],
				get: {step}
			});
		case 2:
			let form = _('export-form');
			let exportPayload = await form.getValues();
			let searchPayload = await search(null, {history: false, empty_main: false, return_payload: true});

			return zkPopup({
				url: adminPrefix + 'export/' + currentAdminPage.split('/')[0],
				get: {step},
				post: {
					exportPayload: JSON.stringify(exportPayload),
					searchPayload: JSON.stringify(searchPayload)
				}
			}).then(() => {
				return exportNextStep(exportPayload, searchPayload);
			});
	}
}

async function exportNextStep(exportPayload, searchPayload) {
	let loadingBar = _('export-loading-bar');
	if (!loadingBar)
		return;

	let response = await ajax(adminPrefix + 'export/' + currentAdminPage.split('/')[0], {step: 3}, {
		id: loadingBar.dataset.id,
		exportPayload: JSON.stringify(exportPayload),
		searchPayload: JSON.stringify(searchPayload)
	});

	if (typeof response === 'string') {
		alert(response);
		return;
	}

	loadingBar.firstElementChild.style.width = response.percentage + '%';

	if (response.status === 'finished') {
		_('exporter-result').innerHTML = 'Se il download non parte in automatico, <a href="' + response.file + '" target="_blank">cliccare qui</a>';
		window.open(response.file);
	} else {
		return exportNextStep(exportPayload, searchPayload);
	}
}

async function filterFormatOptions(select) {
	let form = select.form;
	let format = await select.getValue();
	for (let option of form.querySelectorAll('[data-format-option]')) {
		if (option.getAttribute('data-format-option') === format)
			option.removeClass('d-none');
		else
			option.addClass('d-none');
	}
}

function deleteRows(ids) {
	let usingChecks = false;
	if (typeof ids === 'undefined') {
		ids = getMainVisualizer().selectedRows;
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
	return adminApiRequest('page/' + request[0] + '/delete', {ids}).then(() => {
		wipeForms();
		if (usingChecks)
			getMainVisualizer().selectedRows = [];

		if (request.length === 1)
			return reloadMainList();
		else
			return loadAdminPage(request[0]);
	}).catch(error => {
		reportAdminError(error);
	}).finally(() => {
		toolbarButtonRestore('delete');
	});
}

async function reloadMainList(keep_page = false) {
	wipeForms();

	let options = {history: false};
	if (_('changePerPage')) {
		let v = await _('changePerPage').getValue();
		options.per_page = parseInt(v);
	}

	return search(keep_page ? currentPage : 1, options);
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

async function replaceTemplateValues(cont, id, data, fields = {}) {
	data.id = id;
	let keys = Object.keys(data);
	for (let k of keys) {
		let v = '';
		if (k === 'id')
			v = id;
		else
			v = data[k];

		if (v === null)
			v = '';

		if (typeof v === 'object') {
			// Multilang?
			if (typeof v['it'] !== 'undefined')
				v = v['it'];

			// Instant search?
			if (v !== null && typeof v === 'object' && typeof v['id'] !== 'undefined')
				v = v['id'];

			// Still object?
			if (typeof v === 'object')
				v = '';
		}

		let html = cont.innerHTML;
		let regex = new RegExp('\\[' + k + '(\\|([a-z0-9_]+))?\\]', 'ig');

		let matches = html.matchAll(regex);
		for (let match of matches) {
			if (match[2]) { // Custom function?
				if (typeof window[match[2]] === 'function') {
					v = await window[match[2]].call(null, v);
				} else {
					alert('Function ' + match[2] + ' does not exist');
					continue;
				}
			} else {
				let field = null;
				if (typeof fields[k] !== 'undefined')
					field = fields[k];

				v = formatValueForTemplate(v, field);
			}

			let singleRegex = new RegExp(escapeRegExp(match[0]), 'g');
			cont.innerHTML = cont.innerHTML.replace(singleRegex, v);
		}

		cont.innerHTML = cont.innerHTML.replace(regex, v);
	}

	for (let conditionalCont of cont.querySelectorAll('[data-model-if]')) {
		let response = (function (code, data) {
			return eval(code);
		}).call(conditionalCont, conditionalCont.getAttribute('data-model-if'), data);
		if (!response)
			conditionalCont.remove();
	}
}

function formatValueForTemplate(v, field = null) {
	let type = 'text';
	if (field && field.type)
		type = field.type;

	switch (type) {
		case 'date':
			if (v)
				return v.substr(8, 2) + '/' + v.substr(5, 2) + '/' + v.substr(0, 4);
			else
				return '';

		case 'datetime':
			if (v)
				return v.substr(8, 2) + '/' + v.substr(5, 2) + '/' + v.substr(0, 4) + ' ' + v.substr(11);
			else
				return '';

		case 'select':
		case 'radio':
			let option = field.options.find(option => {
				return option.id == v;
			});

			if (option)
				return entities(option.text);

			return '';

		case 'checkbox':
			return v ? 'S&igrave;' : 'No';

		case 'ckeditor':
		case 'custom':
			return v;

		default:
			if (typeof v !== 'string') {
				if (v.toString)
					v = v.toString();
				else
					v = '';
			}

			// Encoding special characters
			v = entities(v);

			// nl2br
			v = v.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br/>$2');

			return v;
	}
}

async function openElementInContainer(id, container, options = {}) {
	options = {
		...{
			formName: null,
			page: currentAdminPage.split('/')[0],
			beforeSave: null,
			save: null,
			afterSave: null,
		},
		...options,
	};

	if (!options.formName) {
		alert('Specify a valid form name');
		return;
	}

	container.innerHTML = '<form id="form-' + options.formName + '" action="" method="post"><img src="' + PATH + 'model/Output/files/loading.gif" alt="Attendere"/></form>';

	let templatePromise = loadPage(adminPrefix + 'template/' + options.page, {ajax: ''}, {}, {fill_main: false});
	let dataPromise = loadElementData(options.page, id);

	return Promise.all([templatePromise, dataPromise]).then(async responses => {
		let containerForm = _('form-' + options.formName);
		containerForm.innerHTML = responses[0];

		let saveButtonCont = document.createElement('div');
		saveButtonCont.className = 'text-center pt-2';
		saveButtonCont.innerHTML = '<input type="submit" value="Salva" class="btn btn-primary"/>';
		containerForm.appendChild(saveButtonCont);

		await replaceTemplateValues(containerForm, 0, responses[1].data, responses[1].fields);

		let form = new FormManager(options.formName);
		pageForms.set(options.formName, form);
		await form.build(containerForm, responses[1]);

		await renderSublists(responses[1].sublists, containerForm);

		containerForm.addEventListener('submit', async event => {
			event.preventDefault();

			if (options.beforeSave) {
				let proceed = await options.beforeSave();
				if (!proceed)
					return;
			}

			let newId;
			if (options.save) {
				newId = await options.save();
			} else {
				newId = await save({
					form: options.formName,
					load_element: false,
					page: options.page,
					id,
				});
			}

			try {
				if (options.afterSave)
					await options.afterSave(newId);
			} catch (e) {
				reportAdminError(e);
			}
		});

		Array.from(document.querySelectorAll('#popup-real input')).some(field => {
			if (field.offsetParent !== null && field.type.toLowerCase() !== 'hidden' && field.name !== 'fakeusernameremembered' && field.name !== 'fakepasswordremembered') {
				field.focus();
				if (field.select)
					field.select();
				return true;
			}
			return false;
		});
	}).catch(err => {
		container.innerHTML = err.toString();
		throw err;
	});
}

function clearElementInContainer(formName) {
	if (formName === 'main') {
		wipeForms();
	} else {
		if (pageForms.get(formName))
			pageForms.delete(formName);
	}
}

async function openElementInPopup(id, options = {}) {
	options = {
		...{
			formName: 'popup',
			page: currentAdminPage.split('/')[0],
			beforeSave: null,
			save: null,
			afterSave: null,
		},
		...options,
	};

	return zkPopup('', {
		onClose: () => {
			clearElementInContainer(options.formName);
		}
	}).then(async () => {
		let oldAfterSave = options.afterSave;
		options.afterSave = async id => {
			if (oldAfterSave)
				await oldAfterSave(id);
			zkPopupClose();
		};

		await openElementInContainer(id, _('popup-real'), options);

		return fillPopup();
	}).catch(err => {
		zkPopup(err.toString());
	});
}

async function makeDynamicOption(fieldName, page, formName = 'main') {
	let form = pageForms.get(formName);
	if (!form.fields.get(fieldName))
		return;

	return openElementInPopup(0, {
		formName: 'popup',
		page: page,
		afterSave: async id => {
			let form = pageForms.get(formName);
			let field = form.fields.get(fieldName);

			if (field.options.type === 'select')
				await field.reloadOptions(null, true, false);

			await field.setValue(id);
		}
	});
}
