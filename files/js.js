var sId = null;
var currentAdminPage = false;
var menuResizing = false;
var columnResizing = false;
var menuIsOpen = true;
var sortedBy = [];
var currentPage = 1;
var selectedRows = [];
var holdingRowsSelection = null;
var searchCounter = 0;
var pageLoadingHash = '';

var dataCache = {'data': {}, 'children': []};

var saving = false;

/* Form history monitoring */
var changedValues = {};
var changeHistory = [];
var canceledChanges = [];

window.addEventListener('DOMContentLoaded', function () {
	currentAdminPage = document.location.pathname.substr(adminPrefix.length);
	let request = currentAdminPage.split('/');

	if (history.replaceState)
		history.replaceState({'request': request}, '', document.location);

	if (document.location.search.match(/sId=[0-9]+/))
		sId = document.location.search.replace(/.*sId=([0-9]+).*/, '$1');

	if (currentAdminPage && _('main-content')) {
		if (request.length >= 3 && request[1] === 'edit') {
			loadElement(request[0], request[2], false);
		} else {
			loadAdminPage(request, sId ? 'sId=' + sId : '', '', false);
		}
		loadPageAids(request);
	} else {
		_('main-loading').style.display = 'none';
	}

	if (_('admin-language-selector')) {
		ajax(adminPrefix + currentAdminPage.split('/')[0], {'getCurrentLanguage': ''}).then(r => {
			_('admin-language-selector').setValue(r, false);
		});
	}
});

window.addEventListener('load', function () {
	resize();
	window.addEventListener('resize', function () {
		resize();
	});
});

/*if ('serviceWorker' in navigator) {
	window.addEventListener('load', function () {
		navigator.serviceWorker.register(adminPrefix + 'sw.js').then(function (registration) {
			// Registration was successful
			console.log('ServiceWorker registration successful with scope: ', registration.scope);
		}, function (err) {
			// registration failed :(
			console.log('ServiceWorker registration failed: ', err);
		});
	});
}*/

window.onpopstate = function (event) {
	var s = event.state;
	if (typeof s['request'] !== 'undefined') {
		if (s['request'].join('/') === currentAdminPage && typeof s['p'] !== 'undefined') {
			goToPage(s['p'], false);
		} else {
			var get = '';
			if (typeof s['sId'] !== 'undefined')
				get = changeGetParameter(get, 'sId', s['sId']);

			if (s['request'][1] === 'edit') {
				loadElement(s['request'][0], s['request'][2], false);
			} else {
				if (typeof s['p'] !== 'undefined')
					get = changeGetParameter(get, 'p', s['p']);
				loadAdminPage(s['request'], get, false, false);
			}
		}
	}
};

window.addEventListener('keydown', function (event) {
	switch (event.keyCode) {
		case 90: // CTRL+Z
			if (event.ctrlKey) {
				historyStepBack();
				event.preventDefault();
			}
			break;
		case 89: // CTRL+Y
			if (event.ctrlKey) {
				historyStepForward();
				event.preventDefault();
			}
			break;

	}
});

window.addEventListener('mouseup', function (event) {
	releaseRowsSelection();
});

/*
 Opens or close a menu group
 */
function switchMenuGroup(id) {
	var tasto = _('menu-group-' + id);
	var cont = _('menu-group-' + id + '-cont');
	if (tasto.hasClass('selected')) {
		closeMenuGroup(tasto, cont);
	} else {
		openMenuGroup(tasto, cont);
	}
}

/*
 Opens a menu group
 */
function openMenuGroup(tasto, cont) {
	tasto.addClass('selected');
	if (cont) {
		cont.style.height = cont.firstElementChild.offsetHeight + 'px';
		setTimeout(function () {
			cont.style.height = 'auto';
		}, 500);
	}
}

/*
 Closes a menu group
 */
function closeMenuGroup(tasto, cont) {
	tasto.removeClass('selected');
	if (cont) {
		if (cont.style.height == '0px')
			return;
		cont.addClass('no-transition');
		cont.style.height = cont.firstElementChild.offsetHeight + 'px';
		cont.offsetHeight; // Reflow
		cont.removeClass('no-transition');
		cont.style.height = '0px';
		cont.offsetHeight; // Reflow
	}
}

/*
 Closes all menu groups except for the ones provided in the first argument
 */
function closeAllMenuGroups(except) {
	if (typeof except == 'undefined')
		except = [];
	document.querySelectorAll('.main-menu-sub, .main-menu-tasto').forEach(function (tasto) {
		if (!in_array(tasto.getAttribute('data-menu-id'), except)) {
			var cont = _('.main-menu-cont[data-menu-id="' + tasto.getAttribute('data-menu-id') + '"]');
			closeMenuGroup(tasto, cont);
		}
	});
}

/*
 Open the menù pages selecting a specific link
 */
