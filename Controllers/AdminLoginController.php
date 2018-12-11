<?php namespace Model\AdminFront\Controllers;

use Model\Core\Controller;

class AdminLoginController extends Controller
{
	function index()
	{
		$templateModule = $this->model->_AdminFront->getTemplateModule();
		$this->model->load($templateModule);
		$this->model->viewOptions['template-module'] = $templateModule;
		$this->model->viewOptions['showLayout'] = false;
		$this->model->viewOptions['template'] = 'login';
	}
}
