<?php namespace Model\AdminFront\Controllers;

use Model\Admin\Auth;
use Model\Core\Autoloader;
use Model\Core\Controller;
use Model\CSRF\CSRF;
use Model\Admin\ExportProvider;

class AdminController extends Controller
{
	private string $templateModuleName;

	public function init()
	{
		if ($this->model->isCLI())
			die('Front Admin is not accessible via CLI');

		$this->model->load('DraggableOrder');
		$this->model->load('Popup');
		$this->model->load('Form');
		$this->model->load('ContextMenu');

		$this->model->_Admin->setPath($this->model->_AdminFront->url);
		$this->model->_Admin->loadUserModule();

		if ($this->model->moduleExists('Dashboard'))
			$this->model->load('Dashboard');
		if ($this->model->moduleExists('CkEditor'))
			$this->model->load('CkEditor');
		if ($this->model->moduleExists('InstantSearch'))
			$this->model->load('InstantSearch');

		if ($this->model->isLoaded('Multilang') and isset($_COOKIE['admin-lang']))
			$this->model->_Multilang->setLang($_COOKIE['admin-lang']);

		$this->templateModuleName = $this->model->_AdminFront->getTemplateModule();
		$this->model->viewOptions['template-module'] = $this->templateModuleName;

		$this->model->load($this->templateModuleName);
	}

	public function get()
	{
		switch ($this->model->_AdminFront->request[0] ?? null) {
			case 'get-user-customization':
				try {
					if (!isset($_GET['k']))
						die('Wrong data');

					$token = $this->getAuth();
					$check = $this->model->_Db->select('admin_user_customizations', [
						'path' => $token['path'],
						'user' => $token['id'],
						'key' => $_GET['k'],
					]);

					return [
						'data' => $check ? $check['value'] : null,
					];
				} catch (\Exception $e) {
					return [
						'error' => getErr($e),
					];
				}

			case 'template':
				if ($this->model->_AdminFront->request[1] ?? null) {
					$this->model->viewOptions['cacheTemplate'] = true;

					$this->model->_Admin->setPath($this->model->_AdminFront->url);
					$this->model->_Admin->setPage($this->model->_AdminFront->request[1]);

					$dir = $this->model->_AdminFront->url ? $this->model->_AdminFront->url . '/' : '';

					$forceLoad = false;
					$templatePath = $dir . $this->model->_AdminFront->request[1];
					if (isset($this->model->_AdminFront->request[2])) {
						$forceLoad = true;
						$templatePath .= '/' . $this->model->_AdminFront->request[2];

						$element = $this->model->_Admin->getElement();
						if (!$element)
							die();

						$sublists = $this->model->_Admin->getSublists();
						if (isset($sublists[$this->model->_AdminFront->request[2]])) {
							$sublist = $sublists[$this->model->_AdminFront->request[2]];
							if ($sublist['custom']) {
								$form = is_callable($sublist['custom']['form']) ? $sublist['custom']['form']() : $sublist['custom']['form'];
							} else {
								$relationshipOptions = $element->getChildrenOptions($sublist['relationship']);

								$sublistItem = $element->create($sublist['relationship']);
								if (!$sublistItem)
									die();

								if (!empty($sublist['template']))
									$templatePath = $sublist['template'];

								$form = $sublistItem->getForm(true);
								$form->remove(!empty($relationshipOptions['assoc']) ? $relationshipOptions['assoc']['parent'] : $relationshipOptions['field']);
							}

							$form->options['render-only-placeholders'] = true;
							$this->model->inject('form', $form);
						} else {
							$this->model->inject('form', $this->model->_Admin->getForm());
						}
					} else {
						$this->model->inject('form', $this->model->_Admin->getForm());
					}

					if (!isset($this->model->viewOptions['template']) or $forceLoad) {
						$checkCustomTemplate = Autoloader::searchFile('template', $templatePath);
						if ($checkCustomTemplate) {
							$this->model->viewOptions['template'] = $templatePath;
							unset($this->model->viewOptions['template-module']);
						} else {
							$this->model->viewOptions['template-module'] = 'AdminFront';
							$this->model->viewOptions['template'] = 'form-template';
						}
					}

					if (isset($_GET['ajax'])) {
						$this->model->viewOptions['showLayout'] = false;
					} else {
						$this->model->viewOptions['header'] = [];

						if (file_exists(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'form-header.php'))
							$this->model->viewOptions['header'][] = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'form-header.php';
						else
							$this->model->viewOptions['header'][] = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'form-header.php';

						if (file_exists(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'page-header.php'))
							$this->model->viewOptions['header'][] = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'page-header.php';
						else
							$this->model->viewOptions['header'][] = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'page-header.php';

						$this->model->viewOptions['footer'] = [];

						if (file_exists(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'page-footer.php'))
							$this->model->viewOptions['footer'][] = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'page-footer.php';

						if (file_exists(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'form-footer.php'))
							$this->model->viewOptions['footer'][] = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'form-footer.php';
						else
							$this->model->viewOptions['footer'][] = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'form-footer.php';
					}
				} else {
					if ($this->model->moduleExists('Dashboard'))
						$this->model->viewOptions['template-module'] = 'Dashboard';
					else
						$this->model->viewOptions['template-module'] = 'AdminFront';

					$this->model->viewOptions['cacheTemplate'] = false;
					$this->model->viewOptions['template'] = 'dashboard';
					$this->model->viewOptions['showLayout'] = false;
				}
				break;

			case 'export':
				$this->model->viewOptions['showLayout'] = false;
				$this->model->viewOptions['cacheTemplate'] = true;
				$this->model->viewOptions['template-module'] = 'AdminFront';
				$this->model->viewOptions['template'] = 'export-popup';
				break;

			default:
				$this->model->viewOptions['showLayout'] = false;
				$this->model->viewOptions['cacheTemplate'] = true;
				$this->model->viewOptions['template'] = 'shell';
				$this->model->inject('cp_token', CSRF::getToken('admin.api'));
				break;
		}
	}