function openMenuTo(id) {
	var tasto = _('menu-group-' + id);
	if (!tasto)
		return false;

	var toOpen = [];
	var div = tasto;
	while (div) {
		if (typeof div.getAttribute !== 'undefined' && div.getAttribute('data-menu-id') !== null)
			toOpen.push(div.getAttribute('data-menu-id'));
		div = div.parentNode;
	}

	closeAllMenuGroups(toOpen);
	toOpen.forEach(function (id) {
		var tasto = _('menu-group-' + id);
		var cont = _('menu-group-' + id + '-cont');
		openMenuGroup(tasto, cont);
	});
}

/*
 Given a specific request, opens the left menu to the appropriate button
 */
function openMenuToRequest(request) {
	var button = document.querySelector('.main-menu-tasto[href="' + adminPrefix + request[0] + '"], .main-menu-sub[href="' + adminPrefix + request[0] + '"]');
	if (button)
		openMenuTo(button.getAttribute('data-menu-id'));
}

/*
 Resizes page dynamic components, called on page open and at every resize
 */
function resize(menu) {
	if (!_('main-grid') || !_('main-menu'))
		return;

	var hHeight = _('header').offsetHeight;
	_('main-grid').style.height = 'calc(100% - ' + (hHeight + 4) + 'px)';
	var tHeight = _('toolbar').offsetHeight;
	_('main-page').style.height = 'calc(100% - ' + tHeight + 'px)';

	if (typeof menu === 'undefined')
		menu = true;

	if (menu) {
		var hideMenu = _('main-menu').getAttribute('data-hide');
		switch (hideMenu) {
			case 'always':
				if ((lastPosition = localStorage.getItem('sidenav-open-menu')) !== null) {
					if (lastPosition === "0")
						closeMenu();
					else if (lastPosition === "1")
						openMenu();
				}
				break;
			case 'mobile':
				if (window.innerWidth < 800)
					closeMenu();
				break;
			case 'never':
				if (!menuIsOpen)
					openMenu();
				break;
		}
	}

	var table = _('results-table');
	if (table) {
		var sub_h = _('breadcrumbs').offsetHeight + _('#main-content > div:first-of-type').offsetHeight + _('table-headings').offsetHeight + 10;
		table.style.height = (_('main-page').offsetHeight - sub_h) + 'px';
	}

	var topForm = _('topForm');
	if (topForm) {
		if (window.innerWidth < 800) {
			var filtersFormCont = _('filtersFormCont');
			if (topForm.parentNode !== filtersFormCont.parentNode)
				filtersFormCont.parentNode.insertBefore(topForm, filtersFormCont);
			topForm.style.width = '100%';
		} else {
			var toolbar = _('toolbar');
			if (topForm.parentNode !== toolbar)
				toolbar.appendChild(topForm);

			var w = toolbar.clientWidth - 12;
			toolbar.querySelectorAll('.toolbar-button').forEach(function (button) {
				w -= button.offsetWidth;
			});
			topForm.style.width = w + 'px';
		}
	}
}

function switchMenu() {
	if (menuIsOpen)
		closeMenu();
	else
		openMenu();
}

function openMenu() {
	_('main-menu').style.width = '40%';
	_('main-menu').style.maxWidth = maxMenuWidth + 'px';
	_('main-page-cont').style.width = 'calc(100% - ' + maxMenuWidth + 'px)';

	var hideMenu = _('main-menu').getAttribute('data-hide');
	if (window.innerWidth >= 800 && hideMenu != 'always') {
		_('img-open-menu').style.opacity = 0;
		_('header').style.paddingLeft = '0';
	}

	menuIsOpen = true;
	localStorage.setItem('sidenav-open-menu', "1");
	setTimeout(function () {
		resize(false);
	}, 500);
}

function closeMenu() {
	_('main-menu').style.width = '0%';
	_('main-page-cont').style.width = '100%';
	_('img-open-menu').style.opacity = 1;
	_('header').style.paddingLeft = '40px';
	menuIsOpen = false;
	localStorage.setItem('sidenav-open-menu', "0");
	setTimeout(function () {
		resize(false);
	}, 500);
}

function startMenuResize() {
	var coords = getMouseCoords(event);
	menuResizing = {'startX': coords.x, 'startW': maxMenuWidth, 'endW': false};
}

/*
 Loads a page using fetch; fills the main div with the content when the response comes, and additionally returns a Promise
 */
function loadPage(url, get, post, deleteContent) {
	if (typeof get === 'undefined')
		get = '';
	if (typeof post === 'undefined')
		post = false;
	if (typeof deleteContent === 'undefined')
		deleteContent = true;

	get = changeGetParameter(get, 'ajax', '');

	if (deleteContent) {
		_('main-loading').style.display = 'block';
		_('main-content').innerHTML = '';
	}

	pageLoadingHash = url + get + post;

	return ajax(url, get, post).then((function (hash) {
		return function (response) {
			if (hash !== pageLoadingHash)
				return false;

			_('main-loading').style.display = 'none';
			_('main-content').jsFill(response);

			if (window.resetAllInstantSearches)
				resetAllInstantSearches();

			resize();
			if (_('results-table'))
				tableEvents();
			return response;
		}
	})(pageLoadingHash));
}

/*
 Moves between admin pages, moving the left menù and taking care of the browser history
 */
