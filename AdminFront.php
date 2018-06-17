<?php namespace Model\AdminFront;

use Model\Core\Autoloader;
use Model\Core\Module;
use Model\Form\Form;
use Model\User\User;
use Model\Core\Globals;

class AdminFront extends Module
{
	/** @var string */
	public $url;
	/** @var array */
	public $request;
	/** @var array */
	private $dictionary = null;
	/** @var DataVisualizer */
	private $visualizer = null;

	public function initialize()
	{
		$this->model->load('Paginator');

		if (isset($this->request[0])) {
			$pages = $this->getPages();
			$rule = $this->seekForRule($pages, $this->request[0]);
			if (!$rule)
				return;

			if (isset($this->request[2])) {
				if (!is_numeric($this->request[2]))
					die('Element id must be numeric');

				$elId = (int)$this->request[2];
				if ($elId <= 0)
					$elId = null;
			} else {
				$elId = null;
			}

			$this->model->load('Admin', [
				'page' => $rule['page'] ?: null,
				'id' => $elId,
			]);
		}
	}

	public function getUser(): User
	{
		if (!$this->model->isLoaded('User', 'Admin')) {
			$config = $this->retrieveConfig();

			$user_table = 'admin_users';
			if (isset($config['url']) and is_array($config['url'])) {
				foreach ($config['url'] as $u) {
					if (is_array($u) and $u['path'] == $this->url) {
						$user_table = $u['table'];
						break;
					}
				}
			}

			$this->model->load('User', [
				'table' => $user_table,
				'old_password' => 'old_password',
				'mandatory' => true,
				'login-controller' => 'AdminLogin',
			], 'Admin');
			if ($this->model->_User_Admin->options['algorithm-version'] === 'old')
				$this->model->_User_Admin->options['password'] = 'old_password';
		}

		return $this->model->_User_Admin;
	}

	/**
	 * Returns the appropriate controller name, given the request
	 *
	 * @param array $request
	 * @param mixed $rule
	 * @return array|bool
	 */
	public function getController(array $request, string $rule)
	{
		$config = $this->retrieveConfig();

		if (substr($rule, 0, 2) === 'sw') {
			$this->url = $config['url'][substr($rule, 2)]['path'];

			return [
				'controller' => 'AdminServiceWorker',
			];
		}

		if (!isset($config['url'][$rule]) or (!empty($config['url'][$rule]['path']) and strpos(implode('/', $request), $config['url'][$rule]['path']) !== 0))
			return false;

		$this->url = $config['url'][$rule]['path'];

		$realRequest = $this->getAdminRequest($request, $this->url);
		if ($realRequest === false)
			return false;

		$this->request = $realRequest;

		if (isset($realRequest[0])) {
			switch ($realRequest[0]) {
				case 'login':
				case 'logout':
					return [
						'controller' => 'AdminLogin',
					];
					break;
				default:
					return [
						'controller' => 'Admin',
					];
					break;
			}
		} else {
			return [
				'controller' => 'Admin',
			];
		}
	}

	/**
	 * Given the real request url, strips the first part (the admin path) to return the request to be parsed by the Admin module (returns false on failure)
	 *
	 * @param array $request
	 * @param string $path
	 * @return array|bool
	 */
	private function getAdminRequest(array $request, string $path)
	{
		if (empty($path))
			return $request;

		$path = explode('/', $path);
		foreach ($path as $p) {
			$shift = array_shift($request);
			if ($shift !== $p)
				return false;
		}
		return $request;
	}

	/**
	 * Recursively looks for the rule corresponding to a given request, in the pages and sub-pages
	 *
	 * @param array $pages
	 * @param string $request
	 * @return string|bool
	 */
	private function seekForRule(array $pages, string $request)
	{
		foreach ($pages as $p) {
			if (isset($p['rule']) and $p['rule'] === $request)
				return $p;
			if (isset($p['sub'])) {
				$rule = $this->seekForRule($p['sub'], $request);
				if ($rule)
					return $rule;
			}
		}
		return false;
	}

