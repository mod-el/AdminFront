<?php namespace Model\AdminFront\Controllers;

use Model\Admin\Auth;
use Model\Core\Autoloader;
use Model\Core\Controller;
use Model\Core\Exception;
use Model\Core\Module;

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

		$this->model->_AdminFront->initialize(); // TODO: quando sarà tutto API based questo non servirà più

		$this->templateModuleName = $this->model->_AdminFront->getTemplateModule();
		$this->templateModule = $this->model->load($this->templateModuleName);
		$this->model->viewOptions['template-module'] = $this->templateModuleName;
	}

	public function index() // TODO: probabilmente da eliminare per la gran parte
	{
		$request = $this->model->_AdminFront->request;

		$this->model->viewOptions['cacheTemplate'] = false;
		$this->model->viewOptions['showLayout'] = false;

		if (isset($request[0])) {
			if (!isset($request[1]))
				$request[1] = '';

			if (isset($_GET['print'])) {
				$this->model->viewOptions['header'] = ['print-header'];
				$this->model->viewOptions['footer'] = ['print-footer'];
				$this->model->viewOptions['showLayout'] = true;
			}

			if (isset($_GET['ajax']) or isset($_GET['print']) or isset($_GET['csv'])) {
				$dir = $this->model->_AdminFront->url ? $this->model->_AdminFront->url . DIRECTORY_SEPARATOR : '';

				switch ($request[1]) {
					case '':
						if (!$this->model->_Admin->canUser('L'))
							$this->model->error('Can\'t open, permission denied.');

						if ($this->model->_Admin->options['table']) {
							$sId = $this->model->_AdminFront->getSessionId();

							$options = $this->model->_AdminFront->getListOptions($sId);

							if ($this->model->getInput('p'))
								$options['p'] = (int)$this->model->getInput('p');

							if ($this->model->getInput('nopag') or isset($_GET['print'])) {
								$options['p'] = 1;
								$options['perPage'] = $_GET['limit'] ?? 0;
							} else {
								$options['perPage'] = $this->model->_Admin->options['perPage'] ?? 20;
							}

							if ($this->model->getInput('filters')) {
								$options['filters'] = json_decode($this->model->getInput('filters'), true);
								if (!$options['filters'])
									$options['filters'] = [];
							}

							if ($this->model->getInput('search-columns')) {
								$options['search-columns'] = json_decode($this->model->getInput('search-columns'), true);
								if (!$options['search-columns'])
									$options['search-columns'] = [];
							}

							if ($this->model->getInput('sortBy')) {
								$options['sortBy'] = json_decode($this->model->getInput('sortBy'), true);
								if (!$options['sortBy'])
									$options['sortBy'] = [];
							}

							$this->model->_AdminFront->setListOptions($sId, $options);

							$this->model->inject('sId', $sId);
							$this->model->inject('sortedBy', $options['sortBy']);

							$draggable = false;
							if ($this->model->_Admin->options['element']) {
								$elementData = $this->model->_ORM->getElementData($this->model->_Admin->options['element']);
								if ($elementData and $elementData['order_by'] and $elementData['order_by']['custom']) {
									$draggable = [
										'field' => $elementData['order_by']['field'],
										'depending_on' => $elementData['order_by']['depending_on'],
									];
								}
							}

							$this->model->inject('draggable', $draggable);

							if ($this->model->getInput('goTo') and is_numeric($this->model->getInput('goTo')))
								$options['goTo'] = (int)$this->model->getInput('goTo');

							$visualizer = $this->model->_AdminFront->getVisualizer();
							$this->model->inject('visualizer', $visualizer);

							if (isset($_GET['csv'])) {
								$options['perPage'] = 0;
								$options['p'] = 1;
								$list = $this->model->_Admin->getList($options);
								$csvBridge = new \Model\Csv\AdminBridge($this->model);

								header('Content-Type: application/csv');
								header('Content-Disposition: attachment; filename=list.csv');

								$csvBridge->export($list, $visualizer, [
									'delimiter' => ';',
									'charset' => 'ISO-8859-1',
								]);
								die();
							}

							$this->model->inject('list', $this->model->_Admin->getList($options));

							if (isset($_GET['print'])) {
								$this->model->viewOptions['template'] = 'print';
								$this->model->viewOptions['template-module'] = 'AdminFront';
							} else {
								$this->model->viewOptions['template'] = 'list';
							}
						}
						break;
					case 'edit':
						if (!$this->model->_Admin->canUser(($this->model->element and $this->model->element->exists()) ? 'R' : 'C', null, $this->model->element ?: null))
							$this->model->error('Can\'t read, permission denied.');

						if ($this->model->element) {
							if (isset($_GET['print'])) {
								$this->model->_Admin->form->options['print'] = true;
							} else {
								if ($this->model->element->exists())
									$this->model->_Admin->form->reset();
							}

							$checkCustomTemplate = Autoloader::searchFile('template', $dir . $request[0]);
							if ($checkCustomTemplate) {
								$this->model->viewOptions['template'] = $dir . $request[0];
								unset($this->model->viewOptions['template-module']);
							} else {
								$this->model->viewOptions['template'] = 'form-template';
							}

							$this->model->viewOptions['cache'] = false; // TODO: in the final version, only form-header and form-footer should not be cached

							$this->model->viewOptions['showLayout'] = true;
							$this->model->viewOptions['template-module-layout'] = 'AdminFront';
							$this->model->viewOptions['header'] = ['form-header'];
							$this->model->viewOptions['footer'] = ['form-footer'];

							if (file_exists(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'page-header.php'))
								$this->model->viewOptions['header'][] = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'page-header.php';
							if (file_exists(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'page-footer.php'))
								array_unshift($this->model->viewOptions['footer'], INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'page-footer.php');

							if (isset($_GET['duplicated']))
								$this->model->viewOptions['messages'] = ['Succesfully duplicated!'];
						}

						if (isset($request[3])) {
							$this->model->viewOptions['template'] = $dir . $request[0] . DIRECTORY_SEPARATOR . $request[3];
						}
						break;
					case 'save':
						try {
							if (!isset($_POST['data']))
								$this->model->error('Missing technical data.');
							if (!$this->model->_CSRF->checkCsrf())
								$this->model->error('Unauthorized. Try refreshing the page.');
							$data = json_decode($_POST['data'], true);
							if ($data === null)
								$this->model->error('Wrong data');
							if (!$this->model->element)
								$this->model->error('Element does not exist');

							if (!$this->model->_Admin->canUser($this->model->element->exists() ? 'U' : 'C', null, $this->model->element))
								$this->model->error('Can\'t save, permission denied.');

							$versionLock = null;
							if (isset($_POST['version']) and is_numeric($_POST['version']))
								$versionLock = $_POST['version'];
							$id = $this->model->_Admin->saveElement($data, $versionLock);
							if ($id !== false) {
								$this->model->sendJSON([
									'status' => 'ok',
									'id' => $id,
								]);
							} else {
								$this->model->error('Error while saving');
							}
						} catch (\Exception $e) {
							$this->model->sendJSON(['status' => 'err', 'err' => getErr($e)]);
						}
						break;
					case 'delete':
						try {
							if (!$this->model->_CSRF->checkCsrf() or !isset($_GET['id']))
								$this->model->error('Missing data');
							$ids = explode(',', $_GET['id']);

							$this->model->_Db->beginTransaction();

							foreach ($ids as $id)
								$this->model->_Admin->delete($id);

							$this->model->_Db->commit();

							$this->model->sendJSON(['deleted' => $ids]);
						} catch (\Exception $e) {
							$this->model->_Db->rollBack();
							$this->model->sendJSON(['err' => getErr($e)]);
						}
						break;
					case 'changeOrder':
						try {
							if (!$this->model->element or !$this->model->element->exists())
								$this->model->error('Error: attempting to change order to a non existing element.');

							$to = $this->model->getInput('to');
							if (!$to or !is_numeric($to))
								$this->model->error('Bad parameters');

							if ($this->model->element->changeOrder($to))
								die('ok');
							else
								die('Error');
						} catch (\Exception $e) {
							$err = getErr($e);
							die($err);
						}
						break;
					default:
						$unknown = true;
						break;
				}

				if (!isset($this->model->viewOptions['template'])) {
					$customTemplate = strtolower(preg_replace('/(?<!^)([A-Z])/', '-\\1', $this->model->_Admin->options['page']));

					$checkCustomTemplate = Autoloader::searchFile('template', $dir . $customTemplate);
					if ($checkCustomTemplate) {
						$this->model->viewOptions['template'] = $dir . $customTemplate;
						unset($this->model->viewOptions['template-module']);
					} else {
						$this->model->viewOptions['template'] = 'form-template';
					}
				}
			} else {
				switch ($request[1]) {
					case 'duplicate':
						try {
							if (!$this->model->element or !$this->model->element->exists())
								$this->model->error('Error: attempting to duplicate a non existing element.');

							$newElement = $this->model->element->duplicate();
							$this->model->redirect($this->model->_AdminFront->getUrlPrefix() . $request[0] . '/edit/' . $newElement['id'] . '?duplicated');
						} catch (\Exception $e) {
							$err = getErr($e);
							die($err);
						}
						break;
					default:
						$this->model->viewOptions['template'] = 'shell';
						break;
				}
			}

			if (($this->model->viewOptions['template'] ?? null) !== 'shell') {
				if (method_exists($this->model->_AdminFront, $request[1])) {
					$this->model->viewOptions = array_merge($this->model->viewOptions, call_user_func([$this->model->_AdminFront, $request[1]]));
				} elseif (method_exists($this->model->_AdminFront->getVisualizer(), $request[1])) {
					$this->model->viewOptions = array_merge($this->model->viewOptions, call_user_func([$this->model->_AdminFront->getVisualizer(), $request[1]]));
				} elseif (method_exists($this->templateModule, $request[1])) {
					$this->model->viewOptions = array_merge($this->model->viewOptions, call_user_func([$this->templateModule, $request[1]]));
				} elseif ($this->model->_Admin->page and method_exists($this->model->_Admin->page, $request[1])) {
					$customViewOptions = call_user_func([$this->model->_Admin->page, $request[1]]);
					if ($customViewOptions and is_array($customViewOptions))
						$this->model->viewOptions = array_merge($this->model->viewOptions, $customViewOptions);
					if (isset($this->model->viewOptions['template'], $this->model->viewOptions['template-module']))
						unset($this->model->viewOptions['template-module']);
				} elseif (isset($unknown)) {
					$this->model->viewOptions['errors'][] = 'Unknown action.';
					$this->model->viewOptions['template'] = null;
				}
			}

			if ($this->model->_Admin->page) {
				$customViewOptions = $this->model->_Admin->page->viewOptions();
				if (($this->model->viewOptions['template'] ?? null) === 'shell') {
					if (isset($customViewOptions['template']))
						unset($customViewOptions['template']);
					if (isset($customViewOptions['template-module']))
						unset($customViewOptions['template-module']);
				}
				if (isset($customViewOptions['template'], $this->model->viewOptions['template-module']))
					unset($this->model->viewOptions['template-module']);
				$this->model->viewOptions = array_merge($this->model->viewOptions, $customViewOptions);
			}
		} else {
			if (isset($_GET['ajax'])) {
				if ($this->model->moduleExists('Dashboard'))
					$this->model->viewOptions['template-module'] = 'Dashboard';
				else
					$this->model->viewOptions['template-module'] = 'AdminFront';

				$this->model->viewOptions['template'] = 'dashboard';
				$this->model->viewOptions['cacheTemplate'] = false;
			} else {
				$this->model->viewOptions['template'] = 'shell';
			}
		}
	}

	public function get()
	{
		switch ($this->model->getRequest(1)) {
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
			default:
				return $this->index();
				break;
		}
	}

	public function post()
	{
		try {
			switch ($this->model->getRequest(1)) {
				case 'save-user-customization':
					if (!isset($_GET['k'], $_POST['v']))
						die('Wrong data');

					$token = $this->getAuth();
					$this->model->_Db->insert('admin_user_customizations', [
						'path' => $token['path'],
						'user' => $token['id'],
						'key' => $_GET['k'],
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
				default:
					return $this->index();
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