	public function post()
	{
		try {
			switch ($this->model->_AdminFront->request[0] ?? null) {
				case 'save-dashboard-layout':
					if (!isset($_POST['layout']))
						die('Wrong data');

					$layout = json_decode($_POST['layout'], true);
					if ($layout === null)
						die('Corrupted layout data');

					if (!$this->model->moduleExists('Dashboard'))
						die('Il modulo Dashboard non è installato');

					$this->model->_Dashboard->saveNewLayout($layout);

					return [
						'success' => true,
					];

				case 'save-user-customization':
					if (!isset($_GET['k'], $_POST['v']))
						die('Wrong data');

					$token = $this->getAuth();
					$this->model->_Db->updateOrInsert('admin_user_customizations', [
						'path' => $token['path'],
						'user' => $token['id'],
						'key' => $_GET['k'],
					], [
						'value' => $_POST['v'],
					]);

					return [
						'success' => true,
					];

				case 'delete-user-customization':
					if (!isset($_GET['k']))
						die('Wrong data');

					$token = $this->getAuth();
					$this->model->_Db->delete('admin_user_customizations', [
						'path' => $token['path'],
						'user' => $token['id'],
						'key' => $_GET['k'],
					]);

					return [
						'success' => true,
					];

				case 'export':
					if (!isset($_GET['step'], $_POST['exportPayload'], $_POST['searchPayload']))
						die('Dati errati');

					if (!isset($this->model->_AdminFront->request[1]))
						die('URL errato');

					$this->model->_Admin->setPage($this->model->_AdminFront->request[1]);

					$exportPayload = json_decode($_POST['exportPayload'], true, 512, JSON_THROW_ON_ERROR);
					$searchPayload = json_decode($_POST['searchPayload'], true, 512, JSON_THROW_ON_ERROR);

					$provider = new ExportProvider($this->model->_Admin, $searchPayload);

					$dir = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'temp-csv';
					if (!is_dir($dir))
						mkdir($dir, 0777, true);

					switch ($_GET['step']) {
						case 2:
							if (!class_exists('\\Model\\Exporter\\Exporter'))
								throw new \Exception('Please install model/exporter via composer');

							$exportId = \Model\Exporter\Exporter::beginExport($provider, $dir, $exportPayload['format'], $exportPayload['paginate'], $exportPayload);

							$this->model->inject('exportId', $exportId);

							$this->model->viewOptions['showLayout'] = false;
							$this->model->viewOptions['cacheTemplate'] = true;
							$this->model->viewOptions['template-module'] = 'AdminFront';
							$this->model->viewOptions['template'] = 'export-popup';
							break;
						case 3:
							if ($this->model->moduleExists('Log'))
								$this->model->_Log->disableAutoLog();

							$response = \Model\Exporter\Exporter::next($provider, $_POST['id']);

							if ($response['status'] === 'finished') {
								$response['percentage'] = 100;
								$response['file'] = PATH . substr($response['file'], strlen(INCLUDE_PATH));
							} else {
								$response['percentage'] = round($response['current'] / $response['tot'] * 100);
							}

							return $response;

						default:
							throw new \Exception('Unknown export step');
					}
					break;

				default:
					throw new \Exception('Unrecognized action');
			}
		} catch (\Exception $e) {
			die(getErr($e));
		}
	}

	private function getAuth(): array
	{
		$token = Auth::getToken();
		if (!$token)
			$this->model->error('Invalid auth token', ['code' => 401]);

		return $token;
	}
}