	/**
	 * Given a controller name, return the corresponding url.
	 *
	 * @param string|bool $controller
	 * @param int|bool $id
	 * @param array $tags
	 * @param array $opt
	 * @return bool|string
	 */
	public function getUrl(string $controller = null, $id = false, array $tags = [], array $opt = [])
	{
		switch ($controller) {
			case 'AdminLogin':
				return ($this->url ? $this->url . '/' : '') . 'login';
				break;
			default:
				return false;
				break;
		}
	}

	/**
	 * @return string
	 * @throws \Model\Core\Exception
	 */
	public function getUrlPrefix(): string
	{
		return $this->model->prefix() . ($this->url ? $this->url . '/' : '');
	}

	/**
	 * Returns the name of the chosen template module
	 *
	 * @return string
	 * @throws \Model\Core\Exception
	 */
	public function getTemplateModule(): string
	{
		$config = $this->retrieveConfig();
		if (!$config['template'])
			$this->model->error('No template module was defined in the configuration.');

		return $config['template'];
	}

	/**
	 * Retrieves the array of pages
	 *
	 * @return array
	 */
	public function getPages(): array
	{
		$config = $this->retrieveConfig();

		$pages = [];

		if (isset($config['url']) and is_array($config['url'])) {
			foreach ($config['url'] as $u) {
				if (is_array($u) and $u['path'] == $this->url) {
					$pages = $u['pages'];
					break;
				}
			}
		}

		if (isset(Globals::$data['adminAdditionalPages'])) {
			foreach (Globals::$data['adminAdditionalPages'] as $p) {
				$pages[] = array_merge([
					'name' => '',
					'rule' => '',
					'page' => null,
					'visualizer' => 'Table',
					'mobile-visualizer' => 'Table',
					'hidden' => false,
					'sub' => [],
				], $p);
			}
		}

		$usersAdminPage = 'AdminUsers';
		if (isset($config['url']) and is_array($config['url'])) {
			foreach ($config['url'] as $u) {
				if (is_array($u) and $u['path'] == $this->url and ($u['admin-page'] ?? '')) {
					$usersAdminPage = $u['admin-page'];
					break;
				}
			}
		}

		$pages[] = [
			'name' => 'Users',
			'page' => $usersAdminPage,
			'rule' => 'admin-users',
			'visualizer' => 'Table',
			'mobile-visualizer' => 'Table',
			'hidden' => false,
			'sub' => [],
		];

		return $pages;
	}

	/**
	 * sId (for storing and retrieving list options, hence maintaining the page settings on refreshing) is either passed via input parameters or a new one is calculated
	 *
	 * @return int
	 */
	public function getSessionId(): int
	{
		$sId = $this->model->getInput('sId');
		if ($sId === null) {
			$sId = 0;
			while (isset($_SESSION[SESSION_ID]['admin-search-sessions'][$this->request[0]][$sId]))
				$sId++;
		}
		return (int)$sId;
	}

	/**
	 * Returns options array for the list page, retrieving it from session if possible
	 *
	 * @param int $sId
	 * @return array
	 */
	public function getListOptions(int $sId = null): array
	{
		if ($sId === null)
			$sId = $this->getSessionId();

		if (isset($_SESSION[SESSION_ID]['admin-search-sessions'][$this->request[0]][$sId])) {
			$options = $_SESSION[SESSION_ID]['admin-search-sessions'][$this->request[0]][$sId];
		} else {
			$options = [
				'p' => 1,
				'filters' => [],
				'search-columns' => [],
				'sortBy' => [],
			];

			if ($this->model->_Admin->customFiltersForm) {
				$defaultFilters = $this->model->_Admin->customFiltersForm->getDataset();
				foreach ($defaultFilters as $k => $d) {
					$v = $d->getValue();
					if ($v)
						$options['filters'][] = [$k, $v];
				}
			}
		}

		return $options;
	}

