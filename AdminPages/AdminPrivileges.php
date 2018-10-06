<?php namespace Model\AdminFront\AdminPages;

use Model\Admin\AdminPage;
use Model\Core\Autoloader;

class AdminPrivileges extends AdminPage
{
	public function options(): array
	{
		$options = [
			'table' => 'admin_privileges',
			'perPage' => 0,
			'order_by' => 'id',
		];
		return $options;
	}

	public function visualizerOptions(): array
	{
		return [
			'type' => 'inner-template',
			'template' => INCLUDE_PATH . 'model' . DIRECTORY_SEPARATOR . 'AdminFront' . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . 'admin-privileges.php',
		];
	}

	public function customize()
	{
		$config = $this->model->_AdminFront->retrieveConfig();
		$usersTable = null;

		if (isset($config['url']) and is_array($config['url'])) {
			foreach ($config['url'] as $u) {
				if (is_array($u) and $u['path'] == $this->model->_AdminFront->url) {
					if (!($u['table'] ?? ''))
						$this->model->error('No users table defined');
					$usersTable = $u['table'];
					break;
				}
			}
		}

		if (!$usersTable)
			$this->model->error('No users table defined');

		$this->model->_Admin->field('user', [
			'type' => 'select',
			'table' => $usersTable,
			'text-field' => 'username',
		]);

		$options = [
			'' => [''],
		];
		$adminPages = $this->model->_AdminFront->getPages();
		$this->lookForAdminPages($options, $adminPages);

		$this->model->_Admin->field('page', [
			'type' => 'select',
			'options' => array_map(function ($p) {
				return implode(', ', $p);
			}, $options),
		]);

		$this->model->_Admin->field('subpage', [
			'attributes' => [
				'placeholder' => 'Subpage',
			],
		]);

		$this->model->_Admin->field('C', [
			'type' => 'checkbox',
			'label' => 'Create',
		]);

		$this->model->_Admin->field('R', [
			'type' => 'checkbox',
			'label' => 'Read',
		]);

		$this->model->_Admin->field('U', [
			'type' => 'checkbox',
			'label' => 'Update',
		]);

		$this->model->_Admin->field('D', [
			'type' => 'checkbox',
			'label' => 'Delete',
		]);

		$this->model->_Admin->field('L', [
			'type' => 'checkbox',
			'label' => 'List',
		]);

		$this->model->_Admin->field('C_special', [
			'attributes' => [
				'placeholder' => 'Special code',
			],
		]);

		$this->model->_Admin->field('R_special', [
			'attributes' => [
				'placeholder' => 'Special code',
			],
		]);

		$this->model->_Admin->field('U_special', [
			'attributes' => [
				'placeholder' => 'Special code',
			],
		]);

		$this->model->_Admin->field('D_special', [
			'attributes' => [
				'placeholder' => 'Special code',
			],
		]);

		$this->model->_Admin->field('L_special', [
			'attributes' => [
				'placeholder' => 'Special code',
			],
		]);
	}

	private function lookForAdminPages(array &$options, array $adminPages, string $prefix = '')
	{
		foreach ($adminPages as $p) {
			if ($p['page'] ?? null) {
				if (!isset($options[$p['page']]))
					$options[$p['page']] = [];
				$options[$p['page']][] = $prefix . $p['name'];
			}

			$this->lookForAdminPages($options, $p['sub'] ?? [], $p['name'] . ' -> ');
		}
	}
}