function loadAdminPage(request, get, post, history_push) {
	if (request.length === 0)
		return false;
	if (typeof get === 'undefined')
		get = '';
	if (typeof history_push === 'undefined')
		history_push = true;

	openMenuToRequest(request);

	let full_url = request.join('/');

	let state = {'request': request};
	if (get.match(/sId=[0-9]+/)) {
		sId = get.replace(/.*sId=([0-9]+).*/, '$1');
		state['sId'] = sId;
	} else if (currentAdminPage !== full_url) {
		sId = null;
	}

	if (get.match(/p=[0-9]+/)) {
		currentPage = parseInt(get.replace(/.*p=([0-9]+).*/, '$1'));
	} else {
		currentPage = 1;
	}

	state['p'] = currentPage;
	let forcePage = currentPage;

	if (history.pushState && history_push) {
		history.pushState(state, '', adminPrefix + full_url + '?' + get);
	}

	let promise;
	if (currentAdminPage !== full_url) {
		if (typeof request[1] === 'undefined' || request[1] === '') { // Table page
			promise = loadPageAids(request, get).then((function (forcePage) {
				return function () {
					return search(forcePage);
				};
			})(forcePage));
		} else {
			promise = Promise.all([loadPage(adminPrefix + full_url, get, post), loadPageAids(request, get)]);
		}
	} else {
		promise = loadPage(adminPrefix + full_url, get, post);
	}

	if (window.innerWidth < 800)
		closeMenu();

	selectedRows = [];
	currentAdminPage = full_url;

	historyWipe();

	return promise;
}

/*
 Loads the page aids, like breadcrumbs and toolbar buttons
 */
