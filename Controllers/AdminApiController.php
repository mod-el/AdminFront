<?php namespace Model\AdminFront\Controllers;

use Model\Core\Controller;

class AdminApiController extends Controller
{
	public function init()
	{
		$this->model->_AdminFront->getUser();
		$this->model->_AdminFront->initialize();
	}

	public function index()
	{
		$request = $this->model->_AdminFront->request[1] ?? '';
		try {
			switch ($request) {
				case 'pages':
					$pages = $this->model->_AdminFront->getPages();
					$cleanPages = $this->cleanPages($pages);
					$this->respond($cleanPages);
					break;
				default:
					$this->model->error('Unknown action');
					break;
			}
		} catch (\Exception $e) {
			$this->respond(['error' => $e->getMessage()], 'ERROR');
		} catch (\Error $e) {
			$this->respond(['error' => $e->getMessage()], 'ERROR');
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
