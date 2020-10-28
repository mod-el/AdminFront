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
				$this->model->viewOptions['cacheTemplate'] = true;

				$this->model->_Admin->setPath($this->model->_AdminFront->url);
				$this->model->_Admin->setPage($this->model->_AdminFront->request[1]);

				$dir = $this->model->_AdminFront->url ? $this->model->_AdminFront->url . DIRECTORY_SEPARATOR : '';

				$templatePath = $dir . $this->model->_AdminFront->request[1];
				if (isset($this->model->_AdminFront->request[2]))
					$templatePath .= DIRECTORY_SEPARATOR . $this->model->_AdminFront->request[2];

				$checkCustomTemplate = Autoloader::searchFile('template', $templatePath);
				if ($checkCustomTemplate) {
					$this->model->_Admin->getElement(); // Per poter fare poi $this->model->element->getForm()
					$this->model->viewOptions['template'] = $dir . $this->model->_AdminFront->request[1];
					unset($this->model->viewOptions['template-module']);
				} else {
					$this->model->viewOptions['template-module'] = 'AdminFront';
					$this->model->viewOptions['template'] = 'form-template';
				}

				if (isset($_GET['hideLayout'])) {
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
						$this->model->viewOptions['header'][] = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . $this->templateModuleName . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'form-footer.php';
					else
						$this->model->viewOptions['header'][] = INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'form-footer.php';
				}

//				$this->model->viewOptions['warnings'] = $this->model->_Admin->page->warnings($this->model->element); // TODO: da spostare nella richiesta data presumo
				break;
			default:
				$this->model->viewOptions['showLayout'] = false;

				if (isset($_GET['ajax'])) {
					if ($this->model->moduleExists('Dashboard'))
						$this->model->viewOptions['template-module'] = 'Dashboard';
					else
						$this->model->viewOptions['template-module'] = 'AdminFront';

					$this->model->viewOptions['cacheTemplate'] = false;
					$this->model->viewOptions['template'] = 'dashboard';
				} else {
					$this->model->viewOptions['cacheTemplate'] = true;
					$this->model->viewOptions['template'] = 'shell';
				}
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
