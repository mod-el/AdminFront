<?php namespace Model\AdminFront\Controllers;

use Model\Core\Autoloader;
use Model\Core\Controller;
use Model\Core\Module;

class AdminController extends Controller
{
	/** @var Module */
	private $templateModule;

	public function init()
	{
		if ($this->model->isCLI())
			die('Front Admin is not accessible via CLI');

		$this->model->_AdminFront->getUser();

		$this->model->_AdminFront->initialize();

		$templateModule = $this->model->_AdminFront->getTemplateModule();
		$this->templateModule = $this->model->load($templateModule);
		$this->viewOptions['template-module'] = $templateModule;
		$this->viewOptions['template-module-layout'] = $templateModule;
	}

	public function index()
	{
		$request = $this->model->_AdminFront->request;

		$this->viewOptions['cacheTemplate'] = false;

		if (isset($request[0])) {
			if (!isset($request[1]))
				$request[1] = '';

			if (isset($_GET['ajax']) or isset($_GET['print'])) {
				if (isset($_GET['print'])) {
					$this->viewOptions['header'] = ['print-header'];
					$this->viewOptions['footer'] = ['print-footer'];
				} else {
					$this->viewOptions['showLayout'] = false;
				}

				switch ($request[1]) {
					case '':
						if ($this->model->_Admin->options['table']) {
							$sId = $this->model->_AdminFront->getSessionId();

							$options = $this->model->_AdminFront->getListOptions($sId);

							if ($this->model->getInput('p'))
								$options['p'] = (int)$this->model->getInput('p');

							if ($this->model->getInput('nopag') or isset($_GET['print'])) {
								$options['p'] = 1;
								$options['perPage'] = $_GET['limit'] ?? 0;
							} else {
								$options['perPage'] = isset($this->options['perPage']) ? $this->options['perPage'] : 20;
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

							$this->viewOptions['sId'] = $sId;
							$this->viewOptions['sortedBy'] = $options['sortBy'];

							$this->viewOptions['draggable'] = false;
							if ($this->model->_Admin->options['element']) {
								$elementData = $this->model->_ORM->getElementData($this->model->_Admin->options['element']);
								if ($elementData and $elementData['order_by'] and $elementData['order_by']['custom']) {
									$this->viewOptions['draggable'] = [
										'field' => $elementData['order_by']['field'],
										'depending_on' => $elementData['order_by']['depending_on'],
									];
								}
							}

							$this->viewOptions['visualizer'] = $this->model->_AdminFront->getVisualizer();
							$this->viewOptions['list'] = $this->model->_Admin->getList($options);

							if (isset($_GET['print'])) {
								$this->viewOptions['template'] = 'print';
								$this->viewOptions['template-module'] = 'AdminFront';
							} else {
								$this->viewOptions['template'] = 'list';
							}
						} else {
							$this->viewOptions['template'] = strtolower(preg_replace('/(?<!^)([A-Z])/', '-\\1', $this->model->_Admin->options['page']));
						}
						break;
					case 'edit':
						if (isset($_GET['getData'])) {
							$arr = $this->model->_Admin->getEditArray();
							$this->model->sendJSON($arr);
						} else {
							$dir = $this->model->_AdminFront->url ? $this->model->_AdminFront->url . DIRECTORY_SEPARATOR : '';

							if ($this->model->element) {
								if (isset($_GET['print'])) {
									$this->model->_Admin->form->options['print'] = true;
								} else {
									$this->model->_Admin->form->reset();
								}

								$checkCustomTemplate = Autoloader::searchFile('template', $dir . $request[0]);
								if ($checkCustomTemplate) {
									$this->viewOptions['template'] = $dir . $request[0];
									unset($this->viewOptions['template-module']);
								} else {
									$this->viewOptions['template'] = 'form-template';
								}

								$this->viewOptions['cache'] = false; // TODO: in the final version, only form-header and form-footer should not be cached
								if (isset($_GET['ajax'])) {
									$this->viewOptions['showLayout'] = true;
									$this->viewOptions['header'] = ['form-header'];
									$this->viewOptions['footer'] = ['form-footer'];
								} else {
									$this->viewOptions['header'][] = 'form-header';
									array_unshift($this->viewOptions['footer'], 'form-footer');
								}

								if (isset($_GET['duplicated']))
									$this->viewOptions['messages'] = ['Succesfully duplicated!'];
							}

							if (isset($request[3])) {
								$this->viewOptions['showLayout'] = false;
								$this->viewOptions['template'] = $dir . $request[0] . DIRECTORY_SEPARATOR . $request[3];
							}
						}
						break;
					case 'save':
						try {
							if (!$this->model->_CSRF->checkCsrf() or !isset($_POST['data']))
								$this->model->error('Wrong data');
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
						$this->viewOptions['template'] = null;
						break;
				}
			}

			if (method_exists($this->model->_AdminFront, $request[1])) {
				$this->viewOptions = array_merge($this->viewOptions, call_user_func([$this->model->_AdminFront, $request[1]]));
			} elseif (method_exists($this->model->_AdminFront->getVisualizer(), $request[1])) {
				$this->viewOptions = array_merge($this->viewOptions, call_user_func([$this->model->_AdminFront->getVisualizer(), $request[1]]));
			} elseif (method_exists($this->templateModule, $request[1])) {
				$this->viewOptions = array_merge($this->viewOptions, call_user_func([$this->templateModule, $request[1]]));
			} elseif ($this->model->_Admin->page and method_exists($this->model->_Admin->page, $request[1])) {
				$customViewOptions = call_user_func([$this->model->_Admin->page, $request[1]]);
				if ($customViewOptions and is_array($customViewOptions))
					$this->viewOptions = array_merge($this->viewOptions, $customViewOptions);
				else
					$this->viewOptions['template'] = null;
			} elseif (isset($unknown)) {
				$this->viewOptions['errors'][] = 'Unknown action.';
				$this->viewOptions['template'] = null;
			}

			if ($this->model->_Admin->page) {
				$customViewOptions = $this->model->_Admin->page->viewOptions();
				if (isset($customViewOptions['template'], $this->viewOptions['template-module']))
					unset($this->viewOptions['template-module']);
				$this->viewOptions = array_merge($this->viewOptions, $customViewOptions);
			}
		} else {
			if (isset($_GET['ajax']))
				$this->viewOptions['showLayout'] = false;

			$this->viewOptions['template'] = 'dashboard';
			$this->viewOptions['cacheTemplate'] = false;
		}
	}
}