	/**
	 * Stores in session the current list options array
	 *
	 * @param int $sId
	 * @param array $options
	 */
	public function setListOptions(int $sId, array $options)
	{
		$_SESSION[SESSION_ID]['admin-search-sessions'][$this->request[0]][$sId] = $options;
	}

	/**
	 * @return array
	 */
	private function getDictionary(): array
	{
		if ($this->dictionary === null) {
			$adminDictionaryFile = INCLUDE_PATH . 'app' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'dictionary.php';

			$dictionary = [];
			if (file_exists($adminDictionaryFile))
				require($adminDictionaryFile);

			$this->dictionary = [];
			foreach ($dictionary as $w => $langs) {
				$this->dictionary[$w] = count($langs) > 0 ? ($langs['it'] ?? reset($langs)) : '';
			}
		}

		return $this->dictionary;
	}

	/**
	 * @param string $w
	 * @return string
	 */
	public function word(string $w): string
	{
		if ($this->model->isLoaded('Multilang')) {
			return $this->model->_Multilang->word('admin.' . $w);
		} else {
			$dictionary = $this->getDictionary();
			return $dictionary[$w] ?? '';
		}
	}

	/**
	 * Returns an instance of a visualizer (if null is given, returns the actual visualizer of the current page)
	 *
	 * @param string|null $visualizer
	 * @param array $options
	 * @return DataVisualizer
	 */
	public function getVisualizer(string $visualizer = null, array $options = [])
	{
		if ($visualizer === null) {
			if (!$this->visualizer and isset($this->request[0])) {
				$pages = $this->getPages();
				$rule = $this->seekForRule($pages, $this->request[0]);
				if (!$rule or !isset($rule['visualizer']) or !$rule['visualizer'])
					return null;

				$className = Autoloader::searchFile('DataVisualizer', $rule['visualizer']);
				if (!$className)
					return null;

				$options = array_merge($this->model->_Admin->page->visualizerOptions(), [
					'table' => $this->model->_Admin->options['table'],
					'element' => $this->model->_Admin->options['element'],
				]);

				$this->visualizer = new $className($this->model, $options);
			}

			return $this->visualizer;
		} else {
			$className = Autoloader::searchFile('DataVisualizer', $visualizer);
			if (!$className)
				return null;

			return new $className($this->model, $options);
		}
	}

