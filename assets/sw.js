var CACHE_NAME = 'admin-<?= $cacheKey ?>';
var adminPrefix = '<?= $this->model->_AdminFront->getUrlPrefix() ?>';
var urlsToCache = <?= json_encode($assets) ?>;
var notificationIntervals = {};

self.addEventListener('install', function (event) {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then(function (cache) {
			console.log('Caching the App Shell...');
			return fetch(adminPrefix, {
				credentials: 'include'
			}).then(function (response) {
				if (!response.ok) {
					throw new TypeError('Bad response status');
				}
				return cache.put(adminPrefix, response);
			}).then(function () {
				console.log('Caching the assets...');
				return cache.addAll(urlsToCache);
			})
		}).then(function () {
			console.log('Resources added to the cache');
		}).catch(function (err) {
			console.log(err);
		})
	);
});

self.addEventListener('activate', function (event) {
	event.waitUntil(
		caches.keys().then(function (cacheNames) {
			return Promise.all(
				cacheNames.map(function (cacheName) {
					if (cacheName !== CACHE_NAME) {
						console.log('Clearing old cache ' + cacheName);
						return caches.delete(cacheName);
					}
				})
			);
		}).then(function () {
			console.log('New service worker taking over...');
			clients.claim().then(() => {
					clients.matchAll().then(clients => {
						clients.forEach(client => {
							client.postMessage({
								"type": 'reload'
							});
						});
					});
				}
			);
		})
	);
});

self.addEventListener('fetch', function (event) {
	event.respondWith(
		caches.match(event.request).then(function (response) {
			// Cache hit - return response
			/*if (response && !response.redirected)
				return response;*/

			return fetch(event.request);
		})
	);
});

self.addEventListener('message', function (event) {
	if (typeof event.data.action === 'undefined')
		return;

	switch (event.data.action) {
		case 'notifications':
			let idx = event.data.user_idx + '-' + event.data.user;
			if (typeof notificationIntervals[idx] === 'undefined') {
				notificationIntervals[idx] = setInterval(() => {
					checkNotifications(event.data.path, event.data.user_idx, event.data.user);
				}, 10000);
			}
			checkNotifications(event.data.path, event.data.user_idx, event.data.user);
			break;
	}
});

function checkNotifications(path, user_idx, user) {
	clients.claim().then(() => {
		clients.matchAll().then(clients => {
			if (clients.length === 0) {
				deleteAllNotificationsCheckers();
			} else {
				fetch(path + '?user_idx=' + encodeURIComponent(user_idx) + '&user=' + encodeURIComponent(user), {
					credentials: 'include'
				}).then(response => {
					return response.text();
				}).then(text => {
					let data = JSON.parse(text);

					clients.forEach(client => {
						client.postMessage({
							"type": 'notifications',
							"notifications": data
						});
					});
				});
			}
		});
	});
}

function deleteAllNotificationsCheckers() {
	for (let i in notificationIntervals) {
		clearInterval(notificationIntervals[i]);
		notificationIntervals[i] = null;
	}
}

self.addEventListener('notificationclick', function (e) {
	let notification = e.notification;

	if (notification.data.url)
		clients.openWindow(notification.data.url);

	notification.close();
});
