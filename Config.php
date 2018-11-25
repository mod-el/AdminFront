<?php namespace Model\AdminFront;

use Model\Core\Module_Config;

class Config extends Module_Config
{
	public $configurable = true;

	/**
	 * @throws \Model\Core\Exception
	 */
	protected function assetsList()
	{
		$this->addAsset('config');
	}

	/**
	 * @return bool
	 * @throws \Exception
	 */
	public function makeCache(): bool
	{
		$config = $this->retrieveConfig();
		$adminRules = $this->getRules();

		if ($this->model->moduleExists('WebAppManifest')) {
			foreach ($adminRules['rules'] as $ruleIdx => $rule) {
				if (substr($ruleIdx, 0, 2) === 'sw')
					continue;

				if ($rule)
					$rule .= '/';

				$manifestData = [
					'name' => APP_NAME,
					'theme_color' => '#383837',
					'background_color' => '#f2f2f2',
				];

				$currentManifest = $this->model->_WebAppManifest->getManifest($rule . 'manifest.json');
				if ($currentManifest)
					$manifestData = array_merge($manifestData, $currentManifest);

				$manifestData['start_url'] = PATH . $rule;

				$this->model->_WebAppManifest->setManifest($rule . 'manifest.json', $manifestData);

				$iconsFolder = str_replace(['/', '\\'], '-', $rule . 'manifest.json');
				$iconFormats = ['32', '192', '512'];
				foreach ($iconFormats as $format) {
					$iconPath = INCLUDE_PATH . 'app' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'WebAppManifest' . DIRECTORY_SEPARATOR . 'icons' . DIRECTORY_SEPARATOR . $iconsFolder . DIRECTORY_SEPARATOR . $format . '.png';
					if (!file_exists($iconPath))
						copy(__DIR__ . DIRECTORY_SEPARATOR . 'files' . DIRECTORY_SEPARATOR . 'img' . DIRECTORY_SEPARATOR . 'icons' . DIRECTORY_SEPARATOR . $format . '.png', $iconPath);
				}
			}
		}

		if ($config and isset($config['template']) and $config['template']) {
			$assets = $this->model->getModule($config['template'])->getAssetsForServiceWorker(false);

			$assets[] = PATH . 'model' . DIRECTORY_SEPARATOR . $config['template'] . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'header.php';
			$assets[] = PATH . 'model' . DIRECTORY_SEPARATOR . $config['template'] . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'footer.php';
		} else {
			$assets = [];
		}

		$md5 = [
			json_encode($adminRules),
		];
		foreach ($assets as $asset) {
			if (substr($asset, 0, 4) === 'http') {
				$md5[] = md5($asset);
			} else {
				$parsed = parse_url(PATHBASE . $asset);
				if (!$parsed or !isset($parsed['path']) or !file_exists($parsed['path']))
					continue;
				$md5[] = md5(file_get_contents($parsed['path']));
			}
		}

		return (bool)file_put_contents(__DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'cache-key.php', "<?php\n\$cacheKey = '" . md5(implode('', $md5)) . "';");
	}

