<?php namespace Model\AdminFront\Controllers;

use Model\Core\Controller;

class AdminServiceWorkerController extends Controller
{
	public function init()
	{
		header('Content-Type: text/javascript');
	}

	public function index()
	{
		$template = $this->model->_AdminFront->getTemplateModule();
		$assets = $this->model->getModule($template)->getAssetsForServiceWorker();
		require(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'cache-key.php');
		if ($this->model->isLoaded('Multilang'))
			$cacheKey .= $this->model->_Multilang->lang;
		require(INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'sw.js');
		die();
	}
}
