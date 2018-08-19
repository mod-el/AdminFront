<?php namespace Model\AdminFront\AdminPages;

use Model\Admin\AdminPage;

class AdminUsers extends AdminPage
{
	public function options(): array
	{
		$config = $this->model->_AdminFront->retrieveConfig();
		$usersTable = null;
		$usersElement = null;

		if (isset($config['url']) and is_array($config['url'])) {
			foreach ($config['url'] as $u) {
				if (is_array($u) and $u['path'] == $this->model->_AdminFront->url) {
					if (!($u['table'] ?? ''))
						die('No users table defined');
					$usersTable = $u['table'];
					if ($u['element'] ?? '')
						$usersElement = $u['element'];
					break;
				}
			}
		}

		$options = [
			'privileges' => [
				'D' => function ($el) {
					return (bool)($el['id'] != $this->model->_User_Admin->logged());
				},
			],
		];
		if ($usersElement)
			$options['element'] = $usersElement;
		if ($usersTable)
			$options['table'] = $usersTable;
		return $options;
	}

	public function visualizerOptions(): array
	{
		return [
			'columns' => [
				'username',
			],
		];
	}

	public function customize()
	{
		$this->model->_Admin->clearForm();
		$this->model->_Admin->field('username');
		$this->model->_Admin->field('password', 'password');
	}
}