	/**
	 * Saves configuration
	 *
	 * @param string $type
	 * @param array $data
	 * @return bool
	 * @throws \Exception
	 */
	public function saveConfig(string $type, array $data): bool
	{
		$config = $this->retrieveConfig();
		if (isset($config['url'])) {
			foreach ($config['url'] as $idx => $url) {
				if (isset($data[$idx . '-path']))
					$url['path'] = $data[$idx . '-path'];
				if (isset($data[$idx . '-table']))
					$url['table'] = $data[$idx . '-table'];
				if (isset($data[$idx . '-element']))
					$url['element'] = $data[$idx . '-element'];
				if (isset($data[$idx . '-admin-page']))
					$url['admin-page'] = $data[$idx . '-admin-page'];
				if (isset($data[$idx . '-pages']))
					$url['pages'] = $this->parsePages(json_decode($data[$idx . '-pages'], true));
				$config['url'][$idx] = $url;
			}

			foreach ($config['url'] as $idx => $url) {
				if (isset($data['delete-' . $idx]))
					unset($config['url'][$idx]);
			}
		} else {
			$config['url'] = [];
		}

		if ($data['table']) {
			$config['url'][] = [
				'path' => $data['path'],
				'table' => $data['table'],
				'element' => '',
				'admin-page' => '',
				'pages' => [],
			];
		}

		if (isset($data['template'])) $config['template'] = $data['template'];
		if (isset($data['hide-menu'])) $config['hide-menu'] = $data['hide-menu'];
		if (isset($data['dateFormat'])) $config['dateFormat'] = $data['dateFormat'];
		if (isset($data['priceFormat'])) $config['priceFormat'] = $data['priceFormat'];
		if (isset($data['stringaLogin1'])) $config['stringaLogin1'] = $data['stringaLogin1'];
		if (isset($data['stringaLogin2'])) $config['stringaLogin2'] = $data['stringaLogin2'];

		if ($this->model->isLoaded('Output')) {
			$headerTemplate = $this->model->_Output->findTemplateFile('header', $config['template']);
			if ($headerTemplate)
				$this->model->_Output->removeFileFromCache($headerTemplate['path']);
			$footerTemplate = $this->model->_Output->findTemplateFile('footer', $config['template']);
			if ($footerTemplate)
				$this->model->_Output->removeFileFromCache($footerTemplate['path']);
		}

		$adminDictionaryFile = INCLUDE_PATH . 'app' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'dictionary.php';
		if (!file_exists($adminDictionaryFile))
			file_put_contents($adminDictionaryFile, "<?php\n\$dictionary = [];\n");
		$this->checkAndInsertWords([]);

		$configFile = INCLUDE_PATH . 'app' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'config.php';

		return (bool)file_put_contents($configFile, '<?php
$config = ' . var_export($config, true) . ';
');
	}

	/**
	 * Parses the input pages, during config save, and returns them in a standard format
	 *
	 * @param array $pages
	 * @return array
	 * @throws \Model\Core\Exception
	 */
	private function parsePages(array $pages): array
	{
		foreach ($pages as &$p) {
			if (!isset($p['name']))
				$this->model->error('Name for all Admin pages is required.');

			if (isset($p['name']) and !isset($p['controller'])) {
				if (!isset($p['sub']) or isset($p['link']))
					$p['controller'] = str_replace(["\t", "\n", "\r", "\0", "\x0B", " "], '', ucwords(strtolower($p['name'])));
			}

			if (isset($p['controller']) and !isset($p['rule']))
				$p['rule'] = str_replace(' ', '-', strtolower($p['name']));

			if (in_array($p['rule'] ?? '', ['login', 'logout', 'api', 'sw.js']))
				$this->model->error('"' . $p['rule'] . '" is a reserved admin path, you cannot assign that rule to a page');

			if (isset($p['sub']))
				$p['sub'] = $this->parsePages($p['sub']);
		}
		unset($p);

		return $pages;
	}

	/**
	 * @param array $request
	 * @return null|string
	 */
	public function getTemplate(array $request): ?string
	{
		if (is_dir(INCLUDE_PATH . 'app' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'Admin'))
			return null;

		if (!in_array($request[2], ['init', 'config']))
			return null;
		return $request[2];
	}

	/**
	 * @param array $data
	 * @return mixed
	 * @throws \Exception
	 */
	public function install(array $data = []): bool
	{
		if (empty($data))
			return true;

		if (isset($data['path'], $data['table'], $data['username'], $data['password']) and $data['table']) {
			if (isset($data['make-account']) and $data['password'] != $data['repassword']) {
				$this->model->error('The passwords do not match');
			} else {
				if ($this->saveConfig('install', $data)) {
					if (isset($data['make-users-table'])) {
						$this->model->_Db->query('CREATE TABLE IF NOT EXISTS `' . $data['table'] . '` (
						  `id` int(11) NOT NULL AUTO_INCREMENT,
						  `username` varchar(250) NOT NULL,
						  `password` varchar(250) NOT NULL,
						  PRIMARY KEY (`id`)
						) ENGINE=InnoDB DEFAULT CHARSET=utf8;');
					}
					if (isset($data['make-account'])) {
						$this->model->_Db->query('INSERT INTO `' . $data['table'] . '`(username,password) VALUES(' . $this->model->_Db->quote($data['username']) . ',' . $this->model->_Db->quote(password_hash($data['password'], PASSWORD_DEFAULT)) . ')');
					}

					return true;
				} else {
					$this->model->error('Error while saving config data');
				}
			}
		}

		return false;
	}

	/**
	 * Admin pages rules
	 *
	 * @return array
	 * @throws \Exception
	 */
	public function getRules(): array
	{
		$config = $this->retrieveConfig();

		$ret = [
			'rules' => [
				'api' => 'api',
			],
			'controllers' => [
				'AdminFront',
				'AdminLogin',
				'AdminApi',
				'AdminServiceWorker',
			],
		];

		if (isset($config['url'])) {
			foreach ($config['url'] as $idx => $p) {
				$ret['rules'][$idx] = $p['path'] ?: null;
				$ret['rules']['sw' . $idx] = ($p['path'] ? $p['path'] . '/' : '') . 'sw.js';
			}
		}

		return $ret;
	}

	/**
	 * @return array
	 */
	public function searchTemplates(): array
	{
		$templates = [];

		$dirs = glob(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . '*');
		foreach ($dirs as $f) {
			if (is_dir($f) and file_exists($f . DIRECTORY_SEPARATOR . 'manifest.json')) {
				$moduleData = json_decode(file_get_contents($f . DIRECTORY_SEPARATOR . 'manifest.json'), true);
				if ($moduleData and isset($moduleData['is-admin-template']) and $moduleData['is-admin-template']) {
					$name = explode(DIRECTORY_SEPARATOR, $f);
					$name = end($name);
					$templates[$name] = $moduleData['name'];
				}
			}
		}

		return $templates;
	}

	/**
	 * @param array $words
	 * @return bool
	 */
	public function checkAndInsertWords(array $words): bool
	{
		$adminDictionaryFile = INCLUDE_PATH . 'app' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'dictionary.php';

		$dictionary = [];
		if (file_exists($adminDictionaryFile))
			require($adminDictionaryFile);

		foreach ($words as $w => $langs) {
			if (isset($dictionary[$w]))
				$dictionary[$w] = array_merge($dictionary[$w], $words[$w]);
			else
				$dictionary[$w] = $words[$w];
		}

		$w = (bool)file_put_contents($adminDictionaryFile, "<?php\n\$dictionary = " . var_export($dictionary, true) . ";\n");

		if ($w and $this->model->isLoaded('Multilang'))
			return $this->model->_Multilang->checkAndInsertWords('admin', $words);
		else
			return $w;
	}

	/**
	 * @return bool
	 */
	public function postUpdate_0_1_5()
	{
		$config = $this->retrieveConfig();
		$seen = [];
		if (isset($config['url']) and is_array($config['url'])) {
			foreach ($config['url'] as $u) {
				if ($u['table'] and !in_array($u['table'], $seen)) {
					$this->model->_Db->query('ALTER TABLE `' . $u['table'] . '` 
CHANGE COLUMN `password` `old_password` VARCHAR(250) CHARACTER SET \'utf8\' COLLATE \'utf8_unicode_ci\' NOT NULL,
ADD COLUMN `password` VARCHAR(250) NOT NULL AFTER `old_password`;');
					$seen[] = $u['table'];
				}
			}
		}
		return true;
	}
}