	/**
	 * Sends a JSON with the page aids for the current page
	 */
	public function pageAids()
	{
		$request = array_filter([
			$this->model->_AdminFront->request[0],
			isset($_GET['action']) ? $_GET['action'] : null,
			isset($_GET['id']) ? $_GET['id'] : null,
		]);

		if (($request[1] ?? '') === 'edit') {
			if (isset($request[2]))
				$requestType = 'edit';
			else
				$requestType = 'new';
		} else {
			$requestType = 'list';
		}

		$actions = $this->model->_Admin->getActions($requestType);

		$parsedActions = [];
		foreach ($actions as $actId => $act) {
			$action = [
				'id' => $actId,
				'text' => $act['text'],
				'icon' => null,
				'fa-icon' => null,
				'url' => '#',
				'action' => 'return false',
			];

			$iconPath = PATH . 'model/' . $this->getClass() . '/files/img/toolbar/' . $actId . '.png';
			if (file_exists(PATHBASE . $iconPath)) {
				$action['icon'] = $iconPath;
			} else {
				switch ($actId) {
					case 'new':
						$action['fa-icon'] = 'far fa-plus-square';
						break;
					case 'delete':
						$action['fa-icon'] = 'far fa-trash-alt';
						break;
					case 'save':
						$action['fa-icon'] = 'far fa-save';
						break;
					case 'duplicate':
						$action['fa-icon'] = 'far fa-clone';
						break;
				}
			}

			switch ($act['action']) {
				case 'new':
					$action['action'] = 'newElement(); return false';
					break;
				case 'delete':
					if (isset($_GET['action'])) {
						if (isset($_GET['id']) and $_GET['id'])
							$action['action'] = 'deleteRows([' . $_GET['id'] . ']); return false';
						else
							continue 2;
					}
					break;
				case 'save':
					$action['action'] = 'save(); return false';
					break;
				case 'duplicate':
					$action['action'] = 'duplicate(); return false';
					break;
			}

			$parsedActions[] = $action;
		}

		if (((isset($this->model->_Admin->options['table']) and $this->model->_Admin->options['table']) or (isset($this->model->_Admin->options['element']) and $this->model->_Admin->options['element'])) and !isset($_GET['action'])) { // We're in a "table" page
			$parsedActions[] = [
				'id' => 'filters',
				'text' => 'Filtri',
				'fa-icon' => 'fas fa-filter',
				'url' => '#',
				'action' => 'switchFiltersForm(this); return false',
			];

			if ($this->model->moduleExists('Csv')) {
				$parsedActions[] = [
					'id' => 'csv',
					'text' => 'CSV',
					'fa-icon' => 'fab fa-wpforms',
					'url' => '#',
					'action' => 'window.open(\'' . $this->getUrlPrefix() . implode('/', $request) . '?sId=\'+sId+\'&csv\'); return false',
				];
			}
		}

		$print = isset($this->model->_Admin->options['print']) ? $this->model->_Admin->options['print'] : false;
		if ($print) {
			$parsedActions[] = [
				'id' => 'print',
				'text' => 'Stampa',
				'fa-icon' => 'fas fa-print',
				'url' => '#',
				'action' => 'window.open(\'' . $this->getUrlPrefix() . implode('/', $request) . '?sId=\'+sId+\'&print\'); return false',
			];
		}

		if ($requestType === 'list') {
			$visualizer = $this->getVisualizer();
			$parsedActions = array_values($visualizer->parseActions($parsedActions));
		}

		if (isset($this->model->_Admin->options['actions'])) {
			foreach ($this->model->_Admin->options['actions'] as $actIdx => $act) {
				$act = array_merge([
					'id' => 'custom-' . $actIdx,
					'text' => '',
					'icon' => null,
					'fa-icon' => null,
					'url' => '#',
					'action' => 'return false',
				], $act);

				if (isset($act['specific'])) {
					switch ($act['specific']) {
						case 'table':
							if (isset($_GET['action']))
								continue 2;
							break;
						case 'element':
							if (!isset($_GET['action']) or $_GET['action'] != 'edit')
								continue 2;
							break;
						case 'element-edit':
							if (!isset($_GET['action']) or $_GET['action'] != 'edit')
								continue 2;
							if (!isset($_GET['id']) or !$_GET['id'])
								continue 2;
							break;
						case 'element-new':
							if (!isset($_GET['action']) or $_GET['action'] != 'edit')
								continue 2;
							if (isset($_GET['id']) and $_GET['id'])
								continue 2;
							break;
					}
				}

				$parsedActions[] = $act;
			}
		}

		$breadcrumbs = [
			[
				'name' => 'Home',
				'url' => '',
				'get' => '',
			],
		];
		$this->getBreadcrumbs($breadcrumbs, $request);

		$breadcrumbsHtml = [];
		$prefix = $this->getUrlPrefix();
		foreach ($breadcrumbs as $b) {
			$breadcrumbsHtml[] = $b['url'] !== null ? '<a href="' . $prefix . $b['url'] . '" onclick="loadAdminPage([\'' . $b['url'] . '\'], \'' . $b['get'] . '\'); return false">' . entities($b['name']) . '</a>' : '<a>' . entities($b['name']) . '</a>';
		}
		$breadcrumbsHtml = implode(' -&gt; ', $breadcrumbsHtml);

		$filterForms = $this->getFiltersForms();

		ob_start();
		$filterForms['top']->render([
			'one-row' => true,
			'labels-as-placeholders' => true,
		]);
		$topFormHtml = ob_get_clean();

		ob_start();
		$filterForms['filters']->render();
		$filtersFormHtml = ob_get_clean();

		$this->model->sendJSON([
			'sId' => $this->getSessionId(),
			'actions' => $parsedActions,
			'breadcrumbs' => $breadcrumbsHtml,
			'topForm' => $topFormHtml,
			'filtersForm' => $filtersFormHtml,
		]);
	}