function loadPageAids(request, get) {
	if (!_('toolbar'))
		return;

	if (typeof get === 'undefined')
		get = '';

	if (sId !== null)
		get = changeGetParameter(get, 'sId', sId);
	if (typeof request[1] !== 'undefined')
		get = changeGetParameter(get, 'action', request[1]);
	if (typeof request[2] !== 'undefined')
		get = changeGetParameter(get, 'id', request[2]);

	_('toolbar').innerHTML = '';
	_('breadcrumbs').innerHTML = '';
	if (form = _('filtersFormCont'))
		form.innerHTML = '';

	return ajax(adminPrefix + request[0] + '/pageAids', get + '&ajax').then(function (aids) {
		if (typeof aids !== 'object')
			return false;

		sId = aids.sId;

		if (history.replaceState) {
			var url = document.location.href.replace(document.location.search, '');
			if (url.substr(-1) == '?')
				url = url.substr(0, -1);
			var queryString = changeGetParameter(document.location.search.substr(1), 'sId', sId);
			history.replaceState({
				'request': currentAdminPage.split('/'),
				'sId': sId,
				'p': currentPage
			}, '', url + '?' + queryString);
		}

		var toolbar = _('toolbar');

		if (aids.actions.length == 0) {
			toolbar.style.display = 'none';
		} else {
			toolbar.style.display = 'block';

			aids.actions.forEach(function (act) {
				var button = document.createElement('a');
				button.className = 'toolbar-button';
				button.id = 'toolbar-button-' + act.id;
				button.href = act.url;
				button.setAttribute('onclick', act.action);
				if (act.icon)
					button.innerHTML = '<img src="' + act.icon + '" alt="" onload="resize()" /> ';
				if (act['fa-icon'])
					button.innerHTML = '<i class="' + act['fa-icon'] + '" aria-hidden="true"></i> ';
				button.innerHTML += act.text;
				toolbar.appendChild(button);
			});
		}

		if (aids.breadcrumbs) {
			_('breadcrumbs').style.display = 'block';
			_('breadcrumbs').innerHTML = aids.breadcrumbs;
		} else {
			_('breadcrumbs').style.display = 'none';
		}

		if (topForm = _('topForm'))
			topForm.parentNode.removeChild(topForm);
		if (lightboxForm = _('filtersFormCont'))
			lightboxForm.innerHTML = '';

		if (typeof aids.topForm !== 'undefined') {
			var form = document.createElement('div');
			form.id = 'topForm';
			form.innerHTML = aids.topForm;
			toolbar.appendChild(form);
		}

		if (typeof aids.filtersForm !== 'undefined') {
			if (lightboxForm)
				lightboxForm.innerHTML += aids.filtersForm;
		}

		resize();

		document.querySelectorAll('[data-filter]').forEach(function (el) {
			switch (el.nodeName.toLowerCase()) {
				case 'input':
				case 'textarea':
					switch (el.type.toLowerCase()) {
						case 'checkbox':
						case 'radio':
						case 'hidden':
							el.addEventListener('change', function () {
								search();
							});
							break;
						default:
							el.addEventListener('keyup', function (event) {
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
					el.addEventListener('change', function () {
						search();
					});
					break;
			}
		});

		return aids;
	});
}

function startColumnResize(event, k) {
	let coords = getMouseCoords(event);
	columnResizing = {'k': k, 'startX': coords.x, 'startW': parseInt(_('column-' + k).style.width), 'endW': false};
}

document.addEventListener('mousemove', event => {
	let coords = getMouseCoords(event);
	if (menuResizing !== false) {
		let diff = coords.x - menuResizing.startX;
		let newW = menuResizing.startW + diff;
		if (newW > window.innerWidth * 0.4)
			newW = Math.floor(window.innerWidth * 0.4);

		_('main-menu').style.maxWidth = newW + 'px';

		menuResizing.endW = newW;
	}
});

document.addEventListener('mouseup', event => {
	if (menuResizing !== false) {
		if (menuResizing.endW < 10)
			menuResizing.endW = 10;

		maxMenuWidth = menuResizing.endW;
		openMenu();
		menuResizing = false;

		setCookie('menu-width', maxMenuWidth, 365 * 10);
	}
});

function changeSorting(event, column) {
	if (event.altKey) {
		sortedBy.some(function (s, idx) {
			if (s[0] === column) {
				sortedBy.splice(idx, 1);
				return true;
			}
			return false;
		});
	} else if (event.ctrlKey) {
		if (!sortedBy.some(function (s, idx) {
				if (s[0] === column) {
					sortedBy[idx][1] = sortedBy[idx][1] === 'ASC' ? 'DESC' : 'ASC';
					return true;
				}
				return false;
			})) {
			sortedBy.push([
				column,
				'ASC'
			]);
		}
	} else {
		if (sortedBy.length === 1 && sortedBy[0][0] === column) {
			sortedBy[0][1] = sortedBy[0][1] === 'ASC' ? 'DESC' : 'ASC';
		} else {
			sortedBy = [
				[
					column,
					'ASC'
				]
			];
		}
	}
	reloadResultsTable();
}

function reloadResultsTable(get, post) {
	if (typeof get === 'undefined')
		get = document.location.search.substr(1);
	get = changeGetParameter(get, 'sId', sId);
	if (sortedBy)
		get += '&sortBy=' + encodeURIComponent(JSON.stringify(sortedBy));
	return loadPage(adminPrefix + (currentAdminPage.split('/')[0]), get, post)
}

function changeGetParameter(queryString, k, v) {
	if (queryString === '') {
		queryString = k + '=' + encodeURIComponent(v);
	} else {
		if (queryString.indexOf(k + '=') === -1) {
			queryString += '&' + k + '=' + encodeURIComponent(v);
		} else {
			var regexp = new RegExp(k + '=[^&]*(&|$)');
			queryString = queryString.replace(regexp, k + '=' + encodeURIComponent(v) + '$1');
		}
	}
	return queryString;
}

function goToPage(p, history_push) {
	if (typeof history_push == 'undefined')
		history_push = true;

	var mainContentDiv = _('main-content');

	var moveBy = mainContentDiv.offsetWidth + 50;
	if (p > currentPage)
		moveBy *= -1;

	get = changeGetParameter(document.location.search.substr(1), 'sId', sId);
	get = changeGetParameter(get, 'p', p);

	if (history_push && history.pushState)
		history.pushState({
			'request': currentAdminPage.split('/'),
			'sId': sId,
			'p': p
		}, '', adminPrefix + currentAdminPage + '?' + get);

	var pageMove = new Promise(function (resolve) {
		if (p !== currentPage) {
			mainContentDiv.style.left = moveBy + 'px';

			setTimeout(resolve, 300);
		} else {
			resolve();
		}
	}).then(function () {
		_('main-content').style.display = 'none';
		_('main-loading').style.display = 'block';
		return true;
	});
	var pageLoad = loadPage(adminPrefix + currentAdminPage, get, false, false);

	return Promise.all([pageMove, pageLoad]).then(function () {
		_('main-content').style.display = 'block';
		_('main-loading').style.display = 'none';

		mainContentDiv.className = 'no-transition';
		mainContentDiv.style.left = (moveBy * -1) + 'px';
		mainContentDiv.offsetWidth;
		mainContentDiv.className = '';
		mainContentDiv.style.left = '0px';

		return new Promise(function (resolve, reject) {
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
}

function switchFiltersForm(origin) {
	if (_('filtersForm')) {
		if (window.innerWidth < 800) {
			toolsLightbox('filtersForm', {
				'origin': origin,
				'width': 'calc(100% - 20px)',
				'left': '10px',
				'offset-y': 10
			});
		} else {
			toolsLightbox('filtersForm', {
				'origin': origin,
				'width': '60%',
				'left': maxMenuWidth + 'px',
				'offset-y': 10
			});
		}
	}
}

function search(forcePage) {
	if (typeof forcePage == 'undefined')
		forcePage = 1;

	var filters = [];
	document.querySelectorAll('[data-filter]').forEach(function (el) {
		var v = el.getValue(true);
		if (v === '')
			return;

		switch (el.getAttribute('data-filter-type')) {
			case 'custom':
				var f = [el.getAttribute('data-filter'), v];
				break;
			default:
				var f = [el.getAttribute('data-filter'), el.getAttribute('data-filter-type'), v];
				break;
		}
		filters.push(f);
	});

	get = changeGetParameter(document.location.search.substr(1), 'sId', sId);
	get = changeGetParameter(get, 'p', forcePage);
	get = changeGetParameter(get, 'filters', JSON.stringify(filters));

	return loadPage(adminPrefix + currentAdminPage.split('/')[0], get);
}

function filtersReset() {
	document.querySelectorAll('[data-filter]').forEach(function (el) {
		el.setValue(el.dataset.default, false);
	});
	search();
}

function manageFilters() {
	var request = currentAdminPage.split('/');
	zkPopup({'url': adminPrefix + request[0] + '/pickFilters', 'get': 'ajax'});
}

function saveFilters() {
	var request = currentAdminPage.split('/');

	var filters = {};
	document.querySelectorAll('[data-managefilters]').forEach(function (radio) {
		if (radio.checked && radio.value != '0') {
			filters[radio.getAttribute('data-managefilters')] = radio.value;
		}
	});

	_('popup-real').loading();
	return ajax(adminPrefix + request[0] + '/pickFilters', 'ajax', 'c_id=' + c_id + '&filters=' + encodeURIComponent(JSON.stringify(filters))).then(function (r) {
		if (r != 'ok') {
			alert(r);
			return false;
		} else {
			return loadPageAids(currentAdminPage.split('/'));
		}
	}).then(function () {
		zkPopupClose();
		return search();
	});
}

function manageSearchFields() {
	var request = currentAdminPage.split('/');
	zkPopup({'url': adminPrefix + request[0] + '/pickSearchFields', 'get': 'ajax'});
}

function saveSearchFields() {
	var request = currentAdminPage.split('/');

	var fields = [];
	document.querySelectorAll('[data-managesearchfields]').forEach(function (check) {
		if (check.checked)
			fields.push(check.getAttribute('data-managesearchfields'));
	});
	var post = 'c_id=' + c_id + '&fields=' + encodeURIComponent(fields.join(','));

	_('popup-real').loading();
	return ajax(adminPrefix + request[0] + '/pickSearchFields', 'ajax', post).then(function (r) {
		zkPopupClose();
		if (r != 'ok') {
			alert(r);
		} else {
			return search();
		}
	});
}

function loadElement(page, id, history_push) {
	if (typeof history_push === 'undefined')
		history_push = true;

	elementCallback = null;
	dataCache = {'data': {}, 'children': []};

	let promise;

	if (id) {
		let formTemplate = loadAdminPage([page, 'edit', id], '', false, history_push).then(showLoadingMask);
		let formData = loadElementData(page, id);

		promise = Promise.all([formTemplate, formData]).then(responses => {
			hideLoadingMask();

			return checkSubPages().then(() => {
				return fillAdminForm(responses[1]);
			});
		});
	} else {
		promise = loadAdminPage([page, 'edit'], '', false, history_push).then(checkSubPages);
	}

	return promise.then(callElementCallback).then(monitorFields).then(() => {
		Array.from(_('adminForm').elements).some(field => {
			if (field.offsetParent !== null && field.type.toLowerCase() !== 'hidden') {
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
	return ajax(adminPrefix + page + '/edit/' + id, 'getData=1&ajax', false).then(function (r) {
		if (typeof r !== 'object')
			throw r;
		return r;
	});
}

function fillAdminForm(data) {
	if (typeof data === 'undefined') {
		data = dataCache;
	} else {
		dataCache = data;
	}

	if (!(form = _('adminForm'))) {
		throw 'Error in loading element';
	}

	return form.fill(data.data, false, 'filled').then(() => {
		let promises = [];

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

							if (el[k] !== null && typeof el[k] === 'object') {
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

		form.dataset.filled = '1';

		return Promise.all(promises);
	});
}

function initializeEmptyForm() {
	let form = _('adminForm');
	if (!form)
		return false;

	let promises = [];

	for (let i = 0, f; f = form.elements[i++];) {
		promises.push(f.getValue().then((function (name) {
			return function (fieldValue) {
				if (!fieldValue && _('[data-filter="' + name + '"]'))
					return _('[data-filter="' + name + '"]').getValue();
				return fieldValue;
			}
		})(f.name)).then((function (f) {
			return function (fieldValue) {
				if (fieldValue)
					changedValues[f.name] = fieldValue;
				return f.setValue(fieldValue).then(() => {
					f.setAttribute('data-filled', '1');
				});
			};
		})(f)));
	}

	return Promise.all(promises);
}

function monitorFields() {
	let form = _('adminForm');

	for (let i in form.elements) {
		if (!form.elements.hasOwnProperty(i))
			continue;
		let f = form.elements[i];
		if (!f.name || f.name === 'fakeusernameremembered' || f.name === 'fakepasswordremembered')
			continue;

		if (!f.getAttribute('data-filled'))
			continue;
		if (f.getAttribute('data-monitored'))
			continue;

		let isInSublistTemplate = false;
		let check = f;
		while (check) {
			if (check.hasClass && check.hasClass('sublist-template')) {
				isInSublistTemplate = true;
				break;
			}
			check = check.parentNode;
		}
		if (isInSublistTemplate)
			continue;

		f.setAttribute('data-monitored', '1');

		f.addEventListener('change', function (e) {
			changedMonitoredField(this);
		});

		if (f.type !== 'file') { // Files fields are complex structure, thus are not supported in the changes history
			f.getValue().then((f => {
				return (v => f.setAttribute('data-default-value', v));
			})(f));
		}
	}
	return true;
}

function changedMonitoredField(f) {
	var old = null;
	if (typeof changedValues[f.name] === 'undefined') {
		old = f.getAttribute('data-default-value');
	} else {
		old = changedValues[f.name];
	}

	f.getValue().then(((old, f) => {
		return v => {
			changedValues[f.name] = v;

			if (f.type !== 'file') { // Files fields are complex structure, thus are not supported in the changes history
				changeHistory.push({
					'field': f.name,
					'old': old,
					'new': v
				});

				canceledChanges = [];

				rebuildHistoryBox();
			}
		};
	})(old, f));
}

function rebuildHistoryBox() {
	_('links-history').innerHTML = '<a href="#" onclick="historyGoToStep(\'reset\'); return false" class="link-history">Situazione iniziale</a>';

	changeHistory.forEach(function (i, idx) {
		var a = document.createElement('a');
		a.href = '#';
		a.setAttribute('onclick', 'historyGoToStep(\'back\', ' + idx + '); return false');
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

	canceledChanges.forEach(function (i, idx) {
		var a = document.createElement('a');
		a.href = '#';
		a.setAttribute('onclick', 'historyGoToStep(\'forward\', ' + idx + '); return false');
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

function switchHistoryBox() {
	var div = _('history-box');
	if (div.style.right == '0px') {
		div.style.right = '-15%';
	} else {
		div.style.right = '0px';
	}
}

function historyStepBack() {
	if (changeHistory.length === 0)
		return false;
	let form = _('adminForm');
	let el = changeHistory.pop();
	canceledChanges.unshift(el);

	if (typeof el.sublist !== 'undefined') {
		switch (el.action) {
			case 'new':
				sublistDeleteRow(el.sublist, el.id, false);
				break;
			case 'delete':
				sublistRestoreRow(el.sublist, el.id);
				break;
		}
	} else {
		if (form[el.field].getAttribute('data-multilang') && form[el.field].getAttribute('data-lang')) {
			switchFieldLang(form[el.field].getAttribute('data-multilang'), form[el.field].getAttribute('data-lang'));
		}

		form[el.field].setValue(el.old, false);
		form[el.field].focus();
		if (form[el.field].select)
			form[el.field].select();
		changedValues[el.field] = el.old;
	}

	rebuildHistoryBox();
}

function historyStepForward() {
	if (canceledChanges.length === 0)
		return false;
	let form = _('adminForm');
	let el = canceledChanges.shift();
	changeHistory.push(el);

	if (typeof el.sublist !== 'undefined') {
		switch (el.action) {
			case 'new':
				sublistRestoreRow(el.sublist, el.id);
				break;
			case 'delete':
				sublistDeleteRow(el.sublist, el.id, false);
				break;
		}
	} else {
		if (form[el.field].getAttribute('data-multilang') && form[el.field].getAttribute('data-lang')) {
			switchFieldLang(form[el.field].getAttribute('data-multilang'), form[el.field].getAttribute('data-lang'));
		}

		form[el.field].setValue(el.new, false);
		form[el.field].focus();
		if (form[el.field].select)
			form[el.field].select();
		changedValues[el.field] = el.new;
	}

	rebuildHistoryBox();
}

function historyGoToStep(t, i) {
	switch (t) {
		case 'reset':
			while (changeHistory.length > 0) {
				historyStepBack();
			}
			break;
		case 'back':
			while (changeHistory.length > i + 1) {
				historyStepBack();
			}
			break;
		case 'forward':
			if (i + 1 > canceledChanges)
				return false;
			for (c = 1; c <= i + 1; c++) {
				historyStepForward();
			}
			break;
	}
}

function historyWipe() {
	changedValues = {};
	changeHistory = [];
	canceledChanges = [];
	rebuildHistoryBox();
}

function newElement() {
	return loadElement(currentAdminPage.split('/')[0]).then(initializeEmptyForm).then(monitorFields);
}

function changeSaveButton() {
	if (_('#toolbar-button-save img'))
		_('#toolbar-button-save img').src = absolute_path + 'model/Output/files/loading.gif';
	if (_('#toolbar-button-save i')) {
		_('#toolbar-button-save i').removeClass('far');
		_('#toolbar-button-save i').removeClass('fa-save');
		_('#toolbar-button-save i').addClass('fas');
		_('#toolbar-button-save i').addClass('fa-spinner');
	}
}

function restoreSaveButton() {
	if (_('#toolbar-button-save img'))
		_('#toolbar-button-save img').src = absolute_path + 'model/AdminTemplateEditt/files/img/toolbar/save.png';
	if (_('#toolbar-button-save i')) {
		_('#toolbar-button-save i').removeClass('fas');
		_('#toolbar-button-save i').removeClass('fa-spinner');
		_('#toolbar-button-save i').addClass('far');
		_('#toolbar-button-save i').addClass('fa-save');
	}
}

function save() {
	if (saving) {
		alert('Already saving');
		return false;
	}

	saving = true;
	changeSaveButton();
	resize();

	setLoadingBar(0);

	return new Promise(function (resolve) {
		setTimeout(function () { // Gives a little bit of time for the fields to activate their "onchange" events
			resolve();
		}, 200);
	}).then(function () {
		let url;
		let request = currentAdminPage.split('/');
		var history_push;

		if (typeof request[2] !== 'undefined') {
			// I am editing an existing element
			url = adminPrefix + request[0] + '/save/' + request[2];
			history_push = false;
		} else {
			// I am saving a new element
			url = adminPrefix + request[0] + '/save';
			history_push = true;
		}

		let form = _('adminForm');
		let savingValues = {};
		for (let k in changedValues) {
			if (form[k].getAttribute('data-multilang') && typeof savingValues[k] === 'undefined') {
				if (typeof savingValues[form[k].getAttribute('data-multilang')] === 'undefined')
					savingValues[form[k].getAttribute('data-multilang')] = {};
				savingValues[form[k].getAttribute('data-multilang')][form[k].getAttribute('data-lang')] = changedValues[k];
			} else {
				savingValues[k] = changedValues[k];
			}
		}

		let version_lock = '';
		if (typeof form['_model_version'] !== 'undefined')
			version_lock = '&version=' + encodeURIComponent(form['_model_version'].getValue(true));

		return ajax(url, 'ajax', 'c_id=' + c_id + '&data=' + encodeURIComponent(JSON.stringify(savingValues)) + version_lock, {
			'onprogress': function (event) {
				let percentage;
				if (event.total === 0) {
					percentage = 0;
				} else {
					percentage = Math.round(event.loaded / event.total * 100);
				}

				setLoadingBar(percentage);
			}
		}).then(function (r) {
			setLoadingBar(0);

			let request = currentAdminPage.split('/');

			saving = false;
			restoreSaveButton();

			if (typeof r !== 'object') {
				alert(r);
				return false;
			}
			if (r.status === 'ok') {
				return loadElement(request[0], r.id, history_push).then(function () {
					inPageMessage('Salvataggio correttamente effettuato.', 'green-message');
				});
			} else if (typeof r.err !== 'undefined') {
				alert(r.err);
			} else {
				alert('Generic error');
			}
		});
	});
}

function inPageMessage(text, className) {
	let div = document.createElement('div');
	div.className = className;
	div.innerHTML = text;
	_('main-content').insertBefore(div, _('main-content').firstChild);
}

function allInOnePage() {
	let get = changeGetParameter('', 'sId', sId);
	get = changeGetParameter(get, 'nopag', 1);

	loadAdminPage([currentAdminPage.split('/')[0]], get);
}

function sublistAddRow(name, id, trigger) {
	if (typeof trigger === 'undefined')
		trigger = true;

	let form = _('adminForm');

	if (typeof id === 'undefined' || id === null) {
		let next = 0;
		while (typeof form['ch-' + name + '-new' + next] !== 'undefined')
			next++;

		id = 'new' + next;
	}

	let container = _('cont-ch-' + name);
	if (!container) {
		return new Promise(function (resolve) {
			resolve(false);
		});
	}

	let div = document.createElement('div');
	div.className = container.getAttribute('data-rows-class');
	div.id = 'cont-ch-' + name + '-' + id;
	div.innerHTML = _('sublist-template-' + name).innerHTML.replace(/\[n\]/g, id);

	let promise = afterMutation((div => {
		return () => {
			div.querySelectorAll('input, select, textarea').forEach(f => {
				if (!f.name)
					return;

				f.setAttribute('data-filled', '1');
			});
			return monitorFields();
		};
	})(div));

	if (addbutton = _('cont-ch-' + name + '-addbutton')) {
		container.insertBefore(div, addbutton);
	} else {
		container.appendChild(div);
	}

	changedValues['ch-' + name + '-' + id] = 1;

	if (trigger && _('links-history')) {
		changeHistory.push({
			'sublist': name,
			'action': 'new',
			'id': id
		});

		rebuildHistoryBox();
	}

	return promise.then(function () {
		return id;
	});
}

function sublistDeleteRow(name, id, trigger) {
	if (typeof trigger === 'undefined')
		trigger = true;

	let form = _('adminForm');
	if (typeof form['ch-' + name + '-' + id] !== 'undefined')
		form['ch-' + name + '-' + id].setValue(0, false);
	_('cont-ch-' + name + '-' + id).style.display = 'none';

	changedValues['ch-' + name + '-' + id] = 0;

	if (trigger && _('links-history')) {
		changeHistory.push({
			'sublist': name,
			'action': 'delete',
			'id': id
		});

		rebuildHistoryBox();
	}
}

function sublistRestoreRow(name, id) {
	let form = _('adminForm');
	if (typeof form['ch-' + name + '-' + id] !== 'undefined')
		form['ch-' + name + '-' + id].setValue(1, false);
	_('cont-ch-' + name + '-' + id).style.display = 'block';
	changedValues['ch-' + name + '-' + id] = 1;
}

function switchAllFieldsLang(lang) {
	document.querySelectorAll('.lang-switch-cont [data-lang]').forEach(function (el) {
		if (el.getAttribute('data-lang') === lang)
			el.addClass('selected');
		else
			el.removeClass('selected');
	});

	document.querySelectorAll('.multilang-field-container[data-name]').forEach(function (f) {
		switchFieldLang(f.getAttribute('data-name'), lang);
	});
}

function setLoadingBar(percentage) {
	_('main-loading-bar').style.width = percentage + '%';
}

function duplicate() {
	if (changeHistory.length > 0) {
		alert('There are prending changes, can\'t duplicate.');
		return false;
	}

	let request = currentAdminPage.split('/');
	window.open(adminPrefix + request[0] + '/duplicate/' + request[2]);
}

function checkSubPages() {
	var promises = [];

	var containers = document.querySelectorAll('[data-subpages]');
	containers.forEach(function (cont) {
		var tabsCont = document.querySelector('[data-tabs][data-name="' + cont.getAttribute('data-subpages') + '"]');
		var tabs = tabsCont.querySelectorAll('[data-tab]');
		tabs.forEach(function (tab) {
			var page = cont.querySelector('[data-subpage="' + tab.getAttribute('data-tab') + '"]');
			if (!page) {
				var subPageCont = document.createElement('div');
				subPageCont.setAttribute('data-subpage', tab.getAttribute('data-tab'));
				subPageCont.innerHTML = '[to-be-loaded]';
				cont.appendChild(subPageCont);
			}

			if (tab.getAttribute('data-oninit')) {
				(function () {
					eval(this.getAttribute('data-oninit'));
				}).call(tab);
			}

			tab.addEventListener('click', function (event) {
				sessionStorage.setItem(tabsCont.getAttribute('data-tabs'), this.getAttribute('data-tab'));
				loadSubPage(cont.getAttribute('data-subpages'), this.getAttribute('data-tab'));

				if (this.getAttribute('data-onclick')) {
					eval(this.getAttribute('data-onclick'));
				}

				return false;
			});
		});

		var def = null;
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
			promises.push(new Promise(function (resolve) {
				loadSubPage(cont.getAttribute('data-subpages'), def).then(resolve);
			}));
		}
	});

	return Promise.all(promises);
}

function loadSubPage(cont_name, p) {
	var tabsCont = document.querySelector('[data-tabs][data-name="' + cont_name + '"]');

	tabsCont.querySelectorAll('[data-tab]').forEach(function (el) {
		var cont = document.querySelector('[data-subpages="' + cont_name + '"] [data-subpage="' + el.getAttribute('data-tab') + '"]');

		if (el.getAttribute('data-tab') === p) {
			el.addClass('selected');

			if (el.getAttribute('data-onchange')) {
				(function () {
					eval(this.getAttribute('data-onchange'));
				}).call(el);
			}

			cont.style.display = 'block';
		} else {
			if (el.hasClass('selected')) {
				el.removeClass('selected');

				if (el.getAttribute('data-onchange')) {
					(function () {
						eval(this.getAttribute('data-onchange'));
					}).call(el);
				}
			}

			cont.style.display = 'none';
		}
	});

	var cont = document.querySelector('[data-subpages="' + cont_name + '"] [data-subpage="' + p + '"]');
	if (cont.innerHTML === '[to-be-loaded]') {
		var request = currentAdminPage.split('/');
		if (request.length === 2)
			request.push(0);

		return cont.loading().ajax(adminPrefix + request.join('/') + '/' + p, '', '').then(function () {
			return fillAdminForm();
		}).then(checkSubPages);
	} else {
		return new Promise(function (resolve) {
			resolve();
		});
	}
}

function holdRowsSelection(checkbox) {
	if (checkbox.getValue(true))
		holdingRowsSelection = 0;
	else
		holdingRowsSelection = 1;
	checkbox.setValue(holdingRowsSelection);
}

function releaseRowsSelection() {
	holdingRowsSelection = null;
}

function moveBetweenRows(checkbox, keyCode) {
	var id = checkbox.getAttribute('data-id');
	var row = document.querySelector('.results-table-row[data-id="' + id + '"]');
	if (!row)
		return;
	var n = row.getAttribute('data-n');

	switch (keyCode) {
		case 38:
			n--;
			break;
		case 40:
			n++;
			break;
		default:
			return;
			break;
	}

	var nextRow = document.querySelector('.results-table-row[data-n="' + n + '"]');
	if (!nextRow)
		return;

	var nextId = nextRow.getAttribute('data-id');
	var nextCheckbox = document.getElementById('row-checkbox-' + nextId);
	nextCheckbox.focus();
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

function changeAdminLang(l) {
	if (!l)
		return false;

	return ajax(adminPrefix + currentAdminPage.split('/')[0], {
		'mlang': l
	}).then(r => {
		if (r === 'ok')
			document.location.reload();
		else
			alert('Error while setting language. Maybe Multilang module is not loaded in the Frontcontroller?');
	});
}

function showLoadingMask() {
	_('main-loading').addClass('grey');
	_('main-loading').style.display = 'block';
}

function hideLoadingMask() {
	_('main-loading').removeClass('grey');
	_('main-loading').style.display = 'none';
}