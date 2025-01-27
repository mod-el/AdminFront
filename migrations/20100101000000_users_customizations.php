<?php

use Phinx\Migration\AbstractMigration;

class UsersCustomizations extends AbstractMigration
{
	public function change()
	{
		if (!$this->hasTable('admin_user_customizations')) {
			$this->table('admin_user_customizations', ['signed' => true])
				->addColumn('path', 'string', ['null' => false])
				->addColumn('user', 'integer', ['null' => false])
				->addColumn('key', 'string', ['null' => false])
				->addColumn('value', 'text', ['null' => false])
				->create();
		}
	}
}
