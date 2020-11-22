<?php namespace Model\AdminFront\Controllers;

use Model\Admin\Auth;
use Model\Core\Autoloader;
use Model\Core\Controller;
use Model\Core\Module;
use Model\Csv\AdminBridge;

class AdminController extends Controller
{
	/** @var Module */
	private $templateModule;
	/** @var string */
	private $templateModuleName;

	public function init()
	{
		if ($this->model->isCLI())
			die('Front Admin is not accessible via CLI');

		$this->model->load('DraggableOrder');
		$this->model->load('Popup');
		$this->model->load('Form');
		$this->model->load('ContextMenu');
		$this->model->load('CSRF');

		if ($this->model->moduleExists('Dashboard'))
			$this->model->load('Dashboard');
		if ($this->model->moduleExists('CkEditor'))
			$this->model->load('CkEditor');
		if ($this->model->moduleExists('InstantSearch'))
			$this->model->load('InstantSearch');

		if ($this->model->isLoaded('Multilang') and isset($_COOKIE['admin-lang']))
			$this->model->_Multilang->setLang($_COOKIE['admin-lang']);

		$this->templateModuleName = $this->model->_AdminFront->getTemplateModule();
		$this->templateModule = $this->model->load($this->templateModuleName);
		$this->model->viewOptions['template-module'] = $this->templateModuleName;
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
				break;
			case 'template':
				if ($this->model->_AdminFront->request[1] ?? null) {
					$this->model->viewOptions['cacheTemplate'] = true;

					$this->model->_Admin->setPath($this->model->_AdminFront->url);
					$this->model->_Admin->setPage($this->model->_AdminFront->request[1]);

					$dir = $this->model->_AdminFront->url ? $this->model->_AdminFront->url . DIRECTORY_SEPARATOR : '';

					$forceLoad = false;
					$templatePath = $dir . $this->model->_AdminFront->request[1];
					if (isset($this->model->_AdminFront->request[2])) {
						$forceLoad = true;
						$templatePath .= DIRECTORY_SEPARATOR . $this->model->_AdminFront->request[2];

						$element = $this->model->_Admin->getElement();
						if (!$element)
							die();

						if (isset($this->model->_Admin->sublists[$this->model->_AdminFront->request[2]])) {
							$sublist = $this->model->_Admin->sublists[$this->model->_AdminFront->request[2]];
							$relationshipOptions = $element->getChildrenOptions($sublist['children']);

							$sublistItem = $element->create($sublist['children']);
							if (!$sublistItem)
								die();

							$form = $sublistItem->getForm();
							$form->remove($relationshipOptions['field']);
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
				break;
		}
	}

	public function post()
	{
		try {
			switch ($this->model->_AdminFront->request[0] ?? null) {
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

					return 'ok';
					break;
				case 'delete-user-customization':
					if (!isset($_GET['k']))
						die('Wrong data');

					$token = $this->getAuth();
					$this->model->_Db->delete('admin_user_customizations', [
						'path' => $token['path'],
						'user' => $token['id'],
						'key' => $_GET['k'],
					]);

					return 'ok';
					break;
				case 'export':
					if (!isset($_GET['step'], $_POST['rows'], $_POST['payload']) or !is_numeric($_POST['rows']))
						die('Dati errati');

					if (!isset($this->model->_AdminFront->request[1]))
						die('URL errato');

					$this->model->_Admin->setPath($this->model->_AdminFront->url);
					$this->model->_Admin->setPage($this->model->_AdminFront->request[1]);

					$payload = json_decode($_POST['payload'], true);
					if ($payload === null)
						die('Payload errato');

					$where = $this->model->_Admin->makeSearchQuery(
						$payload['search'] ?? '',
						$payload['filters'] ?? [],
						$payload['search-fields'] ?? []
					);

					$options = [
						'where' => $where,
					];
					if (isset($payload['page']))
						$options['p'] = $payload['page'];
					if (isset($payload['go-to']))
						$options['goTo'] = $payload['go-to'];
					if (isset($payload['per-page']))
						$options['perPage'] = $payload['per-page'];
					if (isset($payload['sort-by']))
						$options['sortBy'] = $payload['sort-by'];

					$list = $this->model->_Admin->getList($options);

					switch ($_GET['step']) {
						case 2:
							$this->model->inject('tot', $list['tot']);
							$this->model->inject('rows', $_POST['rows']);

							$this->model->viewOptions['showLayout'] = false;
							$this->model->viewOptions['cacheTemplate'] = true;
							$this->model->viewOptions['template-module'] = 'AdminFront';
							$this->model->viewOptions['template'] = 'export-popup';
							break;
						case 3:
							if ($this->model->moduleExists('Log'))
								$this->model->_Log->disableAutoLog();

							ini_set('max_execution_time', '0');

							header('Content-Type: application/csv');
							header('Content-Disposition: attachment; filename=list.csv');

							$dir = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'temp-csv';
							$title = $request[0] ?? 'export';

							$n = 1;
							while (file_exists($dir . DIRECTORY_SEPARATOR . $title . '-' . $n . '.csv'))
								$n++;

							$filePath = 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'temp-csv' . DIRECTORY_SEPARATOR . $title . '-' . $n . '.csv';

							$totalFields = $this->model->_Admin->getColumnsList();
							$columnNames = (count($payload['fields'] ?? []) > 0) ? $payload['fields'] : $totalFields['default'];

							$columns = [];
							foreach ($columnNames as $columnName) {
								if (isset($totalFields['fields'][$columnName]))
									$columns[$columnName] = $totalFields['fields'][$columnName];
							}

							$csvAdminBridge = new AdminBridge($this->model);
							$csvAdminBridge->export($list['list'], $columns, [
								'target' => INCLUDE_PATH . $filePath,
								'delimiter' => ';',
								'charset' => 'ISO-8859-1',
							]);

							return [
								'name' => $title . '-' . $n,
								'link' => PATH . 'model/AdminFront/data/temp-csv/' . $title . '-' . $n . '.csv',
							];
							break;
					}
					break;
				default:
					throw new \Exception('Unrecognized action');
					break;
			}
		} catch (\Exception $e) {
			die(getErr($e));
		}
	}

	private function getAuth(): array
	{
		$auth = new Auth($this->model);
		$token = $auth->getToken();
		if (!$token)
			$this->model->error('Invalid auth token', ['code' => 401]);

		return $token;
	}
}
