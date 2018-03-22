<?php namespace Model\AdminFront\Controllers;

use Model\Core\Controller;

class AdminLoginController extends Controller
{
	function index()
	{
		$user = $this->model->_AdminFront->getUser();

		$templateModule = $this->model->_AdminFront->getTemplateModule();
		$this->viewOptions['template-module'] = $templateModule;

		switch ($this->model->_AdminFront->request[0]) {
			case 'login':
				$this->viewOptions['showLayout'] = false;
				$this->viewOptions['template'] = 'login';

				if ($user->logged()) {
					$this->model->redirect($this->model->_AdminFront->getUrlPrefix());
					die();
				}

				if (isset($_POST['username'], $_POST['password'])) {
					if ($user->login($_POST['username'], $_POST['password'])) {
						$this->model->redirect($this->model->_AdminFront->getUrlPrefix());
					} else {
						$this->viewOptions['errors'][] = 'Wrong data';
					}
				}
				break;
			case 'logout':
				$user->logout();
				$this->model->redirect($this->model->getUrl('AdminLogin'));
				break;
		}
	}
}