	/**
	 * Reconstructs page hierarchy in an array, for breadcrumbs building
	 *
	 * @param array $breadcrumbs
	 * @param array $request
	 * @param array $pages
	 * @return bool
	 */
	public function getBreadcrumbs(array &$breadcrumbs, array $request, array $pages = null): bool
	{
		if ($pages === null)
			$pages = $this->getPages();

		foreach ($pages as $p) {
			if (isset($p['rule']) and $p['rule'] === $request[0]) {
				$breadcrumbs[] = [
					'name' => $p['name'],
					'url' => $p['rule'],
					'get' => '',
				];
				if (isset($request[1]) and $request[1] === 'edit') {
					if (isset($request[2])) {
						$breadcrumbs[count($breadcrumbs) - 1]['get'] = 'goTo=' . urlencode($request[2]);
						$breadcrumbs[] = [
							'name' => 'Edit',
							'url' => null,
							'get' => '',
						];
					} else {
						$breadcrumbs[] = [
							'name' => 'New',
							'url' => null,
							'get' => '',
						];
					}
				}
				return true;
			}
			if (isset($p['sub'])) {
				$temp = $breadcrumbs;
				$temp[] = [
					'name' => $p['name'],
					'url' => isset($p['rule']) ? $p['rule'] : null,
					'get' => '',
				];
				if ($this->getBreadcrumbs($temp, $request, $p['sub'])) {
					$breadcrumbs = $temp;
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Returns the filter forms (the top one and the extended one)
	 * If $arr is true, it will not return the Form objects but just an array with the fields
	 *
	 * @param bool $arr
	 * @return array
	 * @throws \Model\Core\Exception
	 */
	public function getFiltersForms(bool $arr = false): array
	{
		$defaults = [
			'top' => [
				'all' => '=',
			],
			'filters' => [],
		];

		if (!$this->model->_Admin->options['table'])
			unset($defaults['top']['all']);

		$customFilters = $this->model->_Admin->customFiltersForm;
		if ($customFilters) {
			foreach ($customFilters->getDataset() as $k => $f) {
				$form = isset($f->options['admin-form']) ? $f->options['admin-form'] : 'filters';

				if (isset($f->options['admin-type'])) {
					$defaults[$form][$k] = $f->options['admin-type'];
				} else {
					switch ($f->options['type']) {
						case 'date':
						case 'time':
						case 'datetime':
							$defaults[$form][$k] = 'range';
							break;
						default:
							$defaults[$form][$k] = '=';
							break;
					}
				}
			}
		}

		$adminListOptions = $this->getListOptions();

		$forms = [];
		foreach ($defaults as $form => $defaultFilters) {
			$forms[$form] = $this->getFiltersForm($form, $defaultFilters, $adminListOptions['filters'], $arr);
		}

		return $forms;
	}

	/**
	 * Returns the requested filter form
	 *
	 * @param string $name
	 * @param array $default
	 * @param array $filtersSet
	 * @param bool $arr
	 * @return Form|array
	 * @throws \Model\Core\Exception
	 */
	private function getFiltersForm(string $name, array $default = [], array $filtersSet = [], bool $arr = false)
	{
		$filtersArr = null;
		if (isset($_COOKIE['model-admin-' . $this->request[0] . '-filters-' . $name]))
			$filtersArr = json_decode($_COOKIE['model-admin-' . $this->request[0] . '-filters-' . $name], true);
		if ($filtersArr === null)
			$filtersArr = $default;

		if ($arr)
			return $filtersArr;

		$form = new Form([
			'table' => $this->model->_Admin->options['table'],
			'model' => $this->model,
		]);

		$customFilters = $this->model->_Admin->customFiltersForm;

		$values = [];
		foreach ($filtersSet as $f) {
			if (isset($filtersArr[$f[0]])) {
				switch (count($f)) {
					case 2: // Custom filter
						$values[$f[0]] = $f[1];
						break;
					case 3: // Normal filter
						if ($f[1] != $filtersArr[$f[0]]) // Different operator
							continue 2;
						$values[$f[0]] = $f[2];
						break;
					case 4: // Range filter
						$values[$f[0]] = [$f[1], $f[2]];
						break;
				}
			}
		}

		foreach ($filtersArr as $k => $t) {
			if (isset($customFilters[$k])) {
				$datum = $form->add($customFilters[$k]);
				$datum->options['attributes']['data-filter'] = $k;
				$datum->options['attributes']['data-filter-type'] = isset($datum->options['admin-type']) ? $datum->options['admin-type'] : 'custom';
				$datum->options['attributes']['data-default'] = (string)$datum->options['default'];
				if (isset($values[$k]))
					$datum->setValue($values[$k]);
				elseif ($filtersSet) // If at least one filter is set, but not this one, that means the default value was erased by the user
					$datum->setValue(null);
			} else {
				$fieldOptions = [
					'attributes' => [
						'data-filter' => $k,
						'data-filter-type' => $t,
						'data-default' => '',
						'name' => 'f-' . $k,
					],
					'nullable' => true,
					'default' => null,
					'admin-type' => $t,
				];

				if ($k === 'all') {
					$fieldOptions['label'] = 'Ricerca generale';
					$fieldOptions['attributes']['data-filter'] = 'all';
					$fieldOptions['attributes']['data-filter-type'] = 'custom';
				}

				if ($t === 'range') {

				} else {
					$datum = $form->add($k, $fieldOptions);
					if (isset($values[$k]))
						$datum->setValue($values[$k]);
				}
			}
		}

		return $form;
	}

	/**
	 * Renders a sublist (via the chosen data visualizer)
	 * $name has to be a declared children-set of the current element
	 *
	 * @param string $name
	 * @param array $options
	 */
	public function renderSublist(string $name, array $options = [])
	{
		$defaultOptions = [];
		foreach ($this->model->_Admin->sublists as $s) {
			if ($s['name'] === $name) {
				$defaultOptions = $s['options'];
				break;
			}
		}

		if (!$defaultOptions)
			return;

		$options = array_merge($defaultOptions, $options);

		$childrenOptions = $this->model->element->getChildrenOptions($options['children']);

		$visualizerOptions = [
			'name' => $name,
			'table' => $childrenOptions['table'],
			'element' => $childrenOptions['element'],
			'fields' => $options['fields'] ?? [],
			'exclude' => (isset($childrenOptions['field'], $childrenOptions['type']) and $childrenOptions['type'] === 'multiple' and $childrenOptions['field']) ? [$childrenOptions['field']] : [],
			'dummy' => $this->model->element->create($options['children'], '[n]'),
		];

		$visualizer = $this->getVisualizer($options['visualizer'], $visualizerOptions);
		$visualizer->render($options);
	}

	/**
	 * @param string $page
	 * @return string|null
	 */
	public function getRuleForPage(string $page)
	{
		$pages = $this->getPages();
		return $this->searchRuleForPage($pages, $page);
	}

	/**
	 * @param array $pages
	 * @return string|null
	 */
	private function searchRuleForPage(array $pages, string $page)
	{
		foreach ($pages as $p) {
			if ($p['page'] === $page)
				return $p['rule'];
			if ($p['sub']) {
				$check = $this->searchRuleForPage($p['sub'], $page);
				if ($check)
					return $check;
			}
		}

		return null;
	}
}
