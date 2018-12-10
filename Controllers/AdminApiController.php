<?php namespace Model\AdminFront\Controllers;

use Model\Core\Controller;
use Model\Core\Exception;

class AdminApiController extends Controller
{
	public function init()
	{
		try {
			$this->model->_AdminFront->getUser(true);
			$this->model->_AdminFront->initialize($this->model->_AdminFront->request[2] ?? null, $this->model->_AdminFront->request[3] ?? null);
		} catch (Exception $e) {
			$this->respond(['error' => getErr($e)], 'ERROR');
		}
	}

	public function get()
	{
		$request = $this->model->_AdminFront->request[1] ?? '';
		try {
			switch ($request) {
				case 'pages':
					$pages = $this->model->_AdminFront->getPages();
					$cleanPages = $this->cleanPages($pages);
					$this->respond($cleanPages);
					break;
				case 'get':
					$adminPage = $this->model->_AdminFront->request[2] ?? null;
					if (!$adminPage)
						$this->model->error('No page name defined');
					$id = $this->model->_AdminFront->request[3] ?? null;
					if (!$id or !is_numeric($id) or $id < 1)
						$this->model->error('Id should be a number greater than 0');

					$arr = $this->model->_Admin->getEditArray();
					$this->respond($arr);
					break;
				default:
					$this->model->error('Unknown action');
					break;
			}
		} catch (\Exception $e) {
			$this->respond(['error' => getErr($e)], 'ERROR');
		} catch (\Error $e) {
			$this->respond(['error' => getErr($e)], 'ERROR');
		}
	}

	/**
	 * @param array $response
	 * @param string $status
	 */
	private function respond(array $response, string $status = 'OK')
	{
		echo json_encode([
			'status' => $status,
			'response' => $response,
		]);
		die();
	}

	/**
	 * @param array $pages
	 * @return array
	 */
	private function cleanPages(array $pages): array
	{
		$cleanPages = [];
		foreach ($pages as $p) {
			if ($p['hidden'] ?? false)
				continue;
			if (($p['page'] ?? null) and !$this->model->_Admin->canUser('L', $p['page']))
				continue;
			$cleanPages[] = [
				'name' => $p['name'] ?? '',
				'path' => $p['rule'] ?? null,
				'direct' => $p['direct'] ?? null,
				'sub' => $this->cleanPages($p['sub'] ?? []),
			];
		}
		return $cleanPages;
	}
}
