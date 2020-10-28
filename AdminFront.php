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
