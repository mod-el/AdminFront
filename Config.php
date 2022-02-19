<?php namespace Model\AdminFront;

use Model\Core\Module_Config;

class Config extends Module_Config
{
	public $configurable = true;
	public $hasCleanUp = true;

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

		$adminConfigClass = new \Model\Admin\Config($this->model);
		$adminCache = $adminConfigClass->buildCache();

		if ($this->model->moduleExists('WebAppManifest')) {
			foreach ($adminCache['macro'] as $rule) {
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

				$manifestData['start_url'] = $rule;

				$this->model->_WebAppManifest->setManifest($rule . 'manifest.json', $manifestData);

				$iconsFolder = str_replace(['/', '\\'], '-', $rule . 'manifest.json');
				$iconFormats = ['32', '192', '512'];
				foreach ($iconFormats as $format) {
					$iconPath = INCLUDE_PATH . 'app' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'WebAppManifest' . DIRECTORY_SEPARATOR . 'icons' . DIRECTORY_SEPARATOR . $iconsFolder . DIRECTORY_SEPARATOR . $format . '.png';
					if (!file_exists($iconPath))
						copy(__DIR__ . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'img' . DIRECTORY_SEPARATOR . 'icons' . DIRECTORY_SEPARATOR . $format . '.png', $iconPath);
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

		if ($config and isset($config['stringaLogin1'])) { // Vecchia versione
			$config['stringaLogin'] = $config['stringaLogin1'];
			$config['enableHistoryNavigation'] = true;
			unset($config['stringaLogin1']);
			unset($config['stringaLogin2']);
			$this->saveConfig('config', $config);
		}

		$md5 = [
			json_encode($adminCache['rules']),
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
	 * @return array
	 */
	public function cacheDependencies(): array
	{
		return ['Admin'];
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

		if (isset($data['template'])) $config['template'] = $data['template'];
		if (isset($data['hide-menu'])) $config['hide-menu'] = $data['hide-menu'];
		if (isset($data['dateFormat'])) $config['dateFormat'] = $data['dateFormat'];
		if (isset($data['priceFormat'])) $config['priceFormat'] = $data['priceFormat'];
		if (isset($data['stringaLogin'])) $config['stringaLogin'] = $data['stringaLogin'];
		$config['enableHistoryNavigation'] = isset($data['enableHistoryNavigation']);

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
	 * @param string $type
	 * @return null|string
	 */
	public function getTemplate(string $type): ?string
	{
		if (!in_array($type, ['init', 'config']))
			return null;

		return $type;
	}

	/**
	 * @param array $data
	 * @return mixed
	 * @throws \Exception
	 */
	public function init(?array $data = null): bool
	{
		if ($this->model->isCLI())
			return true;
		if ($data === null)
			return false;

		if (isset($data['template']))
			return $this->saveConfig('init', $data);

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
		$adminConfigClass = new \Model\Admin\Config($this->model);
		$adminCache = $adminConfigClass->buildCache();

		$ret = [
			'rules' => [],
			'controllers' => [
				'AdminFront',
				'AdminLogin',
				'AdminServiceWorker',
			],
		];

		foreach (($adminCache['macro'] ?? []) as $idx => $path) {
			$ret['rules'][$idx] = $path ?: null;
			$ret['rules']['sw' . $idx] = ($path ? $path . '/' : '') . 'sw.js';
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
		if ($this->model->moduleExists('Multilang') and !$this->model->isLoaded('Multilang'))
			$this->model->load('Multilang');

		$adminConfigFolder = INCLUDE_PATH . 'app' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'AdminFront';
		if (!is_dir($adminConfigFolder))
			mkdir($adminConfigFolder, 0777, true);

		$adminDictionaryFile = $adminConfigFolder . DIRECTORY_SEPARATOR . 'dictionary.php';

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
	 * Clean up of all temporary csv files older than an hour
	 */
	public function cleanUp()
	{
		if (is_dir(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'temp-csv')) {
			$files = glob(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'temp-csv' . DIRECTORY_SEPARATOR . '*');
			foreach ($files as $f) {
				if (time() - filemtime($f) > 3600)
					unlink($f);
			}
		}
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

	public function getConfigData(): ?array
	{
		return [];
	}
}
