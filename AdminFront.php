<?php namespace Model\AdminFront;

use Model\Core\Module;

class AdminFront extends Module
{
	public string $url = '';
	public array $request;

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
			var adminTemplate = <?=json_encode($this->getTemplateModule())?>;
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
		if ($realRequest === null)
			return null;

		$this->request = $realRequest;

		if (isset($realRequest[0])) {
			switch ($realRequest[0]) {
				case 'login':
				case 'logout':
					return [
						'controller' => 'AdminLogin',
					];

				default:
					return [
						'controller' => 'Admin',
					];
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
	 * @return array|null
	 */
	private function getAdminRequest(array $request, string $path): ?array
	{
		if (empty($path))
			return $request;

		$path = explode('/', $path);
		foreach ($path as $p) {
			$shift = array_shift($request);
			if ($shift !== $p)
				return null;
		}
		return $request;
	}

	/**
	 * @param string|null $controller
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

			default:
				return null;
		}
	}

	/**
	 * @return string
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
	 * @throws \Exception
	 */
	public function getTemplateModule(): string
	{
		$config = $this->retrieveConfig();
		if (!$config['template'])
			$this->model->error('No template module was defined in the configuration.');

		return $config['template'];
	}

	/**
	 * @param string $w
	 * @return string
	 */
	public function word(string $w): string
	{
		if (class_exists('\\Model\\Multilang\\Dictionary')) {
			return \Model\Multilang\Dictionary::get('admin.' . $w);
		} else {
			$dictionary = require INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'dictionary.php';
			return $dictionary[$w] ?? '';
		}
	}

	/**
	 * Renders a sublist (via the chosen data visualizer)
	 * $name has to be a declared children-set of the current element
	 *
	 * @param string $name
	 * @param array Deprecated $options
	 */
	public function renderSublist(string $name, array $options = []): void
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
