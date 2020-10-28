<?php namespace Model\AdminFront;

use Model\Core\Autoloader;
use Model\Core\Module;
use Model\Form\Form;

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

	/**
	 *
	 */
	public function headings()
	{
		?>
		<link rel="manifest" href="<?= $this->getUrlPrefix() ?>manifest.json">
		<script>
			var adminPath = '<?=$this->url?>';
			var adminPrefix = <?=json_encode($this->getUrlPrefix())?>;
			var elementCallback = null;
		</script>
		<?php
	}

	/**
	 * Returns the appropriate controller name, given the request
	 *
	 * @param array $request
	 * @param mixed $rule
	 * @return array|null
	 */
	public function getController(array $request, string $rule): ?array
	{
		$config = $this->retrieveConfig();
		$paths = $this->model->_Admin->getAdminPaths();

		if (substr($rule, 0, 2) === 'sw') {
			$this->url = $paths[substr($rule, 2)]['path'];

			return [
				'controller' => 'AdminServiceWorker',
			];
		}

		if (!isset($paths[$rule]) or (!empty($paths[$rule]['path']) and strpos(implode('/', $request), $paths[$rule]['path']) !== 0))
			return null;

		$this->url = $paths[$rule]['path'];

		$realRequest = $this->getAdminRequest($request, $this->url);
		if ($realRequest === false)
			return null;

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
	 * @param string|bool $controller
	 * @param null|string $id
	 * @param array $tags
	 * @param array $opt
	 * @return bool|string
	 */
	public function getUrl(?string $controller = null, ?string $id = null, array $tags = [], array $opt = []): ?string
	{
		switch ($controller) {
			case 'AdminLogin':
				return ($this->url ? $this->url . '/' : '') . 'login';
				break;
			default:
				return null;
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
	 * @param string $adminPage
	 * @param array $pages
	 * @return string|null
	 */
	public function getAdminPageUrl(string $adminPage, array $pages = []): ?string
	{
		if (count($pages) === 0) {
			$pages = $this->model->_Admin->getPages();
			if (count($pages) === 0)
				return null;
		}

		foreach ($pages as $p) {
			if ($p['page'] === $adminPage and $p['rule'])
				return $this->getUrlPrefix() . $p['rule'];

			if ($p['sub']) {
				$check = $this->getAdminPageUrl($adminPage, $p['sub']);
				if ($check)
					return $check;
			}
		}

		return null;
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
	 * sId (for storing and retrieving list options, hence maintaining the page settings on refreshing) is either passed via input parameters or a new one is calculated
	 *
	 * @return int
	 */
	public function getSessionId(): int
	{
		$sId = $this->model->getInput('sId');
		if ($sId === null) {
			$sId = 0;
			while (isset($_SESSION['admin-search-sessions'][$this->request[0]][$sId]))
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

		if (isset($_SESSION['admin-search-sessions'][$this->request[0]][$sId])) {
			$options = $_SESSION['admin-search-sessions'][$this->request[0]][$sId];
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
		$_SESSION['admin-search-sessions'][$this->request[0]][$sId] = $options;
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
				$pages = $this->model->_Admin->getPages();
				$rule = $this->model->_Admin->seekForRule($pages, $this->request[0]);
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
			$pages = $this->model->_Admin->getPages();

		foreach ($pages as $p) {
			if (isset($p['rule']) and $p['rule'] === $request[0]) {
				$breadcrumbs[] = [
					'name' => $p['name'],
					'url' => $p['rule'],
					'get' => [],
				];
				if (isset($request[1]) and $request[1] === 'edit') {
					if (isset($request[2])) {
						$breadcrumbs[count($breadcrumbs) - 1]['get'] = ['goTo' => urlencode($request[2])];
						$breadcrumbs[] = [
							'name' => 'Edit',
							'url' => null,
							'get' => [],
						];
					} else {
						$breadcrumbs[] = [
							'name' => 'New',
							'url' => null,
							'get' => [],
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
					'get' => [],
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
				$datum->options['attributes']['name'] = 'f-' . $k;
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
				} elseif (isset($this->model->element->settings['fields'][$k])) {
					$fieldOptions = array_merge($this->model->element->settings['fields'][$k], $fieldOptions);

					if (($this->model->element->settings['fields'][$k]['type'] ?? null) === 'checkbox') {
						$fieldOptions['type'] = 'select';
						$fieldOptions['options'] = [
							'' => '',
							0 => 'No',
							1 => 'Sì',
						];
					}
				}

				switch ($t) {
					case 'empty':
						$fieldOptions['type'] = 'select';
						$fieldOptions['options'] = [
							'' => '',
							0 => 'Non vuoto',
							1 => 'Vuoto',
						];
						break;
					case 'range':
						// TODO: implemente range filter type
						break;
				}

				$datum = $form->add($k, $fieldOptions);

				if ($t !== '=')
					$datum->options['label'] = $datum->getLabel() . ' (' . $t . ')';

				if (isset($values[$k]))
					$datum->setValue($values[$k]);
			}
		}

		return $form;
	}

	/**
	 * Renders a sublist (via the chosen data visualizer)
	 * $name has to be a declared children-set of the current element
	 *
	 * @param string $name
	 * @param array Deprecated $options
	 */
	public function renderSublist(string $name, array $options = [])
	{
		echo '<div data-sublistplaceholder="' . entities($name) . '"></div>';
	}

	/**
	 * @param string $page
	 * @return string|null
	 */
	public function getRuleForPage(string $page): ?string
	{
		$pages = $this->model->_Admin->getPages();
		return $this->searchRuleForPage($pages, $page);
	}

	/**
	 * @param array $pages
	 * @param string $page
	 * @return string|null
	 */
	private function searchRuleForPage(array $pages, string $page): ?string
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
